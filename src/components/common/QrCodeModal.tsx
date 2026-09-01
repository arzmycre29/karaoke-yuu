import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, QrCode, X, Copy, Check, Wifi } from 'lucide-react';

interface QrCodeModalProps {
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'judge' | 'request'>('judge');
  const [copied, setCopied] = useState<boolean>(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const basePath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const judgeUrl = `${currentOrigin}${basePath}?view=judge`;
  const requestUrl = `${currentOrigin}${basePath}?view=request`;

  const activeUrl = activeTab === 'judge' ? judgeUrl : requestUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-stage-card p-6 md:p-8 rounded-3xl border border-white/20 shadow-2xl max-w-md w-full text-white space-y-6 text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="w-12 h-12 rounded-2xl bg-stage-neon/20 text-stage-neon mx-auto flex items-center justify-center mb-3 border border-stage-neon/40 shadow-lg">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black">Scan QR Perangkat Mobile</h2>
          <p className="text-xs text-gray-400 mt-1">
            Buka kamera smartphone untuk langsung terhubung tanpa install aplikasi
          </p>
        </div>

        <div className="flex items-center justify-center space-x-2 bg-black/50 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('judge')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'judge' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" /> QR Panel Juri
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'request' ? 'bg-stage-gold text-black shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" /> QR Request Penonton
          </button>
        </div>

        <div className="p-6 bg-white rounded-3xl inline-block mx-auto shadow-2xl border-4 border-stage-accent/30">
          <QRCodeSVG
            value={activeUrl}
            size={220}
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="flex items-center justify-between bg-black/60 p-3 rounded-2xl border border-white/10 text-xs">
          <span className="truncate text-gray-300 font-mono mr-2">{activeUrl}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-stage-accent hover:bg-pink-600 text-white font-bold rounded-xl flex items-center gap-1 shrink-0 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>
        </div>

        <div className="bg-stage-dark p-3.5 rounded-2xl border border-white/5 text-[11px] text-gray-400 text-left flex items-start space-x-2.5">
          <Wifi className="w-4 h-4 text-stage-neon shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white block">Tips Venue (Offline / LAN):</span>
            Pastikan HP Juri dan Laptop Operator terhubung ke WiFi / Hotspot yang sama jika menggunakan jaringan lokal venue.
          </div>
        </div>
      </div>
    </div>
  );
};
