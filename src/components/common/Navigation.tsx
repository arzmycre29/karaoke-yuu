import React from 'react';
import type { ViewType, EventMode } from '../../types/karaoke';
import { Tv, Sliders, Smartphone, QrCode, Maximize2, Sparkles, Flame } from 'lucide-react';

interface NavigationProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  activeMode: EventMode;
  onToggleMode: () => void;
  onOpenQrModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  activeMode,
  onToggleMode,
  onOpenQrModal
}) => {
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.warn(e));
    } else {
      document.exitFullscreen().catch(e => console.warn(e));
    }
  };

  const openStageWindow = () => {
    window.open(`${window.location.origin}${window.location.pathname}?view=stage`, '_blank', 'width=1280,height=720');
  };

  return (
    <header className="sticky top-0 z-40 bg-stage-dark/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between text-white shadow-xl">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-stage-accent via-purple-600 to-stage-neon flex items-center justify-center font-black text-lg shadow-[0_0_15px_rgba(255,42,133,0.6)]">
          J
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-base bg-gradient-to-r from-white via-pink-200 to-stage-neon bg-clip-text text-transparent">
              J-STAGE KARAOKE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stage-accent/20 border border-stage-accent/40 text-stage-accent">
              EVENT SUITE
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-jp">アニソン カラオケ イベント</p>
        </div>
      </div>

      <div className="flex items-center space-x-1 bg-black/50 p-1 rounded-2xl border border-white/10">
        <button
          onClick={() => onSelectView('stage')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            currentView === 'stage'
              ? 'bg-stage-accent text-white shadow-[0_0_12px_rgba(255,42,133,0.7)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span className="hidden sm:inline">Stage (Proyektor)</span>
        </button>

        <button
          onClick={() => onSelectView('operator')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            currentView === 'operator'
              ? 'bg-stage-neon text-black shadow-[0_0_12px_rgba(0,240,255,0.7)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Operator</span>
        </button>

        <button
          onClick={() => onSelectView('judge')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            currentView === 'judge'
              ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.7)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">Juri Mobile</span>
        </button>

        <button
          onClick={() => onSelectView('request')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            currentView === 'request'
              ? 'bg-stage-gold text-black shadow-[0_0_12px_rgba(255,215,0,0.7)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Audience Request</span>
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleMode}
          className={`hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold transition border ${
            activeMode === 'competition'
              ? 'bg-amber-500/20 border-amber-500/50 text-stage-gold'
              : 'bg-stage-neon/20 border-stage-neon/50 text-stage-neon'
          }`}
          title="Klik untuk ganti mode acara"
        >
          {activeMode === 'competition' ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-stage-gold animate-spin" />
              <span>Mode: Competition</span>
            </>
          ) : (
            <>
              <Flame className="w-3.5 h-3.5 text-stage-neon" />
              <span>Mode: Karaoke Train</span>
            </>
          )}
        </button>

        <button
          onClick={onOpenQrModal}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 hover:text-white transition"
          title="Buka QR Code untuk HP Juri & Request Lagu"
        >
          <QrCode className="w-4 h-4" />
        </button>

        <button
          onClick={openStageWindow}
          className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 bg-stage-card hover:bg-white/10 rounded-xl border border-white/10 text-xs text-gray-300 hover:text-white transition"
          title="Buka Layar Panggung di Tab/Jendela Baru untuk Proyektor External"
        >
          <Tv className="w-3.5 h-3.5 text-stage-accent" />
          <span>Pop-out Stage</span>
        </button>

        <button
          onClick={toggleFullScreen}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 hover:text-white transition"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
