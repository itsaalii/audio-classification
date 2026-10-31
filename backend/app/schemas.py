from typing import Any, Optional
from pydantic import BaseModel, Field

class PredictionResult(BaseModel):
    label: str = Field(..., description="'berisik' or 'non-berisik'")
    prediction: int = Field(..., description="0 for non-berisik, 1 for berisik")
    confidence: float = Field(..., description="Confidence percentage (0-100)")
    probabilities: dict[str, float] = Field(..., description="Probabilities for each class")
    rms: float = Field(..., description="RMS energy")
    centroid_hz: float = Field(..., description="Spectral centroid in Hertz")
    zcr: float = Field(..., description="Zero crossing rate")
    mfccs: list[float] = Field(..., description="Mean MFCCs 1-13")
    is_ambient: bool = Field(False, description="True if classified as ambient silence")
    status_text: str = Field("", description="Human-friendly status explanation")
    latency_ms: float = Field(0.0, description="Processing time in milliseconds")
    timestamp: float = Field(..., description="Timestamp of inference")
    feature_values: Optional[dict[str, float]] = None

class SegmentResult(BaseModel):
    segment_idx: int
    start_s: float
    end_s: float
    time_range: str
    status: str
    prediction: int
    confidence: float
    rms: float
    centroid: float
    zcr: float
    mfccs: list[float]

class FileAnalysisResult(BaseModel):
    filename: str
    duration_s: float
    sample_rate: int
    n_segments: int
    noisy_segments: int
    clean_segments: int
    noisy_percentage: float
    overall_label: str
    overall_confidence: float
    avg_rms: float
    avg_centroid: float
    avg_zcr: float
    segments: list[SegmentResult]
    waveform: list[float]  # downsampled waveform points for visualization
    warnings: list[str] = []

class FeatureDetail(BaseModel):
    name: str
    symbol: str
    category: str
    description: str
    formula: str

class ModelEvaluationMetrics(BaseModel):
    test_accuracy: float
    cross_val_accuracy: float
    cross_val_std: float
    precision_berisik: float
    recall_non_berisik: float
    f1_score: float
    total_samples: int
    train_samples: int
    test_samples: int
    confusion_matrix: list[list[int]]

class ModelInfoResult(BaseModel):
    algorithm: str
    n_neighbors: int
    weights: str
    metric: str
    scaler_type: str
    target_sample_rate: int
    window_duration_s: float
    sample_count: int
    n_features: int
    feature_names: list[str]
    features_documentation: list[FeatureDetail]
    metrics: ModelEvaluationMetrics
    sample_files: list[dict[str, str]]

class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    scaler_loaded: bool
    sklearn_version: str
    uptime_s: float

