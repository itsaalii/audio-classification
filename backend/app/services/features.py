import numpy as np
import librosa
import pandas as pd
from backend.app.config import SAMPLE_RATE, DURATION_SECONDS, SAMPLE_COUNT, N_MFCC, FEATURE_COLUMNS

def extract_features_vector(audio_data: np.ndarray, sr: int = SAMPLE_RATE, n_mfcc: int = N_MFCC):
    """
    Ekstraksi 16 fitur akustik (RMS, Spectral Centroid, ZCR, MFCC 1-13).
    Sesuai standar training pada audio_features_4s.csv dan train.ipynb.
    """
    if len(audio_data) == 0:
        audio_data = np.zeros(SAMPLE_COUNT, dtype=np.float32)

    # Pastikan data float32 dan 1 dimensi
    audio_data = audio_data.astype(np.float32).flatten()

    # 1. Root Mean Square (RMS) Energy
    rms_arr = librosa.feature.rms(y=audio_data)
    rms = float(np.mean(rms_arr)) if rms_arr.size > 0 else 0.0

    # 2. Spectral Centroid (Hz)
    centroid_arr = librosa.feature.spectral_centroid(y=audio_data, sr=sr)
    centroid = float(np.mean(centroid_arr)) if centroid_arr.size > 0 else 0.0

    # 3. Zero Crossing Rate (ZCR)
    zcr_arr = librosa.feature.zero_crossing_rate(y=audio_data)
    zcr = float(np.mean(zcr_arr)) if zcr_arr.size > 0 else 0.0

    # 4. MFCCs (13 koefisien)
    mfcc_matrix = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=n_mfcc)
    mfcc_mean = [float(m) for m in np.mean(mfcc_matrix, axis=1)] if mfcc_matrix.size > 0 else [0.0] * n_mfcc

    # Susun vektor fitur & dict
    raw_vector = [rms, centroid, zcr] + mfcc_mean
    feat_df = pd.DataFrame([raw_vector], columns=FEATURE_COLUMNS)

    feat_dict = {
        "rms": rms,
        "centroid": centroid,
        "zcr": zcr,
        "mfccs": mfcc_mean,
        "raw_vector": raw_vector,
        "named_features": {col: val for col, val in zip(FEATURE_COLUMNS, raw_vector)}
    }
    return feat_df, feat_dict

def prepare_chunk_4s(audio: np.ndarray, target_samples: int = SAMPLE_COUNT) -> np.ndarray:
    """Menyesuaikan panjang sinyal agar persis 4.0 detik (88.200 sampel)."""
    curr_len = len(audio)
    if curr_len == target_samples:
        return audio
    if curr_len < target_samples:
        # Zero padding di bagian belakang
        pad_width = target_samples - curr_len
        return np.pad(audio, (0, pad_width), mode='constant')
    # Ambil 4 detik terakhir jika lebih panjang
    return audio[-target_samples:]

