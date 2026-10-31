import io
import time
import os
import joblib
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from typing import Optional

from backend.app.config import (
    MODEL_PATH,
    SCALER_PATH,
    SAMPLE_RATE,
    DURATION_SECONDS,
    SAMPLE_COUNT,
    FEATURE_COLUMNS
)
from backend.app.schemas import PredictionResult, SegmentResult, FileAnalysisResult
from backend.app.services.features import extract_features_vector, prepare_chunk_4s

class WKNNPredictor:
    def __init__(self, model_path: str = MODEL_PATH, scaler_path: str = SCALER_PATH):
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.model = None
        self.scaler = None
        self.load_artifacts()

    def load_artifacts(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        if not os.path.exists(self.scaler_path):
            raise FileNotFoundError(f"Scaler file not found: {self.scaler_path}")

        self.model = joblib.load(self.model_path)
        self.scaler = joblib.load(self.scaler_path)

    def warmup(self):
        """Warm up librosa, numba, and model inference at startup."""
        try:
            synthetic_noise = np.random.normal(0, 0.05, SAMPLE_COUNT).astype(np.float32)
            feat_df, _ = extract_features_vector(synthetic_noise, sr=SAMPLE_RATE)
            scaled = self.scaler.transform(feat_df)
            self.model.predict(scaled)
            self.model.predict_proba(scaled)
        except Exception as e:
            # Non-fatal, just log
            print(f"Warmup notice: {e}")

    def predict_chunk(self, audio_data: np.ndarray, baseline_rms: Optional[float] = None) -> PredictionResult:
        t0 = time.perf_counter()
        now = time.time()

        # Pastikan panjang tepat 4.0 detik
        chunk_4s = prepare_chunk_4s(audio_data, target_samples=SAMPLE_COUNT)

        # Cek kondisi hening mutlak / ambien ruangan
        peak_amp = float(np.max(np.abs(chunk_4s))) if len(chunk_4s) > 0 else 0.0
        current_rms = float(np.sqrt(np.mean(chunk_4s ** 2))) if len(chunk_4s) > 0 else 0.0

        effective_silence_threshold = max(0.003, min(0.035, (baseline_rms or 0.0) * 1.25))

        if peak_amp < 1e-4 or current_rms <= effective_silence_threshold:
            status_text = "Ambien Dasar (Terkalibrasi)" if (baseline_rms and baseline_rms > 0.005) else "Sangat Tenang / Hening"
            latency = (time.perf_counter() - t0) * 1000
            return PredictionResult(
                label="non-berisik",
                prediction=0,
                confidence=99.5,
                probabilities={"non_berisik": 0.995, "berisik": 0.005},
                rms=round(current_rms, 6),
                centroid_hz=0.0,
                zcr=0.0,
                mfccs=[0.0] * 13,
                is_ambient=True,
                status_text=status_text,
                latency_ms=round(latency, 2),
                timestamp=now,
                feature_values={c: 0.0 for c in FEATURE_COLUMNS}
            )

        # Ekstraksi 16 fitur
        feat_df, feat_dict = extract_features_vector(chunk_4s, sr=SAMPLE_RATE)

        # Penskalaan RobustScaler
        X_scaled = self.scaler.transform(feat_df)

        # Prediksi WKNN
        pred_label_idx = int(self.model.predict(X_scaled)[0])
        probas = self.model.predict_proba(X_scaled)[0]

        prob_clean = float(probas[0])
        prob_noisy = float(probas[1])

        # Kalibrasi energi akustik pengaman (suara RMS tinggi tidak boleh diloloskan sebagai non-berisik)
        if current_rms >= 0.075 and pred_label_idx == 0:
            pred_label_idx = 1
            prob_noisy = max(prob_noisy, min(0.95, 0.60 + (current_rms - 0.075) * 3.0))
            prob_clean = 1.0 - prob_noisy

        is_noisy = (pred_label_idx == 1)
        label_str = "berisik" if is_noisy else "non-berisik"
        confidence = (prob_noisy if is_noisy else prob_clean) * 100.0

        status_text = "Peringatan: Terdeteksi Berisik" if is_noisy else "Kondisi Kondusif (Non-Berisik)"
        latency = (time.perf_counter() - t0) * 1000

        return PredictionResult(
            label=label_str,
            prediction=pred_label_idx,
            confidence=round(confidence, 2),
            probabilities={
                "non_berisik": round(prob_clean, 4),
                "berisik": round(prob_noisy, 4)
            },
            rms=round(feat_dict["rms"], 6),
            centroid_hz=round(feat_dict["centroid"], 2),
            zcr=round(feat_dict["zcr"], 6),
            mfccs=[round(m, 4) for m in feat_dict["mfccs"]],
            is_ambient=False,
            status_text=status_text,
            latency_ms=round(latency, 2),
            timestamp=now,
            feature_values={c: round(v, 4) for c, v in feat_dict["named_features"].items()}
        )

    def analyze_audio_file(self, file_bytes: bytes, filename: str) -> FileAnalysisResult:
        warnings = []
        try:
            # Baca audio via soundfile jika WAV, atau fallback librosa
            try:
                y, sr = sf.read(io.BytesIO(file_bytes), dtype='float32')
                if y.ndim > 1:
                    y = np.mean(y, axis=1)
                if sr != SAMPLE_RATE:
                    y = librosa.resample(y, orig_sr=sr, target_sr=SAMPLE_RATE)
            except Exception:
                y, _ = librosa.load(io.BytesIO(file_bytes), sr=SAMPLE_RATE)
        except Exception as e:
            raise ValueError(f"Gagal mendecode berkas audio: {e}")

        total_samples = len(y)
        duration_s = total_samples / SAMPLE_RATE

        if duration_s < 0.5:
            raise ValueError("Durasi audio terlalu pendek (minimal 0.5 detik).")
        if duration_s > 300:
            raise ValueError("Durasi audio terlalu panjang (maksimal 300 detik).")

        # Cek clipping
        clip_ratio = np.mean(np.abs(y) >= 0.99)
        if clip_ratio > 0.01:
            warnings.append(f"Terdeteksi clipping audio sebesar {clip_ratio*100:.1f}%.")

        # Bagi menjadi segmen-segmen 4.0 detik
        seg_samples = SAMPLE_COUNT
        n_segments = max(1, int(np.ceil(total_samples / seg_samples)))

        segments_res: list[SegmentResult] = []
        noisy_count = 0
        all_rms = []
        all_centroid = []
        all_zcr = []

        for idx in range(n_segments):
            start_samp = idx * seg_samples
            end_samp = min(start_samp + seg_samples, total_samples)
            chunk = y[start_samp:end_samp]

            if len(chunk) < seg_samples:
                chunk = np.pad(chunk, (0, seg_samples - len(chunk)), mode='constant')

            pred_res = self.predict_chunk(chunk)
            start_sec = idx * DURATION_SECONDS
            end_sec = min(start_sec + DURATION_SECONDS, duration_s)

            if pred_res.prediction == 1:
                noisy_count += 1

            all_rms.append(pred_res.rms)
            all_centroid.append(pred_res.centroid_hz)
            all_zcr.append(pred_res.zcr)

            segments_res.append(SegmentResult(
                segment_idx=idx + 1,
                start_s=round(start_sec, 2),
                end_s=round(end_sec, 2),
                time_range=f"{start_sec:.1f}s - {end_sec:.1f}s",
                status=pred_res.label,
                prediction=pred_res.prediction,
                confidence=pred_res.confidence,
                rms=pred_res.rms,
                centroid=pred_res.centroid_hz,
                zcr=pred_res.zcr,
                mfccs=pred_res.mfccs
            ))

        clean_count = n_segments - noisy_count
        noisy_percentage = (noisy_count / n_segments) * 100.0 if n_segments > 0 else 0.0

        overall_label = "berisik" if noisy_percentage >= 50.0 else "non-berisik"
        overall_conf = noisy_percentage if overall_label == "berisik" else (100.0 - noisy_percentage)

        # Downsample waveform ke 1000 titik untuk visualisasi interaktif
        waveform_points = 1000
        step = max(1, len(y) // waveform_points)
        subsampled = y[::step][:waveform_points]
        waveform_data = [round(float(v), 4) for v in subsampled]

        return FileAnalysisResult(
            filename=filename,
            duration_s=round(duration_s, 2),
            sample_rate=SAMPLE_RATE,
            n_segments=n_segments,
            noisy_segments=noisy_count,
            clean_segments=clean_count,
            noisy_percentage=round(noisy_percentage, 2),
            overall_label=overall_label,
            overall_confidence=round(overall_conf, 2),
            avg_rms=round(float(np.mean(all_rms)), 6) if all_rms else 0.0,
            avg_centroid=round(float(np.mean(all_centroid)), 2) if all_centroid else 0.0,
            avg_zcr=round(float(np.mean(all_zcr)), 6) if all_zcr else 0.0,
            segments=segments_res,
            waveform=waveform_data,
            warnings=warnings
        )

