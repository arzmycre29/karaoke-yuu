# Katalog Komponen UI: J-Stage Karaoke

Dokumen ini memuat katalog lengkap komponen antarmuka pengguna (UI), hierarki modular, kontrak properti (props), serta tanggung jawab dari setiap komponen pada proyek **J-Stage Karaoke**.

---

## 1. Komponen View Utama (`src/components/views/`)

Komponen view merepresentasikan empat layar utama aplikasi yang dapat diakses via query parameter URL `?view=<type>`.

### 1.1 `StageView.tsx`
- **Tujuan**: Tampilan panggung resolusi penuh untuk proyektor/TV.
- **Props**:
  ```typescript
  interface StageViewProps {
    state: AppState;
    onNavigateToOperator?: () => void;
  }
  ```
- **Fitur Utama**:
  - Banner panggung elegan menampilkan judul lagu, nama penyanyi, judul anime, dan badge mode (*TRAIN* atau *COMPETITION*).
  - Tampilan video/audio dinamis (`YouTubePlayer` atau `LocalMediaPlayer`).
  - Lirik karaoke bersapu dinamis (`KaraokeLyricsView`) dengan dukungan tiga ukuran font: *Normal (S)*, *Large (M)*, *Massive (XL)*.
  - Tampilan visualizer nada (`PitchVisualizer`) jika dalam mode kompetisi.
  - Ticker marquee berjalan di baris bawah untuk antrean lagu berikutnya.
  - Tombol pintas mode layar penuh (*Fullscreen Toggle*).
  - Dialog overlay leaderboard pemenang panggung (`LeaderboardOverlay`).

### 1.2 `OperatorView.tsx`
- **Tujuan**: Pusat komando komprehensif bagi operator acara untuk mengendalikan seluruh sistem.
- **Props**:
  ```typescript
  interface OperatorViewProps {
    state: AppState;
    onOpenQrModal: () => void;
  }
  ```
- **Fitur & Tab Utama**:
  - **Playback Controller**: Play, Pause, Next Song, Replay, Stop, Seekbar dengan drag-protection, slider volume, dan sakelar mute.
  - **Audio Engine Selector**: Sakelar *Vocal Guide (Vokal ON)* vs *Instrumental (Vokal OFF)* dengan deteksi otomatis dual-track atau DSP filter.
  - **Tab YouTube Search**: Pencarian judul lagu/anime langsung dari antarmuka via backend `/api/youtube/search`, filter khusus instrumental, dan tombol *Queue* instan.
  - **Tab Local Media Upload**: Form upload file media lokal (MP4, WebM, MP3, WAV), input track instrumental terpisah, parser ID3 metadata otomatis, dan textarea lirik LRC.
  - **Tab Presets Manager**: Koleksi lagu anime siap pakai, integrasi penyimpanan disk permanen, tombol salin judul, dan impor/ekspor JSON.
  - **Tab LRCLIB Search**: Pencarian lirik tersinkronisasi online dari database LRCLIB publik.
  - **TapSync Lyric Editor**: Modal editor lirik per-baris dan per-suku-kata dengan YouTube playback sinkron.
  - **Scoring & Contest Settings**: Konfigurasi bobot penilaian (persentase skor nada mikrofon vs skor rata-rata juri), serta bobot per kriteria.
  - **SFX Trigger Panel**: Tombol pemicu efek suara (tepuk tangan, gong, sorak sorai, lagu kemenangan).

### 1.3 `JudgeView.tsx`
- **Tujuan**: Panel penilaian mobile-first bagi dewan juri kontes.
- **Props**:
  ```typescript
  interface JudgeViewProps {
    state: AppState;
  }
  ```
- **Fitur Utama**:
  - Pemilihan identitas juri (Juri 1, Juri 2, Juri 3, dsb) yang disimpan di `localStorage`.
  - Kartu informasi peserta yang sedang tampil di atas panggung.
  - Slider skor interaktif (0-100) untuk setiap kriteria penilaian (`ScoringCriterion`).
  - Perhitungan skor agregat tertimbang otomatis (*weighted average*).
  - Kolom catatan & komentar juri untuk evaluasi peserta.
  - Tombol kirim skor (*Submit Score*) yang langsung terhubung ke master state via WebSocket.

### 1.4 `AudienceRequestView.tsx`
- **Tujuan**: Antarmuka bersih bagi penonton acara untuk menambahkan lagu anime ke antrean panggung.
- **Props**: Tidak memerlukan props (terhubung langsung ke `SyncService` dan `PresetService`).
- **Fitur Utama**:
  - Form input: Nama Peminta/Penyanyi, Judul Lagu/Anime, Nama Artis, dan URL YouTube (opsional).
  - Pilihan cepat (*Quick Pick*) dari preset lagu populer anime yang tersedia.
  - Notifikasi konfirmasi berhasil masuk antrean.

---

## 2. Komponen Pemutar Media (`src/components/player/`)

Komponen pemutar bertanggung jawab atas rendering audio/video serta pelaporan posisi waktu playback ke `SyncService`.

### 2.1 `YouTubePlayer.tsx`
- **Props**:
  ```typescript
  interface YouTubePlayerProps {
    youtubeId: string;
    isPlaying: boolean;
    volume?: number; // 0-100
    isMuted?: boolean;
    playerCommand?: PlayerCommand | null;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onEnded?: () => void;
    isStageView?: boolean;
  }
  ```
- **Karakteristik & Mekanisme**:
  - Memuat YouTube IFrame API secara dinamis jika belum ada di `window.YT`.
  - Menghasilkan ID elemen DOM unik per instance untuk mencegah konflik render multi-player.
  - Menerapkan fungsi `enforceDisableCaptions` secara berkala untuk menonaktifkan subtitle bawaan YouTube yang sering menutupi lirik karaoke.
  - Interval polling presisi 50ms untuk mengirimkan `onTimeUpdate` ke parent.

### 2.2 `LocalMediaPlayer.tsx`
- **Props**:
  ```typescript
  interface LocalMediaPlayerProps {
    mediaUrl: string;
    instrumentalUrl?: string;
    isPlaying: boolean;
    isVideo?: boolean;
    coverArt?: string;
    volume?: number;
    isMuted?: boolean;
    vocalGuide?: boolean;
    playerCommand?: PlayerCommand | null;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onEnded?: () => void;
    isStageView?: boolean;
  }
  ```
- **Karakteristik & Mekanisme**:
  - **Dual-Element Architecture**: Mengelola dua elemen HTML5 (`<video>`/`<audio>` untuk track vokal utama dan `<audio>` untuk track instrumental studio).
  - Menangani peralihan mulus antara mode vokal dan instrumental dengan mempertahankan sinkronisasi `currentTime`.
  - Jika file instrumental independen tidak ada, otomatis menginisialisasi `VocalRemoverEngine` (Web Audio DSP filter).

---

## 3. Komponen Khusus Karaoke & Panggung (`src/components/karaoke/`)

### 3.1 `KaraokeLyricsView.tsx`
- **Props**:
  ```typescript
  interface KaraokeLyricsViewProps {
    lyrics?: LyricLine[];
    currentTime: number;
    showRomaji?: boolean;
    fontSize?: 'normal' | 'large' | 'massive';
  }
  ```
- **Fitur Utama**:
  - **Active Line Detection**: Menghitung baris lirik aktif saat ini berdasarkan `currentTime`.
  - **Intro & Instrumental Break Banner**: Menampilkan hitung mundur waktu bernyanyi jika lagu baru mulai atau sedang berada pada jeda melodi instrumen.
  - **Progressive Syllable Sweep**: Jika lirik berformat *Enhanced LRC* (memiliki kata/suku kata dengan timestamp), teks disapu kata-demi-kata dengan efek gradien warna neon-pink yang menyala.
  - **Next Line Preview**: Menampilkan pratinjau baris lirik berikutnya agar penyanyi dapat bersiap.

### 3.2 `PitchVisualizer.tsx`
- **Props**:
  ```typescript
  interface PitchVisualizerProps {
    pitchData: LivePitchData;
    showScore?: boolean;
  }
  ```
- **Fitur Utama**:
  - Menampilkan not nada yang sedang dinyanyikan penyanyi secara real-time (misal: `C4`, `G#4`, `A3`).
  - Indikator akurasi nada (*cents accuracy*) dan kejelasan sinyal vokal (*clarity*).
  - Pengukur skor nada berjalan (*Live Pitch Score meter*).

### 3.3 `LeaderboardOverlay.tsx`
- **Props**:
  ```typescript
  interface LeaderboardOverlayProps {
    history: ParticipantScore[];
    scoringConfig: ScoringConfig;
    activeSummary?: ParticipantScore | null;
    onClose: () => void;
  }
  ```
- **Fitur Utama**:
  - Podium visual untuk Juara 1, 2, dan 3 dengan animasi efek panggung.
  - Daftar peringkat lengkap dengan rincian skor nada (*Pitch Score*), skor rata-rata juri (*Judge Average*), dan skor akhir tertimbang (*Final Score*).
  - Efek ledakan konfeti (*Canvas Confetti*) saat pemenang diumumkan.

### 3.4 `SoundEffectsPlayer.tsx`
- **Props**: Tidak memerlukan props (komponen pendengar latar belakang).
- **Fitur Utama**:
  - Memantau properti `soundFxTrigger` pada `AppState`.
  - Menggunakan **Web Audio API Synthesizer** murni untuk menghasilkan audio tepuk tangan (*applause*), gong penutup, dan terompet kemenangan (*fanfare*).
  - Melindungi sistem agar tidak memutar efek suara lama dari `localStorage` saat halaman baru dimuat.

### 3.5 `TapSyncEditor.tsx`
- **Props**:
  ```typescript
  interface TapSyncEditorProps {
    song?: Song | null;
    initialLyricsText?: string;
    onSaveLyrics: (parsedLyrics: LyricLine[], rawLrc: string) => void;
    onCancel: () => void;
    audioDuration?: number;
  }
  ```
- **Fitur Utama**:
  - Tiga mode editing: *Raw Text Mode*, *Line-Tap Mode*, dan *Advance Syllable Mode*.
  - Pemutar video YouTube sinkron di samping teks lirik.
  - Fitur pengetukan keyboard (*Spacebar / Enter*) untuk merekam timestamp baris dan suku kata secara intuitif.
  - Kurva pacing timing bawaan (*linear*, *hold ending*, *accelerate*, *decelerate*, *weighted*).
  - Fitur ekspor kembali ke format file teks `.lrc` standar.

---

## 4. Komponen Navigasi & Utilitas (`src/components/common/`)

### 4.1 `Navigation.tsx`
- Bar navigasi atas yang hanya muncul pada `OperatorView` dan `JudgeView`.
- Menyediakan tombol pemilih view cepat, sakelar mode panggung (*Train vs Competition*), dan tombol pembuka QR Code.

### 4.2 `QrCodeModal.tsx`
- Modal dialog untuk menampilkan kode QR yang dapat dipindai oleh smartphone juri atau penonton.
- Menampilkan alamat IP lokal jaringan (LAN) agar perangkat lain dalam satu jaringan Wi-Fi dapat langsung terhubung.
