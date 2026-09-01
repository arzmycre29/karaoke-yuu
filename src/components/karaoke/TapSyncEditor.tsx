import React, { useState, useEffect, useRef } from 'react';
import type { LyricLine, Song, PlayerCommand } from '../../types/karaoke';
import { formatTimestamp, exportToLRC, parseLRC } from '../../services/lyricParser';
import { YouTubePlayer } from '../player/YouTubePlayer';
import {
  Play, Pause, RotateCcw, Check, Sparkles, Keyboard, Undo2, Music,
  Edit3, Disc3, Save, Volume2, Trash2, ArrowUpRight
} from 'lucide-react';

interface TapSyncEditorProps {
  song?: Song | null;
  initialLyricsText?: string;
  onSaveLyrics: (parsedLyrics: LyricLine[], rawLrc: string) => void;
  onCancel: () => void;
  audioDuration?: number;
}

export const TapSyncEditor: React.FC<TapSyncEditorProps> = ({
  song,
  initialLyricsText = '',
  onSaveLyrics,
  onCancel,
  audioDuration = 240
}) => {
  // Pre-load from parsedLyrics if available, or rawLyrics
  const existingParsed = song?.parsedLyrics && song.parsedLyrics.length > 0 ? song.parsedLyrics : null;

  const [rawText, setRawText] = useState<string>(() => {
    if (existingParsed) {
      return exportToLRC(existingParsed);
    }
    return initialLyricsText || song?.rawLyrics || '';
  });

  // State to separate Textarea Edit Mode vs Tap-to-Sync Mode
  const [isEditingText, setIsEditingText] = useState<boolean>(() => {
    const hasExisting = !!(existingParsed || initialLyricsText || song?.rawLyrics);
    return !hasExisting;
  });

  // All lines to be synced
  const [lines, setLines] = useState<string[]>(() => {
    if (existingParsed) {
      return existingParsed.map(l => l.romaji ? `${l.text} | ${l.romaji}` : l.text);
    }
    const text = initialLyricsText || song?.rawLyrics || '';
    if (!text) return [];
    return text
      .split('\n')
      .map(l => l.trim().replace(/^\[\d+:\d+(\.\d+)?\]\s*/, ''))
      .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));
  });

  // Pre-fill recordedLines from existing sync data so user doesn't start from scratch!
  const [recordedLines, setRecordedLines] = useState<{ text: string; startTime: number }[]>(() => {
    if (existingParsed) {
      return existingParsed.map(l => ({
        text: l.romaji ? `${l.text} | ${l.romaji}` : l.text,
        startTime: l.startTime
      }));
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (existingParsed && existingParsed.length > 0) {
      return existingParsed.length; // Already completed, ready to review/tweak
    }
    return 0;
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(audioDuration);
  const [modalPlayerCommand, setModalPlayerCommand] = useState<PlayerCommand | null>(null);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  // Parse raw text into lines and switch to Tap-to-Sync mode
  const handleStartSyncFromText = () => {
    if (!rawText.trim()) return;
    const cleanLines = rawText
      .split('\n')
      .map(l => l.trim().replace(/^\[\d+:\d+(\.\d+)?\]\s*/, ''))
      .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));

    setLines(cleanLines);

    // If text was in LRC format with timestamps, parse them directly!
    const parsed = parseLRC(rawText);
    if (parsed.length > 0) {
      setRecordedLines(parsed.map(l => ({
        text: l.romaji ? `${l.text} | ${l.romaji}` : l.text,
        startTime: l.startTime
      })));
      setCurrentIndex(parsed.length);
    } else {
      setRecordedLines([]);
      setCurrentIndex(0);
    }

    setIsEditingText(false);
  };

  // Direct Quick Save from Text Mode (without needing to re-tap)
  const handleQuickSaveText = () => {
    if (!rawText.trim()) return;
    let parsed = parseLRC(rawText);

    // If plain text with no timestamps, assign basic auto-increments
    if (parsed.length === 0) {
      const cleanLines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));

      parsed = cleanLines.map((l, i) => {
        let main = l;
        let rom: string | undefined = undefined;
        if (l.includes(' | ')) {
          const parts = l.split(' | ');
          main = parts[0].trim();
          rom = parts[1].trim();
        }
        return {
          id: `line-${i}-${Date.now()}`,
          startTime: i * 4,
          endTime: (i + 1) * 4,
          text: main,
          romaji: rom
        };
      });
    }

    const rawLrc = exportToLRC(parsed);
    onSaveLyrics(parsed, rawLrc);
  };

  // Play / Pause synchronization
  const togglePlayPause = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (localAudioRef.current) {
      if (nextState) {
        localAudioRef.current.play().catch(e => console.warn(e));
      } else {
        localAudioRef.current.pause();
      }
    }
  };

  const handleTimeSeek = (newTime: number) => {
    setCurrentTime(newTime);
    setModalPlayerCommand({
      type: 'seek',
      targetTime: newTime,
      timestamp: Date.now()
    });
    if (localAudioRef.current) {
      localAudioRef.current.currentTime = newTime;
    }
  };

  // Tap Lyric Line
  const handleTapLyric = () => {
    if (!isPlaying) {
      togglePlayPause();
    }

    if (currentIndex < lines.length) {
      const lineText = lines[currentIndex];
      const newRecorded = [
        ...recordedLines,
        { text: lineText, startTime: parseFloat(currentTime.toFixed(2)) }
      ];
      setRecordedLines(newRecorded);
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Insert Instrumental / Interlude Break (Does NOT advance lyric line index)
  const handleInsertInstrumental = () => {
    if (!isPlaying) {
      togglePlayPause();
    }

    const newRecorded = [
      ...recordedLines,
      { text: '♪ ~ Instrumental Break ~ ♪', startTime: parseFloat(currentTime.toFixed(2)) }
    ];
    setRecordedLines(newRecorded);
  };

  // Retap / Retime starting from a specific line index without restarting from beginning!
  const handleRetapFromLine = (index: number) => {
    const target = recordedLines[index];
    const seekTarget = Math.max(0, (target?.startTime || 0) - 1.0);

    // Keep lines up to index
    const preserved = recordedLines.slice(0, index);
    setRecordedLines(preserved);
    setCurrentIndex(index);

    // Seek audio and play
    handleTimeSeek(seekTarget);
    if (!isPlaying) {
      togglePlayPause();
    }
  };

  // Nudge timing of a specific recorded line (+/- seconds)
  const handleNudgeTime = (index: number, delta: number) => {
    setRecordedLines(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          startTime: Math.max(0, parseFloat((updated[index].startTime + delta).toFixed(2)))
        };
      }
      return updated;
    });
  };

  // Delete a specific recorded line
  const handleDeleteRecordedLine = (index: number) => {
    const isInst = recordedLines[index]?.text.includes('Instrumental Break');
    setRecordedLines(prev => prev.filter((_, i) => i !== index));
    if (!isInst) {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  };

  // Preview / Listen to a specific line
  const handlePreviewLine = (startTime: number) => {
    handleTimeSeek(Math.max(0, startTime - 0.5));
    if (!isPlaying) {
      togglePlayPause();
    }
  };

  // Undo last tapped item
  const handleUndo = () => {
    if (recordedLines.length > 0) {
      const lastRecorded = recordedLines[recordedLines.length - 1];
      const isInstrumental = lastRecorded.text.includes('Instrumental Break');

      setRecordedLines(prev => prev.slice(0, -1));
      if (!isInstrumental) {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
    }
  };

  // Keyboard Shortcuts: Space to Tap Lyric, I to Insert Instrumental, Ctrl+Z to Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTapLyric();
      } else if (e.code === 'KeyI' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleInsertInstrumental();
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingText, currentIndex, isPlaying, currentTime, lines, recordedLines]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentIndex(0);
    setRecordedLines([]);
    setModalPlayerCommand({
      type: 'replay',
      targetTime: 0,
      timestamp: Date.now()
    });
    if (localAudioRef.current) {
      localAudioRef.current.currentTime = 0;
      localAudioRef.current.pause();
    }
  };

  // Finish and save all synced lines
  const handleFinish = () => {
    const parsed: LyricLine[] = recordedLines.map((rec, idx) => {
      const nextTime = idx < recordedLines.length - 1 ? recordedLines[idx + 1].startTime : rec.startTime + 4;
      let mainText = rec.text;
      let romaji: string | undefined = undefined;

      if (rec.text.includes(' | ')) {
        const parts = rec.text.split(' | ');
        mainText = parts[0].trim();
        romaji = parts[1].trim();
      }

      return {
        id: `tapped-${idx}-${rec.startTime}`,
        startTime: rec.startTime,
        endTime: nextTime,
        text: mainText,
        romaji
      };
    });

    const rawLrc = exportToLRC(parsed);
    onSaveLyrics(parsed, rawLrc);
  };

  return (
    <div className="bg-stage-card p-6 md:p-8 rounded-3xl border border-stage-accent/40 shadow-2xl text-white max-w-4xl w-full max-h-[92vh] overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-white">
            <Sparkles className="w-6 h-6 text-stage-accent" /> Tap-to-Sync Lyric Editor
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Dengarkan musik asli di bawah dan tekan <b>SPASI</b> untuk merekam waktu, atau tekan <b>I</b> untuk jeda instrumental
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-sm bg-white/10 px-3 py-1.5 rounded-xl transition"
        >
          Tutup
        </button>
      </div>

      {/* SONG TITLE BANNER */}
      {song && (
        <div className="mb-5 p-3.5 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3 truncate mr-3">
            <div className="p-2 bg-stage-accent/20 text-stage-accent rounded-xl">
              <Music className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="font-bold text-sm text-white truncate">{song.title}</div>
              <div className="text-xs text-gray-400 truncate">{song.artist} • {song.source === 'youtube' ? 'YouTube Audio' : 'Local File'}</div>
            </div>
          </div>
          <span className="text-[11px] font-mono text-stage-neon bg-stage-neon/10 px-2.5 py-1 rounded-lg border border-stage-neon/30 shrink-0">
            {recordedLines.length > 0 ? `✨ ${recordedLines.length} Baris Tersinkron` : 'Real Audio Sync'}
          </span>
        </div>
      )}

      {/* REAL AUDIO EMBEDDED PLAYER */}
      <div className="mb-6 bg-black/70 p-4 rounded-2xl border border-white/10 shadow-lg">
        {song?.source === 'youtube' && song.youtubeId ? (
          <div className="space-y-3">
            <div className="w-full h-44 rounded-xl overflow-hidden shadow">
              <YouTubePlayer
                youtubeId={song.youtubeId}
                isPlaying={isPlaying}
                playerCommand={modalPlayerCommand}
                onTimeUpdate={(cur, dur) => {
                  setCurrentTime(cur);
                  if (dur) setDuration(dur);
                }}
              />
            </div>
          </div>
        ) : song?.mediaUrl ? (
          <audio
            ref={localAudioRef}
            src={song.mediaUrl}
            onTimeUpdate={() => {
              if (localAudioRef.current) {
                setCurrentTime(localAudioRef.current.currentTime);
                if (localAudioRef.current.duration) setDuration(localAudioRef.current.duration);
              }
            }}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="text-xs text-gray-500 italic text-center py-2">
            (Mode timer simulasi jika audio belum dimuat)
          </div>
        )}

        {/* Playback Controls & Seekbar */}
        <div className="flex items-center justify-between gap-4 mt-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlayPause}
              className="p-3 bg-stage-neon hover:bg-cyan-300 text-black font-bold rounded-xl transition shadow-md"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={handleReset}
              className="p-3 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl transition"
              title="Ulang dari awal"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-mono text-gray-400">
              <span className="text-stage-neon font-bold">{formatTimestamp(currentTime)}</span>
              <span>{formatTimestamp(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleTimeSeek(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-stage-neon"
            />
          </div>
        </div>
      </div>

      {/* MODE 1: EDIT TEXTAREA (Supports Quick Direct Save without re-tapping) */}
      {isEditingText ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase text-gray-300 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-stage-accent" /> Masukkan / Edit Teks Lirik Lagu:
            </label>
            <span className="text-[11px] text-gray-500">
              *Tulis lirik per baris. Format .LRC ber-timestamp [mm:ss.xx] juga didukung!
            </span>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder={`Contoh format:\n前前前世から僕は | Zenzenzense kara boku wa\n君を探し始めたよ | Kimi wo sagashi hajimeta yo`}
            className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm font-mono text-gray-200 focus:outline-none focus:border-stage-accent select-text"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleQuickSaveText}
              disabled={!rawText.trim()}
              className="py-3.5 bg-green-600 hover:bg-green-700 font-bold rounded-2xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-white"
              title="Simpan langsung teks & timestamp tanpa perlu tap ulang"
            >
              <Save className="w-4 h-4" /> 💾 Simpan Lirik Langsung (Quick Save)
            </button>

            <button
              onClick={handleStartSyncFromText}
              disabled={!rawText.trim()}
              className="py-3.5 bg-gradient-to-r from-stage-accent to-pink-600 hover:opacity-90 font-black rounded-2xl transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-white"
            >
              <Play className="w-4 h-4" /> ▶️ Masuk Mode Tap-to-Sync (Spasi)
            </button>
          </div>
        </div>
      ) : (
        /* MODE 2: TAP-TO-SYNC INTERACTIVE STAGE */
        <div className="space-y-5">
          {/* Target Baris yang Sedang Ditunggu */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-stage-accent/20 via-purple-950/40 to-stage-neon/20 border-2 border-stage-accent/60 text-center shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-stage-accent mb-2 px-2">
              <span>Baris Selanjutnya ({currentIndex < lines.length ? currentIndex + 1 : lines.length} dari {lines.length}):</span>
              <span className="text-gray-400 font-normal">Tekan SPASI saat kata pertama dinyanyikan</span>
            </div>

            {currentIndex < lines.length ? (
              <div className="text-2xl md:text-3xl font-black font-jp text-white drop-shadow-md py-2">
                {lines[currentIndex]}
              </div>
            ) : (
              <div className="text-2xl font-bold text-green-400 py-2">
                🎉 Seluruh baris lirik telah tersinkronisasi ({recordedLines.length} baris)!
              </div>
            )}
          </div>

          {/* DUAL ACTION BUTTONS: TAP LYRIC vs INSERT INSTRUMENTAL BREAK */}
          {currentIndex < lines.length ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <button
                onClick={handleTapLyric}
                className="md:col-span-6 py-6 rounded-2xl bg-gradient-to-r from-stage-accent to-pink-600 text-white font-black text-lg tracking-wider uppercase shadow-[0_0_25px_rgba(255,42,133,0.6)] hover:scale-[1.01] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Keyboard className="w-5 h-5 animate-pulse" /> TAP LIRIK (SPASI)
              </button>

              <button
                onClick={handleInsertInstrumental}
                className="md:col-span-4 py-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(147,51,234,0.5)] hover:scale-[1.01] active:scale-[0.98] transition flex items-center justify-center gap-2"
                title="Tandai jeda musik instrumental / solo gitar (Tombol I)"
              >
                <Disc3 className="w-5 h-5 animate-spin" /> 🎸 INSTRUMENTAL (I)
              </button>

              <button
                onClick={handleUndo}
                disabled={recordedLines.length === 0}
                className="md:col-span-2 py-6 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-gray-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                title="Batalkan baris terakhir (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
            </div>
          ) : (
            <div className="p-3 bg-green-500/20 border border-green-500/40 rounded-2xl text-center text-xs text-green-300">
              Semua lirik sudah memiliki waktu! Anda bisa mengecek, mendengarkan per baris, atau menggeser timing (+/-0.2s) di bawah ini:
            </div>
          )}

          {/* INTERACTIVE RECORDED LINES TIMELINE WITH INDIVIDUAL RETAP & NUDGE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold px-1">
              <span>DAFTAR TIMING BARIS ({recordedLines.length}):</span>
              <span className="text-[11px] text-gray-500 font-normal">
                Klik tombol <b>[⏮️ Tap Ulang]</b> untuk mengulang dari baris tertentu tanpa reset dari awal
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto bg-black/40 p-2.5 rounded-2xl border border-white/5 space-y-1.5 text-xs">
              {recordedLines.length === 0 ? (
                <div className="text-gray-500 italic text-center py-4">
                  Belum ada baris yang direkam. Tekan SPASI untuk mulai mencatat.
                </div>
              ) : (
                recordedLines.map((rec, idx) => {
                  const isInst = rec.text.includes('Instrumental Break');
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-xl border transition ${
                        isInst
                          ? 'bg-purple-950/40 border-purple-500/30 text-purple-300'
                          : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-200'
                      }`}
                    >
                      {/* Left: Timestamp & Line Text */}
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <span className="font-mono font-bold text-stage-neon bg-black/40 px-2 py-0.5 rounded text-[11px] border border-white/10 shrink-0">
                          {formatTimestamp(rec.startTime)}
                        </span>
                        <span className="truncate font-jp">
                          {isInst && <span className="mr-1">🎸</span>}
                          {rec.text}
                        </span>
                      </div>

                      {/* Right: Actions (Listen, Nudge +/-, Retap from here, Delete) */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Preview / Listen */}
                        <button
                          onClick={() => handlePreviewLine(rec.startTime)}
                          className="p-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md transition"
                          title="Dengarkan bagian ini"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Nudge -0.2s */}
                        <button
                          onClick={() => handleNudgeTime(idx, -0.2)}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md text-[10px] font-mono transition"
                          title="Mundurkan timing 0.2s"
                        >
                          -0.2s
                        </button>

                        {/* Nudge +0.2s */}
                        <button
                          onClick={() => handleNudgeTime(idx, 0.2)}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md text-[10px] font-mono transition"
                          title="Majukan timing 0.2s"
                        >
                          +0.2s
                        </button>

                        {/* Retap starting from this line */}
                        <button
                          onClick={() => handleRetapFromLine(idx)}
                          className="px-2 py-0.5 bg-stage-accent/20 hover:bg-stage-accent text-stage-accent hover:text-white rounded-md text-[10px] font-bold transition flex items-center gap-0.5"
                          title="Ulangi perekaman mulai dari baris ini"
                        >
                          <ArrowUpRight className="w-3 h-3" /> Tap Ulang
                        </button>

                        {/* Delete line */}
                        <button
                          onClick={() => handleDeleteRecordedLine(idx)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={() => {
                // Export current recorded lines as text for editing
                const lrcText = exportToLRC(recordedLines.map((rec, idx) => ({
                  id: `l-${idx}`,
                  startTime: rec.startTime,
                  endTime: idx < recordedLines.length - 1 ? recordedLines[idx + 1].startTime : rec.startTime + 4,
                  text: rec.text
                })));
                setRawText(lrcText);
                setIsEditingText(true);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Teks & LRC Manual
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleFinish}
                disabled={recordedLines.length === 0}
                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Simpan & Terapkan ke Lagu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
