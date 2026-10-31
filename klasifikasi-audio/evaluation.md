# Evaluation

Tahap **Evaluation** (Evaluasi) bertujuan untuk menguji, memvalidasi, dan menganalisis performa model klasifikasi audio secara komprehensif. Pengujian dilakukan pada data uji independen (**1.058 sampel uji**) yang tidak pernah dilihat sebelumnya oleh model selama tahap pelatihan.

Evaluasi dilakukan menggunakan berbagai metrik standar sains data: **Akurasi**, **Presisi**, **Recall**, **F1-Score**, **5-Fold Stratified Cross Validation**, **Matriks Kebingungan (*Confusion Matrix*)**, dan **Kurva ROC-AUC**.

---

## 1. Definisi Matematis Metrik Evaluasi

Pada kasus klasifikasi biner deteksi audio berisik:
- **Kelas Positif (1):** Kondisi **Berisik (*Noisy*)**
- **Kelas Negatif (0):** Kondisi **Non-Berisik (*Clean/Quiet*)**

Empat metrik kuantitatif utama dihitung sebagai berikut:

### 1. Akurasi (*Accuracy*)
Mengukur proporsi total prediksi yang benar (baik berisik maupun tenang) terhadap keseluruhan sampel pengujian:
$$\text{Accuracy} = \frac{\text{TP} + \text{TN}}{\text{TP} + \text{TN} + \text{FP} + \text{FN}}$$

### 2. Presisi (*Precision*)
Mengukur seberapa akurat model ketika mengeluarkan prediksi "Berisik":
$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

> [!IMPORTANT]
> **Pentingnya Presisi Kelas Berisik:** Dalam sistem pemantauan lingkungan, False Positive (FP) adalah "alarm palsu" di mana ruangan tenang keliru dianggap gaduh. Presisi yang sangat tinggi menjamin bahwa alarm tidak berbunyi sembarangan jika tidak ada suara bising sungguhan.

### 3. Sensitivitas / Daya Ingat (*Recall*)
Mengukur seberapa banyak peristiwa kebisingan yang berhasil ditangkap oleh sistem tanpa terlewatkan (*False Negative*):
$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

### 4. Skor F1 (*F1-Score*)
Rata-rata harmonik antara Presisi dan Recall, memberikan penilaian seimbang antara keandalan alarm dan ketuntasan deteksi:
$$\text{F1-Score} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

### 5. Validasi Silang Berstrata (*5-Fold Stratified Cross Validation*)
Data latih dibagi menjadi 5 lipatan (*folds*) berstrata. Setiap fold bergantian menjadi data validasi sementara 4 fold lainnya menjadi data latih. Skor rata-rata ($\mu_{\text{CV}}$) dan standar deviasi ($\sigma_{\text{CV}}$) membuktikan kestabilan model terhadap variasi data latih.

---

## 2. Tabel Benchmark Komparatif 12 Algoritma Klasifikasi

Berdasarkan eksperimen komparatif pada `train.ipynb`, berikut adalah rangkuman performa lengkap dari 12 algoritma yang diuji pada subset data uji independen ($N = 1.058$ sampel uji):

| Peringkat | Algoritma Machine Learning | Kategori Model | Akurasi (Test) | Presisi Berisik | Recall Berisik | F1-Score | 5-Fold CV Mean | Status |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **#1** | **WKNN ($K=4$, distance)** | *Instance-Based* | **97.64%** | **98.60%** | **96.48%** | **97.53%** | **97.58% (+/- 0.58%)** | 🏆 **Model Terpilih** |
| **#2** | Baseline KNN ($K=5$, uniform) | *Instance-Based* | 97.45% | 98.59% | 96.09% | 97.32% | 97.40% | Baseline |
| **#3** | MLP (Multi-Layer Perceptron) | *Neural Network* | 96.98% | 97.05% | 96.67% | 96.86% | 96.78% | Deep/JST |
| **#4** | Extra Trees Classifier | *Ensemble* | 96.69% | 97.22% | 95.89% | 96.55% | 97.02% | Ensemble |
| **#5** | Random Forest Classifier | *Ensemble* | 95.27% | 94.93% | 95.30% | 95.12% | 96.17% | Bagging |
| **#6** | Decision Tree Classifier | *Tree* | 93.57% | 93.52% | 93.15% | 93.33% | 92.72% | Single Tree |
| **#7** | Support Vector Machine (RBF) | *Kernel* | 93.38% | 94.91% | 91.19% | 93.01% | 94.13% | Non-Linear SVM |
| **#8** | Gradient Boosting Classifier | *Boosting* | 91.49% | 90.25% | 92.37% | 91.30% | 93.14% | Boosting |
| **#9** | AdaBoost Classifier | *Boosting* | 85.35% | 83.46% | 86.89% | 85.14% | 84.74% | Adaptive Boost |
| **#10**| Support Vector Machine (Linear)| *Linear Margin*| 83.27% | 80.04% | 87.08% | 83.41% | 84.58% | Linear SVM |
| **#11**| Logistic Regression | *Linear* | 82.80% | 80.52% | 84.93% | 82.67% | 84.22% | Linear Sigmoid |
| **#12**| Gaussian Naive Bayes | *Bayesian* | 81.19% | 80.12% | 81.21% | 80.66% | 82.10% | Probabilistik |

### Analisis Kritis Perbandingan Model:
1. **Keunggulan Model Berbasis Instans (WKNN):** WKNN (Weighted K-Nearest Neighbors) menempati posisi teratas dengan akurasi **97.64%** dan CV **97.58%**. Kedekatan spasial dalam ruang 16-D terbukti menjadi pendekatan terbaik untuk mengenali pola suara lingkungan.
2. **Performa Jaringan Syaraf (MLP) & Ensemble:** MLP Neural Network (96.98%) dan Extra Trees (96.69%) menunjukkan performa yang sangat kompetitif, membuktikan bahwa fitur PSD yang diekstraksi memiliki daya diskriminasi yang kuat di berbagai arsitektur.
3. **Keterbatasan Model Linear:** Model berbasis pemisah linear (SVM Linear, Logistic Regression, Gaussian NB) mencatat performa terendah ($81\% - 83\%$). Hal ini mengonfirmasi bahwa batas pemisah antara spektrum suara bising dan tenang bersifat non-linear dan kompleks.

---

## 3. Laporan Klasifikasi Mendalam Model Terpilih (WKNN)

Berikut adalah *Classification Report* resmi hasil pengujian model WKNN ($K=4$, pembobotan jarak terbalik) pada $1.058$ sampel uji:

```text
===========================================================================
HASIL EVALUASI MENDALAM: WKNN (K=4, DISTANCE) (HOP 1.0s / OVERLAP 75%)
===========================================================================

--- CLASSIFICATION REPORT (N = 1.058 SAMPEL UJI) ---
                 precision    recall  f1-score   support

non-berisik (0)     0.9677    0.9872    0.9774       547
    berisik (1)     0.9860    0.9648    0.9753       511

       accuracy                         0.9764      1058
      macro avg     0.9769    0.9760    0.9763      1058
   weighted avg     0.9766    0.9764    0.9764      1058
```

- **Akurasi Keseluruhan:** **97.64%** (1.033 dari 1.058 sampel diprediksi benar).
- **5-Fold Cross Validation:** **97.58% (+/- 0.58%)**, dengan lipatan terbaik mencapai **98.20%**.
- **Presisi Kelas Berisik:** **98.60%** (Tingkat kepercayaan alarm mendekati sempurna).
- **Recall Kelas Non-Berisik:** **98.72%** (Kondisi hening terdeteksi dengan akurasi tinggi).

---

## 4. Analisis Matriks Kebingungan (*Confusion Matrix*)

Matriks kebingungan $2 \times 2$ menyajikan rincian distribusi prediksi terhadap label kebenaran sesungguhnya (*ground truth*):

$$\mathbf{CM} = \begin{pmatrix} \text{TN} = 540 & \text{FP} = 7 \\ \text{FN} = 18 & \text{TP} = 493 \end{pmatrix}$$

```text
                                  PREDIKSI MODEL
                           Non-Berisik (0)     Berisik (1)
                        +-------------------+-------------------+
AKTUAL   Non-Berisik(0) |  TN = 540 (98.7%) |   FP = 7  (1.3%)  |  Total: 547
                        +-------------------+-------------------+
         Berisik (1)    |  FN = 18  (3.5%)  |  TP = 493 (96.5%) |  Total: 511
                        +-------------------+-------------------+
```

### Rincian Analisis 4 Kuadran:

1. **True Negative (TN = 540 Segmen / 98.72%):**
   Dari 547 segmen audio tenang yang diuji, sebanyak 540 segmen berhasil diidentifikasi dengan benar sebagai kondisi kondusif/hening.
2. **False Positive / Alarm Palsu (FP = 7 Segmen / 1.28%):**
   Hanya 7 segmen audio tenang yang keliru dianggap berisik. Tingkat alarm palsu yang sangat rendah ($1.28\%$) menjamin bahwa sistem pemantauan tidak akan mengganggu orang di ruangan dengan peringatan keliru.
3. **False Negative / Suara Lolos (FN = 18 Segmen / 3.52%):**
   Terdapat 18 segmen suara bising yang tidak memicu status berisik. Setelah ditelusuri pada `train.ipynb`, segmen ini merupakan suara bising berintensitas sangat rendah yang mendekati batas ambang hening ruangan ($\text{RMS} \approx 0.015 - 0.018$).
4. **True Positive (TP = 493 Segmen / 96.48%):**
   Sebanyak 493 dari 511 segmen suara bising berhasil ditangkap dan memicu sistem alarm peringatan secara akurat.

---

## 5. Analisis Kurva Karakteristik Operasi Penerima (ROC & AUC)
Kurva *Receiver Operating Characteristic* (ROC) memplot hubungan antara *True Positive Rate* (Recall) terhadap *False Positive Rate* pada berbagai nilai ambang batas probabilitas keputusan.

- **Nilai Area Under Curve (AUC):** Model WKNN memperoleh nilai **$\text{AUC} \approx 0.995$** (mendekati nilai sempurna 1.000).
- **Interpretasi Ilmiah:** Nilai AUC yang mendekati 1.0 membuktikan bahwa model memiliki pemisahan probabilitas yang sangat tajam dan tidak rentan terhadap pergeseran ambang batas klasifikasi (*classification threshold invariance*).

---

## 6. Efisiensi Sumber Daya & Waktu Inferensi

Selain akurasi, efisiensi komputasi menjadi pertimbangan utama dalam implementasi *real-time*:

| Metrik Kinerja Operasional | Nilai Pengukuran | Dampak terhadap Sistem |
|---|---|---|
| **Waktu Inferensi per Segmen** | **$< 0.005$ Detik ($< 5\text{ ms}$)** | Perekaman 4 detik berikutnya tidak terhambat (*zero lag*) |
| **Beban Penggunaan CPU** | **$< 2\%$** (Intel Core i5 / AMD Ryzen 5) | Sangat hemat daya, komputer dapat membuka aplikasi lain |
| **Ukuran Berkas Model (`.pkl`)** | **$575\text{ KB}$** | Sangat portabel, mudah didistribusikan |
| **Ukuran Berkas Scaler (`.pkl`)**| **$1.1\text{ KB}$** | Menyimpan parameter Median dan IQR 16 fitur |
| **Kebutuhan Akselerator GPU** | **Nol (Tidak Butuh GPU)** | Dapat dijalankan pada PC standar atau Raspberry Pi |

Hasil evaluasi ini mengonfirmasi bahwa **WKNN ($K=4$, distance weights)** merupakan arsitektur model paling optimal dari segi ketepatan prediksi, keandalan alarm, dan efisiensi sumber daya untuk diterapkan pada sistem pemantauan nyata.
