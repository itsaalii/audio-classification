import os
import glob
from fastapi import APIRouter
from backend.app.schemas import ModelInfoResult, FeatureDetail, ModelEvaluationMetrics
from backend.app.config import (
    SAMPLE_RATE,
    DURATION_SECONDS,
    SAMPLE_COUNT,
    FEATURE_COLUMNS,
    SAMPLES_DIR
)

router = APIRouter(prefix="/api", tags=["Model Info"])

FEATURES_DOCS = [
    FeatureDetail(
        name="Root Mean Square (RMS)",
        symbol="RMS",
        category="Domain Waktu",
        description="Mengukur daya, magnitudo, dan energi fisik rata-rata dari gelombang sinyal audio. Suara bising umumnya memiliki level RMS yang jauh lebih tinggi dan fluktuatif.",
        formula=r"\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^{N} |x[n]|^2}"
    ),
    FeatureDetail(
        name="Spectral Centroid (Hz)",
        symbol="f_c",
        category="Domain Frekuensi",
        description="Menunjukkan pusat gravitasi atau titik tengah spektrum frekuensi audio. Semakin tinggi nilai centroid, semakin 'terang' (bright) atau tajam suara tersebut.",
        formula=r"f_c = \frac{\sum_{k=0}^{K-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{K-1} |X[k]|}"
    ),
    FeatureDetail(
        name="Zero Crossing Rate (ZCR)",
        symbol="ZCR",
        category="Domain Waktu",
        description="Laju perubahan tanda amplitudo sinyal dari positif ke negatif melewati sumbu nol per detik. Menjadi penanda kuat desis frekuensi tinggi acak (friction/hiss noise).",
        formula=r"\text{ZCR} = \frac{1}{2N} \sum_{n=1}^{N} |\text{sgn}(x[n]) - \text{sgn}(x[n-1])|"
    ),
    FeatureDetail(
        name="MFCC 1 (Energi Spektral Utama)",
        symbol="MFCC_1",
        category="Domain Psikoakustik Mel",
        description="Koefisien pertama yang merefleksikan kontur energi dan kenyaringan keseluruhan pada skala Mel persepsi pendengaran manusia.",
        formula=r"C_1 = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot 1 \cdot (m - 0.5)}{M} \right)"
    ),
    FeatureDetail(
        name="MFCC 2–13 (Amplop Timbre Spektral)",
        symbol="MFCC_2..13",
        category="Domain Psikoakustik Mel",
        description="Dua belas koefisien Mel yang menggambarkan tekstur dan karakteristik warna suara (timbre) untuk membedakan deru knalpot, kipas, gesekan, vokal, dan derau lingkungan.",
        formula=r"C_k = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot k \cdot (m - 0.5)}{M} \right), \quad k \in [2, \dots, 13]"
    )
]

@router.get("/model-info", response_model=ModelInfoResult)
async def get_model_info():
    """Mengembalikan spesifikasi arsitektur model WKNN, metrik evaluasi, dan daftar audio contoh."""
    # Kumpulkan daftar file sampel yang tersedia
    samples_list = []
    if os.path.exists(SAMPLES_DIR):
        for ext in ["*.mp3", "*.wav"]:
            for path in glob.glob(os.path.join(SAMPLES_DIR, "**", ext), recursive=True):
                rel_path = os.path.relpath(path, SAMPLES_DIR).replace("\\", "/")
                basename = os.path.basename(path)
                category = "Berisik" if "berisik" in rel_path.lower() and "non-berisik" not in rel_path.lower() else "Non-Berisik"
                samples_list.append({
                    "filename": basename,
                    "rel_path": rel_path,
                    "category": category,
                    "url": f"/samples/{rel_path}"
                })

    metrics = ModelEvaluationMetrics(
        test_accuracy=97.64,
        cross_val_accuracy=97.58,
        cross_val_std=0.58,
        precision_berisik=98.60,
        recall_non_berisik=98.72,
        f1_score=97.64,
        total_samples=5286,
        train_samples=4228,
        test_samples=1058,
        confusion_matrix=[
            [540, 7],   # Non-Berisik: 540 True Clean, 7 False Alarm
            [18, 493]   # Berisik: 18 Missed, 493 True Noisy
        ]
    )

    return ModelInfoResult(
        algorithm="Weighted K-Nearest Neighbors (WKNN)",
        n_neighbors=4,
        weights="Inverse Distance (w = 1 / d)",
        metric="Euclidean Distance (Minkowski p=2)",
        scaler_type="RobustScaler (Median & IQR Normalization)",
        target_sample_rate=SAMPLE_RATE,
        window_duration_s=DURATION_SECONDS,
        sample_count=SAMPLE_COUNT,
        n_features=len(FEATURE_COLUMNS),
        feature_names=FEATURE_COLUMNS,
        features_documentation=FEATURES_DOCS,
        metrics=metrics,
        sample_files=samples_list
    )

