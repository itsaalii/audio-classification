"""
=============================================================================
DETEKSI REAL-TIME AUDIO BERISIK MENGGUNAKAN KNN (K-NEAREST NEIGHBORS)
Durasi Deteksi: 4 Detik per Siklus (Sinkron dengan Model 4s)
=============================================================================
"""

import os
import sys
import time
import warnings
import numpy as np
import pandas as pd
import librosa
import sounddevice as sd
import joblib

# Suppress warnings
warnings.filterwarnings('ignore')

# Suara Alarm Peringatan di Windows
try:
    import winsound
    def trigger_sound_alert():
        # Frekuensi 1500 Hz, durasi 500 ms (bunyi bip peringatan)
        winsound.Beep(1500, 500)
except Exception:
    def trigger_sound_alert():
        sys.stdout.write('\a')
        sys.stdout.flush()

# Model
AUDIO_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(AUDIO_DIR, "model_k_nearest_neighbors_knn.pkl")
SCALER_PATH = os.path.join(AUDIO_DIR, "scaler_audio.pkl")

# Parameter Audio
SR = 22050              
DETECTION_DURATION = 4.0 
N_MFCC = 13             
FEATURE_COLUMNS = ['rms', 'spectral_centroid', 'zcr'] + [f'mfcc_{i+1}' for i in range(N_MFCC)]

def load_knn_and_scaler():
    """Memuat model KNN dan objek StandardScaler/RobustScaler."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        raise FileNotFoundError(
            f"File model atau scaler belum ditemukan! Pastikan telah melatih model pada train.ipynb.\n"
            f"Model: {MODEL_PATH}\nScaler: {SCALER_PATH}"
        )
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    return model, scaler

def extract_live_features(audio_data, sr=22050, n_mfcc=13):
    """
    Mengekstrak 16 fitur audio (RMS, Spectral Centroid, ZCR, MFCC 1..13)
    dari data audio 4 detik yang baru saja direkam.
    """
    # 1. RMS (Root Mean Square)
    rms = float(np.mean(librosa.feature.rms(y=audio_data)))
    
    # 2. Spectral Centroid
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=audio_data, sr=sr)))
    
    # 3. Zero Crossing Rate (ZCR)
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=audio_data)))
    
    # 4. MFCC (13 konstanta)
    mfcc = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=n_mfcc)
    mfcc_mean = np.mean(mfcc, axis=1)
    
    features = [rms, centroid, zcr] + [float(m) for m in mfcc_mean]
    return np.array(features).reshape(1, -1)

def record_audio_chunk(duration=4.0, sr=22050):
    """Merekam audio dari mikrofon selama `duration` detik."""
    samples = int(duration * sr)
    recording = sd.rec(samples, samplerate=sr, channels=1, dtype='float32')
    sd.wait()  # Tunggu hingga perekaman 4 detik selesai
    return recording.flatten()

def run_realtime_detection(model, scaler, continuous=True):
    """
    Menjalankan proses deteksi live audio secara real time.
    Setiap siklus berlangsung selama 4 detik.
    Jika terdeteksi berisik, sistem akan memunculkan peringatan visual dan suara.
    """
    print("\n" + "="*70)
    print("   SISTEM DETEKSI REAL-TIME AUDIO BERISIK DENGAN KNN (4 DETIK)")
    print("="*70)
    print(f"Sample Rate      : {SR} Hz")
    print(f"Jendela Deteksi  : {DETECTION_DURATION} Detik (Sinkron Training 4s)")
    print(f"Model Klasifikasi: K-Nearest Neighbors (KNN)")
    print("Tekan Ctrl+C kapan saja untuk menghentikan monitoring.\n")
    print("Mempersiapkan mikrofon...")
    time.sleep(1)
    print("Sistem monitoring aktif!\n")
    
    cycle = 1
    consecutive_noisy = 0
    
    try:
        while True:
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] [Siklus #{cycle}] Merekam audio selama 4 detik...", end="", flush=True)
            
            # Rekam live audio selama 4 detik
            audio_chunk = record_audio_chunk(duration=DETECTION_DURATION, sr=SR)
            print(" [Selesai] -> Menganalisis fitur...", end="", flush=True)
            
            # Ekstraksi fitur
            raw_features = extract_live_features(audio_chunk, sr=SR, n_mfcc=N_MFCC)
            scaled_features = scaler.transform(raw_features)
            
            # Prediksi menggunakan KNN
            prediction = model.predict(scaled_features)[0]
            probabilities = model.predict_proba(scaled_features)[0] if hasattr(model, 'predict_proba') else None
            
            # Ambil nilai fitur penting untuk log
            rms_val = raw_features[0, 0]
            centroid_val = raw_features[0, 1]
            zcr_val = raw_features[0, 2]
            
            if prediction == 1:
                # Kelas 1 = BERISIK
                consecutive_noisy += 1
                conf = probabilities[1] * 100 if probabilities is not None else 100.0
                print("\n" + "!"*70)
                print(f"🚨 [PERINGATAN!] TERDETEKSI SUARA BERISIK SELAMA 4 DETIK TERAKHIR! 🚨")
                print(f"   Status      : BERISIK (Confidence: {conf:.1f}%)")
                print(f"   Indikator   : RMS = {rms_val:.4f} | Centroid = {centroid_val:.1f} Hz | ZCR = {zcr_val:.4f}")
                print(f"   Akumulasi   : {consecutive_noisy} siklus 4-detik berisik berturut-turut")
                print("!"*70 + "\n")
                
                # Bunyikan alarm suara
                trigger_sound_alert()
            else:
                # Kelas 0 = NON-BERISIK
                consecutive_noisy = 0
                conf = probabilities[0] * 100 if probabilities is not None else 100.0
                print(f"\r[{timestamp}] [Siklus #{cycle}] ✅ AMAN / NON-BERISIK (Confidence: {conf:.1f}%, RMS: {rms_val:.4f})")
            
            if not continuous:
                break
                
            cycle += 1
            
    except KeyboardInterrupt:
        print("\n\n" + "="*70)
        print("Monitoring audio real-time dihentikan oleh pengguna.")
        print("="*70)

if __name__ == "__main__":
    try:
        knn_model, feature_scaler = load_knn_and_scaler()
        run_realtime_detection(knn_model, feature_scaler, continuous=True)
    except Exception as e:
        print(f"\nTerjadi kesalahan: {e}")
