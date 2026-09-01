import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { ParticipantScore, ScoringConfig } from '../../types/karaoke';
import { Trophy, Star, Music, X } from 'lucide-react';

interface LeaderboardOverlayProps {
  history: ParticipantScore[];
  scoringConfig: ScoringConfig;
  activeSummary?: ParticipantScore | null;
  onClose?: () => void;
}

export const LeaderboardOverlay: React.FC<LeaderboardOverlayProps> = ({
  history,
  scoringConfig,
  activeSummary,
  onClose
}) => {
  const sortedScores = [...history].sort((a, b) => b.finalScore - a.finalScore);

  useEffect(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff2a85', '#00f0ff', '#ffd700', '#ffffff', '#8b5cf6']
      });
    } catch (e) {
      console.warn("Confetti effect failed:", e);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white animate-fade-in overflow-y-auto">
      <div className="w-full max-w-5xl flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-stage-gold/20 text-stage-gold rounded-2xl border border-stage-gold/40 shadow-[0_0_20px_rgba(255,215,0,0.5)]">
            <Trophy className="w-8 h-8 animate-bounce" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-wider uppercase bg-gradient-to-r from-stage-gold via-yellow-200 to-white bg-clip-text text-transparent">
              Live Competition Leaderboard
            </h1>
            <p className="text-sm text-gray-400">
              Bobot Penilaian: {scoringConfig.pitchWeight}% Pitch Accuracy + {scoringConfig.judgeWeight}% Dewan Juri
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {activeSummary && (
        <div className="w-full max-w-5xl mb-8 p-6 rounded-3xl bg-gradient-to-r from-stage-accent/30 via-purple-900/40 to-stage-neon/30 border-2 border-stage-accent/50 shadow-[0_0_30px_rgba(255,42,133,0.4)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-stage-accent text-white font-black text-2xl flex items-center justify-center shadow-lg">
              ✨
            </div>
            <div>
              <div className="text-xs uppercase font-bold tracking-widest text-stage-neon">Hasil Penampilan Baru Saja</div>
              <div className="text-2xl font-black text-white">{activeSummary.singerName}</div>
              <div className="text-sm text-gray-300 flex items-center gap-2 mt-0.5">
                <Music className="w-4 h-4 text-stage-accent" /> {activeSummary.songTitle} - {activeSummary.artist}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-center">
            <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400">Pitch Mic ({scoringConfig.pitchWeight}%)</div>
              <div className="text-xl font-bold text-stage-neon font-mono">{activeSummary.pitchScore} pts</div>
            </div>
            <div className="bg-black/40 px-4 py-2 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400">Rerata Juri ({scoringConfig.judgeWeight}%)</div>
              <div className="text-xl font-bold text-purple-300 font-mono">{activeSummary.judgeScore} pts</div>
            </div>
            <div className="bg-gradient-to-br from-stage-gold to-yellow-600 px-6 py-2.5 rounded-2xl shadow-xl">
              <div className="text-xs uppercase font-bold text-black tracking-wider">Total Skor</div>
              <div className="text-3xl font-black text-black font-mono">{activeSummary.finalScore}</div>
            </div>
          </div>
        </div>
      )}

      {sortedScores.length > 0 && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {sortedScores[1] && (
            <div className="order-2 md:order-1 bg-gradient-to-b from-gray-700/40 to-stage-card/60 p-6 rounded-3xl border border-gray-400/40 shadow-xl flex flex-col items-center text-center transform md:translate-y-4">
              <div className="w-12 h-12 rounded-full bg-gray-300 text-gray-900 font-black text-xl flex items-center justify-center mb-3 shadow-md">
                2
              </div>
              <div className="text-lg font-bold text-white">{sortedScores[1].singerName}</div>
              <div className="text-xs text-gray-400 mb-4">{sortedScores[1].songTitle}</div>
              <div className="text-3xl font-black text-gray-200 font-mono">{sortedScores[1].finalScore} <span className="text-sm font-normal text-gray-400">pts</span></div>
            </div>
          )}

          {sortedScores[0] && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-yellow-500/30 to-stage-card/90 p-8 rounded-3xl border-2 border-stage-gold shadow-[0_0_40px_rgba(255,215,0,0.4)] flex flex-col items-center text-center transform md:-translate-y-4">
              <div className="p-3 bg-stage-gold text-black rounded-full mb-3 shadow-lg">
                <CrownIcon className="w-8 h-8" />
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-stage-gold mb-1">JUARA 1 / CHAMPION</div>
              <div className="text-2xl font-black text-white">{sortedScores[0].singerName}</div>
              <div className="text-xs text-gray-300 mb-4">{sortedScores[0].songTitle}</div>
              <div className="text-4xl font-black text-stage-gold font-mono text-glow-gold">{sortedScores[0].finalScore} <span className="text-base font-normal text-white">pts</span></div>
            </div>
          )}

          {sortedScores[2] && (
            <div className="order-3 md:order-3 bg-gradient-to-b from-amber-800/40 to-stage-card/60 p-6 rounded-3xl border border-amber-600/40 shadow-xl flex flex-col items-center text-center transform md:translate-y-6">
              <div className="w-12 h-12 rounded-full bg-amber-600 text-white font-black text-xl flex items-center justify-center mb-3 shadow-md">
                3
              </div>
              <div className="text-lg font-bold text-white">{sortedScores[2].singerName}</div>
              <div className="text-xs text-gray-400 mb-4">{sortedScores[2].songTitle}</div>
              <div className="text-3xl font-black text-amber-300 font-mono">{sortedScores[2].finalScore} <span className="text-sm font-normal text-gray-400">pts</span></div>
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-5xl bg-stage-card/80 rounded-3xl border border-white/10 p-6 shadow-2xl">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-300">
          <Star className="w-5 h-5 text-stage-gold" /> Peringkat Keseluruhan Peserta
        </h2>

        {sortedScores.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Belum ada peserta yang dinilai</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase text-xs">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Peserta</th>
                  <th className="py-3 px-4">Lagu Cover</th>
                  <th className="py-3 px-4 text-center">Pitch Mic ({scoringConfig.pitchWeight}%)</th>
                  <th className="py-3 px-4 text-center">Juri Avg ({scoringConfig.judgeWeight}%)</th>
                  <th className="py-3 px-4 text-right">Skor Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {sortedScores.map((score, index) => (
                  <tr key={score.id} className="hover:bg-white/5 transition">
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                        index === 0 ? 'bg-stage-gold text-black' :
                        index === 1 ? 'bg-gray-300 text-black' :
                        index === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-sans font-bold text-white">{score.singerName}</td>
                    <td className="py-4 px-4 font-sans text-gray-300">{score.songTitle}</td>
                    <td className="py-4 px-4 text-center text-stage-neon">{score.pitchScore}</td>
                    <td className="py-4 px-4 text-center text-purple-300">{score.judgeScore}</td>
                    <td className="py-4 px-4 text-right font-black text-lg text-stage-gold">{score.finalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const CrownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
  </svg>
);
