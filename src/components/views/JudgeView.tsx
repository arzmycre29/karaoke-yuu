import React, { useState, useEffect } from 'react';
import type { AppState, JudgeSubmission } from '../../types/karaoke';
import { SyncService } from '../../services/syncService';
import { Award, User, Music, CheckCircle2, Send, MessageSquare } from 'lucide-react';

interface JudgeViewProps {
  state: AppState;
}

export const JudgeView: React.FC<JudgeViewProps> = ({ state }) => {
  const sync = SyncService.getInstance();
  const currentItem = state.currentQueueItem;

  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(() => {
    return localStorage.getItem('j_stage_judge_id') || 'judge-1';
  });

  const currentJudge = state.judges.find(j => j.id === selectedJudgeId) || state.judges[0];

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const initial: Record<string, number> = {};
    state.scoringConfig.criteria.forEach(c => {
      initial[c.id] = 85;
    });
    setScores(initial);
    setComments('');
    setIsSubmitted(false);
  }, [currentItem?.id, selectedJudgeId]);

  const handleScoreChange = (criterionId: string, val: number) => {
    setScores(prev => ({ ...prev, [criterionId]: val }));
    setIsSubmitted(false);
  };

  const totalJudgeScore = React.useMemo(() => {
    let sum = 0;
    let totalWeight = 0;
    state.scoringConfig.criteria.forEach(c => {
      const s = scores[c.id] || 0;
      sum += (s * c.weight);
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round(sum / totalWeight) : 85;
  }, [scores, state.scoringConfig.criteria]);

  const handleSubmitScore = () => {
    if (!currentItem) return;

    const submission: Omit<JudgeSubmission, 'submittedAt'> = {
      judgeId: selectedJudgeId,
      judgeName: currentJudge.name,
      queueItemId: currentItem.id,
      criteriaScores: scores,
      totalJudgeScore,
      comments
    };

    sync.submitJudgeScore(submission);
    setIsSubmitted(true);
    localStorage.setItem('j_stage_judge_id', selectedJudgeId);
  };

  return (
    <div className="min-h-[calc(100vh-53px)] bg-stage-dark text-white p-4 md:p-8 max-w-xl mx-auto flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6 bg-stage-card p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-600/30 text-purple-400 rounded-xl border border-purple-500/40">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Dewan Juri</div>
              <select
                value={selectedJudgeId}
                onChange={(e) => setSelectedJudgeId(e.target.value)}
                className="bg-black/60 border border-white/20 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:border-purple-400"
              >
                {state.judges.map(j => (
                  <option key={j.id} value={j.id} className="bg-stage-dark text-white">
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase text-gray-400">Mode Acara</div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stage-gold/20 text-stage-gold border border-stage-gold/40">
              {state.activeMode === 'competition' ? 'Competition' : 'Train Mode'}
            </span>
          </div>
        </div>

        {currentItem ? (
          <div className="mb-6 p-5 rounded-3xl bg-gradient-to-r from-stage-accent/20 via-purple-950/40 to-stage-card border border-stage-accent/40 shadow-xl">
            <div className="flex items-center space-x-4 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-stage-accent text-white font-black text-xl flex items-center justify-center shadow-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-stage-neon">Peserta Sedang Tampil:</div>
                <h2 className="text-xl font-black text-white">{currentItem.singerName}</h2>
                {currentItem.performerNote && (
                  <div className="text-xs text-gray-400">{currentItem.performerNote}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-200 bg-black/40 p-2.5 rounded-xl border border-white/5">
              <Music className="w-4 h-4 text-stage-accent shrink-0" />
              <span className="font-bold truncate">{currentItem.song.title}</span>
              <span className="text-gray-400 text-xs">({currentItem.song.artist})</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-stage-card rounded-3xl border border-white/10 mb-6 text-gray-400">
            <p className="font-bold">Belum ada peserta yang aktif di panggung</p>
            <p className="text-xs mt-1 text-gray-500">Nilai akan dapat diinput saat lagu dimulai</p>
          </div>
        )}

        {currentItem && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-xs uppercase font-bold text-gray-400 px-1">
              <span>Kriteria Penilaian</span>
              <span>Bobot Nilai</span>
            </div>

            {state.scoringConfig.criteria.map(crit => {
              const currentVal = scores[crit.id] || 85;
              return (
                <div key={crit.id} className="bg-stage-card p-4 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{crit.name}</div>
                      <div className="text-[11px] text-gray-400">{crit.description}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">({crit.weight}%)</span>
                      <span className="text-xl font-black font-mono text-stage-neon bg-black/40 px-2.5 py-0.5 rounded-lg border border-white/10">
                        {currentVal}
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={currentVal}
                    onChange={(e) => handleScoreChange(crit.id, parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-stage-accent"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>50 (Cukup)</span>
                    <span>75 (Baik)</span>
                    <span>90 (Sangat Baik)</span>
                    <span>100 (Sempurna)</span>
                  </div>
                </div>
              );
            })}

            <div className="bg-stage-card p-4 rounded-2xl border border-white/10">
              <label className="block text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Catatan Juri untuk Peserta (Opsional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  setIsSubmitted(false);
                }}
                rows={2}
                placeholder="Misal: Falsetto sangat stabil di chorus, pertahankan stage presence..."
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
        )}
      </div>

      {currentItem && (
        <div className="sticky bottom-4 z-30 bg-stage-card/95 backdrop-blur-md p-4 rounded-3xl border border-white/20 shadow-2xl space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-gray-400 font-bold uppercase">Total Nilai Juri Ini:</span>
            <span className="text-3xl font-black font-mono text-stage-gold text-glow-gold">
              {totalJudgeScore} <span className="text-sm font-normal text-gray-400">/ 100</span>
            </span>
          </div>

          <button
            onClick={handleSubmitScore}
            disabled={isSubmitted}
            className={`w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 ${
              isSubmitted
                ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-default'
                : 'bg-gradient-to-r from-purple-600 to-stage-accent hover:opacity-90 text-white active:scale-98 shadow-[0_0_25px_rgba(139,92,246,0.6)]'
            }`}
          >
            {isSubmitted ? (
              <>
                <CheckCircle2 className="w-5 h-5" /> Nilai Berhasil Terkirim ke Panggung!
              </>
            ) : (
              <>
                <Send className="w-5 h-5" /> Submit Nilai ke Panggung
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
