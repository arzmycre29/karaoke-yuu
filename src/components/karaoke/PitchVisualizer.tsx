import React, { useEffect, useRef } from 'react';
import type { LivePitchData } from '../../types/karaoke';
import { Mic, Activity, Zap } from 'lucide-react';

interface PitchVisualizerProps {
  pitchData: LivePitchData;
  showScore?: boolean;
}

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
  pitchData,
  showScore = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pitchHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freq = pitchData.detectedFrequency;
    pitchHistoryRef.current.push(freq > 0 ? freq : 0);
    if (pitchHistoryRef.current.length > 50) {
      pitchHistoryRef.current.shift();
    }

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 10; y < height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const history = pitchHistoryRef.current;
    if (history.length > 1) {
      ctx.beginPath();
      const step = width / (history.length - 1);

      for (let i = 0; i < history.length; i++) {
        const hFreq = history[i];
        const normalizedY = hFreq > 0 ? height - Math.min(height - 10, Math.max(10, ((hFreq - 80) / 720) * height)) : height - 5;
        const x = i * step;

        if (i === 0) {
          ctx.moveTo(x, normalizedY);
        } else {
          ctx.lineTo(x, normalizedY);
        }
      }

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#00f0ff');
      gradient.addColorStop(1, '#ff2a85');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [pitchData]);

  return (
    <div className="flex items-center space-x-4 bg-black/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-stage-neon/30 shadow-lg">
      <div className="flex items-center space-x-3">
        <div className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
          pitchData.isMicActive && pitchData.detectedFrequency > 0 
            ? 'bg-stage-accent text-white animate-pulse shadow-[0_0_15px_rgba(255,42,133,0.8)]' 
            : 'bg-gray-800 text-gray-400'
        }`}>
          <Mic className="w-5 h-5" />
        </div>
        
        <div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-stage-neon flex items-center gap-1">
            <Activity className="w-3 h-3 animate-spin" /> PITCH DETECTOR
          </div>
          <div className="text-xl font-black font-mono tracking-wider text-white">
            {pitchData.detectedNote !== '--' ? (
              <span className="text-stage-neon font-bold text-glow-neon">
                {pitchData.detectedNote} <span className="text-xs text-gray-400 font-normal">({pitchData.detectedFrequency}Hz)</span>
              </span>
            ) : (
              <span className="text-gray-500 text-base font-normal">Sing into mic...</span>
            )}
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <canvas
          ref={canvasRef}
          width={160}
          height={40}
          className="rounded-lg bg-stage-dark/80 border border-white/10"
        />
      </div>

      {showScore && (
        <div className="border-l border-white/10 pl-4">
          <div className="text-[10px] uppercase font-bold tracking-widest text-stage-gold flex items-center gap-1">
            <Zap className="w-3 h-3 text-stage-gold" /> ACCURACY
          </div>
          <div className="text-2xl font-black text-stage-gold font-mono text-glow-gold">
            {pitchData.currentPitchScore}%
          </div>
        </div>
      )}
    </div>
  );
};
