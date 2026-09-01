import React, { useEffect, useRef } from 'react';
import type { PlayerCommand } from '../../types/karaoke';

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

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  youtubeId,
  isPlaying,
  volume = 85,
  isMuted = false,
  playerCommand = null,
  onTimeUpdate,
  onEnded,
  isStageView = false
}) => {
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const lastCommandTimestamp = useRef<number>(0);
  
  // Unique DOM ID per instance so multiple players never conflict
  const elementIdRef = useRef<string>(`yt-${youtubeId}-${Math.random().toString(36).substring(2, 9)}`);

  // Forcefully and repeatedly disable YouTube closed captions / subtitles
  const disableCaptions = (player: any) => {
    if (!player) return;
    try {
      if (typeof player.unloadModule === 'function') {
        player.unloadModule('captions');
        player.unloadModule('cc');
      }
      if (typeof player.setOption === 'function') {
        player.setOption('captions', 'track', {});
        player.setOption('cc', 'track', {});
        player.setOption('captions', 'reload', false);
        player.setOption('captions', 'fontSize', 0);
      }
    } catch (e) {
      // ignore
    }
  };

  // Schedule multiple delayed attempts because YouTube loads caption tracks asynchronously after video starts
  const enforceDisableCaptions = (player: any) => {
    disableCaptions(player);
    setTimeout(() => disableCaptions(player), 100);
    setTimeout(() => disableCaptions(player), 300);
    setTimeout(() => disableCaptions(player), 700);
    setTimeout(() => disableCaptions(player), 1500);
  };

  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      const elId = elementIdRef.current;
      if (document.getElementById(elId) && (window as any).YT && (window as any).YT.Player) {
        playerRef.current = new (window as any).YT.Player(elId, {
          videoId: youtubeId,
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: isStageView ? 0 : 1,
            modestbranding: 1,
            rel: 0,
            disablekb: isStageView ? 1 : 0,
            fs: 0,
            hl: 'ja',
            cc_load_policy: 0,
            cc_lang_pref: 'none',
            iv_load_policy: 3,
            playsinline: 1
          },
          events: {
            onReady: (event: any) => {
              try {
                enforceDisableCaptions(event.target);
                event.target.setVolume(isMuted ? 0 : volume);
                if (isMuted) event.target.mute();
                else event.target.unMute();
                if (isPlaying) event.target.playVideo();
              } catch (e) {
                console.warn("YouTube onReady error:", e);
              }
            },
            onStateChange: (event: any) => {
              // Whenever video starts playing (state 1), enforce caption removal
              if (event.data === 1 || event.data === 3) {
                enforceDisableCaptions(event.target);
              }

              // YT.PlayerState.ENDED === 0
              if (event.data === 0 && onEnded) {
                onEnded();
              }
            }
          }
        });
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [youtubeId]);

  // Synchronize Play / Pause
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      try {
        if (isPlaying) {
          enforceDisableCaptions(playerRef.current);
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        console.warn("YouTube play state change error:", e);
      }
    }
  }, [isPlaying]);

  // Synchronize Volume & Mute
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (e) {
        console.warn("YouTube volume error:", e);
      }
    }
  }, [volume, isMuted]);

  // Execute Dedicated Player Commands (Replay, Seek, Stop)
  useEffect(() => {
    if (
      playerCommand &&
      playerCommand.timestamp > lastCommandTimestamp.current &&
      playerRef.current &&
      typeof playerRef.current.seekTo === 'function'
    ) {
      lastCommandTimestamp.current = playerCommand.timestamp;
      try {
        if (playerCommand.type === 'replay') {
          enforceDisableCaptions(playerRef.current);
          playerRef.current.seekTo(0, true);
          playerRef.current.playVideo();
        } else if (playerCommand.type === 'seek') {
          playerRef.current.seekTo(playerCommand.targetTime, true);
        } else if (playerCommand.type === 'stop') {
          playerRef.current.seekTo(0, true);
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        console.warn("YouTube command execution error:", e);
      }
    }
  }, [playerCommand]);

  // Polling time updates at 50ms for ultra-smooth lyrics sweep
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && onTimeUpdate) {
          try {
            const cur = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            onTimeUpdate(cur, dur);
          } catch (e) {
            // ignore
          }
        }
      }, 50);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, onTimeUpdate]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl bg-black flex items-center justify-center">
      {/* Scale & Shift iframe slightly so bottom subtitle box area is cleanly cropped outside the view frame */}
      <div
        id={elementIdRef.current}
        className="w-full h-full aspect-video scale-[1.05] origin-top translate-y-[-1%]"
      />
      {isStageView && (
        <div className="absolute inset-0 z-10 pointer-events-none" />
      )}
    </div>
  );
};
