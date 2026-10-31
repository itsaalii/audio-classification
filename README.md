# AcoustiKNN Studio: Deteksi & Klasifikasi Real-Time Audio Berisik

Sistem cerdas deteksi dan klasifikasi kebisingan audio digital (**Berisik** vs **Non-Berisik**) berbasis web interaktif dan *real-time*. Dibangun menggunakan arsitektur modern **FastAPI** di sisi backend dan **React 19 + TypeScript + Vite + Tailwind CSS** di sisi frontend, sistem ini memanfaatkan **Web Audio API** dan **HTML5 Canvas 2D (60 FPS)** untuk visualisasi sinyal serta inferensi latensi rendah.

Model machine learning inti ditenagai oleh **Weighted K-Nearest Neighbors (WKNN)** dengan **Segmentasi Jendela 4.0 Detik ($88.200$ sampel @ $22.050\text{ Hz}$)** dan penskalaan **RobustScaler** pada 16 parameter akustik Pengolahan Sinyal Digital (PSD), menghasilkan **Akurasi Uji 97.64%** dan **5-Fold Cross Validation 97.58%**.

---

## Daftar Isi
1. [Ringkasan Spesifikasi Model](#ringkasan-spesifikasi-model)
2. [Arsitektur Sistem & Alur Inferensi](#arsitektur-sistem--alur-inferensi)
3. [Teknologi Pemuatan Model (In-Memory Singleton)](#teknologi-pemuatan-model-in-memory-singleton)
4. [Daftar 16 Fitur Pengolahan Sinyal Digital (PSD) & Formula Matematis](#daftar-16-fitur-pengolahan-sinyal-digital-psd--formula-matematis)
5. [Logika Siklus Deteksi & Alarm Otomatis 3 Detik](#logika-siklus-deteksi--alarm-otomatis-3-detik)
6. [Fitur & 4 Modul Antarmuka](#fitur--4-modul-antarmuka)
7. [Desain, Tipografi & Standar Tampilan](#desain-tipografi--standar-tampilan)
8. [Struktur Direktori Proyek](#struktur-direktori-proyek)
9. [Dokumentasi Endpoint REST API](#dokumentasi-endpoint-rest-api)
10. [Panduan Menjalankan Aplikasi](#panduan-menjalankan-aplikasi)
    - [A. Menjalankan Langsung (Mode Produksi Lokal)](#a-menjalankan-langsung-mode-produksi-lokal)
    - [B. Menjalankan Mode Pengembangan (Frontend & Backend Terpisah)](#b-menjalankan-mode-pengembangan-frontend--backend-terpisah)
    - [C. Menjalankan via Docker & Docker Compose](#c-menjalankan-via-docker--docker-compose)
11. [Hasil Evaluasi & Matriks Kebingungan](#hasil-evaluasi--matriks-kebingungan)

---

## Ringkasan Spesifikasi Model

| Parameter | Konfigurasi | Keterangan Teknis |
|---|---|---|
| **Algoritma Klasifikasi** | Weighted K-Nearest Neighbors (WKNN) | Berkas biner: `model_k_nearest_neighbors_knn.pkl` |
| **Jumlah Tetangga ($K$)** | 4 Neighbors ($K=4$) | Mencegah kebuntuan (*voting tie*) pada klasifikasi biner |
| **Metrik Jarak** | Euclidean ($p=2$) | $d(x, y) = \sqrt{\sum_{i=1}^{16} (x_i - y_i)^2}$ |
| **Skema Pembobotan** | Inverse Distance Weighting | $w_i = \frac{1}{d_i}$ (tetangga lebih dekat berbobot eksponensial lebih kuat) |
| **Penskalaan Fitur** | `RobustScaler` (Scikit-Learn) | Berkas biner: `scaler_audio.pkl` (tahan terhadap pencilan/outlier) |
| **Panjang Jendela Input** | 4.0 Detik ($88.200$ sampel @ $22.050\text{ Hz}$) | Resolusi ideal menangkap karakteristik kebisingan stasioner |
| **Format Sampling Audio** | 16-bit PCM, Mono, $22.050\text{ Hz}$ | Standar seragam mikrofon real-time & berkas upload |
| **Akurasi Data Uji (Test)** | **97.64%** ($N = 1.058$) | Hanya 7 false alarm dari 547 sampel non-berisik |
| **5-Fold Cross Validation** | **97.58% ($\pm 0.58\%$)** | Stabilitas tinggi (fold tertinggi 98.20%) |
| **Presisi Kelas Berisik** | **98.60%** | Sangat rendah memicu alarm palsu |
| **Sensitivitas / Recall** | **98.72%** (Non-Berisik) / **96.48%** (Berisik) | Deteksi akurat kondisi tenang dan bising |

---

## Arsitektur Sistem & Alur Inferensi

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KLIEN (BROWSER REACT 19)                       │
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
│  1. Ingestion Buffer Audio (io.BytesIO -> Librosa / Soundfile)         │
│  2. Ekstraksi 16 Parameter Akustik PSD (Domain Waktu, Frekuensi & Mel) │
│  3. Transformasi Fitur menggunakan RobustScaler (scaler_audio.pkl)     │
│  4. Inferensi Model WKNN K=4 (model_k_nearest_neighbors_knn.pkl)      │
│  5. Perhitungan Probabilitas, Confidence Score & Diagnostik Parameter │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │ JSON Response (Prediksi, Probabilitas, 16 Fitur)
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TAMPILAN & AKSI RESPON                          │
├────────────────────────────────────────────────────────────────────────┤
│  • Visualizer Osiloskop & Spektrogram 60 FPS (Canvas Latar Putih)     │
│  • Evaluasi Siklus Waktu (Realtime, 4s, 5s, 10s, 15s, 20s, 30s)        │
│  • Alarm Otomatis Berbunyi 3 Detik jika Siklus = "Berisik"             │
│  • Kamus & Diagnostik Rumus Matematika (KaTeX LaTeX Render)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Teknologi Pemuatan Model (In-Memory Singleton)

Untuk menghasilkan latensi inferensi ultra-rendah (~8–15 milidetik per request), aplikasi tidak memuat ulang model dari disk setiap kali ada request masuk. Model dan scaler dimuat tepat 1 kali saat server FastAPI pertama kali dijalankan:

1. **Resolusi Lokasi Berkas**: Terletak pada `backend/app/config.py`, fungsi `find_file` mendeteksi file `model_k_nearest_neighbors_knn.pkl` dan `scaler_audio.pkl` baik pada folder root maupun direktori `data/`.
2. **Deserialisasi**: Di dalam kelas `WKNNPredictor` (`backend/app/services/predictor.py`), model dan scaler dibaca menggunakan `joblib.load()`:
   ```python
   self.model = joblib.load(self.model_path)
   self.scaler = joblib.load(self.scaler_path)
   ```
3. **Pemanasan Inferensi (*Warmup*)**: Metode `warmup()` menjalankan inferensi simulasi pada *array* sintetis saat startup untuk mengompilasi JIT cache (Numba & Librosa).
4. **FastAPI Lifespan Context**: Di `backend/app/main.py`, objek diikat ke `app.state.predictor` sehingga siap diakses secara konkruen oleh seluruh router API.

---

## Daftar 16 Fitur Pengolahan Sinyal Digital (PSD) & Formula Matematis

Seluruh formula matematika berikut dirender secara akurat menggunakan pustaka **KaTeX**:

### 1. Root Mean Square (`rms`) — Domain Waktu
Mengukur intensitas daya dan energi total sinyal audio:
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^{N} |x[n]|^2}$$

### 2. Spectral Centroid (`spectral_centroid`) — Domain Frekuensi
Menunjukkan "pusat massa" spektrum frekuensi audio. Sinyal berisik (seperti gesekan atau benturan) memiliki nilai centroid tinggi:
$$f_c = \frac{\sum_{k=0}^{K-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{K-1} |X[k]|}$$

### 3. Zero Crossing Rate (`zcr`) — Domain Waktu
Frekuensi pergantian tanda sinyal melintasi sumbu nol. Noise berfrekuensi tinggi menghasilkan nilai ZCR yang rapat:
$$\text{ZCR} = \frac{1}{2N} \sum_{n=1}^{N} |\text{sgn}(x[n]) - \text{sgn}(x[n-1])|$$

### 4. Koefisien MFCC 1 (`mfcc_1`) — Skala Mel
Mewakili magnitudo energi spektral keseluruhan pada skala persepsi auditori manusia:
$$C_1 = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot 1 \cdot (m - 0.5)}{M} \right)$$

### 5–16. Koefisien MFCC 2 hingga 13 (`mfcc_2` s/d `mfcc_13`) — Skala Mel
Menangkap detail amplop spektral halus, resonansi, dan warna suara (*timbre*):
$$C_k = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot k \cdot (m - 0.5)}{M} \right), \quad k \in [2, \dots, 13]$$

---

## Logika Siklus Deteksi & Alarm Otomatis 3 Detik

Aplikasi menyediakan evaluasi kebisingan berbasis siklus waktu terintegrasi:

1. **Pilihan Siklus Deteksi**:
   - `Real-Time (Langsung)`: Evaluasi instan per jendela luncur.
   - `4 Detik`, `5 Detik`, `10 Detik`, `15 Detik`, `20 Detik`, `30 Detik`.
2. **Mekanisme Akumulasi & Keputusan**:
   - Selama durasi siklus berjalan, segmen audio 4.0 detik terus dianalisis setiap detik.
   - Di akhir periode siklus, sistem menghitung rasio segmen bising:
     $$\text{Noise Ratio} = \frac{\text{Jumlah Segmen Berisik}}{\text{Total Segmen dalam Siklus}}$$
   - Jika rasio $\ge 50\%$, status siklus ditetapkan sebagai **BERISIK**. Jika $< 50\%$, status siklus adalah **KONDUSIF (NON-BERISIK)**.
3. **Alarm Otomatis 3 Detik**:
   - Jika kesimpulan siklus adalah **BERISIK**, sintesis alarm audio Web Audio API otomatis berbunyi selama **tepat 3.0 detik**, kemudian mati dengan sendirinya tanpa memerlukan intervensi tombol manual.
   - Siklus baru langsung dimulai kembali secara berkesinambungan.

---

## Fitur & 4 Modul Antarmuka

### Modul 1: Monitoring Real-Time (Live Studio Room)
- **Status Akustik Utama**: Indikator hero adaptif (`STANDBY`, `KONDUSIF (NON-BERISIK)`, atau `PERINGATAN: BERISIK`).
- **Multi-segment LED Meter**: 28 baris lampu LED proporsional dengan pewarnaan dinamis.
- **Visualizer Audio Ganda (60 FPS)**:
  - Osiloskop gelombang suara berbasis HTML5 Canvas dengan **latar belakang putih bersih** (`#FFFFFF`) dan kontur garis teal/rose.
  - Spektrum frekuensi 32 pita (*equalizer bars*) respon cepat.
- **Linimasa Riwayat 30 Detik**: Grafik tren persentase kebisingan dengan garis batas ambang 70%.
- **Diagnostik 16 Parameter**: Menampilkan nilai numerik RMS, Centroid, ZCR, serta grafik batang profil 13 koefisien MFCC yang stabil (tidak *collapse*).

### Modul 2: Analisis Berkas Audio (Audio Inspector)
- Mengunggah berkas suara pribadi (`.mp3` atau `.wav`) atau memilih dari pustaka audio sampel.
- Pemutar audio bawaan dengan garis kursor *playback* sinkron di atas kanvas gelombang latar putih.
- Segmentasi otomatis 4.0 detik dengan kartu visual berurutan (Teal untuk kondusif, Rose untuk berisik).
- Mengklik segmen manapun akan langsung memindahkan posisi putar audio ke waktu tersebut.
- Tabel 16 fitur akustik lengkap dengan fitur pencarian dan tombol **Ekspor CSV**.

### Modul 3: Riwayat Sesi (Audit Log & Export)
- Mencatat seluruh riwayat pemantauan mikrofon dan analisis berkas ke penyimpanan peramban (*LocalStorage*).
- Indikator ringkasan KPI: Total sesi, akumulasi durasi, dan rata-rata rasio kebisingan.
- Filter riwayat berdasarkan tipe sesi (*Live Monitor* atau *Berkas Audio*).
- Tombol **Ekspor Semua ke CSV** dan **Hapus Log**.

### Modul 4: Arsitektur & 16 Fitur PSD (Model Intelligence)
- Penjelasan lengkap arsitektur model Weighted KNN ($K=4$, pembobotan invers jarak, metrik Euclidean).
- Representasi visual Matriks Kebingungan (*Confusion Matrix*) dengan statistik performa uji.
- Kamus interaktif 16 parameter akustik dengan formula matematis yang dirender rapi menggunakan KaTeX.

---

## Desain, Tipografi & Standar Tampilan

1. **Tipografi Modern**: Seluruh antarmuka menggunakan keluarga font **Poppins** yang bersih, elegan, dan terbaca jelas.
2. **Kanvas Latar Putih**: Semua kanvas visualisasi gelombang dan spektrum menggunakan latar belakang putih (`#FFFFFF`) untuk kenyamanan visual maksimal.
3. **Palet Warna Teal**:
   - Teal Primer: `#0D9488` (Teal-600), `#0F766E` (Teal-700), `#115E59` (Teal-800)
   - Latar Elemen Halus: `#E7F4F2`, `#CCFBF1`, `#F0FDFA`
   - Border Halus: `#CFECE6`, `#E2E8F0`
   - Aksen Bahaya/Berisik: `#E11D48` (Rose-600), `#FFF1F2`, `#FDA4AF`
4. **Nol Emoji**: 100% menggunakan ikon vektor SVG berbasis pustaka **Heroicons** tanpa penggunaan karakter emoji.
5. **Dropdown Ramah Pengguna**: Menu dropdown pilihan waktu siklus dilengkapi *scrolling* vertikal (`max-h-60 overflow-y-auto`) yang mulus.

---

## Struktur Direktori Proyek

```text
audio-docker/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Aplikasi FastAPI, in-memory lifespan, static mount
│   │   ├── config.py                # Konfigurasi parameter audio 4s & path model
│   │   ├── schemas.py               # Skema Pydantic respon API & validasi
│   │   ├── api/
│   │   │   ├── predict.py           # Endpoint POST /api/predict/live & POST /api/predict/file
│   │   │   ├── model_info.py        # Endpoint GET /api/model-info (metadata & rumus KaTeX)
│   │   │   └── health.py            # Endpoint GET /api/health (status model di RAM)
│   │   └── services/
│   │       ├── predictor.py         # WKNNPredictor (joblib load saat startup + warmup)
│   │       └── features.py          # Ekstraksi 16 fitur akustik PSD (Librosa & NumPy)
│   └── requirements.txt             # Dependensi Python backend
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx           # Header aplikasi & navigasi 4 tab
│   │   │   ├── HeroIcon.tsx         # Komponen ikon murni SVG Heroicons (tanpa emoji)
│   │   │   ├── Latex.tsx            # Komponen render KaTeX matematika native
│   │   │   ├── LiveMonitor.tsx      # Monitoring mikrofon real-time, canvas putih & alarm 3s
│   │   │   ├── FileAnalyzer.tsx     # Analisis berkas audio, segmentasi 4s & waveform putih
│   │   │   ├── HistoryLog.tsx       # Riwayat audit log & ekspor data CSV
│   │   │   └── ModelIntelligence.tsx# Spesifikasi WKNN & kamus rumus KaTeX 16 fitur PSD
│   │   ├── services/
│   │   │   └── api.ts               # Klien Axios pemanggil backend API
│   │   ├── utils/
│   │   │   ├── wavEncoder.ts        # Konverter Float32Array ke 16-bit PCM WAV mono 22.050 Hz
│   │   │   └── audioAlert.ts        # Sintesis alarm Web Audio API (durasi 3 detik)
│   │   ├── App.tsx                  # Root aplikasi React
│   │   ├── index.css                # Konfigurasi Tailwind & font Poppins
│   │   └── main.tsx                 # Entrypoint Vite & impor KaTeX stylesheet
│   ├── tailwind.config.js           # Konfigurasi tema warna Teal & font Poppins
│   ├── vite.config.ts               # Konfigurasi bundler Vite & proxy port 8080
│   └── package.json                 # Dependensi frontend (React 19, KaTeX, Tailwind, Lucide)
├── samples/                         # Berkas audio sampel bawaan (.wav / .mp3)
├── model_k_nearest_neighbors_knn.pkl# Model biner WKNN terlatih (K=4, weights=distance)
├── scaler_audio.pkl                 # Scaler biner RobustScaler terlatih
├── audio_features_4s.csv            # Dataset 16 fitur akustik (5.286 segmen)
├── Dockerfile                       # Multi-stage Docker build (Node 22 + Python 3.12)
├── docker-compose.yml               # File orkestrasi Docker
├── prompt.md                        # Spesifikasi persyaratan evaluasi proyek
└── README.md                        # Dokumentasi lengkap proyek
```

---

## Dokumentasi Endpoint REST API

Dokumentasi interaktif Swagger UI tersedia di rute: **`http://localhost:8080/docs`**.

### 1. `POST /api/predict/live`
Mengklasifikasikan rekaman buffer mikrofon (blob WAV atau Float32Array).
- **Body**: `file` (Multipart form-data berkas WAV 16-bit mono 4 detik)
- **Respon**:
  ```json
  {
    "status": "success",
    "prediction": "berisik",
    "is_noisy": true,
    "confidence": 98.45,
    "probabilities": {
      "non_berisik": 1.55,
      "berisik": 98.45
    },
    "features": {
      "rms": 0.0842,
      "spectral_centroid": 2845.12,
      "zcr": 0.0712,
      "mfcc_1": -142.3,
      "mfcc_2": 89.4
    },
    "inference_time_ms": 11.2
  }
  ```

### 2. `POST /api/predict/file`
Menganalisis berkas audio secara menyeluruh dengan membaginya ke dalam segmen 4.0 detik.
- **Body**: `file` (Multipart form-data berkas audio WAV / MP3) atau `sample_name` (nama berkas dari folder `samples/`).
- **Respon**: Prediksi keseluruhan, ringkasan durasi, rasio kebisingan, dan daftar array segmen (`SegmentResult`).

### 3. `GET /api/model-info`
Mengambil spesifikasi model WKNN, metrik evaluasi, serta formula LaTeX 16 parameter akustik.

### 4. `GET /api/health`
Mengecek status kesehatan server dan memastikan model serta scaler telah aktif di memori RAM.

---

## Panduan Menjalankan Aplikasi

### A. Menjalankan Langsung (Mode Produksi Lokal)

Mode ini menyajikan antarmuka React secara langsung dari backend FastAPI melalui *static build*.

```bash
# 1. Masuk ke direktori frontend dan bangun berkas distribusi
cd frontend
npm install
npm run build
cd ..

# 2. Jalankan server FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
```

Buka peramban di: **`http://localhost:8080`**.

---

### B. Menjalankan Mode Pengembangan (Frontend & Backend Terpisah)

Gunakan mode ini saat ingin mengembangkan kode antarmuka dengan fitur *Hot Module Replacement (HMR)*:

```bash
# Terminal 1 — Backend FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — Frontend Vite Dev Server
cd frontend
npm run dev
```

Buka peramban di: **`http://localhost:5173`** (Vite otomatis meneruskan panggilan API ke port 8080).

---

### C. Menjalankan via Docker & Docker Compose

Aplikasi dikemas menggunakan `Dockerfile` multi-stage:
- **Tahap 1**: Node.js 22 Alpine untuk mengompilasi aplikasi React menjadi aset statis.
- **Tahap 2**: Python 3.12 Slim yang dilengkapi dependensi sistem audio (`libsndfile1`, `libasound2`, `ffmpeg`) untuk menjalankan server produksi.

Jalankan satu perintah berikut:

```bash
docker compose up --build
```

Setelah proses selesai, aplikasi langsung dapat diakses di: **`http://localhost:8080`**.

---

## Hasil Evaluasi & Matriks Kebingungan

Evaluasi model pada data uji independen ($N = 1.058$ segmen):

| Aktual \ Prediksi | Non-Berisik | Berisik | Total | Recall Kelas |
|---|:---:|:---:|:---:|:---:|
| **Non-Berisik** | **540** (True Clean) | **7** (False Alarm) | 547 | **98.72%** |
| **Berisik** | **18** (False Clean) | **493** (True Noisy) | 511 | **96.48%** |
| **Total** | 558 | 500 | 1.058 | **Akurasi: 97.64%** |

- **Presisi Berisik**: $\frac{493}{493 + 7} = \mathbf{98.60\%}$
- **Presisi Non-Berisik**: $\frac{540}{540 + 18} = \mathbf{96.77\%}$
- **F1-Score Berisik**: $\mathbf{97.53\%}$
- **F1-Score Non-Berisik**: $\mathbf{97.74\%}$

---

## Lisensi & Atribusi
Proyek dikembangkan untuk keperluan akademik mata kuliah **Proyek Sains Data**. Menggunakan model Weighted K-Nearest Neighbors (WKNN 4s) berbasis ekstraksi fitur audio Pengolahan Sinyal Digital.
#   a u d i o - c l a s s i f i c a t i o n  
 