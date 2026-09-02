import React, { useState, useRef, useEffect } from 'react';
import type { AppState, QueueItem, Song } from '../../types/karaoke';
import { SyncService } from '../../services/syncService';
import { parseLRC, exportToLRC } from '../../services/lyricParser';
import { PitchTracker } from '../../services/pitchDetection';
import { searchLrcLib, type LrcSearchResult } from '../../services/lrclibService';
import { extractAudioMetadata } from '../../services/metadataExtractor';
import { PresetService } from '../../services/presetService';
import { TapSyncEditor } from '../karaoke/TapSyncEditor';
import {
  Play, Pause, SkipForward, RotateCcw, Square,
  Volume2, VolumeX, Mic2,
  Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Flame, Trophy,
  Sliders, Music, Upload, Search, QrCode, FileText, BookmarkPlus, Download,
  FolderOpen, Disc3, Copy, Check
} from 'lucide-react';

interface OperatorViewProps {
  state: AppState;
  onOpenQrModal: () => void;
}

export const OperatorView: React.FC<OperatorViewProps> = ({ state, onOpenQrModal }) => {
  const sync = SyncService.getInstance();
  const presetService = PresetService.getInstance();

  const currentItem = state.currentQueueItem;
  const currentSong = currentItem?.song;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'youtube' | 'local' | 'presets' | 'lrclib'>('youtube');

  // YouTube In-App Direct Search
  const [ytQuery, setYtQuery] = useState<string>('');
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [isYtSearching, setIsYtSearching] = useState<boolean>(false);
  const [ytSingerName, setYtSingerName] = useState<string>('');
  const [ytSearchInstrumentalOnly, setYtSearchInstrumentalOnly] = useState<boolean>(false);

  // Local file upload states
  const [localTitle, setLocalTitle] = useState<string>('');
  const [localArtist, setLocalArtist] = useState<string>('');
  const [localSinger, setLocalSinger] = useState<string>('');
  const [localAudioUrl, setLocalAudioUrl] = useState<string>('');
  const [localInstAudioUrl, setLocalInstAudioUrl] = useState<string>('');
  const [localInstFileName, setLocalInstFileName] = useState<string>('');
  const [localLrcText, setLocalLrcText] = useState<string>('');
  const [localCoverArt, setLocalCoverArt] = useState<string | undefined>();
  const [localDuration, setLocalDuration] = useState<number>(240);
  const [localIsVideo, setLocalIsVideo] = useState<boolean>(false);
  const [isReadingMetadata, setIsReadingMetadata] = useState<boolean>(false);

  // Presets
  const [presets, setPresets] = useState<Song[]>(presetService.getPresets());
  const [copiedSongId, setCopiedSongId] = useState<string | null>(null);

  // LRCLIB Search
  const [lrcQuery, setLrcQuery] = useState<string>('');
  const [lrcResults, setLrcResults] = useState<LrcSearchResult[]>([]);
  const [isLrcSearching, setIsLrcSearching] = useState<boolean>(false);

  // Tap-to-Sync Lyric Editor Modal
  const [isSyncEditorOpen, setIsSyncEditorOpen] = useState<boolean>(false);

  // Scoring weights configuration modal
  const [isScoringConfigOpen, setIsScoringConfigOpen] = useState<boolean>(false);
  const [pitchWeight, setPitchWeight] = useState<number>(state.scoringConfig.pitchWeight);
  const [judgeWeight, setJudgeWeight] = useState<number>(state.scoringConfig.judgeWeight);

  // Local seekbar dragging state to prevent slider jitter
  const [draggingSeekTime, setDraggingSeekTime] = useState<number | null>(null);

  // Pitch Tracker instance for competition mode
  const pitchTrackerRef = useRef<PitchTracker | null>(null);

  // Auto-activate mic pitch detector when in Competition mode
  useEffect(() => {
    if (state.activeMode === 'competition') {
      if (!pitchTrackerRef.current) {
        const tracker = new PitchTracker();
        const started = tracker.start((data) => {
          sync.updateState(prev => ({
            ...prev,
            livePitch: data
          }));
        });
        if (started) {
          pitchTrackerRef.current = tracker;
        }
      }
    } else {
      if (pitchTrackerRef.current) {
        pitchTrackerRef.current.stop();
        pitchTrackerRef.current = null;
        sync.updateState(prev => ({
          ...prev,
          livePitch: { ...prev.livePitch, isMicActive: false, detectedFrequency: 0, detectedNote: '--' }
        }));
      }
    }

    return () => {
      if (pitchTrackerRef.current) {
        pitchTrackerRef.current.stop();
        pitchTrackerRef.current = null;
      }
    };
  }, [state.activeMode]);

  // Handle In-App YouTube Search via Backend Endpoint
  const handleYoutubeSearch = async (searchKeyword?: string) => {
    const rawQuery = searchKeyword || ytQuery;
    if (!rawQuery.trim()) return;

    setIsYtSearching(true);
    try {
      const fullQuery = ytSearchInstrumentalOnly && !rawQuery.toLowerCase().includes('off vocal') && !rawQuery.toLowerCase().includes('instrumental') && !rawQuery.toLowerCase().includes('karaoke')
        ? `${rawQuery} karaoke off vocal`
        : rawQuery;

      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
      const res = await fetch(`${serverUrl}/api/youtube/search?q=${encodeURIComponent(fullQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setYtResults(data.videos || []);
      } else {
        throw new Error('Search failed');
      }
    } catch (err) {
      console.warn('Backend YouTube search unavailable, using direct fallback:', err);
      setYtResults([
        {
          videoId: rawQuery.length === 11 ? rawQuery : 'PDSkFeMVNFs',
          title: rawQuery,
          artist: 'Anime Karaoke',
          duration: 240,
          durationFormatted: '4:00',
          thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80'
        }
      ]);
    } finally {
      setIsYtSearching(false);
    }
  };

  // Add YouTube Video Directly to Queue
  const handleAddYtVideoToQueue = (video: any) => {
    const isTrain = state.activeMode === 'train';
    const singer = isTrain
      ? (ytSingerName.trim() || `Train #${state.queue.length + 1}`)
      : (ytSingerName.trim() || 'Peserta Kompetisi');

    const newSong: Song = {
      id: `song-yt-${video.videoId}-${Date.now()}`,
      title: video.title,
      artist: video.artist || 'Anime Artist',
      source: 'youtube',
      youtubeId: video.videoId,
      duration: video.duration || 240,
      coverArt: video.thumbnail
    };

    sync.addSongToQueue({
      song: newSong,
      singerName: singer,
      mode: state.activeMode
    });

    presetService.savePreset(newSong);
    setPresets(presetService.getPresets());
    setYtSingerName('');
  };

  // Helper to upload media file permanently to server hard drive
  const uploadMediaToServer = async (file: File): Promise<string> => {
    try {
      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
      const res = await fetch(`${serverUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'x-filename': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn('Permanent disk upload fallback to Blob URL:', e);
    }
    return URL.createObjectURL(file);
  };

  // Handle Local File Upload with ID3 Auto-Metadata Extraction & Permanent Disk Storage
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsReadingMetadata(true);
      const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(file.name);
      setLocalIsVideo(isVid);

      // Temporary blob URL for fast local metadata extraction
      const tempUrl = URL.createObjectURL(file);
      setLocalAudioUrl(tempUrl);

      const meta = await extractAudioMetadata(file);
      setLocalTitle(meta.title);
      setLocalArtist(meta.artist);
      if (meta.duration) setLocalDuration(meta.duration);
      if (meta.coverArt) setLocalCoverArt(meta.coverArt);

      // Upload permanently to backend server hard drive
      const permanentUrl = await uploadMediaToServer(file);
      setLocalAudioUrl(permanentUrl);
      setIsReadingMetadata(false);
    }
  };

  const handleLrcFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setLocalLrcText(text);
      };
      reader.readAsText(file);
    }
  };

  const handleInstrumentalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalInstFileName(file.name);
      const tempUrl = URL.createObjectURL(file);
      setLocalInstAudioUrl(tempUrl);

      // Upload permanently to backend server hard drive
      const permanentUrl = await uploadMediaToServer(file);
      setLocalInstAudioUrl(permanentUrl);
    }
  };

  const handleAddLocalSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localAudioUrl || !localTitle) return;

    const isTrain = state.activeMode === 'train';
    const singer = isTrain
      ? (localSinger.trim() || `Train #${state.queue.length + 1}`)
      : (localSinger.trim() || 'Peserta Lomba Cover');

    const parsed = localLrcText ? parseLRC(localLrcText) : [];

    const newSong: Song = {
      id: `song-local-${Date.now()}`,
      title: localTitle,
      artist: localArtist || 'Custom Artist',
      source: 'local',
      mediaUrl: localAudioUrl,
      isVideo: localIsVideo,
      instrumentalUrl: localInstAudioUrl || undefined,
      instrumentalFileName: localInstFileName || undefined,
      rawLyrics: localLrcText,
      parsedLyrics: parsed,
      duration: localDuration,
      coverArt: localCoverArt
    };

    sync.addSongToQueue({
      song: newSong,
      singerName: singer,
      mode: state.activeMode
    });

    presetService.savePreset(newSong);
    setPresets(presetService.getPresets());

    setLocalTitle('');
    setLocalArtist('');
    setLocalSinger('');
    setLocalAudioUrl('');
    setLocalInstAudioUrl('');
    setLocalInstFileName('');
    setLocalLrcText('');
    setLocalIsVideo(false);
  };

  // LRCLIB Search Handler
  const handleLrcSearch = async () => {
    if (!lrcQuery.trim()) return;
    setIsLrcSearching(true);
    const res = await searchLrcLib(lrcQuery);
    setLrcResults(res);
    setIsLrcSearching(false);
  };

  const handleApplyLrc = (lrc: LrcSearchResult) => {
    if (!currentSong) return;
    const lyricsToUse = lrc.syncedLyrics || lrc.plainLyrics || '';
    const parsed = parseLRC(lyricsToUse);

    sync.updateState(prev => {
      if (!prev.currentQueueItem) return prev;
      return {
        ...prev,
        currentQueueItem: {
          ...prev.currentQueueItem,
          song: {
            ...prev.currentQueueItem.song,
            rawLyrics: lyricsToUse,
            parsedLyrics: parsed
          }
        }
      };
    });

    presetService.savePreset({
      ...currentSong,
      rawLyrics: lyricsToUse,
      parsedLyrics: parsed
    });
    setPresets(presetService.getPresets());

    alert(`Lirik "${lrc.trackName}" berhasil diterapkan dan disimpan!`);
  };

  const handleSaveCurrentToPreset = () => {
    if (!currentSong) return;
    presetService.savePreset(currentSong);
    setPresets(presetService.getPresets());
    alert(`Lagu "${currentSong.title}" berhasil disimpan ke Preset Library!`);
  };

  const handleExportPresets = () => {
    const jsonStr = presetService.exportPresetsAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `j-stage-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleCopyLrc = (song: Song) => {
    let lrcText = song.rawLyrics || '';
    if (!lrcText && song.parsedLyrics && song.parsedLyrics.length > 0) {
      lrcText = exportToLRC(song.parsedLyrics);
    }
    if (!lrcText.trim()) {
      alert(`Lagu "${song.title}" belum memiliki data lirik.`);
      return;
    }
    navigator.clipboard.writeText(lrcText);
    setCopiedSongId(song.id);
    setTimeout(() => setCopiedSongId(null), 2000);
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const success = presetService.importPresetsFromJson(text);
        if (success) {
          setPresets(presetService.getPresets());
          alert('Preset berhasil diimpor!');
        } else {
          alert('Format file JSON tidak valid.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Queue actions
  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    const newQueue = [...state.queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    sync.updateState({ queue: newQueue });
  };

  const handleDeleteQueueItem = (id: string) => {
    sync.updateState({ queue: state.queue.filter(q => q.id !== id) });
  };

  const handlePlayNow = (item: QueueItem) => {
    sync.updateState(prev => ({
      ...prev,
      currentQueueItem: item,
      queue: prev.queue.filter(q => q.id !== item.id),
      isPlaying: true,
      currentTime: 0
    }));
  };

  // Player Control Actions
  const handleReplay = () => {
    sync.replaySong();
  };

  const handleStop = () => {
    sync.stopSong();
  };

  const handleSeek = (newTime: number) => {
    sync.seekTo(newTime);
  };

  const handleSeekRelative = (secondsDelta: number) => {
    const targetTime = Math.max(0, Math.min(state.duration || 100, state.currentTime + secondsDelta));
    sync.seekTo(targetTime);
  };

  const toggleVocalGuide = () => {
    if (currentSong?.source === 'youtube') return;
    sync.setVocalGuide(!state.vocalGuide);
  };

  const saveScoringConfig = () => {
    sync.updateState(prev => ({
      ...prev,
      scoringConfig: {
        ...prev.scoringConfig,
        pitchWeight,
        judgeWeight
      }
    }));
    setIsScoringConfigOpen(false);
  };

  return (
    <div className="min-h-[calc(100vh-53px)] bg-stage-dark text-white p-4 md:p-6 select-none">
      {/* 1. MASTER TOP CONTROL BAR */}
      <div className="bg-stage-card p-4 rounded-3xl border border-white/10 shadow-xl mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => sync.updateState(prev => ({
              ...prev,
              activeMode: prev.activeMode === 'competition' ? 'train' : 'competition'
            }))}
            className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg ${
              state.activeMode === 'competition'
                ? 'bg-stage-gold text-black shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                : 'bg-stage-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.5)]'
            }`}
          >
            {state.activeMode === 'competition' ? (
              <>
                <Sparkles className="w-4 h-4" /> Mode: Cover Sing Competition
              </>
            ) : (
              <>
                <Flame className="w-4 h-4" /> Mode: Karaoke Train
              </>
            )}
          </button>

          <span className="text-xs text-gray-400 font-medium hidden md:inline">
            {state.activeMode === 'competition'
              ? '🎤 Mic Pitch & Penilaian Juri Aktif'
              : '⚡ Antrean Cepat & Nyanyi Bebas'}
          </span>
        </div>

        {/* Live Sound FX Launchpad */}
        <div className="flex items-center space-x-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
          <span className="text-[10px] font-bold text-gray-400 uppercase px-2">SFX:</span>
          <button
            onClick={() => sync.triggerSoundFx('applause', 'Tepuk Tangan')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            👏 Tepuk Tangan
          </button>
          <button
            onClick={() => sync.triggerSoundFx('cheer', 'Sorak Penonton')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            📣 Sorak
          </button>
          <button
            onClick={() => sync.triggerSoundFx('gong', 'Gong')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            🔔 Gong
          </button>
          <button
            onClick={() => sync.triggerSoundFx('fanfare', 'Fanfare Juara')}
            className="px-2.5 py-1 bg-stage-gold/20 text-stage-gold hover:bg-stage-gold/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            🎺 Fanfare
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {state.activeMode === 'competition' && (
            <button
              onClick={() => setIsScoringConfigOpen(true)}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
              title="Pengaturan Bobot Penilaian"
            >
              <Sliders className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Bobot Nilai</span>
            </button>
          )}

          <button
            onClick={() => sync.updateState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))}
            className="p-2.5 bg-stage-gold/20 text-stage-gold hover:bg-stage-gold/30 rounded-2xl transition flex items-center gap-1.5 text-xs font-bold border border-stage-gold/40 shadow-md"
          >
            <Trophy className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>

          <button
            onClick={onOpenQrModal}
            className="p-2.5 bg-stage-neon/20 text-stage-neon hover:bg-stage-neon/30 rounded-2xl transition flex items-center gap-1.5 text-xs font-bold border border-stage-neon/40 shadow-md"
          >
            <QrCode className="w-4 h-4" />
            <span>QR Juri/Queue</span>
          </button>

          <a
            href="/?view=stage"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-purple-600/30 text-purple-300 hover:bg-purple-600 hover:text-white rounded-2xl transition flex items-center gap-1.5 text-xs font-bold border border-purple-400/40 shadow-md"
            title="Buka Layar Panggung di Tab/Layar Terpisah"
          >
            <span>🖥️ Layar Panggung</span>
          </a>
        </div>
      </div>

      {/* 2. MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: NOW PLAYING & FULL PLAYER CONTROLS (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-widest text-stage-accent flex items-center gap-1.5">
                <Music className="w-4 h-4" /> SEDANG DIPUTAR DI PANGGUNG
              </span>
              <span className="text-xs font-mono font-bold text-gray-400 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                {currentSong?.source === 'youtube' ? 'YouTube' : 'Local Media'}
              </span>
            </div>

            {currentItem ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-stage-neon font-bold uppercase tracking-wider">
                    {currentItem.singerName}
                  </div>
                  <h2 className="text-2xl font-black text-white">{currentSong?.title}</h2>
                  <p className="text-sm text-gray-400">{currentSong?.artist}</p>
                </div>

                {/* Interactive Seek Bar with Butter-Smooth Dragging */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-gray-400">
                    <span className="text-stage-neon font-bold">
                      {Math.floor((draggingSeekTime !== null ? draggingSeekTime : state.currentTime) / 60)}:
                      {((draggingSeekTime !== null ? draggingSeekTime : state.currentTime) % 60).toFixed(0).padStart(2, '0')}
                    </span>
                    <span>{Math.floor(state.duration / 60)}:{(state.duration % 60).toFixed(0).padStart(2, '0')}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={state.duration || 100}
                    step="0.1"
                    value={draggingSeekTime !== null ? draggingSeekTime : state.currentTime}
                    onChange={(e) => setDraggingSeekTime(parseFloat(e.target.value))}
                    onPointerUp={() => {
                      if (draggingSeekTime !== null) {
                        handleSeek(draggingSeekTime);
                        setDraggingSeekTime(null);
                      }
                    }}
                    onTouchEnd={() => {
                      if (draggingSeekTime !== null) {
                        handleSeek(draggingSeekTime);
                        setDraggingSeekTime(null);
                      }
                    }}
                    onKeyUp={() => {
                      if (draggingSeekTime !== null) {
                        handleSeek(draggingSeekTime);
                        setDraggingSeekTime(null);
                      }
                    }}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-stage-neon"
                  />
                </div>

                {/* COMPLETE PLAYER CONTROLS TOOLBAR */}
                <div className="p-3 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                  {/* Primary Playback Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {/* Replay / Restart button */}
                      <button
                        onClick={handleReplay}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-gray-200 rounded-xl transition shadow"
                        title="Putar Ulang dari Awal (0:00)"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* -5s Rewind */}
                      <button
                        onClick={() => handleSeekRelative(-5)}
                        className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs font-mono font-bold transition shadow"
                        title="Mundur 5 Detik"
                      >
                        -5s
                      </button>

                      {/* Play / Pause */}
                      <button
                        onClick={() => sync.togglePlay()}
                        className="p-3 bg-gradient-to-tr from-stage-accent to-pink-600 hover:opacity-90 text-white rounded-xl shadow-[0_0_15px_rgba(255,42,133,0.6)] transition active:scale-95"
                      >
                        {state.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>

                      {/* +5s Fast Forward */}
                      <button
                        onClick={() => handleSeekRelative(5)}
                        className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs font-mono font-bold transition shadow"
                        title="Maju 5 Detik"
                      >
                        +5s
                      </button>

                      {/* Stop */}
                      <button
                        onClick={handleStop}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-gray-200 rounded-xl transition shadow"
                        title="Stop (Kembali ke Awal & Pause)"
                      >
                        <Square className="w-4 h-4" />
                      </button>

                      {/* Skip Next Song */}
                      <button
                        onClick={() => sync.nextSong()}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-gray-200 rounded-xl transition shadow"
                        title="Lagu Berikutnya"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Competition Finalize Score Button */}
                    {state.activeMode === 'competition' && (
                      <button
                        onClick={() => sync.finalizePerformanceScore()}
                        className="px-3.5 py-2.5 bg-gradient-to-r from-stage-gold to-yellow-600 hover:opacity-90 font-black text-xs uppercase tracking-wider text-black rounded-xl shadow-lg transition flex items-center gap-1 shrink-0"
                      >
                        <Trophy className="w-4 h-4" /> Hitung Skor
                      </button>
                    )}
                  </div>

                  {/* Volume & Vocal Guide Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                    {/* Volume Slider */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => sync.toggleMute()}
                        className="text-gray-400 hover:text-white"
                        title={state.isMuted ? "Unmute" : "Mute"}
                      >
                        {state.isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-stage-neon" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={state.isMuted ? 0 : state.volume}
                        onChange={(e) => sync.setVolume(parseInt(e.target.value, 10))}
                        className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-stage-neon"
                      />
                      <span className="text-[10px] font-mono text-gray-400 w-6">
                        {state.isMuted ? '0%' : `${state.volume}%`}
                      </span>
                    </div>

                    {/* Vocal Guide / Instrumental Toggle (Conventional Karaoke Switch) */}
                    <button
                      onClick={toggleVocalGuide}
                      disabled={currentSong?.source === 'youtube'}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow ${
                        currentSong?.source === 'youtube'
                          ? 'bg-white/5 border-white/10 text-gray-500 opacity-60 cursor-not-allowed'
                          : state.vocalGuide
                          ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                          : 'bg-stage-accent/30 border-stage-accent/60 text-stage-accent animate-pulse'
                      }`}
                      title={
                        currentSong?.source === 'youtube'
                          ? 'Fitur Vokal/Instrumental Switch hanya berlaku untuk file lokal (Dual-Track / DSP)'
                          : 'Alihkan Vokal Pemandu (Full Vocal) vs Musik Instrumental Saja'
                      }
                    >
                      <Mic2 className="w-3.5 h-3.5" />
                      <span>
                        {currentSong?.source === 'youtube'
                          ? 'Vokal/Inst (Hanya File Lokal)'
                          : currentSong?.instrumentalUrl
                          ? (state.vocalGuide ? '🎤 Vokal Asli (Dual-Track): ON' : '🎸 Studio Instrumental (100% Bersih): ON')
                          : (state.vocalGuide ? 'Vokal Asli: ON' : 'Instrumental (Karaoke Mode): ON')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Lyric Quick Tools & Save Preset */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    onClick={handleSaveCurrentToPreset}
                    className="font-bold text-stage-gold hover:underline flex items-center gap-1"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> Simpan ke Preset
                  </button>
                  <button
                    onClick={() => setIsSyncEditorOpen(true)}
                    className="font-bold text-stage-accent hover:underline flex items-center gap-1 bg-stage-accent/10 px-3 py-1 rounded-lg border border-stage-accent/30"
                  >
                    <FileText className="w-3.5 h-3.5" /> Buka Tap-to-Sync Editor (Real Audio)
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Pilih lagu dari pencarian atau preset untuk mulai memutar
              </div>
            )}
          </div>

          {/* JURY SUBMISSION LIVE MONITOR (Competition Mode Only) */}
          {state.activeMode === 'competition' && (
            <div className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Status Penjurian ({state.submissions.length} / {state.judges.length} Juri Submit)
                </h3>
              </div>

              <div className="space-y-2">
                {state.judges.map(judge => {
                  const sub = state.submissions.find(s => s.judgeId === judge.id);
                  return (
                    <div key={judge.id} className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${sub ? 'bg-green-500 animate-ping' : 'bg-gray-600'}`} />
                        <span className="text-xs font-bold text-white">{judge.name}</span>
                      </div>
                      {sub ? (
                        <span className="text-xs font-mono font-bold text-stage-gold bg-stage-gold/10 px-2.5 py-0.5 rounded-md border border-stage-gold/30">
                          {sub.totalJudgeScore} pts ✅
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">Menunggu input...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: QUEUE & ADD SONG TABS (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* QUEUE LIST */}
          <div className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-stage-neon" /> Daftar Antrean Lagu ({state.queue.length})
              </h3>
              <button
                onClick={() => sync.updateState({ queue: [] })}
                className="text-xs text-gray-400 hover:text-red-400 transition"
              >
                Kosongkan Antrean
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {state.queue.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  Antrean kosong. Cari lagu di YouTube atau pilih dari Preset di bawah.
                </div>
              ) : (
                state.queue.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/20 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <span className="w-6 text-center font-mono font-bold text-xs text-stage-neon">
                        #{index + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-sm text-white truncate flex items-center gap-2">
                          <span>{item.singerName}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            item.mode === 'competition' ? 'bg-stage-gold/20 text-stage-gold' : 'bg-stage-neon/20 text-stage-neon'
                          }`}>
                            {item.mode}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {item.song.title} - {item.song.artist}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handlePlayNow(item)}
                        className="px-2.5 py-1 bg-stage-accent text-white text-xs font-bold rounded-lg hover:bg-pink-600 transition"
                      >
                        Putar
                      </button>
                      <button
                        onClick={() => handleMoveQueueItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveQueueItem(index, 'down')}
                        disabled={index === state.queue.length - 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQueueItem(item.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ADD SONG TABS: DIRECT YOUTUBE SEARCH, LOCAL UPLOAD, PRESETS, LRCLIB */}
          <div className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
            {/* Tab Headers */}
            <div className="flex items-center space-x-2 border-b border-white/10 pb-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('youtube')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeTab === 'youtube' ? 'bg-stage-neon text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                🔍 Cari di YouTube
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeTab === 'presets' ? 'bg-stage-gold text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                ⭐ Preset Lagu ({presets.length})
              </button>
              <button
                onClick={() => setActiveTab('local')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeTab === 'local' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                📁 Upload Musik Lokal
              </button>
              <button
                onClick={() => setActiveTab('lrclib')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  activeTab === 'lrclib' ? 'bg-stage-accent text-white shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                📝 Auto-Fetch LRC
              </button>
            </div>

            {/* TAB 1: IN-APP DIRECT YOUTUBE SEARCH */}
            {activeTab === 'youtube' && (
              <div className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); handleYoutubeSearch(); }} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={ytQuery}
                      onChange={(e) => setYtQuery(e.target.value)}
                      placeholder="Ketik judul anime/lagu (misal: Idol YOASOBI, Gurenge LiSA)..."
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-stage-neon"
                    />
                    <button
                      type="submit"
                      disabled={isYtSearching}
                      className="px-5 py-3 bg-stage-neon hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center gap-1.5 shrink-0"
                    >
                      <Search className="w-4 h-4" /> {isYtSearching ? 'Mencari...' : 'Cari'}
                    </button>
                  </div>

                  {/* Filter Instrumental Switch */}
                  <div className="flex items-center justify-between px-1 text-xs">
                    <label className="flex items-center space-x-2 cursor-pointer text-gray-300">
                      <input
                        type="checkbox"
                        checked={ytSearchInstrumentalOnly}
                        onChange={(e) => setYtSearchInstrumentalOnly(e.target.checked)}
                        className="rounded accent-stage-neon"
                      />
                      <span>Cari khusus versi <b>Karaoke / Off-Vocal</b> (tanpa vokal penyanyi)</span>
                    </label>
                  </div>
                </form>

                {/* Quick Search Chips */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
                  <span className="text-gray-500 font-bold shrink-0">Populer:</span>
                  {['Idol YOASOBI', 'Gurenge LiSA', 'Zenzenzense RADWIMPS', 'Bling-Bang-Bang-Born', 'Senbonzakura'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setYtQuery(tag);
                        handleYoutubeSearch(tag);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-stage-neon/20 hover:text-stage-neon text-gray-400 border border-white/10 shrink-0 transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Optional Singer Name for Competition mode */}
                {state.activeMode === 'competition' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-stage-gold mb-1">
                      Nama Peserta / No. Undian Kompetisi (Wajib untuk Lomba)
                    </label>
                    <input
                      type="text"
                      value={ytSingerName}
                      onChange={(e) => setYtSingerName(e.target.value)}
                      placeholder="Misal: Ren (Peserta #01)"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-stage-gold"
                    />
                  </div>
                )}

                {/* Results List */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {ytResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      Ketik judul lagu di atas atau klik salah satu rekomendasi populer untuk memuat video YouTube.
                    </div>
                  ) : (
                    ytResults.map((video) => (
                      <div
                        key={video.videoId}
                        className="p-3 bg-black/40 rounded-2xl border border-white/5 hover:border-stage-neon/40 flex items-center justify-between gap-3 group transition"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          {video.thumbnail && (
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-16 h-12 rounded-lg object-cover shrink-0 shadow"
                            />
                          )}
                          <div className="truncate">
                            <div className="font-bold text-xs text-white truncate group-hover:text-stage-neon transition">
                              {video.title}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                              <span>{video.artist}</span>
                              <span>•</span>
                              <span className="font-mono text-gray-300">{video.durationFormatted}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddYtVideoToQueue(video)}
                          className="px-3 py-1.5 bg-stage-neon hover:bg-cyan-400 text-black text-xs font-black rounded-xl transition shrink-0 flex items-center gap-1 shadow-md"
                        >
                          <Plus className="w-4 h-4" /> + Antrean
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: PRESET LIBRARY */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Lagu siap putar dengan lirik tersinkronisasi:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleExportPresets}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 flex items-center gap-1"
                      title="Ekspor ke file JSON untuk backup offline"
                    >
                      <Download className="w-3.5 h-3.5" /> Ekspor JSON
                    </button>
                    <label className="cursor-pointer px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" /> Impor JSON
                      <input type="file" accept=".json" onChange={handleImportPresets} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {presets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      Belum ada preset tersimpan. Putar lagu lalu klik "Simpan ke Preset".
                    </div>
                  ) : (
                    presets.map(song => (
                      <div
                        key={song.id}
                        className="p-3 bg-black/40 rounded-2xl border border-white/5 hover:border-stage-gold/40 flex items-center justify-between gap-3 group transition"
                      >
                        <div className="truncate">
                          <div className="font-bold text-xs text-white truncate group-hover:text-stage-gold transition">
                            {song.title}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-2">
                            <span>{song.artist}</span>
                            {song.parsedLyrics && song.parsedLyrics.length > 0 && (
                              <span className="text-[10px] text-stage-neon">✨ Lirik Sync OK</span>
                            )}
                            {song.instrumentalUrl && (
                              <span className="text-[10px] text-stage-gold">🎸 Dual-Track</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {/* Copy LRC Button */}
                          <button
                            onClick={() => handleCopyLrc(song)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 border shadow-sm ${
                              copiedSongId === song.id
                                ? 'bg-green-600/40 border-green-500 text-green-300'
                                : 'bg-white/10 hover:bg-white/20 border-white/10 text-gray-300 hover:text-white'
                            }`}
                            title="Salin teks lirik format .LRC ke clipboard"
                          >
                            {copiedSongId === song.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-[11px]">Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stage-neon" />
                                <span className="text-[11px]">Copy LRC</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              sync.addSongToQueue({
                                song,
                                singerName: state.activeMode === 'train' ? `Train #${state.queue.length + 1}` : 'Peserta Lomba',
                                mode: state.activeMode
                              });
                            }}
                            className="px-3 py-1 bg-stage-gold hover:bg-yellow-500 text-black text-xs font-bold rounded-xl transition flex items-center gap-1 shadow"
                          >
                            <Plus className="w-4 h-4" /> + Antrean
                          </button>
                          <button
                            onClick={() => {
                              presetService.deletePreset(song.id);
                              setPresets(presetService.getPresets());
                            }}
                            className="p-1 text-gray-500 hover:text-red-400"
                            title="Hapus Preset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LOCAL FILE UPLOAD WITH DUAL-AUDIO SLOTS */}
            {activeTab === 'local' && (
              <form onSubmit={handleAddLocalSong} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Slot 1: Primary Audio / Vocal Track */}
                  <div className="border-2 border-dashed border-purple-500/40 p-4 rounded-2xl text-center bg-purple-950/10 hover:bg-purple-950/20 transition">
                    <label className="cursor-pointer block">
                      <Upload className="w-6 h-6 mx-auto text-purple-400 mb-1.5" />
                      <span className="text-xs font-bold text-white block">
                        {isReadingMetadata ? 'Membaca Tag Musik...' : '1. File Audio Utama / Vokal (Wajib)'}
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        {localAudioUrl ? '✅ File Audio Utama Terpilih' : 'MP3 / WAV / MP4 (Metadata Auto-detect)'}
                      </span>
                      <input type="file" accept="audio/*,video/*" onChange={handleAudioFileUpload} className="hidden" />
                    </label>
                  </div>

                  {/* Slot 2: Dedicated Studio Instrumental Track */}
                  <div className="border-2 border-dashed border-stage-gold/40 p-4 rounded-2xl text-center bg-yellow-950/10 hover:bg-yellow-950/20 transition">
                    <label className="cursor-pointer block">
                      <Disc3 className="w-6 h-6 mx-auto text-stage-gold mb-1.5" />
                      <span className="text-xs font-bold text-stage-gold block">
                        2. File Audio Instrumental (Opsional)
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        {localInstFileName ? `✅ Terpasang: ${localInstFileName}` : 'Versi Off-Vocal (Kualitas Bersih 100%)'}
                      </span>
                      <input type="file" accept="audio/*" onChange={handleInstrumentalFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Judul Lagu</label>
                    <input
                      type="text"
                      required
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      placeholder="Terisi otomatis dari file audio"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">Artis / Penyanyi</label>
                    <input
                      type="text"
                      value={localArtist}
                      onChange={(e) => setLocalArtist(e.target.value)}
                      placeholder="Terisi otomatis dari file audio"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                      Nama Peserta {state.activeMode === 'competition' ? '(Wajib)' : '(Opsional)'}
                    </label>
                    <input
                      type="text"
                      value={localSinger}
                      onChange={(e) => setLocalSinger(e.target.value)}
                      placeholder="Bisa dikosongkan untuk train mode"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">File Lirik .LRC (Opsional)</label>
                    <input
                      type="file"
                      accept=".lrc,.txt"
                      onChange={handleLrcFileUpload}
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-white/10 file:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!localAudioUrl || !localTitle}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Masukkan Lagu Lokal ke Antrean
                </button>
              </form>
            )}

            {/* TAB 4: LRCLIB AUTO-FETCH */}
            {activeTab === 'lrclib' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lrcQuery}
                    onChange={(e) => setLrcQuery(e.target.value)}
                    placeholder="Ketik judul lagu anime (misal: Idol YOASOBI, Silhouette KANA-BOON)..."
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                  <button
                    onClick={handleLrcSearch}
                    disabled={isLrcSearching}
                    className="px-4 py-2 bg-stage-accent text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <Search className="w-4 h-4" /> {isLrcSearching ? 'Mencari...' : 'Cari Lirik'}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {lrcResults.map(res => (
                    <div key={res.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-white">{res.trackName} - {res.artistName}</div>
                        <div className="text-[10px] text-gray-400">
                          {res.syncedLyrics ? '✨ Synced LRC Tersedia' : 'Plain Text Only'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleApplyLrc(res)}
                        className="px-3 py-1 bg-stage-accent hover:bg-pink-600 text-white font-bold text-xs rounded-lg transition shrink-0"
                      >
                        Terapkan ke Lagu Aktif
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: TAP-TO-SYNC LYRIC EDITOR WITH REAL AUDIO */}
      {isSyncEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <TapSyncEditor
            song={currentSong}
            initialLyricsText={currentSong?.rawLyrics || ''}
            audioDuration={state.duration || 240}
            onCancel={() => setIsSyncEditorOpen(false)}
            onSaveLyrics={(parsedLyrics, rawLrc) => {
              if (!currentSong) return;
              const updatedSong: Song = {
                ...currentSong,
                rawLyrics: rawLrc,
                parsedLyrics
              };

              sync.updateState(prev => {
                if (!prev.currentQueueItem) return prev;
                return {
                  ...prev,
                  currentQueueItem: {
                    ...prev.currentQueueItem,
                    song: updatedSong
                  }
                };
              });

              // Auto-save to preset library!
              presetService.savePreset(updatedSong);
              setPresets(presetService.getPresets());

              setIsSyncEditorOpen(false);
              alert(`✨ Lirik untuk "${currentSong.title}" berhasil disinkronisasi & tersimpan permanen di Preset Library!`);
            }}
          />
        </div>
      )}

      {/* MODAL 2: SCORING WEIGHTS SETTINGS */}
      {isScoringConfigOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full text-white space-y-5">
            <h3 className="text-xl font-black flex items-center gap-2">
              <Sliders className="w-5 h-5 text-stage-gold" /> Konfigurasi Bobot Penilaian
            </h3>
            <p className="text-xs text-gray-400">
              Tentukan perbandingan persentase antara skor deteksi nada mikrofon dan skor juri:
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Bobot Pitch Detection (Mic Panggung)</span>
                  <span className="text-stage-neon font-mono">{pitchWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={pitchWeight}
                  onChange={(e) => {
                    const pw = parseInt(e.target.value, 10);
                    setPitchWeight(pw);
                    setJudgeWeight(100 - pw);
                  }}
                  className="w-full accent-stage-neon"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>Bobot Penilaian Dewan Juri</span>
                  <span className="text-purple-400 font-mono">{judgeWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={judgeWeight}
                  onChange={(e) => {
                    const jw = parseInt(e.target.value, 10);
                    setJudgeWeight(jw);
                    setPitchWeight(100 - jw);
                  }}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                onClick={() => setIsScoringConfigOpen(false)}
                className="px-4 py-2 bg-white/10 text-gray-300 rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                onClick={saveScoringConfig}
                className="px-5 py-2 bg-stage-gold text-black font-bold rounded-xl text-xs shadow-lg"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
