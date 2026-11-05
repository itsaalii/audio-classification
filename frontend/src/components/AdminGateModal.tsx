import React, { useState } from 'react';
import { HeroIcon } from './HeroIcon';

interface AdminGateModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminGateModal: React.FC<AdminGateModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === '1234') {
      setError(null);
      setPin('');
      onSuccess();
    } else {
      setError('PIN tidak valid. Silakan coba lagi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 sm:p-8 space-y-5">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
            <HeroIcon name="lock-closed" className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
              Verifikasi Akses Admin
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Panel Remote Control Center dilindungi otorisasi PIN untuk mencegah perubahan parameter tanpa izin.
            </p>
          </div>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              PIN Keamanan Admin
            </label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Masukkan PIN otorisasi"
                autoFocus
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-400 placeholder:text-xs placeholder:tracking-normal"
              />
            </div>
            {error && (
              <div className="mt-2 text-xs text-rose-600 font-medium flex items-center gap-1.5">
                <HeroIcon name="exclamation-triangle" className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Kembali ke PC Lab
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold tracking-wide transition-colors shadow-sm shadow-teal-600/20"
            >
              Masuk Mode Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

