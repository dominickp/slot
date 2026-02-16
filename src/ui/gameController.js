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

    // Initialize game
    this.game = new LuckyScapeSlot(LUCKY_ESCAPE_CONFIG);

    // Initialize renderer
    const rendererContainer = document.createElement("div");
    rendererContainer.style.cssText = `
      margin: 20px 0;
      display: flex;
      justify-content: center;
      background: #0a0a0f;
      border-radius: 10px;
      padding: 20px;
    `;
    this.container.insertBefore(
      rendererContainer,
      this.container.querySelector(".controls"),
    );

    this.renderer = new GridRenderer(rendererContainer, {
      cellSize: 100,
      padding: 15,
      rows: Number(LUCKY_ESCAPE_CONFIG.gridHeight || 5),
      cols: Number(LUCKY_ESCAPE_CONFIG.gridWidth || 6),
    });

    // Game state
    this.isSpinning = false;
    this.currentBalance = 1000;
    this.totalSpins = 0;
    this.totalWins = 0;
    this.autoPlayEnabled = false;
    this.autoPlayTimer = null;
    this.isConfirmOpen = false;
    this.confirmResolver = null;
    this.bonusIntroOpen = false;
    this.bonusIntroResolver = null;
    this.soundManager = new SoundManager();
    this.timings = {
      spinDrop: ANIMATION_TIMING.controller.spinFlow.spinDropMs,
      cascade: ANIMATION_TIMING.controller.spinFlow.cascadeMs,
      betweenCascades: ANIMATION_TIMING.controller.spinFlow.betweenCascadesMs,
      preCascadePause: ANIMATION_TIMING.controller.spinFlow.preCascadePauseMs,
      maxAnimatedCascades:
        ANIMATION_TIMING.controller.spinFlow.maxAnimatedCascades,
      winText: ANIMATION_TIMING.controller.spinFlow.winTextMs,
    };

    // Initialize UI
    this.ready = this._initialize();
  }

  async _initialize() {
    this._initializeUI();
    await this.renderer.ready;
    this._renderInitialGrid();
    this.ui.spinBtn.disabled = false;
    this.ui.stateEl.textContent = "READY";
    this._showResult("Ready to spin", "info");
    this._updateHud({
      mode: "BASE GAME",
      freeSpinsRemaining: 0,
      lastWin: 0,
      cascades: 0,
      scatters: 0,
    });
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
    const buyLeprechaunBtn = document.getElementById("buyLeprechaunBtn");
    const buyGlitterGoldBtn = document.getElementById("buyGlitterGoldBtn");
    const buyTreasureRainbowBtn = document.getElementById(
      "buyTreasureRainbowBtn",
    );
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
    const stateEl = document.getElementById("state");
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
    const gameContainer = document.querySelector(".game-container");

    if (gameContainer) {
      gameContainer.style.display = "none";
    }

    const hud = document.createElement("div");
    hud.className = "stats";
    hud.style.marginTop = "-8px";
    hud.style.marginBottom = "20px";
    hud.innerHTML = `
      <div class="stat">
        <div class="stat-label">Mode</div>
        <div class="stat-value state" id="hudMode">BASE GAME</div>
      </div>
      <div class="stat">
        <div class="stat-label">Free Spins</div>
        <div class="stat-value" id="hudFreeSpins">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">Last Win</div>
        <div class="stat-value balance" id="hudLastWin">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">Cascades</div>
        <div class="stat-value" id="hudCascades">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">Scatters</div>
        <div class="stat-value" id="hudScatters">0</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Spins</div>
        <div class="stat-value" id="hudTotalSpins">0</div>
      </div>
    `;

    const controls = this.container.querySelector(".controls");
    this.container.insertBefore(hud, controls);

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
    buyLeprechaunBtn.addEventListener("click", () =>
      this.handleBonusBuy("LEPRECHAUN"),
    );
    buyGlitterGoldBtn.addEventListener("click", () =>
      this.handleBonusBuy("GLITTER_GOLD"),
    );
    buyTreasureRainbowBtn.addEventListener("click", () =>
      this.handleBonusBuy("TREASURE_RAINBOW"),
    );
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
      }
    });
    betInput.addEventListener("input", () => this._updateControlButtons());

    // Update initial display
    balanceEl.textContent = this._formatCredits(this.currentBalance);
    stateEl.textContent = "LOADING";
    volumeSlider.value = String(Math.round(this.soundManager.volume * 100));
    volumeValue.textContent = `${Math.round(this.soundManager.volume * 100)}%`;

    // Store references
    this.ui = {
      spinBtn,
      autoplayBtn,
      soundBtn,
      volumeSlider,
      volumeValue,
      buyLeprechaunBtn,
      buyGlitterGoldBtn,
      buyTreasureRainbowBtn,
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
      stateEl,
      betInput,
      resultEl,
      resultText,
      hudMode: document.getElementById("hudMode"),
      hudFreeSpins: document.getElementById("hudFreeSpins"),
      hudLastWin: document.getElementById("hudLastWin"),
      hudCascades: document.getElementById("hudCascades"),
      hudScatters: document.getElementById("hudScatters"),
      hudTotalSpins: document.getElementById("hudTotalSpins"),
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
    this.ui.stateEl.textContent = "BASE SPIN";

    try {
      this.soundManager.playSpinStart();

      const spinResult = await this._playSingleSpin({
        betAmount,
        isFreeSpin: false,
        freeSpinIndex: 0,
      });

      if (spinResult.bonusMode) {
        this.soundManager.playBonus();
        this.ui.stateEl.textContent = "BONUS TRIGGERED";

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
        await this._playFreeSpins(betAmount);
      }

      await this._delay(ANIMATION_TIMING.controller.pauses.postBaseSpinMs);
      this.ui.stateEl.textContent = "READY";
      this._showResult("Ready for next spin", "info");
    } catch (error) {
      console.error("Spin error:", error);
      this.ui.stateEl.textContent = "ERROR";
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

    await this.soundManager.ensureReady();
    this.soundManager.playButton();

    if (this.autoPlayEnabled) {
      this._toggleAutoplay(false);
    }

    const betAmount = Number.parseFloat(this.ui.betInput.value);

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
    this.ui.stateEl.textContent = "BONUS BUY";
    this._updateControlButtons();

    try {
      this.currentBalance = this._roundCredits(
        this.currentBalance - offer.cost,
      );
      this._updateBalance();

      const bonusMeta = this.game.startBonusMode(modeType);
      this._syncBonusVisuals();
      this.soundManager.playBonus();
      this._showResult(
        `Bought ${bonusMeta.name} (${this._formatCount(bonusMeta.initialSpins)} Free Spins) for ${this._formatCredits(offer.cost)}`,
        "win",
      );

      await this._showBonusIntro(bonusMeta, null, {
        source: "buy",
        cost: offer.cost,
        multiplier: offer.multiplier,
        betAmount,
      });
      await this._playFreeSpins(betAmount);

      this.ui.stateEl.textContent = "READY";
      this._showResult("Ready for next spin", "info");
    } catch (error) {
      console.error("Bonus buy error:", error);
      this.ui.stateEl.textContent = "ERROR";
      this._showResult(`Error: ${error.message}`, "loss");
    } finally {
      this.isSpinning = false;
      this.ui.spinBtn.disabled = false;
      this._updateControlButtons();
    }
  }

  async _playSingleSpin({ betAmount, isFreeSpin, freeSpinIndex }) {
    this.totalSpins += 1;
    this.ui.hudTotalSpins.textContent = this._formatCount(this.totalSpins);

    if (!isFreeSpin) {
      this.currentBalance = this._roundCredits(this.currentBalance - betAmount);
      this._updateBalance();
      this.ui.stateEl.textContent = "BASE SPIN";
    } else {
      const spinProgress = this._getFreeSpinProgress();
      this.ui.stateEl.textContent = spinProgress
        ? `FREE SPIN ${spinProgress}`
        : `FREE SPIN ${this._formatCount(freeSpinIndex)}`;
      this.soundManager.playFreeSpinStart(freeSpinIndex);
    }

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
      for (const key of cascade.winPositions || []) {
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

        this.soundManager.playCascade();
        await this.renderer.animateCascade(
          cascade.beforeGrid,
          cascade.winPositions,
          cascade.afterGrid,
          cascade.moveData,
          this.timings.cascade,
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

    if (spinResult.totalWin > 0) {
      this.currentBalance = this._roundCredits(
        this.currentBalance + spinResult.totalWin,
      );
      this.totalWins = this._roundCredits(this.totalWins + spinResult.totalWin);
      this._updateBalance();
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
      const noWinMessage = isFreeSpin ? "Free spin: no win" : "No win";
      this._showResult(
        collectorSummary
          ? `${noWinMessage} • ${collectorSummary}`
          : noWinMessage,
        "loss",
      );
    }

    this._updateHud({
      mode: this.game.isInFreeSpins
        ? this.game.bonusMode?.name || "FREE SPINS"
        : "BASE GAME",
      freeSpinsRemaining: this.game.freeSpinsRemaining,
      lastWin: spinResult.totalWin,
      cascades: spinResult.cascadeCount,
      scatters: spinResult.scatterCount,
    });

    if (!this.game.isInFreeSpins) {
      this.renderer.clearBonusVisuals();
    }

    return spinResult;
  }

  async _playFreeSpins(betAmount) {
    let guard = 0;
    while (this.game.isInFreeSpins && guard < 200) {
      guard += 1;
      const freeSpinIndex = guard;

      const result = await this._playSingleSpin({
        betAmount,
        isFreeSpin: true,
        freeSpinIndex,
      });

      let retriggerSpinsAwarded = 0;
      if (result.scatterCount >= 2) {
        retriggerSpinsAwarded = this.game.handleFreeSpinsRetrigger(
          result.scatterCount,
        );
      }

      if (retriggerSpinsAwarded > 0) {
        this.soundManager.playBonus();
        this.ui.stateEl.textContent = `RETRIGGER +${this._formatCount(retriggerSpinsAwarded)}`;
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

      this._updateHud({
        mode: this.game.isInFreeSpins
          ? this.game.bonusMode?.name || "FREE SPINS"
          : "BASE GAME",
        freeSpinsRemaining: this.game.freeSpinsRemaining,
        lastWin: result.totalWin,
        cascades: result.cascadeCount,
        scatters: result.scatterCount,
      });

      await this._delay(ANIMATION_TIMING.controller.pauses.betweenFreeSpinsMs);
    }
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

  _updateHud({ mode, freeSpinsRemaining, lastWin, cascades, scatters }) {
    this.ui.hudMode.textContent = mode;
    this.ui.hudFreeSpins.textContent = this.game.isInFreeSpins
      ? this._getFreeSpinProgress() || this._formatCount(freeSpinsRemaining)
      : this._formatCount(0);
    this.ui.hudLastWin.textContent = this._formatCredits(lastWin);
    this.ui.hudCascades.textContent = this._formatCount(cascades);
    this.ui.hudScatters.textContent = this._formatCount(scatters);
  }

  _showResult(text, type = "info") {
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
      this.ui.bonusIntroCopy.textContent = `Bonus Buy purchased for ${costText}. ${spinsText} free spins ready — press continue to start.`;
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
      !offers.enabled;

    this.ui.autoplayBtn.textContent = `AUTOPLAY: ${this.autoPlayEnabled ? "ON" : "OFF"}`;
    this.ui.soundBtn.textContent = `SOUND: ${this.soundManager.enabled ? "ON" : "OFF"}`;
    this.ui.volumeSlider.disabled = !this.soundManager.enabled;

    const leprechaunOffer = byMode.LEPRECHAUN;
    const glitterGoldOffer = byMode.GLITTER_GOLD;
    const treasureRainbowOffer = byMode.TREASURE_RAINBOW;
    this.ui.buyLeprechaunBtn.textContent = leprechaunOffer
      ? `BUY LEPRECHAUN (${this._formatCredits(leprechaunOffer.cost)})`
      : "BUY LEPRECHAUN";
    this.ui.buyGlitterGoldBtn.textContent = glitterGoldOffer
      ? `BUY GLITTER GOLD (${this._formatCredits(glitterGoldOffer.cost)})`
      : "BUY GLITTER GOLD";
    this.ui.buyTreasureRainbowBtn.textContent = treasureRainbowOffer
      ? `BUY TREASURE RAINBOW (${this._formatCredits(treasureRainbowOffer.cost)})`
      : "BUY TREASURE RAINBOW";

    this.ui.buyLeprechaunBtn.disabled =
      disableBonusBuys ||
      (leprechaunOffer ? leprechaunOffer.cost > this.currentBalance : true);
    this.ui.buyGlitterGoldBtn.disabled =
      disableBonusBuys ||
      (glitterGoldOffer ? glitterGoldOffer.cost > this.currentBalance : true);
    this.ui.buyTreasureRainbowBtn.disabled =
      disableBonusBuys ||
      (treasureRainbowOffer
        ? treasureRainbowOffer.cost > this.currentBalance
        : true);
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
}

export default GameController;
