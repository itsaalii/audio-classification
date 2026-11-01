# Business Understanding

Dokumentasi fase pertama metodologi **CRISP-DM (Cross-Industry Standard Process for Data Mining)** untuk proyek sistem klasifikasi dan deteksi kebisingan audio digital secara *real-time* berbasis **Weighted K-Nearest Neighbors (WKNN 4s)**.

---

## 1. Latar Belakang

Laboratorium Teknik Informatika merupakan fasilitas akademik sentral di lingkungan perguruan tinggi yang difungsikan untuk berbagai aktivitas komputasi intensif, mulai dari kegiatan praktikum pemrograman, simulasi jaringan komputer, riset kecerdasan buatan, pengerjaan tugas akhir dan proyek sains data, hingga pelaksanaan ujian kompetensi praktikum mahasiswa. Seluruh kegiatan rekayasa perangkat lunak dan analisis data ini menuntut konsentrasi kognitif yang tinggi (*deep work* and *focused thinking*).

Namun, dinamika aktivitas di dalam laboratorium sering kali menimbulkan gangguan kenyamanan akustik yang signifikan:
- **Kegaduhan Percakapan Antar-Mahasiswa:** Obrolan bersuara keras di luar topik praktikum, diskusi kelompok yang tidak terkontrol, serta panggilan telepon seluler di dalam ruangan.
- **Keributan Aktivitas Fisik:** Gesekan roda kursi laboratorium pada lantai, ketukan meja, suara hentakan kaki, maupun suara pintu laboratorium yang ditutup secara keras.
- **Penggunaan Perangkat Multimedia Tanpa Filter:** Pemutaran video tutorial atau materi praktikum tanpa penyuara telinga (*headphone*) yang mengganggu mahasiswa di sekitarnya.

Kondisi bising ini menurunkan daya serap materi praktikum, memecah fokus asisten laboratorium yang sedang mendemonstrasikan kode program, serta menurunkan produktivitas akademik secara keseluruhan.

### Keterbatasan Pengawasan Konvensional
Secara konvensional, penertiban suasana di dalam laboratorium mengandalkan teguran manual oleh Asisten Laboratorium (Aslab) atau Dosen Pengampu. Pendekatan ini memiliki sejumlah kelemahan operasional:
1. **Beban Kognitif Ganda Asisten Lab:** Aslab harus membagi perhatian antara membimbing mahasiswa mengatasi *bug/error* pemrograman dengan memantau tingkat kegaduhan ruangan.
2. **Subjektivitas & Keengganan Menegur:** Persepsi kebisingan setiap individu berbeda-beda, dan asisten lab kerap merasa sungkan untuk menegur rekan sesama mahasiswa secara berulang kali.
3. **Pengawasan yang Terfragmentasi:** Ketika asisten lab sedang fokus membantu mahasiswa di satu sisi ruangan, kegaduhan di sisi lain kerap luput dari pemantauan.

### Pengambilan Data & Sasaran Implementasi
Proyek ini mengakar pada studi kasus nyata di **Laboratorium Teknik Informatika**:
- **Sumber Data Pelatihan Nyata:** Seluruh dataset rekaman audio mentah (100 berkas kelas **Berisik** dan 100 berkas kelas **Non-Berisik**) direkam secara langsung di dalam lingkungan Laboratorium Teknik Informatika. Data mencakup situasi riil sesi praktikum yang ramai, tawa mahasiswa, dan gesekan perabotan laboratorium versus suasana tenang saat mahasiswa fokus *coding*, ujian praktikum, serta dengung normal pendingin ruangan (*AC*) dan kipas server laboratorium.
- **Sasaran Implementasi Operasional:** Sistem diimplementasikan dalam bentuk aplikasi pemantauan audio cerdas (*smart acoustic monitor*) berbasis web modern (**FastAPI + React 19 + TypeScript + Docker**). Sistem menangkap sinyal mikrofon ruangan secara kontinu, mengekstrak 16 parameter akustik Pengolahan Sinyal Digital (PSD), mengevaluasi persistensi kebisingan melalui model **Toleransi Bergerak (*Rolling Window*)**, dan membunyikan alarm **beep panjang kontinu** secara otomatis ketika kebisingan konsisten melampaui batas toleransi yang ditetapkan.

---

## 2. Rumusan Masalah

Berdasarkan analisis kebutuhan operasional di Laboratorium Teknik Informatika, rumusan masalah utama proyek ini adalah:
1. **Ekstraksi Fitur Akustik Representatif:** Bagaimana mengekstraksi representasi numerik yang paling diskriminatif dari sinyal mikrofon lab untuk membedakan suara keributan mahasiswa (*babble noise*, gesekan kursi) dari suara hening operasional lab (*keyboard typing*, dengung kipas PC)?
2. **Eliminasi Kontaminasi Jeda Hening:** Bagaimana membersihkan rekaman mentah kelas berisik dari jeda hening sesaat (*silence trimming*) agar model tidak salah mengaitkan suasana tenang sebagai kondisi bising?
3. **Seleksi Model Klasifikasi Optimal:** Algoritma *Machine Learning* apa yang menghasilkan akurasi tertinggi, stabilitas generalisasi terbaik, serta tingkat alarm palsu (*false positive*) terendah saat diuji pada data akustik laboratorium?
4. **Kinerja Inferensi Latensi Rendah (*Real-Time*):** Bagaimana merancang arsitektur komputasi backend yang mampu melakukan ekstraksi fitur dan klasifikasi dalam waktu < 15 milidetik per jendela 4 detik agar mikrofon tidak mengalami *lag* atau jeda terputus?
5. **Mitigasi Alarm Palsu Akibat Noise Sesaat:** Bagaimana merancang logika evaluasi waktu yang kebal terhadap suara keras sesaat (seperti pintu terbanting atau batuk 1–2 detik), sehingga alarm hanya terpicu jika kebisingan terjadi secara konsisten?
6. **Aksesibilitas & Pengemasan Produksi:** Bagaimana mengemas sistem ke dalam antarmuka web modern yang responsif, visual, bebas dependensi rumit, dan dapat dijalankan secara portabel menggunakan teknologi kontainerisasi Docker?

---

## 3. Tujuan Proyek

Tujuan yang dicapai melalui proyek sains data ini adalah:
1. **Akuisisi & Kurasi Dataset Akustik Laboratorium:** Menghimpun 200 rekaman audio langsung dari Laboratorium Teknik Informatika dan memprosesnya dengan segmentasi jendela luncur 4.0 detik (*hop* 1.0 detik / *overlap* 75%) serta *silence trimming* ($\text{RMS} \ge 0.015$), menghasilkan **5.286 segmen data audio nyata** yang seimbang.
2. **Ekstraksi 16 Parameter Akustik PSD:** Mengekstraksi fitur komprehensif ranah waktu (RMS, ZCR), ranah frekuensi (Spectral Centroid), dan ranah persepsi Mel (MFCC 1–13) pada laju sampling standar $22.050\text{ Hz}$.
3. **Eksperimen Komparatif 12 Algoritma Machine Learning:** Menguji 12 algoritma klasifikasi (WKNN, Baseline KNN, MLP Neural Network, Extra Trees, Random Forest, Decision Tree, SVM RBF, Gradient Boosting, AdaBoost, SVM Linear, Logistic Regression, Gaussian Naive Bayes) menggunakan 5-Fold Stratified Cross Validation.
4. **Optimalisasi Model Terbaik:** Menetapkan model **Weighted K-Nearest Neighbors (WKNN $K=4$, distance weights, RobustScaler)** yang mencapai **Akurasi Uji 97.64%** dan **Presisi Kelas Berisik 98.60%**.
5. **Penerapan Logika Kebisingan Konsisten (*Rolling Window*):** Mengembangkan sistem toleransi bergerak dengan pilihan durasi (*Real-Time*, 4s, 5s, 10s, 15s, 20s, 30s) dengan ambang batas bising $\ge 80\%$ untuk mencegah alarm palsu akibat suara berdurasi singkat.
6. **Sintesis Audio Beep Panjang Kontinu:** Mengembangkan utilitas Web Audio API yang menghasilkan nada beep sinus 880 Hz kontinu tanpa jeda putus-putus, berdurasi bawaan 3 detik, dapat dikustomisasi (1s–5s), serta dilengkapi menu penonaktifan (*mute*).
7. **Penyebaran (*Deployment*) Full-Stack Berbasis Docker:** Membangun antarmuka produksi berbasis **FastAPI (Backend REST API)** dan **React 19 + TypeScript + Vite + Tailwind CSS (Frontend SPA)** yang dikemas ke dalam *multi-stage Docker build* pada port `8080`.

---

## 4. Manfaat Proyek

Penerapan AcoustiKNN Studio memberikan manfaat nyata bagi operasional akademik:

### A. Bagi Asisten Laboratorium & Dosen Pengampu
- **Penertiban Ruangan yang Objektif:** Peringatan kebisingan didasarkan pada data kuantitatif model sains data, bukan penilaian subjektif perseorangan.
- **Konsentrasi Pengajaran Terjaga:** Asisten lab dapat memfokuskan tenaga untuk menjelaskan materi dan membimbing sesi pemrograman mahasiswa tanpa terpecah oleh pengawasan suara ruangan.
- **Peringatan Otomatis Seketika:** Sistem memberikan peringatan visual dan nada beep panjang secara otomatis saat ruangan terdeteksi bising secara konsisten.

### B. Bagi Mahasiswa Praktikan
- **Lingkungan Belajar yang Kondusif:** Suasana laboratorium yang tertib mendukung konsentrasi tinggi saat merancang algoritma, membaca dokumentasi, dan menelusuri *error* kode (*debugging*).
- **Integritas Suasana Ujian:** Memastikan tidak ada interaksi suara gaduh yang mencurigakan saat ujian praktikum berlangsung.

### C. Bagi Pengelola Laboratorium & Jurusan
- **Audit Disiplin Akustik:** Fitur pencatatan sesi dan ekspor riwayat ke berkas CSV memungkinkan evaluasi tren kebisingan pada setiap jadwal praktikum.
- **Implementasi Nyata Kecerdasan Buatan di Kampus:** Menjadi bukti aplikasi sains data terapan yang dirancang, dilatih, dan diterapkan langsung untuk memecahkan permasalahan di lingkungan perguruan tinggi (*smart campus lab*).

---

## 5. Kriteria Keberhasilan (Success Criteria)

### A. Kriteria Keberhasilan Teknis (Technical Criteria)
1. **Akurasi Data Uji $\ge 95.0\%$:** Model mampu mengklasifikasikan kondisi bising dan non-berisik dengan akurasi minimal 95% (Tercapai: **97.64%**).
2. **Presisi Kelas Berisik $\ge 97.0\%$:** Menghindari alarm palsu (*False Positive Rate* $\le 3.0\%$) agar mahasiswa tidak terganggu oleh alarm yang salah (Tercapai: **98.60%**, alarm palsu hanya $1.28\%$).
3. **Latensi Inferensi Ultra-Rendah ($< 50\text{ ms}$):** Proses decoding audio, ekstraksi 16 fitur, penskalaan, dan prediksi model berlangsung di bawah 50 ms (Tercapai: **8–15 ms** via FastAPI *In-Memory Singleton*).
4. **Stabilitas Validasi Silang:** Standar deviasi 5-Fold Cross Validation tidak melebihi $\pm 1.0\%$ (Tercapai: **$97.58\% \pm 0.58\%$**).

### B. Kriteria Keberhasilan Operasional (Operational Criteria)
1. **Pemantauan Mikrofon Berkelanjutan Tanpa Putus:** Sistem mampu berjalan berjam-jam tanpa mengalami *memory leak* atau penutupan mikrofon mandiri melalui pengelolaan *circular buffer* yang stabil.
2. **Kekebalan Suara Sesaat (*Transient Rejection*):** Sistem tidak membunyikan alarm jika suara bising hanya berlangsung 1–2 detik pada mode toleransi 10s–30s.
3. **Portabilitas & Kemudahan Deployment:** Aplikasi dapat dibangun dan dijalankan di berbagai sistem operasi hanya dengan satu perintah kontainer (`docker compose up --build`) pada port `8080`.
