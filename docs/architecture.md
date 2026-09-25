# Arsitektur Sistem: J-Stage Karaoke

Dokumen ini menjelaskan rancangan arsitektur, filosofi desain, dan pola komunikasi yang mendasari sistem **J-Stage Karaoke**.

---

## 1. Filosofi Desain: Multi-Screen Real-Time Stage System

Berbeda dengan aplikasi karaoke konvensional berbasis single-screen desktop, **J-Stage Karaoke** dirancang dengan paradigma **Distributed Multi-Screen Display**:

1. **Layar Panggung Mandiri (Stage Screen)**:
   - Ditujukan untuk proyektor panggung, videotron, atau TV layar besar.
   - Bersih dari elemen navigasi, panel administratif, atau pop-up kontrol.
   - Mengutamakan visibilitas teks lirik skala besar (*normal*, *large*, *massive*), animasi sapuan karaoke suku kata (*progressive sweep*), penghitung mundur jeda melodi/intro, dan visualizer nada real-time.
2. **Dasbor Operator (Operator Console)**:
   - Bertindak sebagai otak dan pusat kendali acara (*master command center*).
   - Memiliki kontrol penuh atas antrean lagu, perpindahan lagu, pemutaran instan, kontrol volume & mute, sakelar vokal/instrumental, pencarian YouTube langsung, pencarian lirik LRCLIB, pengeditan lirik *Tap-to-Sync*, dan konfigurasi kriteria penjurian.
3. **Panel Juri (Judge Panel)**:
   - Dapat diakses mandiri oleh beberapa juri sekaligus dari smartphone/tablet via jaringan Wi-Fi lokal.
   - Memiliki antarmuka penilaian per kriteria (Teknik Vokal, Penghayatan, Penguasaan Panggung, Karakter Nada) dan catatan komentar.
4. **Portal Request Penonton (Audience Request)**:
   - Antarmuka mobile-first bagi penonton acara untuk menambahkan lagu anime/J-Pop ke antrean panggung hanya dengan memindai kode QR.

---

## 2. Model Sinkronisasi Tri-Layer (Tri-Layer Hybrid Synchronization)

Untuk menjamin latensi serendah mungkin tanpa membebani server lokal atau membuat antarmuka tersendat, aplikasi mengimplementasikan arsitektur sinkronisasi tiga lapis:

```
+-------------------------------------------------------------------------+
|                              Aplikasi Klien                             |
|                                                                         |
|  [Operator View]       [Stage View]       [Judge View]   [Request View] |
+--------+--------------------+--------------------+--------------+-------+
         |                    |                    |              |
         +--------------------+--------------------+--------------+
                              |
                     [SyncService Singleton]
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
[Layer 1: BroadcastChannel] [Layer 2: Socket.io]  [Layer 3: LocalStorage]
Zero-latency Cross-Tab      LAN Multi-Device      Crash Recovery & Cache
(Operator & Stage lokal)    (Tablet Juri & HP)    (State & Presets lokal)
```

### Karakteristik Setiap Layer:
1. **Layer 1: BroadcastChannel API (`j_stage_karaoke_sync_v1`)**:
   - Berjalan langsung di level browser engine tanpa melalui jaringan TCP/IP.
   - Digunakan saat Operator dan Layar Proyektor dijalankan pada komputer yang sama di browser yang sama (misal laptop operator menghubungkan layar sekunder HDMI).
   - Menghasilkan latensi sinkronisasi 0ms untuk perpindahan lirik dan seek waktu.
2. **Layer 2: Socket.io WebSocket (Node.js Server pada Port 3001)**:
   - Menghubungkan seluruh perangkat dalam jaringan Wi-Fi lokal (LAN).
   - Meneruskan event `UPDATE_STATE` saat ada perubahan antrean atau kontrol pemutaran.
   - Mengalirkan event `TIME_UPDATE` ringan secara kontinu agar posisi seekbar dan penyorotan lirik di perangkat remote tetap sinkron.
3. **Layer 3: LocalStorage Throttled Persistence**:
   - State master disimpan ke `localStorage` dengan mekanisme *throttling* (1 detik).
   - Mekanisme ini mencegah pembekuan *main UI thread* saat event `TIME_UPDATE` ditembakkan pada frekuensi tinggi (~20 kali per detik).
   - Memungkinkan pemulihan instan jika tab browser tidak sengaja tertutup atau di-refresh.

---

## 3. Arsitektur Media & Dual-Track Audio

Sistem mendukung dua mode sumber lagu utama:

### A. YouTube Stream Source
- Menggunakan YouTube IFrame Player API terintegrasi.
- Video disematkan langsung di layar panggung.
- Subtitle bawaan YouTube dimatikan secara agresif (`disableCaptions`) untuk menghindari tabrakan visual dengan lirik karaoke bersapu dinamis J-Stage.
- Pencarian langsung dilakukan di sisi server via paket `yt-search` sehingga klien tidak memerlukan API Key Google Cloud berbayar.

### B. Local Media Source & Dual-Track Processing
Sistem menyediakan penanganan khusus untuk file audio/video lokal berkualitas tinggi:
1. **Dedicated Instrumental Audio Track**:
   - Jika tersedia file instrumental resmi/studio (misalnya lagu memiliki video vokal + file MP3 minus-one), sistem menjalankan dua pemutar HTML5 secara serempak.
   - Saat tombol **Vocal Guide** dinyalakan, track utama bersuara dan track instrumental dimatikan.
   - Saat tombol **Vocal Guide** dimatikan, audio track utama di-mute (video tetap berjalan mulus di layar) dan track instrumental diputar dengan posisi waktu (`currentTime`) yang presisi.
2. **DSP Center-Channel Cancellation Fallback**:
   - Jika file hanya berupa satu file lagu komersial (ada vokal tanpa track instrumental terpisah), sistem mengaktifkan modul `VocalRemoverEngine` berbasis Web Audio API.
   - Modul ini menginversikan fase kanal kanan dan menggabungkannya dengan kanal kiri, disertai filter *low-pass* 150Hz agar energi bas dan drum tetap utuh.

---

## 4. Arsitektur Penyimpanan & Streaming Server

Backend server (`server/server.js`) dibangun menggunakan Express 5:
1. **Streaming Media Parsial (HTTP 206 Partial Content)**:
   - Endpoint `/media` melayani file audio dan video dengan header `Accept-Ranges: bytes`.
   - Hal ini memungkinkan pemutar audio browser melakukan scrubbing dan seeking instan tanpa harus mengunduh keseluruhan file video/audio yang berukuran besar.
2. **Non-Blocking Asynchronous Binary Upload (`/api/upload`)**:
   - File media diunggah langsung dalam format binary buffer (`express.raw`) hingga batas 500MB.
   - Penulisan ke disk dilakukan secara asynchronous (`fs.promises.writeFile`) sehingga tidak memblokir stream audio yang sedang berlangsung di panggung.
3. **Penyimpanan Preset Disk Permanen (`/api/presets`)**:
   - Preset lagu disimpan ke file `server/data/presets.json`.
   - Klien browser melakukan sinkronisasi dua arah saat pertama kali dimuat, memastikan lagu yang telah disiapkan tidak hilang saat cache browser dibersihkan.

---

## 5. Pertimbangan Toleransi Latensi & Keamanan Event Panggung

- **Isolasi Tampilan Proyektor**: Tampilan Stage View tidak menampilkan tombol navigasi atau alamat URL secara default agar estetika panggung proyektor tetap terjaga.
- **Microphone Pitch Decoupling**: Analisis frekuensi mikrofon dijalankan dalam `requestAnimationFrame` terisolasi pada `PitchTracker.ts`. Jika mikrofon tidak tersedia atau pengguna menolak izin mikrofon, aplikasi tetap berjalan normal tanpa mengganggu pemutaran video atau antrean.
- **Sound Effects Synthesizer Decoupling**: Efek suara disintesis secara algoritmik menggunakan osilator dan *noise buffer* Web Audio API. Ini menjamin suara tepuk tangan atau fanfare tetap berbunyi tanpa risiko kegagalan unduhan file eksternal saat koneksi internet lokal lambat.
