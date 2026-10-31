"""
Modul Utilitas Audio: Ekstraksi Fitur Akustik, Perekaman Mikrofon, dan Prediksi Model KNN (Durasi 4s)
"""

import os
import sys
import time
import warnings
import numpy as np
import librosa
import sounddevice as sd
import joblib
import threading

warnings.filterwarnings('ignore')

# Suara Alarm Peringatan di Windows (Bip Panjang 3 Detik secara Non-blocking)
_beep_lock = threading.Lock()
_is_beeping = False

try:
    import winsound
    def _play_beep_thread(freq=1200, dur=3000):
        global _is_beeping
        with _beep_lock:
            if _is_beeping:
                return
            _is_beeping = True
        try:
            winsound.Beep(freq, dur)
        except Exception:
            pass
        finally:
            with _beep_lock:
                _is_beeping = False

    def trigger_sound_alert(duration_ms: int = 3000):
        """Membunyikan nada bip panjang peringatan di Windows (3 detik) secara asinkron."""
        global _is_beeping
        with _beep_lock:
            if _is_beeping:
                return
        threading.Thread(target=_play_beep_thread, args=(1200, duration_ms), daemon=True).start()
except Exception:
    def trigger_sound_alert(duration_ms: int = 3000):
        try:
            sys.stdout.write('\a')
            sys.stdout.flush()
        except Exception:
            pass

# Konfigurasi Default Sesuai live_audio_detect.py (Model 4s)
SR_DEFAULT = 22050
DURATION_DEFAULT = 4.0
N_MFCC_DEFAULT = 13

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model_k_nearest_neighbors_knn.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler_audio.pkl")
CSV_PATH = os.path.join(BASE_DIR, "audio_features_4s.csv")

def get_audio_input_devices():
    """Mengembalikan daftar perangkat input audio yang tersedia di sistem."""
    devices = []
    try:
        all_devs = sd.query_devices()
        for idx, dev in enumerate(all_devs):
            if dev.get('max_input_channels', 0) > 0:
                name = dev.get('name', f"Device {idx}")
                devices.append({
                    "index": idx,
                    "name": f"{name} (Kanal Input: {dev.get('max_input_channels')})",
                    "raw_name": name,
                    "default_sr": int(dev.get('default_samplerate', 22050))
                })
    except Exception as e:
        print(f"Gagal mengambil daftar audio device: {e}")
    return devices

def load_knn_and_scaler():
    """Memuat model KNN dan objek Scaler (RobustScaler / StandardScaler) dari disk."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        raise FileNotFoundError(
            f"File model atau scaler belum ditemukan di {BASE_DIR}.\n"
            f"Pastikan model_k_nearest_neighbors_knn.pkl dan scaler_audio.pkl tersedia."
        )
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    return model, scaler

def extract_features(audio_data: np.ndarray, sr: int = SR_DEFAULT, n_mfcc: int = N_MFCC_DEFAULT):
    """
    Mengekstrak 16 fitur audio (RMS, Spectral Centroid, ZCR, MFCC 1..13).
    Sesuai standar pemrosesan pada live_audio_detect.py dan train.ipynb.
    """
    if len(audio_data) == 0:
        audio_data = np.zeros(int(sr * 4.0), dtype=np.float32)

    # 1. Root Mean Square (RMS)
    rms = float(np.mean(librosa.feature.rms(y=audio_data)))

    # 2. Spectral Centroid (Hz)
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=audio_data, sr=sr)))

    # 3. Zero Crossing Rate (ZCR)
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=audio_data)))

    # 4. Mel-Frequency Cepstral Coefficients (13 koefisien)
    mfcc = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=n_mfcc)
    mfcc_mean = [float(m) for m in np.mean(mfcc, axis=1)]

    feature_vector = [rms, centroid, zcr] + mfcc_mean
    return np.array(feature_vector).reshape(1, -1), {
        "rms": rms,
        "centroid": centroid,
        "zcr": zcr,
        "mfccs": mfcc_mean
    }

def record_audio_chunk(duration: float = 4.0, sr: int = SR_DEFAULT, device_index: int = None):
    """Merekam chunk audio secara langsung dari mikrofon dengan durasi tertentu (default 4 detik)."""
    samples = int(duration * sr)
    try:
        recording = sd.rec(
            samples,
            samplerate=sr,
            channels=1,
            dtype='float32',
            device=device_index
        )
        sd.wait()
        return recording.flatten()
    except Exception as e:
        # Fallback jika perekaman gagal / audio device error
        print(f"Peringatan saat merekam audio: {e}")
        time.sleep(duration)
        return np.zeros(samples, dtype=np.float32)

def predict_audio(audio_data: np.ndarray, model, scaler, sr: int = SR_DEFAULT):
    """Mengekstraksi fitur dan melakukan klasifikasi audio."""
    raw_features, feat_dict = extract_features(audio_data, sr=sr, n_mfcc=N_MFCC_DEFAULT)
    scaled_features = scaler.transform(raw_features)

    prediction = int(model.predict(scaled_features)[0])
    probabilities = model.predict_proba(scaled_features)[0] if hasattr(model, 'predict_proba') else None

    # Label: 0 = NON-BERISIK, 1 = BERISIK
    status = "BERISIK" if prediction == 1 else "NON-BERISIK"
    confidence = float(probabilities[prediction] * 100) if probabilities is not None else 100.0

    return {
        "prediction": prediction,
        "status": status,
        "confidence": confidence,
        "rms": feat_dict["rms"],
        "centroid": feat_dict["centroid"],
        "zcr": feat_dict["zcr"],
        "mfccs": feat_dict["mfccs"],
        "raw_features": raw_features[0].tolist(),
        "audio_samples": audio_data
    }

def analyze_audio_stream(file_stream, model, scaler, segment_duration: float = 4.0, sr: int = SR_DEFAULT):
    """
    Menganalisis file audio utuh dengan membaginya ke dalam segmen-segmen durasi tertentu (default 4s).
    Mengembalikan riwayat prediksi per segmen dan statistik agregat.
    """
    y, _ = librosa.load(file_stream, sr=sr)
    total_samples = len(y)
    seg_samples = int(sr * segment_duration)
    n_segments = max(1, int(total_samples // seg_samples))

    segments_result = []
    noisy_count = 0

    for idx in range(n_segments):
        start = idx * seg_samples
        end = min(start + seg_samples, total_samples)
        chunk = y[start:end]

        # Padding jika chunk terakhir kurang dari durasi
        if len(chunk) < seg_samples:
            chunk = np.pad(chunk, (0, seg_samples - len(chunk)))

        res = predict_audio(chunk, model, scaler, sr=sr)
        start_sec = idx * segment_duration
        end_sec = start_sec + segment_duration

        if res["prediction"] == 1:
            noisy_count += 1

        segments_result.append({
            "segment_idx": idx + 1,
            "time_range": f"{start_sec:.1f}s - {end_sec:.1f}s",
            "status": res["status"],
            "prediction": res["prediction"],
            "confidence": res["confidence"],
            "rms": res["rms"],
            "centroid": res["centroid"],
            "zcr": res["zcr"],
            "mfccs": res["mfccs"],
            "audio_chunk": chunk
        })

    clean_count = n_segments - noisy_count
    noisy_percentage = (noisy_count / n_segments) * 100 if n_segments > 0 else 0

    return {
        "full_audio": y,
        "total_duration": total_samples / sr,
        "n_segments": n_segments,
        "noisy_count": noisy_count,
        "clean_count": clean_count,
        "noisy_percentage": noisy_percentage,
        "segments": segments_result
    }
