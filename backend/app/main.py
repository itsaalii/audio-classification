import time
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import (
    ALLOWED_ORIGINS,
    SAMPLES_DIR,
    BASE_DIR,
    MODEL_PATH,
    SCALER_PATH
)
from backend.app.services.predictor import WKNNPredictor
from backend.app.api import predict, model_info, health

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Memuat Model WKNN & RobustScaler sekali saja di memori saat server startup
    print(f"[STARTUP] Memuat model WKNN dari: {MODEL_PATH}")
    print(f"[STARTUP] Memuat scaler dari: {SCALER_PATH}")
    predictor = WKNNPredictor(MODEL_PATH, SCALER_PATH)
    predictor.warmup()
    app.state.predictor = predictor
    print("[STARTUP] Model WKNN dan RobustScaler siap di memori!")
    yield
    print("[SHUTDOWN] Menghentikan server...")

app = FastAPI(
    title="AcoustiKNN API - Deteksi Real-Time Audio Berisik",
    description="Backend API Klasifikasi Audio Berisik vs Non-Berisik Menggunakan Weighted K-Nearest Neighbors (WKNN 4s)",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timing Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = (time.perf_counter() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    return response

# Register Routers
app.include_router(predict.router)
app.include_router(model_info.router)
app.include_router(health.router)

# Mount Sample Audios
if os.path.exists(SAMPLES_DIR):
    app.mount("/samples", StaticFiles(directory=SAMPLES_DIR), name="samples")

# Mount Frontend SPA if built (frontend/dist)
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Abaikan rute API, docs, openapi, dan samples
        if full_path.startswith("api") or full_path.startswith("samples") or full_path in ["docs", "redoc", "openapi.json"]:
            return None
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "AcoustiKNN Backend API Active. Buka /docs untuk dokumentasi Swagger."}
else:
    @app.get("/")
    async def root_status():
        return {
            "app": "AcoustiKNN API - Deteksi Real-Time Audio Berisik",
            "model": "Weighted K-Nearest Neighbors (WKNN 4s)",
            "status": "ready",
            "docs": "/docs"
        }

