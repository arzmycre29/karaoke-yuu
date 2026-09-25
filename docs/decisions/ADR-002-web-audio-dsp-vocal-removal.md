# ADR-002: Penghilangan Vokal Real-Time dengan Web Audio API DSP Phase Inversion

## Status
Diterima (*Accepted*)

## Tanggal
2026-09-03

## Konteks
Pada event karaoke anime atau kompetisi panggung, operator sering kali mendapatkan file lagu versi standar (versi vokal asli) dari peserta, bukan versi instrumen minus-one. Pengguna membutuhkan fitur untuk mematikan suara vokal penyanyi asli secara instan (*on-the-fly*) saat pertunjukan sedang berlangsung.

Terdapat dua pendekatan utama:
1. Pemisahan stem berbasis kecerdasan buatan (*AI Stem Demixing* seperti Demucs atau Spleeter) yang dijalankan di server.
2. Pemrosesan sinyal audio digital (*DSP*) secara langsung di browser klien menggunakan **Web Audio API**.

## Keputusan
Menerapkan teknik **Center-Channel Phase Inversion dengan Preservasi Bass Low-Pass Biquad (<150Hz)** langsung di browser melalui Web Audio API (`VocalRemoverEngine`).

Jika pengguna mengunggah track studio instrumental terpisah (`instrumentalUrl`), sistem memprioritaskan pemutaran file instrumental studio murni. Jika tidak ada file instrumental terpisah, sistem otomatis beralih ke filter DSP ini.

## Alternatif yang Dipertimbangkan

### Alternatif 1: Server-Side AI Demixing (Spleeter / Demucs / MDX-Net)
- **Kelebihan**: Kualitas isolasi instrumen sangat bersih, dapat memisahkan vokal bahkan jika vokal memiliki efek stereo lebar (*stereo reverb/chorus*).
- **Kekurangan**:
  - Membutuhkan GPU bertenaga tinggi pada laptop operator.
  - Membutuhkan waktu proses 30 detik hingga beberapa menit per lagu sebelum lagu dapat diputar.
  - Tidak dapat diaktifkan/dinonaktifkan secara instan di tengah lagu (*zero-latency toggle*).
- **Alasan Ditolak**: Mengorbankan fleksibilitas panggung langsung di mana keputusan mematikan/menghidupkan vokal sering kali diambil secara spontan saat peserta naik ke panggung.

### Alternatif 2: Inversi Fasa Stereo Murni Tanpa Filter Bass
- **Kelebihan**: Algoritma sederhana ($L - R$).
- **Kekurangan**: Instrumen bas dan ketukan drum kick ikut lenyap karena berada di frekuensi rendah kanal tengah, menghasilkan audio yang tipis dan hampa (*tinny sound*).
- **Alasan Ditolak**: Merusak pengalaman musikalitas panggung.

## Konsekuensi
- **Positif**:
  - **Latensi Nol**: Pengalihan vokal ON/OFF terjadi dalam 100ms dengan transisi gain yang halus (*linear ramp*).
  - **Zero Server Overhead**: Tidak membebani server backend dengan proses komputasi tensor/AI yang berat.
  - **Dukungan Dual-Track**: Sistem fleksibel; mampu menggunakan file instrumental studio berkualitas tinggi jika tersedia, atau filter DSP jika tidak tersedia.
- **Batasan / Catatan**:
  - Inversi fasa paling efektif pada lagu dengan vokal mono di tengah. Vokal dengan efek stereo panning ekstrem atau reverb lebar mungkin masih terdengar tipis di latar belakang.
