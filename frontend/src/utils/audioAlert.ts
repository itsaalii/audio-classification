/**
 * Utilitas sintesis audio alert / alarm menggunakan Web Audio API.
 * Menghasilkan nada peringatan jernih tanpa memerlukan unduhan berkas audio eksternal.
 */

class AlertAudioPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private activeOsc: OscillatorNode | null = null;
  private activeGain: GainNode | null = null;
  private stopTimeout: number | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Bunyikan nada peringatan singkat.
   */
  public playWarning(volume: number = 0.5) {
    if (this.isPlaying) return;
    try {
      const ctx = this.getContext();
      this.isPlaying = true;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);

      gain.gain.setValueAtTime(volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);

      setTimeout(() => {
        this.isPlaying = false;
      }, 500);
    } catch {
      this.isPlaying = false;
    }
  }

  /**
   * Bunyikan nada beep panjang kontinu tanpa putus-putus.
   * Default durasi 3.0 detik, frekuensi konstan 880 Hz.
   */
  public playLongBeep(durationSec: number = 3.0, volume: number = 0.7) {
    if (this.isPlaying) {
      this.stop();
    }
    try {
      const ctx = this.getContext();
      this.isPlaying = true;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      this.activeOsc = osc;
      this.activeGain = gain;

      // Gelombang sinus murni kontinu tanpa modulasi atau jeda pulsa
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      const targetGain = Math.max(0.01, Math.min(1.0, volume * 0.45));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
      gain.gain.setValueAtTime(targetGain, now + Math.max(0.05, durationSec - 0.05));
      gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec);

      this.stopTimeout = window.setTimeout(() => {
        this.stop();
      }, durationSec * 1000);
    } catch {
      this.isPlaying = false;
    }
  }

  public playCycleAlarm(durationSec: number = 3.0, volume: number = 0.7) {
    this.playLongBeep(durationSec, volume);
  }

  /**
   * Hentikan beep yang sedang berbunyi seketika.
   */
  public stop() {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.activeOsc) {
      try {
        this.activeOsc.stop();
        this.activeOsc.disconnect();
      } catch {}
      this.activeOsc = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {}
      this.activeGain = null;
    }
    this.isPlaying = false;
  }
}

export const alertPlayer = new AlertAudioPlayer();

