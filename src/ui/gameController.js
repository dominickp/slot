/**
 * Game Controller
 *
 * Orchestrates the game flow:
 * - User input (spin button)
 * - Game logic (LuckyScapeSlot)
 * - Rendering (GridRenderer)
 * - Animations
 */

import { LuckyScapeSlot } from "../games/luckyscape/luckyScapeSlot.js";
import { GridRenderer } from "../renderer/gridRenderer.js";
import { LUCKY_ESCAPE_CONFIG } from "../games/luckyscape/config.js";
import { ANIMATION_TIMING } from "../config/animationTiming.js";
import { SoundManager } from "./soundManager.js";

export class GameController {
  constructor(containerElement) {
    this.container = containerElement;

    this.debugModeEnabled = this._resolveDebugModeEnabled();
    const gameConfig = {
      ...LUCKY_ESCAPE_CONFIG,
      debug: {
        ...(LUCKY_ESCAPE_CONFIG?.debug || {}),
        enabled: this.debugModeEnabled,
      },
    };

    // Initialize game
    this.game = new LuckyScapeSlot(gameConfig);

    // Initialize renderer
    const rendererContainer = document.createElement("div");
    rendererContainer.style.cssText = `
      margin: 20px 0;
      display: flex;
      justify-content: center;
      background: #0a0a0f;
      border-radius: 10px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    `;
    this.container.insertBefore(
      rendererContainer,
      this.container.querySelector(".controls"),
    );

    this.renderer = new GridRenderer(rendererContainer, {
      cellSize: 100,
      padding: 15,
      rows: Number(gameConfig.gridHeight || 5),
      cols: Number(gameConfig.gridWidth || 6),
      symbolTextureMap: gameConfig?.assets?.symbols || {},
      randomRotationSymbolIds:
        gameConfig?.visuals?.randomRotationSymbolIds || [],
      randomRotationAnglesDeg: gameConfig?.visuals?.randomRotationAnglesDeg || [
        0, 90, 180, 270,
      ],
      coinTierColors: gameConfig?.visuals?.coinTierColors || {},
      collectorSuctionMotion: gameConfig?.visuals?.collectorSuctionMotion || {},
    });

    this.bonusTotalOverlay = document.createElement("div");
    this.bonusTotalOverlay.className = "bonus-total-overlay";
    this.bonusTotalOverlay.innerHTML = `
      <div class="bonus-total-content">
        <div class="bonus-total-label">Bonus Total Win</div>
        <div class="bonus-total-value" id="bonusTotalValue">0</div>
      </div>
    `;
    rendererContainer.appendChild(this.bonusTotalOverlay);
    this.bonusTotalValueEl =
      this.bonusTotalOverlay.querySelector("#bonusTotalValue");

    this.debugIndicatorEl = document.createElement("div");
    this.debugIndicatorEl.className = "debug-indicator";
    this.debugIndicatorEl.textContent = "DEBUG MODE";
    if (!this.debugModeEnabled) {
      this.debugIndicatorEl.style.display = "none";
    }
    rendererContainer.appendChild(this.debugIndicatorEl);

    // Game state
    this.isSpinning = false;
    this.currentBalance = 1000;
    this.totalSpins = 0;
    this.totalWins = 0;
    this.lastWin = 0;
    this.autoPlayEnabled = false;
    this.autoPlayTimer = null;
    this.isConfirmOpen = false;
    this.isBuyOptionsOpen = false;
    this.confirmResolver = null;
    this.bonusIntroOpen = false;
    this.bonusIntroResolver = null;
    this.soundManager = new SoundManager();
    this.soundManager.setSoundAssetMap(
      LUCKY_ESCAPE_CONFIG?.assets?.sounds || {},
    );
    this.timings = {
      spinDrop: ANIMATION_TIMING.controller.spinFlow.spinDropMs,
      cascade: ANIMATION_TIMING.controller.spinFlow.cascadeMs,
      betweenCascades: ANIMATION_TIMING.controller.spinFlow.betweenCascadesMs,
      preCascadePause: ANIMATION_TIMING.controller.spinFlow.preCascadePauseMs,
      maxAnimatedCascades:
        ANIMATION_TIMING.controller.spinFlow.maxAnimatedCascades,
      winText: ANIMATION_TIMING.controller.spinFlow.winTextMs,
    };

    if (this.debugModeEnabled) {
      console.warn(
        "[Debug] LuckyScape debug mode enabled: forcing rainbow + guaranteed connection each spin.",
      );
    }

    // Initialize UI
    this.ready = this._initialize();
  }

  _resolveDebugModeEnabled() {
    if (typeof window === "undefined") {
      return false;
    }

    const debugConfig = LUCKY_ESCAPE_CONFIG?.debug || {};
    const gate = debugConfig.gate || {};

    const allowedHosts = Array.isArray(gate.allowedHosts)
      ? gate.allowedHosts
      : ["localhost", "127.0.0.1"];
    const host = String(window.location?.hostname || "").toLowerCase();
    const hostAllowed = allowedHosts.some(
      (entry) => String(entry || "").toLowerCase() === host,
    );

    if (!hostAllowed) {
      return false;
    }

    const queryParam = String(gate.queryParam || "debug");
    const enabledValues = Array.isArray(gate.enabledValues)
      ? gate.enabledValues.map((entry) => String(entry).toLowerCase())
      : ["1", "true", "on", "yes"];
    const params = new URLSearchParams(window.location.search);
    const queryValue = String(params.get(queryParam) || "").toLowerCase();

    return queryValue.length > 0 && enabledValues.includes(queryValue);
  }

  async _initialize() {
    this._initializeUI();
    this._validateConfiguredAssets();
    await this.renderer.ready;
    this._renderInitialGrid();
    this.ui.spinBtn.disabled = false;
    this._updateTotalWinDisplay();
    this._updateBonusSpinProgress();
  }

  /**
   * Initialize UI elements and event listeners
   */
  _initializeUI() {
    const spinBtn = document.getElementById("spinBtn");
    const autoplayBtn = document.getElementById("autoplayBtn");
    const soundBtn = document.getElementById("soundBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeValue = document.getElementById("volumeValue");
    const buyBonusBtn = document.getElementById("buyBonusBtn");
    const buyOptionsModal = document.getElementById("buyOptionsModal");
    const buyOptionLeprechaunBtn = document.getElementById(
      "buyOptionLeprechaunBtn",
    );
    const buyOptionGlitterGoldBtn = document.getElementById(
      "buyOptionGlitterGoldBtn",
    );
    const buyOptionsCancel = document.getElementById("buyOptionsCancel");
    const buyConfirmModal = document.getElementById("buyConfirmModal");
    const buyConfirmTitle = document.getElementById("buyConfirmTitle");
    const buyConfirmText = document.getElementById("buyConfirmText");
    const buyConfirmCancel = document.getElementById("buyConfirmCancel");
    const buyConfirmAccept = document.getElementById("buyConfirmAccept");
    const bonusIntroModal = document.getElementById("bonusIntroModal");
    const bonusIntroTitle = document.getElementById("bonusIntroTitle");
    const bonusIntroCopy = document.getElementById("bonusIntroCopy");
    const bonusIntroContinue = document.getElementById("bonusIntroContinue");
    const bonusIntroGraphic = document.getElementById("bonusIntroGraphic");
    const balanceEl = document.getElementById("balance");
    const betInput = document.getElementById("betInput");
    if (betInput) {
      const minBet = Number(this.game.config?.minBet ?? 0.1);
      const maxBet = Number(this.game.config?.maxBet ?? 100);
      betInput.min = String(minBet);
      betInput.max = String(maxBet);
      betInput.step = "0.1";
      if (!betInput.value) {
        betInput.value = String(minBet);
      }
    }
    const resultEl = document.getElementById("result");
    const resultText = document.getElementById("resultText");
    const bonusSpinStat = document.getElementById("bonusSpinStat");
    const bonusSpinProgress = document.getElementById("bonusSpinProgress");
    const totalWinEl = document.getElementById("totalWin");
    const lastWinEl = document.getElementById("lastWin");
    const gameContainer = document.querySelector(".game-container");

    if (gameContainer) {
      gameContainer.style.display = "none";
    }

    // Bind spin button
    spinBtn.addEventListener("click", () => this.handleSpin("manual"));
    autoplayBtn.addEventListener("click", () => this._toggleAutoplay());
    soundBtn.addEventListener("click", async () => {
      this.soundManager.setEnabled(!this.soundManager.enabled);
      if (this.soundManager.enabled) {
        await this.soundManager.ensureReady();
      }
      this._updateControlButtons();
      this.soundManager.playButton();
    });
    volumeSlider.addEventListener("input", async () => {
      const normalized = Number(volumeSlider.value) / 100;
      this.soundManager.setVolume(normalized);
      volumeValue.textContent = `${Math.round(normalized * 100)}%`;

      if (this.soundManager.enabled) {
        await this.soundManager.ensureReady();
      }
    });
    buyBonusBtn.addEventListener("click", () => this._openBuyOptionsModal());
    buyOptionLeprechaunBtn.addEventListener("click", async () => {
      this._closeBuyOptionsModal();
      await this.handleBonusBuy("LEPRECHAUN");
    });
    buyOptionGlitterGoldBtn.addEventListener("click", async () => {
      this._closeBuyOptionsModal();
      await this.handleBonusBuy("GLITTER_GOLD");
    });
    buyOptionsCancel.addEventListener("click", () =>
      this._closeBuyOptionsModal(),
    );
    buyOptionsModal.addEventListener("click", (event) => {
      if (event.target === buyOptionsModal) {
        this._closeBuyOptionsModal();
      }
    });
    buyConfirmCancel.addEventListener("click", () =>
      this._resolveBonusBuyConfirm(false),
    );
    buyConfirmAccept.addEventListener("click", () =>
      this._resolveBonusBuyConfirm(true),
    );
    buyConfirmModal.addEventListener("click", (event) => {
      if (event.target === buyConfirmModal) {
        this._resolveBonusBuyConfirm(false);
      }
    });
    bonusIntroContinue.addEventListener("click", () =>
      this._resolveBonusIntroContinue(),
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isConfirmOpen) {
        this._resolveBonusBuyConfirm(false);
        return;
      }

      if (event.key === "Enter" && this.bonusIntroOpen) {
        event.preventDefault();
        this._resolveBonusIntroContinue();
      }
    });
    betInput.addEventListener("input", () => this._updateControlButtons());

    // Update initial display
    balanceEl.textContent = this._formatCredits(this.currentBalance);
    if (totalWinEl) {
      totalWinEl.textContent = this._formatCredits(this.totalWins);
    }
    if (lastWinEl) {
      lastWinEl.textContent = this._formatCredits(this.lastWin);
    }
    volumeSlider.value = String(Math.round(this.soundManager.volume * 100));
    volumeValue.textContent = `${Math.round(this.soundManager.volume * 100)}%`;

    // Store references
    this.ui = {
      spinBtn,
      autoplayBtn,
      soundBtn,
      volumeSlider,
      volumeValue,
      buyBonusBtn,
      buyOptionsModal,
      buyOptionLeprechaunBtn,
      buyOptionGlitterGoldBtn,
      buyOptionsCancel,
      buyConfirmModal,
      buyConfirmTitle,
      buyConfirmText,
      buyConfirmCancel,
      buyConfirmAccept,
      bonusIntroModal,
      bonusIntroTitle,
      bonusIntroCopy,
      bonusIntroContinue,
      bonusIntroGraphic,
      balanceEl,
      betInput,
      resultEl,
      resultText,
      bonusSpinStat,
      bonusSpinProgress,
      totalWinEl,
      lastWinEl,
    };

    this._updateControlButtons();
  }

  /**
   * Render initial empty grid
   */
  _renderInitialGrid() {
    const rows = Number(LUCKY_ESCAPE_CONFIG.gridHeight || 5);
    const cols = Number(LUCKY_ESCAPE_CONFIG.gridWidth || 6);
    const emptyGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
    this.renderer.clearBonusVisuals();
    this.renderer.render(emptyGrid);
  }

  /**
   * Handle spin button click
   */
  async handleSpin(source = "manual") {
    await this.ready;

    if (this.isSpinning) return;

    if (source === "manual") {
      await this.soundManager.ensureReady();
      this.soundManager.playButton();
    }

    this._hideBonusTotalOverlay();

    const betAmount = Number.parseFloat(this.ui.betInput.value);

    if (!this.game.validateBet(betAmount)) {
      const minBet = Number(this.game.config?.minBet ?? 0.1);
      const maxBet = Number(this.game.config?.maxBet ?? 100);
      this._showResult(
        `Bet must be between ${this._formatCredits(minBet)} and ${this._formatCredits(maxBet)}`,
        "loss",
      );
      if (this.autoPlayEnabled) {
        this._toggleAutoplay(false);
      }
      return;
    }

    // Validate bet
    if (betAmount > this.currentBalance) {
      this._showResult("Insufficient balance", "loss");
      if (this.autoPlayEnabled) {
        this._toggleAutoplay(false);
      }
      return;
    }

    this.isSpinning = true;
    this.ui.spinBtn.disabled = true;

    try {
      this.soundManager.playSpinStart();

      const spinResult = await this._playSingleSpin({
        betAmount,
        isFreeSpin: false,
        freeSpinIndex: 0,
      });

      if (spinResult.bonusMode) {
        this.soundManager.playBonus();

        const scatterPositions = Array.isArray(spinResult.scatterPositions)
          ? spinResult.scatterPositions
          : [];

        await this.renderer.animateScatterTrigger(scatterPositions, {
          duration:
            ANIMATION_TIMING.controller.triggerEffects.bonusScatterPulseMs,
        });

        this._showResult(
          `Free Bonus Unlocked: ${spinResult.bonusMode.name} (${this._formatCount(spinResult.bonusMode.initialSpins)} Free Spins) via ${this._formatCount(spinResult.scatterCount)} 🎲`,
          "win",
        );
        await this._showBonusIntro(
          spinResult.bonusMode,
          spinResult.scatterCount,
        );
        const bonusTotalWin = await this._playFreeSpins(betAmount);
        this._showBonusTotalOverlay(bonusTotalWin);
      }

      await this._delay(ANIMATION_TIMING.controller.pauses.postBaseSpinMs);
    } catch (error) {
      console.error("Spin error:", error);
      this._showResult(`Error: ${error.message}`, "loss");
    } finally {
      this.isSpinning = false;
      this.ui.spinBtn.disabled = false;
      this._updateControlButtons();

      if (this.autoPlayEnabled && !this.game.isInFreeSpins) {
        this._scheduleAutoplay();
      }
    }
  }

  async handleBonusBuy(modeType) {
    await this.ready;

    if (this.isSpinning || this.game.isInFreeSpins) {
      return;
    }

    this._hideBonusTotalOverlay();

    await this.soundManager.ensureReady();
    this.soundManager.playButton();

    if (this.autoPlayEnabled) {
      this._toggleAutoplay(false);
    }

    const betAmount = Number.parseFloat(this.ui.betInput.value);
    const scatterCount = this._getScatterCountForBonusMode(modeType);

    if (!scatterCount) {
      this._showResult("Selected bonus buy is not available", "loss");
      return;
    }

    if (!this.game.validateBet(betAmount)) {
      const minBet = Number(this.game.config?.minBet ?? 0.1);
      const maxBet = Number(this.game.config?.maxBet ?? 100);
      this._showResult(
        `Bet must be between ${this._formatCredits(minBet)} and ${this._formatCredits(maxBet)}`,
        "loss",
      );
      return;
    }
    const offers = this.game.getBonusBuyOffers(betAmount);
    const offer = offers.offers.find((entry) => entry.modeType === modeType);

    if (!offers.enabled || !offer) {
      this._showResult("Bonus Buy is not available", "loss");
      return;
    }

    if (offer.cost > this.currentBalance) {
      this._showResult(
        `Insufficient balance for buy (${this._formatCredits(offer.cost)})`,
        "loss",
      );
      return;
    }

    this.isSpinning = true;
    this.ui.spinBtn.disabled = true;
    this._updateControlButtons();

    try {
      this.currentBalance = this._roundCredits(
        this.currentBalance - offer.cost,
      );
      this._updateBalance();

      await this._playBonusBuyTriggerSpin({
        modeType,
        modeName: this._getBonusModeName(modeType),
        scatterCount,
        cost: offer.cost,
      });

      const bonusMeta = this.game.startBonusMode(modeType);
      this._syncBonusVisuals();
      this.soundManager.playBonus();
      this._showResult(
        `${this._formatCount(scatterCount)} scatters landed — ${bonusMeta.name} unlocked (${this._formatCount(bonusMeta.initialSpins)} Free Spins)`,
        "win",
      );

      await this._showBonusIntro(bonusMeta, scatterCount, {
        source: "buy",
        cost: offer.cost,
        multiplier: offer.multiplier,
        betAmount,
      });
      const bonusTotalWin = await this._playFreeSpins(betAmount);
      this._showBonusTotalOverlay(bonusTotalWin);
    } catch (error) {
      console.error("Bonus buy error:", error);
      this._showResult(`Error: ${error.message}`, "loss");
    } finally {
      this.isSpinning = false;
      this.ui.spinBtn.disabled = false;
      this._updateControlButtons();
    }
  }

  async _playSingleSpin({ betAmount, isFreeSpin, freeSpinIndex }) {
    this.totalSpins += 1;

    if (!isFreeSpin) {
      this.currentBalance = this._roundCredits(this.currentBalance - betAmount);
      this._updateBalance();
    } else {
      this.soundManager.playFreeSpinStart(freeSpinIndex);
    }

    this._updateBonusSpinProgress();

    const previousGrid = this.game.currentGrid.map((row) => [...row]);

    await this.renderer.animateSpinStart(160);
    const spinResult = await this.game.spin(null, betAmount);

    const initialGrid =
      spinResult.cascades && spinResult.cascades.length > 0
        ? spinResult.cascades[0].beforeGrid
        : spinResult.grid;

    await this.renderer.animateSpinTransition(
      previousGrid,
      initialGrid,
      this.timings.spinDrop,
      {
        columnStaggerMs: 26,
        showBonusOverlays: false,
      },
    );

    this.renderer.setPersistentConnectionHighlights(
      spinResult.initialWins || new Set(),
    );

    const accumulatedHighlights = new Set(spinResult.initialWins || []);
    for (const cascade of spinResult.cascades || []) {
      const highlightPositions =
        cascade.connectionPositions || cascade.winPositions || new Set();
      for (const key of highlightPositions) {
        accumulatedHighlights.add(key);
      }
    }

    this.renderer.render(initialGrid, spinResult.initialWins, {
      showBonusOverlays: false,
    });
    await this._delay(this.timings.preCascadePause);

    if (spinResult.cascades && spinResult.cascades.length > 0) {
      const cascadesToAnimate = spinResult.cascades.slice(
        0,
        this.timings.maxAnimatedCascades,
      );

      for (const cascade of cascadesToAnimate) {
        this.renderer.setPersistentConnectionHighlights(accumulatedHighlights);
        const cascadeHighlightPositions =
          cascade.connectionPositions || cascade.winPositions || new Set();

        this.soundManager.playCascade();
        await this.renderer.animateCascade(
          cascade.beforeGrid,
          cascade.winPositions,
          cascade.afterGrid,
          cascade.moveData,
          this.timings.cascade,
          {
            highlightPositions: cascadeHighlightPositions,
          },
        );
        await this._delay(this.timings.betweenCascades);
      }

      if (spinResult.cascades.length > this.timings.maxAnimatedCascades) {
        this._showResult(
          `Fast-forwarded ${this._formatCount(spinResult.cascades.length - this.timings.maxAnimatedCascades)} cascades`,
          "info",
        );
      }
    }

    const hasRainbowReveal = Boolean(
      spinResult?.bonusFeatures?.rainbowTriggered,
    );
    const revealHoldWins = hasRainbowReveal ? accumulatedHighlights : new Set();

    this.renderer.setPersistentConnectionHighlights(accumulatedHighlights);

    this.renderer.render(spinResult.grid, revealHoldWins);
    this._syncBonusVisuals();

    const eventRounds = Array.isArray(
      spinResult?.bonusFeatures?.bonusEventTimeline,
    )
      ? spinResult.bonusFeatures.bonusEventTimeline
      : [];

    if (spinResult?.bonusFeatures?.rainbowTriggered) {
      this.soundManager.playRainbow();
    }

    if (eventRounds.length > 0) {
      await this.renderer.animateBonusFeatureSequence(eventRounds, {
        betAmount,
        onCloverMultiply: () => this.soundManager.playCloverMultiply(),
        onCollectorCollect: () => this.soundManager.playCollectorCollect(),
        onCollectorTick: () => this.soundManager.playCollectorPop(),
      });
    }

    if (
      !isFreeSpin &&
      !spinResult.bonusMode &&
      spinResult.scatterCount === 2 &&
      Array.isArray(spinResult.scatterPositions) &&
      spinResult.scatterPositions.length === 2
    ) {
      await this.renderer.animateScatterTrigger(spinResult.scatterPositions, {
        duration:
          ANIMATION_TIMING.controller.triggerEffects.teaseScatterPulseMs,
        intensity: 0.26,
      });
    }

    const collectorSummary = this._getCollectorSummary(spinResult, betAmount);
    this.lastWin = this._roundCredits(spinResult.totalWin || 0);
    this._updateLastWinDisplay();

    if (spinResult.totalWin > 0) {
      this.currentBalance = this._roundCredits(
        this.currentBalance + spinResult.totalWin,
      );
      this.totalWins = this._roundCredits(this.totalWins + spinResult.totalWin);
      this._updateBalance();
      this._updateTotalWinDisplay();
      await this.renderer.animateWin(
        spinResult.totalWin,
        spinResult.winPositions,
        this.timings.winText,
      );
      this.soundManager.playWin(spinResult.totalWin);
      if (spinResult.totalWin >= betAmount * 20) {
        this.soundManager.playBigWin();
      }
      const winMessage = `Win +${this._formatCredits(spinResult.totalWin)}`;
      this._showResult(
        collectorSummary ? `${winMessage} • ${collectorSummary}` : winMessage,
        "win",
      );
    } else {
      this._hideResult();
    }

    if (!this.game.isInFreeSpins) {
      this.renderer.clearBonusVisuals();
    }

    this._updateBonusSpinProgress();

    return spinResult;
  }

  async _playFreeSpins(betAmount) {
    let bonusTotalWin = 0;
    let guard = 0;
    while (this.game.isInFreeSpins && guard < 200) {
      guard += 1;
      const freeSpinIndex = guard;

      const result = await this._playSingleSpin({
        betAmount,
        isFreeSpin: true,
        freeSpinIndex,
      });
      bonusTotalWin = this._roundCredits(bonusTotalWin + result.totalWin);

      let retriggerSpinsAwarded = 0;
      if (result.scatterCount >= 2) {
        retriggerSpinsAwarded = this.game.handleFreeSpinsRetrigger(
          result.scatterCount,
        );
      }

      if (retriggerSpinsAwarded > 0) {
        this.soundManager.playBonus();
        const retriggerScatterPositions = Array.isArray(result.scatterPositions)
          ? result.scatterPositions
          : [];

        if (retriggerScatterPositions.length > 0) {
          await this.renderer.animateScatterTrigger(retriggerScatterPositions, {
            duration:
              ANIMATION_TIMING.controller.triggerEffects
                .retriggerScatterPulseMs,
            intensity: 0.7,
          });
        }

        await this.renderer.animateCenterCallout(
          `+${this._formatCount(retriggerSpinsAwarded)} FREE SPINS`,
          ANIMATION_TIMING.controller.triggerEffects.retriggerCalloutMs,
          { color: 0xffef9a },
        );

        this._showResult(
          `+${this._formatCount(retriggerSpinsAwarded)} FREE SPINS`,
          "win",
        );
        await this._delay(ANIMATION_TIMING.controller.pauses.postRetriggerMs);
      }

      this.game.advanceFreeSpins();
      this._syncBonusVisuals();
      this._updateBonusSpinProgress();

      await this._delay(ANIMATION_TIMING.controller.pauses.betweenFreeSpinsMs);
    }

    this._updateBonusSpinProgress();

    return bonusTotalWin;
  }

  _syncBonusVisuals() {
    const bonusMode = this.game.bonusMode;
    if (!this.game.isInFreeSpins || !bonusMode) {
      this.renderer.clearBonusVisuals();
      return;
    }

    const visualData = {
      mode: bonusMode.name,
      modeName: bonusMode.name,
      modeId: bonusMode.id,
      ...(typeof this.game.getBonusFeatureDisplay === "function"
        ? this.game.getBonusFeatureDisplay()
        : {}),
    };

    this.renderer.setBonusVisuals(visualData);

    if (
      Array.isArray(this.game.currentGrid) &&
      this.game.currentGrid.length > 0
    ) {
      this.renderer.render(this.game.currentGrid, new Set(), {
        showBonusOverlays: true,
      });
    }
  }

  _showResult(text, type = "info") {
    if (!this.ui?.resultEl || !this.ui?.resultText) {
      return;
    }

    this.ui.resultText.textContent = text;
    this.ui.resultEl.classList.add("show");
    this.ui.resultEl.classList.remove("win", "loss");

    if (type === "win") {
      this.ui.resultEl.classList.add("win");
    }

    if (type === "loss") {
      this.ui.resultEl.classList.add("loss");
    }
  }

  _hideResult() {
    if (!this.ui?.resultEl || !this.ui?.resultText) {
      return;
    }

    this.ui.resultEl.classList.remove("show", "win", "loss");
    this.ui.resultText.textContent = "";
  }

  _updateTotalWinDisplay() {
    if (!this.ui?.totalWinEl) {
      return;
    }

    this.ui.totalWinEl.textContent = this._formatCredits(this.totalWins);
  }

  _updateLastWinDisplay() {
    if (!this.ui?.lastWinEl) {
      return;
    }

    this.ui.lastWinEl.textContent = this._formatCredits(this.lastWin);
  }

  _showBonusIntro(bonusMode, scatterCount, options = {}) {
    if (!this.ui?.bonusIntroModal) {
      return Promise.resolve();
    }

    const isBonusBuy = options?.source === "buy";
    this.bonusIntroOpen = true;
    this.ui.bonusIntroTitle.textContent = bonusMode?.name || "BONUS TRIGGERED";

    if (isBonusBuy) {
      const costText = this._formatCredits(options?.cost || 0);
      const spinsText = this._formatCount(bonusMode?.initialSpins || 0);
      const landedScatters = this._formatCount(scatterCount || 0);
      this.ui.bonusIntroCopy.textContent = `Bonus Buy purchased for ${costText}. You landed ${landedScatters} scatters and unlocked ${spinsText} free spins — press continue to start.`;
    } else {
      this.ui.bonusIntroCopy.textContent = `${this._formatCount(scatterCount)} FS landed. ${this._formatCount(bonusMode?.initialSpins || 0)} free spins ready — press continue to start.`;
    }

    this.ui.bonusIntroGraphic.textContent = `${bonusMode?.name || "BONUS"} GRAPHIC PLACEHOLDER`;
    this.ui.bonusIntroModal.classList.add("show");

    return new Promise((resolve) => {
      this.bonusIntroResolver = resolve;
    });
  }

  _resolveBonusIntroContinue() {
    if (!this.bonusIntroOpen) {
      return;
    }

    this.bonusIntroOpen = false;
    this.ui.bonusIntroModal.classList.remove("show");

    if (typeof this.bonusIntroResolver === "function") {
      const resolver = this.bonusIntroResolver;
      this.bonusIntroResolver = null;
      resolver(true);
    }
  }

  _toggleAutoplay(forceValue = null) {
    const nextState =
      typeof forceValue === "boolean" ? forceValue : !this.autoPlayEnabled;
    this.autoPlayEnabled = nextState;

    if (!this.autoPlayEnabled) {
      this._clearAutoplay();
      this._showResult("Autoplay stopped", "info");
    } else {
      this._showResult("Autoplay started", "info");
      if (!this.isSpinning && !this.game.isInFreeSpins) {
        this._scheduleAutoplay(120);
      }
    }

    this._updateControlButtons();
  }

  _scheduleAutoplay(delay = 260) {
    this._clearAutoplay();
    this.autoPlayTimer = setTimeout(() => {
      if (!this.autoPlayEnabled || this.isSpinning || this.game.isInFreeSpins) {
        return;
      }
      this.handleSpin("autoplay");
    }, delay);
  }

  _clearAutoplay() {
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  _updateControlButtons() {
    if (!this.ui) return;
    const parsedBet = Number.parseFloat(this.ui.betInput.value);
    const minBet = Number(this.game.config?.minBet ?? 0.1);
    const fallbackBet = Number.isFinite(parsedBet) ? parsedBet : minBet;
    const betAmount = this.game.validateBet(fallbackBet) ? fallbackBet : minBet;
    const offers = this.game.getBonusBuyOffers(betAmount);
    const byMode = Object.fromEntries(
      offers.offers.map((entry) => [entry.modeType, entry]),
    );
    const disableBonusBuys =
      this.isSpinning ||
      this.game.isInFreeSpins ||
      this.isConfirmOpen ||
      this.isBuyOptionsOpen ||
      !offers.enabled;

    this.ui.autoplayBtn.textContent = `AUTOPLAY: ${this.autoPlayEnabled ? "ON" : "OFF"}`;
    this.ui.soundBtn.textContent = `SOUND: ${this.soundManager.enabled ? "ON" : "OFF"}`;
    this.ui.volumeSlider.disabled = !this.soundManager.enabled;

    const leprechaunOffer = byMode.LEPRECHAUN;
    const glitterGoldOffer = byMode.GLITTER_GOLD;

    this.ui.buyBonusBtn.disabled =
      disableBonusBuys || (!leprechaunOffer && !glitterGoldOffer);

    this.ui.buyBonusBtn.textContent =
      leprechaunOffer && glitterGoldOffer
        ? `BUY BONUS (${this._formatCredits(leprechaunOffer.cost)} / ${this._formatCredits(glitterGoldOffer.cost)})`
        : "BUY BONUS";

    if (this.ui.buyOptionLeprechaunBtn) {
      this.ui.buyOptionLeprechaunBtn.textContent = leprechaunOffer
        ? `BUY 3 SCATTER BONUS (${this._formatCredits(leprechaunOffer.cost)})`
        : "BUY 3 SCATTER BONUS";
      this.ui.buyOptionLeprechaunBtn.disabled =
        !leprechaunOffer || leprechaunOffer.cost > this.currentBalance;
    }

    if (this.ui.buyOptionGlitterGoldBtn) {
      this.ui.buyOptionGlitterGoldBtn.textContent = glitterGoldOffer
        ? `BUY 4 SCATTER BONUS (${this._formatCredits(glitterGoldOffer.cost)})`
        : "BUY 4 SCATTER BONUS";
      this.ui.buyOptionGlitterGoldBtn.disabled =
        !glitterGoldOffer || glitterGoldOffer.cost > this.currentBalance;
    }
  }

  /**
   * Update balance display
   */
  _updateBalance() {
    this.ui.balanceEl.textContent = this._formatCredits(this.currentBalance);
    this._updateControlButtons();
  }

  _roundCredits(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  _formatCredits(value) {
    const rounded = this._roundCredits(value);
    return this._numberFormatter().format(rounded);
  }

  _formatCount(value) {
    return this._numberFormatter(0, 0).format(Math.max(0, Math.trunc(value)));
  }

  _numberFormatter(minimumFractionDigits = 0, maximumFractionDigits = 2) {
    if (!this._formatters) {
      this._formatters = new Map();
    }

    const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
    if (!this._formatters.has(key)) {
      this._formatters.set(
        key,
        new Intl.NumberFormat(undefined, {
          minimumFractionDigits,
          maximumFractionDigits,
        }),
      );
    }

    return this._formatters.get(key);
  }

  _getFreeSpinProgress() {
    if (!this.game?.isInFreeSpins || !this.game?.bonusMode) {
      return null;
    }

    const completed = this.game.bonusMode.spinsCompleted || 0;
    const remaining = this.game.freeSpinsRemaining || 0;
    const total = completed + remaining;

    return `${this._formatCount(completed)} of ${this._formatCount(total)}`;
  }

  _updateBonusSpinProgress() {
    if (!this.ui?.bonusSpinStat || !this.ui?.bonusSpinProgress) {
      return;
    }

    if (!this.game?.isInFreeSpins || !this.game?.bonusMode) {
      this.ui.bonusSpinStat.classList.add("hidden");
      return;
    }

    const remaining = Math.max(0, Number(this.game.freeSpinsRemaining || 0));
    const completed = Math.max(
      0,
      Number(this.game.bonusMode.spinsCompleted || 0),
    );
    const total = Math.max(remaining + completed, 0);

    this.ui.bonusSpinProgress.textContent = `${this._formatCount(completed)}/${this._formatCount(total)} spins`;
    this.ui.bonusSpinStat.classList.remove("hidden");
  }

  _getCollectorSummary(spinResult, betAmount) {
    const features = spinResult?.bonusFeatures;
    if (!features) {
      return "";
    }

    const potHits = Array.isArray(features.potSymbolsHit)
      ? features.potSymbolsHit.length
      : 0;
    const chainRounds = Number(features.chainRoundsTriggered || 0);
    const collectedUnits = Number(features.spinCollectionValue || 0);

    if (potHits <= 0) {
      return "";
    }

    const collectedCredits = this._roundCredits(collectedUnits * betAmount);
    const bucketLabel = `${this._formatCount(potHits)} pot${potHits === 1 ? "" : "s"}`;
    const roundLabel = `${this._formatCount(chainRounds)} round${chainRounds === 1 ? "" : "s"}`;

    return `${bucketLabel} resolved in ${roundLabel}, collected ${this._formatCredits(collectedCredits)}`;
  }

  _getScatterCountForBonusMode(modeType) {
    if (modeType === "LEPRECHAUN") {
      return 3;
    }

    if (modeType === "GLITTER_GOLD") {
      return 4;
    }

    return null;
  }

  _getBonusModeName(modeType) {
    if (modeType === "LEPRECHAUN") {
      return "Luck of the Leprechaun";
    }

    if (modeType === "GLITTER_GOLD") {
      return "All That Glitters Is Gold";
    }

    return modeType;
  }

  async _playBonusBuyTriggerSpin({ modeType, modeName, scatterCount, cost }) {
    const previousGrid = this.game.currentGrid.map((row) => [...row]);
    const triggerGrid = this._buildBonusBuyTriggerGrid(scatterCount);
    const scatterPositions = [];

    for (let y = 0; y < triggerGrid.length; y++) {
      for (let x = 0; x < triggerGrid[y].length; x++) {
        if (triggerGrid[y][x] === 7) {
          scatterPositions.push({ x, y });
        }
      }
    }

    this.totalSpins += 1;
    this.soundManager.playSpinStart();
    await this.renderer.animateSpinStart(160);
    await this.renderer.animateSpinTransition(
      previousGrid,
      triggerGrid,
      this.timings.spinDrop,
      {
        columnStaggerMs: 26,
        showBonusOverlays: false,
      },
    );

    this.renderer.setPersistentConnectionHighlights(new Set());
    this.renderer.render(triggerGrid, new Set(), {
      showBonusOverlays: false,
    });
    this.game.currentGrid = triggerGrid.map((row) => [...row]);

    await this.renderer.animateScatterTrigger(scatterPositions, {
      duration: ANIMATION_TIMING.controller.triggerEffects.bonusScatterPulseMs,
    });

    this._showResult(
      `Bought ${modeName} for ${this._formatCredits(cost)} — landed ${this._formatCount(scatterCount)} scatters`,
      "win",
    );
  }

  _buildBonusBuyTriggerGrid(scatterCount) {
    const rows = Number(this.game.gridHeight || 5);
    const cols = Number(this.game.gridWidth || 6);
    const excludedIds = new Set([7, 8, 9, 10]);
    const regularIds = (this.game.config?.symbols || [])
      .filter((symbol) => !excludedIds.has(Number(symbol.id)))
      .map((symbol) => Number(symbol.id));
    const fallbackRegulars = [1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 6];
    const sourceIds = regularIds.length > 0 ? regularIds : fallbackRegulars;
    const rng = this.game?.rng;

    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => {
        const index = rng?.nextInt
          ? rng.nextInt(0, sourceIds.length - 1)
          : Math.floor(Math.random() * sourceIds.length);
        return sourceIds[index];
      }),
    );

    const allCells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        allCells.push({ x, y });
      }
    }

    for (let i = allCells.length - 1; i > 0; i--) {
      const swapIndex = rng?.nextInt
        ? rng.nextInt(0, i)
        : Math.floor(Math.random() * (i + 1));
      const temp = allCells[i];
      allCells[i] = allCells[swapIndex];
      allCells[swapIndex] = temp;
    }

    const count = Math.min(
      Math.max(0, Number(scatterCount || 0)),
      allCells.length,
    );
    for (let i = 0; i < count; i++) {
      const cell = allCells[i];
      grid[cell.y][cell.x] = 7;
    }

    return grid;
  }

  /**
   * Helper: delay in ms
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _showBonusBuyConfirm({ modeName, cost, betAmount, multiplier }) {
    if (this.isConfirmOpen) {
      return Promise.resolve(false);
    }

    this.isConfirmOpen = true;
    this.ui.buyConfirmTitle.textContent = `Buy ${modeName}?`;
    this.ui.buyConfirmText.textContent = `Cost: ${this._formatCredits(cost)} credits (${multiplier}x bet ${this._formatCredits(betAmount)}).`;
    this.ui.buyConfirmModal.classList.add("show");
    this._updateControlButtons();

    return new Promise((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  _resolveBonusBuyConfirm(confirmed) {
    if (!this.isConfirmOpen) {
      return;
    }

    this.isConfirmOpen = false;
    this.ui.buyConfirmModal.classList.remove("show");

    const resolver = this.confirmResolver;
    this.confirmResolver = null;
    this._updateControlButtons();

    if (resolver) {
      resolver(Boolean(confirmed));
    }
  }

  _openBuyOptionsModal() {
    if (!this.ui?.buyOptionsModal) {
      return;
    }

    if (this.isSpinning || this.game.isInFreeSpins) {
      return;
    }

    this.isBuyOptionsOpen = true;
    this.ui.buyOptionsModal.classList.add("show");
    this._updateControlButtons();
  }

  _closeBuyOptionsModal() {
    if (!this.ui?.buyOptionsModal) {
      return;
    }

    this.isBuyOptionsOpen = false;
    this.ui.buyOptionsModal.classList.remove("show");
    this._updateControlButtons();
  }

  _showBonusTotalOverlay(totalWin) {
    if (!this.bonusTotalOverlay || !this.bonusTotalValueEl) {
      return;
    }

    this.bonusTotalValueEl.textContent = this._formatCredits(totalWin || 0);
    this.bonusTotalOverlay.classList.add("show");
  }

  _hideBonusTotalOverlay() {
    if (!this.bonusTotalOverlay) {
      return;
    }

    this.bonusTotalOverlay.classList.remove("show");
  }

  async _validateConfiguredAssets() {
    if (typeof window === "undefined" || typeof fetch !== "function") {
      return;
    }

    const symbolAssets = this.game?.config?.assets?.symbols || {};
    const soundAssets = this.game?.config?.assets?.sounds || {};

    const entries = [
      ...Object.entries(symbolAssets).map(([key, path]) => ({
        group: "symbol",
        key,
        path,
      })),
      ...Object.entries(soundAssets).map(([key, path]) => ({
        group: "sound",
        key,
        path,
      })),
    ];

    if (entries.length === 0) {
      return;
    }

    const exists = async (path) => {
      const normalizedPath = String(path || "").trim();
      if (!normalizedPath) {
        return false;
      }

      try {
        let response = await fetch(normalizedPath, { method: "HEAD" });
        if (response.status === 405 || response.status === 501) {
          response = await fetch(normalizedPath, { method: "GET" });
        }
        return response.ok;
      } catch {
        return false;
      }
    };

    const missing = [];

    await Promise.all(
      entries.map(async ({ group, key, path }) => {
        const found = await exists(path);
        if (!found) {
          missing.push({ group, key, path });
        }
      }),
    );

    if (missing.length === 0) {
      return;
    }

    const missingSymbols = missing.filter((entry) => entry.group === "symbol");
    const missingSounds = missing.filter((entry) => entry.group === "sound");

    if (missingSymbols.length > 0) {
      console.warn(
        "[Assets] Missing symbol files (renderer will use placeholders):",
        missingSymbols,
      );
    }

    if (missingSounds.length > 0) {
      console.warn(
        "[Assets] Missing sound files (sound manager will use synth fallback/silence):",
        missingSounds,
      );
    }
  }
}

export default GameController;
