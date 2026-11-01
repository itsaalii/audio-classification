# Data Understanding

Dokumentasi fase kedua metodologi **CRISP-DM (Cross-Industry Standard Process for Data Mining)** untuk analisis data akustik, digitalisasi sinyal, serta ekstraksi 16 parameter Pengolahan Sinyal Digital (PSD).

---

## 1. Sumber Data & Karakteristik Dataset Mentah

Dataset audio yang digunakan dalam proyek ini bersumber langsung dari perekaman kondisi akustik di **Laboratorium Teknik Informatika**. Seluruh sampel rekaman dikelompokkan ke dalam dua arsip berkas utama:
- **`berisik.zip`:** Memuat 100 berkas audio rekaman berlabel **Berisik (*Noisy*)** (Label numerik: `1`).
- **`non-berisik.zip`:** Memuat 100 berkas audio rekaman berlabel **Non-Berisik (*Clean/Quiet*)** (Label numerik: `0`).

Setiap berkas memiliki durasi rekaman rata-rata **30 detik**, menghasilkan total durasi audio mentah sekitar **100 menit (6.000 detik)**.

### Variasi Akustik di Lingkungan Laboratorium
Kedua kelas audio mencerminkan dinamika nyata sehari-hari di Laboratorium Teknik Informatika:
1. **Karakteristik Kelas Berisik (`label = 1`):**
   - Suara obrolan ramai dan diskusi keras mahasiswa saat praktikum atau pergantian sesi.
   - Suara tawa terbahak-bahak atau candaan saat jeda modul praktikum.
   - Keributan gesekan roda kursi laboratorium pada ubin lantai serta hentakan kaki.
   - Suara pintu laboratorium yang dibuka-tutup secara keras atau berulang.
   - Bunyi dering atau notifikasi telepon seluler bersuara keras.
   - Suara pemutaran musik/video dari laptop mahasiswa tanpa penyuara telinga (*headset*).
2. **Karakteristik Kelas Non-Berisik (`label = 0`):**
   - Suasana hening dan tertib saat mahasiswa fokus mengetik kode (*coding / debugging*).
   - Suasana tenang saat pelaksanaan kuis atau ujian kompetensi praktikum.
   - Bunyi ketukan kibor (*typing*) dan klik tetikus (*mouse*) dalam batas normal.
   - Suara hembusan pendingin ruangan (*AC*) dan dengung kipas prosesor server/PC lab dalam batas desibel wajar.
   - Percakapan atau bisikan lirih sesaat yang tidak mengganggu ketenangan ruangan.

---

## 2. Digitalisasi Sinyal & Teorema Nyquist-Shannon

Sebelum dapat diolah oleh algoritma machine learning, sinyal gelombang akustik analog kontinu harus diubah menjadi representasi diskrit temporal melalui proses digitalisasi.

### A. Frekuensi Sampling ($f_s = 22.050\text{ Hz}$)
Seluruh sinyal audio di-resample secara konsisten pada laju sampling:
$$f_s = 22.050\text{ Hz}$$
Artinya, setiap 1 detik durasi audio diwakili oleh $22.050$ titik data amplitudo sinyal diskrit float32 mono.

### B. Validasi Teorema Nyquist-Shannon
Berdasarkan **Teorema Sampling Nyquist-Shannon**, agar sinyal analog dapat direkonstruksi secara sempurna ke bentuk digital tanpa mengalami distorsi lipatan frekuensi (*aliasing*), frekuensi sampling minimal harus dua kali lipat lebih besar dari komponen frekuensi tertinggi yang dikandung oleh sinyal:
$$f_{\text{Nyquist}} = \frac{f_s}{2} = \frac{22.050\text{ Hz}}{2} = 11.025\text{ Hz}$$

Pilihan laju sampling $22.050\text{ Hz}$ sangat tepat dan efisien:
- Frekuensi fundamental suara manusia berkisar antara $85\text{ Hz} - 255\text{ Hz}$, dengan frekuensi formant vokal mencapai $\approx 3.500\text{ Hz}$.
- Komponen desisan frikatif, gesekan benda, dan kebisingan akustik lingkungan laboratorium umumnya terkonsentrasi pada rentang $500\text{ Hz} - 8.000\text{ Hz}$.
- Rentang Nyquist $11.025\text{ Hz}$ telah mencakup seluruh spektrum energi penting kebisingan manusia dan gesekan perabotan secara utuh, sekaligus menghemat beban memori komputasi sebesar $\approx 50\%$ dibandingkan laju audio CD standar ($44.100\text{ Hz}$).

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
RMS mengukur daya fisik rata-rata dan intensitas energi total sinyal pada jendela waktu 4 detik:
$$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^{N} |x[n]|^2}$$

Di mana:
- $N = 88.200$ sampel per segmen.
- $x[n]$ adalah nilai amplitudo sinyal diskrit pada sampel ke-$n$.

*Interpretasi Fisis:* Suara gaduh/bising di laboratorium (teriakan, tawa, gesekan kursi) memiliki lonjakan energi fisik yang menghasilkan nilai RMS jauh lebih tinggi ($0.05 - 0.25$) dibandingkan kondisi hening tertib ($0.001 - 0.015$).

#### 2. Zero Crossing Rate (ZCR)
ZCR mengukur laju seberapa sering gelombang sinyal audio melintasi sumbu horizontal nol (pergantian tanda amplitudo positif ke negatif atau sebaliknya):
$$\text{ZCR} = \frac{1}{2N} \sum_{n=1}^{N} |\text{sgn}(x[n]) - \text{sgn}(x[n-1])|$$

Di mana fungsi tanda $\text{sgn}(u)$ didefinisikan sebagai:
$$\text{sgn}(u) = \begin{cases} 1, & u \ge 0 \\ -1, & u < 0 \end{cases}$$

*Interpretasi Fisis:* ZCR yang tinggi mengindikasikan dominasi derau frekuensi tinggi tanpa pola harmonik teratur (*hissing*, gesekan permukaan meja, desisan angin, atau putaran kipas PC).

---

### B. Ranah Frekuensi (Frequency Domain)

#### 3. Spectral Centroid ($f_c$)
Spectral Centroid menunjukkan titik berat (*center of gravity*) atau pusat massa frekuensi dari spektrum daya audio yang diperoleh melalui transformasi Fourier (STFT):
$$f_c = \frac{\sum_{k=0}^{K-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{K-1} |X[k]|}$$

Di mana:
- $f[k]$ adalah frekuensi pusat pada bin frekuensi ke-$k$.
- $|X[k]|$ adalah magnitudo spektral hasil transformasi Fourier pada bin ke-$k$.
- $K$ adalah jumlah total bin frekuensi.

*Interpretasi Fisis:* Spectral Centroid mencerminkan tingkat "kecerahan" (*brightness*) dan ketajaman suara. Suara bising berfrekuensi tinggi (decitan kursi, suara tawa tinggi) memiliki Centroid tinggi ($> 2.000\text{ Hz}$), sedangkan suara ruangan hening atau dengung AC rendah memiliki Centroid jauh lebih rendah ($< 1.500\text{ Hz}$).

---

### C. Ranah Psikoakustik Mel (Mel-Frequency Cepstral Coefficients / MFCC)

Skala Mel memetakan frekuensi akustik fisik ($f$ dalam Hz) ke dalam skala persepsi auditori telinga manusia ($m$ dalam Mel):
$$m = 2595 \cdot \log_{10}\left(1 + \frac{f}{700}\right)$$

Setelah sinyal audio dilewatkan ke deretan bank filter Mel (*Mel filterbank*) dan dihitung logaritmanya, diterapkan Transformasi Kosinus Diskrit (*Discrete Cosine Transform* / DCT) untuk menghasilkan 13 koefisien MFCC:
$$C_k = \sum_{m=1}^{M} \log(S[m]) \cos\left( \frac{\pi \cdot k \cdot (m - 0.5)}{M} \right), \quad k \in [1, \dots, 13]$$

#### 4. MFCC 1 (`mfcc_1`) — Kontur Energi Spektral Utama
Koefisien pertama mewakili magnitudo selubung daya spektral keseluruhan pada skala Mel. Nilainya berkorelasi erat dengan kenyaringan suara secara persepsi auditori manusia.

#### 5–16. MFCC 2 hingga 13 (`mfcc_2` s/d `mfcc_13`) — Amplop Tekstur & Timbre
Koefisien ke-2 hingga ke-13 menangkap formasi puncak-lembah (*spectral envelope*) yang membedakan warna suara (*timbre*), seperti perbedaan antara suara vokal percakapan manusia, derau kipas angin, hentakan langkah kaki, dan gesekan perabotan lab.

---

## 4. Analisis Sebaran Data & Nilai Ambang Akustik

Pemeriksaan statistik terhadap berkas fitur hasil ekstraksi (`audio_features_4s.csv`, $5.286$ segmen) menghasilkan temuan penting:

| Parameter Fitur | Rata-rata Non-Berisik | Median Non-Berisik | Rata-rata Berisik | Median Berisik |
|---|:---:|:---:|:---:|:---:|
| **RMS Energy** | $0.0298$ | $0.0181$ | $0.0965$ | $0.0820$ |
| **Spectral Centroid (Hz)** | $1.643\text{ Hz}$ | $1.509\text{ Hz}$ | $1.854\text{ Hz}$ | $1.694\text{ Hz}$ |
| **Zero Crossing Rate (ZCR)**| $0.0768$ | $0.0694$ | $0.0911$ | $0.0858$ |

### Temuan Ambang Batas Mikrofon (*Acoustic Threshold Insights*):
1. **Ambang Batas Hening Dasar (`DEFAULT_SILENCE_RMS = 0.015`):**
   Pada mikrofon laptop/PC biasa di ruangan tertutup, desis kipas pendingin dan derau statis ruangan umumnya memiliki RMS antara $0.008$ hingga $0.015$. Oleh karena itu, ambang hening default backend disetel pada **`0.015` RMS**, sehingga desis kipas tidak keliru dideteksi sebagai suara bising aktif.
2. **Karakteristik Data Suara Bersih Bervolume Tinggi:**
   Sebanyak 243 sampel non-berisik pada dataset memiliki nilai $\text{RMS} \ge 0.075$ (misalnya saat asisten lab menjelaskan materi dengan suara lantang). Hal ini membuktikan bahwa klasifikasi kebisingan tidak boleh hanya mengandalkan batas keras RMS, melainkan harus dinilai secara komprehensif oleh model WKNN menggunakan kombinasi seluruh 16 fitur spektral.
3. **Ambang Batas Saturasi Keras (`EXTREME_NOISE_RMS = 0.220`):**
   Batas pengaman keras hanya diterapkan pada suara sangat ekstrem di atas $0.220$ RMS (hampir menyentuh batas clipping digital 1.0) untuk memastikan suara benturan keras langsung terdeteksi.
