# Layanan & Audio DSP: J-Stage Karaoke

Dokumen ini menjelaskan secara terperinci setiap modul layanan (*services*) dan mesin pemrosesan sinyal audio digital (*Digital Signal Processing / DSP*) pada **J-Stage Karaoke**.

---

## 1. `SyncService` (`src/services/syncService.ts`)

`SyncService` adalah modul orkestrator state pusat yang mengelola siklus hidup data aplikasi dan komunikasi sinkronisasi antar layar.

### Karakteristik & Pola Desain
- **Pola Singleton**: Menggunakan `SyncService.getInstance()` untuk memastikan seluruh komponen React berbagi referensi state yang identik.
- **Dua Jenis Pembaruan State**:
  1. `updateState(updater)`: Digunakan untuk perubahan struktural (menambah lagu, mengganti status play/pause, mengirim nilai juri). Mengirim pesan `STATE_UPDATE` melalui `BroadcastChannel` dan `Socket.io`, serta memicu penyimpanan lokal (`saveStateToStorage`).
  2. `updateTime(currentTime, duration)`: Pembaruan posisi playback berkala tinggi (~20 kali per detik). **Hanya** memperbarui nilai waktu tanpa memicu operasi serialisasi `JSON.stringify` ke disk/localStorage yang berat.

### Throttled Storage Persistence
```typescript
private saveStateToStorage(immediate = false) {
  if (immediate) {
    if (this.saveStorageTimer) clearTimeout(this.saveStorageTimer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    return;
  }
  if (this.saveStorageTimer) return;
  this.saveStorageTimer = setTimeout(() => {
    this.saveStorageTimer = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }, 1000);
}
```
Mekanisme ini mencegah freeze atau frame drop pada animasi lirik panggung saat pemutar media sedang berjalan.

---

## 2. `VocalRemoverEngine` (`src/services/vocalRemover.ts`)

`VocalRemoverEngine` adalah mesin DSP berbasis **Web Audio API** yang melakukan penghilangan vokal penyanyi secara langsung (*real-time*) di browser tanpa memerlukan inferensi AI server-side yang lambat.

### Teori & Prinsip Kerja: Center-Channel Phase Inversion
Pada rekaman lagu komersial stereo standar:
- Vokal utama (*lead vocal*) biasanya di-mix tepat di **tengah panorama stereo** (*center channel*), artinya sinyal audio vokal pada kanal kiri ($L$) dan kanal kanan ($R$) bernilai identik:
  $$L = S_L + V, \quad R = S_R + V$$
  *(di mana $S$ adalah instrumen stereo panned, dan $V$ adalah vokal tengah).*
- Jika sinyal kanal kanan diinversikan fasanya (dikalikan $-1$) dan dijumlahkan dengan kanal kiri:
  $$L + (-R) = (S_L + V) - (S_R + V) = S_L - S_R$$
  Komponen vokal tengah ($V$) saling meniadakan secara matematis (*destructive phase cancellation*).

### Preservasi Bass & Kick Drum (Low-Pass Filter)
Kelemahan utama inversi fasa konvensional adalah hilangnya instrumen bas dan drum karena instrumen tersebut juga sering di-mix di tengah. Untuk mengatasi hal ini, `VocalRemoverEngine` menambahkan jalur paralel dengan filter **Low-Pass Biquad (<150Hz)**:
- Frekuensi di bawah 150Hz dilewatkan secara terpisah dan dicampur kembali ke jalur *Wet (Karaoke)*, sehingga dentuman bassline dan bass drum tetap solid saat vokal dihilangkan.

```
                  +---> [Dry Gain: 1.0 -> 0.0] --------------------------+
                  |                                                      |
[HTML5 Audio] ----+       +---> [Splitter Ch 0 (Left)]  ---> [Wet Gain] -+---> [Speaker Destination]
                  |       |                                    ^
                  +-------+---> [Splitter Ch 1] -> [Invert -1] -+
                  |       |                                    ^
                  +---> [Biquad Low-Pass Filter (<150Hz)] -----+
```

---

## 3. Deteksi Nada Mikrofon & `PitchTracker` (`src/services/pitchDetection.ts`)

Modul ini bertanggung jawab menganalisis suara penyanyi secara langsung melalui input mikrofon saat mode kompetisi (*Competition Mode*) aktif.

### 1. Algoritma Autokorelasi (Autocorrelation)
Deteksi nada menggunakan autokorelasi domain waktu pada buffer `Float32Array` dari `AnalyserNode` (ukuran FFT: 2048):
1. **Perhitungan RMS**: Jika nilai energi RMS sinyal $< 0.01$, sinyal dianggap sebagai hening (*silence*).
2. **Korelasi Silang**: Menghitung kesamaan gelombang dengan pergeseran waktu dirinya sendiri:
   $$R(k) = \sum_{i=0}^{N-k} x[i] \cdot x[i+k]$$
3. **Interpolasi Parabolik**: Untuk menemukan puncak periode gelombang ($T_0$) dengan presisi sub-sampel.
4. **Validasi Frekuensi**: Hanya menerima frekuensi pada rentang vokal manusia yang valid (60 Hz – 1500 Hz) dengan ambang keyakinan (*confidence*) $> 0.6$.

### 2. Konversi Frekuensi ke Not Nada & Cents
Formula standar MIDI dan nada dasar:
$$\text{noteNum} = 12 \times \log_2\left(\frac{f}{440}\right)$$
$$\text{midi} = \text{round}(\text{noteNum}) + 69$$
$$\text{cents} = \lfloor(\text{noteNum} - \text{round}(\text{noteNum})) \times 100\rfloor$$

### 3. Perhitungan Skor Berjalan (Live Pitch Score)
- Skor dihitung dari tingkat keyakinan (*clarity*) dikurangi penalti deviasi cents (maksimal 30 poin penalti).
- Rata-rata bergerak (*moving average*) dari 50 frame terakhir diakumulasikan untuk menghasilkan skor live yang stabil dan adil (skala 50 – 100).

---

## 4. Parser & Editor Lirik (`src/services/lyricParser.ts`)

Modul ini menangani pembacaan, manipulasi, dan serialisasi file lirik lagu.

### Fitur & Format yang Didukung:
1. **Standard LRC**: Format `[mm:ss.xx] Baris lirik lagu`.
2. **Enhanced LRC (Per-Word / Syllable)**: Format suku kata dengan tag waktu di dalam baris, misalnya:
   `[00:15.50] <00:15.50>Yap <00:16.20>pari <00:17.00>ano <00:17.80>hi`
3. **Pemisah Teks Romaji/Kanji**: Mendukung pemisah karakter pipa (` | `) untuk menampilkan teks asli Jepang dan panduan pelafalan Romaji secara bersamaan:
   `[00:39.50] 前前前世から僕は | Zenzenzense kara boku wa`
4. **Tokenisasi Otomatis**: Mendukung pemisahan kata berdasarkan spasi (bahasa Indonesia/Inggris/Romaji) maupun pemecahan karakter CJK (Kanji/Hiragana/Katakana) per-mora.
5. **Kurva Pacing Timing Lirik**:
   - `linear`: Pembagian durasi sama rata ke setiap kata.
   - `hold_ending`: Menahan kata terakhir lebih panjang (50% dari total durasi baris), cocok untuk vokal nada panjang (*held note / melisma*).
   - `accelerate`: Tempo vokal semakin cepat di akhir baris.
   - `decelerate`: Tempo vokal melambat di akhir baris.
   - `weighted`: Durasi kata proporsional terhadap panjang karakter hurufnya.

---

## 5. Layanan Preset & Disk Persistence (`src/services/presetService.ts`)

`PresetService` menyediakan katalog lagu anime siap pakai yang disimpan secara permanen di hard drive server:
- Saat browser pertama kali dimuat, service melakukan request `GET /api/presets` ke server Node.js lokal.
- Lagu dari server digabungkan (*merged*) dengan `localStorage` browser.
- Memungkinkan impor dan ekspor pustaka lagu dalam format JSON.

---

## 6. Ekstraksi Metadata & Layanan LRCLIB

### `metadataExtractor.ts`
Menggunakan library `music-metadata-browser` untuk membaca tag biner ID3 langsung di sisi klien saat pengguna mengunggah file MP3 atau MP4:
- Mengekstrak **Judul Lagu**, **Nama Artis**, **Nama Album**, **Durasi**, dan **Cover Art** (dikonversi ke Base64 Data URL).

### `lrclibService.ts`
Menyediakan integrasi langsung dengan REST API publik [LRCLIB](https://lrclib.net):
- Melakukan pencarian lirik tersinkronisasi berdasarkan query judul dan artis secara gratis tanpa memerlukan autentikasi API key.
