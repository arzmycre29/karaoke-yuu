import React, { useState, useEffect, useRef } from 'react';
import type { LyricLine, LyricWord, Song, PlayerCommand } from '../../types/karaoke';
import {
  formatTimestamp,
  exportToLRC,
  parseLRC,
  tokenizeLine,
  applyTimingPreset,
  type TimingPresetType
} from '../../services/lyricParser';
import { YouTubePlayer } from '../player/YouTubePlayer';
import {
  Play, Pause, RotateCcw, Check, Sparkles, Keyboard, Undo2, Music,
  Edit3, Disc3, Save, Volume2, Trash2, ArrowUpRight, ArrowLeft, ArrowRight,
  Repeat, Wand2, Sliders, Scissors, Layers
} from 'lucide-react';

interface SyncedLineData {
  text: string;
  startTime: number;
  endTime: number;
  romaji?: string;
  words?: LyricWord[];
}

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
  const existingParsed = song?.parsedLyrics && song.parsedLyrics.length > 0 ? song.parsedLyrics : null;

  // Mode: 'text' | 'line-tap' | 'advance-syllable'
  const [editorMode, setEditorMode] = useState<'text' | 'line-tap' | 'advance-syllable'>(() => {
    if (existingParsed) return 'line-tap';
    if (initialLyricsText || song?.rawLyrics) return 'text';
    return 'text';
  });

  const [rawText, setRawText] = useState<string>(() => {
    if (existingParsed) {
      return exportToLRC(existingParsed);
    }
    return initialLyricsText || song?.rawLyrics || '';
  });

  // All lines list for line-tap mode
  const [lines, setLines] = useState<string[]>(() => {
    if (existingParsed) {
      return existingParsed.map(l => (l.romaji ? `${l.text} | ${l.romaji}` : l.text));
    }
    const text = initialLyricsText || song?.rawLyrics || '';
    if (!text) return [];
    return text
      .split('\n')
      .map(l => l.trim().replace(/^\[\d+:\d+(\.\d+)?\]\s*/, ''))
      .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));
  });

  // Recorded lines with full syllable word metadata
  const [recordedLines, setRecordedLines] = useState<SyncedLineData[]>(() => {
    if (existingParsed) {
      return existingParsed.map(l => ({
        text: l.romaji ? `${l.text} | ${l.romaji}` : l.text,
        startTime: l.startTime,
        endTime: l.endTime,
        romaji: l.romaji,
        words: l.words
      }));
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (existingParsed && existingParsed.length > 0) {
      return existingParsed.length;
    }
    return 0;
  });

  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(audioDuration);
  const [modalPlayerCommand, setModalPlayerCommand] = useState<PlayerCommand | null>(null);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  // ADVANCE SYLLABLE MODE STATE
  const [advanceLineIdx, setAdvanceLineIdx] = useState<number>(0);
  const [isWordTappingActive, setIsWordTappingActive] = useState<boolean>(false);
  const [activeWordTapIndex, setActiveWordTapIndex] = useState<number>(0);
  const [isLoopingAdvanceLine, setIsLoopingAdvanceLine] = useState<boolean>(false);
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);

  // Helper to extract clean text & romaji
  const getLineTextAndRomaji = (fullText: string) => {
    let mainText = fullText;
    let romaji: string | undefined = undefined;
    if (fullText.includes(' | ')) {
      const parts = fullText.split(' | ');
      mainText = parts[0].trim();
      romaji = parts[1].trim();
    }
    return { mainText, romaji };
  };

  // Convert raw text into lines and switch to line-tap mode
  const handleStartSyncFromText = () => {
    if (!rawText.trim()) return;
    const cleanLines = rawText
      .split('\n')
      .map(l => l.trim().replace(/^\[\d+:\d+(\.\d+)?\]\s*/, ''))
      .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));

    setLines(cleanLines);

    const parsed = parseLRC(rawText);
    if (parsed.length > 0) {
      setRecordedLines(
        parsed.map(l => ({
          text: l.romaji ? `${l.text} | ${l.romaji}` : l.text,
          startTime: l.startTime,
          endTime: l.endTime,
          romaji: l.romaji,
          words: l.words
        }))
      );
      setCurrentIndex(parsed.length);
    } else {
      setRecordedLines([]);
      setCurrentIndex(0);
    }

    setEditorMode('line-tap');
  };

  // Direct Quick Save from Text Mode
  const handleQuickSaveText = () => {
    if (!rawText.trim()) return;
    let parsed = parseLRC(rawText);

    if (parsed.length === 0) {
      const cleanLines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !/^\[(ti|ar|al|by|offset|length):/i.test(l));

      parsed = cleanLines.map((l, i) => {
        const { mainText, romaji } = getLineTextAndRomaji(l);
        return {
          id: `line-${i}-${Date.now()}`,
          startTime: i * 4,
          endTime: (i + 1) * 4,
          text: mainText,
          romaji
        };
      });
    }

    const rawLrc = exportToLRC(parsed);
    onSaveLyrics(parsed, rawLrc);
  };

  // Play / Pause
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

  // Line Tap (Spacebar in Standard Mode)
  const handleTapLyric = () => {
    if (!isPlaying) {
      togglePlayPause();
    }

    if (currentIndex < lines.length) {
      const lineText = lines[currentIndex];
      const { mainText, romaji } = getLineTextAndRomaji(lineText);
      const startT = parseFloat(currentTime.toFixed(2));
      const endT = startT + 4;

      const autoWords = tokenizeLine(mainText, startT, endT, romaji);

      const newRecorded: SyncedLineData[] = [
        ...recordedLines,
        {
          text: lineText,
          startTime: startT,
          endTime: endT,
          romaji,
          words: autoWords
        }
      ];

      // Update previous line's endTime
      if (newRecorded.length > 1) {
        newRecorded[newRecorded.length - 2].endTime = startT;
        const prevWords = newRecorded[newRecorded.length - 2].words;
        if (prevWords && prevWords.length > 0) {
          prevWords[prevWords.length - 1].endTime = startT;
        }
      }

      setRecordedLines(newRecorded);
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Instrumental Break Tag
  const handleInsertInstrumental = () => {
    if (!isPlaying) {
      togglePlayPause();
    }

    const newRecorded: SyncedLineData[] = [
      ...recordedLines,
      {
        text: '♪ ~ Instrumental Break ~ ♪',
        startTime: parseFloat(currentTime.toFixed(2)),
        endTime: parseFloat((currentTime + 8).toFixed(2))
      }
    ];

    if (newRecorded.length > 1) {
      newRecorded[newRecorded.length - 2].endTime = parseFloat(currentTime.toFixed(2));
    }

    setRecordedLines(newRecorded);
  };

  // Retap from specific line
  const handleRetapFromLine = (index: number) => {
    const target = recordedLines[index];
    const seekTarget = Math.max(0, (target?.startTime || 0) - 1.0);

    const preserved = recordedLines.slice(0, index);
    setRecordedLines(preserved);
    setCurrentIndex(index);

    handleTimeSeek(seekTarget);
    if (!isPlaying) {
      togglePlayPause();
    }
  };

  // Nudge line time
  const handleNudgeTime = (index: number, delta: number) => {
    setRecordedLines(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const newStart = Math.max(0, parseFloat((updated[index].startTime + delta).toFixed(2)));
        const oldStart = updated[index].startTime;
        const diff = newStart - oldStart;

        const shiftedWords = updated[index].words?.map(w => ({
          ...w,
          startTime: parseFloat((w.startTime + diff).toFixed(2)),
          endTime: parseFloat((w.endTime + diff).toFixed(2))
        }));

        updated[index] = {
          ...updated[index],
          startTime: newStart,
          endTime: Math.max(newStart + 0.5, parseFloat(((updated[index].endTime || newStart + 4) + diff).toFixed(2))),
          words: shiftedWords
        };
      }
      return updated;
    });
  };

  const handleDeleteRecordedLine = (index: number) => {
    const isInst = recordedLines[index]?.text.includes('Instrumental Break');
    setRecordedLines(prev => prev.filter((_, i) => i !== index));
    if (!isInst) {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  };

  const handlePreviewLine = (startTime: number) => {
    handleTimeSeek(Math.max(0, startTime - 0.2));
    if (!isPlaying) {
      togglePlayPause();
    }
  };

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

  // ADVANCE MODE: Ensure current advance line has initialized words
  const activeAdvanceLine = recordedLines[advanceLineIdx] || null;

  const getOrInitAdvanceWords = (line: SyncedLineData | null): LyricWord[] => {
    if (!line) return [];
    if (line.words && line.words.length > 0) return line.words;
    const { mainText, romaji } = getLineTextAndRomaji(line.text);
    return tokenizeLine(mainText, line.startTime, line.endTime || line.startTime + 4, romaji);
  };

  const currentAdvanceWords = getOrInitAdvanceWords(activeAdvanceLine);

  // Update words for current advance line
  const handleUpdateAdvanceWords = (newWords: LyricWord[]) => {
    if (!activeAdvanceLine) return;
    setRecordedLines(prev => {
      const updated = [...prev];
      if (updated[advanceLineIdx]) {
        updated[advanceLineIdx] = {
          ...updated[advanceLineIdx],
          words: newWords
        };
      }
      return updated;
    });
  };

  // Apply speed / rhythm curve preset in Advance Mode
  const handleApplyPresetCurve = (preset: TimingPresetType) => {
    if (!activeAdvanceLine) return;
    const lineStart = activeAdvanceLine.startTime;
    const lineEnd = activeAdvanceLine.endTime || lineStart + 4;
    const words = getOrInitAdvanceWords(activeAdvanceLine);

    const adjustedWords = applyTimingPreset(words, lineStart, lineEnd, preset);
    handleUpdateAdvanceWords(adjustedWords);
  };

  // Fine-tune a specific word timing in Advance Mode
  const handleNudgeWordTime = (wordIdx: number, deltaStart: number, deltaEnd: number) => {
    const updated = [...currentAdvanceWords];
    if (updated[wordIdx]) {
      const newStart = Math.max(0, parseFloat((updated[wordIdx].startTime + deltaStart).toFixed(2)));
      const newEnd = Math.max(newStart + 0.05, parseFloat((updated[wordIdx].endTime + deltaEnd).toFixed(2)));

      updated[wordIdx] = {
        ...updated[wordIdx],
        startTime: newStart,
        endTime: newEnd
      };

      if (wordIdx > 0 && updated[wordIdx - 1].endTime > newStart) {
        updated[wordIdx - 1].endTime = newStart;
      }
      if (wordIdx < updated.length - 1 && updated[wordIdx + 1].startTime < newEnd) {
        updated[wordIdx + 1].startTime = newEnd;
      }

      handleUpdateAdvanceWords(updated);
    }
  };

  // Update word token text
  const handleEditWordText = (wordIdx: number, newText: string) => {
    const updated = [...currentAdvanceWords];
    if (updated[wordIdx]) {
      updated[wordIdx] = {
        ...updated[wordIdx],
        text: newText
      };
      handleUpdateAdvanceWords(updated);
    }
  };

  // Split a word into 2 syllables
  const handleSplitWord = (wordIdx: number) => {
    const target = currentAdvanceWords[wordIdx];
    if (!target || target.text.length <= 1) return;

    const mid = Math.ceil(target.text.length / 2);
    const text1 = target.text.slice(0, mid);
    const text2 = target.text.slice(mid);
    const midTime = parseFloat(((target.startTime + target.endTime) / 2).toFixed(2));

    const newWords = [
      ...currentAdvanceWords.slice(0, wordIdx),
      { text: text1, startTime: target.startTime, endTime: midTime },
      { text: text2, startTime: midTime, endTime: target.endTime },
      ...currentAdvanceWords.slice(wordIdx + 1)
    ];

    handleUpdateAdvanceWords(newWords);
  };

  // Play line audio preview specifically for advance mode
  const handlePlayAdvanceLinePreview = () => {
    if (!activeAdvanceLine) return;
    const startSeek = Math.max(0, activeAdvanceLine.startTime - 0.2);
    handleTimeSeek(startSeek);
    if (!isPlaying) {
      togglePlayPause();
    }
  };

  // Real-time word tapping handler
  const handleStartWordTapping = () => {
    if (!activeAdvanceLine) return;
    setIsWordTappingActive(true);
    setActiveWordTapIndex(0);
    handlePlayAdvanceLinePreview();
  };

  const handleTapNextWord = () => {
    if (!activeAdvanceLine || !isWordTappingActive) return;

    const tapTime = parseFloat(currentTime.toFixed(2));
    const words = [...currentAdvanceWords];

    if (activeWordTapIndex < words.length) {
      words[activeWordTapIndex] = {
        ...words[activeWordTapIndex],
        startTime: tapTime
      };

      if (activeWordTapIndex > 0) {
        words[activeWordTapIndex - 1].endTime = tapTime;
      }

      if (activeWordTapIndex === words.length - 1) {
        words[activeWordTapIndex].endTime = parseFloat((tapTime + 1.2).toFixed(2));
        setIsWordTappingActive(false);
        setActiveWordTapIndex(0);
      } else {
        setActiveWordTapIndex(prev => prev + 1);
      }

      handleUpdateAdvanceWords(words);
    }
  };

  // Razor / Split Cut at Playhead Position (Video-Editor Style)
  const handleCutAtPlayhead = () => {
    if (!activeAdvanceLine || currentAdvanceWords.length === 0) return;
    const cutTime = parseFloat(currentTime.toFixed(2));

    // Find the word currently intersecting the playhead
    const wordIdx = currentAdvanceWords.findIndex(
      w => cutTime >= w.startTime + 0.04 && cutTime <= w.endTime - 0.04
    );

    if (wordIdx === -1) return;

    const target = currentAdvanceWords[wordIdx];
    const text = target.text;
    let text1 = text;
    let text2 = text.length > 1 ? text.slice(Math.ceil(text.length / 2)) : '..';

    if (text.length > 1) {
      const mid = Math.ceil(text.length / 2);
      text1 = text.slice(0, mid);
    }

    const newWords: LyricWord[] = [
      ...currentAdvanceWords.slice(0, wordIdx),
      { text: text1, startTime: target.startTime, endTime: cutTime },
      { text: text2, startTime: cutTime, endTime: target.endTime },
      ...currentAdvanceWords.slice(wordIdx + 1)
    ];

    handleUpdateAdvanceWords(newWords);
    setSelectedWordIdx(wordIdx + 1);
  };

  // Merge Word Clip with Next Clip
  const handleMergeWordWithNext = (wordIdx: number) => {
    if (wordIdx < 0 || wordIdx >= currentAdvanceWords.length - 1) return;
    const w1 = currentAdvanceWords[wordIdx];
    const w2 = currentAdvanceWords[wordIdx + 1];

    const mergedText = `${w1.text}${w1.text.endsWith(' ') || w2.text.startsWith(' ') ? '' : ' '}${w2.text}`.trim();
    const merged: LyricWord = {
      text: mergedText,
      startTime: w1.startTime,
      endTime: w2.endTime
    };

    const newWords = [
      ...currentAdvanceWords.slice(0, wordIdx),
      merged,
      ...currentAdvanceWords.slice(wordIdx + 2)
    ];

    handleUpdateAdvanceWords(newWords);
    setSelectedWordIdx(wordIdx);
  };

  // Advance mode loop listener
  useEffect(() => {
    if (editorMode === 'advance-syllable' && isLoopingAdvanceLine && activeAdvanceLine && isPlaying) {
      const lineEnd = activeAdvanceLine.endTime || activeAdvanceLine.startTime + 4;
      if (currentTime >= lineEnd + 0.3) {
        handleTimeSeek(Math.max(0, activeAdvanceLine.startTime - 0.2));
      }
    }
  }, [editorMode, isLoopingAdvanceLine, activeAdvanceLine, currentTime, isPlaying]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        editorMode === 'text' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).tagName === 'INPUT'
      ) {
        return;
      }

      if (editorMode === 'line-tap') {
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
      } else if (editorMode === 'advance-syllable') {
        if (e.code === 'Space') {
          e.preventDefault();
          if (isWordTappingActive) {
            handleTapNextWord();
          } else {
            togglePlayPause();
          }
        } else if ((e.code === 'KeyC' || e.code === 'KeyX') && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleCutAtPlayhead();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorMode, currentIndex, isPlaying, currentTime, lines, recordedLines, isWordTappingActive, activeWordTapIndex, currentAdvanceWords, activeAdvanceLine]);

  // Finalize & Save
  const handleFinish = () => {
    const parsed: LyricLine[] = recordedLines.map((rec, idx) => {
      const nextTime =
        idx < recordedLines.length - 1
          ? recordedLines[idx + 1].startTime
          : rec.endTime || rec.startTime + 4;

      const { mainText, romaji } = getLineTextAndRomaji(rec.text);

      const wordsToSave =
        rec.words && rec.words.length > 0
          ? rec.words
          : tokenizeLine(mainText, rec.startTime, nextTime, romaji);

      return {
        id: `tapped-${idx}-${rec.startTime}`,
        startTime: rec.startTime,
        endTime: nextTime,
        text: mainText,
        romaji: romaji || rec.romaji,
        words: wordsToSave
      };
    });

    const rawLrc = exportToLRC(parsed);
    onSaveLyrics(parsed, rawLrc);
  };

  return (
    <div className="bg-stage-card p-5 md:p-7 rounded-3xl border border-stage-accent/40 shadow-2xl text-white max-w-4xl w-full max-h-[94vh] overflow-y-auto select-none flex flex-col">
      {/* 1. HEADER & MODE SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-stage-accent" /> Tap-to-Sync & Advance Pacing Editor
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Sinkronisasi timing baris lirik & atur kecepatan pelafalan per kata/suku kata dengan presisi tinggi.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-black/50 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setEditorMode('text')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                editorMode === 'text' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Teks/LRC
            </button>
            <button
              onClick={() => setEditorMode('line-tap')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                editorMode === 'line-tap'
                  ? 'bg-stage-accent text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> Standard (Baris)
            </button>
            <button
              onClick={() => {
                if (recordedLines.length === 0 && lines.length > 0) {
                  handleStartSyncFromText();
                }
                setEditorMode('advance-syllable');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                editorMode === 'advance-syllable'
                  ? 'bg-gradient-to-r from-purple-600 to-stage-accent text-white shadow-[0_0_15px_rgba(255,42,133,0.5)]'
                  : 'text-stage-neon hover:text-white'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-stage-gold" /> Mode Advance (Kata) ✨
            </button>
          </div>

          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-xs bg-white/10 px-3 py-1.5 rounded-xl transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* 2. SONG BANNER */}
      {song && (
        <div className="mb-4 p-3 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3 truncate mr-3">
            <div className="p-2 bg-stage-accent/20 text-stage-accent rounded-xl">
              <Music className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-bold text-xs md:text-sm text-white truncate">{song.title}</div>
              <div className="text-[11px] text-gray-400 truncate">
                {song.artist} • {song.source === 'youtube' ? 'YouTube Stream' : 'Local File Audio'}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono text-stage-neon bg-stage-neon/10 px-2.5 py-1 rounded-lg border border-stage-neon/30 shrink-0">
            {recordedLines.length > 0 ? `✨ ${recordedLines.length} Baris Tersimpan` : 'Real Audio Sync'}
          </span>
        </div>
      )}

      {/* 3. EMBEDDED AUDIO PLAYER */}
      <div className="mb-5 bg-black/70 p-3.5 rounded-2xl border border-white/10 shadow-lg">
        {song?.source === 'youtube' && song.youtubeId ? (
          <div className="w-full h-36 rounded-xl overflow-hidden shadow mb-2">
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
          <div className="text-[11px] text-gray-500 italic text-center py-1">
            (Mode timer simulasi jika audio belum dimuat)
          </div>
        )}

        {/* Playback Controls & Seekbar */}
        <div className="flex items-center justify-between gap-3 mt-1">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={togglePlayPause}
              className="p-2.5 bg-stage-neon hover:bg-cyan-300 text-black font-bold rounded-xl transition shadow-md"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReset}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl transition"
              title="Ulang dari awal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="flex-1 space-y-0.5">
            <div className="flex justify-between text-[11px] font-mono text-gray-400">
              <span className="text-stage-neon font-bold">{formatTimestamp(currentTime)}</span>
              <span>{formatTimestamp(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.05"
              value={currentTime}
              onChange={e => handleTimeSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-stage-neon"
            />
          </div>
        </div>
      </div>

      {/* 4. CONTENT ACCORDING TO ACTIVE MODE */}

      {/* MODE 1: EDIT TEXTAREA */}
      {editorMode === 'text' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase text-gray-300 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-stage-accent" /> Teks Lirik Lagu / Format .LRC:
            </label>
            <span className="text-[11px] text-gray-500">
              *Mendukung lirik biasa atau format Enhanced LRC ber-tag suku kata &lt;mm:ss.xx&gt;
            </span>
          </div>

          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={8}
            placeholder={`Contoh format:\n前前前世から僕は | Zenzenzense kara boku wa\n君を探し始めたよ | Kimi wo sagashi hajimeta yo`}
            className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm font-mono text-gray-200 focus:outline-none focus:border-stage-accent select-text"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleQuickSaveText}
              disabled={!rawText.trim()}
              className="py-3 bg-green-600 hover:bg-green-700 font-bold rounded-2xl transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-white"
            >
              <Save className="w-4 h-4" /> 💾 Simpan Langsung (Quick Save)
            </button>

            <button
              onClick={handleStartSyncFromText}
              disabled={!rawText.trim()}
              className="py-3 bg-gradient-to-r from-stage-accent to-pink-600 hover:opacity-90 font-black rounded-2xl transition shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-white"
            >
              <Play className="w-4 h-4" /> ▶️ Masuk Mode Tap-to-Sync (Spasi)
            </button>
          </div>
        </div>
      )}

      {/* MODE 2: STANDARD LINE-BY-LINE TAP MODE */}
      {editorMode === 'line-tap' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-stage-accent/20 via-purple-950/40 to-stage-neon/20 border-2 border-stage-accent/60 text-center shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-stage-accent mb-1 px-1">
              <span>
                Baris Selanjutnya ({currentIndex < lines.length ? currentIndex + 1 : lines.length} dari {lines.length}):
              </span>
              <span className="text-gray-400 font-normal">Tekan SPASI saat kata pertama dinyanyikan</span>
            </div>

            {currentIndex < lines.length ? (
              <div className="text-xl md:text-2xl font-black font-jp text-white drop-shadow-md py-1.5">
                {lines[currentIndex]}
              </div>
            ) : (
              <div className="text-xl font-bold text-green-400 py-1.5">
                🎉 Seluruh baris lirik telah tersinkronisasi ({recordedLines.length} baris)!
              </div>
            )}
          </div>

          {/* DUAL ACTION BUTTONS */}
          {currentIndex < lines.length ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <button
                onClick={handleTapLyric}
                className="md:col-span-6 py-5 rounded-2xl bg-gradient-to-r from-stage-accent to-pink-600 text-white font-black text-base tracking-wider uppercase shadow-[0_0_25px_rgba(255,42,133,0.6)] hover:scale-[1.01] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Keyboard className="w-5 h-5 animate-pulse" /> TAP LIRIK (SPASI)
              </button>

              <button
                onClick={handleInsertInstrumental}
                className="md:col-span-4 py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs tracking-wider uppercase shadow-[0_0_25px_rgba(147,51,234,0.5)] hover:scale-[1.01] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Disc3 className="w-4 h-4 animate-spin" /> 🎸 INSTRUMENTAL (I)
              </button>

              <button
                onClick={handleUndo}
                disabled={recordedLines.length === 0}
                className="md:col-span-2 py-5 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-gray-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Undo2 className="w-4 h-4" /> Undo
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-green-500/20 border border-green-500/40 rounded-2xl text-center text-xs text-green-300">
              Semua baris sudah memiliki waktu. Anda bisa beralih ke <b>Mode Advance (Kata)</b> untuk menyetel kecepatan tiap suku kata, atau langsung simpan di bawah.
            </div>
          )}

          {/* RECORDED LINES TIMELINE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold px-1">
              <span>DAFTAR BARIS TERSINKRON ({recordedLines.length}):</span>
              <span className="text-[11px] text-gray-500 font-normal">
                Klik tombol <b>[Set Kata]</b> untuk atur tempo suku kata di Mode Advance
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto bg-black/40 p-2 rounded-2xl border border-white/5 space-y-1.5 text-xs">
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
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <span className="font-mono font-bold text-stage-neon bg-black/40 px-2 py-0.5 rounded text-[11px] border border-white/10 shrink-0">
                          {formatTimestamp(rec.startTime)}
                        </span>
                        <span className="truncate font-jp">
                          {isInst && <span className="mr-1">🎸</span>}
                          {rec.text}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handlePreviewLine(rec.startTime)}
                          className="p-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md transition"
                          title="Dengarkan bagian ini"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleNudgeTime(idx, -0.2)}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md text-[10px] font-mono transition"
                        >
                          -0.2s
                        </button>

                        <button
                          onClick={() => handleNudgeTime(idx, 0.2)}
                          className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-md text-[10px] font-mono transition"
                        >
                          +0.2s
                        </button>

                        <button
                          onClick={() => {
                            setAdvanceLineIdx(idx);
                            setEditorMode('advance-syllable');
                          }}
                          className="px-2 py-0.5 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white rounded-md text-[10px] font-bold transition flex items-center gap-0.5"
                          title="Atur tempo suku kata di Mode Advance"
                        >
                          <Wand2 className="w-3 h-3" /> Set Kata
                        </button>

                        <button
                          onClick={() => handleRetapFromLine(idx)}
                          className="px-2 py-0.5 bg-stage-accent/20 hover:bg-stage-accent text-stage-accent hover:text-white rounded-md text-[10px] font-bold transition flex items-center gap-0.5"
                        >
                          <ArrowUpRight className="w-3 h-3" /> Tap Ulang
                        </button>

                        <button
                          onClick={() => handleDeleteRecordedLine(idx)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
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

          {/* Footer Save */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              onClick={() => {
                const lrcText = exportToLRC(
                  recordedLines.map((rec, idx) => ({
                    id: `l-${idx}`,
                    startTime: rec.startTime,
                    endTime: rec.endTime || rec.startTime + 4,
                    text: rec.text,
                    words: rec.words
                  }))
                );
                setRawText(lrcText);
                setEditorMode('text');
              }}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <Edit3 className="w-3.5 h-3.5" /> Teks Manual
            </button>

            <button
              onClick={handleFinish}
              disabled={recordedLines.length === 0}
              className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Simpan & Terapkan ke Lagu
            </button>
          </div>
        </div>
      )}

      {/* MODE 3: ADVANCE SYLLABLE / WORD TIMING MODE */}
      {editorMode === 'advance-syllable' && (
        <div className="space-y-4">
          {recordedLines.length === 0 ? (
            <div className="text-center py-10 bg-black/40 rounded-2xl border border-white/10 space-y-3">
              <div className="text-sm text-gray-300 font-bold">
                Belum ada baris lirik yang direkam.
              </div>
              <p className="text-xs text-gray-500">
                Silakan masukkan teks lirik di tab <b>Teks/LRC</b> atau rekam timing baris di tab <b>Standard (Baris)</b> terlebih dahulu.
              </p>
              <button
                onClick={() => setEditorMode('line-tap')}
                className="px-4 py-2 bg-stage-accent rounded-xl text-xs font-bold text-white shadow"
              >
                Ke Mode Standard (Baris)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* LINE SELECTOR BAR */}
              <div className="p-3 bg-black/50 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAdvanceLineIdx(prev => Math.max(0, prev - 1))}
                    disabled={advanceLineIdx === 0}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition"
                    title="Baris Sebelumnya"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={advanceLineIdx}
                    onChange={e => setAdvanceLineIdx(parseInt(e.target.value, 10))}
                    className="bg-black border border-white/20 rounded-xl px-3 py-1.5 text-xs text-stage-neon font-bold focus:outline-none focus:border-stage-accent max-w-[220px] md:max-w-xs truncate"
                  >
                    {recordedLines.map((r, idx) => (
                      <option key={idx} value={idx}>
                        #{idx + 1} ({formatTimestamp(r.startTime)}) {r.text}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setAdvanceLineIdx(prev => Math.min(recordedLines.length - 1, prev + 1))}
                    disabled={advanceLineIdx === recordedLines.length - 1}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition"
                    title="Baris Berikutnya"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePlayAdvanceLinePreview}
                    className="px-3 py-1.5 bg-stage-neon hover:bg-cyan-300 text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow"
                  >
                    <Play className="w-3.5 h-3.5" /> Putar Bagian Ini
                  </button>

                  <button
                    onClick={() => setIsLoopingAdvanceLine(!isLoopingAdvanceLine)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      isLoopingAdvanceLine
                        ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(147,51,234,0.6)]'
                        : 'bg-white/10 border-white/10 text-gray-300 hover:text-white'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" /> Loop
                  </button>
                </div>
              </div>

              {/* ACTIVE LINE DISPLAY, MINI LIVE PREVIEW & VIDEO EDITOR TIMELINE */}
              {activeAdvanceLine && (() => {
                const lineStart = activeAdvanceLine.startTime;
                const lineEnd = activeAdvanceLine.endTime || activeAdvanceLine.startTime + 4;
                const lineDuration = Math.max(0.5, lineEnd - lineStart);
                const playheadPercent = Math.min(100, Math.max(0, ((currentTime - lineStart) / lineDuration) * 100));

                return (
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-950/60 via-black/80 to-pink-950/60 border-2 border-purple-500/40 text-center shadow-xl space-y-4">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                      <span>
                        Mulai: <b className="text-stage-neon">{formatTimestamp(lineStart)}</b>
                      </span>
                      <span className="text-stage-gold font-bold">
                        Durasi Baris: {lineDuration.toFixed(2)}s
                      </span>
                      <span>
                        Selesai: <b className="text-stage-accent">{formatTimestamp(lineEnd)}</b>
                      </span>
                    </div>

                    {/* 1. LIVE REAL-TIME KARAOKE SWEEP PREVIEW (With Descender Fix) */}
                    <div className="py-2.5 px-4 bg-black/70 rounded-2xl border border-white/10 shadow-inner">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                        ✨ Live Karaoke Sweep Preview:
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5">
                        {currentAdvanceWords.map((w, i) => {
                          const wDur = Math.max(0.01, w.endTime - w.startTime);
                          const prog =
                            currentTime < w.startTime
                              ? 0
                              : currentTime >= w.endTime
                              ? 100
                              : Math.min(100, Math.max(0, ((currentTime - w.startTime) / wDur) * 100));

                          return (
                            <span
                              key={i}
                              className="relative inline-block select-none"
                            >
                              {/* Background text */}
                              <span className="text-lg md:text-xl font-black font-jp tracking-wide text-white drop-shadow inline-block">
                                {w.text}
                              </span>

                              {/* Foreground swept text - Exactly superimposed 1:1 with base text */}
                              <span
                                aria-hidden="true"
                                className="absolute top-0 left-0 w-full h-full text-lg md:text-xl font-black font-jp tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-stage-accent via-pink-400 to-stage-neon drop-shadow-[0_0_15px_rgba(255,42,133,1)] inline-block select-none pointer-events-none"
                                style={{
                                  clipPath: `inset(-20% calc(100% - ${prog}%) -20% 0)`,
                                  WebkitClipPath: `inset(-20% calc(100% - ${prog}%) -20% 0)`,
                                  transition: 'clip-path 0.03s linear, -webkit-clip-path 0.03s linear'
                                }}
                              >
                                {w.text}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. VIDEO-EDITOR TIMELINE CUTTER TOOLBAR */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                      <div className="flex items-center space-x-2">
                        {/* Razor / Split Cut at Playhead Button */}
                        <button
                          onClick={handleCutAtPlayhead}
                          className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-stage-accent hover:opacity-90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-[0_0_15px_rgba(255,42,133,0.7)] flex items-center gap-1.5 active:scale-95"
                          title="Potong kata aktif tepat di posisi playhead (Shortcut: C)"
                        >
                          <Scissors className="w-4 h-4 animate-pulse" />
                          <span>✂️ CUT DI PLAYHEAD (C)</span>
                        </button>

                        {/* Real-Time Word Tap Button */}
                        {isWordTappingActive ? (
                          <button
                            onClick={handleTapNextWord}
                            className="px-3.5 py-2 bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-xl animate-pulse shadow-[0_0_15px_rgba(147,51,234,0.8)]"
                          >
                            👉 TAP KATA: "{currentAdvanceWords[activeWordTapIndex]?.text || 'Selesai'}" [SPASI]
                          </button>
                        ) : (
                          <button
                            onClick={handleStartWordTapping}
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Keyboard className="w-3.5 h-3.5" /> 🎙️ Tap Ritme
                          </button>
                        )}
                      </div>

                      {/* SPEED CURVE PRESETS */}
                      <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-gray-400 uppercase px-1.5 flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-stage-gold" /> Preset:
                        </span>
                        <button
                          onClick={() => handleApplyPresetCurve('linear')}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-[11px] font-semibold transition"
                          title="Bagi waktu sama rata ke setiap kata"
                        >
                          ⚖️ Rata
                        </button>
                        <button
                          onClick={() => handleApplyPresetCurve('hold_ending')}
                          className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[11px] font-bold transition"
                          title="Awal cepat, suku kata terakhir ditahan panjang (Melisma)"
                        >
                          ⏳ Tahan Akhir
                        </button>
                        <button
                          onClick={() => handleApplyPresetCurve('accelerate')}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-[11px] font-semibold transition"
                          title="Makin lama makin cepat"
                        >
                          ⚡ Cepat
                        </button>
                        <button
                          onClick={() => handleApplyPresetCurve('weighted')}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-[11px] font-semibold transition"
                          title="Disesuaikan dengan panjang karakter teks"
                        >
                          📏 Huruf
                        </button>
                      </div>
                    </div>

                    {/* 3. INTERACTIVE VIDEO-EDITOR MULTI-SEGMENT TIMELINE TRACK */}
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono px-1">
                        <span className="flex items-center gap-1.5 font-bold text-stage-neon">
                          <Layers className="w-3.5 h-3.5" /> Video Timeline Track (Klik untuk pindah playhead / Tekan C untuk memotong)
                        </span>
                        <span>Playhead: <b className="text-white">{formatTimestamp(currentTime)}</b></span>
                      </div>

                      {/* The Timeline Track Container */}
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                          const targetTime = parseFloat((lineStart + ratio * lineDuration).toFixed(2));
                          handleTimeSeek(targetTime);
                        }}
                        className="relative w-full h-16 bg-black/90 border border-white/20 rounded-2xl overflow-hidden cursor-pointer select-none shadow-inner p-1"
                      >
                        {/* Timeline Ruler Ticks */}
                        <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
                          {Array.from({ length: 9 }).map((_, idx) => (
                            <div key={idx} className="h-full border-r border-white/40 flex flex-col justify-between py-1 text-[8px] font-mono">
                              <span>|</span>
                              <span>|</span>
                            </div>
                          ))}
                        </div>

                        {/* Word Clips on Track */}
                        <div className="relative w-full h-full flex items-center">
                          {currentAdvanceWords.map((word, wIdx) => {
                            const wStartPct = Math.min(100, Math.max(0, ((word.startTime - lineStart) / lineDuration) * 100));
                            const wEndPct = Math.min(100, Math.max(0, ((word.endTime - lineStart) / lineDuration) * 100));
                            const wWidthPct = Math.max(1.5, wEndPct - wStartPct);
                            const isCurrent = currentTime >= word.startTime && currentTime <= word.endTime;
                            const isSelected = selectedWordIdx === wIdx;

                            // Palette for alternate chips
                            const colors = [
                              'from-purple-900/80 to-indigo-900/80 border-purple-400/50 text-purple-200',
                              'from-pink-900/80 to-rose-900/80 border-pink-400/50 text-pink-200',
                              'from-cyan-900/80 to-blue-900/80 border-cyan-400/50 text-cyan-200',
                              'from-emerald-900/80 to-teal-900/80 border-emerald-400/50 text-emerald-200'
                            ];
                            const colorClass = colors[wIdx % colors.length];

                            return (
                              <div
                                key={wIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWordIdx(wIdx);
                                  handleTimeSeek(word.startTime);
                                }}
                                style={{
                                  left: `${wStartPct}%`,
                                  width: `${wWidthPct}%`
                                }}
                                className={`absolute top-1 bottom-1 rounded-xl bg-gradient-to-r border flex flex-col items-center justify-center px-1.5 transition overflow-hidden shadow group ${colorClass} ${
                                  isSelected
                                    ? 'ring-2 ring-stage-neon shadow-[0_0_15px_rgba(0,240,255,0.8)] z-10'
                                    : isCurrent
                                    ? 'border-white shadow-[0_0_10px_rgba(255,42,133,0.6)] z-10'
                                    : 'hover:brightness-125'
                                }`}
                                title={`#${wIdx + 1}: "${word.text}" (${formatTimestamp(word.startTime)} - ${formatTimestamp(word.endTime)})`}
                              >
                                <span className="text-xs font-black font-jp truncate max-w-full drop-shadow">
                                  {word.text}
                                </span>
                                <span className="text-[9px] font-mono opacity-80 truncate">
                                  {(word.endTime - word.startTime).toFixed(2)}s
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Playhead Red/Neon Line */}
                        <div
                          style={{ left: `${playheadPercent}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-stage-neon shadow-[0_0_12px_rgba(0,240,255,1)] pointer-events-none z-20 transition-all duration-75"
                        >
                          <div className="absolute -top-1 -left-2.5 px-1.5 py-0.5 bg-stage-neon text-black font-black text-[9px] font-mono rounded shadow">
                            ▼
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SYLLABLE / WORD CARDS GRID & QUICK EDITORS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1">
                  <span>DAFTAR BALOK KATA ({currentAdvanceWords.length} Unit):</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    Gunakan tombol <b>✂️ Split</b> untuk membelah atau <b>🔗 Gabung</b> untuk menyatukan kembali kata
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {currentAdvanceWords.map((word, wIdx) => {
                    const duration = parseFloat((word.endTime - word.startTime).toFixed(2));
                    const isBeingTapped = isWordTappingActive && activeWordTapIndex === wIdx;
                    const isSelected = selectedWordIdx === wIdx;

                    return (
                      <div
                        key={wIdx}
                        onClick={() => setSelectedWordIdx(wIdx)}
                        className={`p-2.5 rounded-2xl border transition space-y-2 cursor-pointer ${
                          isSelected
                            ? 'bg-stage-accent/30 border-stage-neon shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                            : isBeingTapped
                            ? 'bg-stage-accent/30 border-stage-accent shadow-[0_0_15px_rgba(255,42,133,0.5)]'
                            : 'bg-black/50 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {/* Word Text, Split & Merge Action */}
                        <div className="flex items-center justify-between gap-1">
                          <input
                            type="text"
                            value={word.text}
                            onChange={e => handleEditWordText(wIdx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="bg-black/60 border border-white/10 rounded-lg px-2 py-0.5 text-xs font-bold font-jp text-stage-neon focus:outline-none focus:border-stage-accent flex-1"
                          />
                          
                          {/* Split Word Action */}
                          {word.text.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSplitWord(wIdx);
                              }}
                              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-[10px] transition flex items-center gap-0.5"
                              title="Pecah kata ini jadi 2 suku kata"
                            >
                              <Scissors className="w-2.5 h-2.5" /> Split
                            </button>
                          )}

                          {/* Merge with Next Action */}
                          {wIdx < currentAdvanceWords.length - 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMergeWordWithNext(wIdx);
                              }}
                              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-[10px] transition"
                              title="Gabung kata ini dengan kata berikutnya"
                            >
                              🔗 Gabung
                            </button>
                          )}
                        </div>

                        {/* Timing details */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-300">
                          <span>{formatTimestamp(word.startTime)}</span>
                          <span className="text-stage-gold font-bold">({duration}s)</span>
                          <span>{formatTimestamp(word.endTime)}</span>
                        </div>

                        {/* Fine tune buttons */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 text-[10px] font-mono">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNudgeWordTime(wIdx, -0.05, 0);
                              }}
                              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-gray-300 transition"
                              title="Mulai 0.05s lebih awal"
                            >
                              -0.05s
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNudgeWordTime(wIdx, 0.05, 0);
                              }}
                              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-gray-300 transition"
                              title="Mulai 0.05s lebih lambat"
                            >
                              +0.05s
                            </button>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNudgeWordTime(wIdx, 0, -0.1);
                              }}
                              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-gray-300 transition"
                              title="Kurangi durasi 0.1s"
                            >
                              Dur -
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNudgeWordTime(wIdx, 0, 0.1);
                              }}
                              className="px-1.5 py-0.5 bg-stage-accent/20 hover:bg-stage-accent text-stage-accent hover:text-white rounded transition"
                              title="Tambah durasi 0.1s"
                            >
                              Dur +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advance Mode Navigation & Final Save */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAdvanceLineIdx(prev => Math.max(0, prev - 1))}
                    disabled={advanceLineIdx === 0}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Baris Sebelumnya
                  </button>

                  <button
                    onClick={() => setAdvanceLineIdx(prev => Math.min(recordedLines.length - 1, prev + 1))}
                    disabled={advanceLineIdx === recordedLines.length - 1}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    Baris Berikutnya <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleFinish}
                    className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg"
                  >
                    <Check className="w-4 h-4" /> Simpan & Terapkan Semua
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
