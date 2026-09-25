# Dokumentasi Teknis J-Stage Karaoke

Selamat datang di pusat dokumentasi resmi **J-Stage Karaoke**. Dokumen ini dirancang sebagai panduan lengkap yang modular dan mudah diperbarui (*living documentation*) untuk arsitek perangkat lunak, pengembang, teknisi audio acara, dan AI agent yang bekerja pada proyek ini.

---

## 🗺️ Peta Navigasi Dokumentasi (Sitemap)

Dokumentasi dibagi menjadi beberapa dokumen terfokus:

| Dokumen | Topik Pembahasan | Target Pembaca |
|---|---|---|
| [**Knowledge Graph**](knowledge-graph.md) | Diagram interaktif Mermaid untuk topologi, hierarki komponen, alur data, dan relasi data. | Semua Pengembang & AI Agent |
| [**Arsitektur Sistem**](architecture.md) | Filosofi multi-layar, paradigma state master, latensi panggung, dan strategi multi-device. | System Architects & Tech Leads |
| [**Katalog Komponen UI**](components.md) | Rincian setiap view, komponen player, subkomponen karaoke, dan kontrak antarmuka props. | Frontend Engineers |
| [**Layanan & Audio DSP**](services-and-dsp.md) | Mesin sinkronisasi, deteksi pitch, pemfilteran vokal Web Audio API, dan parser lirik LRC. | Audio/DSP & Core Engineers |
| [**Spesifikasi API & Socket**](api-and-socket.md) | Kontrak REST API Express, daftar event Socket.io, dan skema `AppState`. | Fullstack & Backend Engineers |
| [**Panduan Pemeliharaan (SOP)**](maintenance-and-extension-guide.md) | Checklist dan panduan cara memperbarui dokumentasi ini saat kode diperbarui. | Kontributor & AI Agent |
| [**ADR-001: Hybrid Sync**](decisions/ADR-001-hybrid-sync-architecture.md) | Catatan keputusan arsitektur: BroadcastChannel + Socket.io + LocalStorage. | Tim Engineering |
| [**ADR-002: DSP Vocal Remover**](decisions/ADR-002-web-audio-dsp-vocal-removal.md) | Catatan keputusan arsitektur: Phase Inversion real-time Web Audio API. | Tim Engineering |

---

## ⚡ Ringkasan Cepat Proyek (Executive Summary)

- **Nama Aplikasi**: J-Stage Karaoke (`j-stage-karaoke`)
- **Tujuan**: Sistem karaoke panggung multi-layar real-time untuk festival anime, sesi gathering komunitas, dan kompetisi menyanyi (*singing contest*).
- **Teknologi Utama**:
  - **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Lucide React, Canvas Confetti.
  - **Backend**: Node.js ESM, Express 5, Socket.io 4, `yt-search`.
  - **Audio & Media**: Web Audio API DSP, YouTube IFrame API, HTML5 Media Streaming (HTTP 206 Partial Content).
  - **Metadata & Lirik**: `music-metadata-browser` (ID3 Tagging), LRCLIB Integration, Custom LRC/Enhanced LRC Parser.

---

## 🚀 Menjalankan Aplikasi Secara Lokal

### 1. Menjalankan Backend Sync & Storage Server
```bash
node server/server.js
# Server aktif di http://localhost:3001 (dan mendeteksi IP lokal LAN)
```

### 2. Menjalankan Frontend Dev Server
```bash
npm run dev
# Frontend aktif di http://localhost:5173
```

### 3. Membuka Tampilan Berdasarkan Peran
- **Layar Panggung (Proyektor)**: Buka `http://localhost:5173/?view=stage`
- **Dasbor Operator (Kontrol Utama)**: Buka `http://localhost:5173/?view=operator`
- **Panel Dewan Juri**: Buka `http://<IP_LAN>:5173/?view=judge`
- **Portal Request Penonton**: Scan QR code atau buka `http://<IP_LAN>:5173/?view=request`

---

## 🔄 Prinsip Living Documentation

Dokumentasi ini bukan sekadar catatan statis, melainkan bagian integral dari repositori kode:
1. **Sinkronisasi Kode & Dokumen**: Setiap kali ada penambahan fitur, perubahan skema tipe, atau endpoint baru, file dokumentasi terkait **wajib** diperbarui dalam PR/commit yang sama.
2. **Pedoman Pembaruan**: Ikuti petunjuk terperinci pada [Panduan Pemeliharaan Dokumentasi](maintenance-and-extension-guide.md).
