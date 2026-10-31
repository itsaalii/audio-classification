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
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isModelReady: boolean;
  isLiveActive: boolean;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isModelReady,
  isLiveActive,
  historyCount,
}) => {
  const tabs: TabItem[] = [
    { key: 'live', label: 'Deteksi Real-Time', icon: 'microphone', badge: isLiveActive ? 'Live' : undefined },
    { key: 'file', label: 'Analisis Berkas', icon: 'document-text' },
    { key: 'history', label: 'Riwayat Sesi', icon: 'clock', badge: historyCount > 0 ? `${historyCount}` : undefined },
    { key: 'specs', label: 'Tentang Model & PSD', icon: 'cpu' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3.5 gap-3.5">
          {/* Brand Row & Status Badge */}
          <div className="flex items-center justify-between lg:justify-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-600/20">
                <HeroIcon name="waveform" className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-800 font-display">
                    AcoustiKNN Studio
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isModelReady
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isModelReady ? 'bg-teal-500 animate-pulse-subtle' : 'bg-rose-500'}`} />
                    <span>{isModelReady ? 'Model WKNN 4s Siap' : 'Memuat Model'}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500 hidden sm:block">
                  Sistem Deteksi & Klasifikasi Kebisingan Audio Real-Time
                </div>
              </div>
            </div>

            {/* Micro Engine Info Tag on Mobile */}
            <div className="lg:hidden text-[11px] font-mono font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              22.050 Hz
            </div>
          </div>

          {/* Floating Pill Navigation Tabs (Reference Layout okan-test) */}
          <div className="flex items-center gap-3 self-center lg:self-auto w-full lg:w-auto justify-between lg:justify-end overflow-x-auto pb-1 lg:pb-0">
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

            {/* Desktop Engine Status Chip */}
            <div className="hidden xl:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="font-mono font-semibold text-slate-800">22.050 Hz</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-slate-600">4.0s Window</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
