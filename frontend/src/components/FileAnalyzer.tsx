import React, { useState, useRef, useEffect } from 'react';
import { HeroIcon } from './HeroIcon';
import { predictFileAudio } from '../services/api';
import type { FileAnalysisResult } from '../services/api';
import type { HistorySession } from './LiveMonitor';

interface FileAnalyzerProps {
  onSaveSession: (session: HistorySession) => void;
  availableSamples: Array<{
    filename: string;
    rel_path: string;
    category: string;
    url: string;
  }>;
}

export const FileAnalyzer: React.FC<FileAnalyzerProps> = ({
  onSaveSession,
  availableSamples,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSampleName, setSelectedSampleName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FileAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Playback State
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);

  // Filter Table
  const [filterStatus, setFilterStatus] = useState<'all' | 'berisik' | 'non-berisik'>('all');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle Upload Berkas
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSelectedSampleName('');
      setAudioSrc(URL.createObjectURL(file));
      setAnalysisResult(null);
      setErrorMessage(null);
      setSelectedSegmentIdx(null);
    }
  };

  // Handle Pilih Sampel Bawaan
  const handleSelectSample = (filename: string, url: string) => {
    setSelectedSampleName(filename);
    setSelectedFile(null);
    setAudioSrc(url);
    setAnalysisResult(null);
    setErrorMessage(null);
    setSelectedSegmentIdx(null);
  };

  // Jalankan Analisis
  const runAnalysis = async () => {
    if (!selectedFile && !selectedSampleName) {
      setErrorMessage('Pilih berkas audio atau sampel bawaan terlebih dahulu.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await predictFileAudio(
        selectedFile || undefined,
        selectedSampleName || undefined
      );
      setAnalysisResult(result);
      setSelectedSegmentIdx(result.segments.length > 0 ? 1 : null);

      // Simpan ke riwayat
      const session: HistorySession = {
        id: `file_${Date.now()}`,
        type: 'file',
        timestamp: Date.now(),
        duration_s: result.duration_s,
        total_segments: result.n_segments,
        noisy_segments: result.noisy_segments,
        clean_segments: result.clean_segments,
        noisy_percentage: result.noisy_percentage,
        dominant_label: result.overall_label,
        avg_confidence: result.overall_confidence,
        filename: result.filename,
      };
      onSaveSession(session);
    } catch (err) {
      setErrorMessage(`Gagal menganalisis berkas: ${String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play / Pause Audio
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  // Seek audio ke waktu tertentu
  const seekToTime = (timeInSec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = timeInSec;
    setCurrentTime(timeInSec);
  };

  // Update Audio Time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioSrc]);

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !analysisResult || !analysisResult.waveform) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    const waveform = analysisResult.waveform;
    const nPoints = waveform.length;
    const sliceWidth = w / nPoints;

    // Gambar background garis tengah
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Gambar segmen-segmen dengan latar belakang warna
    const totalDuration = analysisResult.duration_s;
    if (totalDuration > 0 && analysisResult.segments) {
      analysisResult.segments.forEach((seg) => {
        const segStartX = (seg.start_s / totalDuration) * w;
        const segEndX = (seg.end_s / totalDuration) * w;
        const segWidth = segEndX - segStartX;

        ctx.fillStyle = seg.prediction === 1 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(20, 184, 166, 0.12)';
        ctx.fillRect(segStartX, 0, segWidth, h);

        // Garis pemisah segmen
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(segStartX, 0);
        ctx.lineTo(segStartX, h);
        ctx.stroke();
      });
    }

    // Gambar amplitudo waveform
    ctx.fillStyle = '#0D9488';
    for (let i = 0; i < nPoints; i++) {
      const v = Math.abs(waveform[i]);
      const barHeight = Math.max(2, v * h * 0.9);
      const x = i * sliceWidth;
      const y = (h - barHeight) / 2;
      ctx.fillRect(x, y, Math.max(1, sliceWidth - 0.5), barHeight);
    }

    // Gambar kursor playback saat audio diputar
    if (duration > 0) {
      const cursorX = (currentTime / duration) * w;
      ctx.strokeStyle = '#BE123C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, h);
      ctx.stroke();
    }
  }, [analysisResult, currentTime, duration]);

  // Ekspor Tabel ke CSV
  const exportToCSV = () => {
    if (!analysisResult) return;
    const headers = [
      'Segment',
      'Rentang Waktu',
      'Status',
      'Confidence (%)',
      'RMS',
      'Spectral Centroid (Hz)',
      'ZCR',
      ...Array.from({ length: 13 }, (_, i) => `MFCC_${i + 1}`)
    ];

    const rows = analysisResult.segments.map((seg) => [
      seg.segment_idx,
      `"${seg.time_range}"`,
      seg.status,
      seg.confidence.toFixed(2),
      seg.rms.toFixed(6),
      seg.centroid.toFixed(2),
      seg.zcr.toFixed(6),
      ...seg.mfccs.map(m => m.toFixed(4))
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analisis_${analysisResult.filename.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedSegmentData = analysisResult?.segments.find(s => s.segment_idx === selectedSegmentIdx);
  const isOverallNoisy = analysisResult?.overall_label === 'berisik';

  const filteredSegments = analysisResult?.segments.filter(s => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Upload & Sample Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <HeroIcon name="upload" className="w-5 h-5 text-teal-600" />
          <span>Unggah Berkas Audio atau Gunakan Sampel Uji</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Zona Drag & Drop Upload */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-teal-50/20"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".mp3,.wav,audio/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-3">
              <HeroIcon name="upload" className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {selectedFile ? selectedFile.name : 'Klik untuk Mengunggah Berkas Audio'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Mendukung format WAV dan MP3 (Otomatis di-resample ke 22.050 Hz)
            </div>
            {selectedFile && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full font-medium">
                <HeroIcon name="check-circle" className="w-3.5 h-3.5" />
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </div>

          {/* Pemilihan Sampel Bawaan */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <HeroIcon name="folder" className="w-4 h-4 text-teal-600" />
              <span>Sampel Audio Bawaan Proyek</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableSamples.map((sample) => {
                const isSelected = selectedSampleName === sample.filename;
                const isBerisik = sample.category.toLowerCase().includes('berisik') && !sample.category.toLowerCase().includes('non');
                return (
                  <button
                    key={sample.filename}
                    onClick={() => handleSelectSample(sample.filename, sample.url)}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                        isBerisik ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {sample.category}
                      </span>
                      {isSelected && <HeroIcon name="check-circle" className="w-3.5 h-3.5 text-teal-600" />}
                    </div>
                    <div className="font-mono text-slate-800 truncate" title={sample.filename}>
                      {sample.filename}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tombol Eksekusi Analisis */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-500">
            {selectedFile || selectedSampleName ? (
              <span className="text-teal-700 font-medium">
                Audio terpilih: <span className="font-mono">{selectedFile?.name || selectedSampleName}</span>
              </span>
            ) : (
              'Silakan pilih audio untuk memulai analisis.'
            )}
          </div>

          <button
            onClick={runAnalysis}
            disabled={(!selectedFile && !selectedSampleName) || isAnalyzing}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm focus:ring-4 focus:ring-teal-200"
          >
            <HeroIcon
              name={isAnalyzing ? 'arrow-path' : 'play'}
              className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`}
            />
            <span>{isAnalyzing ? 'Mengekstrak 16 Fitur PSD...' : 'Mulai Analisis Audio'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <HeroIcon name="exclamation-triangle" className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Audio Player & Waveform Timeline Display */}
      {audioSrc && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayPause}
                className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors shadow-sm"
              >
                <HeroIcon name={isPlaying ? 'pause' : 'play'} className="w-5 h-5 ml-0.5" />
              </button>
              <div>
                <div className="text-xs font-semibold text-slate-800">Pemutar Audio Sinkron</div>
                <div className="text-xs font-mono text-slate-500">
                  {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Hidden native audio element */}
            <audio ref={audioRef} src={audioSrc} preload="auto" />

            {/* Seek Bar Slider */}
            <div className="flex-1 max-w-md flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">0s</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => seekToTime(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <span className="text-[10px] font-mono text-slate-400">{duration.toFixed(0)}s</span>
            </div>
          </div>

          {/* Canvas Waveform & Segment Block Overlays */}
          {analysisResult && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">Linimasa Gelombang & Blok Segmen 4.0 Detik:</span>
                <span className="text-[11px] text-slate-500">
                  Klik blok segmen untuk lompat ke durasi audio
                </span>
              </div>

              {/* Canvas Waveform (Latar Belakang Putih) */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 overflow-hidden shadow-sm">
                <canvas
                  ref={waveformCanvasRef}
                  width={900}
                  height={100}
                  className="w-full h-24 block bg-white"
                />
              </div>

              {/* Segment Pill Selector Bar */}
              <div className="flex gap-1.5 overflow-x-auto py-2">
                {analysisResult.segments.map((seg) => {
                  const isSelected = selectedSegmentIdx === seg.segment_idx;
                  const isSegNoisy = seg.prediction === 1;
                  return (
                    <button
                      key={seg.segment_idx}
                      onClick={() => {
                        setSelectedSegmentIdx(seg.segment_idx);
                        seekToTime(seg.start_s);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? isSegNoisy
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                            : 'bg-teal-600 text-white border-teal-700 shadow-sm'
                          : isSegNoisy
                          ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      <span className="font-bold">#{seg.segment_idx}</span>
                      <span className="opacity-80">({seg.time_range})</span>
                      <HeroIcon
                        name={isSegNoisy ? 'exclamation-triangle' : 'check-circle'}
                        className="w-3.5 h-3.5 ml-0.5"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hasil Analisis Mendalam */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className={`rounded-xl border p-6 shadow-sm transition-all ${
            isOverallNoisy
              ? 'bg-rose-50/80 border-rose-300'
              : 'bg-teal-50/80 border-teal-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Diagnosis Keseluruhan Berkas Audio
                </div>
                <h3 className={`text-2xl sm:text-3xl font-extrabold ${
                  isOverallNoisy ? 'text-rose-700' : 'text-teal-800'
                }`}>
                  {isOverallNoisy ? 'PERINGATAN: DIDOMINASI SUARA BERISIK' : 'KONDUSIF: DIDOMINASI NON-BERISIK'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Berkas <span className="font-mono font-semibold">{analysisResult.filename}</span> berdurasi{' '}
                  <span className="font-semibold">{analysisResult.duration_s} detik</span>, dibagi menjadi{' '}
                  <span className="font-semibold">{analysisResult.n_segments} segmen</span> berturutan 4.0 detik.
                </p>
              </div>

              {/* Confidence Score Pill */}
              <div className="bg-white/95 border border-slate-200 rounded-xl p-4 shadow-sm min-w-[200px] text-right">
                <div className="text-[11px] font-medium text-slate-500">Persentase Kebisingan</div>
                <div className={`text-3xl font-bold font-mono ${isOverallNoisy ? 'text-rose-600' : 'text-teal-700'}`}>
                  {analysisResult.noisy_percentage.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {analysisResult.noisy_segments} Berisik / {analysisResult.clean_segments} Kondusif
                </div>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-200/60">
              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Rata-rata RMS</div>
                <div className="text-base font-bold font-mono text-slate-800">{analysisResult.avg_rms.toFixed(5)}</div>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Rata-rata Centroid</div>
                <div className="text-base font-bold font-mono text-slate-800">{analysisResult.avg_centroid.toFixed(0)} Hz</div>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Rata-rata ZCR</div>
                <div className="text-base font-bold font-mono text-slate-800">{analysisResult.avg_zcr.toFixed(5)}</div>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Total Durasi</div>
                <div className="text-base font-bold font-mono text-slate-800">{analysisResult.duration_s.toFixed(1)}s</div>
              </div>
            </div>
          </div>

          {/* Inspeksi Segmen Terpilih (13 MFCC Profil Spektral) */}
          {selectedSegmentData && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <HeroIcon name="chart-bar" className="w-5 h-5 text-teal-600" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Profil 13 Koefisien MFCC Segmen #{selectedSegmentData.segment_idx} ({selectedSegmentData.time_range})
                  </h4>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  selectedSegmentData.prediction === 1
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  Status: {selectedSegmentData.status.toUpperCase()} ({selectedSegmentData.confidence.toFixed(1)}%)
                </span>
              </div>

              {/* Profil 13 MFCC Non-Collapsing Bar Track */}
              <div className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-36 w-full pt-4">
                  {selectedSegmentData.mfccs.map((val, idx) => {
                    const maxAbs = 250;
                    const clamped = Math.max(-maxAbs, Math.min(maxAbs, val));
                    const heightPercent = Math.min(100, Math.max(12, (Math.abs(clamped) / maxAbs) * 100));
                    const isPositive = val >= 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end min-w-0 group">
                        <span className="text-[9px] font-mono font-medium text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                          {val.toFixed(1)}
                        </span>
                        <div className="w-full flex-1 flex items-end justify-center">
                          <div
                            className={`w-full max-w-[32px] rounded-t transition-all duration-200 ${
                              isPositive ? 'bg-teal-600 group-hover:bg-teal-700 shadow-sm' : 'bg-rose-500 group-hover:bg-rose-600 shadow-sm'
                            }`}
                            style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-600 mt-1.5">C{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Keterangan: C1 merefleksikan daya spektral makro; C2–C13 merepresentasikan amplop resonansi timbre suara.
              </div>
            </div>
          )}

          {/* Tabel Lengkap 16 Fitur Akustik Segmen */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <HeroIcon name="table-cells" className="w-5 h-5 text-teal-600" />
                  <span>Matriks 16 Fitur Akustik per Segmen (4.0 Detik)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Setiap baris merupakan 16 parameter akustik yang diumpankan ke model WKNN.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Semua ({analysisResult.n_segments})
                  </button>
                  <button
                    onClick={() => setFilterStatus('berisik')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      filterStatus === 'berisik' ? 'bg-rose-100 text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    Berisik ({analysisResult.noisy_segments})
                  </button>
                  <button
                    onClick={() => setFilterStatus('non-berisik')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      filterStatus === 'non-berisik' ? 'bg-teal-100 text-teal-800' : 'text-slate-600'
                    }`}
                  >
                    Kondusif ({analysisResult.clean_segments})
                  </button>
                </div>

                <button
                  onClick={exportToCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <HeroIcon name="arrow-down-tray" className="w-4 h-4 text-teal-600" />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Segmen</th>
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Prediksi</th>
                    <th className="py-2.5 px-3">Keyakinan</th>
                    <th className="py-2.5 px-3">RMS</th>
                    <th className="py-2.5 px-3">Centroid (Hz)</th>
                    <th className="py-2.5 px-3">ZCR</th>
                    <th className="py-2.5 px-3">MFCC 1..3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredSegments.map((seg) => {
                    const isSelected = selectedSegmentIdx === seg.segment_idx;
                    const isNoisy = seg.prediction === 1;
                    return (
                      <tr
                        key={seg.segment_idx}
                        onClick={() => {
                          setSelectedSegmentIdx(seg.segment_idx);
                          seekToTime(seg.start_s);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-800">#{seg.segment_idx}</td>
                        <td className="py-2 px-3 text-slate-600">{seg.time_range}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isNoisy ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-800'
                          }`}>
                            <HeroIcon name={isNoisy ? 'exclamation-triangle' : 'check-circle'} className="w-3 h-3" />
                            <span>{seg.status}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-800">{seg.confidence.toFixed(1)}%</td>
                        <td className="py-2 px-3 text-slate-700">{seg.rms.toFixed(5)}</td>
                        <td className="py-2 px-3 text-slate-700">{seg.centroid.toFixed(0)}</td>
                        <td className="py-2 px-3 text-slate-700">{seg.zcr.toFixed(5)}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          [{seg.mfccs.slice(0, 3).map(m => m.toFixed(1)).join(', ')}]
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
