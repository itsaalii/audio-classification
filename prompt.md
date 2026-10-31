# Evaluasi & Spesifikasi Sistem Deteksi Kebisingan Konsisten

1. **Model Deteksi**:
   - Menggunakan sistem **Kebisingan Konsisten dengan Toleransi Bergerak (*Rolling Window*)**.
   - Pilihan durasi toleransi: Real-Time (Langsung), 4 Detik, 5 Detik, 10 Detik, 15 Detik, 20 Detik, 30 Detik.
   - Evaluasi berjalan secara dinamis dan kontinu tiap detik.

2. **Karakteristik & Kustomisasi Beep Alarm**:
   - Suara alarm menggunakan **beep panjang kontinu** (gelombang sinus murni, tanpa putus-putus atau modulasi pulsa).
   - Durasi beep bawaan (**default**) adalah **3 detik**.
   - Kustomisasi durasi beep tersedia: **1s**, **2s**, **3s (Default)**, **4s**, dan **5s**.
   - Menu penonaktifan beep: Tombol togol **Aktif / Nonaktif** untuk mematikan atau mengaktifkan suara beep kapan saja.

3. **Kaidah Tampilan Web**:
   - **Bebas dari deskripsi berlebih**: Tampilan web bersih dan langsung fokus pada kontrol serta metrik tanpa teks penjelasan panjang.
   - Nol emoji (100% SVG Heroicons).
   - Tipografi font Poppins dan palet warna Teal.
