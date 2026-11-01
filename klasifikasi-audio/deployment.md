# Deployment

Dokumentasi fase keenam metodologi **CRISP-DM (Cross-Industry Standard Process for Data Mining)** untuk penyebaran sistem ke lingkungan produksi (*Production Deployment*), mencakup arsitektur modern FastAPI, antarmuka React 19 SPA, logika toleransi bergerak, sintesis beep kontinu, dan kontainerisasi multi-stage Docker.

---

## 1. Arsitektur Sistem Produksi

Sistem tidak lagi menggunakan platform prototipe monolitik, melainkan telah dimigrasikan ke arsitektur produksi modern berbasis **FastAPI (Backend)** dan **React 19 + TypeScript (Frontend)** yang dikemas portabel menggunakan **Docker**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        KLIEN (BROWSER REACT 19 SPA)                    │
├──────────────────────────────────────┬─────────────────────────────────┤
│           INPUT MIKROFON             │        UNGGAH BERKAS AUDIO      │
│  • Web Audio API (AudioContext)      │  • WAV / MP3                    │
│  • Circular Rolling Buffer (4s)      │  • Segmentasi Blok 4s Berurutan │
│  • 16-bit PCM Mono 22.050 Hz         │  • Navigasi Playhead Interaktif │
└──────────────────┬───────────────────┴────────────────┬────────────────┘
                   │ HTTP POST (Multipart/WAV)          │ HTTP POST (File)
                   ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FASTAPI BACKEND (PYTHON)                       │
├────────────────────────────────────────────────────────────────────────┤
│  1. Ingestion Buffer Audio (io.BytesIO -> Soundfile / Librosa)         │
│  2. Ekstraksi 16 Parameter Akustik PSD (Ranah Waktu, Frekuensi & Mel)  │
│  3. Transformasi Fitur via RobustScaler (scaler_audio.pkl)             │
│  4. Inferensi Model WKNN K=4 (model_k_nearest_neighbors_knn.pkl)      │
│  5. Perhitungan Probabilitas, Confidence Score & Diagnostik Parameter │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │ JSON Response (Prediksi, Probabilitas, 16 Fitur)
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TAMPILAN & AKSI RESPON                          │
├────────────────────────────────────────────────────────────────────────┤
│  • Visualizer Osiloskop & Spektrogram 60 FPS (Canvas Latar Putih)     │
│  • Evaluasi Toleransi Bergerak (Rolling Window: Real-Time s/d 30s)    │
│  • Sintesis Beep Panjang Kontinu 880 Hz (Durasi Default 3s / Mute)    │
│  • Rendering Rumus Matematika Native (KaTeX LaTeX)                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pemuatan Model ke Memori (FastAPI In-Memory Singleton)

Untuk mencapai latensi inferensi ultra-rendah ($\approx 8 - 15\text{ ms}$), artefak model dan scaler **tidak dibaca ulang dari disk** pada setiap request API, melainkan dimuat tepat 1 kali saat server pertama kali diaktifkan melalui *Lifespan Context Manager* di `backend/app/main.py`:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from backend.app.config import MODEL_PATH, SCALER_PATH
from backend.app.services.predictor import WKNNPredictor

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Memuat Model WKNN & RobustScaler ke RAM saat server startup
    print(f"[STARTUP] Memuat model dari: {MODEL_PATH}")
    predictor = WKNNPredictor(MODEL_PATH, SCALER_PATH)
    predictor.warmup()  # Pemanasan kompilasi JIT Librosa & Scikit-Learn
    app.state.predictor = predictor
    print("[STARTUP] Model WKNN dan RobustScaler siap di memori RAM!")
    yield
    print("[SHUTDOWN] Menghentikan server...")

app = FastAPI(title="AcoustiKNN API", lifespan=lifespan)
```

### Keunggulan Pola Singleton:
- **Latensi Sangat Rendah:** Seluruh endpoint prediksi (`/api/predict-live` dan `/api/predict/file`) langsung memanggil `request.app.state.predictor` yang telah bersiap di memori RAM.
- **Pemanasan Inferensi (*Warmup*):** Fungsi `warmup()` melakukan inferensi simulasi awal pada *noise* sintetis saat startup sehingga tidak ada penundaan (*cold-start latency*) pada request pengguna pertama.

---

## 3. Logika Toleransi Bergerak (*Rolling Window Consistency*)

Sistem menerapkan model **Toleransi Bergerak (*Rolling Window*)** untuk memantau persistensi kebisingan secara dinamis dan berkelanjutan:

### A. Pilihan Durasi & Syarat Aktivasi Alarm
| Pilihan Durasi | Ukuran Jendela Geser | Syarat Durasi Bising Minimal | Toleransi |
|---|:---:|:---:|:---:|
| **Real-Time (Langsung)** | $1$ Detik | Minimal **1 detik** bising | $100\%$ |
| **4 Detik** | $4$ Detik | Minimal **3 detik** bising dalam 4 detik terakhir | $75\%$ |
| **5 Detik** | $5$ Detik | Minimal **4 detik** bising dalam 5 detik terakhir | $80\%$ |
| **10 Detik** | $10$ Detik | Minimal **8 detik** bising dalam 10 detik terakhir | $80\%$ |
| **15 Detik** | $15$ Detik | Minimal **12 detik** bising dalam 15 detik terakhir | $80\%$ |
| **20 Detik** | $20$ Detik | Minimal **16 detik** bising dalam 20 detik terakhir | $80\%$ |
| **30 Detik** | $30$ Detik | Minimal **24 detik** bising dalam 30 detik terakhir | $80\%$ |

### B. Mekanisme Jendela Geser
1. Setiap detik, hasil prediksi mikrofon ($0$ = kondusif, $1$ = berisik) dimasukkan ke buffer geser berkapasitas $W$ sampel.
2. Sampel data lama otomatis terdorong keluar saat detik baru masuk (*FIFO*).
3. Jika akumulasi detik bising dalam jendela geser memenuhi batas toleransi ($\ge 80\%$, atau $\ge 75\%$ untuk 4s), sistem memicu alarm peringatan.
4. Suara letupan singkat (misalnya piring jatuh atau batuk 1–2 detik) secara otomatis terabaikan karena durasinya tidak pernah menyentuh syarat toleransi.

---

## 4. Sintesis Audio Beep Panjang Kontinu

Sintesis audio peringatan dibangun menggunakan Web Audio API tanpa membutuhkan berkas audio eksternal (`frontend/src/utils/audioAlert.ts`):

- **Karakteristik Nada:** Gelombang sinus murni 880 Hz kontinu tanpa pulsa berselang (*non-pulsating continuous long beep*).
- **Durasi Bawaan (*Default*):** Tepat **3.0 detik**.
- **Kustomisasi Durasi:** Pengguna dapat memilih durasi beep: **`1s`**, **`2s`**, **`3s*` (default)**, **`4s`**, atau **`5s`**. Jeda *cooldown* sistem otomatis menyesuaikan dengan durasi yang dipilih.
- **Menu Penonaktifan (*Mute*):** Tombol togol status **Aktif / Nonaktif** untuk mematikan suara beep sewaktu-waktu tanpa mengganggu pemantauan visual.
- **Amplop Nada Halus (*Smooth Envelope*):** Dilengkapi *linear ramp attack* (0.05s) dan *release* (0.05s) untuk mencegah distorsi klik/letupan pada membran speaker.

---

## 5. Referensi Endpoint RESTful API

Dokumentasi interaktif OpenAPI / Swagger UI tersedia di: **`http://localhost:8080/docs`**.

### 1. `POST /api/predict-live`
Menerima buffer audio mikrofon (WAV 16-bit PCM mono 22.050 Hz) berdurasi 4 detik.
- **Input:** `file` (Multipart form-data WAV), `baseline_rms` (opsional float hasil kalibrasi ruangan).
- **Output:** JSON `PredictionResult` memuat label (`berisik` / `non-berisik`), probabilitas, keyakinan (%), dan nilai 16 parameter akustik PSD.

### 2. `POST /api/predict/file`
Menganalisis berkas rekaman audio utuh (.wav atau .mp3).
- **Input:** `file` (upload berkas) atau `sample_name` (nama berkas dari folder `samples/`).
- **Output:** JSON `FileAnalysisResult` memuat segmentasi blok-blok 4 detik, rasio kebisingan keseluruhan, dan tabel 16 fitur per segmen.

### 3. `GET /api/model-info`
Mengembalikan metadata model WKNN, metrik evaluasi uji, serta rumus matematis KaTeX 16 parameter akustik.

### 4. `GET /api/health`
Mengecek status ketersediaan server dan memastikan objek model dan scaler aktif di memori RAM.

---

## 6. Standar Desain & Antarmuka

1. **Tipografi Modern:** Menggunakan keluarga font **Poppins** yang bersih, elegan, dan profesional.
2. **Kanvas Latar Putih:** Seluruh visualisasi osiloskop gelombang dan spektrum frekuensi menggunakan **latar belakang putih murni** (`#FFFFFF`) dengan kontur garis teal/rose.
3. **Palet Warna Teal:**
   - Teal Primer: `#0D9488` (Teal-600), `#0F766E` (Teal-700), `#115E59` (Teal-800)
   - Latar Elemen Halus: `#E7F4F2`, `#CCFBF1`, `#F0FDFA`
   - Border Halus: `#CFECE6`, `#E2E8F0`
   - Aksen Bahaya/Berisik: `#E11D48` (Rose-600), `#FFF1F2`, `#FDA4AF`
4. **Nol Emoji:** 100% menggunakan ikon vektor SVG berbasis pustaka **Heroicons**.
5. **Rendering Rumus Native:** Mengintegrasikan pustaka **KaTeX** untuk merender seluruh notasi matematis secara offline.

---

## 7. Panduan Menjalankan Sistem

### A. Menjalankan via Docker & Docker Compose (Rekomendasi Produksi)
Proyek dilengkapi dengan `Dockerfile` *multi-stage* (Node.js 22 Alpine builder + Python 3.12 Slim runner) dan `docker-compose.yml`:

```bash
docker compose up --build
```
Aplikasi langsung dapat diakses di: **`http://localhost:8080`**.

### B. Menjalankan Langsung (Mode Produksi Lokal)
```bash
# 1. Bangun aset statis frontend
cd frontend
npm install
npm run build
cd ..

# 2. Jalankan server FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
```
Buka peramban di: **`http://localhost:8080`**.

### C. Menjalankan Mode Pengembangan (Frontend & Backend Terpisah)
```bash
# Terminal 1 — Backend FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — Frontend Vite Dev Server
cd frontend
npm run dev
```
Buka peramban di: **`http://localhost:5173`** (Vite otomatis meneruskan panggilan API ke port 8080).
