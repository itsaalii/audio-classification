import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HeroIcon } from './HeroIcon';
import { Latex } from './Latex';
import { encodeWAV } from '../utils/wavEncoder';
import { alertPlayer } from '../utils/audioAlert';
import { predictLiveAudio } from '../services/api';
import type { PredictionResult } from '../services/api';
import { remoteSocket } from '../services/remoteSocket';
import type { RoomState, TelemetryPayload, RemoteCommand } from '../services/remoteSocket';

export interface HistorySession {
  id: string;
  type: 'live' | 'file';
  timestamp: number;
  duration_s: number;
  total_segments: number;
  noisy_segments: number;
  clean_segments: number;
  noisy_percentage: number;
  dominant_label: 'berisik' | 'non-berisik';
  avg_confidence: number;
  filename?: string;
}

export interface LiveMonitorProps {
  role?: 'lab' | 'admin';
  onSaveSession: (session: HistorySession) => void;
  onLiveChange?: (active: boolean) => void;
}

const TARGET_SR = 22050;
const DURATION_S = 4.0;
const BUFFER_SIZE = TARGET_SR * DURATION_S; // 88,200 sampel
const NUM_TICKS = 28;

export interface ConsistencyOption {
  val: number;
  label: string;
}

export type CycleOption = ConsistencyOption;

export const CONSISTENCY_OPTIONS: ConsistencyOption[] = [
  { val: 1, label: 'Real-Time (Langsung)' },
  { val: 4, label: '4 Detik' },
  { val: 5, label: '5 Detik' },
  { val: 10, label: '10 Detik' },
  { val: 15, label: '15 Detik' },
  { val: 20, label: '20 Detik' },
  { val: 30, label: '30 Detik' },
];

export const CYCLE_OPTIONS = CONSISTENCY_OPTIONS;

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  role = 'lab',
  onSaveSession,
  onLiveChange,
}) => {
  // =========================================================================
  // STATE SINKRONISASI RUANGAN (WebSocket & REST Room State)
  // =========================================================================
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

  // State Kesiapan Sensor Audio PC Lab (One-Click Gesture)
  const [isKioskActivated, setIsKioskActivated] = useState<boolean>(false);
  const [kioskInitError, setKioskInitError] = useState<string | null>(null);

  // State Monitoring Lokal
  const [isActive, setIsActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [baselineRms, setBaselineRms] = useState<number>(() => {
    const saved = localStorage.getItem('acoustiknn_baseline_rms');
    return saved ? parseFloat(saved) : 0.015;
  });

  // State Toleransi Kebisingan Konsisten (Rolling Window)
  const [consistencyDuration, setConsistencyDuration] = useState<number>(10);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State Evaluasi Jendela Geser (Rolling Window State)
  const [windowNoisySeconds, setWindowNoisySeconds] = useState<number>(0);
  const [windowTotalSeconds, setWindowTotalSeconds] = useState<number>(0);
  const [totalAlertsCount, setTotalAlertsCount] = useState<number>(0);
  const [alarmCooldownSeconds, setAlarmCooldownSeconds] = useState<number>(0);
  const [lastAlertEvent, setLastAlertEvent] = useState<{
    alertNum: number;
    duration: number;
    noisyCount: number;
    windowLen: number;
    timestamp: number;
  } | null>(null);

  // State Audio Alarm / Beep Panjang
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [beepDuration, setBeepDuration] = useState<number>(3); // Default 3 detik
  const [alarmVolume, setAlarmVolume] = useState<number>(0.6);

  // State Diagnostik Collapsible
  const [isDiagOpen, setIsDiagOpen] = useState(true);

  // State Prediksi Terakhir
  const [currentResult, setCurrentResult] = useState<PredictionResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [noisyChunks, setNoisyChunks] = useState(0);
  const [cleanChunks, setCleanChunks] = useState(0);

  // Refs untuk tracking stabil
  const sessionSecondsRef = useRef(0);
  const totalChunksRef = useRef(0);
  const noisyChunksRef = useRef(0);
  const cleanChunksRef = useRef(0);

  const isKioskActivatedRef = useRef(isKioskActivated);
  isKioskActivatedRef.current = isKioskActivated;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const roomStateRef = useRef(roomState);
  roomStateRef.current = roomState;

  const consistencyDurationRef = useRef(consistencyDuration);
  consistencyDurationRef.current = consistencyDuration;

  const rollingHistoryRef = useRef<boolean[]>([]);
  const alarmCooldownUntilRef = useRef<number>(0);
  const totalAlertsCountRef = useRef<number>(0);

  const baselineRmsRef = useRef(baselineRms);
  baselineRmsRef.current = baselineRms;

  const alarmEnabledRef = useRef(alarmEnabled);
  alarmEnabledRef.current = alarmEnabled;

  const beepDurationRef = useRef(beepDuration);
  beepDurationRef.current = beepDuration;

  const alarmVolumeRef = useRef(alarmVolume);
  alarmVolumeRef.current = alarmVolume;

  const onSaveSessionRef = useRef(onSaveSession);
  onSaveSessionRef.current = onSaveSession;

  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;

  const currentResultRef = useRef<PredictionResult | null>(null);
  currentResultRef.current = currentResult;

  // Refs Web Audio & Loop (Khusus PC Lab)
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);

  const circularBufferRef = useRef<Float32Array>(new Float32Array(BUFFER_SIZE));
  const bufferWriteIdxRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);

  // Refs Canvas Visualisasi (Latar Belakang Putih Murni #FFFFFF)
  const miniScopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Buffer Riwayat 30 Detik
  const timelineDataRef = useRef<Array<{ time: number; noiseProb: number; label: string }>>([]);

  const timerIntervalRef = useRef<number | null>(null);
  const predictIntervalRef = useRef<number | null>(null);

  // Ref Telemetri Admin untuk 60fps render
  const adminTelemetryRef = useRef<TelemetryPayload | null>(null);

  // Tutup dropdown saat klik di luar
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // =========================================================================
  // LOGIKA PENGHENTIAN & PEMBERHENTIAN DETEKSI LOKAL (PC LAB)
  // =========================================================================
  const stopMonitoringInternal = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    onLiveChangeRef.current?.(false);
    alertPlayer.stop();

    if (predictIntervalRef.current) {
      clearInterval(predictIntervalRef.current);
      predictIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Bersihkan buffer rolling
    rollingHistoryRef.current = [];
    setWindowNoisySeconds(0);
    setWindowTotalSeconds(0);
    setAlarmCooldownSeconds(0);

    const secs = sessionSecondsRef.current;
    const tot = totalChunksRef.current;
    const noisy = noisyChunksRef.current;
    const clean = cleanChunksRef.current;

    // Simpan sesi jika sudah berjalan minimal 4 detik
    if (secs >= 4 && tot > 0) {
      const noisyRatio = (noisy / tot) * 100;
      const session: HistorySession = {
        id: `live_${Date.now()}`,
        type: 'live',
        timestamp: Date.now(),
        duration_s: secs,
        total_segments: tot,
        noisy_segments: noisy,
        clean_segments: clean,
        noisy_percentage: Math.round(noisyRatio * 10) / 10,
        dominant_label: noisyRatio >= 50 ? 'berisik' : 'non-berisik',
        avg_confidence: 96.5,
        filename: `Sesi Real-Time (${secs}s)`,
      };
      onSaveSessionRef.current(session);
    }

    // Kirim telemetri status standby ke Admin via WebSocket/REST
    if (role === 'lab') {
      remoteSocket.sendTelemetry({
        timestamp: Date.now(),
        is_monitoring: false,
        status: 'standby',
        label: 'standby',
        confidence: 0,
        probabilities: { non_berisik: 1, berisik: 0 },
        rms: 0,
        centroid_hz: 0,
        zcr: 0,
        mfccs: Array(13).fill(0),
        db_level: 0,
        led_index: 0,
        window_noisy_seconds: 0,
        window_total_seconds: 0,
        min_required_noisy: 0,
        progress_pct: 0,
        alarm_cooldown_seconds: 0,
        alarm_triggered: false,
        session_seconds: secs,
        total_chunks: tot,
        noisy_chunks: noisy,
        clean_chunks: clean,
        total_alerts_count: totalAlertsCountRef.current,
        latency_ms: 0,
        recent_timeline: timelineDataRef.current.slice(-30),
        audio_preview: Array(128).fill(0),
      });
    }
  }, [role]);

  // =========================================================================
  // MULAI LOOP DETEKSI LOKAL (PC LAB) SAAT DIPERINTAHKAN ADMIN
  // =========================================================================
  const startMonitoringInternal = useCallback(() => {
    setLastError(null);
    setCurrentResult(null);

    sessionSecondsRef.current = 0;
    totalChunksRef.current = 0;
    noisyChunksRef.current = 0;
    cleanChunksRef.current = 0;

    rollingHistoryRef.current = [];
    alarmCooldownUntilRef.current = 0;
    totalAlertsCountRef.current = 0;

    setSessionSeconds(0);
    setTotalChunks(0);
    setNoisyChunks(0);
    setCleanChunks(0);

    setWindowNoisySeconds(0);
    setWindowTotalSeconds(0);
    setTotalAlertsCount(0);
    setAlarmCooldownSeconds(0);
    setLastAlertEvent(null);

    timelineDataRef.current = [];
    circularBufferRef.current.fill(0);
    bufferWriteIdxRef.current = 0;

    setIsActive(true);
    isActiveRef.current = true;
    onLiveChangeRef.current?.(true);

    // Timer durasi sesi berjalan & cooldown alarm
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(sessionSecondsRef.current);

      const now = Date.now();
      if (now < alarmCooldownUntilRef.current) {
        const cd = Math.max(0, Math.ceil((alarmCooldownUntilRef.current - now) / 1000));
        setAlarmCooldownSeconds(cd);
      } else {
        setAlarmCooldownSeconds(0);
      }
    }, 1000);

    // Loop Prediksi Real-Time setiap 1000 ms
    if (predictIntervalRef.current) clearInterval(predictIntervalRef.current);
    predictIntervalRef.current = window.setInterval(async () => {
      if (isPredictingRef.current) return;
      isPredictingRef.current = true;

      try {
        const linearBuffer = new Float32Array(BUFFER_SIZE);
        const circ = circularBufferRef.current;
        const writeIdx = bufferWriteIdxRef.current;

        for (let i = 0; i < BUFFER_SIZE; i++) {
          linearBuffer[i] = circ[(writeIdx + i) % BUFFER_SIZE];
        }

        // Siapkan cuplikan audio untuk visualisasi Admin (128 titik time-domain)
        const previewPoints: number[] = [];
        const previewCount = 128;
        const offsetStart = BUFFER_SIZE - TARGET_SR;
        const step = Math.floor(TARGET_SR / previewCount);
        for (let i = 0; i < previewCount; i++) {
          const sample = circ[(writeIdx + offsetStart + i * step) % BUFFER_SIZE] || 0;
          previewPoints.push(Math.round(sample * 1000) / 1000);
        }

        // Encode ke 16-bit PCM WAV mono 22.050 Hz
        const wavBlob = encodeWAV(linearBuffer, TARGET_SR);

        // Panggil endpoint /predict-live
        const result = await predictLiveAudio(wavBlob, baselineRmsRef.current);
        setCurrentResult(result);

        // Agregat Sesi
        totalChunksRef.current += 1;
        setTotalChunks(totalChunksRef.current);

        const isNoisySample = result.prediction === 1;

        if (isNoisySample) {
          noisyChunksRef.current += 1;
          setNoisyChunks(noisyChunksRef.current);
        } else {
          cleanChunksRef.current += 1;
          setCleanChunks(cleanChunksRef.current);
        }

        // Linimasa 30 detik
        const prob = result.probabilities.berisik * 100;
        timelineDataRef.current.push({
          time: Date.now(),
          noiseProb: prob,
          label: result.label,
        });
        if (timelineDataRef.current.length > 30) {
          timelineDataRef.current.shift();
        }

        // =========================================================================
        // EVALUASI KEBISINGAN KONSISTEN (ROLLING WINDOW)
        // =========================================================================
        const targetDuration = consistencyDurationRef.current;
        const now = Date.now();

        let isConsistent = false;
        let currentWindowLen = 0;
        let currentNoisyCount = 0;

        // Cek cooldown alarm
        if (now >= alarmCooldownUntilRef.current) {
          rollingHistoryRef.current.push(isNoisySample);
          if (rollingHistoryRef.current.length > targetDuration) {
            rollingHistoryRef.current.shift();
          }

          currentWindowLen = rollingHistoryRef.current.length;
          currentNoisyCount = rollingHistoryRef.current.filter(Boolean).length;
          setWindowNoisySeconds(currentNoisyCount);
          setWindowTotalSeconds(currentWindowLen);

          const minReq =
            targetDuration === 1
              ? 1
              : targetDuration === 4
              ? 3
              : Math.ceil(targetDuration * 0.8);

          isConsistent = currentWindowLen >= targetDuration && currentNoisyCount >= minReq;

          if (isConsistent) {
            const currentBeepDur = beepDurationRef.current;

            if (alarmEnabledRef.current) {
              alertPlayer.playLongBeep(currentBeepDur, alarmVolumeRef.current);
            }

            alarmCooldownUntilRef.current = now + currentBeepDur * 1000;
            setAlarmCooldownSeconds(currentBeepDur);

            totalAlertsCountRef.current += 1;
            const alertNum = totalAlertsCountRef.current;
            setTotalAlertsCount(alertNum);

            setLastAlertEvent({
              alertNum,
              duration: targetDuration,
              noisyCount: currentNoisyCount,
              windowLen: currentWindowLen,
              timestamp: now,
            });

            // Simpan log event
            const session: HistorySession = {
              id: `consistent_${Date.now()}`,
              type: 'live',
              timestamp: now,
              duration_s: targetDuration,
              total_segments: currentWindowLen,
              noisy_segments: currentNoisyCount,
              clean_segments: currentWindowLen - currentNoisyCount,
              noisy_percentage: Math.round((currentNoisyCount / currentWindowLen) * 1000) / 10,
              dominant_label: 'berisik',
              avg_confidence: result.confidence,
              filename:
                targetDuration === 1
                  ? `Peringatan Bising Real-Time #${alertNum}`
                  : `Kebisingan Konsisten ${targetDuration}s #${alertNum} (${currentNoisyCount}/${currentWindowLen}s)`,
            };
            onSaveSessionRef.current(session);

            rollingHistoryRef.current = [];
            setWindowNoisySeconds(0);
            setWindowTotalSeconds(0);
          }
        }

        const minRequiredNoisy =
          targetDuration === 1
            ? 1
            : targetDuration === 4
            ? 3
            : Math.ceil(targetDuration * 0.8);

        const progressPct =
          minRequiredNoisy > 0
            ? Math.min(100, Math.round((currentNoisyCount / minRequiredNoisy) * 100))
            : 0;

        // Broadcast telemetri ke server agar Admin tersinkronisasi instan
        const telemetryPayload: TelemetryPayload = {
          timestamp: now,
          is_monitoring: true,
          status: isConsistent ? 'berisik' : isNoisySample ? 'berisik' : 'kondusif',
          label: result.label,
          confidence: result.confidence,
          probabilities: result.probabilities,
          rms: result.rms,
          centroid_hz: result.centroid_hz,
          zcr: result.zcr,
          mfccs: result.mfccs,
          db_level: Math.round(20 * Math.log10(Math.max(result.rms, 0.0001)) + 100),
          led_index: Math.round(result.probabilities.berisik * NUM_TICKS),
          window_noisy_seconds: currentNoisyCount,
          window_total_seconds: currentWindowLen,
          min_required_noisy: minRequiredNoisy,
          progress_pct: progressPct,
          alarm_cooldown_seconds: Math.max(
            0,
            Math.ceil((alarmCooldownUntilRef.current - now) / 1000)
          ),
          alarm_triggered: isConsistent,
          session_seconds: sessionSecondsRef.current,
          total_chunks: totalChunksRef.current,
          noisy_chunks: noisyChunksRef.current,
          clean_chunks: cleanChunksRef.current,
          total_alerts_count: totalAlertsCountRef.current,
          latency_ms: result.latency_ms,
          recent_timeline: timelineDataRef.current.slice(-30),
          audio_preview: previewPoints,
        };

        remoteSocket.sendTelemetry(telemetryPayload);
      } catch (err) {
        console.error('Gagal prediksi live di PC Lab:', err);
      } finally {
        isPredictingRef.current = false;
      }
    }, 1000);
  }, []);

  // =========================================================================
  // LOGIKA INISIALISASI MIKROFON PC LAB (ONE-CLICK KIOSK GESTURE)
  // =========================================================================
  const activateKioskMicrophone = useCallback(async () => {
    setKioskInitError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'navigator.mediaDevices.getUserMedia tidak tersedia. Pastikan membuka aplikasi melalui HTTPS atau localhost.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // AnalyserNode untuk visualisasi 60 FPS
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      sourceNode.connect(analyser);

      // ScriptProcessorNode untuk resample ke 22.050 Hz ke circular buffer
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;

      const nativeSr = audioCtx.sampleRate;
      const resampleRatio = nativeSr / TARGET_SR;

      scriptNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const outputLength = Math.floor(inputData.length / resampleRatio);

        const circ = circularBufferRef.current;
        let writeIdx = bufferWriteIdxRef.current;

        for (let i = 0; i < outputLength; i++) {
          const srcIdx = Math.floor(i * resampleRatio);
          circ[writeIdx] = inputData[srcIdx] || 0;
          writeIdx = (writeIdx + 1) % BUFFER_SIZE;
        }
        bufferWriteIdxRef.current = writeIdx;
      };

      // Mute gain ke destination
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      sourceNode.connect(scriptNode);
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      setIsKioskActivated(true);
      isKioskActivatedRef.current = true;
      remoteSocket.sendMicStatus(true);

      // Jika Admin sudah mengaktifkan monitoring sebelumnya, langsung mulai deteksi!
      if (roomStateRef.current.is_monitoring && !isActiveRef.current) {
        startMonitoringInternal();
      }
    } catch (err) {
      console.error('Gagal aktivasi sensor PC Lab:', err);
      setKioskInitError(`Gagal mengakses mikrofon: ${String(err)}`);
      remoteSocket.sendMicStatus(false);
    }
  }, [startMonitoringInternal]);

  // =========================================================================
  // KONEKSI WEBSOCKET & PENANGANAN COMMAND DARI ADMIN
  // =========================================================================
  useEffect(() => {
    remoteSocket.connect(role);

    // Ambil initial state via REST
    remoteSocket.fetchState().then((st) => {
      setRoomState(st);
      if (st.tolerance_seconds) {
        setConsistencyDuration(st.tolerance_seconds);
      }
      setAlarmEnabled(st.alarm_enabled);
      if (role === 'admin') {
        setIsActive(st.is_monitoring);
      } else if (role === 'lab') {
        if (st.is_monitoring && isKioskActivatedRef.current && !isActiveRef.current) {
          startMonitoringInternal();
        }
      }
    }).catch(() => {});

    // Subscribe ke sinkronisasi state ruangan
    const unsubState = remoteSocket.onStateSync((st) => {
      setRoomState(st);
      if (st.tolerance_seconds) {
        setConsistencyDuration(st.tolerance_seconds);
      }
      setAlarmEnabled(st.alarm_enabled);

      if (role === 'admin') {
        setIsActive(st.is_monitoring);
        if (st.latest_telemetry) {
          adminTelemetryRef.current = st.latest_telemetry;
          setCurrentResult({
            label: st.latest_telemetry.label as 'berisik' | 'non-berisik',
            prediction: st.latest_telemetry.label === 'berisik' ? 1 : 0,
            confidence: st.latest_telemetry.confidence,
            probabilities: st.latest_telemetry.probabilities,
            rms: st.latest_telemetry.rms,
            centroid_hz: st.latest_telemetry.centroid_hz,
            zcr: st.latest_telemetry.zcr,
            mfccs: st.latest_telemetry.mfccs,
            is_ambient: false,
            status_text: '',
            latency_ms: st.latest_telemetry.latency_ms,
            timestamp: st.latest_telemetry.timestamp,
          });
          setWindowNoisySeconds(st.latest_telemetry.window_noisy_seconds);
          setWindowTotalSeconds(st.latest_telemetry.window_total_seconds);
          setAlarmCooldownSeconds(st.latest_telemetry.alarm_cooldown_seconds);
          setTotalAlertsCount(st.latest_telemetry.total_alerts_count);
          setSessionSeconds(st.latest_telemetry.session_seconds);
          setTotalChunks(st.latest_telemetry.total_chunks);
          setNoisyChunks(st.latest_telemetry.noisy_chunks);
          setCleanChunks(st.latest_telemetry.clean_chunks);
          if (st.latest_telemetry.recent_timeline) {
            timelineDataRef.current = st.latest_telemetry.recent_timeline;
          }
        }
      } else if (role === 'lab') {
        // Otomatis sinkronkan monitoring jika Admin menyalakan/mematikan
        if (st.is_monitoring && isKioskActivatedRef.current && !isActiveRef.current) {
          startMonitoringInternal();
        } else if (!st.is_monitoring && isActiveRef.current) {
          stopMonitoringInternal();
        }
      }
    });

    // Subscribe ke update telemetri real-time (untuk Admin)
    const unsubTelemetry = remoteSocket.onTelemetryUpdate((tel) => {
      if (role === 'admin') {
        adminTelemetryRef.current = tel;
        setIsActive(tel.is_monitoring);
        setCurrentResult({
          label: tel.label as 'berisik' | 'non-berisik',
          prediction: tel.label === 'berisik' ? 1 : 0,
          confidence: tel.confidence,
          probabilities: tel.probabilities,
          rms: tel.rms,
          centroid_hz: tel.centroid_hz,
          zcr: tel.zcr,
          mfccs: tel.mfccs,
          is_ambient: false,
          status_text: '',
          latency_ms: tel.latency_ms,
          timestamp: tel.timestamp,
        });
        setWindowNoisySeconds(tel.window_noisy_seconds);
        setWindowTotalSeconds(tel.window_total_seconds);
        setAlarmCooldownSeconds(tel.alarm_cooldown_seconds);
        setTotalAlertsCount(tel.total_alerts_count);
        setSessionSeconds(tel.session_seconds);
        setTotalChunks(tel.total_chunks);
        setNoisyChunks(tel.noisy_chunks);
        setCleanChunks(tel.clean_chunks);
        if (tel.recent_timeline) {
          timelineDataRef.current = tel.recent_timeline;
        }

        if (tel.alarm_triggered) {
          setLastAlertEvent({
            alertNum: tel.total_alerts_count,
            duration: consistencyDurationRef.current,
            noisyCount: tel.window_noisy_seconds,
            windowLen: tel.window_total_seconds,
            timestamp: tel.timestamp,
          });
        }
      }
    });

    // Subscribe ke perintah remote (untuk PC Lab)
    const unsubCommand = remoteSocket.onCommand((cmd: RemoteCommand) => {
      if (role === 'lab') {
        if (cmd.action === 'START_MONITORING') {
          if (isKioskActivatedRef.current) {
            startMonitoringInternal();
          }
        } else if (cmd.action === 'STOP_MONITORING') {
          stopMonitoringInternal();
        } else if (cmd.action === 'UPDATE_CONFIG') {
          if (cmd.params?.tolerance_seconds) {
            setConsistencyDuration(cmd.params.tolerance_seconds);
          }
          if (cmd.params?.alarm_enabled !== undefined) {
            setAlarmEnabled(cmd.params.alarm_enabled);
          }
        } else if (cmd.action === 'RESET_BUFFER') {
          rollingHistoryRef.current = [];
          setWindowNoisySeconds(0);
          setWindowTotalSeconds(0);
        } else if (cmd.action === 'TRIGGER_TEST_ALARM') {
          alertPlayer.playLongBeep(3.0, alarmVolumeRef.current);
          setAlarmCooldownSeconds(3);
        }
      }
    });

    return () => {
      unsubState();
      unsubTelemetry();
      unsubCommand();
    };
  }, [role, startMonitoringInternal, stopMonitoringInternal]);

  // =========================================================================
  // ACTIONS YANG DIPICU DARI ADMIN
  // =========================================================================
  const handleAdminStartMonitoring = () => {
    setIsActive(true);
    remoteSocket.sendCommand('START_MONITORING');
  };

  const handleAdminStopMonitoring = () => {
    setIsActive(false);
    remoteSocket.sendCommand('STOP_MONITORING');
  };

  const handleAdminSetTolerance = (dur: number) => {
    setConsistencyDuration(dur);
    setIsDropdownOpen(false);
    remoteSocket.sendCommand('UPDATE_CONFIG', { tolerance_seconds: dur });
  };

  const handleAdminToggleAlarm = () => {
    const next = !alarmEnabled;
    setAlarmEnabled(next);
    remoteSocket.sendCommand('UPDATE_CONFIG', { alarm_enabled: next });
  };

  const handleAdminResetBuffer = () => {
    remoteSocket.sendCommand('RESET_BUFFER');
    setWindowNoisySeconds(0);
    setWindowTotalSeconds(0);
  };

  const handleAdminTestAlarm = () => {
    remoteSocket.sendCommand('TRIGGER_TEST_ALARM');
  };

  // Kalibrasi baseline RMS ruangan (3 detik)
  const handleCalibrate = useCallback(async () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    setLastError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      let sumRms = 0;
      let count = 0;

      const interval = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSq += buffer[i] * buffer[i];
        }
        sumRms += Math.sqrt(sumSq / buffer.length);
        count++;
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});

        const calculated = count > 0 ? sumRms / count : 0.015;
        const clamped = Math.max(0.005, Math.min(0.05, calculated));
        setBaselineRms(clamped);
        localStorage.setItem('acoustiknn_baseline_rms', clamped.toString());
        setIsCalibrating(false);
      }, 3000);
    } catch (err) {
      setLastError(`Gagal mengakses mikrofon untuk kalibrasi: ${String(err)}`);
      setIsCalibrating(false);
    }
  }, [isCalibrating]);

  // =========================================================================
  // ANIMASI CANVAS 60 FPS (LATAR BELAKANG PUTIH MURNI #FFFFFF)
  // Berjalan di PC Lab via AnalyserNode dan di Admin via Telemetry Stream
  // =========================================================================
  useEffect(() => {
    let animId: number;

    const render = () => {
      const isNoisy = currentResultRef.current?.prediction === 1;

      // 1. Gambar Mini Scope di Instrument Card (Latar Putih #FFFFFF)
      const miniScope = miniScopeCanvasRef.current;
      if (miniScope) {
        const ctx = miniScope.getContext('2d');
        if (ctx) {
          const w = miniScope.width;
          const h = miniScope.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          // Garis tengah halus
          ctx.strokeStyle = '#F1F5F9';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          ctx.strokeStyle = isNoisy ? '#E11D48' : '#0D9488';
          ctx.lineWidth = 2.0;
          ctx.beginPath();

          if (role === 'lab' && analyserRef.current && isActive) {
            const timeDomain = new Float32Array(analyserRef.current.fftSize);
            analyserRef.current.getFloatTimeDomainData(timeDomain);
            const sliceWidth = w / timeDomain.length;
            let x = 0;
            for (let i = 0; i < timeDomain.length; i++) {
              const v = timeDomain[i];
              const y = (v * h) / 2 + h / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
          } else if (role === 'admin' && isActive && adminTelemetryRef.current?.audio_preview) {
            const pts = adminTelemetryRef.current.audio_preview;
            const sliceWidth = w / pts.length;
            let x = 0;
            for (let i = 0; i < pts.length; i++) {
              const v = pts[i] || 0;
              const y = (v * h * 1.5) / 2 + h / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
          } else {
            // Garis datar standby
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
          }
          ctx.stroke();
        }
      }

      // 2. Gambar Osiloskop Gelombang Utama (Latar Putih #FFFFFF)
      const scope = scopeCanvasRef.current;
      if (scope) {
        const ctx = scope.getContext('2d');
        if (ctx) {
          const w = scope.width;
          const h = scope.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          // Grid tipis
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 1;
          for (let y = 0; y <= h; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          ctx.strokeStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          ctx.strokeStyle = isNoisy ? '#E11D48' : '#0D9488';
          ctx.lineWidth = 2.2;
          ctx.beginPath();

          if (role === 'lab' && analyserRef.current && isActive) {
            const timeDomain = new Float32Array(analyserRef.current.fftSize);
            analyserRef.current.getFloatTimeDomainData(timeDomain);
            const sliceWidth = w / timeDomain.length;
            let x = 0;
            for (let i = 0; i < timeDomain.length; i++) {
              const v = timeDomain[i];
              const y = (v * h) / 1.8 + h / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
          } else if (role === 'admin' && isActive && adminTelemetryRef.current?.audio_preview) {
            const pts = adminTelemetryRef.current.audio_preview;
            const sliceWidth = w / pts.length;
            let x = 0;
            for (let i = 0; i < pts.length; i++) {
              const v = pts[i] || 0;
              const y = (v * h * 1.5) / 1.8 + h / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
          } else {
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
          }
          ctx.stroke();
        }
      }

      // 3. Gambar Equalizer Spektrum 32 Pita (Latar Putih #FFFFFF)
      const spec = spectrumCanvasRef.current;
      if (spec) {
        const ctx = spec.getContext('2d');
        if (ctx) {
          const w = spec.width;
          const h = spec.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          const numBars = 32;
          const barWidth = w / numBars - 2;

          if (role === 'lab' && analyserRef.current && isActive) {
            const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(freqData);
            const step = Math.floor(freqData.length / numBars);

            for (let i = 0; i < numBars; i++) {
              const barHeight = (freqData[i * step] / 255) * (h - 6);
              const x = i * (barWidth + 2);
              const y = h - barHeight;

              ctx.fillStyle = isNoisy ? '#FB7185' : '#14B8A6';
              ctx.fillRect(x, y, barWidth, barHeight);
            }
          } else if (role === 'admin' && isActive && currentResultRef.current) {
            const mfccs = currentResultRef.current.mfccs || [];
            const rms = currentResultRef.current.rms || 0.02;
            for (let i = 0; i < numBars; i++) {
              const mfccVal = Math.abs(mfccs[i % 13] || 10);
              const barHeight = Math.min(h - 4, Math.max(4, (mfccVal / 180) * h * (rms * 15 + 0.3)));
              const x = i * (barWidth + 2);
              const y = h - barHeight;

              ctx.fillStyle = isNoisy ? '#FB7185' : '#14B8A6';
              ctx.fillRect(x, y, barWidth, barHeight);
            }
          } else {
            for (let i = 0; i < numBars; i++) {
              const x = i * (barWidth + 2);
              ctx.fillStyle = '#F1F5F9';
              ctx.fillRect(x, h - 3, barWidth, 3);
            }
          }
        }
      }

      // 4. Gambar Linimasa 30 Detik (Latar Putih #FFFFFF)
      const tl = timelineCanvasRef.current;
      if (tl) {
        const ctx = tl.getContext('2d');
        if (ctx) {
          const w = tl.width;
          const h = tl.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          const dangerY = h - 0.7 * h;
          ctx.strokeStyle = '#FECDD3';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, dangerY);
          ctx.lineTo(w, dangerY);
          ctx.stroke();
          ctx.setLineDash([]);

          const pts = timelineDataRef.current;
          if (pts.length > 1) {
            ctx.strokeStyle = '#0D9488';
            ctx.lineWidth = 2.5;
            ctx.beginPath();

            const xStep = w / 30;
            pts.forEach((pt, i) => {
              const x = i * xStep;
              const y = h - (pt.noiseProb / 100) * h;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();

            ctx.lineTo((pts.length - 1) * xStep, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = 'rgba(13, 148, 136, 0.10)';
            ctx.fill();

            const lastIdx = pts.length - 1;
            const lastX = lastIdx * xStep;
            const lastY = h - (pts[lastIdx].noiseProb / 100) * h;
            ctx.fillStyle = pts[lastIdx].label === 'berisik' ? '#E11D48' : '#0D9488';
            ctx.beginPath();
            ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    animationFrameRef.current = animId;

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isActive, role]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (role === 'lab') {
        stopMonitoringInternal();
      }
    };
  }, [role, stopMonitoringInternal]);

  const isNoisy = currentResult?.prediction === 1;

  // Hitung LED ticks (28 baris)
  const activeTicksCount = Math.round(
    currentResult ? currentResult.probabilities.berisik * NUM_TICKS : 0
  );

  const selectedOption =
    CONSISTENCY_OPTIONS.find((c) => c.val === consistencyDuration) || CONSISTENCY_OPTIONS[3];

  const minRequiredNoisy =
    consistencyDuration === 1
      ? 1
      : consistencyDuration === 4
      ? 3
      : Math.ceil(consistencyDuration * 0.8);

  const progressPct =
    minRequiredNoisy > 0
      ? Math.min(100, Math.round((windowNoisySeconds / minRequiredNoisy) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* ==============================================================================
          ROLE 1: ONE-CLICK KIOSK ACTIVATION OVERLAY / BANNER (KHUSUS PC LAB)
          ============================================================================== */}
      {role === 'lab' && !isKioskActivated && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border-2 border-teal-500/40 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-teal-600/30">
                <HeroIcon name="microphone" className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
                  Aktifkan Sensor Audio PC Lab
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  Sesuai kebijakan keamanan browser, sensor mikrofon wajib diinisialisasi melalui 1 interaksi klik. 
                  Setelah diaktifkan, deteksi audio dan alarm 3 detik akan dikomandoi sepenuhnya secara jarak jauh oleh Admin dari antarmuka <span className="font-mono font-semibold text-teal-800">/admin</span>.
                </p>
                {kioskInitError && (
                  <div className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                    <HeroIcon name="exclamation-triangle" className="w-4 h-4 text-rose-500" />
                    <span>{kioskInitError}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={activateKioskMicrophone}
              className="py-3.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm tracking-wide transition-all shadow-md shadow-teal-600/25 flex items-center gap-2.5 whitespace-nowrap flex-shrink-0"
            >
              <HeroIcon name="shield-check" className="w-5 h-5 text-white" />
              <span>Aktifkan Sensor & Masuk Standby</span>
            </button>
          </div>
        </div>
      )}

      {/* ==============================================================================
          ROLE 2: REMOTE CONTROL BAR (KHUSUS ADMIN)
          ============================================================================== */}
      {role === 'admin' && (
        <div className="bg-white rounded-2xl border border-teal-200/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center flex-shrink-0">
                <HeroIcon name="adjustments" className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
                    Remote Control Bar — Kendali PC Lab
                  </h3>
                  {/* Status PC Lab */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    roomState.lab_client_connected && roomState.lab_mic_ready
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : roomState.lab_client_connected
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      roomState.lab_client_connected && roomState.lab_mic_ready
                        ? 'bg-teal-500 animate-pulse'
                        : roomState.lab_client_connected
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`} />
                    <span>
                      {roomState.lab_client_connected && roomState.lab_mic_ready
                        ? 'PC Lab Terhubung (Mikrofon Siaga)'
                        : roomState.lab_client_connected
                        ? 'PC Lab Terhubung (Mikrofon Belum Diaktifkan di Lab)'
                        : 'PC Lab Terputus (Belum Dibuka)'}
                    </span>
                  </span>

                  {/* Tombol Cepat Buka Layar PC Lab di Tab Baru */}
                  {!roomState.lab_client_connected && (
                    <button
                      type="button"
                      onClick={() => window.open('/', '_blank')}
                      className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors shadow-2xs"
                      title="Buka antarmuka sensor PC Lab di jendela/tab baru"
                    >
                      <HeroIcon name="computer-desktop" className="w-3.5 h-3.5 text-teal-600" />
                      <span>Buka Layar PC Lab (Tab Baru)</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Perintah Start/Stop, perubahan durasi toleransi, dan pemicuan alarm akan langsung disinkronkan ke PC Lab.
                </p>
              </div>
            </div>

            {/* Tombol Utama Start / Stop Jarak Jauh */}
            <div className="flex items-center gap-3">
              {isActive ? (
                <button
                  onClick={handleAdminStopMonitoring}
                  className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs tracking-wide transition-all shadow-sm shadow-rose-600/20 flex items-center gap-2"
                >
                  <HeroIcon name="stop" className="w-4 h-4 text-white" />
                  <span>Hentikan Deteksi Lab</span>
                </button>
              ) : (
                <button
                  onClick={handleAdminStartMonitoring}
                  className="py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs tracking-wide transition-all shadow-sm shadow-teal-600/20 flex items-center gap-2"
                  title="Mulai pemantauan audio ruang lab secara jarak jauh"
                >
                  <HeroIcon name="play" className="w-4 h-4" />
                  <span>Mulai Deteksi Ruang Lab</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifikasi Siaga jika deteksi aktif namun PC Lab belum siap */}
          {isActive && (!roomState.lab_client_connected || !roomState.lab_mic_ready) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <HeroIcon name="exclamation-triangle" className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Deteksi Jarak Jauh Diaktifkan:</strong>{' '}
                  {!roomState.lab_client_connected
                    ? 'Menunggu antarmuka PC Lab dibuka pada komputer laboratorium. Buka rute / atau /lab untuk mulai mendeteksi.'
                    : 'PC Lab telah terhubung, menunggu operator menekan "Aktifkan Sensor" pada layar PC Lab.'}
                </span>
              </div>
              {!roomState.lab_client_connected && (
                <button
                  type="button"
                  onClick={() => window.open('/', '_blank')}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs whitespace-nowrap shadow-xs"
                >
                  Buka PC Lab Sekarang
                </button>
              )}
            </div>
          )}

          {/* Baris Kustomisasi Parameter Jarak Jauh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Pilihan Toleransi */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                Toleransi Rolling Window
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 hover:border-teal-500 transition-colors"
                >
                  <span>{selectedOption.label}</span>
                  <HeroIcon name="chevron-down" className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5">
                    {CONSISTENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleAdminSetTolerance(opt.val)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                          consistencyDuration === opt.val
                            ? 'bg-teal-50 text-teal-800'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {opt.val === 1 ? '1s' : `Min ${opt.val === 4 ? 3 : Math.ceil(opt.val * 0.8)}s`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Suara Alarm PC Lab */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                  Alarm PC Lab
                </label>
                <button
                  type="button"
                  onClick={handleAdminToggleAlarm}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${
                    alarmEnabled
                      ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                      : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <HeroIcon name={alarmEnabled ? 'bell' : 'bell-slash'} className="w-3.5 h-3.5" />
                  <span>{alarmEnabled ? 'Aktif' : 'Nonaktif'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>Durasi: {beepDuration}s</span>
                <div className="flex items-center gap-1">
                  {[1, 3, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBeepDuration(s)}
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        beepDuration === s
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    title={`Volume Alarm: ${Math.round(alarmVolume * 100)}%`}
                    value={alarmVolume}
                    onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                    className="w-10 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 ml-1"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Reset Akumulasi Bising */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Buffer Akumulasi
              </label>
              <button
                type="button"
                onClick={handleAdminResetBuffer}
                className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                title="Mengosongkan akumulasi detik bising saat ini"
              >
                <HeroIcon name="arrow-path" className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Akumulasi</span>
              </button>
            </div>

            {/* Tombol Uji Bunyi Alarm Jarak Jauh */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Uji Sistem Bunyi
              </label>
              <button
                type="button"
                onClick={handleAdminTestAlarm}
                className="w-full py-1.5 px-3 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-semibold text-teal-800 transition-colors flex items-center justify-center gap-1.5"
                title="Membunyikan alarm 3 detik di speaker PC Lab"
              >
                <HeroIcon name="volume-up" className="w-3.5 h-3.5 text-teal-600" />
                <span>Uji Alarm Lab (3s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
          HERO STATUS CARD & INSTRUMENT CONTROLS
          ============================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
        <div className="rt-hero-grid">
          {/* Kolom Kiri: Status Akustik, LED Meter 28 Segmen & Metrik Utama */}
          <div className="flex flex-col justify-center">
            {/* Status Pill Badge */}
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3 w-fit border transition-colors ${
                !isActive
                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                  : isNoisy
                  ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                  : 'bg-teal-50 text-teal-800 border-teal-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isActive ? 'bg-slate-400' : isNoisy ? 'bg-rose-600' : 'bg-teal-500'
                }`}
              />
              <span>
                {!isActive
                  ? 'STANDBY'
                  : isNoisy
                  ? 'PERINGATAN: BERISIK'
                  : 'KONDUSIF (NON-BERISIK)'}
              </span>
            </div>

            {/* Judul Status Utama */}
            <h2 className="rt-hero-title">
              {!isActive
                ? role === 'lab'
                  ? 'Sensor Standby — Menunggu Komando Admin'
                  : 'Ruang Studio Standby'
                : isNoisy
                ? 'Terdeteksi Suara Berisik'
                : 'Suara Ruangan Kondusif'}
            </h2>
            <p className="rt-hero-desc">
              {!isActive
                ? role === 'lab'
                  ? 'PC Lab siap menerima perintah remote. Start/Stop dan parameter dikendalikan langsung oleh Admin.'
                  : 'Sistem siap melakukan klasifikasi audio berisik vs non-berisik menggunakan model Weighted KNN.'
                : isNoisy
                ? 'Intensitas dan karakteristik spektral audio melampaui profil tenang lingkungan laboratorium.'
                : 'Tingkat kebisingan berada dalam batas wajar lingkungan kerja dan tidak mengganggu aktivitas.'}
            </p>

            {/* Multi-segment LED Bar Meter (28 Segmen) */}
            <div className="rt-bar-meter">
              {Array.from({ length: NUM_TICKS }).map((_, i) => {
                const isLit = isActive && i < activeTicksCount;
                let tickColor = '#E2E8F0'; // idle

                if (isLit) {
                  if (isNoisy) {
                    tickColor = i > NUM_TICKS * 0.7 ? '#E11D48' : '#FB7185';
                  } else {
                    tickColor = i > NUM_TICKS * 0.5 ? '#0D9488' : '#2DD4BF';
                  }
                }

                return (
                  <div
                    key={i}
                    className="rt-bar-tick"
                    style={{
                      backgroundColor: tickColor,
                      transform: isLit ? 'scaleY(1.15)' : 'scaleY(1)',
                    }}
                  />
                );
              })}
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between max-w-[360px]">
              <span>Kondusif (0%)</span>
              <span>Ambang Bising (70%)</span>
              <span>Bising Ekstrem (100%)</span>
            </div>

            {/* Baris Metrik Utama */}
            <div className="rt-hero-metrics">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Keyakinan
                </div>
                <div className="rt-hero-metric-val">
                  {currentResult ? `${currentResult.confidence.toFixed(1)}%` : '--%'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Toleransi Bergerak
                </div>
                <div className="rt-hero-metric-val text-teal-700">
                  {selectedOption.label}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Intensitas RMS
                </div>
                <div className="rt-hero-metric-val">
                  {currentResult ? currentResult.rms.toFixed(4) : '--'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Akumulasi Bising
                </div>
                <div
                  className={`rt-hero-metric-val font-mono ${
                    progressPct >= 70 ? 'text-rose-600' : 'text-slate-800'
                  }`}
                >
                  {isActive ? `${windowNoisySeconds}s / ${minRequiredNoisy}s` : 'Standby'}
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Instrument Card (Mini Scope, Kontrol Sesuai Role) */}
          <div className="rt-instrument-col">
            <div className="rt-instrument-card p-5 space-y-4">
              {/* Mini Oscilloscope Display (Latar Belakang Putih #FFFFFF) */}
              <div className="bg-white rounded-xl p-2.5 overflow-hidden border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 px-1 mb-1 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-teal-600 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span className="font-semibold text-slate-700">Live Waveform</span>
                  </div>
                  <span className="text-slate-500">{isActive ? `${sessionSeconds}s` : '0s'}</span>
                </div>
                <canvas
                  ref={miniScopeCanvasRef}
                  width={400}
                  height={80}
                  className="w-full h-20 block rounded bg-white"
                />
              </div>

              {/* TAMPILAN SESUAI PERAN (ROLE SPECIFIC CONTROL) */}
              {role === 'lab' ? (
                /* Role PC Lab: Badge Status Kendali Jarak Jauh (Read-Only) */
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wide border-b border-slate-200 pb-2">
                    <HeroIcon name="signal" className="w-4 h-4 text-teal-600" />
                    <span>Mode Kiosk PC Lab — Dikendalikan Admin</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Status Deteksi:</span>
                      <span
                        className={`font-semibold ${
                          isActive ? 'text-teal-700 font-bold' : 'text-slate-600'
                        }`}
                      >
                        {isActive ? 'Sedang Aktif (Mendeteksi)' : 'Standby (Menunggu Admin)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Toleransi Aktif:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedOption.label} (Min {minRequiredNoisy}s)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Alarm Speaker:</span>
                      <span
                        className={`font-semibold ${
                          alarmEnabled ? 'text-teal-700' : 'text-slate-500'
                        }`}
                      >
                        {alarmEnabled ? 'Aktif (3s)' : 'Dinonaktifkan Admin'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Koneksi Server:</span>
                      <span className="font-semibold text-teal-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        <span>Terhubung</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Role Admin: Tombol Start/Stop Utama & Toleransi Dropdown */
                <>
                  <button
                    onClick={isActive ? handleAdminStopMonitoring : handleAdminStartMonitoring}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2.5 ${
                      isActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                    }`}
                  >
                    <HeroIcon name={isActive ? 'stop' : 'play'} className="w-5 h-5 text-white" />
                    <span>
                      {isActive
                        ? 'Hentikan Deteksi Ruang Lab'
                        : 'Mulai Deteksi Ruang Lab Jarak Jauh'}
                    </span>
                  </button>

                  {/* Toleransi Kebisingan Konsisten */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <HeroIcon name="clock" className="w-3.5 h-3.5 text-teal-600" />
                      <span>Toleransi Kebisingan</span>
                    </label>

                    <div className="rt-custom-dropdown z-30" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`rt-custom-dropdown-trigger ${
                          isDropdownOpen ? 'open' : ''
                        }`}
                      >
                        <span className="font-bold text-slate-800 text-xs">
                          {selectedOption.label}
                        </span>
                        <HeroIcon
                          name="chevron-down"
                          className={`w-4 h-4 text-slate-400 transition-transform ${
                            isDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isDropdownOpen && (
                        <div className="rt-custom-dropdown-popover max-h-60 overflow-y-auto overscroll-contain shadow-xl border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 sticky top-0 bg-white border-b border-slate-100">
                            Pilihan Toleransi
                          </div>
                          <div className="space-y-0.5 pr-1 pt-1">
                            {CONSISTENCY_OPTIONS.map((opt) => {
                              const isSelected = consistencyDuration === opt.val;
                              const minReq =
                                opt.val === 1 ? 1 : opt.val === 4 ? 3 : Math.ceil(opt.val * 0.8);

                              return (
                                <div
                                  key={opt.val}
                                  onClick={() => handleAdminSetTolerance(opt.val)}
                                  className={`rt-dropdown-item ${isSelected ? 'selected' : ''}`}
                                >
                                  <div className="pt-0.5">
                                    <div className={`rt-dropdown-radio ${isSelected ? 'active' : ''}`}>
                                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`text-xs ${
                                          isSelected
                                            ? 'font-bold text-teal-800'
                                            : 'font-medium text-slate-800'
                                        }`}
                                      >
                                        {opt.label}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {opt.val === 1 ? '1s' : `Min ${minReq}s`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Kalibrasi Ambien Ruangan (PC Lab) */}
              {role === 'lab' && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={handleCalibrate}
                    disabled={isActive || isCalibrating}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      isCalibrating
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50'
                    }`}
                    title="Mengukur level suara hening ruangan selama 3 detik"
                  >
                    <HeroIcon
                      name="adjustments"
                      className={`w-3.5 h-3.5 ${
                        isCalibrating ? 'animate-spin text-teal-600' : 'text-slate-500'
                      }`}
                    />
                    <span>{isCalibrating ? 'Mengukur Ambien...' : 'Kalibrasi Ruangan'}</span>
                  </button>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-600">
                    RMS: <span className="font-bold text-teal-700">{baselineRms.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {lastError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <HeroIcon name="exclamation-triangle" className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{lastError}</span>
          </div>
        )}
      </div>

      {/* ==============================================================================
          PERSISTENCE BANNER & PROGRESS TRACK (Rolling Window)
          ============================================================================== */}
      {isActive && (
        <div
          className={`rt-persistence-hero-banner ${
            alarmCooldownSeconds > 0 || progressPct >= 70 ? 'noisy' : ''
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  alarmCooldownSeconds > 0
                    ? 'bg-rose-600 animate-ping'
                    : progressPct >= 70
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-teal-600 animate-pulse'
                }`}
              />
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-800">
                  {alarmCooldownSeconds > 0
                    ? `Peringatan Aktif: Beep Berbunyi (${alarmCooldownSeconds}s)`
                    : `Pemantauan Toleransi Bergerak (${selectedOption.label})`}
                </span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">
                  &bull; Akumulasi: {windowNoisySeconds}s / {windowTotalSeconds}s (Batas: {minRequiredNoisy}s)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-mono font-semibold text-slate-500">
                Progres Bising:
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  progressPct >= 100
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : progressPct >= 70
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-teal-800 border-slate-200'
                }`}
              >
                {windowNoisySeconds}s / {minRequiredNoisy}s ({progressPct}%)
              </span>
            </div>
          </div>

          {/* Progress Track & Animated Fill Bar */}
          <div className="rt-hero-banner-track">
            <div
              className={`rt-hero-banner-fill ${progressPct >= 70 ? 'noisy' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Notifikasi Peringatan Terakhir yang Dipicu */}
      {lastAlertEvent && (
        <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-center justify-between gap-3 animation-fadeIn">
          <div className="flex items-center gap-2.5">
            <HeroIcon
              name="exclamation-triangle"
              className="w-5 h-5 flex-shrink-0 text-rose-600"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Peringatan Kebisingan #{lastAlertEvent.alertNum}:</span>{' '}
              Terdeteksi kebisingan konsisten selama{' '}
              <span className="font-extrabold uppercase">
                {lastAlertEvent.duration === 1 ? 'Real-Time' : `${lastAlertEvent.duration} Detik`}
              </span>{' '}
              ({lastAlertEvent.noisyCount} dari {lastAlertEvent.windowLen} detik terakhir berisik).
              {alarmEnabled && (
                <span className="ml-1.5 font-bold text-rose-700">
                  &bull; Beep berbunyi {beepDuration} detik di PC Lab.
                </span>
              )}
            </div>
          </div>

          <span className="text-[11px] font-mono opacity-70 whitespace-nowrap hidden sm:inline">
            {new Date(lastAlertEvent.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* ==============================================================================
          BENTO GRID CARDS (Osiloskop 60 FPS, Linimasa 30s & Statistik Sesi)
          ============================================================================== */}
      <div className="rt-bento-grid">
        {/* Card 1: Osiloskop & Equalizer Frekuensi */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <HeroIcon name="waveform" className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Osiloskop Gelombang (60 FPS)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Time Domain</span>
          </div>

          {/* Osiloskop Gelombang (Latar Belakang Putih #FFFFFF) */}
          <div className="bg-white rounded-xl p-2.5 overflow-hidden border border-slate-200 shadow-sm">
            <canvas
              ref={scopeCanvasRef}
              width={450}
              height={120}
              className="w-full h-28 block rounded bg-white"
            />
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 pt-1">
            <div className="flex items-center gap-2">
              <HeroIcon name="chart-bar" className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Equalizer Spektrum (32 Pita)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Frequency Domain</span>
          </div>

          {/* Equalizer Spektrum (Latar Belakang Putih #FFFFFF) */}
          <div className="bg-white rounded-xl p-2.5 overflow-hidden border border-slate-200 shadow-sm">
            <canvas
              ref={spectrumCanvasRef}
              width={450}
              height={80}
              className="w-full h-20 block rounded bg-white"
            />
          </div>
        </div>

        {/* Card 2: Linimasa 30 Detik Terakhir */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <HeroIcon name="clock" className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Linimasa Kebisingan (30s Terakhir)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-600" />
                <span className="text-slate-500">Tren % Bising</span>
              </div>
            </div>

            {/* Linimasa Canvas (Latar Belakang Putih #FFFFFF) */}
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
              <canvas
                ref={timelineCanvasRef}
                width={450}
                height={160}
                className="w-full h-36 block bg-white"
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Ambang Bahaya:</span>
            <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              70% Probabilitas
            </span>
          </div>
        </div>

        {/* Card 3: Statistik Sesi & Analitik KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <HeroIcon name="chart-pie" className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Statistik & Akumulasi Sesi
                </span>
              </div>
              <div className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {Math.floor(sessionSeconds / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(sessionSeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Total Segmen (4s)
                </div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                  {totalChunks}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Rasio Kebisingan
                </div>
                <div
                  className={`text-xl font-bold font-mono mt-1 ${
                    totalChunks > 0 && noisyChunks / totalChunks >= 0.5
                      ? 'text-rose-600'
                      : 'text-teal-700'
                  }`}
                >
                  {totalChunks > 0 ? `${((noisyChunks / totalChunks) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>

              <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-3">
                <div className="text-[10px] text-teal-700 uppercase font-semibold">
                  Segmen Kondusif
                </div>
                <div className="text-xl font-bold font-mono text-teal-800 mt-1">
                  {cleanChunks}
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3">
                <div className="text-[10px] text-rose-700 uppercase font-semibold">
                  Segmen Bising
                </div>
                <div className="text-xl font-bold font-mono text-rose-800 mt-1">
                  {noisyChunks}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Peringatan Terpicu:</span>
              <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {totalAlertsCount} kali
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Latensi Pemrosesan:</span>
              <span className="font-mono font-bold text-slate-800">
                {currentResult ? `${currentResult.latency_ms} ms` : '-- ms'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================================
          DIAGNOSTIC CARD (16 Parameters PSD Breakdown)
          ============================================================================== */}
      <div className="rt-diag-card">
        <div
          onClick={() => setIsDiagOpen(!isDiagOpen)}
          className="flex items-center justify-between cursor-pointer select-none border-b border-slate-100 pb-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <HeroIcon name="cpu" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Diagnostik 16 Parameter Akustik (Domain Waktu, Frekuensi & Mel)
              </h3>
              <p className="text-xs text-slate-500">
                Fitur mentah yang diumpankan ke model Weighted K-Nearest Neighbors
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-teal-700 font-semibold hidden sm:inline">
              {isDiagOpen ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
            </span>
            <HeroIcon
              name="chevron-down"
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isDiagOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {isDiagOpen && (
          <div className="space-y-4 pt-1">
            {/* 3 Parameter Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    RMS Energy (Intensitas)
                  </span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="\text{RMS}" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? currentResult.rms.toFixed(5) : '--'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Daya fisik sinyal</span>
                  <Latex
                    math="\sqrt{\frac{1}{N}\sum |x|^2}"
                    className="text-[9px] text-slate-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Spectral Centroid
                  </span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="f_c" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? `${currentResult.centroid_hz.toFixed(0)} Hz` : '-- Hz'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Titik tengah spektrum</span>
                  <Latex
                    math="\frac{\sum f_k |X_k|}{\sum |X_k|}"
                    className="text-[9px] text-slate-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Zero Crossing Rate
                  </span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="\text{ZCR}" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? currentResult.zcr.toFixed(5) : '--'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Laju desis frekuensi</span>
                  <Latex
                    math="\frac{1}{2N}\sum |\Delta \text{sgn}|"
                    className="text-[9px] text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* 13 Koefisien MFCC Bar Spectrum */}
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Profil 13 Koefisien Spektral MFCC
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Timbre & Resonansi Mel
                </span>
              </div>

              <div className="w-full bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 w-full pt-4">
                  {(currentResult?.mfccs && currentResult.mfccs.length === 13
                    ? currentResult.mfccs
                    : Array(13).fill(0)
                  ).map((val, idx) => {
                    const maxAbs = 250;
                    const clamped = Math.max(-maxAbs, Math.min(maxAbs, val));
                    const heightPercent = currentResult
                      ? Math.min(100, Math.max(12, (Math.abs(clamped) / maxAbs) * 100))
                      : 14;
                    const isPositive = val >= 0;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center h-full justify-end min-w-0 group"
                      >
                        <span className="text-[9px] font-mono font-medium text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                          {currentResult ? val.toFixed(0) : '0'}
                        </span>
                        <div className="w-full flex-1 flex items-end justify-center">
                          <div
                            className={`w-full max-w-[28px] rounded-t transition-all duration-200 ${
                              !currentResult
                                ? 'bg-slate-200'
                                : isPositive
                                ? 'bg-teal-600 group-hover:bg-teal-700 shadow-sm'
                                : 'bg-rose-500 group-hover:bg-rose-600 shadow-sm'
                            }`}
                            style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                          />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-600 mt-1.5">
                          C{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
