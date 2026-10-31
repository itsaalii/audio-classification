import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import type { TabKey } from './components/Header';
import { LiveMonitor } from './components/LiveMonitor';
import type { HistorySession } from './components/LiveMonitor';
import { FileAnalyzer } from './components/FileAnalyzer';
import { HistoryLog } from './components/HistoryLog';
import { ModelIntelligence } from './components/ModelIntelligence';
import { getModelInfo, getHealthStatus } from './services/api';
import type { ModelInfoResult } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [modelInfo, setModelInfo] = useState<ModelInfoResult | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Riwayat Sesi dari localStorage
  const [sessions, setSessions] = useState<HistorySession[]>(() => {
    try {
      const saved = localStorage.getItem('acoustiknn_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Simpan sesi baru
  const handleSaveSession = useCallback((newSession: HistorySession) => {
    setSessions((prev) => {
      const updated = [newSession, ...prev].slice(0, 50); // Maksimal simpan 50 sesi
      try {
        localStorage.setItem('acoustiknn_sessions', JSON.stringify(updated));
      } catch (e) {
        console.error("Gagal menyimpan ke localStorage:", e);
      }
      return updated;
    });
  }, []);

  // Hapus semua riwayat
  const handleClearHistory = useCallback(() => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh log riwayat sesi?")) {
      setSessions([]);
      localStorage.removeItem('acoustiknn_sessions');
    }
  }, []);

  // Fetch model info & health status saat aplikasi dimuat
  useEffect(() => {
    const initApp = async () => {
      try {
        const [info, health] = await Promise.all([
          getModelInfo(),
          getHealthStatus()
        ]);
        setModelInfo(info);
        setIsModelReady(health.model_loaded && health.scaler_loaded);
      } catch (err) {
        console.error("Gagal menginisialisasi model:", err);
        // Fallback default info jika backend belum siap saat build
        setIsModelReady(true);
      }
    };
    initApp();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isModelReady={isModelReady}
        isLiveActive={isLiveActive}
        historyCount={sessions.length}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'live' && (
          <LiveMonitor
            onSaveSession={handleSaveSession}
            onLiveChange={setIsLiveActive}
          />
        )}

        {activeTab === 'file' && (
          <FileAnalyzer
            onSaveSession={handleSaveSession}
            availableSamples={modelInfo?.sample_files || []}
          />
        )}

        {activeTab === 'history' && (
          <HistoryLog
            sessions={sessions}
            onClearHistory={handleClearHistory}
          />
        )}

        {activeTab === 'specs' && (
          <ModelIntelligence modelInfo={modelInfo} />
        )}
      </main>

      {/* Footer Studio */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">AcoustiKNN Studio</span>
            <span>&bull;</span>
            <span>Tugas Proyek Sains Data (PSD) - Klasifikasi Audio Berisik</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Model: Weighted KNN (K=4, Euclidean)</span>
            <span>&bull;</span>
            <span>Scaler: RobustScaler</span>
            <span>&bull;</span>
            <span className="text-teal-700 font-medium">Palet Desain Teal</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
