# Evaluasi & Spesifikasi Sistem Deteksi Kebisingan Konsisten

1. **Model Deteksi**:
   - Menggunakan sistem **Kebisingan Konsisten dengan Toleransi Bergerak (*Rolling Window*)**.
   - Menghilangkan konsep siklus blok kaku. Evaluasi berjalan secara dinamis dan kontinu tiap detik.

2. **Pilihan Waktu Toleransi Konsisten**:
   - `Real-Time (Langsung)`: Alarm aktif langsung pada deteksi bising pertama (1 detik).
   - `4 Detik`: Alarm aktif jika bising konsisten minimal 3 dari 4 detik terakhir (75%).
   - `5 Detik`: Alarm aktif jika bising konsisten minimal 4 dari 5 detik terakhir (80%).
   - `10 Detik`: Alarm aktif jika bising konsisten minimal 8 dari 10 detik terakhir (80%).
   - `15 Detik`: Alarm aktif jika bising konsisten minimal 12 dari 15 detik terakhir (80%).
   - `20 Detik`: Alarm aktif jika bising konsisten minimal 16 dari 20 detik terakhir (80%).
   - `30 Detik`: Alarm aktif jika bising konsisten minimal 24 dari 30 detik terakhir (80%).

3. **Mekanisme Alarm & Cooldown**:
   - Begitu batas kebisingan konsisten terpenuhi, alarm audio Web Audio API otomatis berbunyi tepat selama **3 detik**.
   - Diberikan jeda cooldown selama 3 detik sesuai durasi alarm untuk mencegah alarm berulang terus-menerus.
   - Buffer jendela geser di-reset sehingga evaluasi periode konsisten baru dimulai dari awal.

4. **Kaidah Tampilan & Bahasa**:
   - Seluruh deskripsi teknis lugas, faktual, dan jelas tanpa istilah ambigu seperti 'rekomendasi' atau 'keseimbangan ideal'.
   - Nol emoji (100% SVG Heroicons).
   - Tipografi font Poppins dan palet warna Teal.
