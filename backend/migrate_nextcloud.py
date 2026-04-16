#!/usr/bin/env python3
"""
Nextcloud → HestiOS migration script.
Run inside hestios-backend container:
  docker exec hestios-backend python migrate_nextcloud.py 2>&1 | tee /tmp/migrate.log

Imports all files preserving folder hierarchy.
Idempotent — safe to re-run (skips already-imported files).
"""

import os
import sys
import uuid
import mimetypes
import logging
from urllib.parse import unquote
from xml.etree import ElementTree as ET
from io import BytesIO

import httpx
import boto3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Config ────────────────────────────────────────────────────────────────────
NC_BASE  = "https://cloud.hesti-rossmann.de"
NC_USER  = "a.dumitrache@hesti-rossmann.de"
NC_PASS  = "Marc=Matias=Smaranda2025"
NC_ROOT  = f"/remote.php/dav/files/{NC_USER}/"

DB_URL       = os.environ["DATABASE_URL"]
MINIO_URL    = os.environ.get("MINIO_URL",    "http://hestios-minio:9000")
MINIO_KEY    = os.environ["MINIO_ACCESS_KEY"]
MINIO_SECRET = os.environ["MINIO_SECRET_KEY"]
BUCKET       = os.environ.get("MINIO_BUCKET", "hestios")

IMPORT_USER_ID = 1   # admin user id in HestiOS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("migrate")

# ── DB + S3 ───────────────────────────────────────────────────────────────────
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_URL,
    aws_access_key_id=MINIO_KEY,
    aws_secret_access_key=MINIO_SECRET,
)

# ── WebDAV ────────────────────────────────────────────────────────────────────
NS = {"d": "DAV:"}
auth = (NC_USER, NC_PASS)


def propfind(path: str) -> ET.Element:
    with httpx.Client(auth=auth, verify=True, timeout=30) as client:
        r = client.request(
            "PROPFIND", NC_BASE + path,
            headers={"Depth": "1"},
        )
        r.raise_for_status()
    return ET.fromstring(r.content)


def list_dir(path: str):
    """Yield (is_dir, href, content_type, size) for direct children."""
    tree = propfind(path)
    for resp in tree.findall(".//d:response", NS):
        href = resp.find("d:href", NS).text
        if href.rstrip("/") == path.rstrip("/"):
            continue
        is_dir = resp.find(".//d:collection", NS) is not None
        ct_el  = resp.find(".//d:getcontenttype", NS)
        sz_el  = resp.find(".//d:getcontentlength", NS)
        ct   = (ct_el.text  if ct_el  is not None else None) or "application/octet-stream"
        size = int(sz_el.text) if sz_el is not None and sz_el.text else 0
        yield is_dir, href, ct, size


def download_to_minio(href: str, file_key: str, content_type: str) -> int:
    """Stream file from Nextcloud directly into MinIO. Returns actual byte count."""
    url = NC_BASE + href
    buf = BytesIO()
    with httpx.Client(auth=auth, verify=True, timeout=300, follow_redirects=True) as client:
        with client.stream("GET", url) as r:
            r.raise_for_status()
            for chunk in r.iter_bytes(chunk_size=8 * 1024 * 1024):
                buf.write(chunk)
    size = buf.tell()
    buf.seek(0)
    s3.put_object(Bucket=BUCKET, Key=file_key, Body=buf, ContentType=content_type)
    return size


# ── DB helpers ────────────────────────────────────────────────────────────────
def get_or_create_folder(db, name: str, parent_id, nc_path: str) -> int:
    row = db.execute(
        text("""
            SELECT id FROM folders
            WHERE name = :n
              AND parent_id IS NOT DISTINCT FROM :p
        """),
        {"n": name, "p": parent_id},
    ).fetchone()
    if row:
        return row[0]
    row = db.execute(
        text("""
            INSERT INTO folders (name, parent_id, created_by, description)
            VALUES (:n, :p, :u, :d)
            RETURNING id
        """),
        {
            "n": name,
            "p": parent_id,
            "u": IMPORT_USER_ID,
            "d": f"nc:{nc_path}",
        },
    ).fetchone()
    db.commit()
    return row[0]


def already_imported(db, nc_path: str) -> bool:
    row = db.execute(
        text("SELECT 1 FROM documents WHERE notes = :p LIMIT 1"),
        {"p": f"nc:{nc_path}"},
    ).fetchone()
    return row is not None


def insert_document(db, name: str, folder_id, file_key: str,
                    file_size: int, content_type: str, nc_path: str):
    db.execute(
        text("""
            INSERT INTO documents
                (name, category, folder_id, file_key, file_size, content_type, uploaded_by, notes)
            VALUES
                (:name, 'other', :fid, :fk, :fs, :ct, :uid, :notes)
        """),
        {
            "name":  name,
            "fid":   folder_id,   # may be None for root-level files
            "fk":    file_key,
            "fs":    file_size,
            "ct":    content_type,
            "uid":   IMPORT_USER_ID,
            "notes": f"nc:{nc_path}",
        },
    )
    db.commit()


# ── Counters ──────────────────────────────────────────────────────────────────
stats = {"ok": 0, "skip": 0, "err": 0, "bytes": 0}


def migrate_dir(db, href: str, parent_folder_id=None, depth=0):
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
            fid = get_or_create_folder(db, name, parent_folder_id, child_href)
            migrate_dir(db, child_href, fid, depth + 1)
        else:
            # Improve content-type if generic
            if ct in ("application/octet-stream", ""):
                guessed, _ = mimetypes.guess_type(name)
                if guessed:
                    ct = guessed

            if already_imported(db, child_href):
                log.info("%s  [SKIP] %s", indent, name)
                stats["skip"] += 1
                continue

            ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
            file_key = f"nextcloud/{uuid.uuid4().hex}.{ext}"

            log.info("%s  [FILE] %s  %.1f KB", indent, name, size / 1024)
            try:
                actual = download_to_minio(child_href, file_key, ct)
                insert_document(db, name, parent_folder_id, file_key, actual, ct, child_href)
                stats["ok"] += 1
                stats["bytes"] += actual
                log.info("%s         OK  %.1f KB uploaded", indent, actual / 1024)
            except Exception as e:
                log.error("%s         FAIL: %s", indent, e)
                stats["err"] += 1


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("=== Nextcloud → HestiOS migration ===")
    db = SessionLocal()
    try:
        migrate_dir(db, NC_ROOT, parent_folder_id=None, depth=0)
    finally:
        db.close()
    log.info(
        "Done. ok=%d  skipped=%d  errors=%d  total=%.1f MB",
        stats["ok"], stats["skip"], stats["err"], stats["bytes"] / 1024 / 1024,
    )
