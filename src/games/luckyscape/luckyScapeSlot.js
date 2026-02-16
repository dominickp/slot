/**
 * LuckyScapeSlot rewritten to mirror Le Bandit-style mechanics with placeholder assets.
 *
 * Core pillars:
 * - 6x5 cluster pays with super cascades
 * - Golden squares created from winning positions
 * - Rainbow activation revealing coins, clovers, and pots
 * - Three free-spin tiers mapped to Le Bandit behavior
 */

import { BaseSlot } from "../../core/baseSlot.js";
import { CascadeDetector } from "./cascadeDetector.js";
import { CascadeEngine } from "./cascadeEngine.js";
import { LUCKY_ESCAPE_CONFIG } from "./config.js";
import { LockAndLoad } from "./bonusModes/lockAndLoad.js";
import { GoldenRush } from "./bonusModes/goldenRush.js";
import { CascadeMaster } from "./bonusModes/cascadeMaster.js";

const MODE_TO_CLASS = {
  LEPRECHAUN: LockAndLoad,
  GLITTER_GOLD: GoldenRush,
  TREASURE_RAINBOW: CascadeMaster,
};

const MODE_TO_SPINS = {
  LEPRECHAUN: 8,
  GLITTER_GOLD: 12,
  TREASURE_RAINBOW: 12,
};

const MODE_TO_NAME = {
  LEPRECHAUN: "Luck of the Leprechaun",
  GLITTER_GOLD: "All That Glitters Is Gold",
  TREASURE_RAINBOW: "Treasure at the End of the Rainbow",
};

export class LuckyScapeSlot extends BaseSlot {
  constructor(config = LUCKY_ESCAPE_CONFIG) {
    super(config);

    this.gridWidth = Number(config.gridWidth || 6);
    this.gridHeight = Number(config.gridHeight || 5);
    this.detector = new CascadeDetector(this.gridWidth, this.gridHeight);
    this.engine = new CascadeEngine(this.gridWidth, this.gridHeight);

    this.currentGrid = CascadeEngine.createEmptyGrid(
      this.gridWidth,
      this.gridHeight,
    );
    this.cascadeCount = 0;
    this.totalWinFromSpin = 0;

    this.bonusMode = null;
    this.isInFreeSpins = false;
    this.freeSpinsRemaining = 0;

    this.goldenSquares = new Set();

    this.rainbowTriggered = false;
    this.spinHadRainbowSymbol = false;
    this.rainbowPositions = [];
    this.rainbowSpawnedThisSpin = false;
    this.cloverSymbolsHit = [];
    this.potSymbolsHit = [];
    this.spinCollectionValue = 0;
    this.chainRoundsTriggered = 0;
    this.bonusEventTimeline = [];
  }

  async spin(backend, betAmount = 10) {
    this.totalWinFromSpin = 0;
    this.cascadeCount = 0;
    this._resetSpinFeatureState();
    this._prepareSpinGoldenSquareState();

    this.currentGrid = this._generateRandomGrid();
    this._enforceSingleRainbowPerSpin();

    if (this._isGuaranteedRainbowSpin()) {
      this._injectRainbowIfMissing();
      this._enforceSingleRainbowPerSpin();
    }

    const cascades = [];
    let initialWinPositions = new Set();
    let finalWinPositions = new Set();

    let cascadeIndex = 0;
    const maxCascades = Number(this.config.maxCascadesPerSpin || 20);

    while (cascadeIndex < maxCascades) {
      const winResult = this.detector.findWins(this.currentGrid);

      if (winResult.clusters.length === 0) {
        break;
      }

      if (cascadeIndex === 0) {
        initialWinPositions = new Set(winResult.winPositions);
      }

      this._trackGoldenSquaresFromWins(winResult);
      finalWinPositions = new Set(winResult.winPositions);

      if (this._shouldHoldBoardForRainbowActivation()) {
        break;
      }

      const beforeGrid = CascadeEngine.cloneGrid(this.currentGrid);
      const removePositions = this.detector.getSuperCascadeRemovalPositions(
        this.currentGrid,
        winResult,
      );

      this.totalWinFromSpin += winResult.totalWin;

      const cascadeResult = this.engine.executeCascade(
        this.currentGrid,
        removePositions,
        this.rng,
      );

      cascades.push({
        beforeGrid,
        afterGrid: CascadeEngine.cloneGrid(cascadeResult.grid),
        winPositions: new Set(removePositions),
        moveData: cascadeResult.moveData,
      });

      this.currentGrid = cascadeResult.grid;
      this._enforceSingleRainbowPerSpin();
      this.cascadeCount += 1;
      cascadeIndex += 1;
    }

    this._resolveRainbowActivation();

    this.totalWinFromSpin += this.spinCollectionValue;

    const scatterResult = this.detector.findScatters(this.currentGrid);
    let bonusMode = null;

    if (!this.isInFreeSpins) {
      const nextMode = this._getModeFromScatterCount(scatterResult.count);
      if (nextMode) {
        this._initializeBonusMode(nextMode, MODE_TO_SPINS[nextMode]);
        bonusMode = {
          type: nextMode,
          name: MODE_TO_NAME[nextMode],
          initialSpins: MODE_TO_SPINS[nextMode],
        };
      }
    }

    const totalWin =
      Math.round(
        (this.totalWinFromSpin * Number(betAmount) + Number.EPSILON) * 100,
      ) / 100;

    if (this.isInFreeSpins && this.bonusMode) {
      this.bonusMode.onSpinComplete(totalWin);
      this.freeSpinsRemaining = this.bonusMode.remaining;
    }

    return {
      grid: this.currentGrid,
      initialWins: initialWinPositions,
      winPositions: finalWinPositions,
      cascades,
      totalWin,
      cascadeCount: this.cascadeCount,
      bonusMode,
      scatterCount: scatterResult.count,
      scatterPositions: scatterResult.positions,
      bonusFeatures: this.getBonusFeatureDisplay(),
    };
  }

  detectWins(grid) {
    return this.detector.findWins(grid);
  }

  getBonus(finalGrid) {
    const scatterResult = this.detector.findScatters(finalGrid);
    const modeType = this._getModeFromScatterCount(scatterResult.count);

    if (!modeType) {
      return null;
    }

    const initialSpins = MODE_TO_SPINS[modeType];
    this._initializeBonusMode(modeType, initialSpins);

    return {
      type: modeType,
      spins: initialSpins,
      scatterCount: scatterResult.count,
    };
  }

  _initializeBonusMode(modeType, initialSpins) {
    const ModeClass = MODE_TO_CLASS[modeType];
    if (!ModeClass) {
      throw new Error(`Unknown bonus mode: ${modeType}`);
    }

    this.bonusMode = new ModeClass(initialSpins);
    this.isInFreeSpins = true;
    this.freeSpinsRemaining = initialSpins;
    this.goldenSquares = new Set();
    this._resetSpinFeatureState();
  }

  startBonusMode(modeType) {
    if (this.isInFreeSpins) {
      throw new Error("Cannot start bonus buy during free spins");
    }

    const initialSpins = MODE_TO_SPINS[modeType];
    if (!initialSpins) {
      throw new Error(`Unknown bonus mode: ${modeType}`);
    }

    this._initializeBonusMode(modeType, initialSpins);

    return {
      type: modeType,
      name: MODE_TO_NAME[modeType],
      initialSpins,
    };
  }

  getBonusBuyOffers(betAmount) {
    const multipliers = this.config?.bonusBuy?.multipliers || {};
    const offers = Object.entries(multipliers).map(
      ([modeType, multiplier]) => ({
        modeType,
        multiplier: Number(multiplier),
        cost:
          Math.round(
            (Number(betAmount) * Number(multiplier) + Number.EPSILON) * 100,
          ) / 100,
      }),
    );

    return {
      enabled: Boolean(this.config?.bonusBuy?.enabled),
      offers,
    };
  }

  handleFreeSpinsRetrigger(newScatterCount) {
    if (!this.isInFreeSpins || !this.bonusMode) {
      return;
    }

    if (newScatterCount < 3) {
      return;
    }

    const currentModeId = this.bonusMode.id;

    if (newScatterCount >= 5 && currentModeId !== "TREASURE_RAINBOW") {
      this._upgradeBonusMode("TREASURE_RAINBOW", 4);
      return;
    }

    if (newScatterCount >= 4 && currentModeId === "LEPRECHAUN") {
      this._upgradeBonusMode("GLITTER_GOLD", 4);
      return;
    }

    this.bonusMode.remaining += 2;
    this.freeSpinsRemaining = this.bonusMode.remaining;
  }

  _upgradeBonusMode(modeType, additionalSpins) {
    const spins = this.freeSpinsRemaining + additionalSpins;
    const ModeClass = MODE_TO_CLASS[modeType];
    this.bonusMode = new ModeClass(spins);
    this.freeSpinsRemaining = spins;
  }

  advanceFreeSpins() {
    if (!this.isInFreeSpins) {
      return false;
    }

    if (this.bonusMode) {
      this.freeSpinsRemaining = this.bonusMode.remaining;
    }

    if (this.freeSpinsRemaining <= 0) {
      this.isInFreeSpins = false;
      this.bonusMode = null;
      this.goldenSquares.clear();
      return true;
    }

    return false;
  }

  getState() {
    return {
      grid: this.currentGrid,
      totalWin: this.totalWinFromSpin,
      cascadeCount: this.cascadeCount,
      inFreeSpins: this.isInFreeSpins,
      freeSpinsRemaining: this.freeSpinsRemaining,
      bonusMode: this.bonusMode ? this.bonusMode.name : null,
      cascadeHistory: [],
      bonusFeatures: this.getBonusFeatureDisplay(),
    };
  }

  getBonusFeatureDisplay() {
    return {
      modeId: this.bonusMode?.id || null,
      modeName: this.bonusMode?.name || null,
      persistGoldenSquaresAfterActivation: Boolean(
        this.bonusMode?.persistGoldenSquaresAfterActivation,
      ),
      guaranteedRainbowEverySpin: Boolean(
        this.bonusMode?.guaranteedRainbowEverySpin,
      ),
      rainbowTriggered: this.rainbowTriggered,
      spinHadRainbowSymbol: this.spinHadRainbowSymbol,
      rainbowPositions: this.rainbowPositions.map((entry) => ({ ...entry })),
      cloverSymbolsHit: [...this.cloverSymbolsHit],
      potSymbolsHit: [...this.potSymbolsHit],
      spinCollectionValue: this.spinCollectionValue,
      chainRoundsTriggered: this.chainRoundsTriggered,
      goldenSquares: [...this.goldenSquares],
      goldenSquaresCount: this.goldenSquares.size,
      bonusEventTimeline: this.bonusEventTimeline.map((round) => ({
        ...round,
        reveals: round.reveals.map((entry) => ({ ...entry })),
        cloverHits: round.cloverHits.map((entry) => ({
          ...entry,
          targets: entry.targets.map((target) => ({ ...target })),
        })),
        collectorSteps: round.collectorSteps.map((entry) => ({ ...entry })),
      })),
    };
  }

  getPaytable() {
    return {
      symbols: this.config.symbols,
      basePayouts: CascadeDetector.BASE_PAYOUTS,
      clusterMultipliers: CascadeDetector.CLUSTER_MULTIPLIERS,
      scatterTriggers: {
        3: "Luck of the Leprechaun (8 free spins)",
        4: "All That Glitters Is Gold (12 free spins)",
        5: "Treasure at the End of the Rainbow (12 free spins)",
      },
      maxWin: this.config.maxWin,
      rtp: this.config.rtp,
    };
  }

  _generateRandomGrid() {
    const grid = CascadeEngine.createEmptyGrid(this.gridWidth, this.gridHeight);

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        grid[y][x] = this._generateSymbol();
      }
    }

    return grid;
  }

  _generateSymbol() {
    const weights = [
      { id: 1, weight: 22 },
      { id: 2, weight: 20 },
      { id: 3, weight: 18 },
      { id: 4, weight: 16 },
      { id: 5, weight: 14 },
      { id: 6, weight: 8 },
      { id: 7, weight: 2 },
      { id: 9, weight: this._shouldAllowRainbowSymbolInCurrentSpin() ? 3 : 0 },
    ];

    const filtered = weights.filter((entry) => entry.weight > 0);
    const total = filtered.reduce((sum, entry) => sum + entry.weight, 0);

    let roll = this.rng.nextInt(0, total - 1);
    for (const entry of filtered) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.id;
      }
    }

    return 1;
  }

  _shouldAllowRainbowSymbolInCurrentSpin() {
    if (!this.isInFreeSpins) {
      return true;
    }

    if (this.bonusMode?.guaranteedRainbowEverySpin) {
      return true;
    }

    return this.rng.nextFloat() < 0.35;
  }

  _prepareSpinGoldenSquareState() {
    const shouldPersistAcrossSpins = this.isInFreeSpins;

    if (!shouldPersistAcrossSpins) {
      this.goldenSquares.clear();
      return;
    }

    if (this.bonusMode?.persistGoldenSquaresAfterActivation) {
      return;
    }

    if (this.rainbowTriggered) {
      this.goldenSquares.clear();
    }
  }

  _resetSpinFeatureState() {
    this.rainbowTriggered = false;
    this.spinHadRainbowSymbol = false;
    this.rainbowPositions = [];
    this.cloverSymbolsHit = [];
    this.potSymbolsHit = [];
    this.spinCollectionValue = 0;
    this.chainRoundsTriggered = 0;
    this.bonusEventTimeline = [];
    this.rainbowSpawnedThisSpin = false;
  }

  _isGuaranteedRainbowSpin() {
    return Boolean(this.bonusMode?.guaranteedRainbowEverySpin);
  }

  _injectRainbowIfMissing() {
    if (this.rainbowSpawnedThisSpin) {
      return;
    }

    const positions = this._findSymbolPositions(9);
    if (positions.length > 0) {
      this.rainbowSpawnedThisSpin = true;
      return;
    }

    const cell = this._pickRandomRegularPosition();
    if (!cell) {
      return;
    }

    this.currentGrid[cell.y][cell.x] = 9;
    this.rainbowSpawnedThisSpin = true;
  }

  _enforceSingleRainbowPerSpin() {
    const rainbows = this._findSymbolPositions(9);
    if (rainbows.length === 0) {
      return;
    }

    if (!this.rainbowSpawnedThisSpin) {
      this.rainbowSpawnedThisSpin = true;

      if (rainbows.length === 1) {
        return;
      }

      const keepIndex = this.rng.nextInt(0, rainbows.length - 1);
      for (let index = 0; index < rainbows.length; index++) {
        if (index === keepIndex) {
          continue;
        }

        const extra = rainbows[index];
        this.currentGrid[extra.y][extra.x] = this._rollReplacementSymbol();
      }

      return;
    }

    for (const rainbow of rainbows) {
      this.currentGrid[rainbow.y][rainbow.x] = this._rollReplacementSymbol();
    }
  }

  _rollReplacementSymbol() {
    const table = [
      { id: 1, weight: 22 },
      { id: 2, weight: 20 },
      { id: 3, weight: 18 },
      { id: 4, weight: 16 },
      { id: 5, weight: 14 },
      { id: 6, weight: 8 },
      { id: 7, weight: 2 },
    ];

    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.nextInt(0, total - 1);

    for (const entry of table) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.id;
      }
    }

    return 1;
  }

  _findSymbolPositions(symbolId) {
    const positions = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.currentGrid[y][x] === symbolId) {
          positions.push({ x, y });
        }
      }
    }

    return positions;
  }

  _trackGoldenSquaresFromWins(winResult) {
    for (const cluster of winResult.clusters) {
      for (const pos of cluster.positions) {
        this.goldenSquares.add(`${pos.x},${pos.y}`);
      }
    }
  }

  _shouldHoldBoardForRainbowActivation() {
    if (this.goldenSquares.size === 0) {
      return false;
    }

    return this._findSymbolPositions(9).length > 0;
  }

  _resolveRainbowActivation() {
    const rainbowPositions = this._findSymbolPositions(9);
    this.spinHadRainbowSymbol = rainbowPositions.length > 0;
    this.rainbowPositions = rainbowPositions;

    if (this.goldenSquares.size === 0 || rainbowPositions.length === 0) {
      this._resolveGoldenSquarePostSpinCleanup(false);
      return;
    }

    this.rainbowTriggered = true;

    const maxRounds = this.bonusMode?.persistGoldenSquaresAfterActivation
      ? 3
      : 2;
    this.chainRoundsTriggered = this._runGoldenSquareChainRounds(maxRounds);

    this._resolveGoldenSquarePostSpinCleanup(true);
  }

  _resolveGoldenSquarePostSpinCleanup(wasActivated) {
    if (!this.isInFreeSpins) {
      if (wasActivated) {
        this.goldenSquares.clear();
      }
      return;
    }

    if (!wasActivated) {
      return;
    }

    if (!this.bonusMode?.persistGoldenSquaresAfterActivation) {
      this.goldenSquares.clear();
    }
  }

  _runGoldenSquareChainRounds(maxRounds) {
    let roundsExecuted = 0;
    let continueRounds = true;

    while (
      continueRounds &&
      roundsExecuted < maxRounds &&
      this.goldenSquares.size > 0
    ) {
      roundsExecuted += 1;
      const round = this._executeSingleChainRound(roundsExecuted);
      this.spinCollectionValue += round.roundCollectionValue;
      continueRounds = round.potCount > 0;
    }

    return roundsExecuted;
  }

  _executeSingleChainRound(roundIndex) {
    const coinValues = new Map();
    const clovers = [];
    const pots = [];
    const potMultipliers = new Map();

    const eventRound = {
      roundIndex,
      reveals: [],
      cloverHits: [],
      collectorSteps: [],
      roundCollectionValue: 0,
      potCount: 0,
    };

    for (const key of this.goldenSquares) {
      const [x, y] = key.split(",").map(Number);
      const roll = this.rng.nextFloat();
      const chances = this._getGoldenSquareOutcomeChances();

      if (roll < chances.coin) {
        const value = this._rollCoinValue();
        coinValues.set(key, value);
        eventRound.reveals.push({
          x,
          y,
          type: "coin",
          value,
          tier: this._getCoinTier(value),
        });
        continue;
      }

      if (roll < chances.coin + chances.clover) {
        const multiplier = this._rollCloverMultiplierValue();
        clovers.push({ x, y, value: multiplier });
        this.cloverSymbolsHit.push(multiplier);
        eventRound.reveals.push({ x, y, type: "clover", value: multiplier });
        continue;
      }

      pots.push({ x, y, key });
      potMultipliers.set(key, 1);
      this.potSymbolsHit.push(1);
      eventRound.reveals.push({ x, y, type: "collector", value: 1 });
    }

    const adjustedCoinValues = new Map(coinValues);
    for (const clover of clovers) {
      const targets = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const tx = clover.x + dx;
          const ty = clover.y + dy;
          if (
            tx < 0 ||
            tx >= this.gridWidth ||
            ty < 0 ||
            ty >= this.gridHeight
          ) {
            continue;
          }

          const targetKey = `${tx},${ty}`;
          if (adjustedCoinValues.has(targetKey)) {
            const before = adjustedCoinValues.get(targetKey);
            const after = before * clover.value;
            adjustedCoinValues.set(targetKey, after);
            targets.push({ x: tx, y: ty, type: "coin", before, after });
          }

          if (potMultipliers.has(targetKey)) {
            const before = potMultipliers.get(targetKey);
            const after = before * clover.value;
            potMultipliers.set(targetKey, after);
            targets.push({ x: tx, y: ty, type: "collector", before, after });
          }
        }
      }

      if (targets.length > 0) {
        eventRound.cloverHits.push({
          x: clover.x,
          y: clover.y,
          multiplier: clover.value,
          targets,
        });
      }
    }

    pots.sort((left, right) =>
      left.y === right.y ? left.x - right.x : left.y - right.y,
    );

    let runningTotal = Array.from(adjustedCoinValues.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    for (const pot of pots) {
      const multiplier = potMultipliers.get(pot.key) || 1;
      const collectedBeforeMultiplier = runningTotal;
      const collectedValue = collectedBeforeMultiplier * multiplier;
      runningTotal += collectedValue;

      eventRound.collectorSteps.push({
        x: pot.x,
        y: pot.y,
        multiplier,
        collectedBeforeMultiplier,
        collectedValue,
        runningTotalAfter: runningTotal,
      });
    }

    const totalCoins = Array.from(adjustedCoinValues.values()).reduce(
      (sum, value) => sum + value,
      0,
    );
    const totalPots = eventRound.collectorSteps.reduce(
      (sum, step) => sum + step.collectedValue,
      0,
    );

    eventRound.roundCollectionValue = Math.min(10000, totalCoins + totalPots);
    eventRound.potCount = pots.length;

    this.bonusEventTimeline.push(eventRound);

    return {
      potCount: pots.length,
      roundCollectionValue: eventRound.roundCollectionValue,
    };
  }

  _getGoldenSquareOutcomeChances() {
    if (this.bonusMode?.id === "TREASURE_RAINBOW") {
      return { coin: 0.83, clover: 0.12, pot: 0.05 };
    }

    if (this.bonusMode?.id === "GLITTER_GOLD") {
      return { coin: 0.86, clover: 0.1, pot: 0.04 };
    }

    if (this.bonusMode?.id === "LEPRECHAUN") {
      return { coin: 0.88, clover: 0.09, pot: 0.03 };
    }

    return { coin: 0.9, clover: 0.08, pot: 0.02 };
  }

  _pickRandomRegularPosition() {
    const candidates = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const value = this.currentGrid[y][x];
        if (value >= 1 && value <= 6) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const index = this.rng.nextInt(0, candidates.length - 1);
    return candidates[index];
  }

  _rollCoinValue() {
    const table = [
      { value: 0.2, weight: 18 },
      { value: 0.5, weight: 16 },
      { value: 1, weight: 14 },
      { value: 2, weight: 12 },
      { value: 3, weight: 9 },
      { value: 4, weight: 8 },
      { value: 5, weight: 7 },
      { value: 7, weight: 4 },
      { value: 10, weight: 4 },
      { value: 15, weight: 3 },
      { value: 20, weight: 2 },
      { value: 50, weight: 1 },
      { value: 100, weight: 1 },
      { value: 200, weight: 1 },
      { value: 500, weight: 1 },
    ];

    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.nextInt(0, total - 1);

    for (const entry of table) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.value;
      }
    }

    return 0.2;
  }

  _getCoinTier(value) {
    if (value >= 25) {
      return "gold";
    }

    if (value >= 5) {
      return "silver";
    }

    return "bronze";
  }

  _rollCloverMultiplierValue() {
    const table = [
      { multiplier: 2, weight: 38 },
      { multiplier: 3, weight: 26 },
      { multiplier: 4, weight: 15 },
      { multiplier: 5, weight: 10 },
      { multiplier: 6, weight: 6 },
      { multiplier: 8, weight: 3 },
      { multiplier: 10, weight: 2 },
    ];

    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.nextInt(0, total - 1);

    for (const entry of table) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.multiplier;
      }
    }

    return 2;
  }

  _getModeFromScatterCount(scatterCount) {
    if (scatterCount >= 5) {
      return "TREASURE_RAINBOW";
    }

    if (scatterCount === 4) {
      return "GLITTER_GOLD";
    }

    if (scatterCount === 3) {
      return "LEPRECHAUN";
    }

    return null;
  }
}

export default LuckyScapeSlot;
