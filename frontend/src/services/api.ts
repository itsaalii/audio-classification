/**
 * Layanan komunikasi API backend FastAPI
 */

export interface PredictionResult {
  label: 'berisik' | 'non-berisik';
  prediction: number;
  confidence: number;
  probabilities: {
    non_berisik: number;
    berisik: number;
  };
  rms: number;
  centroid_hz: number;
  zcr: number;
  mfccs: number[];
  is_ambient: boolean;
  status_text: string;
  latency_ms: number;
  timestamp: number;
  feature_values?: Record<string, number>;
}

export interface SegmentResult {
  segment_idx: number;
  start_s: number;
  end_s: number;
  time_range: string;
  status: 'berisik' | 'non-berisik';
  prediction: number;
  confidence: number;
  rms: number;
  centroid: number;
  zcr: number;
  mfccs: number[];
}

export interface FileAnalysisResult {
  filename: string;
  duration_s: number;
  sample_rate: number;
  n_segments: number;
  noisy_segments: number;
  clean_segments: number;
  noisy_percentage: number;
  overall_label: 'berisik' | 'non-berisik';
  overall_confidence: number;
  avg_rms: number;
  avg_centroid: number;
  avg_zcr: number;
  segments: SegmentResult[];
  waveform: number[];
  warnings: string[];
}

export interface FeatureDetail {
  name: string;
  symbol: string;
  category: string;
  description: string;
  formula: string;
}

export interface ModelInfoResult {
  algorithm: string;
  n_neighbors: number;
  weights: string;
  metric: string;
  scaler_type: string;
  target_sample_rate: number;
  window_duration_s: number;
  sample_count: number;
  n_features: number;
  feature_names: string[];
  features_documentation: FeatureDetail[];
  metrics: {
    test_accuracy: number;
    cross_val_accuracy: number;
    cross_val_std: number;
    precision_berisik: number;
    recall_non_berisik: number;
    f1_score: number;
    total_samples: number;
    train_samples: number;
    test_samples: number;
    confusion_matrix: number[][];
  };
  sample_files: Array<{
    filename: string;
    rel_path: string;
    category: string;
    url: string;
  }>;
}

export interface HealthResult {
  status: string;
  model_loaded: boolean;
  scaler_loaded: boolean;
  sklearn_version: string;
  uptime_s: number;
}

const API_BASE = '/api';

export async function predictLiveAudio(wavBlob: Blob, baselineRms?: number): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append('file', wavBlob, 'live_chunk.wav');
  if (baselineRms !== undefined && baselineRms > 0) {
    formData.append('baseline_rms', baselineRms.toString());
  }

  const res = await fetch(`${API_BASE}/predict-live`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function predictFileAudio(file?: File, sampleName?: string): Promise<FileAnalysisResult> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (sampleName) {
    formData.append('sample_name', sampleName);
  }

  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

export async function getModelInfo(): Promise<ModelInfoResult> {
  const res = await fetch(`${API_BASE}/model-info`);
  if (!res.ok) {
    throw new Error(`Failed to fetch model info: ${res.status}`);
  }
  return res.json();
}

export async function getHealthStatus(): Promise<HealthResult> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Failed to fetch health status: ${res.status}`);
  }
  return res.json();
}
