# ==============================================================================
# Multi-stage Dockerfile untuk AcoustiKNN Studio
# Stage 1: Build Frontend (React + TypeScript + Vite + Tailwind CSS)
# Stage 2: Runtime Backend (FastAPI + scikit-learn + librosa)
# ==============================================================================

# Stage 1: Build React SPA
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Runtime
FROM python:3.12-slim AS runner
WORKDIR /app

# Install dependensi sistem untuk pemrosesan audio (libsndfile & ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependensi Python
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Salin artefak model dan scaler milik pengguna
COPY model_k_nearest_neighbors_knn.pkl scaler_audio.pkl audio_features_4s.csv ./
COPY samples/ ./samples/

# Salin kode backend
COPY backend/ ./backend/

# Salin hasil build frontend dari Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port server
EXPOSE 8080

ENV PORT=8080 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1

# Jalankan server FastAPI
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]

