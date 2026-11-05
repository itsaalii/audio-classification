import React from 'react';
import { HeroIcon } from './HeroIcon';
import type { IconName } from './HeroIcon';

export type TabKey = 'live' | 'file' | 'history' | 'specs';

interface TabItem {
  key: TabKey;
  label: string;
  icon: IconName;
  badge?: string;
}

interface HeaderProps {
  role: 'lab' | 'admin';
  onSwitchRole: (targetRole: 'lab' | 'admin') => void;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isModelReady: boolean;
  isLiveActive: boolean;
  historyCount: number;
  labConnected?: boolean;
  labMicReady?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  onSwitchRole,
  activeTab,
  onTabChange,
  isModelReady,
  isLiveActive,
  historyCount,
  labConnected = false,
  labMicReady = false,
}) => {
  const tabs: TabItem[] = [
    { key: 'live', label: 'Monitoring Real-Time', icon: 'microphone', badge: isLiveActive ? 'Live' : undefined },
    { key: 'file', label: 'Analisis Berkas', icon: 'document-text' },
    { key: 'history', label: 'Riwayat Sesi', icon: 'clock', badge: historyCount > 0 ? `${historyCount}` : undefined },
    { key: 'specs', label: 'Tentang Model & PSD', icon: 'cpu' },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3 gap-3.5">
          {/* Brand Row & Status Badges */}
          <div className="flex items-center justify-between lg:justify-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-600/20">
                <HeroIcon name={role === 'admin' ? 'adjustments' : 'computer-desktop'} className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-800 font-display">
                    AcoustiKNN Studio
                  </span>

                  {/* Role Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    role === 'admin'
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    <HeroIcon name={role === 'admin' ? 'shield-check' : 'computer-desktop'} className="w-3.5 h-3.5" />
                    <span>{role === 'admin' ? 'Remote Control Center' : 'PC Lab Display (Kiosk)'}</span>
                  </span>

                  {/* Engine Model Badge */}
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isModelReady
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isModelReady ? 'bg-teal-500 animate-pulse-subtle' : 'bg-rose-500'}`} />
                    <span>{isModelReady ? 'Model WKNN 4s Siap' : 'Memuat Model'}</span>
                  </span>
                </div>

                <div className="text-xs text-slate-500 hidden sm:block">
                  {role === 'admin'
                    ? 'Pusat Kendali Jarak Jauh & Konfigurasi Parameter Studio'
                    : 'Layar Tampilan Pemantauan Laboratorium (Read-Only) — Dikendalikan oleh Admin'}
                </div>
              </div>
            </div>

            {/* Mobile Tag */}
            <div className="lg:hidden text-[11px] font-mono font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {role === 'admin' ? 'Admin' : 'PC Lab'}
            </div>
          </div>

          {/* Right Navigation & Controls */}
          <div className="flex items-center gap-3 self-center lg:self-auto w-full lg:w-auto justify-between lg:justify-end overflow-x-auto pb-1 lg:pb-0">
            {role === 'admin' ? (
              /* Role Admin: Tampilkan 4 Tab Navigasi Lengkap */
              <nav className="inline-flex items-center gap-1 p-1 bg-slate-100/90 rounded-full border border-slate-200 shadow-inner max-w-full">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => onTabChange(tab.key)}
                      className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-teal-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <HeroIcon
                        name={tab.icon}
                        className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}
                      />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            tab.badge === 'Live'
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            ) : (
              /* Role PC Lab: Tampilkan Kiosk Status Chip (Read-Only) */
              <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs text-slate-700">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span className="font-semibold text-slate-800">Layar Ruang Lab Aktif</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-medium">Navigasi Terkunci (Mode Kiosk)</span>
              </div>
            )}

            {/* Switch Role Action Button */}
            {role === 'admin' ? (
              <button
                onClick={() => onSwitchRole('lab')}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                title="Buka tampilan layar PC Lab"
              >
                <HeroIcon name="computer-desktop" className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Layar PC Lab</span>
              </button>
            ) : (
              <button
                onClick={() => onSwitchRole('admin')}
                className="inline-flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                title="Buka panel Admin Remote Control"
              >
                <HeroIcon name="lock-closed" className="w-3.5 h-3.5 text-teal-600" />
                <span>Buka Admin (/admin)</span>
              </button>
            )}

            {/* PC Lab Link Status Chip in Admin Mode */}
            {role === 'admin' && (
              <div className={`hidden xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                labConnected && labMicReady
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : (labConnected
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200')
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  labConnected && labMicReady ? 'bg-teal-500 animate-pulse' : (labConnected ? 'bg-amber-500' : 'bg-rose-500')
                }`} />
                <span>
                  {labConnected && labMicReady
                    ? 'PC Lab Terhubung'
                    : (labConnected ? 'PC Lab Siap (Menunggu Sensor)' : 'PC Lab Terputus')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
