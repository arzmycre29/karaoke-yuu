# Panduan Pemeliharaan & Pengembangan Dokumentasi (Living Docs SOP)

Dokumen ini adalah **Standard Operating Procedure (SOP)** dan panduan praktis bagi pengembang dan AI agent untuk memelihara dan memperbarui dokumentasi proyek **J-Stage Karaoke** seiring penambahan fitur, refaktor, atau perubahan arsitektur.

---

## 🎯 Filosofi Living Documentation

Dokumentasi yang tidak dirawat akan cepat usang dan kehilangan nilainya. Di proyek ini, **dokumentasi dianggap setara dengan kode sumber**:
- Setiap perubahan pada struktur data, komponen, atau protokol jaringan **wajib** disertai pembaruan pada dokumen dan Knowledge Graph terkait dalam commit/PR yang sama.
- Diagram Mermaid pada `docs/knowledge-graph.md` harus selalu mencerminkan topologi dan alur data nyata dari kode terkini.

---

## 📋 Matriks Pembaruan Berdasarkan Jenis Perubahan

Gunakan tabel referensi cepat ini untuk mengetahui file dokumentasi mana saja yang harus Anda perbarui ketika melakukan perubahan kode:

| Jenis Perubahan Kode | File Kode Terkait | File Dokumentasi yang Wajib Diperbarui |
|---|---|---|
| **Menambah View / Peran Layar Baru** (misal: *Host/MC View*, *Prompter View*) | `src/types/karaoke.ts`<br/>`src/App.tsx`<br/>`src/components/views/` | `docs/knowledge-graph.md` (Bagian 1 & 2)<br/>`docs/components.md` (Bagian 1)<br/>`docs/architecture.md` |
| **Menambah Properti State Baru** | `src/types/karaoke.ts`<br/>`src/services/syncService.ts` | `docs/api-and-socket.md` (Bagian 3)<br/>`docs/knowledge-graph.md` (Bagian 5) |
| **Menambah / Mengubah Event WebSocket** | `server/server.js`<br/>`src/services/syncService.ts` | `docs/api-and-socket.md` (Bagian 2)<br/>`docs/knowledge-graph.md` (Bagian 3) |
| **Menambah Endpoint REST API Backend** | `server/server.js` | `docs/api-and-socket.md` (Bagian 1)<br/>`docs/knowledge-graph.md` (Bagian 1) |
| **Menambah Fitur Audio DSP / Efek Vokal** (misal: *Key Transpose*, *Reverb*, *Echo*) | `src/services/vocalRemover.ts`<br/>`src/components/player/` | `docs/services-and-dsp.md` (Bagian 2)<br/>`docs/knowledge-graph.md` (Bagian 4)<br/>`docs/decisions/` (jika ada keputusan arsitektural) |
| **Menambah Parser / Dukungan Format Lirik** (misal: *ASS*, *SRT*, *Ruby Kana*) | `src/services/lyricParser.ts` | `docs/services-and-dsp.md` (Bagian 4) |
| **Membuat Keputusan Arsitektur Besar** | Seluruh repositori | Buat file baru di `docs/decisions/ADR-XXX-judul.md`<br/>Perbarui daftar di `docs/README.md` |

---

## 🛠️ Langkah Demi Langkah Pembaruan (Step-by-Step SOP)

### Skenario 1: Menambahkan View Baru (Contoh: `PrompterView`)
1. **Perbarui Tipe**: Tambahkan `'prompter'` ke `ViewType` pada `src/types/karaoke.ts`.
2. **Implementasikan Komponen**: Buat `src/components/views/PrompterView.tsx` dan kaitkan pada switch di `src/App.tsx`.
3. **Perbarui `docs/components.md`**: Tambahkan subjudul baru di Bagian 1 (`PrompterView.tsx`), jelaskan tujuan dan props interface-nya.
4. **Perbarui `docs/knowledge-graph.md`**:
   - Di Diagram 1 (*System & Network Topology*), tambahkan node `Prompter` di dalam grup `Clients`.
   - Di Diagram 2 (*Component Knowledge Graph*), tambahkan relasi `App --> PrompterView`.

### Skenario 2: Menambahkan Field Baru pada `AppState`
1. **Perbarui Interface**: Tambahkan field baru (misalnya `pitchCorrectionEnabled: boolean`) ke `AppState` di `src/types/karaoke.ts`.
2. **Inisialisasi Default**: Tambahkan nilai default di `DEFAULT_INITIAL_STATE` pada `src/services/syncService.ts`.
3. **Perbarui `docs/api-and-socket.md`**: Perbarui blok interface `AppState` pada Bagian 3 dengan komentar penjelasan.
4. **Perbarui `docs/knowledge-graph.md`**: Jika field tersebut merepresentasikan entitas baru atau relasi baru, perbarui diagram Entity-Relationship di Bagian 5.

### Skenario 3: Menambahkan Efek Audio Baru (Contoh: *Key Transpose / Pitch Shift*)
1. **Implementasi DSP**: Buat node audio baru (misal menggunakan SoundTouchJS atau Web Audio delay-based pitch shifter) di `src/services/`.
2. **Perbarui `docs/services-and-dsp.md`**: Tuliskan penjelasan teori matematika, diagram alir node Web Audio, dan parameter gain/frekuensi yang digunakan.
3. **Perbarui `docs/knowledge-graph.md`**: Di Diagram 4 (*Audio Engineering Pipeline*), tambahkan node efek baru di antara `SourceNode` dan `Destination`.

---

## 📝 Konvensi Penulisan ADR Baru

Gunakan struktur standar berikut saat membuat catatan keputusan arsitektur baru di `docs/decisions/`:

- **Format Penamaan**: `ADR-[Nomor-3-Digit]-[judul-singkat-kebab-case].md` (contoh: `ADR-003-webrtc-audio-streaming.md`).
- **Template Standar**:
  ```markdown
  # ADR-003: [Judul Keputusan]

  ## Status
  Proposed | Accepted | Superseded by ADR-XXX | Deprecated

  ## Tanggal
  YYYY-MM-DD

  ## Konteks
  [Jelaskan masalah, latar belakang, dan batasan yang dihadapi]

  ## Keputusan
  [Jelaskan solusi arsitektur yang dipilih]

  ## Alternatif yang Dipertimbangkan
  ### Alternatif A
  - Pros / Cons
  - Alasan Ditolak

  ## Konsekuensi
  - Dampak positif terhadap sistem
  - Dampak negatif atau batasan yang perlu dimitigasi
  ```

---

## ✅ Checklist Sebelum Merge / Selesai Bekerja

Sebelum menyelesaikan sesi pengembangan atau mengajukan perubahan kode, pastikan:

- [ ] Seluruh endpoint baru di `server.js` tercatat di `docs/api-and-socket.md`.
- [ ] Seluruh komponen baru di `src/components/` terdokumentasi di `docs/components.md`.
- [ ] Diagram Mermaid di `docs/knowledge-graph.md` valid dan tidak memiliki sintaks error.
- [ ] Perubahan algoritma atau logika audio DSP dijelaskan di `docs/services-and-dsp.md`.
- [ ] Tautan antar file dokumen markdown valid dan dapat diklik.
- [ ] Kode lulus pengecekan linter (`npm run lint`) dan build (`npm run build`).
