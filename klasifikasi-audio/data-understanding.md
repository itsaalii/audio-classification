# Data Understanding

## 1. Sumber Data & Struktur Dataset Mentah
Dataset yang digunakan dalam proyek ini terdiri atas sekumpulan rekaman audio digital dalam format kompresi MP3 mono yang merekam berbagai kondisi akustik nyata langsung di dalam **Laboratorium Teknik Informatika**. Seluruh rekaman mentah dihimpun ke dalam dua berkas arsip terkompresi utama:
- **`berisik.zip`:** Berisi 100 berkas audio rekaman berlabel **Berisik (*Noisy*)** (Label numerik: `1`).
- **`non-berisik.zip`:** Berisi 100 berkas audio rekaman berlabel **Non-Berisik (*Clean/Quiet*)** (Label numerik: `0`).

Setiap berkas rekaman memiliki durasi sekitar **30 detik**, menghasilkan total durasi audio mentah sekitar **100 menit** (6.000 detik) rekaman audio lingkungan laboratorium.

### Variasi Karakteristik Audio Mentah di Laboratorium
Kedua kelas audio merepresentasikan kondisi realistis yang terjadi sehari-hari di Laboratorium Teknik Informatika:
1. **Kelas Berisik (`label = 1`):**
   - Obrolan ramai dan diskusi keras mahasiswa saat praktikum atau pergantian sesi lab.
   - Suara tawa keras atau candaan mahasiswa di sela-sela praktikum.
   - Keributan gesekan roda kursi laboratorium pada lantai serta hentakan kaki.
   - Suara pintu laboratorium yang dibuka-tutup secara kasar atau berulang-ulang.
   - Suara panggilan telepon seluler atau deringan notifikasi gawai bervolume tinggi.
   - Suara pemutaran video/musik dari laptop mahasiswa tanpa menggunakan penyuara telinga (*headset*).
2. **Kelas Non-Berisik (`label = 0`):**
   - Suasana hening dan tertib saat mahasiswa berkonsentrasi mengetik kode program (*coding/debugging*).
   - Suasana tenang saat pelaksanaan kuis atau ujian kompetensi praktikum.
   - Bunyi ketukan kibor (*keyboard typing*) dan klik tetikus (*mouse*) dalam batas wajar.
   - Hembusan pendingin ruangan (*AC*) dan dengung kipas prosesor server/PC lab dalam batas desibel normal.
   - Percakapan atau bisikan pelan sesaat yang tidak mengganggu ketenangan ruangan.

---

## 2. Digitalisasi Sinyal & Teorema Nyquist-Shannon
Sebelum dapat diproses oleh algoritma komputasi, gelombang akustik kontinu (analog) harus dikonversi ke dalam deret data diskrit temporal melalui proses digitalisasi. Pustaka audio standar Python `librosa` digunakan untuk memuat setiap berkas audio secara *single channel* (mono).

### A. Frekuensi Sampling ($f_s = 22.050\text{ Hz}$)
Seluruh sinyal audio di-resample secara seragam pada frekuensi sampling:
$$f_s = 22.050\text{ Hz}$$
Artinya, setiap 1 detik durasi audio diwakili oleh $22.050$ titik data amplitudo sinyal diskrit.

### B. Validasi Teorema Nyquist-Shannon
Menurut **Teorema Sampling Nyquist-Shannon**, agar sinyal analog dapat direkonstruksi secara sempurna ke bentuk digital tanpa mengalami distorsi frekuensi (*aliasing*), frekuensi sampling minimal harus dua kali lipat lebih besar dari frekuensi tertinggi yang dikandung oleh sinyal:
$$f_{\text{Nyquist}} = \frac{f_s}{2} = \frac{22.050\text{ Hz}}{2} = 11.025\text{ Hz}$$

Pilihan laju sampling $22.050\text{ Hz}$ sangat tepat dan optimal secara ilmiah:
- Frekuensi fundamental suara manusia berkisar antara $85\text{ Hz}$ hingga $255\text{ Hz}$, dengan frekuensi formant vokal mencapai $\approx 3.500\text{ Hz}$.
- Komponen desisan frikatif, gesekan benda, dan kebisingan akustik lingkungan umumnya terkonsentrasi pada rentang $500\text{ Hz} - 8.000\text{ Hz}$.
- Rentang batas Nyquist $11.025\text{ Hz}$ telah mencakup seluruh komponen energi penting kebisingan manusia dan mesin secara utuh, sekaligus menghemat beban memori komputasi sebesar $\approx 50\%$ dibandingkan laju sampling audio CD standar ($44.100\text{ Hz}$).

---

## 3. Ekstraksi 16 Fitur Akustik Pengolahan Sinyal Digital (PSD)
Dari setiap potongan jendela audio **4.0 detik** ($N = f_s \times 4 = 88.200\text{ sampel}$), diekstraksi **16 parameter akustik representatif** yang mencakup tiga domain pengolahan sinyal digital:

```text
+---------------------------------------------------------------------------------------+
|                       16 FITUR AKUSTIK PENGOLAHAN SINYAL DIGITAL                      |
+--------------------------+-----------------------------+------------------------------+
|   1. RANAH WAKTU         |   2. RANAH FREKUENSI        |   3. RANAH PSIKOAKUSTIK MEL  |
|   (Time Domain)          |   (Frequency Domain)        |   (Mel-Frequency Cepstral)   |
+--------------------------+-----------------------------+------------------------------+
| - RMS Energy (1)         | - Spectral Centroid (1)     | - MFCC 1  (Kontur Energi)    |
| - Zero Crossing Rate (1) |                             | - MFCC 2–13 (Timbre Spektral)|
| Total: 2 Fitur           | Total: 1 Fitur              | Total: 13 Fitur              |
+--------------------------+-----------------------------+------------------------------+
|                            TOTAL KESELURUHAN: 16 FITUR                                |
+---------------------------------------------------------------------------------------+
```

### A. Ranah Waktu (Time Domain)

#### 1. Root Mean Square (RMS) Energy
RMS mengukur daya fisik rata-rata dan intensitas magnitudo energi gelombang suara pada jendela waktu tertentu:
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^{N} |x[n]|^2}$$

Di mana:
- $N$ adalah jumlah sampel audio per segmen ($88.200$ sampel).
- $x[n]$ adalah nilai amplitudo sinyal diskrit pada sampel ke-$n$.

*Interpretasi Fisis:* Suara gaduh/bising (seperti teriakan, knalpot, dentuman) memiliki lonjakan energi fisik yang menghasilkan nilai RMS jauh lebih tinggi ($0.05 - 0.25$) dibandingkan kondisi ruangan tenang ($0.001 - 0.015$).

#### 2. Zero Crossing Rate (ZCR)
ZCR mengukur laju seberapa sering gelombang sinyal audio melintasi garis sumbu horizontal nol (pergantian tanda dari positif ke negatif atau sebaliknya) per satuan waktu:
$$\text{ZCR} = \frac{1}{2N} \sum_{n=1}^{N-1} |\text{sgn}(x[n]) - \text{sgn}(x[n-1])|$$

Di mana fungsi tanda $\text{sgn}(u)$ bernilai:
$$\text{sgn}(u) = \begin{cases} 1, & u \ge 0 \\ -1, & u < 0 \end{cases}$$

*Interpretasi Fisis:* ZCR yang tinggi mengindikasikan dominasi derau acak frekuensi tinggi tanpa pola harmonik teratur (*hissing*, gesekan permukaan meja, desisan angin, atau suara kipas angin berputar cepat).

---

### B. Ranah Frekuensi (Frequency Domain)

#### 3. Spectral Centroid (Hz)
Spectral Centroid menunjukkan titik berat (*center of gravity*) atau pusat massa frekuensi dari spektrum daya audio. Fitur ini dihitung melalui transformasi Fourier (STFT):
$$f_c = \frac{\sum_{k=0}^{K-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{K-1} |X[k]|}$$

Di mana:
- $f[k]$ adalah frekuensi pusat pada bin frekuensi ke-$k$.
- $|X[k]|$ adalah magnitudo spektrum hasil transformasi Fourier pada bin ke-$k$.
- $K$ adalah jumlah total bin frekuensi.

*Interpretasi Fisis:* Spectral Centroid merepresentasikan tingkat "kecerahan" (*brightness*) dan ketajaman suara. Suara bising berfrekuensi tinggi (gesekan logam, decitan, vokal teriak) memiliki Centroid tinggi ($> 2.000\text{ Hz}$), sedangkan suara ruangan tenang atau dengung rendah memiliki Centroid jauh lebih rendah ($< 1.200\text{ Hz}$).

---

### C. Ranah Psikoakustik Mel (Mel-Frequency Cepstral Coefficients / MFCC)

#### 4–16. Koefisien MFCC 1 hingga 13
Telinga manusia tidak merespons frekuensi secara linear, melainkan secara logaritmik—telinga jauh lebih peka membedakan perubahan nada pada frekuensi rendah ($< 1.000\text{ Hz}$) dibandingkan pada frekuensi tinggi. Oleh karena itu, MFCC menggunakan pemetaan ke **Skala Mel**:
$$m = 2595 \log_{10}\left(1 + \frac{f}{700}\right)$$

Tahapan komputasi 13 koefisien MFCC mencakup:
1. Menghitung magnitudo spektrum daya melalui *Short-Time Fourier Transform* (STFT).
2. Memetakan spektrum daya ke dalam bank filter segitiga Mel (*Mel-filterbank*).
3. Mengambil nilai logaritma dari energi pada masing-masing pita filter Mel.
4. Mendekorasikan korelasi energi antar-filter menggunakan *Discrete Cosine Transform* (DCT):
   $$c_n = \sum_{m=1}^{M} \log(S_m) \cos\left( \frac{\pi n (m - 0.5)}{M} \right), \quad n = 1, 2, \dots, 13$$
5. Menghitung rata-rata nilai koefisien pada jendela 4 detik untuk memperoleh vektor statis 13 dimensi.

*Interpretasi Fisis Tiap Koefisien:*
- **MFCC 1:** Menggambarkan kontur selubung daya energi keseluruhan sinyal suara (*overall acoustic energy level*).
- **MFCC 2–13:** Merepresentasikan bentuk selubung spektral (*spectral envelope*) dan warna suara unik (*timbre*). Koefisien ini menjadi pembeda utama antara suara vokal manusia, dengungan motor, deru knalpot, hembusan AC, atau ketukan instrumen.

---

## 4. Karakteristik Dataset Fitur (`audio_features_4s.csv`)
Setelah seluruh berkas MP3 diekstraksi melalui proses segmentasi jendela geser 4.0 detik dan pergeseran hop 1.0 detik, dataset disimpan dalam format tabular CSV ([`audio_features_4s.csv`](../../data/klasifikasi-audio/audio_features_4s.csv)).

```text
Struktur Matriks Data: 5.286 Baris x 20 Kolom
├── Kolom Meta: segment_idx, file_name, label_name, label (4 kolom)
└── Kolom Fitur Akustik: rms, spectral_centroid, zcr, mfcc_1 s/d mfcc_13 (16 kolom)
```

### Proporsi Distribusi Kelas
Dataset hasil segmentasi memiliki keseimbangan kelas (*class balance*) yang sangat ideal:
- **Kelas Non-Berisik (`label = 0`):** **2.732 segmen** ($51.68\%$)
- **Kelas Berisik (`label = 1`):** **2.554 segmen** ($48.32\%$)
- **Total Keseluruhan:** **5.286 segmen audio nyata**

Keseimbangan proporsi ini memastikan bahwa model tidak akan mengalami bias prediktif (*majority class bias*) selama proses pelatihan.

---

## 5. Analisis Data Eksploratif (EDA) & Distribusi Fitur
Berdasarkan analisis statistik pada `train.ipynb`, ditemukan pemisahan distribusi (*separability*) yang sangat jelas antara kelas Berisik dan Non-Berisik pada fitur-fitur utama:

| Parameter Fitur | Kategori | Rata-Rata (*Mean*) | Standar Deviasi (*Std*) | Rentang Nilai (Min – Max) |
|---|---|---|---|---|
| **RMS Energy** | Non-Berisik (0)<br>Berisik (1) | **0.0078**<br>**0.0924** | 0.0062<br>0.0618 | 0.0001 – 0.0482<br>0.0150 – 0.4421 |
| **Spectral Centroid (Hz)** | Non-Berisik (0)<br>Berisik (1) | **1.245,6 Hz**<br>**2.188,4 Hz** | 412,8 Hz<br>684,2 Hz | 312,4 – 3.240,1 Hz<br>645,8 – 5.820,6 Hz |
| **Zero Crossing Rate** | Non-Berisik (0)<br>Berisik (1) | **0.0481**<br>**0.0986** | 0.0245<br>0.0412 | 0.0084 – 0.1782<br>0.0215 – 0.3814 |
| **MFCC 1 (Energi)** | Non-Berisik (0)<br>Berisik (1) | **-284.12**<br>**-92.45** | 68.45<br>42.18 | -480.12 s/d -140.21<br>-180.34 s/d 12.45 |

### Wawasan (*Insights*) Penting dari EDA:
1. **Daya Pemisah RMS yang Sangat Kuat:** Rata-rata RMS pada kondisi berisik ($0.0924$) bernilai hampir **12 kali lipat lebih tinggi** dibandingkan kondisi non-berisik ($0.0078$). Fitur ini menjadi pemisah utama pada tingkat energi sinyal dasar.
2. **Pergeseran Spektrum Frekuensi Tinggi pada Kebisingan:** Rata-rata Spectral Centroid kelas berisik melompat ke angka $2.188,4\text{ Hz}$, menandakan adanya konsentrasi energi pada frekuensi yang lebih tajam dan bising, sedangkan suara hening terpusat pada frekuensi rendah ($1.245,6\text{ Hz}$).
3. **Peningkatan Densitas Pelintasan Nol (ZCR):** Nilai ZCR pada kelas berisik berlipat ganda, mengonfirmasi keberadaan desisan dan fluktuasi acak non-periodik dari derau lingkungan sekitar.
4. **Alasan Memilih 16 Fitur (Menghindari *Curse of Dimensionality*):** Eksperimen pada *notebook* menunjukkan bahwa mengekstraksi 16 fitur esensial ini jauh lebih akurat dan stabil dibandingkan mengekstrak 51+ fitur berlebih (seperti *spectral roll-off*, *spectral contrast*, *chroma*, dll.) yang justru menurunkan akurasi akibat redundansi informasi dan korelasi multikolinearitas yang tinggi.
