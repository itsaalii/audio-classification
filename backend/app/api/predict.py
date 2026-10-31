import io
import os
import glob
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
import soundfile as sf
import librosa
import numpy as np

from backend.app.schemas import PredictionResult, FileAnalysisResult
from backend.app.config import SAMPLE_RATE, SAMPLES_DIR

router = APIRouter(prefix="/api", tags=["Prediction"])

@router.post("/predict-live", response_model=PredictionResult)
async def predict_live(
    request: Request,
    file: UploadFile = File(...),
    baseline_rms: Optional[float] = Form(None)
):
    """
    Endpoint deteksi mikrofon real-time (jendela 4 detik, dikirim setiap 1 detik).
    Menerima berkas audio WAV 16-bit PCM mono 22.050 Hz dari browser.
    """
    predictor = getattr(request.app.state, "predictor", None)
    if not predictor:
        raise HTTPException(status_code=503, detail="Model predictor belum siap atau sedang dimuat.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Berkas audio kosong.")

        # Decode WAV langsung dari memori via soundfile
        try:
            audio, sr = sf.read(io.BytesIO(content), dtype="float32")
            if audio.ndim > 1:
                audio = np.mean(audio, axis=1)
            if sr != SAMPLE_RATE:
                audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        except Exception:
            audio, _ = librosa.load(io.BytesIO(content), sr=SAMPLE_RATE)

        result = predictor.predict_chunk(audio, baseline_rms=baseline_rms)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses audio live: {str(e)}")

@router.post("/predict", response_model=FileAnalysisResult)
async def predict_file(
    request: Request,
    file: Optional[UploadFile] = File(None),
    sample_name: Optional[str] = Form(None)
):
    """
    Endpoint analisis berkas audio utuh (upload MP3/WAV atau memilih audio sampel).
    Memotong audio ke dalam segmen 4.0 detik dan menganalisis secara komprehensif.
    """
    predictor = getattr(request.app.state, "predictor", None)
    if not predictor:
        raise HTTPException(status_code=503, detail="Model predictor belum siap.")

    content = None
    filename = "audio.wav"

    if sample_name:
        # Cari file di folder samples
        sample_path = os.path.join(SAMPLES_DIR, sample_name)
        if not os.path.exists(sample_path):
            # Cek di subfolder
            matches = glob.glob(os.path.join(SAMPLES_DIR, "**", sample_name), recursive=True)
            if matches:
                sample_path = matches[0]
            else:
                raise HTTPException(status_code=404, detail=f"Sampel audio '{sample_name}' tidak ditemukan.")

        with open(sample_path, "rb") as f:
            content = f.read()
        filename = os.path.basename(sample_path)

    elif file:
        content = await file.read()
        filename = file.filename or "uploaded_audio.mp3"

    else:
        raise HTTPException(status_code=400, detail="Harap unggah berkas audio atau pilih sampel yang tersedia.")

    if not content:
        raise HTTPException(status_code=400, detail="Berkas audio kosong.")

    try:
        analysis = predictor.analyze_audio_file(content, filename=filename)
        return analysis
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menganalisis berkas audio: {str(e)}")

