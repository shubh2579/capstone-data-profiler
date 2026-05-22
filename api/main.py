import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/")
def root():
    return {"message": "Data Quality Engine API", "docs": "/docs"}
