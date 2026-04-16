#!/usr/bin/env python3
"""
Nextcloud → HestiOS migration (runs locally on Mac).
Uses curl for Nextcloud WebDAV (Python httpx blocked by server TLS policy).
Uses boto3 for MinIO, httpx for HestiOS API.

Usage:
  python3 migrate_nextcloud_local.py                        # import everything
  python3 migrate_nextcloud_local.py --test-folder JoureFix # test on one folder
"""

import os
import sys
import uuid
import mimetypes
import logging
import argparse
import subprocess
import tempfile
from urllib.parse import unquote, quote
from xml.etree import ElementTree as ET

import httpx
import boto3

# ── Config ────────────────────────────────────────────────────────────────────
NC_BASE  = "https://cloud.hesti-rossmann.de"
NC_USER  = "a.dumitrache@hesti-rossmann.de"
NC_PASS  = "Marc=Matias=Smaranda2025"
NC_ROOT  = f"/remote.php/dav/files/{NC_USER}/"

HESTIOS_API   = "https://erp.hesti-rossmann.de/api"
HESTIOS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MTc3NjE5MTA2NX0.8Qc7b9Et8dBJY9J6Gxs9iJ37faG44SuLwjVpj9iIYYU"

MINIO_ENDPOINT = "http://erp.hesti-rossmann.de:9000"
MINIO_KEY      = "hestios_minio"
MINIO_SECRET   = "51a3d0efa5857aebfb90c69e5606619c10eb8048fb54cab5170bff907987eaa3"
BUCKET         = "hestios-files"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("migrate")

# ── Clients ───────────────────────────────────────────────────────────────────
api = httpx.Client(
    headers={"Authorization": f"Bearer {HESTIOS_TOKEN}"},
    base_url=HESTIOS_API,
    timeout=30,
)

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_KEY,
    aws_secret_access_key=MINIO_SECRET,
)

NC_AUTH = f"{NC_USER}:{NC_PASS}"

# ── WebDAV via curl ───────────────────────────────────────────────────────────
NS = {"d": "DAV:"}


def curl_propfind(path: str) -> ET.Element:
    result = subprocess.run(
        ["curl", "-s", "-u", NC_AUTH, "-X", "PROPFIND", "-H", "Depth: 1",
         NC_BASE + path],
        capture_output=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl PROPFIND failed: {result.stderr.decode()}")
    return ET.fromstring(result.stdout)


def list_dir(path: str):
    tree = curl_propfind(path)
    for resp in tree.findall(".//d:response", NS):
        href = resp.find("d:href", NS).text
        if href.rstrip("/") == path.rstrip("/"):
            continue
        is_dir = resp.find(".//d:collection", NS) is not None
        ct_el  = resp.find(".//d:getcontenttype", NS)
        sz_el  = resp.find(".//d:getcontentlength", NS)
        ct   = (ct_el.text if ct_el is not None else None) or "application/octet-stream"
        size = int(sz_el.text) if sz_el is not None and sz_el.text else 0
        yield is_dir, href, ct, size


def curl_download_to_file(href: str, dest_path: str):
    result = subprocess.run(
        ["curl", "-s", "-u", NC_AUTH, "-o", dest_path, NC_BASE + href],
        capture_output=True, timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl download failed: {result.stderr.decode()}")


# ── HestiOS helpers ───────────────────────────────────────────────────────────
_folder_cache: dict[tuple, int] = {}


def get_or_create_folder(name: str, parent_id, nc_path: str) -> int:
    key = (name, parent_id)
    if key in _folder_cache:
        return _folder_cache[key]

    # Try to create first
    r = api.post("/folders/", json={"name": name, "parent_id": parent_id,
                                     "description": f"nc:{nc_path}"})
    if r.status_code == 201:
        fid = r.json()["id"]
        _folder_cache[key] = fid
        return fid

    # 400 = already exists or other validation error — search by parent_id
    params = {"parent_id": parent_id} if parent_id is not None else {}
    resp = api.get("/folders/", params=params)
    if resp.status_code == 200:
        def search(folders):
            for f in folders:
                if f["name"] == name and f["parent_id"] == parent_id:
                    return f["id"]
                found = search(f.get("children", []))
                if found:
                    return found
            return None
        fid = search(resp.json())
        if fid:
            _folder_cache[key] = fid
            return fid

    # Last resort: search all folders
    resp2 = api.get("/folders/")
    if resp2.status_code == 200:
        def search_all(folders):
            for f in folders:
                if f["name"] == name and f["parent_id"] == parent_id:
                    return f["id"]
                found = search_all(f.get("children", []))
                if found:
                    return found
            return None
        fid = search_all(resp2.json())
        if fid:
            _folder_cache[key] = fid
            return fid

    raise RuntimeError(f"Cannot create or find folder '{name}' (parent={parent_id}): {r.text}")


def already_imported(nc_path: str) -> bool:
    # notes field stores "nc:<path>"
    r = api.get("/documents/", params={"search": os.path.basename(nc_path.rstrip("/"))})
    if r.status_code != 200:
        return False
    tag = f"nc:{nc_path}"
    return any((d.get("notes") or "").strip() == tag for d in r.json())


def register_document(name: str, folder_id, file_key: str,
                      file_size: int, content_type: str, nc_path: str):
    r = api.post("/documents/register/", json={
        "name": name,
        "category": "other",
        "folder_id": folder_id,
        "file_key": file_key,
        "file_size": file_size,
        "content_type": content_type,
        "notes": f"nc:{nc_path}",
    })
    r.raise_for_status()
    return r.json()


# ── Core migration ─────────────────────────────────────────────────────────────
stats = {"ok": 0, "skip": 0, "err": 0, "bytes": 0}


def migrate_dir(href: str, parent_folder_id=None, depth=0):
    indent = "  " * depth
    try:
        children = list(list_dir(href))
    except Exception as e:
        log.error("%sCannot list %s: %s", indent, href, e)
        return

    for is_dir, child_href, ct, size in children:
        name = unquote(child_href.rstrip("/").rsplit("/", 1)[-1])

        if is_dir:
            log.info("%s[DIR] %s", indent, name)
            fid = get_or_create_folder(name, parent_folder_id, child_href)
            migrate_dir(child_href, fid, depth + 1)
        else:
            # Improve generic content-type
            if ct in ("application/octet-stream", ""):
                guessed, _ = mimetypes.guess_type(name)
                if guessed:
                    ct = guessed

            if already_imported(child_href):
                log.info("%s  [SKIP] %s", indent, name)
                stats["skip"] += 1
                continue

            ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
            file_key = f"nextcloud/{uuid.uuid4().hex}.{ext}"

            log.info("%s  [FILE] %s  (%.0f KB)", indent, name, size / 1024)
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
                    tmp_path = tmp.name

                curl_download_to_file(child_href, tmp_path)
                actual_size = os.path.getsize(tmp_path)

                with open(tmp_path, "rb") as f:
                    s3.put_object(Bucket=BUCKET, Key=file_key, Body=f, ContentType=ct)

                os.unlink(tmp_path)
                register_document(name, parent_folder_id, file_key, actual_size, ct, child_href)
                stats["ok"] += 1
                stats["bytes"] += actual_size
                log.info("%s         OK  %.0f KB", indent, actual_size / 1024)
            except Exception as e:
                log.error("%s         FAIL: %s", indent, e)
                try: os.unlink(tmp_path)
                except: pass
                stats["err"] += 1


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-folder", help="Import only this top-level folder")
    args = parser.parse_args()

    root = NC_ROOT
    if args.test_folder:
        root = f"{NC_ROOT}{quote(args.test_folder, safe='')}/"
        log.info("TEST MODE — folder: %s", args.test_folder)

    log.info("=== Nextcloud → HestiOS migration ===")
    try:
        migrate_dir(root, parent_folder_id=None, depth=0)
    finally:
        api.close()

    log.info("Done. ok=%d  skip=%d  err=%d  total=%.1f MB",
             stats["ok"], stats["skip"], stats["err"], stats["bytes"] / 1024 / 1024)
