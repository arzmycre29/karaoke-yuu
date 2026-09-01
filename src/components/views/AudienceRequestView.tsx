import React, { useState } from 'react';
import { SyncService } from '../../services/syncService';
import { PresetService } from '../../services/presetService';
import type { Song } from '../../types/karaoke';
import { Flame, Music, PlusCircle, CheckCircle2, User, Sparkles } from 'lucide-react';

export const AudienceRequestView: React.FC = () => {
  const sync = SyncService.getInstance();
  const presetService = PresetService.getInstance();
  const presets = presetService.getPresets();

  const [singerName, setSingerName] = useState<string>('');
  const [songTitle, setSongTitle] = useState<string>('');
  const [artistName, setArtistName] = useState<string>('');
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;

    let ytId = extractYoutubeId(youtubeUrl);
    if (!ytId && !youtubeUrl) {
      ytId = 'PDSkFeMVNFs';
    }

    const newSong: Song = {
      id: `song-req-${Date.now()}`,
      title: songTitle,
      artist: artistName || 'Anime / J-Pop Artist',
      source: 'youtube',
      youtubeId: ytId || undefined,
      duration: 240
    };

    sync.addSongToQueue({
      song: newSong,
      singerName: singerName.trim() || 'Penonton (Train Request)',
      performerNote: 'Audience Request',
      mode: 'train'
    });

    setIsSuccess(true);
    setSongTitle('');
    setArtistName('');
    setYoutubeUrl('');
    setTimeout(() => setIsSuccess(false), 5000);
  };

  const handleQuickPick = (preset: Song) => {
    setSongTitle(preset.title);
    setArtistName(preset.artist);
    if (preset.youtubeId) {
      setYoutubeUrl(`https://www.youtube.com/watch?v=${preset.youtubeId}`);
    }
  };

  return (
    <div className="min-h-screen bg-stage-dark text-white p-4 md:p-6 max-w-lg mx-auto flex flex-col justify-between select-none">
      <div>
        {/* Clean Mobile Brand Banner */}
        <div className="text-center mb-6 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-stage-accent via-purple-600 to-stage-neon mx-auto flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(255,42,133,0.6)] mb-3">
            J
          </div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-stage-neon/20 border border-stage-neon/40 text-stage-neon text-xs font-bold mb-2">
            <Flame className="w-4 h-4" /> J-STAGE KARAOKE TRAIN
          </div>
          <h1 className="text-2xl font-black text-white">Ajukan Lagu Karaoke</h1>
          <p className="text-xs text-gray-400 mt-1">
            Daftarkan judul lagu animemu ke antrean panggung sekarang!
          </p>
        </div>

        {/* Success Notification */}
        {isSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-green-500/20 border border-green-500/50 text-green-300 flex items-center space-x-3 shadow-lg animate-bounce">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div className="text-sm">
              <b>Berhasil Masuk Antrean!</b> Bersiaplah saat giliran lagumu diputar di layar panggung.
            </div>
          </div>
        )}

        {/* Request Form */}
        <form onSubmit={handleRequestSubmit} className="bg-stage-card p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-stage-neon" /> Judul Lagu / Judul Anime
            </label>
            <input
              type="text"
              required
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Misal: Gurenge, Silhouette, Idol..."
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-stage-neon"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stage-accent" /> Nama / Panggilan (Opsional)
            </label>
            <input
              type="text"
              value={singerName}
              onChange={(e) => setSingerName(e.target.value)}
              placeholder="Bisa dikosongkan untuk nyanyi bareng"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-stage-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
              Artis / Penyanyi Asli (Opsional)
            </label>
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Misal: LiSA, RADWIMPS, YOASOBI"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-stage-neon"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
              Link YouTube Video Karaoke / Off-Vocal (Opsional)
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-stage-neon"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              *Jika dikosongkan, panitia akan mencarikan lagu karaoke terbaik di YouTube.
            </p>
          </div>

          <button
            type="submit"
            disabled={!songTitle.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-stage-accent to-purple-600 hover:opacity-90 font-black text-sm uppercase tracking-wider text-white shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" /> Ajukan ke Antrean Panggung
          </button>
        </form>

        {/* Popular Presets Quick-Pick */}
        {presets.length > 0 && (
          <div className="mt-8 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-stage-gold" /> Pilihan Cepat Lagu Populer
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {presets.slice(0, 5).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleQuickPick(s)}
                  className="w-full bg-stage-card/60 hover:bg-stage-card p-3 rounded-2xl border border-white/5 hover:border-stage-accent/40 text-left flex items-center justify-between transition group"
                >
                  <div className="truncate mr-2">
                    <div className="font-bold text-sm text-white group-hover:text-stage-neon transition truncate">{s.title}</div>
                    <div className="text-xs text-gray-400 truncate">{s.artist} {s.animeTitle && `• ${s.animeTitle}`}</div>
                  </div>
                  <PlusCircle className="w-4 h-4 text-gray-500 group-hover:text-stage-accent transition shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-gray-500 py-3 border-t border-white/5">
        J-Stage Karaoke Suite • Anime Event Companion
      </div>
    </div>
  );
};
