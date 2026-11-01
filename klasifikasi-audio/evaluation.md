# Evaluation

Dokumentasi fase kelima metodologi **CRISP-DM (Cross-Industry Standard Process for Data Mining)** untuk pengujian menyeluruh, validasi kinerja, analisis metrik sains data, serta komparasi 12 model Machine Learning pada data uji independen.

---

## 1. Definisi Matematis Metrik Evaluasi

Pada kasus klasifikasi biner deteksi kebisingan audio:
- **Kelas Positif (`label = 1`):** Kondisi **Berisik (*Noisy*)**
- **Kelas Negatif (`label = 0`):** Kondisi **Non-Berisik (*Clean/Quiet*)**

Pengujian kuantitatif dilakukan menggunakan metrik standar sains data:

### 1. Akurasi (*Accuracy*)
Mengukur proporsi total prediksi yang benar (baik berisik maupun tenang) terhadap keseluruhan sampel pengujian:
$$\text{Accuracy} = \frac{\text{TP} + \text{TN}}{\text{TP} + \text{TN} + \text{FP} + \text{FN}}$$

### 2. Presisi (*Precision*)
Mengukur seberapa akurat model ketika mengeluarkan prediksi "Berisik":
$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

> [!IMPORTANT]
> **Urgensi Presisi Kelas Berisik:** Dalam sistem pemantauan lingkungan ruangan, False Positive (FP) adalah "alarm palsu" di mana ruangan tenang keliru divonis berisik. Presisi yang sangat tinggi menjamin bahwa alarm tidak berbunyi sembarangan jika tidak ada suara bising sungguhan.

### 3. Daya Ingat / Sensitivitas (*Recall*)
Mengukur proporsi kejadian bising aktual yang berhasil ditangkap oleh sistem tanpa terlewatkan (*False Negative*):
$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

### 4. Skor F1 (*F1-Score*)
Rata-rata harmonik antara Presisi dan Recall, memberikan penilaian seimbang antara keandalan alarm dan ketuntasan deteksi:
$$\text{F1-Score} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

### 5. Validasi Silang Berstrata (*5-Fold Stratified Cross Validation*)
Subset data latih dibagi menjadi 5 lipatan (*folds*) secara seimbang. Setiap fold bergantian menjadi data validasi sementara 4 fold lainnya menjadi data latih. Skor rata-rata ($\mu_{\text{CV}}$) dan standar deviasi ($\sigma_{\text{CV}}$) membuktikan kestabilan model terhadap variasi sampel data latih.

---

## 2. Tabel Benchmark Komparatif 12 Algoritma Klasifikasi

Berdasarkan eksperimen komparatif pada subset data uji independen ($N = 1.058$ sampel uji):

| Peringkat | Algoritma Machine Learning | Kategori Model | Akurasi Uji | Presisi Berisik | Recall Berisik | F1-Score | 5-Fold CV Mean | Status |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **#1** | **WKNN ($K=4$, distance)** | *Instance-Based* | **97.64%** | **98.60%** | **96.48%** | **97.53%** | **97.58% (+/- 0.58%)** | 🏆 **Model Terpilih** |
| **#2** | Baseline KNN ($K=5$, uniform) | *Instance-Based* | 97.45% | 98.59% | 96.09% | 97.32% | 97.40% | Baseline |
| **#3** | MLP (Multi-Layer Perceptron) | *Neural Network* | 96.98% | 97.05% | 96.67% | 96.86% | 96.78% | Deep Learning |
| **#4** | Extra Trees Classifier | *Ensemble* | 96.69% | 97.22% | 95.89% | 96.55% | 97.02% | Ensemble |
| **#5** | Random Forest Classifier | *Ensemble* | 95.27% | 94.93% | 95.30% | 95.12% | 96.17% | Bagging |
| **#6** | Decision Tree Classifier | *Tree* | 93.57% | 93.52% | 93.15% | 93.33% | 92.72% | Single Tree |
| **#7** | Support Vector Machine (RBF) | *Kernel Machine*| 93.38% | 94.91% | 91.19% | 93.01% | 94.13% | Non-Linear SVM |
| **#8** | Gradient Boosting Classifier | *Boosting* | 91.49% | 90.25% | 92.37% | 91.30% | 93.14% | Boosting |
| **#9** | AdaBoost Classifier | *Boosting* | 85.35% | 83.46% | 86.89% | 85.14% | 84.74% | Adaptive Boost |
| **#10**| Support Vector Machine (Linear)| *Linear Margin*| 83.27% | 80.04% | 87.08% | 83.41% | 84.58% | Linear SVM |
| **#11**| Logistic Regression | *Linear* | 82.80% | 80.52% | 84.93% | 82.67% | 84.22% | Linear Sigmoid |
| **#12**| Gaussian Naive Bayes | *Bayesian* | 81.19% | 80.12% | 81.21% | 80.66% | 82.10% | Probabilistik |

### Analisis Kritis Komparasi Model:
1. **Keunggulan Spasial WKNN:** Algoritma berbasis instans (Weighted KNN) mengungguli seluruh model lainnya dengan akurasi **97.64%** dan CV **97.58%**. Kedekatan spasial dalam ruang 16-D terbukti sangat efektif untuk mengelompokkan pola spektral kebisingan.
2. **Kekuatan Fitur PSD:** Model jaringan syaraf (MLP 96.98%) dan ansambel pohon (Extra Trees 96.69%) menunjukkan hasil yang juga tinggi, mengonfirmasi bahwa 16 fitur akustik PSD yang diekstraksi memiliki daya diskriminasi yang sangat kuat di berbagai pendekatan algoritma.
3. **Kelemahan Model Linear:** Model berbasis batas linear (SVM Linear, Logistic Regression, Gaussian NB) mencatat performa terendah ($81\% - 83\%$), membuktikan bahwa pemisah antara karakteristik bising dan tenang bersifat non-linear dan kompleks.

---

## 3. Laporan Klasifikasi Mendalam Model Terpilih (WKNN)

Berikut *Classification Report* resmi hasil evaluasi model WKNN ($K=4$, distance weights) pada $1.058$ sampel uji:

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

- **Akurasi Keseluruhan:** **97.64%** (1.033 dari 1.058 sampel diprediksi dengan benar).
- **5-Fold Cross Validation:** **97.58% (+/- 0.58%)**, dengan lipatan tertinggi mencapai **98.20%**.
- **Presisi Kelas Berisik:** **98.60%** (Tingkat kepercayaan alarm sangat tinggi, false alarm hanya $1.28\%$).
- **Recall Kelas Non-Berisik:** **98.72%** (Kondisi hening/tenang teridentifikasi secara tepat).

---

## 4. Analisis Matriks Kebingungan (*Confusion Matrix*)

Matriks kebingungan menyajikan perbandingan antara label aktual (*ground truth*) dengan hasil prediksi model:

| Aktual \ Prediksi | Non-Berisik (0) | Berisik (1) | Total Sampel | Recall Kelas |
|---|:---:|:---:|:---:|:---:|
| **Non-Berisik (0)** | **540** ($\text{TN}$) | **7** ($\text{FP}$) | 547 | **98.72%** |
| **Berisik (1)** | **18** ($\text{FN}$) | **493** ($\text{TP}$) | 511 | **96.48%** |
| **Total Prediksi** | 558 | 500 | 1.058 | **Akurasi: 97.64%** |

### Evaluasi Operasional:
- **True Negative ($\text{TN} = 540$):** 540 segmen kondisi ruangan tenang berhasil dikenali tanpa gangguan.
- **False Positive ($\text{FP} = 7$):** Hanya 7 kejadian alarm palsu dari 547 sampel audio hening ($1.28\%$).
- **False Negative ($\text{FN} = 18$):** Hanya 18 kejadian bising yang luput dari total 511 sampel bising ($3.52\%$).
- **True Positive ($\text{TP} = 493$):** 493 kejadian bising berhasil dideteksi dengan tepat.

---

## 5. Analisis Latensi Komputasi & Efisiensi Memori

Pengukuran waktu eksekusi inferensi pada arsitektur produksi FastAPI:
- **Waktu Ekstraksi 16 Fitur (Librosa):** $\approx 7 - 12\text{ ms}$
- **Waktu Normalisasi RobustScaler:** $\approx 0.1\text{ ms}$
- **Waktu Prediksi Model WKNN ($K=4$):** $\approx 0.8 - 1.5\text{ ms}$
- **Total Latensi Respon REST API:** **$\approx 8 - 15\text{ ms}$**

Dengan total waktu komputasi $< 15\text{ ms}$, sistem hanya memerlukan sebagian kecil kapasitas CPU dan siap melayani pemantauan kontinu per detik tanpa penundaan (*real-time processing*).
