# Dokumentasi Sonalyze

Sistem deteksi dan klasifikasi kebisingan audio (**berisik** vs **non-berisik**) berbasis web. Aplikasi menerima audio dari mikrofon (real-time) atau berkas audio, mengekstrak 14 fitur spektral dengan `librosa`, lalu mengklasifikasikannya dengan model **Random Forest** (scikit-learn).

Dokumen ini disusun dari pembacaan langsung kode di repositori `Okansyailendra/cloning` (commit `23c774e`). Fokus utamanya ada di bagian [Teknologi Pemuatan Model & Klasifikasi Real-Time](#4-teknologi-pemuatan-model--klasifikasi-real-time).

---

## Daftar Isi

1. [Ringkasan Aplikasi](#1-ringkasan-aplikasi)
2. [Arsitektur & Struktur Proyek](#2-arsitektur--struktur-proyek)
3. [Teknologi yang Digunakan](#3-teknologi-yang-digunakan)
4. [Teknologi Pemuatan Model & Klasifikasi Real-Time](#4-teknologi-pemuatan-model--klasifikasi-real-time)
5. [Pipeline Ekstraksi Fitur](#5-pipeline-ekstraksi-fitur)
6. [Referensi API](#6-referensi-api)
7. [Konfigurasi](#7-konfigurasi)
8. [Cara Menjalankan](#8-cara-menjalankan)
9. [Pengujian](#9-pengujian)
10. [Catatan & Temuan dari Kode](#10-catatan--temuan-dari-kode)

---

## 1. Ringkasan Aplikasi

| Aspek | Keterangan |
|---|---|
| Nama | Sonalyze (juga disebut *Sound Lab* / `soundlab` di beberapa bagian kode) |
| Konteks | Tugas mata kuliah Proyek Sains Data (PSD) |
| Tugas ML | Klasifikasi biner: `berisik` / `non-berisik` |
| Model | `RandomForestClassifier` (100 pohon, `max_depth=10`, `random_state=42`) |
| Input fitur | 14 fitur spektral hasil ekstraksi dari audio 22.050 Hz mono |
| Data | 200 berkas audio (160 latih, 40 uji, split 80:20 stratified) |
| Akurasi uji | 92,5% (presisi 1,0; recall 0,85; F1 0,9246; ROC-AUC 0,925) |
| Akurasi validasi silang | rata-rata 0,8187 (± 0,0364) |

Matriks konfusi pada data uji (baris = aktual, kolom = prediksi, urutan `berisik`, `non-berisik`):

|  | Prediksi berisik | Prediksi non-berisik |
|---|:---:|:---:|
| **Aktual berisik** | 17 | 3 |
| **Aktual non-berisik** | 0 | 20 |

Perbandingan akurasi enam model yang dievaluasi: Random Forest 0,925, Gradient Boosting 0,825, SVM RBF 0,775, SVM Linear 0,725, Logistic Regression 0,70, KNN 0,70.

### Fitur aplikasi

- **Deteksi real-time dari mikrofon**: jendela 3 detik dianalisis setiap 1 detik, dengan osiloskop, spektrum batang, linimasa 30 detik, statistik sesi, dan alarm audio.
- **Analisis berkas**: unggah audio atau pakai 3 sampel bawaan, hasilnya berupa prediksi keseluruhan, prediksi per potongan 3 detik, waveform, spektrogram Mel, tabel fitur, dan penjelasan berbahasa awam.
- **Riwayat sesi** (disimpan di browser, ekspor CSV), **perbandingan dua rekaman**, dan halaman **Tentang Model**.

Rute frontend: `/` (analisis & real-time), `/riwayat`, `/bandingkan`, `/tentang-model`.

---

## 2. Arsitektur & Struktur Proyek

```
Browser (React SPA)
   │  HTTP (multipart/form-data, JSON)
   ▼
FastAPI (uvicorn)  ──►  app.state.predictor (RandomForest di memori)
   │                    app.state.class_means (JSON statistik kelas)
   ├─ /api/predict        analisis berkas utuh
   ├─ /api/predict-live   jendela 3 detik dari mikrofon
   ├─ /api/model-info     metadata model
   ├─ /api/health         status server
   └─ /, /assets, /samples, /audio_alarm   berkas statis + SPA
```

```
cloning/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan (muat model + warmup), middleware, static
│   │   ├── config.py            # Settings dari environment / .env
│   │   ├── errors.py            # AppError + handler JSON
│   │   ├── schemas.py           # Skema Pydantic respons
│   │   ├── api/
│   │   │   ├── predict.py       # POST /predict dan POST /predict-live
│   │   │   ├── model_info.py    # GET /model-info
│   │   │   └── health.py        # GET /health
│   │   └── services/
│   │       ├── predictor.py     # AudioPredictor: memuat & menjalankan model
│   │       ├── features.py      # Ekstraksi 14 fitur (librosa)
│   │       ├── audio_loader.py  # Validasi, decode, buang hening
│   │       ├── explain.py       # Penjelasan hasil berbahasa awam
│   │       └── visuals.py       # Data waveform & spektrogram Mel
│   ├── tests/                   # test_model_load.py, test_parity.py
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/                    # React + TypeScript + Vite
│   └── src/
│       ├── components/Audio/RealtimeMonitor.tsx   # Inti fitur real-time
│       ├── services/api.ts      # Pemanggil API (predictLiveAudio, dst.)
│       ├── utils/wavEncoder.ts  # Float32 → WAV 16-bit PCM
│       ├── pages/               # Analisis, Riwayat, Bandingkan, TentangModel
│       └── ...
├── data/
│   ├── model_klasifikasi_audio.pkl   # Model terlatih (joblib)
│   ├── model_meta.json               # Metadata, metrik, urutan fitur
│   ├── class_means.json              # Rata-rata/std per kelas + importance
│   └── fitur_audio.csv, train_data.csv, test_data.csv
├── samples/                     # 3 audio contoh + samples.json
├── audio_alarm/                 # MP3 alarm (70–90% dan 90–100%)
├── Dockerfile, docker-compose.yml, .env.example
└── README.md
```

---

## 3. Teknologi yang Digunakan

### Backend

| Teknologi | Peran |
|---|---|
| Python 3.12 (image Docker) | Bahasa backend |
| **FastAPI** + **uvicorn** | Server API asinkron, dokumentasi Swagger otomatis di `/docs` |
| **scikit-learn 1.8.0** | `RandomForestClassifier` |
| **joblib** | Deserialisasi model `.pkl` |
| **librosa** (+ numba) | Ekstraksi fitur audio: RMS, spectral centroid, ZCR, MFCC, spektrogram Mel |
| **soundfile**, **audioread**, **ffmpeg** | Decode audio (ffmpeg sebagai cadangan untuk format yang tidak bisa dibaca langsung) |
| **numpy**, **pandas** | Operasi sinyal dan penyusunan baris fitur untuk model |
| **Pydantic** | Validasi skema respons |
| python-multipart | Menerima unggahan berkas |

### Frontend

| Teknologi | Peran |
|---|---|
| **React 19** + **TypeScript** | Antarmuka |
| **Vite 8** | Dev server dan build; proxy `/api`, `/samples`, `/audio_alarm` ke port 8080 |
| react-router-dom 7 | Routing |
| lucide-react | Ikon |
| **Web Audio API** (`getUserMedia`, `AudioContext`, `AnalyserNode`, `ScriptProcessorNode`) | Menangkap & memvisualisasikan audio mikrofon |
| **Canvas 2D** | Osiloskop, equalizer, linimasa riwayat |
| `@vitejs/plugin-basic-ssl` + `http-proxy` | Server HTTPS tambahan (port 5174) saat pengembangan agar mikrofon bisa diakses dari perangkat lain |

### Infrastruktur

Docker multi-stage (`node:24-slim` untuk build frontend, `python:3.12-slim` untuk runtime dengan `ffmpeg` dan `libsndfile1`) dan `docker-compose.yml`.

---

## 4. Teknologi Pemuatan Model & Klasifikasi Real-Time

Bagian ini menjelaskan bagaimana model dimuat dan bagaimana klasifikasi bisa berjalan hampir seketika (setiap 1 detik) di aplikasi ini.

### 4.1 Gambaran umum

Klasifikasi real-time di Sonalyze **bukan** streaming dengan WebSocket dan **bukan** inferensi di browser. Polanya adalah:

> Browser menjaga buffer 3 detik terakhir dari mikrofon → setiap 1 detik mengirimnya sebagai WAV lewat HTTP POST → backend mengekstrak fitur dan memprediksi dengan model yang **sudah ada di memori** → hasil JSON dikembalikan dan digambar di UI.

Hasilnya adalah **jendela geser (sliding window)**: panjang jendela 3 detik, langkah 1 detik, sehingga tiap analisis tumpang tindih 2 detik dengan analisis sebelumnya.

### 4.2 Memuat model: sekali saat startup, disimpan di memori

**Format model.** Model disimpan sebagai berkas `data/model_klasifikasi_audio.pkl` dan dibaca dengan `joblib.load` (`backend/app/services/predictor.py`). Berkas ini boleh berupa:

- `dict` berisi `model` dan `selected_features` (urutan kolom fitur), atau
- objek model langsung (dalam kasus ini urutan fitur memakai `FEATURE_NAMES` dari `features.py`).

Daftar kelas diambil dari `model.classes_` (`['berisik', 'non-berisik']`).

**Kapan dimuat.** Model dimuat **satu kali** pada fase startup aplikasi melalui `lifespan` FastAPI (`backend/app/main.py`):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.predictor = AudioPredictor(model_full_path)      # joblib.load di sini
    app.state.class_means = json.load(...)                     # statistik kelas untuk penjelasan
    # ... warmup ...
    yield
```

Objek `AudioPredictor` disimpan di `app.state.predictor`, lalu dipakai ulang oleh setiap request lewat `request.app.state.predictor`. Akibatnya **tidak ada pembacaan disk atau deserialisasi model per request**. Kalau model belum siap, endpoint mengembalikan `503 MODEL_BELUM_SIAP`.

**Warmup.** Setelah model dimuat, startup menjalankan ekstraksi fitur `librosa` pada audio noise sintetis 3 detik dan satu panggilan `predictor.predict(...)` dengan fitur dummy. Tujuannya menghindari lonjakan latensi pada request pertama (misalnya kompilasi JIT `numba` yang dipakai `librosa`). Kegagalan warmup ditelan diam-diam (`except Exception: pass`), jadi aplikasi tetap berjalan walau warmup gagal.

### 4.3 Mengapa klasifikasinya cukup cepat untuk real-time

1. **Model klasik yang ringan.** Random Forest dengan 100 pohon dan kedalaman maksimum 10, bukan jaringan saraf. Inferensi satu baris data hanya melintasi 100 pohon dangkal.
2. **Input kecil.** Model hanya menerima **14 angka** per prediksi (bukan spektrogram atau audio mentah). Pekerjaan berat sebenarnya ada di ekstraksi fitur, bukan di model.
3. **Jendela tetap 3 detik.** Setiap request memproses persis 66.150 sampel (3 detik × 22.050 Hz), sehingga beban per request konstan, tidak tumbuh seiring lama sesi.
4. **Model sudah panas di memori** (lihat 4.2), jadi biaya per request hanya dekode WAV + ekstraksi fitur + prediksi.
5. **Tanpa berkas sementara pada jalur normal.** `/predict-live` membaca WAV langsung dari memori (`sf.read(io.BytesIO(content))`). Berkas sementara hanya dipakai sebagai cadangan jika pembacaan dari memori gagal.
6. **Jalur cepat untuk senyap.** Jika energi sinyal di bawah ambang, backend langsung menjawab `non-berisik` tanpa ekstraksi fitur maupun model.
7. **Tanpa antrean di sisi klien.** Frontend memakai penjaga `isPredictingRef`: bila request sebelumnya belum selesai, tick 1 detik berikutnya dilewati, sehingga request tidak menumpuk saat server lambat.

> README proyek menyebut latensi pemrosesan "~20 ms". Angka itu **tidak saya ukur ulang**; respons `/predict` memang menyertakan field `timing` (`load_ms`, `features_ms`, `predict_ms`, `total_ms`) yang bisa dipakai untuk memeriksanya, tetapi `/predict-live` tidak mengembalikan waktu.

### 4.4 Alur lengkap satu siklus real-time

```
┌──────────────────────────── BROWSER ────────────────────────────┐
│ getUserMedia (mono; echoCancellation, noiseSuppression,         │
│                autoGainControl = false)                         │
│        │                                                        │
│        ▼                                                        │
│  AudioContext ──► MediaStreamSource                             │
│        ├──► AnalyserNode (fft 2048) ──► canvas 60 FPS           │
│        │         (osiloskop & equalizer, hanya visualisasi)     │
│        └──► ScriptProcessorNode (4096) ──► downsample ke        │
│                  22.050 Hz ──► buffer melingkar 3 detik         │
│                                                                 │
│  setInterval 1000 ms ──► susun buffer berurutan                 │
│        ──► encodeWAV (16-bit PCM mono)                          │
│        ──► POST /api/predict-live  (file + baseline_rms)        │
└─────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────── BACKEND ────────────────────────────┐
│ baca WAV dari memori ─► mono ─► resample bila sr ≠ 22.050       │
│ ─► ambil/pad tepat 3 detik                                      │
│ ─► cek senyap (ambang adaptif)                                  │
│      ├─ senyap  ─► non-berisik (0,99) tanpa model               │
│      └─ bersuara ─► buang hening (top_db=25) ─► ekstraksi fitur │
│                   ─► DataFrame 1×14 ─► predict + predict_proba  │
│                   ─► kalibrasi energi akustik ─► JSON           │
└─────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────── BROWSER ────────────────────────────┐
│ noisePercent = probabilitas "berisik" × 100                     │
│ ─► meter, linimasa 30 detik, statistik sesi                     │
│ ─► logika alarm (ambang 70% / 90% + waktu bertahan)             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Sisi browser (`RealtimeMonitor.tsx`)

- **Akuisisi.** `navigator.mediaDevices.getUserMedia` dengan `echoCancellation`, `noiseSuppression`, dan `autoGainControl` dimatikan, supaya level suara yang diukur tidak diubah oleh pemrosesan bawaan browser. Mikrofon membutuhkan konteks aman (HTTPS atau `localhost`); kode menampilkan pesan bila API tidak tersedia, misalnya saat diakses lewat IP LAN tanpa HTTPS.
- **Buffer melingkar 3 detik.** `ScriptProcessorNode` (ukuran blok 4096) menyalin sampel ke `Float32Array` sepanjang `22.050 × 3 = 66.150`. Penulisan memakai indeks melingkar (`bufferWriteIdx`), jadi buffer selalu berisi 3 detik terakhir.
- **Resampling.** Sample rate perangkat (misalnya 44,1/48 kHz) dikonversi ke 22.050 Hz dengan mengambil sampel terdekat (`inputData[floor(i * ratio)]`), yaitu metode sederhana tanpa filter anti-aliasing. Backend tetap me-resample bila `sr` yang diterima bukan 22.050.
- **Pengiriman.** Tiap 1 detik, buffer disusun ulang berurutan waktu lalu dikodekan oleh `encodeWAV` (`utils/wavEncoder.ts`) menjadi WAV PCM 16-bit mono, dan dikirim lewat `predictLiveAudio` (`services/api.ts`) ke `POST /api/predict-live` bersama `baseline_rms`.
- **Visualisasi terpisah dari klasifikasi.** Osiloskop dan equalizer 22 batang digambar dari `AnalyserNode` dengan `requestAnimationFrame` (sekitar 60 FPS) langsung ke Canvas, tidak menunggu hasil server.
- **Kalibrasi ambien.** Pengguna dapat mengukur kebisingan dasar ruangan selama 3 detik (rata-rata RMS dari `AnalyserNode`). Nilainya disimpan di `localStorage` dan dikirim sebagai `baseline_rms`.
- **Alarm.** Jika `noisePercent ≥ 70` atau label `berisik`, penghitung waktu bertahan dimulai. Alarm berbunyi setelah kebisingan bertahan selama ambang pilihan pengguna (0, 5, atau 10 detik; bawaan 5 detik). Rata-rata persentase selama periode itu `≥ 90` memicu alarm tinggi (`alarm_90-100.mp3`), selain itu alarm sedang (`alarm_70-90.mp3`). Pemutaran dijaga agar hanya satu alarm yang aktif pada satu waktu.
- **Penyimpanan sesi.** Saat monitoring dihentikan dan durasi ≥ 3 detik, sesi disimpan otomatis ke riwayat.

### 4.6 Sisi backend (`POST /api/predict-live`)

Langkah di `backend/app/api/predict.py`:

1. **Decode** WAV dari memori dengan `soundfile`; stereo diratakan ke mono; cadangan: tulis berkas sementara lalu `librosa.load(sr=22050)`.
2. **Normalisasi panjang.** Jika `sr ≠ 22050`, di-resample dengan `librosa.resample`. Audio lebih pendek dari 3 detik diulang (`np.tile`) hingga 3 detik; audio lebih panjang dipotong ke 3 detik **terakhir**.
3. **Pemeriksaan senyap dengan ambang adaptif:**
   `effective_silence_rms = max(0.003, min(0.04, baseline_rms × 1.25))`.
   Bila amplitudo puncak < `1e-4` atau RMS rata-rata ≤ ambang tersebut, respons langsung `non-berisik` dengan keyakinan 0,99 (tanpa memanggil model). Status teksnya membedakan "sangat tenang" dari "ambien dasar (sesuai kalibrasi)".
4. **Buang hening.** `librosa.effects.split(top_db=25)`; jika ada bagian hening yang terbuang, segmen aktif digabung. Bila hasil gabungan ≥ 0,5 detik, diulang (`tile`) kembali ke 3 detik agar sama dengan kondisi saat pelatihan; bila lebih pendek dari itu (atau tidak ada yang terbuang), audio 3 detik asli dipakai apa adanya.
5. **Ekstraksi fitur** (RMS, spectral centroid, ZCR, 13 MFCC) lalu rata-rata/standar deviasi menjadi fitur skalar (lihat [bagian 5](#5-pipeline-ekstraksi-fitur)).
6. **Prediksi.** `AudioPredictor.predict` membangun `DataFrame` satu baris dengan kolom berurutan sesuai `selected_features`, lalu memanggil `model.predict` dan `model.predict_proba`.
7. **Kalibrasi energi akustik.** Aturan heuristik di atas keluaran model (lihat 4.7).
8. **Respons JSON**: `label`, `confidence`, `probabilities`, `rms`, `centroid_hz`, `zcr`, `mfcc1`, `mfcc3`, `rms_std`, `status_text`, `low_confidence`, `is_ambient`, `baseline_rms`, `timestamp`.

### 4.7 Kalibrasi energi akustik (aturan di luar model)

Selain keluaran Random Forest, kode menambahkan aturan "koreksi" agar suara yang jelas keras tidak diberi label tenang:

| Lokasi | Kondisi | Efek |
|---|---|---|
| `AudioPredictor.predict` | `rms_mean ≥ 0,080` dan model memprediksi `non-berisik` | Dipaksa `berisik`; probabilitas dihitung ulang: `P(berisik) = max(P_model, min(0,92, 0,55 + (rms − 0,08) × 3,5))` |
| `AudioPredictor.predict_chunks` | `rms_mean ≥ 0,075` dan prediksi `non-berisik` | Sama, dengan ambang 0,075 |
| `/predict-live` (setelah `predict`) | `rms ≥ 0,075` **atau** `peak_rms ≥ 0,10` dan prediksi `non-berisik` | Dipaksa `berisik`; `P(berisik)` dibatasi hingga 0,95 |
| Potongan senyap (`/predict` per-chunk) | `is_silent` atau `rms_mean < 0,003` | `non-berisik` dengan keyakinan 0,99, tanpa model |

Angka-angka ini adalah ambang tetap hasil penyetelan manual (*hard-coded*), bukan bagian dari model terlatih. Perilaku akhir yang dilihat pengguna merupakan gabungan model dan aturan ini.

---

## 5. Pipeline Ekstraksi Fitur

Parameter dasar (dari `data/model_meta.json`): `target_sr = 22050`, `top_db = 25`, `chunk_duration_s = 3`, `n_mfcc = 13`.

**Untuk berkas (`/predict`)** — `audio_loader.py` + `features.py`:

1. Muat audio mono 22.050 Hz (`librosa.load`; cadangan `ffmpeg`). Durasi harus 0,5–120 detik; audio yang nyaris tanpa sinyal ditolak (`AUDIO_SENYAP`).
2. Buang hening: `librosa.effects.split(top_db=25)` lalu `np.concatenate` segmen aktif (`y_clean`).
3. Jika `y_clean` < 3 detik, di-*zero-pad* ke 3 detik (peringatan `AUDIO_PENDEK_DIPAD`).
4. `extract_features`: `y_clean` dibagi ke potongan 3 detik; RMS, centroid, ZCR, dan MFCC dihitung per potongan, digabung antar-frame, lalu dirata-rata (dan standar deviasi untuk RMS) menjadi satu vektor fitur.
5. Terpisah, `extract_timeline_chunks` memotong `y_raw` (audio asli) per 3 detik untuk linimasa prediksi per potongan yang sinkron dengan pemutar audio.

**14 fitur yang dipakai model** (urutan = `FEATURE_NAMES`, bobot = importance Random Forest):

| Peringkat | Fitur | Arti | Importance |
|:---:|---|---|:---:|
| 1 | `rms_mean` | Volume rata-rata | 0,1992 |
| 2 | `rms_std` | Variasi volume (dinamika) | 0,1071 |
| 3 | `mfcc3_mean` | Timbre MFCC 3 | 0,0874 |
| 4 | `mfcc1_mean` | Bentuk spektral utama | 0,0827 |
| 5 | `mfcc5_mean` | Keseimbangan spektral | 0,0797 |
| 6 | `mfcc7_mean` | Detail harmonik menengah | 0,0573 |
| 7 | `mfcc11_mean` | Spektrum mikro atas | 0,0547 |
| 8 | `zcr_mean` | Zero crossing rate (desis) | 0,0520 |
| 9 | `centroid_mean` | Pusat massa spektrum (Hz) | 0,0496 |
| 10 | `mfcc13_mean` | Tekstur frekuensi tinggi | 0,0494 |
| 11 | `mfcc10_mean` | Detail harmonik tinggi | 0,0479 |
| 12 | `mfcc8_mean` | Resonansi menengah-tinggi | 0,0460 |
| 13 | `mfcc6_mean` | Resonansi tengah | 0,0452 |
| 14 | `mfcc9_mean` | Transisi timbre atas | 0,0417 |

Urutan kolom pada model adalah: `rms_mean, rms_std, mfcc1_mean, mfcc3_mean, mfcc5_mean, mfcc13_mean, mfcc6_mean, centroid_mean, mfcc7_mean, zcr_mean, mfcc8_mean, mfcc11_mean, mfcc10_mean, mfcc9_mean`. Urutan ini diverifikasi oleh `test_model_load.py`, dan `AudioPredictor` memilih kolom berdasarkan nama sehingga urutan tidak tertukar.

**Penjelasan hasil (`explain.py`).** Untuk tiap fitur dihitung skor `s = (|x − μ_kelas_lain| − |x − μ_kelas_prediksi|) / σ_gabungan`, dikalikan importance fitur. Tiga kontributor positif teratas menjadi alasan, satu kontributor negatif teratas menjadi faktor penyeimbang, lalu dirangkai menjadi kalimat berbahasa awam. Ini heuristik jarak ke rata-rata kelas, **bukan** atribusi eksak dari pohon keputusan (misalnya SHAP).

---

## 6. Referensi API

Semua endpoint berprefiks `/api`. Setiap respons membawa header `X-Request-ID`; error memakai format seragam:

```json
{ "error": { "code": "KODE_ERROR", "message": "...", "detail": {} }, "request_id": "..." }
```

| Metode | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | `status`, `model_loaded`, `sklearn_version`, `uptime_s` |
| GET | `/api/model-info` | Metadata model, fitur, metrik, perbandingan model, dataset, `class_means`, batas, daftar sampel |
| POST | `/api/predict` | Analisis berkas (form field `file`) |
| POST | `/api/predict-live` | Klasifikasi satu jendela 3 detik (form field `file` WAV, `baseline_rms` opsional) |

**`POST /api/predict`** mengembalikan: `file`, `audio` (durasi, durasi setelah buang hening, `sample_rate`, `n_chunks`, `active_intervals`), `prediction` (`label`, `confidence`, `probabilities`, `low_confidence`, `warn_threshold`), `features` (14 item dengan nilai, rata-rata kelas, kelas terdekat, importance), `mfcc_profile`, `explanation`, `chunks` (prediksi per 3 detik), `visual` (waveform 2000 titik dan spektrogram Mel 64 bin), `timing`, dan `warnings`.

Kode peringatan: `AUDIO_CLIPPING` (>1% sampel ≥ 0,99), `HENING_DOMINAN` (>70% dibuang), `CONFIDENCE_RENDAH` (keyakinan < 0,65), `AUDIO_PENDEK_DIPAD`.

Kode error umum: `FILE_TIDAK_ADA` (400), `FILE_KOSONG` (400), `FILE_TERLALU_BESAR` (413), `FORMAT_TIDAK_DIDUKUNG` (415), `AUDIO_RUSAK` / `AUDIO_TERLALU_PENDEK` / `AUDIO_TERLALU_PANJANG` / `AUDIO_SENYAP` (422), `MODEL_BELUM_SIAP` (503), `KESALAHAN_SERVER` (500).

Berkas statis: `/samples/*`, `/audio_alarm/*`, `/assets/*`. Jika `frontend/dist` ada, FastAPI juga menyajikan SPA (semua path non-`/api` dialihkan ke `index.html`).

---

## 7. Konfigurasi

Dibaca dari environment atau berkas `.env` di root proyek (parser sederhana di `config.py`). Contoh ada di `.env.example`.

| Variabel | Bawaan | Keterangan |
|---|---|---|
| `PORT` | `8080` | Port server |
| `MODEL_PATH` | `data/model_klasifikasi_audio.pkl` | Lokasi model |
| `CLASS_MEANS_PATH` | `data/class_means.json` | Statistik per kelas |
| `MODEL_META_PATH` | `data/model_meta.json` | Metadata model |
| `SAMPLES_DIR` | `samples` | Folder audio contoh |
| `MAX_FILE_MB` | `15` | Batas ukuran unggahan |
| `MAX_DURATION_S` / `MIN_DURATION_S` | `120` / `0.5` | Batas durasi (konstanta pada `audio_loader.py` memakai nilai yang sama) |
| `CONFIDENCE_WARN_THRESHOLD` | `0.65` | Ambang peringatan keyakinan rendah |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Daftar origin CORS |
| `LOG_LEVEL`, `TMP_DIR` | `INFO`, folder temp sistem | Log dan folder sementara |

Lihat [Catatan & Temuan](#10-catatan--temuan-dari-kode) untuk variabel yang didefinisikan tetapi belum dipakai.

---

## 8. Cara Menjalankan

### A. Mode produksi lokal (satu perintah)

Syarat: frontend sudah di-build ke `frontend/dist/`.

```bash
cd frontend && npm ci && npm run build && cd ..
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Buka `http://localhost:8080/`. Pastikan `ffmpeg` terpasang di sistem bila ingin mendukung decode cadangan.

### B. Mode pengembangan (backend dan frontend terpisah)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — frontend
cd frontend
npm ci
npm run dev
```

- Frontend: `http://localhost:5173/` (HTTP biasa) dan `https://<IP-LAN>:5174/` (HTTPS dengan sertifikat *self-signed*, agar mikrofon bisa dipakai dari HP/perangkat lain).
- Swagger: `http://localhost:8080/docs`.

### C. Docker

```bash
docker compose up --build
```

Pada `docker-compose.yml`, port host **8008** dipetakan ke port kontainer 8080, sehingga aplikasi dibuka di `http://localhost:8008/`. Folder `data`, `samples`, dan `audio_alarm` dipasang sebagai volume *read-only*.

---

## 9. Pengujian

```bash
python backend/tests/test_model_load.py   # 7 pemeriksaan spesifikasi model
python backend/tests/test_parity.py       # paritas fitur vs data latih
```

- `test_model_load.py`: memastikan berkas model ada, bertipe `RandomForestClassifier`, menerima 14 fitur dengan urutan yang benar, kelas `['berisik','non-berisik']`, `n_estimators == 100`, serta inferensi dummy menghasilkan probabilitas yang berjumlah 1.
- `test_parity.py`: membandingkan fitur hasil ekstraksi kode saat ini dengan nilai di `data/train_data.csv` (toleransi relatif 5%) untuk maksimal 5 berkas. Berkas audio mentah data latih **tidak ada di repositori**, jadi tes ini hanya bermakna bila `AUDIO_DATA_DIR` diarahkan ke folder audio asli; tanpa itu ia hanya mencetak informasi dan tidak menguji apa pun.
- Dependensi tambahan pengujian ada di `backend/requirements-dev.txt`.

---

## 10. Catatan & Temuan dari Kode

Hal-hal berikut ditemukan saat membaca kode dan sebaiknya diketahui oleh pengelola atau penguji proyek.

1. **Format unggahan.** README menyebut MP3, WAV, OGG, FLAC, M4A, tetapi `validate_audio_file` hanya menerima `.mp3` dan `.wav`, sedangkan `model_meta.json` mencantumkan hanya `.mp3` dan pesan error menyebut "MP3".
2. **Rate limiting & antrean belum aktif.** `slowapi` ada di `requirements.txt` dan variabel `RATE_LIMIT_PREDICT`, `RATE_LIMIT_DEFAULT`, `MAX_WORKERS`, `QUEUE_WAIT_S`, `PROCESS_TIMEOUT_S` didefinisikan di `config.py`, tetapi tidak ada kode yang memakainya. Endpoint belum dibatasi lajunya.
3. **Port Docker.** README menyebut `http://localhost:8080/` untuk Docker, padahal `docker-compose.yml` memetakan ke `8008`.
4. **`ScriptProcessorNode` sudah usang.** API ini dinyatakan deprecated pada spesifikasi Web Audio dan berjalan di *main thread*; penggantinya adalah `AudioWorklet`. Saat ini masih berfungsi di browser utama, tetapi merupakan titik perbaikan jika ingin lebih stabil.
5. **Resampling di browser sederhana.** Pengambilan sampel terdekat tanpa filter dapat menimbulkan aliasing pada frekuensi tinggi, sehingga fitur seperti `centroid_mean` dan `zcr_mean` bisa sedikit bergeser dibanding data latih (yang berasal dari audio 44,1 kHz yang di-resample `librosa`).
6. **Kalibrasi tambahan di luar model.** Aturan RMS di bagian 4.7 memengaruhi hasil akhir dan memiliki ambang yang tidak sama (0,080 pada `predict`, 0,075 pada chunk dan jalur live). Perlu diperhitungkan saat menilai akurasi "model" di lapangan; akurasi 92,5% adalah angka model murni pada 40 data uji.
7. **Ukuran data uji kecil.** 40 sampel uji dan validasi silang 0,8187 ± 0,0364 menunjukkan estimasi performa yang masih berfluktuasi.
8. **Klaim latensi ~20 ms.** Tercantum di README tetapi tidak diverifikasi di sini; `/predict-live` tidak mengembalikan data waktu.
9. **Penamaan campuran.** Nama produk "Sonalyze" berdampingan dengan `soundlab` (folder temp, kunci `localStorage`, nama kontainer `sound-lab-app`).
10. **Path contoh di README** (`C:\laragon\www\Bismillah_A`) adalah path lokal pengembang, bukan struktur repositori.
11. **Warmup menelan error.** Jika warmup gagal, tidak ada log; aplikasi tetap hidup tetapi request pertama bisa lebih lambat.
