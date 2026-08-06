/** Tiny synthesized SFX via WebAudio — no external assets. */
class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slide = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private thud(dur: number, gain: number, delay = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  unlock() { this.ensure(); }
  select() { this.tone(560, 0.09, 'triangle', 0.08); }
  error() { this.tone(220, 0.12, 'sawtooth', 0.06); this.tone(160, 0.16, 'square', 0.05, 0.06); }
  move() { this.thud(0.12, 0.5); this.tone(150, 0.1, 'sine', 0.16, 0, -60); }
  capture() { this.thud(0.2, 0.8); this.tone(90, 0.22, 'sine', 0.22, 0, -40); this.tone(1400, 0.12, 'triangle', 0.05, 0.02, -700); }
  check() { this.tone(660, 0.12, 'triangle', 0.1); this.tone(880, 0.16, 'triangle', 0.1, 0.1); }
  start() { this.tone(330, 0.16, 'triangle', 0.09); this.tone(495, 0.2, 'triangle', 0.09, 0.12); }
  over(win: boolean) {
    if (win) { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.09, i * 0.12)); }
    else { [330, 311, 262].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.09, i * 0.15)); }
  }
}

export const sfx = new Sfx();
