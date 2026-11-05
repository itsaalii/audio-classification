import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import type { TabKey } from './components/Header';
import { LiveMonitor } from './components/LiveMonitor';
import type { HistorySession } from './components/LiveMonitor';
import { FileAnalyzer } from './components/FileAnalyzer';
import { HistoryLog } from './components/HistoryLog';
import { ModelIntelligence } from './components/ModelIntelligence';
import { AdminGateModal } from './components/AdminGateModal';
import { getModelInfo, getHealthStatus } from './services/api';
import type { ModelInfoResult } from './services/api';
import { remoteSocket } from './services/remoteSocket';
import type { RoomState } from './services/remoteSocket';

export const App: React.FC = () => {
  // Role Detection: 'lab' (PC Lab Display) atau 'admin' (Remote Control Center)
  const getInitialRole = (): 'lab' | 'admin' => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin' || window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'lab';
  };

  const [role, setRole] = useState<'lab' | 'admin'>(getInitialRole);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('acoustiknn_admin_authenticated') === 'true';
  });
  const [isAdminGateOpen, setIsAdminGateOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [modelInfo, setModelInfo] = useState<ModelInfoResult | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Status Sinkronisasi Ruangan untuk Header
  const [roomState, setRoomState] = useState<RoomState>({
    is_monitoring: false,
    tolerance_seconds: 10,
    alarm_enabled: true,
    lab_client_connected: false,
    lab_mic_ready: false,
    admin_count: 0,
    lab_count: 0,
    latest_telemetry: null,
  });

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
      const updated = [newSession, ...prev].slice(0, 50);
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

  // Deteksi rute URL awal & popup PIN Admin jika belum terotentikasi
  useEffect(() => {
    if (role === 'admin' && !isAdminAuthenticated) {
      setIsAdminGateOpen(true);
    }
  }, [role, isAdminAuthenticated]);

  // Handle pergantian role antara PC Lab dan Admin
  const handleSwitchRole = (targetRole: 'lab' | 'admin') => {
    if (targetRole === 'admin') {
      if (isAdminAuthenticated) {
        setRole('admin');
        window.history.pushState(null, '', '/admin');
      } else {
        setIsAdminGateOpen(true);
      }
    } else {
      setRole('lab');
      setActiveTab('live');
      window.history.pushState(null, '', '/');
    }
  };

  const handleAdminGateSuccess = () => {
    sessionStorage.setItem('acoustiknn_admin_authenticated', 'true');
    setIsAdminAuthenticated(true);
    setIsAdminGateOpen(false);
    setRole('admin');
    window.history.pushState(null, '', '/admin');
  };

  const handleAdminGateCancel = () => {
    setIsAdminGateOpen(false);
    if (!isAdminAuthenticated) {
      setRole('lab');
      setActiveTab('live');
      window.history.pushState(null, '', '/');
    }
  };

  // Dengarkan event popstate (navigasi tombol back/forward browser)
  useEffect(() => {
    const handlePopState = () => {
      const currentRole = getInitialRole();
      setRole(currentRole);
      if (currentRole === 'admin' && !sessionStorage.getItem('acoustiknn_admin_authenticated')) {
        setIsAdminGateOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Subscribe ke state ruangan untuk badge header
  useEffect(() => {
    const unsub = remoteSocket.onStateSync((state) => {
      setRoomState(state);
    });
    return () => unsub();
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
        setIsModelReady(true);
      }
    };
    initApp();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Application Header */}
      <Header
        role={role}
        onSwitchRole={handleSwitchRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isModelReady={isModelReady}
        isLiveActive={isLiveActive}
        historyCount={sessions.length}
        labConnected={roomState.lab_client_connected}
        labMicReady={roomState.lab_mic_ready}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {(activeTab === 'live' || role === 'lab') && (
          <LiveMonitor
            role={role}
            onSaveSession={handleSaveSession}
            onLiveChange={setIsLiveActive}
          />
        )}

        {role === 'admin' && activeTab === 'file' && (
          <FileAnalyzer
            onSaveSession={handleSaveSession}
            availableSamples={modelInfo?.sample_files || []}
          />
        )}

        {role === 'admin' && activeTab === 'history' && (
          <HistoryLog
            sessions={sessions}
            onClearHistory={handleClearHistory}
          />
        )}

        {role === 'admin' && activeTab === 'specs' && (
          <ModelIntelligence modelInfo={modelInfo} />
        )}
      </main>

      {/* Modal Masuk PIN Admin */}
      <AdminGateModal
        isOpen={isAdminGateOpen}
        onSuccess={handleAdminGateSuccess}
        onCancel={handleAdminGateCancel}
      />

      {/* Footer Studio */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700">AcoustiKNN Studio</span>
            <span>&bull;</span>
            <span>
              {role === 'admin'
                ? 'Role: Remote Control Center (/admin)'
                : 'Role: PC Lab Display Kiosk (/)'}
            </span>
            <span>&bull;</span>
            <span>Tugas Proyek Sains Data (PSD) - Klasifikasi Audio Berisik</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Model: Weighted KNN (K=4, Euclidean)</span>
            <span>&bull;</span>
            <span>WebSocket Sinkronisasi Real-Time</span>
            <span>&bull;</span>
            <span className="text-teal-700 font-medium">Palet Desain Teal</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
