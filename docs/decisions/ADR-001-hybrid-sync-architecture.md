# ADR-001: Arsitektur Sinkronisasi Hibrida (BroadcastChannel + Socket.io + LocalStorage)

## Status
Diterima (*Accepted*)

## Tanggal
2026-09-03

## Konteks
Sistem karaoke panggung **J-Stage Karaoke** memiliki kebutuhan sinkronisasi waktu dan status yang sangat ketat:
1. **Layar Panggung (Proyektor)** dan **Dasbor Operator** sering kali dijalankan pada satu komputer/laptop fisik yang sama dengan konfigurasi monitor ganda (*extended display*).
2. Di sisi lain, **Panel Dewan Juri** dan **Portal Request Penonton** dijalankan di piranti terpisah (smartphone / tablet) melalui jaringan Wi-Fi lokal (*Local Area Network / LAN*).
3. Posisi waktu pemutaran (*currentTime*) diperbarui sebanyak ~20 kali per detik untuk memastikan sapuan suku kata lirik karaoke mengalir mulus tanpa patah-patah.

Jika seluruh komunikasi waktu frekuensi tinggi dipaksakan melewati koneksi server TCP biasa, beban I/O jaringan Wi-Fi lokal dapat melonjak dan menyebabkan latensi visual pada layar proyektor panggung.

## Keputusan
Menerapkan arsitektur sinkronisasi hibrida tiga lapis (*Tri-Layer Hybrid Synchronization*):
1. **BroadcastChannel API**:
   - Menghubungkan seluruh tab browser pada komputer yang sama secara langsung di memori browser tanpa menyentuh stack TCP/IP jaringan.
   - Menghasilkan latensi 0ms antara Dasbor Operator dan Layar Panggung lokal.
2. **Socket.io WebSocket**:
   - Menghubungkan piranti eksternal (Tablet Juri dan Smartphone Penonton) ke server Node.js lokal.
   - Menyiarkan perubahan status antrean (`UPDATE_STATE`) dan sinkronisasi waktu playback (`TIME_UPDATE`).
3. **Throttled LocalStorage (1 detik)**:
   - Digunakan sebagai cadangan persistensi jika tab tidak sengaja tertutup atau terjadi refresh halaman.
   - Dibatasi (*throttled*) agar tidak mengeksekusi `JSON.stringify` pada setiap frame pembaruan waktu 20fps.

## Alternatif yang Dipertimbangkan

### Alternatif 1: Pure HTTP REST Polling
- **Kelebihan**: Sangat mudah diimplementasikan.
- **Kekurangan**: Latensi tinggi (minimal ratusan milidetik), tidak cocok untuk animasi sapuan lirik real-time, membebani CPU server dengan ribuan request per menit.
- **Alasan Ditolak**: Tidak memenuhi standar kualitas panggung profesional.

### Alternatif 2: Pure WebRTC DataChannel
- **Kelebihan**: Latensi P2P yang sangat rendah antar piranti di jaringan lokal.
- **Kekurangan**: Membutuhkan mekanisme *signaling* yang rumit, rentan gagal pada router Wi-Fi venue acara yang mengaktifkan isolasi klien (*client isolation*).
- **Alasan Ditolak**: Kompleksitas berlebihan (*over-engineering*) untuk kebutuhan data state teks dan waktu.

## Konsekuensi
- **Positif**:
  - Tampilan proyektor panggung lokal bebas dari lag atau jitter jaringan, bahkan saat Wi-Fi venue sedang lambat.
  - Ponsel juri dan penonton tetap terhubung secara real-time via Socket.io.
  - Komputer operator tetap responsif karena operasi penulisan disk lokal di-throttle secara efisien.
- **Negatif / Mitigasi**:
  - Adanya dua kanal penyiaran (BroadcastChannel + Socket.io) memerlukan `clientId` unik pada setiap instance untuk mencegah *echo loop* (pesan yang dipancarkan kembali ke pengirim aslinya).
