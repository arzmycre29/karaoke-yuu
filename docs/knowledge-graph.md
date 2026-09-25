# Knowledge Graph: J-Stage Karaoke

Dokumen ini memetakan seluruh arsitektur, modul, dependensi, alur data, dan relasi entitas sistem **J-Stage Karaoke** dalam bentuk **Knowledge Graph** berbasis diagram Mermaid. 

---

## 1. Topologi Jaringan & Sistem (System & Network Topology)

Diagram ini mengilustrasikan interaksi fisik dan protokol antar piranti pengguna (Operator, Layar Panggung, Juri, Penonton) dengan Backend Sync Server dan Layanan Eksternal.

```mermaid
flowchart TB
    subgraph Clients["Lapisan Klien / User Interfaces"]
        Operator["Operator Console<br/>(Desktop / Laptop)<br/>?view=operator"]
        Stage["Stage Projector Display<br/>(Full-Screen TV / LED)<br/>?view=stage"]
        Judges["Judge Panels<br/>(Tablet / Smartphone)<br/>?view=judge"]
        Audience["Audience Smartphones<br/>(Mobile Web Browser)<br/>?view=request"]
    end

    subgraph InternalComms["Protokol Komunikasi Real-Time"]
        BC["BroadcastChannel API<br/>('j_stage_karaoke_sync_v1')<br/>Zero-Latency Cross-Tab Sync"]
        WS["Socket.io WebSocket<br/>(Port 3001)<br/>LAN Multi-Device Broadcast"]
        HTTP_API["Express HTTP REST API<br/>(Uploads & Presets)"]
    end

    subgraph BackendServer["Node.js / Express Server (server.js)"]
        ServerCore["Express App & HTTP Server"]
        SocketServer["Socket.io Engine"]
        MediaDir[("server/media/<br/>Binary Audio & Video")]
        PresetFile[("server/data/presets.json<br/>Permanent Presets")]
        YtSearch["yt-search Module<br/>(Scraper API)"]
    end

    subgraph ExternalServices["Layanan Eksternal (Cloud / Third-Party)"]
        YT["YouTube CDN & IFrame Player API"]
        LRCLIB["LRCLIB API<br/>(https://lrclib.net)"]
        Unsplash["Unsplash CDN<br/>(Sample Cover Images)"]
    end

    %% Client communication
    Operator <-->|"Cross-tab (Local)"| BC
    Stage <-->|"Cross-tab (Local)"| BC
    
    Operator <-->|"WebSocket Events"| WS
    Stage <-->|"WebSocket Events"| WS
    Judges <-->|"WebSocket Events"| WS
    Audience <-->|"WebSocket Events"| WS

    Operator -->|"POST /api/upload<br/>GET/POST /api/presets"| HTTP_API
    Operator -->|"GET /api/youtube/search"| HTTP_API

    %% Backend internal
    WS <--> SocketServer
    HTTP_API --> ServerCore
    ServerCore --> MediaDir
    ServerCore --> PresetFile
    ServerCore --> YtSearch

    %% External connections
    Stage -->|"Stream Video/Audio"| YT
    Operator -->|"Stream Video/Audio"| YT
    Operator -->|"Query Synced LRC"| LRCLIB
    Stage -->|"Fetch Cover Art"| Unsplash
    ServerCore -->|"Search Metadata"| YT
```

---

## 2. Hierarki Komponen UI & Visual Layout (Component Knowledge Graph)

Diagram ini memetakan dekomposisi antarmuka React dari root `App.tsx` ke setiap view spesifik, komponen pemutar, dan overlay interaktif.

```mermaid
graph TD
    App["App.tsx<br/>(Root Container & Routing)"]

    %% Common
    Nav["Navigation.tsx<br/>(Header Control Bar)"]
    QrModal["QrCodeModal.tsx<br/>(LAN IP & QR Generator)"]
    SfxNode["SoundEffectsPlayer.tsx<br/>(Web Audio Synthesizer)"]

    %% Views
    StageView["StageView.tsx<br/>(Projector Screen)"]
    OperatorView["OperatorView.tsx<br/>(Master Control Console)"]
    JudgeView["JudgeView.tsx<br/>(Judging Interface)"]
    AudienceView["AudienceRequestView.tsx<br/>(Mobile Request Form)"]

    %% Stage Subcomponents
    YtPlayer["YouTubePlayer.tsx<br/>(IFrame Audio/Video)"]
    LocalPlayer["LocalMediaPlayer.tsx<br/>(Dual-Track HTML5 Media)"]
    LyricsView["KaraokeLyricsView.tsx<br/>(Progressive Syllable Sweep)"]
    PitchVis["PitchVisualizer.tsx<br/>(Real-time Canvas / SVG Meter)"]
    Leaderboard["LeaderboardOverlay.tsx<br/>(Rankings & Winner Podium)"]

    %% Operator Subcomponents
    TapSync["TapSyncEditor.tsx<br/>(LRC Editor & Syllable Timing)"]

    %% Connections
    App --> Nav
    App --> QrModal
    App --> SfxNode
    App --> StageView
    App --> OperatorView
    App --> JudgeView
    App --> AudienceView

    StageView --> YtPlayer
    StageView --> LocalPlayer
    StageView --> LyricsView
    StageView --> PitchVis
    StageView --> Leaderboard

    OperatorView --> TapSync
    OperatorView --> PitchVis
    OperatorView --> Leaderboard
    OperatorView --> QrModal

    TapSync --> YtPlayer
```

---

## 3. Alur Data & Siklus Sinkronisasi State (Data Flow & State Lifecycle)

Diagram ini memvisualisasikan bagaimana perubahan state dieksekusi, disiarkan, dan disinkronkan ke seluruh klien.

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operator Console
    participant Sync as SyncService (Singleton)
    participant BC as BroadcastChannel
    participant SIO as Socket.io Server
    actor Stage as Stage View (Proyektor)
    actor Judge as Judge Panel
    participant Storage as localStorage

    Note over Operator,Sync: Operator menambah lagu / menekan Play
    Operator->>Sync: updateState({ isPlaying: true })
    
    par Sinkronisasi Lokal (Tab yang sama / Browser yang sama)
        Sync->>BC: postMessage('STATE_UPDATE', newState)
        BC->>Stage: onmessage -> update local React state
    and Sinkronisasi Jaringan (LAN / Wi-Fi)
        Sync->>SIO: socket.emit('UPDATE_STATE', newState)
        SIO->>Stage: socket.broadcast('STATE_UPDATE', newState)
        SIO->>Judge: socket.broadcast('STATE_UPDATE', newState)
    and Persistensi Lokal
        Sync->>Storage: saveStateToStorage() (Throttled 1s)
    end

    Note over Stage,Sync: Stage Player memutar media & memancarkan waktu
    loop Setiap Frame Pemutaran (Time Update)
        Stage->>Sync: updateTime(currentTime, duration)
        Sync-->>BC: postMessage('TIME_UPDATE')
        Sync-->>SIO: socket.emit('TIME_UPDATE')
        SIO-->>Operator: 'TIME_UPDATE' (Sync Seekbar & Lyrics)
    end
```

---

## 4. Pipeline Audio DSP & Deteksi Pitch (Audio Engineering Pipeline)

Diagram ini merinci dua alur pemrosesan audio berbasis **Web Audio API**:
1. **Vocal Cancellation Engine** (Pemisahan vokal kanal tengah).
2. **Pitch Tracker Engine** (Analisis frekuensi mikrofon untuk kompetisi).

```mermaid
flowchart LR
    subgraph VocalRemover["VocalRemoverEngine (Center-Channel Phase Cancellation)"]
        MediaIn["HTMLMediaElement<br/>(Audio / Video Tag)"] --> SourceNode["MediaElementSourceNode"]
        
        %% Dry Path
        SourceNode -->|"Stereo Asli"| DryGain["Dry GainNode<br/>(Gain: 1.0 -> 0.0)"]
        DryGain --> Destination["AudioContext.destination<br/>(Speaker / Sound Output)"]
        
        %% Wet Path
        SourceNode --> Splitter["ChannelSplitterNode<br/>(Channels: 0=L, 1=R)"]
        SourceNode --> BassFilter["BiquadFilterNode<br/>(Low-Pass < 150Hz)"]
        
        Splitter -->|"Left Channel (L)"| WetGain["Wet GainNode<br/>(Gain: 0.0 -> 1.0)"]
        Splitter -->|"Right Channel (R)"| Inverter["Inverter GainNode<br/>(Gain: -1.0)"]
        Inverter -->|"Inverted Right (-R)"| WetGain
        BassFilter -->|"Preserved Bass Mono"| WetGain
        WetGain --> Destination
    end

    subgraph PitchTracker["PitchTracker Engine (Microphone Analysis)"]
        Mic["Microphone Input<br/>(getUserMedia)"] --> MicSource["MediaStreamAudioSourceNode"]
        MicSource --> Analyser["AnalyserNode<br/>(fftSize: 2048)"]
        Analyser --> TimeDomain["Float32Array Buffer<br/>(Time Domain Data)"]
        TimeDomain --> AutoCorr["autoCorrelate Algorithm<br/>(Normalized RMS + Peak Search)"]
        AutoCorr --> Freq["Detected Frequency (Hz)<br/>& Confidence (> 0.6)"]
        Freq --> NoteConvert["frequencyToNote Formula<br/>(MIDI, Note Name, Cents)"]
        NoteConvert --> ScoreCalc["Cent Penalty & Moving Average<br/>(0 - 100 Live Score)"]
    end
```

---

## 5. Model Data & Relasi Entitas (Entity-Relationship Graph)

Diagram ini mengilustrasikan struktur tipe data TypeScript dan bagaimana entitas saling berhubungan di dalam `AppState`.

```mermaid
erDiagram
    AppState ||--o| QueueItem : "currentQueueItem"
    AppState ||--o{ QueueItem : "queue (waiting list)"
    AppState ||--o{ ParticipantScore : "history (leaderboard)"
    AppState ||--o{ JudgeInfo : "judges (panelists)"
    AppState ||--o{ JudgeSubmission : "submissions (active song)"
    AppState ||--|| ScoringConfig : "scoringConfig"
    AppState ||--|| LivePitchData : "livePitch"
    AppState ||--o| PlayerCommand : "playerCommand"

    QueueItem ||--|| Song : "contains song metadata"
    Song ||--o{ LyricLine : "parsedLyrics"
    LyricLine ||--o{ LyricWord : "words (enhanced syllable)"

    ScoringConfig ||--o{ ScoringCriterion : "criteria"
    ParticipantScore ||--|| QueueItem : "queueItemId"
    JudgeSubmission ||--|| QueueItem : "queueItemId"
    JudgeSubmission ||--|| JudgeInfo : "judgeId"

    Song {
        string id
        string title
        string artist
        string source "youtube | local"
        string youtubeId
        string mediaUrl
        string instrumentalUrl
        boolean isVideo
        number duration
        string rawLyrics
    }

    QueueItem {
        string id
        string singerName
        string performerNote
        string mode "train | competition"
        number addedAt
        string status "waiting | playing | completed"
    }

    ParticipantScore {
        string id
        string singerName
        string songTitle
        number pitchScore
        number judgeScore
        number finalScore
        number completedAt
    }

    JudgeSubmission {
        string judgeId
        string judgeName
        string queueItemId
        record criteriaScores
        number totalJudgeScore
        string comments
        number submittedAt
    }

    ScoringCriterion {
        string id
        string name
        number weight
        number maxScore
    }
```

---

## 6. Peta Relasi Modul Kode (Codebase Module Map)

Matriks ketergantungan antar modul dalam direktori proyek:

| Modul Sumber (`src/`) | Modul Dependensi Utama | Peran Arsitektural |
|---|---|---|
| `App.tsx` | `SyncService`, `Navigation`, Views, `SoundEffectsPlayer`, `QrCodeModal` | Root Orchestrator & View Switcher |
| `StageView.tsx` | `SyncService`, `YouTubePlayer`, `LocalMediaPlayer`, `KaraokeLyricsView`, `PitchVisualizer`, `LeaderboardOverlay` | Tampilan Layar Utama / Panggung |
| `OperatorView.tsx` | `SyncService`, `PresetService`, `PitchTracker`, `TapSyncEditor`, `lrclibService`, `metadataExtractor` | Pusat Kendali & Pengelolaan Media |
| `JudgeView.tsx` | `SyncService`, `AppState` | Panel Penjurian Kontes |
| `AudienceRequestView.tsx` | `SyncService`, `PresetService` | Portal Request Penonton |
| `TapSyncEditor.tsx` | `YouTubePlayer`, `lyricParser` | Studio Editing Timing Lirik |
| `LocalMediaPlayer.tsx` | `VocalRemoverEngine`, `types/karaoke` | Player Media Lokal Dual-Track |
| `SyncService.ts` | `socket.io-client`, `lyricParser`, `types/karaoke` | Master State Manager & Network Sync |
| `server/server.js` | `express`, `socket.io`, `yt-search`, Node `fs/path` | WebSocket Relay & Media Storage Server |

---

## 7. Cara Memperbarui Knowledge Graph Ini

Ketika kode mengalami perubahan atau penambahan fitur baru, perbarui file ini mengikuti aturan berikut:
1. **Komponen Baru**: Tambahkan node pada *Section 2 (Component Knowledge Graph)* di bawah view atau direktori yang sesuai.
2. **Field State Baru**: Perbarui *Section 5 (Entity-Relationship Graph)* jika ada entitas baru di `src/types/karaoke.ts`.
3. **Endpoint Server / WebSocket Event**: Perbarui *Section 1 (System & Network Topology)* dan `docs/api-and-socket.md`.
4. **Alur Audio / DSP Baru**: Perbarui *Section 4 (Audio Engineering Pipeline)* jika menambahkan efek vokal (reverb, equalizer, dsb).
