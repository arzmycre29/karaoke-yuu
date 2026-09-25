# 🎤 J-Stage Karaoke

> **Sistem Karaoke & Kompetisi Panggung Multi-Layar Real-Time**  
> Dirancang khusus untuk festival anime, sesi gathering komunitas (*karaoke train*), dan kontes menyanyi profesional.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-green.svg)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-black.svg)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)

---

## 🌟 Fitur Utama

- 📺 **Multi-Screen Display Architecture**:
  - **Layar Panggung (Stage Projector)**: Tampilan visual resolusi tinggi dengan teks lirik karaoke bersapu dinamis (*progressive sweep*), hitung mundur intro & solo melodi, visualizer nada, dan ticker antrean.
  - **Dasbor Operator (Command Center)**: Kontrol playback lengkap, antrean multi-sumber (YouTube search langsung, upload media lokal, disk presets), *TapSync Syllable Lyric Editor*, dan panel sound effects.
  - **Panel Dewan Juri (Judge Panel)**: Antarmuka mobile-first bagi dewan juri untuk memberi skor multi-kriteria secara real-time via smartphone.
  - **Portal Request Penonton (Audience Request)**: Formulir pengajuan lagu anime berbasis scan QR code bagi penonton panggung.
- ⚡ **Sinkronisasi Tri-Layer Real-Time**: Kombinasi latensi 0ms `BroadcastChannel` (cross-tab lokal), WebSocket `Socket.io` (antar perangkat di jaringan Wi-Fi/LAN), dan penyimpanan ter-throttle `localStorage`.
- 🎚️ **Audio Engineering & DSP**:
  - **DSP Center-Channel Vocal Remover**: Pemfilteran vokal penyanyi asli langsung di browser dengan preservasi bass (<150Hz) via Web Audio API.
  - **Dual-Track Audio System**: Sinkronisasi track instrumental studio independen dengan video/audio vokal utama.
  - **Real-Time Pitch Detection**: Analisis akurasi vokal mikrofon menggunakan algoritma *Autocorrelation* untuk skor kompetisi.
  - **Web Audio Sound Synthesizer**: Generator efek suara tepuk tangan, gong, dan fanfare kemenangan tanpa file aset eksternal.
- 📝 **Integrasi Lirik Cerdas**: Pencarian otomatis database publik [LRCLIB](https://lrclib.net), parser LRC standar, format Enhanced LRC suku kata (`<mm:ss.xx>`), serta editor ketuk lirik intuitif.

---

## 🚀 Memulai (Quick Start)

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Server Sinkronisasi & Media (Backend)
```bash
npm run server
# Server berjalan di http://localhost:3001 (dan mendeteksi IP lokal LAN)
```

### 3. Menjalankan Server Frontend (Vite)
Buka terminal baru:
```bash
npm run dev
# Frontend berjalan di http://localhost:5173
```

---

## 🧭 Tautan Navigasi Peran Layar

| Layar / Peran | URL Browser | Peruntukan Piranti |
|---|---|---|
| **Layar Panggung (Stage)** | `http://localhost:5173/?view=stage` | Layar Proyektor / TV Panggung |
| **Dasbor Operator** | `http://localhost:5173/?view=operator` | Laptop Operator Acara |
| **Panel Dewan Juri** | `http://<IP_LAN>:5173/?view=judge` | Tablet / Smartphone Juri |
| **Portal Request Penonton** | `http://<IP_LAN>:5173/?view=request` | Smartphone Penonton (Scan QR) |

*(Catatan: Tombol QR Code pada Dasbor Operator dapat diklik untuk menampilkan barcode koneksi otomatis ke alamat IP LAN).*

---

## 📚 Dokumentasi Lengkap & Knowledge Graph

Proyek ini dilengkapi dengan dokumentasi terstruktur dan **Knowledge Graph interaktif** di dalam folder `docs/`:

- 🗺️ [**Knowledge Graph Lengkap**](docs/knowledge-graph.md) — Diagram topologi jaringan, hierarki komponen React, alur data state, dan alur pemrosesan DSP Mermaid.
- 🏛️ [**Arsitektur Sistem**](docs/architecture.md) — Paradigma multi-layar, sinkronisasi tri-layer, dan toleransi latensi panggung.
- 🧩 [**Katalog Komponen UI**](docs/components.md) — Rincian seluruh komponen view, player, dan overlay karaoke.
- 🎛️ [**Layanan & Audio DSP**](docs/services-and-dsp.md) — Deteksi pitch autokorelasi, filter inversi fasa, dan parser lirik.
- 📡 [**Spesifikasi API & Socket**](docs/api-and-socket.md) — Endpoint Express, event Socket.io, dan skema data `AppState`.
- 🔄 [**Panduan Pemeliharaan (Living Docs SOP)**](docs/maintenance-and-extension-guide.md) — Panduan cara memperbarui dokumentasi seiring penambahan fitur baru.
- 📜 [**Architecture Decision Records (ADRs)**](docs/decisions/) — Catatan keputusan teknis arsitektur aplikasi.

---

## 🛠️ Perintah Pengembangan (Scripts)

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Vite development server dengan HMR |
| `npm run server` | Menjalankan backend server Express & Socket.io |
| `npm run build` | Melakukan kompilasi TypeScript dan build produksi Vite |
| `npm run lint` | Menjalankan Oxlint untuk pengecekan kualitas kode |
| `npm run preview` | Menjalankan pratinjau hasil build produksi secara lokal |

---

## 📄 Lisensi

Proyek ini bersifat *private* untuk keperluan event karaoke panggung dan komunitas anime.
