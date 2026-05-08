from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.folder import Folder
from app.models.user import User

router = APIRouter(prefix="/folders", tags=["folders"])


def _folder_dict(f: Folder, include_children=False) -> dict:
    d = {
        "id": f.id,
        "name": f.name,
        "parent_id": f.parent_id,
        "site_id": f.site_id,
        "site_name": f.site.name if f.site else None,
        "site_kostenstelle": f.site.kostenstelle if f.site else None,
        "created_by": f.created_by,
        "creator_name": f.creator.full_name if f.creator else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "description": f.description,
        "doc_count": len(f.documents),
    }
    if include_children:
        d["children"] = [_folder_dict(c, include_children=True) for c in sorted(f.children, key=lambda x: x.name)]
    return d


@router.get("/")
def list_folders(
    site_id: Optional[int] = None,
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Folder)
    if site_id is not None:
        q = q.filter(Folder.site_id == site_id)
    if parent_id is not None:
        q = q.filter(Folder.parent_id == parent_id)
    else:
        # Default: return only root folders (no parent) with their children embedded
        q = q.filter(Folder.parent_id == None)  # noqa: E711
    folders = q.order_by(Folder.site_id, Folder.name).all()
    return [_folder_dict(f, include_children=True) for f in folders]


class FolderCreate(BaseModel):
    name: str
    site_id: Optional[int] = None
    parent_id: Optional[int] = None
    description: Optional[str] = None


class FolderRename(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    site_id: Optional[int] = None
    clear_site: bool = False
    parent_id: Optional[int] = None
    clear_parent: bool = False


@router.post("/", status_code=201)
def create_folder(
    body: FolderCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(400, "Numele folderului nu poate fi gol")
    # Check duplicate name within same parent + site
    existing = db.query(Folder).filter(
        Folder.name == body.name.strip(),
        Folder.parent_id == body.parent_id,
        Folder.site_id == body.site_id,
    ).first()
    if existing:
        raise HTTPException(400, "Există deja un folder cu acest nume")
    f = Folder(
        name=body.name.strip(),
        site_id=body.site_id,
        parent_id=body.parent_id,
        description=body.description,
        created_by=current.id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _folder_dict(f, include_children=True)


@router.patch("/{folder_id}/")
def rename_folder(
    folder_id: int,
    body: FolderRename,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    f = db.query(Folder).filter(Folder.id == folder_id).first()
    if not f:
        raise HTTPException(404, "Folder negăsit")
    if current.role not in ("director", "projekt_leiter") and f.created_by != current.id:
        raise HTTPException(403, "Acces interzis")
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(400, "Numele folderului nu poate fi gol")
        f.name = body.name.strip()
    if body.description is not None:
        f.description = body.description
    if body.clear_site:
        f.site_id = None
    elif body.site_id is not None:
        f.site_id = body.site_id
    if body.clear_parent:
        f.parent_id = None
    elif body.parent_id is not None:
        if body.parent_id == folder_id:
            raise HTTPException(400, "Un folder nu se poate muta în el însuși")
        f.parent_id = body.parent_id
    db.commit()
    db.refresh(f)
    return _folder_dict(f, include_children=True)


@router.delete("/{folder_id}/")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    f = db.query(Folder).filter(Folder.id == folder_id).first()
    if not f:
        raise HTTPException(404, "Folder negăsit")
    if current.role not in ("director", "projekt_leiter") and f.created_by != current.id:
        raise HTTPException(403, "Acces interzis")
    if f.documents:
        raise HTTPException(400, f"Folderul conține {len(f.documents)} documente. Mută-le înainte de ștergere.")
    if f.children:
        raise HTTPException(400, f"Folderul conține {len(f.children)} subfoldere. Șterge-le mai întâi.")
    db.delete(f)
    db.commit()
    return {"ok": True}


@router.get("/{folder_id}/stats/")
def folder_stats(folder_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Return recursive count of subfolders and files under a folder."""
    from app.models.document import Document as Doc

    def _collect(fid: int):
        folder_count = 0
        file_count = 0
        total_size = 0
        children = db.query(Folder).filter(Folder.parent_id == fid).all()
        for child in children:
            folder_count += 1
            fc, ff, fs = _collect(child.id)
            folder_count += fc
            file_count += ff
            total_size += fs
        docs = db.query(Doc).filter(Doc.folder_id == fid).all()
        file_count += len(docs)
        total_size += sum(d.file_size or 0 for d in docs)
        return folder_count, file_count, total_size

    f = db.query(Folder).filter(Folder.id == folder_id).first()
    if not f:
        raise HTTPException(404, "Folder negăsit")
    fc, ff, fs = _collect(folder_id)
    return {"folder_count": fc, "file_count": ff, "total_size": fs}


@router.delete("/{folder_id}/recursive/")
def delete_folder_recursive(
    folder_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Delete folder and all its contents (subfolders + files) recursively."""
    from app.models.document import Document as Doc
    from app.core.storage import delete_file

    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")

    f = db.query(Folder).filter(Folder.id == folder_id).first()
    if not f:
        raise HTTPException(404, "Folder negăsit")

    deleted_folders = 0
    deleted_files = 0

    def _delete_recursive(fid: int):
        nonlocal deleted_folders, deleted_files
        # Recurse into children first
        children = db.query(Folder).filter(Folder.parent_id == fid).all()
        for child in children:
            _delete_recursive(child.id)
        # Delete all documents in this folder
        docs = db.query(Doc).filter(Doc.folder_id == fid).all()
        for doc in docs:
            try:
                delete_file(doc.file_key)
            except Exception:
                pass
            db.delete(doc)
            deleted_files += 1
        # Delete the folder itself
        folder = db.query(Folder).filter(Folder.id == fid).first()
        if folder:
            db.delete(folder)
            deleted_folders += 1

    _delete_recursive(folder_id)
    db.commit()
    return {"ok": True, "deleted_folders": deleted_folders, "deleted_files": deleted_files}
