import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HeroIcon } from './HeroIcon';
import { Latex } from './Latex';
import { encodeWAV } from '../utils/wavEncoder';
import { alertPlayer } from '../utils/audioAlert';
import { predictLiveAudio } from '../services/api';
import type { PredictionResult } from '../services/api';

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

interface LiveMonitorProps {
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

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ onSaveSession, onLiveChange }) => {
  // State Monitoring
  const [isActive, setIsActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [baselineRms, setBaselineRms] = useState<number>(() => {
    const saved = localStorage.getItem('acoustiknn_baseline_rms');
    return saved ? parseFloat(saved) : 0.015;
  });

  // State Toleransi Kebisingan Konsisten (Rolling Window)
  const [consistencyDuration, setConsistencyDuration] = useState<number>(5);
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

  // Refs untuk tracking stabil (mencegah re-trigger React lifecycle)
  const sessionSecondsRef = useRef(0);
  const totalChunksRef = useRef(0);
  const noisyChunksRef = useRef(0);
  const cleanChunksRef = useRef(0);

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

  // Refs Web Audio & Loop
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);

  const circularBufferRef = useRef<Float32Array>(new Float32Array(BUFFER_SIZE));
  const bufferWriteIdxRef = useRef<number>(0);
  const isPredictingRef = useRef<boolean>(false);

  // Refs Canvas Visualisasi
  const miniScopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Buffer Riwayat 30 Detik
  const timelineDataRef = useRef<Array<{ time: number; noiseProb: number; label: string }>>([]);

  const timerIntervalRef = useRef<number | null>(null);
  const predictIntervalRef = useRef<number | null>(null);

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

  // Kalibrasi baseline RMS ruangan (3 detik)
  const handleCalibrate = useCallback(async () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    setLastError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});

        const calculated = count > 0 ? sumRms / count : 0.015;
        const clamped = Math.max(0.005, Math.min(0.050, calculated));
        setBaselineRms(clamped);
        localStorage.setItem('acoustiknn_baseline_rms', clamped.toString());
        setIsCalibrating(false);
      }, 3000);
    } catch (err) {
      setLastError(`Gagal mengakses mikrofon untuk kalibrasi: ${String(err)}`);
      setIsCalibrating(false);
    }
  }, [isCalibrating]);

  // Hentikan monitoring
  const stopMonitoring = useCallback(() => {
    setIsActive(false);
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

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
  }, []);

  // Mulai monitoring
  const startMonitoring = useCallback(async () => {
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // AnalyserNode untuk 60fps canvas visualizer
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      sourceNode.connect(analyser);

      // ScriptProcessorNode untuk resample ke 22.050 Hz
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

      // Matikan output gain ke destination agar terbebas dari audio howling / feedback
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      sourceNode.connect(scriptNode);
      scriptNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      setIsActive(true);
      onLiveChangeRef.current?.(true);

      // Timer durasi sesi berjalan & status cooldown alarm
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
      predictIntervalRef.current = window.setInterval(async () => {
        if (isPredictingRef.current) return;
        isPredictingRef.current = true;

        try {
          // Susun circular buffer menjadi Float32Array berurutan
          const linearBuffer = new Float32Array(BUFFER_SIZE);
          const circ = circularBufferRef.current;
          const writeIdx = bufferWriteIdxRef.current;

          for (let i = 0; i < BUFFER_SIZE; i++) {
            linearBuffer[i] = circ[(writeIdx + i) % BUFFER_SIZE];
          }

          // Encode ke 16-bit PCM WAV mono 22.050 Hz
          const wavBlob = encodeWAV(linearBuffer, TARGET_SR);

          // Panggil API /predict-live dengan baseline RMS
          const result = await predictLiveAudio(wavBlob, baselineRmsRef.current);
          setCurrentResult(result);

          // Update agregat sesi
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

          // Simpan ke linimasa 30 detik
          const prob = result.probabilities.berisik * 100;
          timelineDataRef.current.push({
            time: Date.now(),
            noiseProb: prob,
            label: result.label
          });
          if (timelineDataRef.current.length > 30) {
            timelineDataRef.current.shift();
          }

          // =========================================================================
          // EVALUASI KEBISINGAN KONSISTEN (TOLERANSI BERGERAK / ROLLING WINDOW)
          // =========================================================================
          const targetDuration = consistencyDurationRef.current;
          const now = Date.now();

          // Jika alarm sedang berbunyi (periode cooldown 3 detik), jangan memicu alarm baru
          if (now < alarmCooldownUntilRef.current) {
            return;
          }

          // Masukkan sampel detik ini ke buffer jendela geser
          rollingHistoryRef.current.push(isNoisySample);
          if (rollingHistoryRef.current.length > targetDuration) {
            rollingHistoryRef.current.shift();
          }

          const currentWindowLen = rollingHistoryRef.current.length;
          const currentNoisyCount = rollingHistoryRef.current.filter(Boolean).length;
          setWindowNoisySeconds(currentNoisyCount);
          setWindowTotalSeconds(currentWindowLen);

          // Ambang batas toleransi bergerak:
          // - Real-Time (1s) : minimal 1s bising (100%)
          // - 4 Detik        : minimal 3s bising (75%)
          // - 5s, 10s, dst   : minimal 80% bising (misal 24 dari 30s)
          const minRequiredNoisy = targetDuration === 1
            ? 1
            : (targetDuration === 4 ? 3 : Math.ceil(targetDuration * 0.80));

          const isConsistent = currentWindowLen >= targetDuration && currentNoisyCount >= minRequiredNoisy;

          if (isConsistent) {
            const currentBeepDur = beepDurationRef.current;

            // Bunyikan beep panjang kontinu jika tidak dinonaktifkan
            if (alarmEnabledRef.current) {
              alertPlayer.playLongBeep(currentBeepDur, alarmVolumeRef.current);
            }

            // Set cooldown sesuai durasi beep
            alarmCooldownUntilRef.current = now + (currentBeepDur * 1000);
            setAlarmCooldownSeconds(currentBeepDur);

            totalAlertsCountRef.current += 1;
            const alertNum = totalAlertsCountRef.current;
            setTotalAlertsCount(alertNum);

            setLastAlertEvent({
              alertNum,
              duration: targetDuration,
              noisyCount: currentNoisyCount,
              windowLen: currentWindowLen,
              timestamp: now
            });

            // Simpan log event peringatan konsisten ke Riwayat
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
              filename: targetDuration === 1
                ? `Peringatan Bising Real-Time #${alertNum}`
                : `Kebisingan Konsisten ${targetDuration}s #${alertNum} (${currentNoisyCount}/${currentWindowLen}s)`
            };
            onSaveSessionRef.current(session);

            // Reset buffer jendela geser agar evaluasi konsistensi berikutnya mulai segar
            rollingHistoryRef.current = [];
            setWindowNoisySeconds(0);
            setWindowTotalSeconds(0);
          }

        } catch (err) {
          console.error("Gagal prediksi live:", err);
        } finally {
          isPredictingRef.current = false;
        }
      }, 1000);

    } catch (err) {
      setLastError(`Tidak dapat mengakses mikrofon. Pastikan izin mikrofon diberikan. Detail: ${String(err)}`);
      stopMonitoring();
    }
  }, [stopMonitoring]);

  // Efek Animasi Canvas 60 FPS
  useEffect(() => {
    if (!isActive) return;

    let animId: number;
    const analyser = analyserRef.current;
    if (!analyser) return;

    const timeDomainBuffer = new Float32Array(analyser.fftSize);
    const freqBuffer = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      analyser.getFloatTimeDomainData(timeDomainBuffer);
      analyser.getByteFrequencyData(freqBuffer);

      const isNoisy = currentResultRef.current?.prediction === 1;

      // 1. Gambar Mini Scope di Instrument Card (Latar Belakang Putih Murni)
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
          const sliceWidth = w / timeDomainBuffer.length;
          let x = 0;
          for (let i = 0; i < timeDomainBuffer.length; i++) {
            const v = timeDomainBuffer[i];
            const y = (0.5 + v * 0.42) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
        }
      }

      // 2. Gambar Oscilloscope Besar di Bento Card (Latar Belakang Putih Murni)
      const scopeCanvas = scopeCanvasRef.current;
      if (scopeCanvas) {
        const ctx = scopeCanvas.getContext('2d');
        if (ctx) {
          const w = scopeCanvas.width;
          const h = scopeCanvas.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          // Grid horizontal halus
          ctx.strokeStyle = '#F8FAFC';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h * 0.25);
          ctx.lineTo(w, h * 0.25);
          ctx.moveTo(0, h * 0.75);
          ctx.lineTo(w, h * 0.75);
          ctx.stroke();

          // Grid tengah
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          // Gelombang
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = isNoisy ? '#E11D48' : '#0D9488';
          ctx.beginPath();
          const sliceWidth = w / timeDomainBuffer.length;
          let x = 0;
          for (let i = 0; i < timeDomainBuffer.length; i++) {
            const v = timeDomainBuffer[i];
            const y = (0.5 + v * 0.45) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
        }
      }

      // 3. Gambar Equalizer Spektrum Frekuensi di Bento Card (Latar Belakang Putih Murni)
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const ctx = specCanvas.getContext('2d');
        if (ctx) {
          const w = specCanvas.width;
          const h = specCanvas.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          const numBars = 32;
          const barWidth = (w / numBars) - 2;
          const step = Math.floor(freqBuffer.length / numBars);

          // Garis dasar
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h - 0.5);
          ctx.lineTo(w, h - 0.5);
          ctx.stroke();

          for (let i = 0; i < numBars; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
              sum += freqBuffer[i * step + j];
            }
            const avg = sum / step;
            const barHeight = Math.max(3, (avg / 255) * (h - 4));

            ctx.fillStyle = isNoisy ? '#E11D48' : '#0D9488';
            ctx.fillRect(i * (barWidth + 2), h - barHeight, barWidth, barHeight);
          }
        }
      }

      // 4. Gambar Linimasa 30 Detik (Latar Belakang Putih Murni)
      const tlCanvas = timelineCanvasRef.current;
      if (tlCanvas) {
        const ctx = tlCanvas.getContext('2d');
        if (ctx) {
          const w = tlCanvas.width;
          const h = tlCanvas.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);

          // Grid halus horizontal
          ctx.strokeStyle = '#F1F5F9';
          ctx.lineWidth = 1;
          for (let g = 0.25; g <= 0.75; g += 0.25) {
            const gy = h * g;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          // Garis ambang batas 70%
          const warnY = h - (0.7 * h);
          ctx.strokeStyle = '#FDA4AF';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, warnY);
          ctx.lineTo(w, warnY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Titik-titik probabilitas riwayat
          const pts = timelineDataRef.current;
          if (pts.length > 1) {
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#0F766E';
            ctx.beginPath();

            const xStep = w / 30;
            pts.forEach((pt, i) => {
              const x = i * xStep;
              const y = h - (pt.noiseProb / 100) * h;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Area bayangan bawah
            ctx.lineTo((pts.length - 1) * xStep, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fillStyle = 'rgba(13, 148, 136, 0.10)';
            ctx.fill();

            // Titik kursor terkini
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
  }, [isActive]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  const isNoisy = currentResult?.prediction === 1;

  // Hitung jumlah LED ticks yang menyala (28 baris)
  const activeTicksCount = Math.round(
    currentResult ? (currentResult.probabilities.berisik * NUM_TICKS) : 0
  );

  const selectedOption = CONSISTENCY_OPTIONS.find(c => c.val === consistencyDuration) || CONSISTENCY_OPTIONS[2];

  // Hitung ambang batas toleransi bergerak
  const minRequiredNoisy = consistencyDuration === 1
    ? 1
    : (consistencyDuration === 4 ? 3 : Math.ceil(consistencyDuration * 0.80));

  // Hitung progres akumulasi bising terhadap batas toleransi konsisten (0 - 100%)
  const progressPct = minRequiredNoisy > 0
    ? Math.min(100, Math.round((windowNoisySeconds / minRequiredNoisy) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* ==============================================================================
          HERO SECTION (Layout okan-test: rt-hero-grid, Grand Title, LED Meter, Instrument Card)
          ============================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
        <div className="rt-hero-grid">
          {/* Kolom Kiri: Status Headline, Grand Title, LED Tick Meter & Metrics */}
          <div className="flex flex-col justify-center">
            {/* Status Pill Indicator */}
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3 w-fit border transition-colors"
                 style={{
                   backgroundColor: !isActive ? '#F1F5F9' : isNoisy ? '#FFF1F2' : '#F0FDFA',
                   color: !isActive ? '#64748B' : isNoisy ? '#BE123C' : '#0F766E',
                   borderColor: !isActive ? '#E2E8F0' : isNoisy ? '#FECDD3' : '#CCFBF1'
                 }}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                !isActive ? 'bg-slate-400' : isNoisy ? 'bg-rose-600 animate-ping' : 'bg-teal-500 animate-pulse'
              }`} />
              <span>
                {!isActive
                  ? 'DETEKSI STANDBY'
                  : isNoisy
                  ? 'PERINGATAN: KONDISI BISING'
                  : 'KONDUSIF (LINGKUNGAN TENANG)'}
              </span>
            </div>

            {/* Grand Title */}
            <h2 className="rt-hero-title">
              {!isActive
                ? 'STANDBY (SIAP MONITORING)'
                : isNoisy
                ? 'PERINGATAN: BERISIK'
                : 'KONDUSIF (NON-BERISIK)'}
            </h2>

            {/* Description */}
            <p className="rt-hero-desc">
              {!isActive
                ? 'Pilih toleransi kebisingan konsisten lalu klik Mulai Monitoring untuk menyalakan deteksi real-time.'
                : currentResult?.status_text || 'Menganalisis sinyal akustik mikrofon secara real-time...'}
            </p>

            {/* Multi-segment LED Bar Meter (28 Ticks) */}
            <div className="rt-bar-meter">
              {Array.from({ length: NUM_TICKS }).map((_, i) => {
                const isLit = isActive && i < activeTicksCount;
                let tickColor = '#E2E8F0'; // idle

                if (isLit) {
                  if (isNoisy) {
                    // Gradasi Rose
                    tickColor = i > NUM_TICKS * 0.7 ? '#E11D48' : '#FB7185';
                  } else {
                    // Gradasi Teal
                    tickColor = i > NUM_TICKS * 0.5 ? '#0D9488' : '#2DD4BF';
                  }
                }

                return (
                  <div
                    key={i}
                    className="rt-bar-tick"
                    style={{
                      backgroundColor: tickColor,
                      transform: isLit ? 'scaleY(1.15)' : 'scaleY(1)'
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

            {/* Key KPI Metrics Row */}
            <div className="rt-hero-metrics">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Keyakinan</div>
                <div className="rt-hero-metric-val">
                  {currentResult ? `${currentResult.confidence.toFixed(1)}%` : '--%'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Toleransi Bergerak</div>
                <div className="rt-hero-metric-val text-teal-700">
                  {consistencyDuration === 1 ? 'Real-Time' : `${consistencyDuration} Detik`}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Intensitas RMS</div>
                <div className="rt-hero-metric-val">
                  {currentResult ? currentResult.rms.toFixed(4) : '--'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Akumulasi Bising</div>
                <div className={`rt-hero-metric-val font-mono ${progressPct >= 70 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {isActive ? `${windowNoisySeconds}s / ${minRequiredNoisy}s` : 'Standby'}
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Instrument Card (Mini Scope, Start/Stop, Dropdown Menu Siklus & Alarm) */}
          <div className="rt-instrument-col">
            <div className="rt-instrument-card p-5 space-y-4">
              {/* Mini Oscilloscope Display (Latar Belakang Putih) */}
              <div className="bg-white rounded-xl p-2.5 overflow-hidden border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 px-1 mb-1 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-teal-600 animate-pulse' : 'bg-slate-400'}`} />
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

              {/* Tombol Utama Mulai / Stop Monitoring */}
              <button
                onClick={isActive ? stopMonitoring : startMonitoring}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2.5 ${
                  isActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 focus:ring-4 focus:ring-rose-200'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 focus:ring-4 focus:ring-teal-200'
                }`}
              >
                <HeroIcon
                  name={isActive ? 'stop' : 'microphone'}
                  className="w-5 h-5 text-white"
                />
                <span>{isActive ? 'Hentikan Pemantauan' : 'Mulai Monitoring Real-Time'}</span>
              </button>

              {/* Toleransi Kebisingan Konsisten */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <HeroIcon name="clock" className="w-3.5 h-3.5 text-teal-600" />
                    <span>Toleransi Kebisingan</span>
                  </label>
                </div>

                <div className="rt-custom-dropdown z-30" ref={dropdownRef}>
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`rt-custom-dropdown-trigger ${isDropdownOpen ? 'open' : ''} ${isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold text-slate-800 text-xs">
                      {selectedOption.label}
                    </span>
                    <HeroIcon
                      name="chevron-down"
                      className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Popover */}
                  {isDropdownOpen && (
                    <div className="rt-custom-dropdown-popover max-h-60 overflow-y-auto overscroll-contain shadow-xl border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 sticky top-0 bg-white border-b border-slate-100">
                        Pilihan Toleransi
                      </div>
                      <div className="space-y-0.5 pr-1 pt-1">
                        {CONSISTENCY_OPTIONS.map((opt) => {
                          const isSelected = consistencyDuration === opt.val;
                          const minReq = opt.val === 1 ? 1 : (opt.val === 4 ? 3 : Math.ceil(opt.val * 0.8));

                          return (
                            <div
                              key={opt.val}
                              onClick={() => {
                                setConsistencyDuration(opt.val);
                                setIsDropdownOpen(false);
                              }}
                              className={`rt-dropdown-item ${isSelected ? 'selected' : ''}`}
                            >
                              <div className="pt-0.5">
                                <div className={`rt-dropdown-radio ${isSelected ? 'active' : ''}`}>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs ${isSelected ? 'font-bold text-teal-800' : 'font-medium text-slate-800'}`}>
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

              {/* Menu Pengaturan Beep Audio & Kustomisasi Durasi */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <HeroIcon name="bell" className="w-3.5 h-3.5 text-teal-600" />
                    <span>Beep Peringatan</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {alarmEnabled && (
                      <div className="flex items-center gap-1" title="Volume">
                        <HeroIcon name="volume-up" className="w-3 h-3 text-slate-400" />
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={alarmVolume}
                          onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                          className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                        />
                      </div>
                    )}
                    {/* Menu Menonaktifkan Beep */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !alarmEnabled;
                        setAlarmEnabled(next);
                        if (!next) alertPlayer.stop();
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors flex items-center gap-1 ${
                        alarmEnabled
                          ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${alarmEnabled ? 'bg-teal-600' : 'bg-slate-400'}`} />
                      <span>{alarmEnabled ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>

                {/* Kustomisasi Durasi Beep (Default: 3 Detik) */}
                {alarmEnabled && (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-medium text-slate-600">Durasi:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          disabled={isActive}
                          onClick={() => setBeepDuration(sec)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                            beepDuration === sec
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-200'
                          } ${isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {sec}s{sec === 3 ? '*' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Kalibrasi Ambien Ruangan */}
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
                    className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin text-teal-600' : 'text-slate-500'}`}
                  />
                  <span>{isCalibrating ? 'Mengukur Ambien...' : 'Kalibrasi Ruangan'}</span>
                </button>

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-600">
                  RMS: <span className="font-bold text-teal-700">{baselineRms.toFixed(4)}</span>
                </div>
              </div>
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
          PERSISTENCE BANNER & PROGRESS TRACK (Jendela Bergerak / Rolling Window)
          ============================================================================== */}
      {isActive && (
        <div className={`rt-persistence-hero-banner ${alarmCooldownSeconds > 0 || progressPct >= 70 ? 'noisy' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                alarmCooldownSeconds > 0
                  ? 'bg-rose-600 animate-ping'
                  : (progressPct >= 70 ? 'bg-amber-500 animate-pulse' : 'bg-teal-600 animate-pulse')
              }`} />
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-800">
                  {alarmCooldownSeconds > 0
                    ? `Peringatan Aktif: Beep Berbunyi (${alarmCooldownSeconds}s)`
                    : `Pemantauan Toleransi Bergerak (${selectedOption.label})`
                  }
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
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                progressPct >= 100
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : (progressPct >= 70 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-teal-800 border-slate-200')
              }`}>
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
                  &bull; Beep berbunyi {beepDuration} detik.
                </span>
              )}
              {' '}Tersimpan otomatis ke Riwayat.
            </div>
          </div>

          <span className="text-[11px] font-mono opacity-70 whitespace-nowrap hidden sm:inline">
            {new Date(lastAlertEvent.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* ==============================================================================
          BENTO GRID CARDS (Reference okan-test: rt-bento-grid, 3 Columns)
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

          {/* Osiloskop Gelombang (Latar Belakang Putih) */}
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

          {/* Equalizer Spektrum (Latar Belakang Putih) */}
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

            {/* Linimasa Canvas (Latar Belakang Putih) */}
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
                {Math.floor(sessionSeconds / 60).toString().padStart(2, '0')}:{(sessionSeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Segmen (4s)</div>
                <div className="text-xl font-bold font-mono text-slate-800 mt-1">{totalChunks}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Rasio Kebisingan</div>
                <div className={`text-xl font-bold font-mono mt-1 ${
                  totalChunks > 0 && (noisyChunks / totalChunks) >= 0.5 ? 'text-rose-600' : 'text-teal-700'
                }`}>
                  {totalChunks > 0 ? `${((noisyChunks / totalChunks) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>

              <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-3">
                <div className="text-[10px] text-teal-700 uppercase font-semibold">Segmen Kondusif</div>
                <div className="text-xl font-bold font-mono text-teal-800 mt-1">{cleanChunks}</div>
              </div>

              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3">
                <div className="text-[10px] text-rose-700 uppercase font-semibold">Segmen Bising</div>
                <div className="text-xl font-bold font-mono text-rose-800 mt-1">{noisyChunks}</div>
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
          DIAGNOSTIC CARD (Reference okan-test: rt-diag-card, 16 Features Breakdown)
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
              className={`w-4 h-4 text-slate-400 transition-transform ${isDiagOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {isDiagOpen && (
          <div className="space-y-4 pt-1">
            {/* 3 Parameter Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">RMS Energy (Intensitas)</span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="\text{RMS}" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? currentResult.rms.toFixed(5) : '--'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Daya fisik sinyal</span>
                  <Latex math="\sqrt{\frac{1}{N}\sum |x|^2}" className="text-[9px] text-slate-500" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Spectral Centroid</span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="f_c" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? `${currentResult.centroid_hz.toFixed(0)} Hz` : '-- Hz'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Titik tengah spektrum</span>
                  <Latex math="\frac{\sum f_k |X_k|}{\sum |X_k|}" className="text-[9px] text-slate-500" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Zero Crossing Rate</span>
                  <span className="text-[10px] text-teal-700 font-serif opacity-80">
                    <Latex math="\text{ZCR}" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-800 mt-1">
                  {currentResult ? currentResult.zcr.toFixed(5) : '--'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Laju desis frekuensi</span>
                  <Latex math="\frac{1}{2N}\sum |\Delta \text{sgn}|" className="text-[9px] text-slate-500" />
                </div>
              </div>
            </div>

            {/* 13 Koefisien MFCC Bar Spectrum */}
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Profil 13 Koefisien Spektral MFCC</span>
                <span className="text-[10px] font-mono text-slate-400">Timbre & Resonansi Mel</span>
              </div>

              {/* Profil 13 MFCC Non-Collapsing Bar Track */}
              <div className="w-full bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 w-full pt-4">
                  {(currentResult?.mfccs && currentResult.mfccs.length === 13 ? currentResult.mfccs : Array(13).fill(0)).map((val, idx) => {
                    const maxAbs = 250;
                    const clamped = Math.max(-maxAbs, Math.min(maxAbs, val));
                    const heightPercent = currentResult
                      ? Math.min(100, Math.max(12, (Math.abs(clamped) / maxAbs) * 100))
                      : 14;
                    const isPositive = val >= 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end min-w-0 group">
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
