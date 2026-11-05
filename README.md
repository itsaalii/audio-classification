# AcoustiKNN Studio: Deteksi & Klasifikasi Real-Time Audio Berisik (Dual-Role Architecture)

Sistem cerdas deteksi dan klasifikasi kebisingan audio digital (**Berisik** vs **Non-Berisik**) berbasis web interaktif dan *real-time* dengan arsitektur **Dual-Role Interface**:
1. **PC Lab Display / Kiosk (`/` atau `/lab`)**: Sensor penangkap mikrofon ruangan laboratorium sekaligus layar informasi *read-only* dengan inisialisasi *one-click kiosk gesture*.
2. **Admin Remote Control Center (`/admin`)**: Pusat kendali jarak jauh terproteksi PIN (default: `1234`) untuk memulai/menghentikan pemantauan, mengubah durasi toleransi *rolling window*, membunyikan alarm uji coba, dan memantau telemetri akustik 60 FPS secara tersinkronisasi.

Dibangun menggunakan arsitektur modern **FastAPI (In-Memory Singleton + WebSocket Hub)** di sisi backend dan **React 19 + TypeScript + Vite + Tailwind CSS** di sisi frontend, sistem ini memanfaatkan **Web Audio API** dan **HTML5 Canvas 2D (60 FPS)** untuk visualisasi sinyal berlatar belakang putih bersih (`#FFFFFF`) serta inferensi latensi rendah.

Model machine learning inti ditenagai oleh **Weighted K-Nearest Neighbors (WKNN)** dengan **Segmentasi Jendela 4.0 Detik ($88.200$ sampel @ $22.050\text{ Hz}$)** dan penskalaan **RobustScaler** pada 16 parameter akustik Pengolahan Sinyal Digital (PSD), menghasilkan **Akurasi Uji 97.64%** dan **5-Fold Cross Validation 97.58%**.

---

## Daftar Isi
1. [Arsitektur Dual-Role & Sinkronisasi Real-Time](#arsitektur-dual-role--sinkronisasi-real-time)
2. [Akses Antarmuka & Hak Akses Peran](#akses-antarmuka--hak-akses-peran)
3. [Ringkasan Spesifikasi Model](#ringkasan-spesifikasi-model)
4. [Arsitektur Sistem & Alur Inferensi](#arsitektur-sistem--alur-inferensi)
5. [Teknologi Pemuatan Model & Room State Manager](#teknologi-pemuatan-model--room-state-manager)
6. [Daftar 16 Fitur Pengolahan Sinyal Digital (PSD) & Formula Matematis](#daftar-16-fitur-pengolahan-sinyal-digital-psd--formula-matematis)
7. [Logika Kebisingan Konsisten & Toleransi Bergerak (Rolling Window)](#logika-kebisingan-konsisten--toleransi-bergerak-rolling-window)
8. [Fitur & 4 Modul Antarmuka](#fitur--4-modul-antarmuka)
9. [Desain, Tipografi & Standar Tampilan](#desain-tipografi--standar-tampilan)
10. [Struktur Direktori Proyek](#struktur-direktori-proyek)
11. [Dokumentasi Endpoint REST API & WebSocket](#dokumentasi-endpoint-rest-api--websocket)
12. [Panduan Menjalankan Aplikasi](#panduan-menjalankan-aplikasi)
    - [A. Menjalankan Langsung (Mode Produksi Lokal)](#a-menjalankan-langsung-mode-produksi-lokal)
    - [B. Menjalankan Mode Pengembangan (Frontend & Backend Terpisah)](#b-menjalankan-mode-pengembangan-frontend--backend-terpisah)
    - [C. Menjalankan via Docker & Docker Compose](#c-menjalankan-via-docker--docker-compose)
13. [Hasil Evaluasi & Matriks Kebingungan](#hasil-evaluasi--matriks-kebingungan)

---

## Arsitektur Dual-Role & Sinkronisasi Real-Time

Aplikasi AcoustiKNN Studio memisahkan peran perangkat penangkap audio di dalam laboratorium dengan perangkat pengawas/pengendali jarak jauh:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Interface PC Lab Display                          │
 │                    URL: http://localhost:8080/                         │
 │                                                                        │
 │  • One-Click Kiosk Activation (Inisialisasi Mic & AudioContext)        │
 │  • Penangkapan Audio Mikrofon 22.050 Hz (Buffer 4 Detik)               │
 │  • Pemutaran Alarm 3 Detik di Speaker PC Lab (audioAlert.ts)           │
 │  • Tampilan Read-Only (Start/Stop & Kustomisasi Terkunci)              │
 │  • Visualisasi 60 FPS (LED Meter, Osiloskop, Spektrogram, 16 PSD)      │
 └───────────────────────────────▲────────────────────────────────────────┘
                                 │
                   WebSocket /api/ws/room?role=lab
                   (Perintah START/STOP, UPDATE_CONFIG, TELEMETRY_UPDATE)
                                 │
                                 ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    Backend FastAPI (Port 8080)                         │
 │                                                                        │
 │  • RoomStateManager (In-Memory Singleton pada app.state.room)          │
 │  • WKNN Model & RobustScaler (In-Memory Singleton pada RAM)            │
 │  • Endpoint WebSocket Hub: /api/ws/room?role={lab|admin}               │
 │  • Endpoint REST Komando: POST /api/remote/command                     │
 │  • Endpoint Snapshot Status: GET /api/remote/state                     │
 └───────────────────────────────▲────────────────────────────────────────┘
                                 │
                  WebSocket /api/ws/room?role=admin
                  (STATE_SYNC, TELEMETRY_UPDATE, ADMIN_COMMAND)
                                 │
                                 ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 Interface Admin Remote Control Center                  │
 │                  URL: http://localhost:8080/admin                      │
 │                                                                        │
 │  • Verifikasi PIN Masuk (Default: 1234, Session Storage)               │
 │  • Indikator Status Koneksi & Kesiapan PC Lab Real-Time                │
 │  • Tombol Jarak Jauh: Mulai / Hentikan Deteksi Suara Lab               │
 │  • Pengaturan Toleransi Rolling Window (1s, 4s, 5s, 10s, 15s, 20s, 30s)│
 │  • Sakelar Alarm Bunyi PC Lab, Reset Akumulasi & Uji Alarm (3s)        │
 │  • Telemetri Sinkron 60 FPS & Akses Penuh ke 4 Modul Studio            │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## Akses Antarmuka & Hak Akses Peran

| Peran | Rute URL | Proteksi Akses | Tanggung Jawab Utama | Kontrol Interaktif |
|---|---|---|---|---|
| **PC Lab Display** | `http://localhost:8080/` atau `/lab` | Terbuka (Mode Kiosk) | Menangkap audio mikrofon, menjalankan loop inferensi, membunyikan alarm 3s, menampilkan data *read-only*. | Hanya 1 tombol aktivasi sensor audio saat booting. Start/Stop & parameter terkunci. |
| **Admin Control** | `http://localhost:8080/admin` | PIN Otorisasi (Default: `1234`) | Mengendalikan sistem dari jarak jauh, mengubah parameter toleransi, reset buffer, akses modul audit & file inspector. | Akses penuh: Start/Stop, Pilihan Toleransi, Sakelar Alarm, Uji Alarm, 4 Tab Navigasi. |

---

## Ringkasan Spesifikasi Model

| Parameter | Konfigurasi | Keterangan Teknis |
|---|---|---|
| **Algoritma Klasifikasi** | Weighted K-Nearest Neighbors (WKNN) | Berkas biner: `model_k_nearest_neighbors_knn.pkl` |
| **Jumlah Tetangga ($K$)** | 4 Neighbors ($K=4$) | Mencegah kebuntuan (*voting tie*) pada klasifikasi biner |
| **Metrik Jarak** | Euclidean ($p=2$) | $d(x, y) = \sqrt{\sum_{i=1}^{16} (x_i - y_i)^2}$ |
| **Skema Pembobotan** | Inverse Distance Weighting | $w_i = \frac{1}{d_i}$ (tetangga lebih dekat berbobot lebih kuat) |
| **Penskalaan Fitur** | `RobustScaler` (Scikit-Learn) | Berkas biner: `scaler_audio.pkl` (tahan terhadap outlier) |
| **Panjang Jendela Input** | 4.0 Detik ($88.200$ sampel @ $22.050\text{ Hz}$) | Resolusi optimal menangkap spektrum stabil |
| **Format Sampling Audio** | 16-bit PCM, Mono, $22.050\text{ Hz}$ | Standar seragam mikrofon real-time & berkas upload |
| **Akurasi Data Uji (Test)** | **97.64%** ($N = 1.058$) | Hanya 7 false alarm dari 547 sampel non-berisik |
| **5-Fold Cross Validation** | **97.58% ($\pm 0.58\%$)** | Stabilitas tinggi (fold tertinggi 98.20%) |
| **Presisi Kelas Berisik** | **98.60%** | Sangat rendah memicu alarm palsu |
| **Sensitivitas / Recall** | **98.72%** (Non-Berisik) / **96.48%** (Berisik) | Deteksi akurat kondisi tenang dan bising |

---

## Arsitektur Sistem & Alur Inferensi

```text
[PC Lab Browser]
  ├── One-Click Activation: Inisialisasi AudioContext & Mikrofon Standby
  └── Loop 1000ms: Circular Buffer 4s -> Encode WAV 16-bit PCM Mono 22.050 Hz
           │
           │ HTTP POST /api/predict-live (WAV Blob)
           ▼
[FastAPI Backend]
  ├── 1. Ingestion Buffer Audio (Soundfile / Librosa)
  ├── 2. Ekstraksi 16 Parameter Akustik PSD (RMS, Centroid, ZCR, MFCC 1-13)
  ├── 3. Transformasi RobustScaler (scaler_audio.pkl)
  └── 4. Inferensi Model WKNN K=4 (model_k_nearest_neighbors_knn.pkl)
           │
           │ JSON Result (Prediksi, Probabilitas, 16 Fitur Akustik)
           ▼
[PC Lab Evaluator]
  ├── Evaluasi Rolling Window (Batas Toleransi: mis. 80% dari durasi)
  ├── Pemicuan Alarm 3s di Speaker Lab jika konsistensi terpenuhi
  └── WS TELEMETRY_UPDATE -> RoomStateManager -> Broadcast ke Admin
           │
           ▼
[Admin Remote Control]
  ├── Rekonstruksi Visualisasi 60 FPS Mulus (LED Meter, Osiloskop, Spektrum)
  └── Kontrol Interaktif Jarak Jauh (Start/Stop, Ubah Toleransi, Sakelar Alarm)
```

---

## Teknologi Pemuatan Model & Room State Manager

1. **WKNN In-Memory Singleton**: Di dalam kelas `WKNNPredictor` (`backend/app/services/predictor.py`), model dan scaler dimuat sekali saat startup menggunakan `joblib.load()`.
2. **FastAPI Lifespan Context**: Diikat ke `app.state.predictor` sehingga inferensi hanya memakan waktu 8–15 ms per request.
3. **RoomStateManager Singleton (`backend/app/services/room_manager.py`)**: Diikat ke `app.state.room` untuk mengelola:
   - Status pemantauan ruangan aktif/standby (`is_monitoring`).
   - Waktu toleransi kebisingan aktif (`tolerance_seconds`).
   - Status sakelar alarm audio (`alarm_enabled`).
   - Kesiapan koneksi dan sensor PC Lab (`lab_client_connected`, `lab_mic_ready`).
   - Snapshot telemetri sub-detik terakhir (`latest_telemetry`).
   - Kumpulan koneksi aktif WebSocket PC Lab (`lab_connections`) dan Admin (`admin_connections`).

---

## Daftar 16 Fitur Pengolahan Sinyal Digital (PSD) & Formula Matematis

Seluruh formula matematika berikut dirender secara native menggunakan pustaka **KaTeX**:

### 1. Root Mean Square (`rms`) — Domain Waktu
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^{N} |x[n]|^2}$$

### 2. Spectral Centroid (`spectral_centroid`) — Domain Frekuensi
$$f_c = \frac{\sum_{k=0}^{K-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{K-1} |X[k]|}$$

### 3. Zero Crossing Rate (`zcr`) — Domain Waktu
$$\text{ZCR} = \frac{1}{2N} \sum_{n=1}^{N} |\text{sgn}(x[n]) - \text{sgn}(x[n-1])|$$

### 4. Koefisien MFCC 1 (`mfcc_1`) — Skala Mel
$$C_1 = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot 1 \cdot (m - 0.5)}{M} \right)$$

### 5–16. Koefisien MFCC 2 hingga 13 (`mfcc_2` s/d `mfcc_13`) — Skala Mel
$$C_k = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot k \cdot (m - 0.5)}{M} \right), \quad k \in [2, \dots, 13]$$

---

## Logika Kebisingan Konsisten & Toleransi Bergerak (Rolling Window)

Sistem menggunakan model **Toleransi Bergerak (*Rolling Window*)** untuk memantau persistensi kebisingan secara dinamis dan berkelanjutan:

1. **Pilihan Waktu Toleransi Konsisten**:
   - `Real-Time (Langsung)`: Alarm aktif langsung pada deteksi bising pertama (1 detik).
   - `4 Detik`: Alarm aktif jika bising konsisten minimal 3 dari 4 detik terakhir (75%).
   - `5 Detik`: Alarm aktif jika bising konsisten minimal 4 dari 5 detik terakhir (80%).
   - `10 Detik`: Alarm aktif jika bising konsisten minimal 8 dari 10 detik terakhir (80%).
   - `15 Detik`: Alarm aktif jika bising konsisten minimal 12 dari 15 detik terakhir (80%).
   - `20 Detik`: Alarm aktif jika bising konsisten minimal 16 dari 20 detik terakhir (80%).
   - `30 Detik`: Alarm aktif jika bising konsisten minimal 24 dari 30 detik terakhir (80%).

2. **Mekanisme Jendela Geser (*Rolling Buffer*)**:
   - Hasil prediksi tiap detik disimpan ke dalam buffer riwayat dinamis berukuran $W$ detik.
   - Detik-detik lama otomatis keluar saat detik baru masuk.
   - Jika akumulasi detik bising dalam jendela geser memenuhi batas toleransi ($\ge 80\%$, atau $\ge 75\%$ untuk 4s), sistem menyimpulkan bahwa kebisingan telah terjadi secara konsisten.

3. **Mekanisme Alarm & Cooldown**:
   - Saat syarat kebisingan konsisten terpenuhi, alarm audio Web Audio API otomatis berbunyi selama **tepat 3 detik**.
   - Diberikan jeda cooldown selama 3 detik sesuai durasi alarm untuk mencegah alarm berulang tanpa henti saat kebisingan masih berlangsung.
   - Buffer jendela geser di-reset sehingga observasi periode konsisten baru dimulai dari kondisi segar.

---

## Fitur & 4 Modul Antarmuka

### Modul 1: Monitoring Real-Time (Live Studio Room)
- **Status Akustik Utama**: Indikator hero adaptif (`STANDBY`, `KONDUSIF (NON-BERISIK)`, atau `PERINGATAN: BERISIK`).
- **Multi-segment LED Meter**: 28 baris lampu LED proporsional dengan pewarnaan dinamis.
- **Visualizer Audio Ganda (60 FPS)**:
  - Osiloskop gelombang suara berbasis HTML5 Canvas dengan **latar belakang putih bersih** (`#FFFFFF`) dan kontur garis teal/rose.
  - Spektrum frekuensi 32 pita (*equalizer bars*) respon cepat.
- **Bilah Akumulasi Bising**: Menampilkan progres akumulasi waktu bising terhadap target toleransi secara dinamis (`24s / 30s`).
- **Linimasa Riwayat 30 Detik**: Grafik tren persentase kebisingan dengan garis batas ambang 70%.
- **Diagnostik 16 Parameter**: Menampilkan nilai numerik RMS, Centroid, ZCR, serta grafik batang profil 13 koefisien MFCC yang stabil.

### Modul 2: Analisis Berkas Audio (Audio Inspector - Khusus Admin)
- Mengunggah berkas suara pribadi (`.mp3` atau `.wav`) atau memilih dari pustaka audio sampel.
- Pemutar audio bawaan dengan garis kursor *playback* sinkron di atas kanvas gelombang latar putih.
- Segmentasi otomatis 4.0 detik dengan kartu visual berurutan (Teal untuk kondusif, Rose untuk berisik).
- Mengklik segmen manapun akan langsung memindahkan posisi putar audio ke waktu tersebut.
- Tabel 16 fitur akustik lengkap dengan fitur pencarian dan tombol **Ekspor CSV**.

### Modul 3: Riwayat Sesi (Audit Log & Export - Khusus Admin)
- Mencatat seluruh riwayat pemantauan mikrofon, event peringatan bising konsisten, dan analisis berkas ke penyimpanan peramban (*LocalStorage*).
- Indikator ringkasan KPI: Total sesi, akumulasi durasi, dan rata-rata rasio kebisingan.
- Filter riwayat berdasarkan tipe sesi (*Live Monitor* atau *Berkas Audio*).
- Tombol **Ekspor Semua ke CSV** dan **Hapus Log**.

### Modul 4: Arsitektur & 16 Fitur PSD (Model Intelligence - Khusus Admin)
- Penjelasan lengkap arsitektur model Weighted KNN ($K=4$, pembobotan invers jarak, metrik Euclidean).
- Representasi visual Matriks Kebingungan (*Confusion Matrix*) dengan statistik performa uji.
- Kamus interaktif 16 parameter akustik dengan formula matematis yang dirender rapi menggunakan KaTeX.

---

## Desain, Tipografi & Standar Tampilan

1. **Tipografi Modern**: Seluruh antarmuka menggunakan keluarga font **Poppins** yang bersih dan terbaca jelas.
2. **Kanvas Latar Putih**: Semua kanvas visualisasi gelombang dan spektrum menggunakan latar belakang putih (`#FFFFFF`).
3. **Palet Warna Teal**:
   - Teal Primer: `#0D9488` (Teal-600), `#0F766E` (Teal-700), `#115E59` (Teal-800)
   - Latar Elemen Halus: `#E7F4F2`, `#CCFBF1`, `#F0FDFA`
   - Border Halus: `#CFECE6`, `#E2E8F0`
   - Aksen Bahaya/Berisik: `#E11D48` (Rose-600), `#FFF1F2`, `#FDA4AF`
4. **Nol Emoji**: 100% menggunakan ikon vektor SVG berbasis pustaka **Heroicons**.
5. **Deskripsi Teknis Lugas**: Menggunakan parameter numerik pasti tanpa kata klise seperti 'rekomendasi' atau 'keseimbangan ideal'.

---

## Struktur Direktori Proyek

```text
audio-docker/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Aplikasi FastAPI, lifespan, state room & SPA serve
│   │   ├── config.py                # Konfigurasi parameter audio 4s & path model
│   │   ├── schemas.py               # Skema Pydantic respon API, remote command & telemetri
│   │   ├── api/
│   │   │   ├── predict.py           # Endpoint POST /api/predict-live & POST /api/predict
│   │   │   ├── remote.py            # WebSocket /api/ws/room, GET /state & POST /command
│   │   │   ├── model_info.py        # Endpoint GET /api/model-info (metadata & rumus KaTeX)
│   │   │   └── health.py            # Endpoint GET /api/health (status model di RAM)
│   │   └── services/
│   │       ├── predictor.py         # WKNNPredictor (joblib load saat startup + warmup)
│   │       ├── room_manager.py      # RoomStateManager (In-Memory Singleton & WS Hub)
│   │       └── features.py          # Ekstraksi 16 fitur akustik PSD (Librosa & NumPy)
│   └── requirements.txt             # Dependensi Python backend
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx           # Header adaptif role (PC Lab Kiosk vs Admin Control)
│   │   │   ├── AdminGateModal.tsx   # Modal proteksi PIN Admin (default: 1234)
│   │   │   ├── HeroIcon.tsx         # Komponen ikon murni SVG Heroicons (tanpa emoji)
│   │   │   ├── Latex.tsx            # Komponen render KaTeX matematika native
│   │   │   ├── LiveMonitor.tsx      # Dual-Role Monitor (PC Lab Sensor vs Remote Control)
│   │   │   ├── FileAnalyzer.tsx     # Analisis berkas audio, segmentasi 4s & waveform putih
│   │   │   ├── HistoryLog.tsx       # Riwayat audit log & ekspor data CSV
│   │   │   └── ModelIntelligence.tsx# Spesifikasi WKNN & kamus rumus KaTeX 16 fitur PSD
│   │   ├── services/
│   │   │   ├── api.ts               # Klien Fetch API backend FastAPI
│   │   │   └── remoteSocket.ts      # Klien WebSocket auto-reconnect dual-role
│   │   ├── utils/
│   │   │   ├── wavEncoder.ts        # Konverter Float32Array ke 16-bit PCM WAV mono 22.050 Hz
│   │   │   └── audioAlert.ts        # Sintesis alarm Web Audio API (durasi 3 detik)
│   │   ├── App.tsx                  # Root aplikasi React & routing role URL
│   │   ├── index.css                # Konfigurasi Tailwind & font Poppins
│   │   └── main.tsx                 # Entrypoint Vite & impor KaTeX stylesheet
│   ├── tailwind.config.js           # Konfigurasi tema warna Teal & font Poppins
│   ├── vite.config.ts               # Konfigurasi bundler Vite & proxy WebSocket
│   └── package.json                 # Dependensi frontend (React 19, KaTeX, Tailwind)
├── samples/                         # Berkas audio sampel bawaan (.wav / .mp3)
├── model_k_nearest_neighbors_knn.pkl# Model biner WKNN terlatih (K=4, weights=distance)
├── scaler_audio.pkl                 # Scaler biner RobustScaler terlatih
├── audio_features_4s.csv            # Dataset 16 fitur akustik (5.286 segmen)
├── Dockerfile                       # Multi-stage Docker build (Node 22 + Python 3.12)
├── docker-compose.yml               # File orkestrasi Docker
├── prompt.md                        # Spesifikasi pengembangan Dual-Role Interface
└── README.md                        # Dokumentasi lengkap proyek
```

---

## Dokumentasi Endpoint REST API & WebSocket

### 1. WebSocket Sinkronisasi Ruangan (`WS /api/ws/room?role={lab|admin}`)
- **Koneksi**: Persisten dua arah dengan auto-reconnect.
- **Pesan yang Didukung**:
  - `STATE_SYNC`: Dikirim oleh server saat koneksi baru terhubung atau ada perubahan status.
  - `MIC_STATUS`: Dikirim oleh PC Lab untuk mengabarkan bahwa sensor mikrofon telah aktif.
  - `TELEMETRY_UPDATE`: Dikirim oleh PC Lab tiap 1 detik berisi status, probabilitas, 16 parameter PSD, dan cuplikan audio *preview*.
  - `ADMIN_COMMAND`: Dikirim oleh Admin untuk komando `START_MONITORING`, `STOP_MONITORING`, `UPDATE_CONFIG`, `RESET_BUFFER`, atau `TRIGGER_TEST_ALARM`.

### 2. Snapshot Status Remote (`GET /api/remote/state`)
- **Respon**:
  ```json
  {
    "is_monitoring": false,
    "tolerance_seconds": 10,
    "alarm_enabled": true,
    "lab_client_connected": true,
    "lab_mic_ready": true,
    "admin_count": 1,
    "lab_count": 1,
    "latest_telemetry": null
  }
  ```

### 3. Eksekusi Komando Remote (`POST /api/remote/command`)
- **Payload Request**:
  ```json
  {
    "action": "UPDATE_CONFIG",
    "params": {
      "tolerance_seconds": 4,
      "alarm_enabled": true
    }
  }
  ```
- **Aksi yang Tersedia**:
  - `START_MONITORING`: Memulai deteksi suara pada mikrofon PC Lab.
  - `STOP_MONITORING`: Menghentikan deteksi suara pada PC Lab.
  - `UPDATE_CONFIG`: Mengubah waktu toleransi (`1`, `4`, `5`, `10`, `15`, `20`, `30`) atau sakelar alarm (`true`/`false`).
  - `RESET_BUFFER`: Mengosongkan akumulasi detik kebisingan saat ini.
  - `TRIGGER_TEST_ALARM`: Membunyikan alarm 3 detik di speaker PC Lab secara manual.

### 4. Deteksi Mikrofon Live (`POST /api/predict-live`)
- **Input**: Berkas WAV 16-bit PCM mono 22.050 Hz (panjang 4.0 detik) & `baseline_rms` opsional.
- **Respon**: Label klasifikasi, probabilitas, dan 16 parameter akustik PSD lengkap.

---

## Panduan Menjalankan Aplikasi

### A. Menjalankan Langsung (Mode Produksi Lokal)

```bash
# 1. Bangun berkas distribusi frontend
cd frontend
npm install
npm run build
cd ..

# 2. Jalankan server FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
```

- Buka **Interface PC Lab Display**: **`http://localhost:8080/`** (atau `/lab`).
- Buka **Interface Admin Remote Control**: **`http://localhost:8080/admin`** (PIN default: `1234`).

---

### B. Menjalankan Mode Pengembangan (Frontend & Backend Terpisah)

```bash
# Terminal 1 — Backend FastAPI
py -3.13 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — Frontend Vite Dev Server
cd frontend
npm run dev
```

- Buka **Interface PC Lab Display**: **`http://localhost:5173/`**
- Buka **Interface Admin Remote Control**: **`http://localhost:5173/admin`**

---

### C. Menjalankan via Docker & Docker Compose

```bash
docker compose up --build
```

Aplikasi langsung dapat diakses di: **`http://localhost:8020`** (atau port host sesuai `docker-compose.yml`).

---

## Hasil Evaluasi & Matriks Kebingungan

Evaluasi model Weighted KNN K=4 pada data uji ($N = 1.058$ segmen):

| | Prediksi Non-Berisik | Prediksi Berisik | Total Aktual | Recall |
|---|---|---|---|---|
| **Aktual Non-Berisik** | **540** | 7 | 547 | **98.72%** |
| **Aktual Berisik** | 18 | **493** | 511 | **96.48%** |
| **Total Prediksi** | 558 | 500 | 1.058 | **Akurasi 97.64%** |
