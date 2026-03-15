import { jest } from "@jest/globals";

import { SoundManager } from "./soundManager.js";

function createFakeAudioPlayer() {
  const listeners = new Map();

  return {
    volume: 1,
    currentTime: 0,
    play: jest.fn().mockResolvedValue(),
    pause: jest.fn(),
    addEventListener: jest.fn((eventName, handler) => {
      const handlers = listeners.get(eventName) || new Set();
      handlers.add(handler);
      listeners.set(eventName, handlers);
    }),
    removeEventListener: jest.fn((eventName, handler) => {
      const handlers = listeners.get(eventName);
      if (!handlers) {
        return;
      }
      handlers.delete(handler);
    }),
    emit(eventName) {
      const handlers = listeners.get(eventName);
      if (!handlers) {
        return;
      }

      for (const handler of [...handlers]) {
        handler();
      }
    },
  };
}

describe("SoundManager background music ducking", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ducks and restores background music around feature-trigger asset playback", () => {
    const manager = new SoundManager();
    const player = createFakeAudioPlayer();

    manager.volume = 1;
    manager.backgroundMusicVolumeScale = 0.5;
    manager.backgroundMusic = { volume: 0 };
    manager.soundAssetMap = { "feature-trigger": "/feature-trigger.ogg" };
    manager.soundAssetStatus.set("feature-trigger", "ready");
    manager.soundAssetTemplates.set("feature-trigger", {
      cloneNode: () => player,
    });

    manager._syncBackgroundMusicVolume();
    expect(manager.backgroundMusic.volume).toBe(0.5);

    manager.playFeatureTrigger(3);

    expect(player.play).toHaveBeenCalled();
    expect(manager.backgroundMusic.volume).toBeCloseTo(0.05);

    player.emit("ended");

    expect(manager.backgroundMusic.volume).toBe(0.5);
  });

  it("stops feature-trigger playback and restores background music immediately", () => {
    const manager = new SoundManager();
    const player = createFakeAudioPlayer();

    manager.volume = 1;
    manager.backgroundMusicVolumeScale = 0.5;
    manager.backgroundMusic = { volume: 0 };
    manager.soundAssetMap = { "feature-trigger": "/feature-trigger.ogg" };
    manager.soundAssetStatus.set("feature-trigger", "ready");
    manager.soundAssetTemplates.set("feature-trigger", {
      cloneNode: () => player,
    });

    manager._syncBackgroundMusicVolume();
    manager.playFeatureTrigger(3);

    expect(manager.backgroundMusic.volume).toBeCloseTo(0.05);

    manager.stopFeatureTrigger();

    expect(player.pause).toHaveBeenCalled();
    expect(player.currentTime).toBe(0);
    expect(manager.backgroundMusic.volume).toBe(0.5);
  });
});
