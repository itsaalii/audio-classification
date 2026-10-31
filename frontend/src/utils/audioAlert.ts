/**
 * Utilitas sintesis audio alert / alarm menggunakan Web Audio API.
 * Menghasilkan nada peringatan jernih tanpa memerlukan unduhan berkas audio eksternal.
 */

class AlertAudioPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;

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
   * Bunyikan nada peringatan berisik (dua nada menurun 880Hz -> 660Hz).
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
   * Bunyikan alarm siklus berisik selama durasi tertentu (3 detik).
   */
  public playCycleAlarm(durationSec: number = 3.0, volume: number = 0.7) {
    if (this.isPlaying) return;
    try {
      const ctx = this.getContext();
      this.isPlaying = true;

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.5, now);
      gain.connect(ctx.destination);

      const interval = 0.25;
      const pulseCount = Math.floor(durationSec / interval);

      for (let i = 0; i < pulseCount; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const freq = i % 2 === 0 ? 1100 : 880;
        const startTime = now + i * interval;
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(gain);
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      }

      setTimeout(() => {
        this.isPlaying = false;
      }, durationSec * 1000);
    } catch {
      this.isPlaying = false;
    }
  }

  /**
   * Hentikan status alarm yang sedang berbunyi.
   */
  public stop() {
    this.isPlaying = false;
  }
}

export const alertPlayer = new AlertAudioPlayer();

