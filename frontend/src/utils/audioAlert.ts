/**
 * Utilitas pemutaran audio alert / alarm menggunakan berkas alert.mpeg.
 * Memanfaatkan Web Audio API (AudioBuffer) dengan fallback HTML5 Audio Element.
 */

class AlertAudioPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private stopTimeout: number | null = null;
  private audioDuration = 3.06; // Durasi default alert.mpeg

  constructor() {
    this.preloadAlert();
  }

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Preload berkas alert.mpeg ke memori sebagai AudioBuffer untuk latensi nol.
   */
  public async preloadAlert(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const resp = await fetch('/alert.mpeg');
      if (!resp.ok) {
        throw new Error(`HTTP error ${resp.status}`);
      }
      const arrayBuf = await resp.arrayBuffer();
      const ctx = this.getContext();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      this.audioBuffer = decoded;
      this.audioDuration = decoded.duration;
    } catch {
      // Fallback ke HTMLAudioElement jika decodeAudioData gagal
      if (typeof Audio !== 'undefined') {
        this.fallbackAudio = new Audio('/alert.mpeg');
        this.fallbackAudio.preload = 'auto';
        this.fallbackAudio.addEventListener('loadedmetadata', () => {
          if (this.fallbackAudio && this.fallbackAudio.duration) {
            this.audioDuration = this.fallbackAudio.duration;
          }
        });
      }
    }
  }

  public getDuration(): number {
    return this.audioDuration;
  }

  /**
   * Putar audio alarm peringatan menggunakan file alert.mpeg.
   */
  public playAlert(volume: number = 0.7): number {
    if (this.isPlaying) {
      this.stop();
    }

    try {
      this.isPlaying = true;
      const targetDuration = this.audioDuration;

      // 1. Coba via Web Audio API AudioBufferSourceNode (latensi instan)
      if (this.audioBuffer) {
        const ctx = this.getContext();
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();

        source.buffer = this.audioBuffer;
        gain.gain.setValueAtTime(Math.max(0.01, Math.min(1.0, volume)), ctx.currentTime);

        source.connect(gain);
        gain.connect(ctx.destination);

        this.activeSource = source;
        this.activeGain = gain;

        source.onended = () => {
          this.isPlaying = false;
        };

        source.start(0);

        this.stopTimeout = window.setTimeout(() => {
          this.stop();
        }, (targetDuration + 0.1) * 1000);

        return targetDuration;
      }

      // 2. Fallback via HTMLAudioElement
      if (!this.fallbackAudio && typeof Audio !== 'undefined') {
        this.fallbackAudio = new Audio('/alert.mpeg');
      }

      if (this.fallbackAudio) {
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.volume = Math.max(0.01, Math.min(1.0, volume));
        this.fallbackAudio.play().catch(() => {});
        this.fallbackAudio.onended = () => {
          this.isPlaying = false;
        };

        this.stopTimeout = window.setTimeout(() => {
          this.stop();
        }, (targetDuration + 0.1) * 1000);

        return targetDuration;
      }
    } catch {
      this.isPlaying = false;
    }

    return this.audioDuration;
  }

  /**
   * Alias kompatibilitas
   */
  public playLongBeep(_durationSec?: number, volume: number = 0.7): number {
    return this.playAlert(volume);
  }

  public playWarning(volume: number = 0.5): number {
    return this.playAlert(volume);
  }

  public playCycleAlarm(_durationSec?: number, volume: number = 0.7): number {
    return this.playAlert(volume);
  }

  /**
   * Hentikan suara alert seketika.
   */
  public stop() {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {}
      this.activeGain = null;
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
      } catch {}
    }
    this.isPlaying = false;
  }
}

export const alertPlayer = new AlertAudioPlayer();
