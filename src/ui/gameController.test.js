import { jest } from "@jest/globals";

jest.unstable_mockModule("../games/luckyscape/luckyScapeSlot.js", () => ({
  LuckyScapeSlot: class LuckyScapeSlot {},
}));

jest.unstable_mockModule("../renderer/gridRenderer.js", () => ({
  GridRenderer: class GridRenderer {},
}));

jest.unstable_mockModule("../games/luckyscape/config.js", () => ({
  LUCKY_ESCAPE_CONFIG: {
    id: "luckyscape",
    assets: { sounds: {} },
    gridHeight: 5,
    gridWidth: 6,
  },
}));

jest.unstable_mockModule("../config/animationTiming.js", () => ({
  ANIMATION_TIMING: {
    controller: {
      triggerEffects: {
        bonusScatterPulseMs: 0,
        teaseScatterPulseMs: 0,
        retriggerScatterPulseMs: 0,
        retriggerCalloutMs: 0,
      },
      pauses: {
        postBaseSpinMs: 0,
        betweenFreeSpinsMs: 0,
        postRetriggerMs: 0,
      },
    },
  },
}));

jest.unstable_mockModule("./soundManager.js", () => ({
  SoundManager: class SoundManager {},
}));

jest.unstable_mockModule("../api/backend.js", () => ({
  default: class BackendService {},
}));

const { GameController } = await import("./gameController.js");

describe("GameController bonus balance settlement", () => {
  it("does not credit balance during a winning free spin", async () => {
    const controller = {
      totalSpins: 0,
      currentBalance: 100,
      totalWins: 0,
      lastWin: 0,
      timings: {
        spinDrop: 0,
        cascade: 0,
        betweenCascades: 0,
        preCascadePause: 0,
        winText: 0,
        maxAnimatedCascades: 0,
      },
      game: {
        currentGrid: [[1]],
        isInFreeSpins: true,
        spin: jest.fn().mockResolvedValue({
          grid: [[2]],
          cascades: [],
          initialWins: new Set(),
          winPositions: new Set(["0,0"]),
          totalWin: 15,
          bonusMode: null,
          scatterCount: 0,
          scatterPositions: [],
          bonusFeatures: {},
        }),
        finalizeSpinVisualState: jest.fn(),
      },
      renderer: {
        animateSpinStart: jest.fn().mockResolvedValue(),
        animateSpinTransition: jest.fn().mockResolvedValue(),
        setPersistentConnectionHighlights: jest.fn(),
        render: jest.fn(),
        animateWin: jest.fn().mockResolvedValue(),
      },
      soundManager: {
        playFreeSpinStart: jest.fn(),
        playCascade: jest.fn(),
        playRainbow: jest.fn(),
        playCloverMultiply: jest.fn(),
        playCollectorCollect: jest.fn(),
        playCollectorPop: jest.fn(),
        playCoinReveal: jest.fn(),
        playWin: jest.fn(),
        playBigWin: jest.fn(),
      },
      backend: null,
      _updateBonusSpinProgress: jest.fn(),
      _delay: jest.fn().mockResolvedValue(),
      _syncBonusVisuals: jest.fn(),
      _getCollectorSummary: jest.fn().mockReturnValue(""),
      _roundCredits: GameController.prototype._roundCredits,
      _updateBalance: jest.fn(),
      _updateTotalWinDisplay: jest.fn(),
      _updateLastWinDisplay: jest.fn(),
      _showResult: jest.fn(),
      _hideResult: jest.fn(),
      _setCharacter: jest.fn(),
      _formatCredits: (value) => String(value),
    };

    const result = await GameController.prototype._playSingleSpin.call(
      controller,
      {
        betAmount: 2,
        isFreeSpin: true,
        freeSpinIndex: 1,
      },
    );

    expect(result.totalWin).toBe(15);
    expect(controller.currentBalance).toBe(100);
    expect(controller.totalWins).toBe(15);
    expect(controller._updateBalance).not.toHaveBeenCalled();
    expect(controller._updateTotalWinDisplay).toHaveBeenCalledTimes(1);
  });

  it("finalizes a natural bonus only after the total overlay finishes", async () => {
    const callOrder = [];
    const controller = {
      ready: Promise.resolve(),
      isSpinning: false,
      autoPlayEnabled: false,
      currentBalance: 100,
      ui: {
        betInput: { value: "2" },
        spinBtn: { disabled: false },
      },
      game: {
        isInFreeSpins: false,
        validateBet: jest.fn().mockReturnValue(true),
        config: { id: "luckyscape" },
      },
      soundManager: {
        playSpinStart: jest.fn(),
        playBonus: jest.fn(),
      },
      renderer: {
        animateScatterTrigger: jest.fn().mockResolvedValue(),
      },
      _hideBonusTotalOverlay: jest.fn(),
      _setCharacter: jest.fn(),
      _showResult: jest.fn(),
      _delay: jest.fn().mockResolvedValue(),
      _updateControlButtons: jest.fn(),
      _scheduleAutoplay: jest.fn(),
      _playSingleSpin: jest.fn().mockResolvedValue({
        bonusMode: { name: "Dom Bonus", initialSpins: 3 },
        scatterCount: 3,
        scatterPositions: [],
      }),
      _showBonusIntro: jest.fn().mockResolvedValue(),
      _playFreeSpins: jest.fn().mockImplementation(async () => {
        callOrder.push("free-spins");
        return 24;
      }),
      _showBonusTotalOverlay: jest.fn().mockImplementation(async () => {
        callOrder.push("overlay");
      }),
      _finalizeBonusWin: jest.fn().mockImplementation(async () => {
        callOrder.push("finalize");
      }),
      _formatCount: (value) => String(value),
      _formatCredits: (value) => String(value),
    };

    await GameController.prototype.handleSpin.call(controller, "auto");

    expect(callOrder).toEqual(["free-spins", "overlay", "finalize"]);
    expect(controller._finalizeBonusWin).toHaveBeenCalledWith({
      totalWin: 24,
      betAmount: 6,
      bonusType: "Dom Bonus",
    });
  });

  it("finalizes a bought bonus only after the total overlay finishes", async () => {
    const callOrder = [];
    const controller = {
      ready: Promise.resolve(),
      isSpinning: false,
      currentBalance: 100,
      debugModeEnabled: false,
      ui: {
        betInput: { value: "2" },
        spinBtn: { disabled: false },
      },
      game: {
        isInFreeSpins: false,
        validateBet: jest.fn().mockReturnValue(true),
        getBonusBuyOffers: jest.fn().mockReturnValue({
          enabled: true,
          offers: [{ modeType: "LEPRECHAUN", cost: 20, multiplier: 10 }],
        }),
        startBonusMode: jest.fn().mockReturnValue({
          name: "Bought Bonus",
          initialSpins: 10,
        }),
      },
      soundManager: {
        ensureReady: jest.fn().mockResolvedValue(),
        playButton: jest.fn(),
        playBonus: jest.fn(),
      },
      _hideBonusTotalOverlay: jest.fn(),
      _updateControlButtons: jest.fn(),
      _showResult: jest.fn(),
      _updateBalance: jest.fn(),
      _roundCredits: GameController.prototype._roundCredits,
      _playBonusBuyTriggerSpin: jest.fn().mockResolvedValue(),
      _syncBonusVisuals: jest.fn(),
      _showBonusIntro: jest.fn().mockResolvedValue(),
      _playFreeSpins: jest.fn().mockImplementation(async () => {
        callOrder.push("free-spins");
        return 40;
      }),
      _showBonusTotalOverlay: jest.fn().mockImplementation(async () => {
        callOrder.push("overlay");
      }),
      _finalizeBonusWin: jest.fn().mockImplementation(async () => {
        callOrder.push("finalize");
      }),
      _formatCount: (value) => String(value),
      _formatCredits: (value) => String(value),
      _getScatterCountForBonusMode: jest.fn().mockReturnValue(3),
      _getBonusModeName: jest.fn().mockReturnValue("Bought Bonus"),
    };

    await GameController.prototype.handleBonusBuy.call(controller, "LEPRECHAUN");

    expect(callOrder).toEqual(["free-spins", "overlay", "finalize"]);
    expect(controller._finalizeBonusWin).toHaveBeenCalledWith({
      totalWin: 40,
      betAmount: 20,
      bonusType: "Bought Bonus",
    });
  });
});