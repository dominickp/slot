/**
 * SoundManager
 * Placeholder synthesized SFX using Web Audio API.
 * No external audio files required.
 */

export class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.masterGain = null;
    this.volume = 0.75;
    this.soundHooks = new Map();
  }

  setSoundHook(key, handler) {
    if (typeof handler === "function") {
      this.soundHooks.set(key, handler);
      return;
    }

    this.soundHooks.delete(key);
  }

  _playHookOrFallback(key, fallback) {
    const hook = this.soundHooks.get(key);
    if (typeof hook === "function") {
      hook();
      return;
    }

    fallback();
  }

  async init() {
    if (this.audioContext) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    this.audioContext = new Ctx();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this._volumeToGain(this.volume);
    this.masterGain.connect(this.audioContext.destination);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this._applyMasterGain();
  }

  setVolume(volume) {
    const nextVolume = Number.isFinite(volume) ? volume : this.volume;
    this.volume = Math.max(0, Math.min(1, nextVolume));
    this._applyMasterGain();
  }

  async ensureReady() {
    if (!this.enabled) return false;
    await this.init();
    if (!this.audioContext) return false;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return true;
  }

  async playTone({
    frequency,
    type = "sine",
    duration = 0.1,
    volume = 0.2,
    delay = 0,
    sweepTo = null,
  }) {
    const ready = await this.ensureReady();
    if (!ready) return;

    const now = this.audioContext.currentTime + delay;

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (sweepTo) {
      oscillator.frequency.exponentialRampToValueAtTime(
        sweepTo,
        now + duration,
      );
    }

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  playButton() {
    this._playHookOrFallback("button", () => {
      this.playTone({
        frequency: 420,
        type: "triangle",
        duration: 0.06,
        volume: 0.12,
      });
    });
  }

  playSpinStart() {
    this._playHookOrFallback("spin-start", () => {
      this.playTone({
        frequency: 196,
        type: "sawtooth",
        duration: 0.24,
        volume: 0.14,
        sweepTo: 140,
      });
    });
  }

  playCascade() {
    this._playHookOrFallback("cascade", () => {
      this.playTone({
        frequency: 300,
        type: "square",
        duration: 0.08,
        volume: 0.1,
      });
      this.playTone({
        frequency: 360,
        type: "square",
        duration: 0.08,
        volume: 0.08,
        delay: 0.045,
      });
    });
  }

  playWin(winAmount = 0) {
    this._playHookOrFallback("win", () => {
      const boost = Math.min(1.5, 1 + winAmount / 100);
      this.playTone({
        frequency: 520 * boost,
        type: "triangle",
        duration: 0.16,
        volume: 0.16,
      });
      this.playTone({
        frequency: 660 * boost,
        type: "triangle",
        duration: 0.18,
        volume: 0.14,
        delay: 0.07,
      });
      this.playTone({
        frequency: 780 * boost,
        type: "triangle",
        duration: 0.2,
        volume: 0.12,
        delay: 0.15,
      });
    });
  }

  playBonus() {
    this._playHookOrFallback("bonus-start", () => {
      this.playTone({
        frequency: 440,
        type: "sawtooth",
        duration: 0.12,
        volume: 0.16,
      });
      this.playTone({
        frequency: 660,
        type: "sawtooth",
        duration: 0.16,
        volume: 0.16,
        delay: 0.07,
      });
      this.playTone({
        frequency: 880,
        type: "sawtooth",
        duration: 0.2,
        volume: 0.14,
        delay: 0.15,
      });
    });
  }

  playFreeSpinStart(index = 1) {
    this._playHookOrFallback("free-spin-start", () => {
      const base = 350 + Math.min(index, 8) * 15;
      this.playTone({
        frequency: base,
        type: "square",
        duration: 0.08,
        volume: 0.1,
      });
    });
  }

  playRainbow() {
    this._playHookOrFallback("rainbow", () => {
      this.playTone({
        frequency: 500,
        type: "triangle",
        duration: 0.12,
        volume: 0.14,
      });
      this.playTone({
        frequency: 740,
        type: "triangle",
        duration: 0.14,
        volume: 0.13,
        delay: 0.06,
      });
      this.playTone({
        frequency: 980,
        type: "triangle",
        duration: 0.18,
        volume: 0.12,
        delay: 0.12,
      });
    });
  }

  playBigWin() {
    this._playHookOrFallback("big-win", () => {
      this.playTone({
        frequency: 392,
        type: "sawtooth",
        duration: 0.18,
        volume: 0.16,
      });
      this.playTone({
        frequency: 523,
        type: "sawtooth",
        duration: 0.2,
        volume: 0.16,
        delay: 0.08,
      });
      this.playTone({
        frequency: 784,
        type: "sawtooth",
        duration: 0.22,
        volume: 0.14,
        delay: 0.16,
      });
    });
  }

  _volumeToGain(volume) {
    // Square curve gives better low-volume control while allowing louder output at top end.
    return Math.max(0.0001, Math.pow(volume, 2) * 0.8);
  }

  _applyMasterGain() {
    if (!this.masterGain) {
      return;
    }

    const targetGain = this.enabled ? this._volumeToGain(this.volume) : 0.0001;
    this.masterGain.gain.value = targetGain;
  }
}

export default SoundManager;
