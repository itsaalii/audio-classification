import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Model & Scaler paths (checks root or data directory, handles both singular and plural spelling)
def find_file(filenames: list[str]) -> Path:
    for fname in filenames:
        for parent in [BASE_DIR, BASE_DIR / "data"]:
            cand = parent / fname
            if cand.exists():
                return cand
    # Fallback to default in root
    return BASE_DIR / filenames[0]

MODEL_PATH = str(find_file(["model_k_nearest_neighbors_knn.pkl", "model_k_nearest_neighbour_knn.pkl"]))
SCALER_PATH = str(find_file(["scaler_audio.pkl"]))
FEATURES_CSV_PATH = str(find_file(["audio_features_4s.csv"]))
SAMPLES_DIR = str(BASE_DIR / "samples")

# Audio processing settings
SAMPLE_RATE = 22050
DURATION_SECONDS = 4.0
SAMPLE_COUNT = int(SAMPLE_RATE * DURATION_SECONDS)  # 88,200 samples
N_MFCC = 13

FEATURE_COLUMNS = [
    'rms',
    'spectral_centroid',
    'zcr',
    'mfcc_1',
    'mfcc_2',
    'mfcc_3',
    'mfcc_4',
    'mfcc_5',
    'mfcc_6',
    'mfcc_7',
    'mfcc_8',
    'mfcc_9',
    'mfcc_10',
    'mfcc_11',
    'mfcc_12',
    'mfcc_13'
]

# Server settings
PORT = int(os.getenv("PORT", "8080"))
HOST = os.getenv("HOST", "0.0.0.0")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:8080").split(",")

