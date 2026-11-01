# Data Preprocessing

Dokumentasi fase ketiga metodologi **CRISP-DM (Cross-Industry Standard Process for Data Mining)** untuk pra-pemrosesan data, segmentasi temporal, penyaringan jeda hening, pembagian dataset berstrata, dan normalisasi kebal pencilan.

---

## 1. Pipeline Pra-pemrosesan Data

Tahap **Data Preprocessing** (Pra-pemrosesan Data) mentransformasikan sinyal audio kontinu mentah menjadi matriks fitur tabular 16 dimensi yang bersih, seimbang, dan siap dilatih oleh algoritma Machine Learning:

```text
Rekaman Audio Mentah (.mp3, 200 berkas @ ~30s)
  │
  ├── 1. Segmentasi Sliding Window (4.0s, Hop 1.0s, Overlap 75%)
  │      └── Membagi gelombang menjadi fragmen 88.200 sampel
  │
  ├── 2. Pembersihan Jeda Hening (Silence Trimming, RMS >= 0.015)
  │      └── Mengeliminasi potongan hening kosong pada kelas berisik
  │
  ├── 3. Ekstraksi 16 Parameter Akustik PSD
  │      └── RMS, Spectral Centroid, ZCR, MFCC 1..13 -> audio_features_4s.csv (5.286 baris)
  │
  ├── 4. Pembagian Data Berstrata (Stratified Split 80:20)
  │      ├── Data Latih: 4.228 sampel (80%)
  │      └── Data Uji  : 1.058 sampel (20%)
  │
  └── 5. Penskalaan Fitur Kebal Pencilan (RobustScaler)
         └── Penskalaan berbasis Median & IQR -> diekspor ke scaler_audio.pkl
```

---

## 2. Segmentasi Jendela Geser (*Sliding Window Segmentation*)

Pemotongan audio secara kaku (*rigid non-overlapping cut*) berisiko memotong suara bising mendadak (misalnya suara kursi terseret atau tawa keras) tepat di perbatasan jendela waktu. Akibatnya, informasi spektral gelombang terbelah dan merusak pola akustik.

Untuk mengatasinya, diterapkan teknik **Sliding Window** dengan parameter:
- **Panjang Jendela (*Window Size / Duration*):** $T_{\text{win}} = 4.0\text{ detik}$
  $$N_{\text{samples}} = f_s \times T_{\text{win}} = 22.050 \times 4.0 = 88.200\text{ sampel}$$
- **Pergeseran Jendela (*Hop Size / Duration*):** $T_{\text{hop}} = 1.0\text{ detik}$
  $$N_{\text{hop}} = f_s \times T_{\text{hop}} = 22.050 \times 1.0 = 22.050\text{ sampel}$$
- **Rasio Tumpang Tindih (*Overlap Ratio*):**
  $$\text{Overlap} = \frac{T_{\text{win}} - T_{\text{hop}}}{T_{\text{win}}} \times 100\% = \frac{4.0 - 1.0}{4.0} \times 100\% = 75\%$$

```text
Visualisasi Sliding Window 4.0s (Hop 1.0s / Overlap 75%):

Waktu (Detik)  0s      1s      2s      3s      4s      5s      6s
Sinyal Audio:  |-------|-------|-------|-------|-------|-------|
Segmen #1:     [=============== 4.0 Detik ===============]
Segmen #2:             [=============== 4.0 Detik ===============]
Segmen #3:                     [=============== 4.0 Detik ===============]
               <--1s--> Hop
               <------------ 3.0s Tumpang Tindih (75%) --------->
```

### Keunggulan Teknis:
1. **Invariansi Batas Waktu (*Boundary Invariance*):** Setiap transisi kebisingan tertangkap utuh setidaknya di dalam satu jendela pengamatan 4 detik.
2. **Augmentasi Data Nyata:** Dari 200 berkas audio mentah, teknik ini menghasilkan **5.286 segmen audio nyata** tanpa perlu membuat data sintetis buatan (*no artificial noise*).
3. **Kesesuaian dengan Pemantauan Real-Time:** Jendela 4 detik dengan pergeseran 1 detik meniru secara presisi cara kerja memori sirkular (*circular buffer*) mikrofon browser saat memantau suara secara langsung.

---

## 3. Pembersihan Jeda Hening (*Silence Trimming / Energy Thresholding*)

Pada saat merekam kondisi bising di laboratorium, kerap kali ada jeda hening sesaat selama 1–2 detik di awal rekaman sebelum keributan dimulai, atau di akhir setelah keributan mereda. Jika potongan hening ini dimasukkan ke dalam kelas "Berisik (`label = 1`)", model akan mengalami kontaminasi label (*label noise*) dan berpotensi salah mengklasifikasikan kondisi hening sebagai bising.

Untuk mencegah kontaminasi label tersebut, diterapkan aturan **Silence Trimming**:
$$\text{MIN\_RMS\_BERISIK} = 0.015$$

### Logika Eliminasi:
Pada setiap segmen 4 detik dari kelas Berisik:
- Jika $\text{RMS} < 0.015$, segmen dikategorikan sebagai jeda hening kosong dan **otomatis dieliminasi (dibuang)** dari dataset pelatihan.
- Jika $\text{RMS} \ge 0.015$, segmen dipertahankan sebagai sampel berisik valid.

> [!IMPORTANT]
> **Integritas Label:** Nilai label kelas tidak pernah diubah secara sepihak. Proses ini murni pembersihan sampel kosong (*data cleansing*), memastikan bahwa seluruh data latih kelas berisik benar-benar memuat gelombang suara aktif.

---

## 4. Pembagian Data Berstrata (*Stratified Train-Test Split 80:20*)

Dataset bersih (**5.286 baris segmen**) kemudian dibagi menjadi dua partisi terpisah:
- **Data Latih (*Training Set*):** $80\%$ ($N = 4.228$ sampel) untuk melatih model dan validasi silang.
- **Data Uji (*Testing Set*):** $20\%$ ($N = 1.058$ sampel) untuk evaluasi performa independen (*unseen data*).

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    stratify=y,
    random_state=42
)
```

Metode berstrata (`stratify=y`) menjamin rasio kelas **Berisik** dan **Non-Berisik** pada data latih dan data uji tetap identik dan seimbang:

| Partisi Data | Jumlah Sampel | Non-Berisik (0) | Berisik (1) | Keseimbangan |
|---|:---:|:---:|:---:|:---:|
| **Populasi Keseluruhan** | 5.286 | 2.732 ($51.68\%$) | 2.554 ($48.32\%$) | Seimbang |
| **Data Latih (Train 80%)** | 4.228 | 2.185 ($51.68\%$) | 2.043 ($48.32\%$) | Seimbang |
| **Data Uji (Test 20%)** | 1.058 | 547 ($51.70\%$) | 511 ($48.30\%$) | Seimbang |

---

## 5. Normalisasi Fitur Kebal Pencilan (*RobustScaler*)

Enam belas fitur akustik yang diekstraksi memiliki rentang nilai (*scale*) yang sangat berbeda:
- RMS Energy: $0.0001 - 0.27$
- Zero Crossing Rate: $0.008 - 0.34$
- Spectral Centroid: $300\text{ Hz} - 5.800\text{ Hz}$
- MFCC 1: $-480$ s/d $+15$

Algoritma berbasis jarak seperti **K-Nearest Neighbors (KNN)** sangat sensitif terhadap skala fitur. Jika tidak dinormalisasi, variabel dengan skala ribuan (seperti Spectral Centroid) akan mendominasi metrik jarak dan meniadakan pengaruh fitur penting lainnya seperti RMS.

### Mengapa Memilih `RobustScaler`?
Perbandingan metode normalisasi:
1. **`StandardScaler` ($\frac{x - \mu}{\sigma}$):** Menggunakan rata-rata ($\mu$) dan standar deviasi ($\sigma$). Letupan suara mendadak (*burst noise*, suara hentakan sesaat) menghasilkan nilai pencilan (*outliers*) yang merusak rata-rata dan memperbesar simpangan baku.
2. **`MinMaxScaler` ($\frac{x - x_{\min}}{x_{\max} - x_{\min}}$):** Sangat rapuh karena rentang $[0, 1]$ ditentukan secara mutlak oleh nilai ekstrem minimum dan maksimum.
3. **`RobustScaler` (Pilihan Optimal untuk Audio):** Menggunakan **Median ($Q_2$)** dan **Jangkauan Antarkuartil ($\text{IQR} = Q_3 - Q_1$)**:
   $$z_j = \frac{x_j - Q_2(x_j)}{Q_3(x_j) - Q_1(x_j)}$$
   Median dan IQR tidak terpengaruh oleh letupan suara ekstrem, sehingga menjaga struktur sebaran data normal tetap presisi dan kebal terhadap pencilan.

Pipeline penskalaan ini disimpan ke berkas `scaler_audio.pkl` untuk digunakan secara konsisten pada proses inferensi produksi.
