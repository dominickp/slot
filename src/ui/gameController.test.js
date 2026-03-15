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
  it("does not persist future connection highlights before their cascade runs", async () => {
    const firstConnection = new Set(["0,0", "1,0", "2,0", "3,0", "4,0"]);
    const secondConnection = new Set(["0,1", "1,1", "2,1", "3,1", "4,1"]);
    const persistentHighlightSnapshots = [];
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
        maxAnimatedCascades: 4,
      },
      game: {
        currentGrid: [[1]],
        isInFreeSpins: false,
        config: { id: "luckyscape" },
        spin: jest.fn().mockResolvedValue({
          grid: [[7]],
          cascades: [
            {
              beforeGrid: [[1]],
              winPositions: new Set(firstConnection),
              connectionPositions: new Set(firstConnection),
              afterGrid: [[2]],
              moveData: { movedCells: [] },
            },
            {
              beforeGrid: [[2]],
              winPositions: new Set(secondConnection),
              connectionPositions: new Set(secondConnection),
              afterGrid: [[3]],
              moveData: { movedCells: [] },
            },
          ],
          initialWins: new Set(firstConnection),
          winPositions: new Set(secondConnection),
          totalWin: 0,
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
        setPersistentConnectionHighlights: jest
          .fn()
          .mockImplementation((positions) => {
            persistentHighlightSnapshots.push(Array.from(positions).sort());
          }),
        render: jest.fn(),
        animateCascade: jest.fn().mockResolvedValue(),
        animateWin: jest.fn().mockResolvedValue(),
        setBonusVisuals: jest.fn(),
        animateScatterTrigger: jest.fn().mockResolvedValue(),
        clearBonusVisuals: jest.fn(),
      },
      soundManager: {
        playSpinStart: jest.fn(),
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
      debugModeEnabled: false,
      _updateBonusSpinProgress: jest.fn(),
      _delay: jest.fn().mockResolvedValue(),
      _syncBonusVisuals: jest.fn(),
      _getCollectorSummary: jest.fn().mockReturnValue(""),
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
      _roundCredits: GameController.prototype._roundCredits,
      _updateBalance: jest.fn(),
      _updateTotalWinDisplay: jest.fn(),
      _updateLastWinDisplay: jest.fn(),
      _showResult: jest.fn(),
      _hideResult: jest.fn(),
      _setCharacter: jest.fn(),
      _formatCredits: (value) => String(value),
      _getScatterBaitAnimationOptions: jest.fn(),
    };

    await GameController.prototype._playSingleSpin.call(controller, {
      betAmount: 2,
      isFreeSpin: false,
      freeSpinIndex: 0,
    });

    expect(persistentHighlightSnapshots[0]).toEqual([]);
    expect(persistentHighlightSnapshots[1]).toEqual(
      Array.from(firstConnection).sort(),
    );
    expect(persistentHighlightSnapshots[2]).toEqual(
      Array.from(new Set([...firstConnection, ...secondConnection])).sort(),
    );
    expect(controller.renderer.render).toHaveBeenNthCalledWith(
      1,
      [[1]],
      new Set(firstConnection),
      { showBonusOverlays: false },
    );
  });

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
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
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
      },
      renderer: {
        animateScatterTrigger: jest.fn().mockResolvedValue(),
      },
      _animateBonusScatterTrigger: jest.fn().mockResolvedValue(),
      _hideBonusTotalOverlay: jest.fn(),
      _setCharacter: jest.fn(),
      _showResult: jest.fn(),
      _delay: jest.fn().mockResolvedValue(),
      _updateControlButtons: jest.fn(),
      _scheduleAutoplay: jest.fn(),
      _playSingleSpin: jest.fn().mockResolvedValue({
        bonusMode: { name: "Dom Bonus", initialSpins: 3 },
        scatterCount: 3,
        scatterPositions: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
          { x: 4, y: 2 },
        ],
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

    expect(controller._animateBonusScatterTrigger).toHaveBeenCalledWith(3, [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: 4, y: 2 },
    ]);
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
      },
      _hideBonusTotalOverlay: jest.fn(),
      _updateControlButtons: jest.fn(),
      _showResult: jest.fn(),
      _updateBalance: jest.fn(),
      _roundCredits: GameController.prototype._roundCredits,
      _playBonusBuyTriggerSpin: jest.fn().mockResolvedValue(),
      _animateBonusScatterTrigger: jest.fn().mockResolvedValue(),
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
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

    await GameController.prototype.handleBonusBuy.call(
      controller,
      "LEPRECHAUN",
    );

    expect(callOrder).toEqual(["free-spins", "overlay", "finalize"]);
    expect(controller._finalizeBonusWin).toHaveBeenCalledWith({
      totalWin: 40,
      betAmount: 20,
      bonusType: "Bought Bonus",
    });
  });

  it("skips scatter bait animation when only one scatter lands", async () => {
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
        isInFreeSpins: false,
        spin: jest.fn().mockResolvedValue({
          grid: [[7]],
          cascades: [],
          initialWins: new Set(),
          winPositions: new Set(),
          totalWin: 0,
          bonusMode: null,
          scatterCount: 1,
          scatterPositions: [{ x: 0, y: 0 }],
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
        animateScatterTrigger: jest.fn().mockResolvedValue(),
        clearBonusVisuals: jest.fn(),
        setBonusVisuals: jest.fn(),
      },
      soundManager: {
        playSpinStart: jest.fn(),
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
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
      _roundCredits: GameController.prototype._roundCredits,
      _updateBalance: jest.fn(),
      _updateTotalWinDisplay: jest.fn(),
      _updateLastWinDisplay: jest.fn(),
      _showResult: jest.fn(),
      _hideResult: jest.fn(),
      _setCharacter: jest.fn(),
      _formatCredits: (value) => String(value),
    };

    await GameController.prototype._playSingleSpin.call(controller, {
      betAmount: 2,
      isFreeSpin: false,
      freeSpinIndex: 0,
    });

    expect(controller.renderer.animateScatterTrigger).not.toHaveBeenCalled();
  });

  it("plays rainbow activation focus on a base spin before reveal sequencing", async () => {
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
        isInFreeSpins: false,
        spin: jest.fn().mockResolvedValue({
          grid: [[9]],
          cascades: [],
          initialWins: new Set(),
          winPositions: new Set(),
          totalWin: 0,
          bonusMode: null,
          scatterCount: 0,
          scatterPositions: [],
          bonusFeatures: {
            rainbowTriggered: true,
            rainbowPositions: [{ x: 0, y: 0 }],
            bonusEventTimeline: [],
          },
        }),
        finalizeSpinVisualState: jest.fn(),
      },
      renderer: {
        animateSpinStart: jest.fn().mockResolvedValue(),
        animateSpinTransition: jest.fn().mockResolvedValue(),
        setPersistentConnectionHighlights: jest.fn(),
        render: jest.fn(),
        animateWin: jest.fn().mockResolvedValue(),
        animateScatterTrigger: jest.fn().mockResolvedValue(),
        clearBonusVisuals: jest.fn(),
        setBonusVisuals: jest.fn(),
        animateRainbowActivationFocus: jest.fn().mockResolvedValue(),
      },
      soundManager: {
        playSpinStart: jest.fn(),
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
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
      _roundCredits: GameController.prototype._roundCredits,
      _updateBalance: jest.fn(),
      _updateTotalWinDisplay: jest.fn(),
      _updateLastWinDisplay: jest.fn(),
      _showResult: jest.fn(),
      _hideResult: jest.fn(),
      _setCharacter: jest.fn(),
      _formatCredits: (value) => String(value),
    };

    await GameController.prototype._playSingleSpin.call(controller, {
      betAmount: 2,
      isFreeSpin: false,
      freeSpinIndex: 0,
    });

    expect(controller.renderer.setBonusVisuals).toHaveBeenCalledWith({
      rainbowTriggered: true,
      rainbowPositions: [{ x: 0, y: 0 }],
      bonusEventTimeline: [],
    });
    expect(controller.soundManager.playRainbow).toHaveBeenCalledTimes(1);
    expect(
      controller.renderer.animateRainbowActivationFocus,
    ).toHaveBeenCalledWith(1);
  });

  it("uses the bonus scatter trigger animation for bought bonuses", async () => {
    const controller = {
      totalSpins: 0,
      game: {
        currentGrid: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      },
      renderer: {
        animateSpinStart: jest.fn().mockResolvedValue(),
        animateSpinTransition: jest.fn().mockResolvedValue(),
        setPersistentConnectionHighlights: jest.fn(),
        render: jest.fn(),
        animateScatterTrigger: jest.fn().mockResolvedValue(),
      },
      soundManager: {
        playSpinStart: jest.fn(),
      },
      timings: {
        spinDrop: 0,
      },
      _buildBonusBuyTriggerGrid: jest.fn().mockReturnValue([
        [7, 1, 2],
        [3, 7, 7],
      ]),
      _getScatterBaitAnimationOptions:
        GameController.prototype._getScatterBaitAnimationOptions,
      _animateBonusScatterTrigger:
        GameController.prototype._animateBonusScatterTrigger,
      _getEligibleScatterTriggerPositions:
        GameController.prototype._getEligibleScatterTriggerPositions,
      _formatCredits: (value) => String(value),
      _formatCount: (value) => String(value),
      _showResult: jest.fn(),
    };

    await GameController.prototype._playBonusBuyTriggerSpin.call(controller, {
      modeType: "LEPRECHAUN",
      modeName: "Bought Bonus",
      scatterCount: 3,
      cost: 20,
    });

    expect(controller.renderer.animateScatterTrigger).toHaveBeenCalledWith(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      {
        duration: 0,
        intensity: 0.82,
        cycles: 3.15,
        liftAmplitude: 5,
        focusOverlay: {
          accentColor: 0xffd56f,
          maxScale: 1.24,
          growMs: 110,
          shrinkMs: 240,
          renderOutline: false,
        },
      },
    );
  });

  it("uses the same scatter bait animation for free-spin retriggers", async () => {
    const playRetrigger = jest.fn();
    const controller = {
      game: {
        isInFreeSpins: true,
        freeSpinsRemaining: 0,
        handleFreeSpinsRetrigger: jest.fn().mockReturnValue(5),
        advanceFreeSpins: jest.fn().mockImplementation(() => {
          controller.game.isInFreeSpins = false;
        }),
      },
      soundManager: {
        playRetrigger,
      },
      renderer: {
        animateScatterTrigger: jest.fn().mockResolvedValue(),
        animateCenterCallout: jest.fn().mockResolvedValue(),
      },
      _playSingleSpin: jest.fn().mockResolvedValue({
        totalWin: 0,
        scatterCount: 2,
        scatterPositions: [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
      }),
      _getScatterBaitAnimationOptions:
        GameController.prototype._getScatterBaitAnimationOptions,
      _roundCredits: GameController.prototype._roundCredits,
      _setCharacter: jest.fn(),
      _requestWakeLock: jest.fn().mockResolvedValue(),
      _syncBonusVisuals: jest.fn(),
      _updateBonusSpinProgress: jest.fn(),
      _updateLastWinDisplay: jest.fn(),
      _showResult: jest.fn(),
      _delay: jest.fn().mockResolvedValue(),
      _formatCount: (value) => String(value),
      _formatCredits: (value) => String(value),
      wakeLockSentinel: {},
    };

    await GameController.prototype._playFreeSpins.call(controller, 2);

    expect(playRetrigger).toHaveBeenCalledWith(5);
    expect(controller.renderer.animateScatterTrigger).toHaveBeenCalledWith(
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      {
        duration: 0,
        intensity: 0.82,
        cycles: 3.15,
        liftAmplitude: 5,
        focusOverlay: {
          accentColor: 0xffd56f,
          maxScale: 1.24,
          growMs: 110,
          shrinkMs: 240,
          renderOutline: false,
        },
      },
    );
  });

  it("shows the active free spin number instead of completed spins", () => {
    const hiddenClasses = new Set(["hidden"]);
    const controller = {
      game: {
        isInFreeSpins: true,
        freeSpinsRemaining: 1,
        bonusMode: {
          spinsCompleted: 11,
        },
      },
      displayedFreeSpinNumber: 12,
      ui: {
        bonusSpinStat: {
          classList: {
            add: jest.fn((name) => hiddenClasses.add(name)),
            remove: jest.fn((name) => hiddenClasses.delete(name)),
          },
        },
        bonusSpinProgress: {
          textContent: "",
        },
      },
      _formatCount: (value) => String(value),
    };

    GameController.prototype._updateBonusSpinProgress.call(controller);

    expect(controller.ui.bonusSpinProgress.textContent).toBe("12/12");
    expect(hiddenClasses.has("hidden")).toBe(false);
  });

  it("hides the bonus counter and clears the displayed spin after free spins end", () => {
    const controller = {
      game: {
        isInFreeSpins: false,
        bonusMode: null,
      },
      displayedFreeSpinNumber: 12,
      ui: {
        bonusSpinStat: {
          classList: {
            add: jest.fn(),
          },
        },
        bonusSpinProgress: {
          textContent: "12/12",
        },
      },
    };

    GameController.prototype._updateBonusSpinProgress.call(controller);

    expect(controller.displayedFreeSpinNumber).toBe(0);
    expect(controller.ui.bonusSpinStat.classList.add).toHaveBeenCalledWith(
      "hidden",
    );
  });

  it("stops the feature-trigger sound when bonus intro continue is pressed", () => {
    const stopFeatureTrigger = jest.fn();
    const resolver = jest.fn();
    const controller = {
      bonusIntroOpen: true,
      bonusIntroResolver: resolver,
      soundManager: {
        stopFeatureTrigger,
      },
      ui: {
        bonusIntroModal: {
          classList: {
            remove: jest.fn(),
          },
        },
      },
    };

    GameController.prototype._resolveBonusIntroContinue.call(controller);

    expect(stopFeatureTrigger).toHaveBeenCalledTimes(1);
    expect(controller.bonusIntroOpen).toBe(false);
    expect(controller.ui.bonusIntroModal.classList.remove).toHaveBeenCalledWith(
      "show",
    );
    expect(resolver).toHaveBeenCalledWith(true);
  });

  it("starts the feature-trigger sound when the bonus intro modal is shown", () => {
    const playFeatureTrigger = jest.fn();
    const controller = {
      bonusIntroOpen: false,
      soundManager: {
        playFeatureTrigger,
      },
      ui: {
        bonusIntroModal: {
          classList: {
            add: jest.fn(),
          },
        },
        bonusIntroTitle: {
          textContent: "",
        },
        bonusIntroCopy: {
          textContent: "",
        },
        bonusIntroGraphic: null,
      },
      _getBonusModeConfig: jest.fn().mockReturnValue({
        description: "Test bonus description",
      }),
      _formatCount: (value) => String(value),
      _formatCredits: (value) => String(value),
    };

    GameController.prototype._showBonusIntro.call(
      controller,
      { type: "LEPRECHAUN", name: "Test Bonus", initialSpins: 9 },
      3,
    );

    expect(controller.ui.bonusIntroModal.classList.add).toHaveBeenCalledWith(
      "show",
    );
    expect(playFeatureTrigger).toHaveBeenCalledWith(3);
  });
});
