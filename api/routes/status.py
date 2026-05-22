import os
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
        # diagnostic: shows whether env vars are present (not values)
        "env_check": {
            "DATA_BACKEND":          os.getenv("DATA_BACKEND", "NOT SET"),
            "SNOWFLAKE_ACCOUNT":     "SET" if os.getenv("SNOWFLAKE_ACCOUNT") else "NOT SET",
            "SNOWFLAKE_USER":        "SET" if os.getenv("SNOWFLAKE_USER") else "NOT SET",
            "SNOWFLAKE_PASSWORD":    "SET" if os.getenv("SNOWFLAKE_PASSWORD") else "NOT SET",
            "SNOWFLAKE_WAREHOUSE":   "SET" if os.getenv("SNOWFLAKE_WAREHOUSE") else "NOT SET",
            "SNOWFLAKE_DATABASE":    "SET" if os.getenv("SNOWFLAKE_DATABASE") else "NOT SET",
            "SNOWFLAKE_SCHEMA":      "SET" if os.getenv("SNOWFLAKE_SCHEMA") else "NOT SET",
        },
    }
