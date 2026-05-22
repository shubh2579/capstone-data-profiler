import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from api.routes import profile, clean, sql, anomaly, status

load_dotenv()

app = FastAPI(title="Data Quality Engine API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(status.router,  prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(clean.router,   prefix="/api")
app.include_router(sql.router,     prefix="/api")
app.include_router(anomaly.router, prefix="/api")

# ── Serve React SPA (only when the production build exists) ──────────────────
# In Docker (single-container), the React build is copied to frontend/dist.
# In local dev, the Vite dev server runs separately on port 5173.
_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if _DIST.is_dir():
    # Serve JS/CSS/image assets from dist/assets
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/")
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str = ""):
        """Return index.html for every non-API route so React Router works."""
        index = _DIST / "index.html"
        return FileResponse(index)
else:
    @app.get("/")
    def root():
        return {"message": "Data Quality Engine API — dev mode", "docs": "/docs"}
