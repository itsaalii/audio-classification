# Business Understanding

## 1. Latar Belakang
Laboratorium Teknik Informatika merupakan fasilitas akademik sentral di lingkungan perguruan tinggi yang difungsikan untuk berbagai aktivitas komputasi intensif, mulai dari kegiatan praktikum pemrograman, simulasi jaringan, riset kecerdasan buatan, pengerjaan proyek sains data dan skripsi, hingga pelaksanaan ujian kompetensi mahasiswa. Seluruh kegiatan rekayasa perangkat lunak dan analisis data ini menuntut konsentrasi kognitif yang tinggi (*deep work* and *focused thinking*).

Namun, dinamika aktivitas di dalam laboratorium sering kali menimbulkan gangguan kenyamanan akustik:
- **Kegaduhan Antar-Mahasiswa:** Obrolan bersuara keras di luar topik praktikum, diskusi kelompok yang tidak terkontrol, atau percakapan telepon seluler.
- **Keributan Aktivitas Fisik:** Gesekan roda kursi laboratorium pada lantai, ketukan keras di meja, suara pintu laboratorium yang ditutup dengan keras, maupun tawa terbahak-bahak saat jeda praktikum.
- **Penggunaan Perangkat Suara:** Pemutaran video materi atau musik tanpa menggunakan *headphone* yang mengganggu rekan mahasiswa di sekitarnya.

Kondisi bising yang tidak tertib ini mengganggu fokus belajar mahasiswa lain, memecah konsentrasi asisten laboratorium yang sedang mendemonstrasikan modul praktikum, serta menurunkan produktivitas pengerjaan tugas di dalam lab.

### Pengawasan Konvensional & Keterbatasannya
Secara konvensional, penertiban suasana di dalam Laboratorium Teknik Informatika mengandalkan teguran manual oleh Asisten Laboratorium (Aslab) atau Dosen Pengampu. Namun, pendekatan ini memiliki keterbatasan nyata:
1. **Beban Ganda Asisten Lab:** Aslab harus membagi konsentrasi antara membimbing mahasiswa menyelesaikan eror *koding* dan mengawasi kebisingan ruangan.
2. **Subjektif & Enggan Menegur:** Persepsi kebisingan setiap orang berbeda, dan ada kalanya aslab merasa sungkan untuk menegur rekan mahasiswa secara berulang-ulang.
3. **Pengawasan Tidak Kontinu:** Saat aslab sedang fokus mendampingi satu mahasiswa di sudut ruangan, kegaduhan di sudut lain sering kali luput dari perhatian.

### Pengambilan Data & Sasaran Implementasi di Laboratorium
Menyadari urgensi tersebut, proyek ini diinisiasi dengan fokus studi kasus langsung pada **Laboratorium Teknik Informatika**:
- **Sumber Sampel Data Pelatihan:** Seluruh sampel audio mentah untuk pelatihan dan pengujian model—baik kelas **Berisik (*Noisy*)** maupun kelas **Non-Berisik (*Clean/Quiet*)**—direkam secara langsung di dalam lingkungan **Laboratorium Teknik Informatika**. Sampel suara mencakup rekaman nyata saat sesi praktikum berlangsung gaduh, obrolan ramai mahasiswa, gesekan kursi lab, versus suasana hening saat mahasiswa fokus *coding*, ujian praktikum, atau hembusan pendingin ruangan (*AC*) dan dengung komputer lab pada batas normal.
- **Lingkungan Implementasi:** Model *Machine Learning* yang dihasilkan dirancang khusus untuk **diimplementasikan dan di-deploy secara nyata di dalam Laboratorium Teknik Informatika**. Sistem bertindak sebagai "asisten pemantau akustik cerdas" yang mendengarkan suara ruangan via mikrofon komputer lab secara *real-time* (jendela 4 detik), mengklasifikasikan tingkat kebisingan, serta memicu notifikasi visual dan alarm suara seketika jika ruangan lab dinilai sudah melewati batas ambang ketenangan.

---

## 2. Rumusan Masalah
Berdasarkan latar belakang operasional di Laboratorium Teknik Informatika tersebut, rumusan masalah utama dalam proyek ini dirumuskan sebagai berikut:
1. **Representasi Fitur Akustik Lab:** Bagaimana mengekstraksi parameter numerik yang paling representatif dari sinyal audio mikrofon laboratorium untuk membedakan secara akurat antara suara kegaduhan mahasiswa (*babble noise*, tawa, gesekan kursi) dengan suara hening operasional lab (*typing*, dengung CPU/AC)?
2. **Eliminasi Jeda Hening pada Rekaman:** Bagaimana memastikan potongan rekaman berisik dari lab tidak terkontaminasi oleh jeda hening sesaat (*silence trimming*) agar model tidak salah mengartikan suasana hening sebagai kondisi bising?
3. **Pemilihan & Penalaan Model Terbaik:** Algoritma klasifikasi apa yang memberikan akurasi tertinggi, tingkat alarm palsu terendah (*false positive* minimal), dan konsistensi terbaik saat diuji pada data akustik Laboratorium Teknik Informatika?
4. **Kinerja Real-Time & Efisiensi Perangkat Lab:** Bagaimana membangun sistem deteksi mikrofon yang memiliki latensi inferensi sangat cepat (< 5 ms) agar dapat berjalan mulus di komputer laboratorium tanpa mengganggu kinerja aplikasi pemrograman lainnya?
5. **Aksesibilitas Antarmuka bagi Pengelola Lab:** Bagaimana merancang antarmuka sistem (aplikasi web Streamlit dan terminal CLI) yang informatif dan mudah digunakan oleh asisten laboratorium untuk memantau histori kebisingan ruangan?

---

## 3. Tujuan Proyek
Tujuan yang dicapai melalui proyek sains data ini meliputi:
- **Pengumpulan & Pra-pemrosesan Data Audio Nyata Lab:** Mengumpulkan 200 rekaman audio langsung dari Laboratorium Teknik Informatika dan memprosesnya menggunakan *Sliding Window* 4 detik (overlap 75%) serta *Silence Trimming* ($\text{RMS} \ge 0.015$), menghasilkan **5.286 baris segmen fitur audio nyata**.
- **Ekstraksi 16 Parameter Akustik PSD:** Mengekstraksi fitur komprehensif dari ranah waktu (RMS, ZCR), ranah frekuensi (Spectral Centroid), dan ranah psikoakustik Mel (MFCC 1–13) pada laju sampling standar $22.050\text{ Hz}$.
- **Eksperimen Komparatif 12 Algoritma Klasifikasi:** Melatih dan membandingkan 12 model Machine Learning (KNN, Random Forest, SVM, MLP Neural Network, dll.) menggunakan 5-Fold Stratified Cross Validation.
- **Optimalisasi Model WKNN:** Menghasilkan model terbaik berbasis **Weighted K-Nearest Neighbors / WKNN ($K=4$, distance weights, RobustScaler)** dengan akurasi data uji mencapai **97.64%** dan presisi kelas berisik **98.60%**.
- **Deployment Nyata di Laboratorium Teknik Informatika:** Mengimplementasikan model ke dalam sistem pemantauan berbasis skrip terminal ([`live_audio_detect.py`](../../data/klasifikasi-audio/live_audio_detect.py)) dan aplikasi web interaktif ([`app.py`](../../data/klasifikasi-audio/app.py)) yang siap dipasang pada komputer pengawas di dalam laboratorium.

---

## 4. Manfaat Proyek
Penerapan sistem ini di Laboratorium Teknik Informatika memberikan manfaat konkret bagi berbagai pihak:

### A. Bagi Asisten Laboratorium (Aslab) & Dosen Pengampu
- **Membantu Penertiban Ruangan Secara Objektif:** Asisten lab tidak perlu lagi merasa sungkan saat menegur mahasiswa, karena peringatan didasarkan pada deteksi data objektif dari sistem.
- **Fokus Bimbingan Tidak Terpecah:** Aslab dapat mencurahkan 100% perhatian untuk menjelaskan materi atau membimbing mahasiswa dalam sesi *hands-on coding*.
- **Peringatan Dini Otomatis:** Alarm bip seketika dan kartu notifikasi merah mengingatkan mahasiswa secara otomatis untuk segera mengecilkan suara ketika kebisingan mulai meningkat.

### B. Bagi Mahasiswa Praktikan Teknik Informatika
- **Lingkungan Belajar yang Kondusif:** Suasana lab yang tenang mendukung konsentrasi tinggi saat menelusuri eror (*debugging*), memahami algoritma yang kompleks, atau menulis kode program.
- **Keadilan Suasana Ujian:** Memastikan tidak ada kegaduhan atau interaksi suara mencurigakan saat ujian praktikum berlangsung.

### C. Bagi Pengelola Laboratorium & Jurusan Teknik Informatika
- **Audit Disiplin Akustik Lab:** Fitur ekspor log riwayat deteksi ke berkas CSV memungkinkan kepala laboratorium mengevaluasi grafik kedisiplinan dan jam-jam rawan terjadinya kebisingan di setiap sesi praktikum.
- **Modernisasi Fasilitas Lab Berbasis AI:** Menjadi bukti nyata penerapan teknologi Sains Data dan *Machine Learning* karya mahasiswa yang diterapkan langsung untuk menyelesaikan masalah di lingkungan kampusnya sendiri (*campus smart lab*).

---

## 5. Kriteria Keberhasilan (Success Criteria)

### A. Kriteria Keberhasilan Teknis (Technical Criteria)
1. **Akurasi Uji Tinggi ($\ge 95\%$):** Model mampu mengenali kondisi bising dan hening di laboratorium dengan akurasi uji minimal 95.0% (Tercapai: **97.64%**).
2. **Minim Alarm Palsu di Dalam Lab (Presisi $\ge 97\%$):** Sistem tidak boleh sering membunyikan alarm saat lab sedang tenang (False Alarm $\le 3\%$) agar tidak mengagetkan mahasiswa yang sedang berkonsentrasi (Tercapai: **98.60%**, false alarm hanya $1.28\%$).
3. **Latensi Inferensi Ultra-Rendah ($< 50\text{ ms}$):** Waktu komputasi ekstraksi fitur dan inferensi KNN per jendela 4 detik berlangsung di bawah 50 milidetik sehingga CPU komputer laboratorium tetap dingin dan ringan (Tercapai: **$< 5\text{ ms}$**).

### B. Kriteria Keberhasilan Operasional Laboratorium (Operational Criteria)
1. **Pemantauan Mikrofon Berkelanjutan:** Sistem dapat berjalan terus-menerus selama sesi praktikum (2 hingga 4 jam) tanpa mengalami *crash* atau *memory leak*.
2. **Umpan Balik Cepat & Tegas:** Sistem langsung membunyikan alarm bip peringatan saat kebisingan lab terdeteksi berturut-turut serta menampilkan akumulasi durasi berisik pada dasbor.
3. **Kemudahan Akses & Fleksibilitas:** Aplikasi dapat diakses dengan mudah oleh asisten lab melalui peramban web lokal di alamat `http://localhost:8501`.
