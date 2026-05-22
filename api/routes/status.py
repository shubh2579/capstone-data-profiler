from fastapi import APIRouter
from app.services.db_init import get_query_engine, active_backend

router = APIRouter()

@router.get("/status")
def get_status():
    backend = active_backend()
    engine = get_query_engine()
    conn = engine.test_connection()
    return {
        "backend": backend,
        "connected": conn["success"],
        "version": conn.get("version", ""),
        "message": conn.get("message", ""),
    }
