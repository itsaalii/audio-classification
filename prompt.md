# Tugas Pengembangan: Implementasi Dual-Role Interface (PC Lab Display vs. Admin Remote Control) & Sinkronisasi Real-Time pada AcoustiKNN Studio

## 1. Konteks & Tujuan Utama
Kembangkan aplikasi **AcoustiKNN Studio** yang saat ini berjalan dengan satu antarmuka menjadi arsitektur **Dual-Role Interface (2 Peran Antarmuka Berbeda)** yang saling tersinkronisasi secara *real-time* melalui backend **FastAPI**:

1. **Role 1: Interface PC Lab / Kiosk Display (`/` atau `/lab`)**
   - Dipasang pada PC di dalam ruang laboratorium sebagai sensor penangkap audio mikrofon sekaligus layar tampilan informasi (*read-only*).
   - Menampilkan seluruh indikator dan visualisasi **Monitoring Real-Time (Live Studio Room)** yang sama persis seperti sebelumnya, namun **TIDAK BISA** melakukan kustomisasi parameter, **TIDAK BISA** mengubah waktu toleransi, dan **TIDAK BISA** menekan tombol Start/Stop deteksi dari antarmuka ini.
   - Eksekusi penangkapan mikrofon (`Web Audio API`), pengiriman potongan audio ke backend, dan pemicuan bunyi alarm 3 detik (`audioAlert.ts`) tetap berjalan di browser PC Lab ini, tetapi sepenuhnya dikomandoi dari jarak jauh oleh Admin.

2. **Role 2: Interface Admin / Remote Control Center (`/admin`)**
   - Diakses dari perangkat Admin (laptop/PC/smartphone) dari jarak jauh.
   - Menampilkan **Monitoring Real-Time** yang tersinkronisasi langsung dengan apa yang terjadi di PC Lab (status akustik, level desibel/LED meter, grafik tren 30 detik, progres akumulasi bising, serta nilai diagnostik 16 parameter akustik PSD).
   - Memiliki hak akses penuh untuk **Menjalankan (Start)** dan **Menghentikan (Stop)** deteksi kebisingan di PC Lab dari jarak jauh, serta **Melakukan Kustomisasi Aplikasi** secara *real-time* (mengubah pilihan waktu toleransi *Rolling Window*, mengaktifkan/menonaktifkan suara alarm, me-reset buffer kebisingan, serta mengakses modul *Audio Inspector*, *Audit Log*, dan *Model Intelligence*).

---

## 2. Standar Desain & Aturan Wajib (Tetap Dipertahankan)
Seluruh perubahan dan komponen baru **WAJIB** mematuhi standar desain proyek:
- **Tipografi**: Font `Poppins` di seluruh elemen UI.
- **Kanvas Latar Putih**: Semua visualisasi gelombang osiloskop & spektrum wajib berlatar belakang putih bersih (`#FFFFFF`).
- **Palet Warna Teal & Rose**:
  - Teal Primer: `#0D9488` (Teal-600), `#0F766E` (Teal-700), `#115E59` (Teal-800)
  - Latar Elemen Halus: `#E7F4F2`, `#CCFBF1`, `#F0FDFA`
  - Border Halus: `#CFECE6`, `#E2E8F0`
  - Aksen Bahaya/Berisik: `#E11D48` (Rose-600), `#FFF1F2`, `#FDA4AF`
- **Nol Emoji**: Dilarang menggunakan karakter emoji di bagian manapun pada kode maupun UI. Gunakan 100% ikon vektor SVG dari `HeroIcon.tsx`.
- **Deskripsi Teknis Lugas**: Gunakan bahasa teknis dan parameter numerik pasti tanpa kata klise.

---

## 3. Spesifikasi Arsitektur Backend (FastAPI)

Buat mekanisme *State Management* terpusat dan komunikasi dua arah (*WebSocket* + *REST API*) di sisi backend agar Admin dan PC Lab selalu sinkron dengan latensi minimal:

### A. Centralized Room State (`backend/app/services/room_manager.py` & `app.state.room`)
Buat kelas `RoomStateManager` (In-Memory Singleton yang diikat ke `app.state.room` pada `backend/app/main.py`) yang menyimpan:
- `is_monitoring: bool` (Default: `False` — apakah deteksi sedang aktif atau dihentikan oleh Admin).
- `tolerance_seconds: int` (Default: `10` — pilihan opsi: `1` [Real-Time], `4`, `5`, `10`, `15`, `20`, `30`).
- `alarm_enabled: bool` (Default: `True` — apakah bunyi alarm 3 detik diaktifkan di PC Lab).
- `lab_client_connected: bool` (Status apakah browser PC Lab sedang terhubung dan siap menangkap mikrofon).
- `lab_mic_ready: bool` (Status apakah `AudioContext` dan izin mikrofon di PC Lab sudah diinisialisasi).
- `latest_telemetry: dict | None` (Menyimpan payload hasil prediksi terakhir: label prediksi, probabilitas, 16 fitur PSD, riwayat 30 detik terakhir, progres akumulasi detik bising dalam *rolling window*, status alarm aktif, dan timestamp).

### B. WebSocket & Endpoint Sinkronisasi (`backend/app/api/remote.py`)
1. **`WS /api/ws/room?role={lab|admin}`**:
   - Menangani koneksi WebSocket *persistent* untuk semua client `lab` dan `admin`.
   - Saat koneksi baru masuk, langsung kirimkan *initial state* (`STATE_SYNC`) berisi konfigurasi saat ini, status koneksi PC Lab, dan `latest_telemetry`.
   - Ketika `lab` terhubung/terputus atau mengirim status kesiapan mikrofon (`MIC_STATUS`), *broadcast* pembaruan status ke seluruh koneksi `admin`.
   - Ketika PC Lab selesai melakukan inferensi per detik (atau mengirimkan update telemetri visual/prediksi), *broadcast* event `TELEMETRY_UPDATE` ke seluruh koneksi `admin` dan `lab` secara *real-time*.
2. **`POST /api/remote/command`** (Dipanggil oleh Admin atau via pesan WebSocket `ADMIN_COMMAND`):
   - Menerima aksi dari Admin:
     - `action: "START_MONITORING"` -> Mengubah `is_monitoring = True`, mem-*broadcast* perintah ke PC Lab untuk mulai menangkap mikrofon & mengirim segmen audio.
     - `action: "STOP_MONITORING"` -> Mengubah `is_monitoring = False`, me-reset *rolling buffer*, dan mem-*broadcast* perintah ke PC Lab untuk menghentikan pengiriman audio.
     - `action: "UPDATE_CONFIG"` -> Mengubah `tolerance_seconds` (`1`, `4`, `5`, `10`, `15`, `20`, `30`) atau `alarm_enabled` (`True`/`False`), lalu mem-*broadcast* konfigurasi baru ke PC Lab agar diterapkan seketika tanpa *reload*.
     - `action: "RESET_BUFFER"` -> Mengosongkan *rolling window buffer* akumulasi kebisingan saat ini.
     - `action: "TRIGGER_TEST_ALARM"` -> Memicu bunyi alarm 3 detik secara manual di PC Lab.
3. **`GET /api/remote/state`**:
   - Mengembalikan snapshot JSON dari `RoomStateManager` saat ini sebagai *fallback* selain WebSocket.

---

## 4. Spesifikasi Frontend: Role 1 — Interface PC Lab (`/` atau `/?role=lab` atau `/lab`)

1. **Mode Kiosk / Read-Only Monitoring**:
   - Hanya menampilkan tampilan **Modul 1: Monitoring Real-Time (Live Studio Room)** secara *clean* dan *full-layout*.
   - **Sembunyikan/Kunci Navigasi & Kontrol**:
     - Sembunyikan tab navigasi ke *Audio Inspector*, *Riwayat Sesi*, dan *Model Intelligence* (atau kunci agar pengguna PC Lab tidak bisa berpindah halaman dan mengutak-atik sistem).
     - **Hapus/Sembunyikan** tombol *Start/Stop Monitoring* dan tombol *pilihan waktu toleransi* dari layar PC Lab. Gantikan bagian tersebut dengan **Badge Status Kendali Jarak Jauh** (contoh: `"Mode Kiosk PC Lab — Dikendalikan oleh Admin"`, menampilkan parameter aktif saat ini secara *read-only* seperti `"Toleransi Aktif: 10 Detik (80%)"` dan `"Status Server: Terhubung"`).
2. **Penanganan Izin Mikrofon & AudioContext Browser (One-Click Kiosk Activation)**:
   - Karena kebijakan browser modern mewajibkan interaksi pengguna (user gesture) pertama kali untuk mengaktifkan mikrofon dan `AudioContext`, tampilkan *Overlay / Banner Inisialisasi Kiosk* yang rapi saat halaman PC Lab pertama kali dibuka: **"Aktifkan Sensor Audio PC Lab"**.
   - Setelah asisten/teknisi menekan tombol tersebut 1 kali saat menyalakan PC Lab, izin mikrofon (`navigator.mediaDevices.getUserMedia`) dan `AudioContext` disiapkan ke mode *Siaga (Standby)*, mengirim status `lab_mic_ready = true` ke server, lalu layar masuk ke tampilan **Monitoring Real-Time (Read-Only)**.
   - Selanjutnya, kapanpun Admin menekan **Start** atau **Stop** dari jarak jauh, PC Lab otomatis memulai atau menghentikan perekaman serta membunyikan alarm 3 detik tanpa perlu interaksi klik lagi di PC Lab.
3. **Visualisasi & Indikator Tetap Lengkap**:
   - Tetap menampilkan Status Akustik Utama (`STANDBY`, `KONDUSIF (NON-BERISIK)`, `PERINGATAN: BERISIK`), 28-segment LED Meter, Osiloskop & Spektrogram 60 FPS berlatar putih `#FFFFFF`, Bilah Akumulasi Bising, Linimasa Riwayat 30 Detik, dan Diagnostik 16 Parameter PSD.

---

## 5. Spesifikasi Frontend: Role 2 — Interface Admin (`/admin` atau `/?role=admin`)

1. **Proteksi Akses Sederhana (Admin Gate)**:
   - Tambahkan modal/halaman masuk PIN Admin ringan (default PIN dapat dikonfigurasi, misal `1234` atau via variabel environment, tersimpan di `sessionStorage`) disertai tombol *Switch Role / Buka Mode Admin* agar mahasiswa di PC Lab tidak bisa sembarangan masuk ke `/admin`.
2. **Panel Kendali Jarak Jauh (Remote Control Bar)**:
   - Tampilkan indikator status perangkat PC Lab secara *real-time*:
     - Status Koneksi PC Lab: `PC Lab Terhubung (Siap)` (Teal) atau `PC Lab Terputus / Mikrofon Belum Diaktifkan` (Rose).
   - **Tombol Utama Start / Stop Jarak Jauh**:
     - Tombol **Mulai Deteksi Ruang Lab** dan **Hentikan Deteksi** yang mengirim perintah langsung ke PC Lab.
   - **Kustomisasi Parameter Real-Time**:
     - Pemilih waktu toleransi konsisten (*Rolling Window*): `Real-Time (1s)`, `4 Detik`, `5 Detik`, `10 Detik`, `15 Detik`, `20 Detik`, `30 Detik`. Saat Admin mengubah nilai ini, aturan evaluasi *rolling window* langsung berubah di PC Lab secara *real-time*.
     - Toggle **Suara Alarm PC Lab (Aktif / Nonaktif)**, tombol **Reset Akumulasi Bising**, dan tombol **Uji Bunyi Alarm (3s)** jarak jauh.
3. **Monitoring Real-Time Tersinkronisasi**:
   - Pada tab **Live Studio Room** di layar Admin, tampilkan seluruh metrik secara *real-time* berdasarkan *stream* data dari PC Lab:
     - Status Akustik Utama (`STANDBY`, `KONDUSIF`, `PERINGATAN: BERISIK`).
     - Multi-segment LED Meter (28 baris) dan visualisasi gelombang/spektrum yang direkonstruksi secara mulus (60 FPS) dari telemetri amplitudo/frekuensi & 16 fitur PSD PC Lab.
     - Bilah Akumulasi Bising (`mis. 8s / 10s`), Linimasa Riwayat 30 Detik, dan Diagnostik 16 Parameter Akustik (RMS, Spectral Centroid, ZCR, serta grafik batang MFCC 1–13).
4. **Akses Penuh 4 Modul**:
   - Hanya Role Admin yang memiliki akses penuh ke ke-4 tab navigasi di `Header.tsx`:
     1. *Monitoring Real-Time (Remote Control & Live Telemetry)*
     2. *Analisis Berkas Audio (Audio Inspector)*
     3. *Riwayat Sesi (Audit Log & Export CSV)*
     4. *Arsitektur & 16 Fitur PSD (Model Intelligence)*

---

## 6. Struktur File yang Perlu Dibuat / Dimodifikasi

1. **Backend**:
   - `backend/app/services/room_manager.py` (Baru): Pengelola state ruangan, koneksi WebSocket (`lab` & `admin`), dan broadcast telemetri/command.
   - `backend/app/api/remote.py` (Baru): Router untuk WebSocket `/api/ws/room`, `GET /api/remote/state`, dan `POST /api/remote/command`.
   - `backend/app/schemas.py` (Update): Tambahkan skema Pydantic untuk `RemoteCommandRequest`, `RoomStateResponse`, dan `TelemetryPayload`.
   - `backend/app/main.py` (Update): Daftarkan `RoomStateManager` ke `app.state.room` dan sertakan router `remote.py`.
2. **Frontend**:
   - `frontend/src/services/remoteSocket.ts` (Baru): Klien WebSocket dengan fitur *auto-reconnect* untuk sinkronisasi state dan telemetri antara PC Lab dan Admin.
   - `frontend/src/components/Header.tsx` (Update): Sesuaikan tampilan header berdasarkan role (`PC Lab Display` vs `Admin Control Center`), sembunyikan tab navigasi selain Live Monitor pada mode PC Lab, dan tampilkan badge status koneksi.
   - `frontend/src/components/LiveMonitor.tsx` (Update/Refactor): Pisahkan mode tampilan antara `role="lab"` (Read-Only UI + Eksekutor Mikrofon/Alarm Lokal yang dikomandoi WebSocket) dan `role="admin"` (Full Remote Control Panel + Real-Time Telemetry Receiver).
   - `frontend/src/App.tsx` (Update): Deteksi rute URL (`/admin` atau `?role=admin` untuk Admin, dan `/` atau `/lab` untuk PC Lab Display) serta kelola state autentikasi PIN Admin.
3. **Dokumentasi**:
   - Perbarui `README.md` untuk mendokumentasikan cara mengakses **Interface PC Lab** (`http://localhost:8080/`) dan **Interface Admin** (`http://localhost:8080/admin`), cara kerja sinkronisasi WebSocket, serta daftar endpoint REST/WebSocket yang baru.

---

## 7. KriteriaKeberhasilan (Acceptance Criteria)
- [ ] Membuka `http://localhost:8080/` (atau `/lab`) menampilkan **Interface PC Lab** yang bersih, tanpa tombol kustomisasi dan tanpa tombol Start/Stop.
- [ ] Membuka `http://localhost:8080/admin` menampilkan **Interface Admin** dengan kontrol penuh untuk menjalankan/menghentikan deteksi serta mengubah durasi toleransi *Rolling Window* dari jarak jauh.
- [ ] Saat Admin menekan **Start** di `/admin`, mikrofon di PC Lab (`/`) langsung aktif mendeteksi suara dan mengirimkan hasil analisis WKNN secara *real-time* ke kedua layar.
- [ ] Saat Admin mengubah waktu toleransi (misal dari `10 Detik` ke `4 Detik`), target pada **Bilah Akumulasi Bising** di layar PC Lab dan layar Admin langsung berubah seketika tanpa *refresh*.
- [ ] Saat kebisingan konsisten mencapai batas toleransi, alarm 3 detik berbunyi di PC Lab dan indikator `PERINGATAN: BERISIK` menyala serentak di layar PC Lab maupun layar Admin.
- [ ] Saat Admin menekan **Stop** di `/admin`, PC Lab langsung berhenti merekam dan status kembali ke `STANDBY` di kedua layar.
- [ ] Aplikasi bebas error TypeScript/Python, proses `npm run build` berjalan mulus, dan 100% mematuhi aturan visual (font Poppins, kanvas `#FFFFFF`, warna Teal/Rose, nol emoji).