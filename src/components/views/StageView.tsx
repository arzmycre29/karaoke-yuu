import React, { useState } from 'react';
import type { AppState } from '../../types/karaoke';
import { SyncService } from '../../services/syncService';
import { YouTubePlayer } from '../player/YouTubePlayer';
import { LocalMediaPlayer } from '../player/LocalMediaPlayer';
import { KaraokeLyricsView } from '../karaoke/KaraokeLyricsView';
import { PitchVisualizer } from '../karaoke/PitchVisualizer';
import { LeaderboardOverlay } from '../karaoke/LeaderboardOverlay';
import { Mic2, Flame, Trophy, Music2, Maximize2 } from 'lucide-react';

interface StageViewProps {
  state: AppState;
  onNavigateToOperator?: () => void;
}

export const StageView: React.FC<StageViewProps> = ({ state, onNavigateToOperator }) => {
  const sync = SyncService.getInstance();
  const currentItem = state.currentQueueItem;
  const currentSong = currentItem?.song;

  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'massive'>('large');

  const handleTimeUpdate = (cur: number, dur: number) => {
    sync.updateState({ currentTime: cur, duration: dur });
  };

  const handleSongEnded = () => {
    if (state.activeMode === 'competition') {
      sync.finalizePerformanceScore();
    } else {
      sync.nextSong();
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.warn(e));
    } else {
      document.exitFullscreen().catch(e => console.warn(e));
    }
  };

  // Check if singer name is custom or default
  const isTrainMode = state.activeMode === 'train';
  const hasCustomSinger = currentItem?.singerName && !currentItem.singerName.toLowerCase().includes('train') && currentItem.singerName !== 'Peserta Panggung';

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col justify-between select-none">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/25 via-black to-pink-950/25 pointer-events-none" />

      {/* TOP STAGE BANNER (Clean & Immersive for Projector) */}
      <div className="relative z-20 w-full px-6 py-4 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex items-center justify-between">
        {/* Song & Singer Details */}
        <div className="flex items-center space-x-4">
          <div className="w-13 h-13 p-0.5 rounded-2xl bg-gradient-to-tr from-stage-accent to-stage-neon shadow-[0_0_25px_rgba(255,42,133,0.7)] shrink-0">
            <div className="w-full h-full bg-stage-dark rounded-2xl flex items-center justify-center p-2.5">
              <Mic2 className="w-6 h-6 text-stage-accent animate-pulse" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${
                state.activeMode === 'competition'
                  ? 'bg-stage-gold text-black shadow-[0_0_12px_rgba(255,215,0,0.6)]'
                  : 'bg-stage-neon text-black shadow-[0_0_12px_rgba(0,240,255,0.6)]'
              }`}>
                {state.activeMode === 'competition' ? '★ COMPETITION PERFORMER' : '🔥 KARAOKE TRAIN'}
              </span>
              {currentSong?.animeTitle && (
                <span className="text-xs text-gray-300 font-semibold px-2.5 py-0.5 rounded-md bg-white/10">
                  {currentSong.animeTitle}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-wide mt-1 flex items-center gap-2">
              {currentItem ? (
                <>
                  {/* Show singer name only if in competition or if user explicitly typed a name */}
                  {(!isTrainMode || hasCustomSinger) && (
                    <>
                      <span className="text-stage-neon text-glow-neon">{currentItem.singerName}</span>
                      <span className="text-gray-500 font-normal text-xl">—</span>
                    </>
                  )}
                  <span className="text-white drop-shadow">{currentSong?.title}</span>
                  {currentSong?.artist && (
                    <span className="text-gray-400 font-normal text-base hidden md:inline">
                      ({currentSong.artist})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-400 font-normal">Menunggu Lagu Dimulai</span>
              )}
            </h1>
          </div>
        </div>

        {/* Live Pitch Meter & Leaderboard Button */}
        <div className="flex items-center space-x-3">
          {state.activeMode === 'competition' && (
            <PitchVisualizer pitchData={state.livePitch} showScore={true} />
          )}

          <button
            onClick={() => sync.updateState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))}
            className="p-3 bg-stage-card/80 hover:bg-stage-card border border-stage-gold/40 text-stage-gold rounded-2xl shadow-lg transition"
            title="Lihat Papan Skor Leaderboard"
          >
            <Trophy className="w-6 h-6" />
          </button>

          {onNavigateToOperator && (
            <button
              onClick={onNavigateToOperator}
              className="p-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-2xl transition opacity-60 hover:opacity-100 flex items-center gap-1.5 text-xs font-bold"
              title="Kembali ke Dashboard Operator"
            >
              <span>⚙️ Operator</span>
            </button>
          )}

          <button
            onClick={toggleFullScreen}
            className="p-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-2xl transition opacity-60 hover:opacity-100"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CENTER MEDIA & LYRICS STAGE AREA */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">
        {currentSong ? (
          <div className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center">
            {/* Player Display */}
            {currentSong.source === 'youtube' && currentSong.youtubeId ? (
              <div className="relative w-full h-[62vh] max-h-[550px] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-white/10">
                <YouTubePlayer
                  youtubeId={currentSong.youtubeId}
                  isPlaying={state.isPlaying}
                  volume={state.volume}
                  isMuted={state.isMuted}
                  playerCommand={state.playerCommand}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleSongEnded}
                  isStageView={true}
                />
              </div>
            ) : currentSong.mediaUrl ? (
              <div className={`relative w-full ${currentSong.isVideo ? 'h-[62vh] max-h-[550px]' : 'h-[48vh] max-h-[420px]'} rounded-3xl overflow-hidden shadow-2xl border border-white/10`}>
                <LocalMediaPlayer
                  key={currentSong.id}
                  mediaUrl={currentSong.mediaUrl}
                  instrumentalUrl={currentSong.instrumentalUrl}
                  isVideo={currentSong.isVideo}
                  isPlaying={state.isPlaying}
                  coverArt={currentSong.coverArt}
                  volume={state.volume}
                  isMuted={state.isMuted}
                  vocalGuide={state.vocalGuide}
                  playerCommand={state.playerCommand}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleSongEnded}
                  isStageView={true}
                />
              </div>
            ) : (
              <div className="text-gray-400 text-center">Sumber audio tidak ditemukan</div>
            )}

            {/* SYNCHRONIZED KARAOKE LYRICS OVERLAY */}
            {currentSong.parsedLyrics && currentSong.parsedLyrics.length > 0 && (
              <div className="w-full mt-3">
                <KaraokeLyricsView
                  lyrics={currentSong.parsedLyrics}
                  currentTime={state.currentTime}
                  showRomaji={true}
                  fontSize={fontSize}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-stage-card border border-white/10 mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(255,42,133,0.3)] animate-bounce">
              <Music2 className="w-12 h-12 text-stage-accent" />
            </div>
            <h2 className="text-3xl font-black text-white">J-STAGE READY</h2>
            <p className="text-gray-400 max-w-md mx-auto text-sm">
              Menunggu operator memasukkan antrean lagu dari Dashboard Operator...
            </p>
          </div>
        )}
      </div>

      {/* BOTTOM MARQUEE QUEUE TICKER */}
      <div className="relative z-20 w-full bg-stage-card/95 backdrop-blur-md border-t border-white/10 py-2.5 px-6 flex items-center overflow-hidden">
        <div className="flex items-center space-x-2 mr-6 text-stage-accent font-black text-xs uppercase tracking-widest shrink-0">
          <Flame className="w-4 h-4 animate-pulse" /> ANTREAN SELANJUTNYA:
        </div>

        <div className="flex-1 overflow-hidden whitespace-nowrap">
          {state.queue.length === 0 ? (
            <span className="text-gray-500 text-xs italic">
              Antrean kosong — Ajukan lagu animemu berikutnya melalui Dashboard Operator!
            </span>
          ) : (
            <div className="inline-flex space-x-6 animate-marquee text-xs">
              {state.queue.map((item, index) => (
                <span key={item.id} className="text-gray-300 font-medium inline-flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-stage-neon font-mono font-bold">
                    #{index + 1}
                  </span>
                  {(!isTrainMode || (!item.singerName.toLowerCase().includes('train') && item.singerName !== 'Peserta Panggung')) && (
                    <span className="text-white font-bold">{item.singerName} — </span>
                  )}
                  <span className="text-gray-300 font-bold">{item.song.title}</span>
                  <span className="text-stage-accent font-bold mx-2">•</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Quick Tweak for Stage Projector */}
        <div className="hidden md:flex items-center space-x-1 shrink-0 ml-4 border-l border-white/10 pl-4 text-xs">
          <span className="text-gray-500 mr-1">Teks Lirik:</span>
          <button
            onClick={() => setFontSize('normal')}
            className={`px-2 py-0.5 rounded ${fontSize === 'normal' ? 'bg-stage-accent text-white' : 'text-gray-400'}`}
          >
            S
          </button>
          <button
            onClick={() => setFontSize('large')}
            className={`px-2 py-0.5 rounded ${fontSize === 'large' ? 'bg-stage-accent text-white' : 'text-gray-400'}`}
          >
            M
          </button>
          <button
            onClick={() => setFontSize('massive')}
            className={`px-2 py-0.5 rounded ${fontSize === 'massive' ? 'bg-stage-accent text-white' : 'text-gray-400'}`}
          >
            XL
          </button>
        </div>
      </div>

      {/* LEADERBOARD / PODIUM OVERLAY */}
      {state.showLeaderboard && (
        <LeaderboardOverlay
          history={state.history}
          scoringConfig={state.scoringConfig}
          activeSummary={state.activeSingerScoreSummary}
          onClose={() => sync.updateState({ showLeaderboard: false })}
        />
      )}
    </div>
  );
};
