import React, { useState, useEffect, useRef } from 'react';
import type { PlayerCommand } from '../../types/karaoke';
import { VocalRemoverEngine } from '../../services/vocalRemover';
import { Music, Disc3 } from 'lucide-react';

interface LocalMediaPlayerProps {
  mediaUrl: string;
  instrumentalUrl?: string; // Optional dedicated studio instrumental track
  isPlaying: boolean;
  isVideo?: boolean;
  coverArt?: string;
  volume?: number; // 0-100
  isMuted?: boolean;
  vocalGuide?: boolean; // true = Vocal ON, false = Vocal OFF (Instrumental)
  playerCommand?: PlayerCommand | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  isStageView?: boolean;
}

export const LocalMediaPlayer: React.FC<LocalMediaPlayerProps> = ({
  mediaUrl,
  instrumentalUrl,
  isPlaying,
  isVideo = false,
  coverArt,
  volume = 85,
  isMuted = false,
  vocalGuide = true,
  playerCommand = null,
  onTimeUpdate,
  onEnded,
  isStageView = false
}) => {
  const mainMediaRef = useRef<HTMLMediaElement | null>(null);
  const instMediaRef = useRef<HTMLAudioElement | null>(null);
  const vocalEngineRef = useRef<VocalRemoverEngine | null>(null);
  const lastCommandTimestamp = useRef<number>(0);

  const hasDedicatedInstrumental = !!instrumentalUrl;

  // 1. Initialize DSP Vocal Remover Engine ONLY if there's no dedicated instrumental file
  useEffect(() => {
    const el = mainMediaRef.current;
    if (el && !hasDedicatedInstrumental) {
      console.log('🎵 [LocalPlayer] Setting up DSP Vocal Remover fallback for single track...');
      const engine = new VocalRemoverEngine();
      const ok = engine.setup(el);
      if (ok) {
        vocalEngineRef.current = engine;
        engine.setVocalRemoval(!vocalGuide);
        console.log('✅ [LocalPlayer] DSP Vocal Remover initialized successfully.');
      } else {
        console.warn('⚠️ [LocalPlayer] DSP Vocal Remover could not be initialized.');
      }
    }
  }, [mediaUrl, hasDedicatedInstrumental]);

  // 2. Handle Dual-Track Mode Switching (Vocal ON ↔ Instrumental ON)
  useEffect(() => {
    const targetVol = isMuted ? 0 : Math.max(0, Math.min(1, volume / 100));
    console.log(`🎚️ [LocalPlayer] Mode Switch -> vocalGuide: ${vocalGuide}, volume: ${volume}%, isPlaying: ${isPlaying}`);

    if (hasDedicatedInstrumental) {
      if (vocalGuide) {
        // Mode Normal (Vokal): Video/Audio utama bersuara, instrumental di-pause
        if (mainMediaRef.current) {
          mainMediaRef.current.muted = isMuted;
          mainMediaRef.current.volume = targetVol;
        }
        if (instMediaRef.current) {
          instMediaRef.current.pause();
          instMediaRef.current.volume = 0;
        }
      } else {
        // Mode Instrumental: Video/Audio utama di-mute (video tetap jalan), instrumental berputar
        if (mainMediaRef.current) {
          mainMediaRef.current.muted = true; // Mute main audio while video plays
        }
        if (instMediaRef.current) {
          instMediaRef.current.muted = isMuted;
          instMediaRef.current.volume = targetVol;
          if (mainMediaRef.current) {
            instMediaRef.current.currentTime = mainMediaRef.current.currentTime;
          }
          if (isPlaying) {
            instMediaRef.current.play().catch(err => {
              console.error('❌ [LocalPlayer] Error playing instrumental track:', err);
            });
          }
        }
      }
    } else {
      // Single track: Use DSP Filter
      if (vocalEngineRef.current) {
        vocalEngineRef.current.setVocalRemoval(!vocalGuide);
      }
      if (mainMediaRef.current) {
        mainMediaRef.current.muted = isMuted;
        mainMediaRef.current.volume = targetVol;
      }
    }
  }, [vocalGuide, volume, isMuted, hasDedicatedInstrumental, isPlaying]);

  // 3. Play / Pause Synchronization
  useEffect(() => {
    console.log(`⏯️ [LocalPlayer] Play/Pause effect -> isPlaying: ${isPlaying}`);
    if (isPlaying) {
      if (mainMediaRef.current) {
        mainMediaRef.current.play().catch(err => {
          console.error('❌ [LocalPlayer] Main media play error:', err);
        });
      }
      if (hasDedicatedInstrumental && !vocalGuide && instMediaRef.current) {
        if (mainMediaRef.current) {
          instMediaRef.current.currentTime = mainMediaRef.current.currentTime;
        }
        instMediaRef.current.play().catch(err => {
          console.error('❌ [LocalPlayer] Instrumental play error:', err);
        });
      }
    } else {
      if (mainMediaRef.current) mainMediaRef.current.pause();
      if (instMediaRef.current) instMediaRef.current.pause();
    }
  }, [isPlaying, mediaUrl, instrumentalUrl, hasDedicatedInstrumental, vocalGuide]);

  // 4. Dedicated Player Commands Execution (Replay, Seek, Stop)
  useEffect(() => {
    if (
      playerCommand &&
      playerCommand.timestamp > lastCommandTimestamp.current
    ) {
      lastCommandTimestamp.current = playerCommand.timestamp;
      console.log(`⚡ [LocalPlayer] Executing Player Command:`, playerCommand);
      try {
        if (playerCommand.type === 'replay') {
          if (mainMediaRef.current) {
            mainMediaRef.current.currentTime = 0;
            mainMediaRef.current.play().catch(e => console.error('Replay error:', e));
          }
          if (instMediaRef.current) {
            instMediaRef.current.currentTime = 0;
            if (!vocalGuide) {
              instMediaRef.current.play().catch(e => console.error('Inst replay error:', e));
            }
          }
        } else if (playerCommand.type === 'seek') {
          if (mainMediaRef.current) mainMediaRef.current.currentTime = playerCommand.targetTime;
          if (instMediaRef.current) instMediaRef.current.currentTime = playerCommand.targetTime;
        } else if (playerCommand.type === 'stop') {
          if (mainMediaRef.current) {
            mainMediaRef.current.currentTime = 0;
            mainMediaRef.current.pause();
          }
          if (instMediaRef.current) {
            instMediaRef.current.currentTime = 0;
            instMediaRef.current.pause();
          }
        }
      } catch (e) {
        console.error('❌ [LocalPlayer] Command execution exception:', e);
      }
    }
  }, [playerCommand, vocalGuide]);

  // 5. Periodic Time Update (Only updates master clock from main video/audio element)
  const handleTimeUpdate = () => {
    if (mainMediaRef.current) {
      const cur = mainMediaRef.current.currentTime;
      const dur = mainMediaRef.current.duration || 0;

      // Keep instrumental aligned if it is actively playing in instrumental mode
      if (hasDedicatedInstrumental && !vocalGuide && instMediaRef.current && !instMediaRef.current.paused) {
        const drift = Math.abs(instMediaRef.current.currentTime - cur);
        if (drift > 0.3) {
          instMediaRef.current.currentTime = cur;
        }
      }

      if (onTimeUpdate) {
        onTimeUpdate(cur, dur);
      }
    }
  };

  const [hasLoadError, setHasLoadError] = useState<boolean>(false);

  // Reset error when mediaUrl changes
  useEffect(() => {
    setHasLoadError(false);
  }, [mediaUrl]);

  // Error Catchers
  const handleMainError = (e: any) => {
    const err = e.currentTarget?.error;
    setHasLoadError(true);
    console.error('❌ [LocalPlayer Error] Main Media Element Error (Blob expired or file missing):', {
      code: err?.code,
      message: err?.message,
      mediaUrl
    });
  };

  const handleInstError = (e: any) => {
    const err = e.currentTarget?.error;
    console.error('❌ [LocalPlayer Error] Instrumental Audio Error:', {
      code: err?.code,
      message: err?.message,
      instrumentalUrl
    });
  };

  const handleWaiting = () => {
    console.warn('⏳ [LocalPlayer Warning] Media buffering / waiting for data...');
  };

  const handleStalled = () => {
    console.warn('⚠️ [LocalPlayer Warning] Media stalled (playback frozen by browser decoder)...');
  };

  if (isVideo) {
    return (
      <div className="w-full h-full relative overflow-hidden rounded-2xl bg-black flex items-center justify-center">
        <video
          ref={mainMediaRef as any}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onError={handleMainError}
          onWaiting={handleWaiting}
          onStalled={handleStalled}
          onEnded={onEnded}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
        />
        {hasDedicatedInstrumental && (
          <audio
            ref={instMediaRef}
            src={instrumentalUrl}
            onError={handleInstError}
            crossOrigin="anonymous"
            preload="auto"
          />
        )}
        {isStageView && <div className="absolute inset-0 z-10 pointer-events-none" />}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-stage-dark to-stage-card rounded-2xl overflow-hidden p-8 border border-white/10">
      {/* Primary / Vocal Audio Track */}
      <audio
        ref={mainMediaRef as any}
        src={mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onError={handleMainError}
        onWaiting={handleWaiting}
        onStalled={handleStalled}
        onEnded={onEnded}
        crossOrigin="anonymous"
        preload="auto"
      />

      {/* Dedicated Studio Instrumental / Off-Vocal Audio Track */}
      {hasDedicatedInstrumental && (
        <audio
          ref={instMediaRef}
          src={instrumentalUrl}
          onError={handleInstError}
          crossOrigin="anonymous"
          preload="auto"
        />
      )}

      {/* Album / Stage Visual Backdrop */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {coverArt ? (
          <img
            src={coverArt}
            alt="Song Cover"
            className="w-48 h-48 rounded-3xl object-cover shadow-[0_0_40px_rgba(255,42,133,0.5)] border-2 border-stage-accent mb-4 animate-float"
          />
        ) : (
          <div className="w-36 h-36 rounded-3xl bg-gradient-to-tr from-stage-accent to-stage-neon flex items-center justify-center shadow-[0_0_40px_rgba(0,240,255,0.4)] mb-4 animate-float">
            <Music className="w-16 h-16 text-white" />
          </div>
        )}

        {hasLoadError && (
          <div className="mt-3 p-3.5 bg-red-950/90 border border-red-500/60 rounded-2xl text-xs text-red-200 max-w-md shadow-xl">
            <div className="font-bold text-sm text-red-400 mb-1">⚠️ File Media Perlu Dipilih Ulang</div>
            File lokal ini berasal dari sesi browser sebelumnya (Blob URL sementara kadaluarsa).
            Silakan unggah ulang file MP3/MP4 lagu ini di tab <b>Upload Musik Lokal</b> untuk menyimpannya permanen di hard drive server.
          </div>
        )}

        {hasDedicatedInstrumental && !hasLoadError && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stage-gold/20 border border-stage-gold/50 text-stage-gold text-[11px] font-bold shadow-md">
            <Disc3 className="w-3.5 h-3.5 animate-spin" /> Studio Dual-Track Ready ({vocalGuide ? '🎤 Vokal Asli' : '🎸 Pure Instrumental'})
          </div>
        )}
      </div>
    </div>
  );
};
