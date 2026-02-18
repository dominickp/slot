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
    this.soundAssetMap = {};
    this.soundAssetTemplates = new Map();
    this.soundAssetStatus = new Map();
    this.soundAssetImmediateAttempted = new Set();
    this.backgroundMusic = null;
    this.backgroundMusicPath = null;
    this.backgroundMusicVolumeScale = 0.35;
    this.backgroundMusicMuted = false;
    this.backgroundMusicPathStatus = new Map();
  }

  setSoundAssetMap(assetMap = {}) {
    this.soundAssetMap = { ...assetMap };
    this.soundAssetTemplates.clear();
    this.soundAssetStatus.clear();
    this.soundAssetImmediateAttempted.clear();
    this.backgroundMusicPathStatus.clear();
    this._stopBackgroundMusic();

    for (const [key, rawPath] of Object.entries(this.soundAssetMap)) {
      const assetPath = String(rawPath || "").trim();
      if (!assetPath || key === "bg-music") {
        continue;
      }
      this._primeSoundAsset(key, assetPath);
    }
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

  _playAsset(key) {
    if (!this.enabled) {
      return false;
    }

    const assetPath = this.soundAssetMap?.[key];
    if (typeof assetPath !== "string" || assetPath.trim().length === 0) {
      return false;
    }

    const status = this.soundAssetStatus.get(key);
    if (status === "error") {
      return false;
    }

    if (status !== "ready") {
      this._primeSoundAsset(key, assetPath);

      if (!this.soundAssetImmediateAttempted.has(key)) {
        this.soundAssetImmediateAttempted.add(key);
        try {
          const immediate = new Audio(assetPath);
          immediate.volume = Math.max(0, Math.min(1, this.volume));
          immediate.play().catch(() => {});
          return true;
        } catch {
          return false;
        }
      }

      return false;
    }

    try {
      let template = this.soundAssetTemplates.get(key);
      if (!template) {
        return false;
      }

      const player = template.cloneNode();
      player.volume = Math.max(0, Math.min(1, this.volume));
      player.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  _primeSoundAsset(key, assetPath) {
    if (this.soundAssetStatus.has(key)) {
      return;
    }

    try {
      const audio = new Audio(assetPath);
      audio.preload = "auto";
      this.soundAssetStatus.set(key, "loading");

      const markReady = () => {
        this.soundAssetStatus.set(key, "ready");
        this.soundAssetTemplates.set(key, audio);
        audio.removeEventListener("canplaythrough", markReady);
        audio.removeEventListener("error", markError);
      };

      const markError = () => {
        this.soundAssetStatus.set(key, "error");
        audio.removeEventListener("canplaythrough", markReady);
        audio.removeEventListener("error", markError);
      };

      audio.addEventListener("canplaythrough", markReady, { once: true });
      audio.addEventListener("error", markError, { once: true });
      audio.load();
    } catch {
      this.soundAssetStatus.set(key, "error");
    }
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

  setBackgroundMusicVolumeScale(scale) {
    const numeric = Number(scale);
    this.backgroundMusicVolumeScale = Number.isFinite(numeric)
      ? Math.max(0, Math.min(1, numeric))
      : 0.35;
    this._syncBackgroundMusicVolume();
  }

  setBackgroundMusicMuted(muted) {
    this.backgroundMusicMuted = Boolean(muted);
    this._syncBackgroundMusicVolume();

    if (this.backgroundMusicMuted) {
      this._stopBackgroundMusic();
      return;
    }

    this._startBackgroundMusicIfAvailable();
  }

  async ensureReady() {
    if (!this.enabled) return false;
    await this.init();
    if (!this.audioContext) return false;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this._startBackgroundMusicIfAvailable();

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
      if (this._playAsset("button")) {
        return;
      }
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
      if (this._playAsset("spin-start")) {
        return;
      }
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
      if (this._playAsset("cascade")) {
        return;
      }
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
      if (this._playAsset("win")) {
        return;
      }
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
      if (this._playAsset("bonus-start")) {
        return;
      }
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
      if (this._playAsset("free-spin-start")) {
        return;
      }
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
      if (this._playAsset("rainbow")) {
        return;
      }
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

  playCloverMultiply() {
    this._playHookOrFallback("clover-multiply", () => {
      if (this._playAsset("clover-multiply")) {
        return;
      }
      this.playTone({
        frequency: 720,
        type: "triangle",
        duration: 0.08,
        volume: 0.12,
      });
      this.playTone({
        frequency: 980,
        type: "triangle",
        duration: 0.11,
        volume: 0.1,
        delay: 0.045,
      });
    });
  }

  playCollectorCollect() {
    this._playHookOrFallback("collector-collect", () => {
      if (this._playAsset("collector-collect")) {
        return;
      }
      this.playTone({
        frequency: 220,
        type: "sawtooth",
        duration: 0.08,
        volume: 0.14,
        sweepTo: 180,
      });
      this.playTone({
        frequency: 300,
        type: "square",
        duration: 0.09,
        volume: 0.1,
        delay: 0.03,
      });
    });
  }

  playCollectorPop() {
    this._playHookOrFallback("collector-pop", () => {
      if (this._playAsset("collector-pop")) {
        return;
      }
      this.playTone({
        frequency: 420,
        type: "triangle",
        duration: 0.045,
        volume: 0.09,
        sweepTo: 360,
      });
    });
  }

  playBigWin() {
    this._playHookOrFallback("big-win", () => {
      if (this._playAsset("big-win")) {
        return;
      }
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

  playBonusCountTick(current = 0, target = 0) {
    this._playHookOrFallback("bonus-count-tick", () => {
      if (this._playAsset("bonus-count-tick")) {
        return;
      }

      const progress = target > 0 ? Math.min(1, current / target) : 0;
      const frequency = 440 + progress * 240;

      this.playTone({
        frequency,
        type: "triangle",
        duration: 0.03,
        volume: 0.05,
      });
    });
  }

  playBonusTierUp() {
    this._playHookOrFallback("bonus-tier-up", () => {
      if (this._playAsset("bonus-tier-up")) {
        return;
      }

      this.playTone({
        frequency: 540,
        type: "triangle",
        duration: 0.08,
        volume: 0.11,
      });
      this.playTone({
        frequency: 760,
        type: "triangle",
        duration: 0.11,
        volume: 0.1,
        delay: 0.04,
      });
    });
  }

  _volumeToGain(volume) {
    // Square curve gives better low-volume control while allowing louder output at top end.
    return Math.max(0.0001, Math.pow(volume, 2) * 0.8);
  }

  _applyMasterGain() {
    if (!this.masterGain) {
      this._syncBackgroundMusicVolume();
      return;
    }

    const targetGain = this.enabled ? this._volumeToGain(this.volume) : 0.0001;
    this.masterGain.gain.value = targetGain;
    this._syncBackgroundMusicVolume();

    if (!this.enabled) {
      this._stopBackgroundMusic();
      return;
    }

    this._startBackgroundMusicIfAvailable();
  }

  _startBackgroundMusicIfAvailable() {
    if (!this.enabled || this.backgroundMusicMuted) {
      return;
    }

    const musicPath = this.soundAssetMap?.["bg-music"];
    if (typeof musicPath !== "string" || musicPath.trim().length === 0) {
      return;
    }

    const pathStatus = this.backgroundMusicPathStatus.get(musicPath);
    if (pathStatus === "invalid") {
      return;
    }

    if (!pathStatus) {
      this.backgroundMusicPathStatus.set(musicPath, "checking");
      this._probeAudioPath(musicPath).then((isValid) => {
        this.backgroundMusicPathStatus.set(
          musicPath,
          isValid ? "valid" : "invalid",
        );

        if (!isValid && this.backgroundMusicPath === musicPath) {
          this._stopBackgroundMusic();
          this.backgroundMusic = null;
          this.backgroundMusicPath = null;
        }
      });
    }

    if (!this.backgroundMusic || this.backgroundMusicPath !== musicPath) {
      this._stopBackgroundMusic();
      this.backgroundMusic = new Audio(musicPath);
      this.backgroundMusicPath = musicPath;
      this.backgroundMusic.loop = true;
      this.backgroundMusic.preload = "auto";
      this._syncBackgroundMusicVolume();
    }

    if (this.backgroundMusic.paused) {
      this.backgroundMusic.play().catch(() => {});
    }
  }

  async _probeAudioPath(path) {
    if (typeof fetch !== "function") {
      return true;
    }

    try {
      let response = await fetch(path, { method: "HEAD" });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(path, { method: "GET" });
      }

      if (!response.ok) {
        return false;
      }

      const contentType = String(response.headers.get("content-type") || "")
        .toLowerCase()
        .trim();
      if (!contentType) {
        return true;
      }

      return contentType.startsWith("audio/");
    } catch {
      return false;
    }
  }

  _stopBackgroundMusic() {
    if (!this.backgroundMusic) {
      return;
    }

    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
  }

  _syncBackgroundMusicVolume() {
    if (!this.backgroundMusic) {
      return;
    }

    const target =
      this.enabled && !this.backgroundMusicMuted
        ? Math.max(
            0,
            Math.min(1, this.volume * this.backgroundMusicVolumeScale),
          )
        : 0;
    this.backgroundMusic.volume = target;
  }
}

export default SoundManager;
