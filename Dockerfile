# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python backend ───────────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY agent/      ./agent/
COPY api/        ./api/
COPY app/        ./app/
COPY metadata/   ./metadata/
COPY data/RIDEBOOKING.csv ./data/RIDEBOOKING.csv
COPY .env.example .env.example

# Copy built React app — FastAPI will serve it as static files
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Serve React static files from FastAPI
RUN pip install --no-cache-dir aiofiles

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
# PORT is injected by Railway/Render at runtime; default to 8000 for local use
ENV PORT=8000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
