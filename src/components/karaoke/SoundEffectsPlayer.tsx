import React, { useEffect, useRef } from 'react';
import { SyncService } from '../../services/syncService';

/**
 * Web Audio Sound Effects Synthesizer (Zero asset dependency)
 */
export const SoundEffectsPlayer: React.FC = () => {
  const sync = SyncService.getInstance();
  
  // Track mount time so we NEVER play past triggers from localStorage on initial page load
  const mountTime = useRef<number>(Date.now());
  const lastTriggerTime = useRef<number>(sync.getState().soundFxTrigger?.timestamp || Date.now());

  const playSynthesizedSfx = (id: string) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (id === 'applause' || id === 'cheer') {
        const bufferSize = ctx.sampleRate * 2.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 1.5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
        noise.stop(ctx.currentTime + 2.5);
      } else if (id === 'gong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 1.8);

        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 2.0);
      } else if (id === 'fanfare' || id === 'victory') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;

          const startTime = ctx.currentTime + index * 0.12;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.9);
        });
      }
    } catch (e) {
      console.warn("Sound effect playback failed:", e);
    }
  };

  useEffect(() => {
    const unsub = sync.subscribe((state) => {
      // ONLY trigger if the sound effect timestamp is strictly newer than when the page was mounted
      if (
        state.soundFxTrigger &&
        state.soundFxTrigger.timestamp > mountTime.current &&
        state.soundFxTrigger.timestamp > lastTriggerTime.current
      ) {
        lastTriggerTime.current = state.soundFxTrigger.timestamp;
        playSynthesizedSfx(state.soundFxTrigger.id);
      }
    });
    return () => unsub();
  }, []);

  return null;
};
