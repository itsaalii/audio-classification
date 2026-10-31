import React, { useState } from 'react';
import { HeroIcon } from './HeroIcon';
import type { HistorySession } from './LiveMonitor';

interface HistoryLogProps {
  sessions: HistorySession[];
  onClearHistory: () => void;
}

export const HistoryLog: React.FC<HistoryLogProps> = ({
  sessions,
  onClearHistory,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'live' | 'file'>('all');

  const filtered = sessions.filter(s => {
    if (filterType === 'all') return true;
    return s.type === filterType;
  });

  // Hitung KPI Agregat
  const totalSessions = sessions.length;
  const totalDuration = sessions.reduce((acc, s) => acc + s.duration_s, 0);
  const avgNoisyPercent = totalSessions > 0
    ? sessions.reduce((acc, s) => acc + s.noisy_percentage, 0) / totalSessions
    : 0;

  const exportAllToCSV = () => {
    if (sessions.length === 0) return;
    const headers = [
      'ID',
      'Waktu',
      'Tipe',
      'Nama Berkas',
      'Durasi (s)',
      'Total Segmen',
      'Segmen Berisik',
      'Segmen Kondusif',
      'Persentase Bising (%)',
      'Status Dominan',
      'Keyakinan Rata-rata (%)'
    ];

    const rows = sessions.map(s => [
      s.id,
      `"${new Date(s.timestamp).toLocaleString('id-ID')}"`,
      s.type === 'live' ? 'Live Monitor' : 'File Analysis',
      `"${s.filename || '-'}"`,
      s.duration_s.toFixed(1),
      s.total_segments,
      s.noisy_segments,
      s.clean_segments,
      s.noisy_percentage.toFixed(1),
      s.dominant_label,
      s.avg_confidence.toFixed(1)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `riwayat_acoustiknn_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <HeroIcon name="clock" className="w-5 h-5 text-teal-600" />
              <span>Log Riwayat Analisis Sesi Akustik</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tercatat otomatis setiap kali pemantauan mikrofon atau analisis berkas selesai.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportAllToCSV}
              disabled={sessions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm"
            >
              <HeroIcon name="arrow-down-tray" className="w-4 h-4 text-teal-600" />
              <span>Ekspor Semua (CSV)</span>
            </button>
            <button
              onClick={onClearHistory}
              disabled={sessions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 transition-colors"
            >
              <HeroIcon name="trash" className="w-4 h-4 text-rose-600" />
              <span>Bersihkan Log</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Total Sesi Terekam</div>
            <div className="text-xl font-bold font-mono text-slate-800">{totalSessions} Sesi</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Akumulasi Durasi</div>
            <div className="text-xl font-bold font-mono text-teal-700">{formatSecs(totalDuration)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">Rata-rata Kebisingan</div>
            <div className="text-xl font-bold font-mono text-slate-800">{avgNoisyPercent.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded font-medium ${
                filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Semua ({sessions.length})
            </button>
            <button
              onClick={() => setFilterType('live')}
              className={`px-3 py-1 rounded font-medium ${
                filterType === 'live' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Live Monitor ({sessions.filter(s => s.type === 'live').length})
            </button>
            <button
              onClick={() => setFilterType('file')}
              className={`px-3 py-1 rounded font-medium ${
                filterType === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
              }`}
            >
              Berkas Audio ({sessions.filter(s => s.type === 'file').length})
            </button>
          </div>

          <span className="text-xs text-slate-400">
            Menampilkan {filtered.length} riwayat
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            <HeroIcon name="clock" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>Belum ada sesi analisis yang terekam.</p>
            <p className="mt-1">Gunakan Live Monitor atau Analisis Berkas untuk memulai perekaman.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Sumber / Berkas</th>
                  <th className="py-2.5 px-3">Durasi</th>
                  <th className="py-2.5 px-3">Segmen (4s)</th>
                  <th className="py-2.5 px-3">Rasio Bising</th>
                  <th className="py-2.5 px-3">Hasil Dominan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filtered.map((s) => {
                  const isNoisy = s.dominant_label === 'berisik';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-600 font-sans whitespace-nowrap">
                        {new Date(s.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          s.type === 'live' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <HeroIcon name={s.type === 'live' ? 'microphone' : 'document-text'} className="w-3 h-3" />
                          <span>{s.type === 'live' ? 'Live' : 'Berkas'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate" title={s.filename || 'Mikrofon Real-Time'}>
                        {s.filename || 'Mikrofon Perangkat'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{s.duration_s.toFixed(1)}s</td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {s.total_segments} <span className="text-[10px] text-slate-400">({s.noisy_segments} B / {s.clean_segments} K)</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold" style={{ color: s.noisy_percentage >= 50 ? '#E11D48' : '#0D9488' }}>
                        {s.noisy_percentage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isNoisy ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'
                        }`}>
                          <HeroIcon name={isNoisy ? 'exclamation-triangle' : 'check-circle'} className="w-3 h-3" />
                          <span>{s.dominant_label.toUpperCase()}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
