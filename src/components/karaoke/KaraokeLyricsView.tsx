import React, { useMemo } from 'react';
import type { LyricLine } from '../../types/karaoke';

interface KaraokeLyricsViewProps {
  lyrics?: LyricLine[];
  currentTime: number;
  showRomaji?: boolean;
  fontSize?: 'normal' | 'large' | 'massive';
}

export const KaraokeLyricsView: React.FC<KaraokeLyricsViewProps> = ({
  lyrics = [],
  currentTime,
  showRomaji = true,
  fontSize = 'large'
}) => {
  // Find current active line index based on current playback time
  const activeIndex = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;

    for (let i = 0; i < lyrics.length; i++) {
      const line = lyrics[i];
      if (currentTime >= line.startTime - 0.15 && currentTime <= line.endTime) {
        return i;
      }
    }

    // If before first line
    if (currentTime < lyrics[0].startTime) {
      return 0;
    }

    // If between lines, find upcoming line
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime < lyrics[i].startTime) {
        return Math.max(0, i - 1);
      }
    }

    return lyrics.length - 1;
  }, [lyrics, currentTime]);

  if (!lyrics || lyrics.length === 0) {
    return null;
  }

  const currentLine = activeIndex >= 0 ? lyrics[activeIndex] : lyrics[0];
  const nextLine = activeIndex < lyrics.length - 1 ? lyrics[activeIndex + 1] : null;

  // Intro countdown before the 1st line of song
  const isIntroCountdown = currentTime < currentLine.startTime;
  const secondsToIntro = Math.max(0, Math.ceil(currentLine.startTime - currentTime));

  // Check if current line is an Instrumental Break
  const isInstrumental =
    currentLine.text.includes('Instrumental Break') ||
    currentLine.text.toLowerCase().includes('[instrumental]') ||
    currentLine.text.toLowerCase().includes('[solo]');

  // Time remaining until the next sung line starts
  const timeToNextLine = nextLine ? Math.max(0, nextLine.startTime - currentTime) : 0;
  const isApproachingNextLine = (isInstrumental || currentTime > currentLine.endTime) && nextLine && timeToNextLine <= 3.2 && timeToNextLine > 0;
  const secondsToNextLine = Math.max(1, Math.ceil(timeToNextLine));

  // Calculate percentage progress through current line
  let lineProgress = 0;
  if (currentLine) {
    const duration = Math.max(0.8, currentLine.endTime - currentLine.startTime);
    if (currentTime >= currentLine.startTime) {
      lineProgress = Math.min(100, Math.max(0, ((currentTime - currentLine.startTime) / duration) * 100));
    } else {
      lineProgress = 0;
    }
  }

  const fontSizeClasses = {
    normal: 'text-2xl md:text-3xl',
    large: 'text-3xl md:text-5xl',
    massive: 'text-4xl md:text-6xl'
  }[fontSize];

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-4 text-center select-none py-4">
      {/* 1. SONG INTRO COUNTDOWN (Before 1st line) */}
      {isIntroCountdown && secondsToIntro <= 8 && secondsToIntro > 0 && (
        <div className="inline-flex items-center space-x-2 px-5 py-2 rounded-full bg-stage-accent/30 border border-stage-accent text-stage-accent text-xs md:text-sm font-bold animate-pulse shadow-lg">
          <span>Bersiap Bernyanyi Dalam:</span>
          <span className="text-white font-mono text-lg font-black">{secondsToIntro}s</span>
        </div>
      )}

      {/* 2. CURRENT ACTIVE LINE (Glowing Sweep or Instrumental Break Banner) */}
      {currentLine && (
        isInstrumental ? (
          <div className="py-5 px-10 rounded-3xl bg-black/75 backdrop-blur-xl border-2 border-stage-neon/60 shadow-[0_0_35px_rgba(0,240,255,0.4)] text-center transition-all duration-200 max-w-4xl space-y-3">
            <div className="text-2xl md:text-4xl font-black tracking-widest flex items-center justify-center gap-3">
              <span>🎸</span>
              <span className="bg-gradient-to-r from-stage-neon via-pink-400 to-stage-accent bg-clip-text text-transparent">
                INSTRUMENTAL SOLO BREAK
              </span>
              <span>🎷</span>
            </div>

            {/* ABA-ABA COUNTDOWN 3 DETIK SEBELUM VOKAL MASUK */}
            {isApproachingNextLine ? (
              <div className="inline-flex items-center space-x-3 px-6 py-2 rounded-2xl bg-stage-accent text-white font-black text-sm md:text-base animate-bounce shadow-[0_0_25px_rgba(255,42,133,0.9)] border border-white/50">
                <span>🔥 SIAP-SIAP MASUK:</span>
                <span className="font-mono text-2xl text-stage-gold drop-shadow-md">
                  {secondsToNextLine}s
                </span>
                <div className="flex space-x-1 ml-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${secondsToNextLine >= 1 ? 'bg-stage-gold animate-ping' : 'bg-white/30'}`} />
                  <span className={`w-2.5 h-2.5 rounded-full ${secondsToNextLine >= 2 ? 'bg-stage-gold' : 'bg-white/30'}`} />
                  <span className={`w-2.5 h-2.5 rounded-full ${secondsToNextLine >= 3 ? 'bg-stage-gold' : 'bg-white/30'}`} />
                </div>
              </div>
            ) : (
              <div className="text-xs md:text-sm text-gray-300 font-semibold tracking-wider">
                Nikmati musiknya • Aba-aba hitungan mundur akan muncul sebelum lirik dimulai
              </div>
            )}
          </div>
        ) : (
          <div className="relative py-4 px-8 rounded-3xl bg-black/60 backdrop-blur-xl border border-stage-accent/40 shadow-[0_0_30px_rgba(0,0,0,0.8)] transition-all duration-150 transform scale-105 max-w-5xl">
            {/* Countdown cue if there was a gap after previous line */}
            {isApproachingNextLine && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-stage-accent text-white text-xs font-black animate-bounce shadow-md">
                🔥 Masuk dalam: {secondsToNextLine}s
              </div>
            )}

            {/* Main Japanese / Primary Text with Gradient Sweep */}
            <div className="relative inline-block">
              {/* Background base text (Unsung part: Clean white with dark shadow) */}
              <span
                className={`${fontSizeClasses} font-black font-jp tracking-wide text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]`}
              >
                {currentLine.text}
              </span>

              {/* Foreground swept text (Sung part: Vibrant Neon Gradient Wipe) */}
              <span
                className={`absolute top-0 left-0 ${fontSizeClasses} font-black font-jp tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-stage-accent via-pink-400 to-stage-neon overflow-hidden whitespace-nowrap drop-shadow-[0_0_25px_rgba(255,42,133,1)]`}
                style={{
                  width: `${lineProgress}%`,
                  transition: 'width 0.05s linear'
                }}
              >
                {currentLine.text}
              </span>
            </div>

            {/* Romaji Subtitle / Pronunciation */}
            {showRomaji && currentLine.romaji && (
              <div className="relative mt-2">
                <span className="text-base md:text-xl font-semibold tracking-wider text-gray-200 drop-shadow">
                  {currentLine.romaji}
                </span>
                <div
                  className="h-1 bg-gradient-to-r from-stage-accent to-stage-neon rounded-full mx-auto mt-2 transition-all duration-75 shadow-[0_0_10px_rgba(0,240,255,0.8)]"
                  style={{ width: `${Math.min(100, lineProgress)}%` }}
                />
              </div>
            )}
          </div>
        )
      )}

      {/* 3. NEXT LINE PREVIEW (Highlighted with extra visibility when approaching) */}
      {nextLine && (
        <div className={`transition-all duration-300 ${isApproachingNextLine ? 'scale-110 opacity-100' : 'opacity-80'}`}>
          <span className={`px-4 py-1.5 rounded-xl border shadow-md font-jp text-lg md:text-2xl ${
            isApproachingNextLine
              ? 'bg-stage-accent/30 border-stage-accent text-white shadow-[0_0_20px_rgba(255,42,133,0.6)] font-bold'
              : 'bg-stage-neon/10 border-stage-neon/20 text-gray-300'
          }`}>
            {nextLine.text}
          </span>
          {showRomaji && nextLine.romaji && (
            <div className={`text-xs md:text-sm font-sans tracking-wide mt-1.5 ${
              isApproachingNextLine ? 'text-stage-gold font-bold' : 'text-stage-neon/80'
            }`}>
              {nextLine.romaji}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
