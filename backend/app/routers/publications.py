from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import base64

from app.db import get_session
from app.models import Publication, PublicationView, User
from app.services.auth import get_current_user
from app.routers.admin import require_admin

router = APIRouter(prefix="/publications", tags=["Publications"])


class PublicationCreate(BaseModel):
    title: str
    description: str = ""
    content_type: str = "article"
    content_url: str = ""
    tags: List[str] = []
    category: str = ""


class PublicationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    content_url: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    is_published: Optional[bool] = None


# --- Admin: Create Publication ---

@router.post("/", response_model=dict)
def create_publication(
    payload: PublicationCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Create a new publication (admin only)."""
    publication = Publication(
        title=payload.title,
        description=payload.description,
        content_type=payload.content_type,
        content_url=payload.content_url,
        tags=payload.tags,
        category=payload.category,
        author_id=admin.id,
        author_name=admin.full_name,
        is_published=True,
    )
    session.add(publication)
    session.commit()
    session.refresh(publication)
    
    return {
        "id": publication.id,
        "title": publication.title,
        "created_at": publication.created_at,
    }


# --- Admin: Upload Publication File ---

@router.post("/{publication_id}/upload")
def upload_publication_file(
    publication_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Upload a file (video, PDF, image) for a publication."""
    publication = session.get(Publication, publication_id)
    if not publication:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    # Read file and convert to base64
    file_content = file.file.read()
    file_size = len(file_content)
    
    # Limit file size to 50MB
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
    
    file_base64 = base64.b64encode(file_content).decode("utf-8")
    
    publication.file_data = file_base64
    publication.file_name = file.filename
    publication.file_size = file_size
    
    session.add(publication)
    session.commit()
    
    return {"status": "uploaded", "file_name": file.filename, "file_size": file_size}


# --- Admin: Update Publication ---

@router.put("/{publication_id}")
def update_publication(
    publication_id: int,
    payload: PublicationUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Update a publication (admin only)."""
    publication = session.get(Publication, publication_id)
    if not publication:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(publication, field, value)
    
    publication.updated_at = datetime.now(timezone.utc).isoformat()
    session.add(publication)
    session.commit()
    session.refresh(publication)
    
    return {"status": "updated", "publication_id": publication_id}


# --- Admin: Delete Publication ---

@router.delete("/{publication_id}")
def delete_publication(
    publication_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """Delete a publication (admin only)."""
    publication = session.get(Publication, publication_id)
    if not publication:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    session.delete(publication)
    session.commit()
    
    return {"status": "deleted", "publication_id": publication_id}


# --- Admin: List All Publications ---

@router.get("/admin/list")
def admin_list_publications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    """List all publications including drafts (admin only)."""
    publications = session.exec(
        select(Publication).order_by(Publication.id.desc()).offset((page - 1) * limit).limit(limit)
    ).all()
    
    return {
        "publications": [
            {
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "content_type": p.content_type,
                "category": p.category,
                "author_name": p.author_name,
                "is_published": p.is_published,
                "view_count": p.view_count,
                "created_at": p.created_at,
            }
            for p in publications
        ],
        "page": page,
        "limit": limit,
    }


# --- Public: List Published Publications ---

@router.get("/")
def list_publications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = None,
    content_type: Optional[str] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List published publications for doctors to read."""
    query = select(Publication).where(Publication.is_published == True)
    
    if category:
        query = query.where(Publication.category == category)
    
    if content_type:
        query = query.where(Publication.content_type == content_type)
    
    if search:
        query = query.where(
            Publication.title.ilike(f"%{search}%") |
            Publication.description.ilike(f"%{search}%") |
            Publication.tags.contains([search])
        )
    
    query = query.order_by(Publication.id.desc()).offset((page - 1) * limit).limit(limit)
    publications = session.exec(query).all()
    
    return {
        "publications": [
            {
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "content_type": p.content_type,
                "content_url": p.content_url,
                "thumbnail_url": p.thumbnail_url,
                "tags": p.tags,
                "category": p.category,
                "author_name": p.author_name,
                "view_count": p.view_count,
                "created_at": p.created_at,
                "has_file": p.file_data is not None,
                "file_name": p.file_name,
            }
            for p in publications
        ],
        "page": page,
        "limit": limit,
    }


# --- Public: Get Single Publication ---

@router.get("/{publication_id}")
def get_publication(
    publication_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a single publication and track the view."""
    publication = session.get(Publication, publication_id)
    if not publication or not publication.is_published:
        raise HTTPException(status_code=404, detail="Publication not found")
    
    # Track view (one per user per publication)
    existing_view = session.exec(
        select(PublicationView).where(
            PublicationView.publication_id == publication_id,
            PublicationView.user_id == current_user.id,
        )
    ).first()
    
    if not existing_view:
        view = PublicationView(publication_id=publication_id, user_id=current_user.id)
        session.add(view)
        publication.view_count += 1
        session.add(publication)
        session.commit()
    
    return {
        "id": publication.id,
        "title": publication.title,
        "description": publication.description,
        "content_type": publication.content_type,
        "content_url": publication.content_url,
        "file_data": publication.file_data,
        "file_name": publication.file_name,
        "file_size": publication.file_size,
        "thumbnail_url": publication.thumbnail_url,
        "tags": publication.tags,
        "category": publication.category,
        "author_name": publication.author_name,
        "view_count": publication.view_count,
        "created_at": publication.created_at,
    }


# --- Public: Get Publication Categories ---

@router.get("/categories/list")
def list_categories(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all publication categories with counts."""
    categories = session.exec(
        select(Publication.category).where(Publication.is_published == True)
    ).all()
    
    category_counts = {}
    for cat in categories:
        if cat:
            category_counts[cat] = category_counts.get(cat, 0) + 1
    
    return {"categories": category_counts}


# --- Public: Get Publication File ---

@router.get("/{publication_id}/download")
def download_publication_file(
    publication_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Download publication file."""
    publication = session.get(Publication, publication_id)
    if not publication or not publication.file_data:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "file_data": publication.file_data,
        "file_name": publication.file_name,
        "file_size": publication.file_size,
    }
