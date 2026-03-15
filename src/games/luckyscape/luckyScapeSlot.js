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
import { BonusMode } from "./bonusModes/bonusMode.js";

const DEBUG_OPTION_IDS = Object.freeze({
  CONNECTION_RAINBOW: "connection-rainbow",
  ALL_SYMBOLS: "all-symbols",
  ALL_SYMBOLS_HIGHLIGHTED: "all-symbols-highlighted",
  CONNECTION_SEQUENCE: "connection-sequence",
  WILD_CONNECTIONS: "wild-connections",
  SCATTER_BAIT: "scatter-bait",
});

const DEBUG_BASE_GRID_SEQUENCE = Object.freeze([
  1, 2, 3, 4, 5, 11, 12, 13, 14, 15,
]);
const DEBUG_SHOWCASE_SPECIALS = Object.freeze([
  { x: 5, y: 0, symbolId: 6 },
  { x: 5, y: 1, symbolId: 7 },
  { x: 5, y: 2, symbolId: 8 },
  { x: 5, y: 3, symbolId: 9 },
  { x: 5, y: 4, symbolId: 10 },
]);
const DEBUG_SCATTER_BAIT_POSITIONS = Object.freeze([
  { x: 1, y: 1 },
  { x: 4, y: 3 },
]);
const DEBUG_CONNECTION_SEQUENCE_BOARDS = Object.freeze([
  Object.freeze([
    Object.freeze({
      symbolId: 1,
      pattern: Object.freeze([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ]),
    }),
    Object.freeze({
      symbolId: 11,
      pattern: Object.freeze([
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ]),
    }),
  ]),
  Object.freeze([
    Object.freeze({
      symbolId: 5,
      pattern: Object.freeze([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
      ]),
    }),
    Object.freeze({
      symbolId: 15,
      pattern: Object.freeze([
        { x: 5, y: 0 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
        { x: 5, y: 4 },
      ]),
    }),
  ]),
  Object.freeze([
    Object.freeze({
      symbolId: 12,
      pattern: Object.freeze([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ]),
    }),
    Object.freeze({
      symbolId: 13,
      pattern: Object.freeze([
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ]),
    }),
  ]),
  Object.freeze([
    Object.freeze({
      symbolId: 14,
      pattern: Object.freeze([
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ]),
    }),
    Object.freeze({
      symbolId: 4,
      pattern: Object.freeze([
        { x: 5, y: 1 },
        { x: 4, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
      ]),
    }),
  ]),
]);
const DEBUG_WILD_CONNECTION_BOARDS = Object.freeze([
  Object.freeze([
    Object.freeze([6, 1, 1, 1, 1, 2]),
    Object.freeze([3, 4, 5, 11, 12, 13]),
    Object.freeze([14, 15, 2, 3, 4, 5]),
    Object.freeze([11, 12, 13, 14, 15, 2]),
    Object.freeze([3, 4, 5, 11, 12, 13]),
  ]),
  Object.freeze([
    Object.freeze([6, 1, 1, 4, 5, 11]),
    Object.freeze([3, 4, 6, 11, 12, 13]),
    Object.freeze([14, 15, 1, 3, 4, 5]),
    Object.freeze([11, 12, 13, 14, 15, 2]),
    Object.freeze([3, 4, 5, 11, 12, 13]),
  ]),
  Object.freeze([
    Object.freeze([6, 1, 1, 4, 5, 11]),
    Object.freeze([3, 4, 1, 11, 12, 13]),
    Object.freeze([14, 15, 6, 3, 4, 5]),
    Object.freeze([11, 12, 13, 14, 15, 2]),
    Object.freeze([3, 4, 5, 11, 12, 13]),
  ]),
]);

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
    this.pendingGoldenSquareReset = false;

    this.rainbowTriggered = false;
    this.spinHadRainbowSymbol = false;
    this.rainbowPositions = [];
    this.rainbowSpawnedThisSpin = false;
    this.cloverSymbolsHit = [];
    this.potSymbolsHit = [];
    this.spinCollectionValue = 0;
    this.chainRoundsTriggered = 0;
    this.bonusEventTimeline = [];
    this.bonusHadRainbowActivationThisSession = false;

    this._applyDebugState(config?.debug);
  }

  setDebugOptions(selectedOptions = [], { enabled = true } = {}) {
    this.config.debug = {
      ...(this.config?.debug || {}),
      enabled,
      selectedOptions: Array.isArray(selectedOptions)
        ? [...selectedOptions]
        : [],
      forceConnectionAndRainbow: Array.isArray(selectedOptions)
        ? selectedOptions.includes(DEBUG_OPTION_IDS.CONNECTION_RAINBOW)
        : false,
    };

    this._applyDebugState(this.config.debug);
  }

  async spin(backend, betAmount = 10) {
    // --- Local fallback logic (demo mode or no backend) ---
    this.totalWinFromSpin = 0;
    this.cascadeCount = 0;
    this._resetSpinFeatureState();
    this._prepareSpinGoldenSquareState();

    this.currentGrid = this._generateRandomGrid();
    this._enforceSingleRainbowPerSpin();

    if (
      this._isGuaranteedRainbowSpin() ||
      this._shouldForceMinimumBonusRainbowSpin()
    ) {
      this._injectRainbowIfMissing();
      this._enforceSingleRainbowPerSpin();
    }

    this._applyDebugSpinGuarantees();

    const cascades = [];
    let initialWinPositions = new Set();
    let finalWinPositions = new Set();

    let cascadeIndex = 0;
    const maxCascades = Number(this.config.maxCascadesPerSpin || 20);

    while (cascadeIndex < maxCascades) {
      const winResult = this.detector.findWins(this.currentGrid);
      const activeCluster = winResult.clusters[0] || null;

      if (!activeCluster) {
        break;
      }

      const cascadeWinResult = this._buildCascadeWinResult(
        this.currentGrid,
        activeCluster,
      );

      if (cascadeIndex === 0) {
        initialWinPositions = new Set(cascadeWinResult.winPositions);
      }

      this._trackGoldenSquaresFromWins(cascadeWinResult);
      finalWinPositions = new Set(cascadeWinResult.winPositions);

      const beforeGrid = CascadeEngine.cloneGrid(this.currentGrid);
      const connectionPositions = new Set(cascadeWinResult.winPositions);
      const removePositions = this.detector.getSuperCascadeRemovalPositions(
        this.currentGrid,
        cascadeWinResult,
      );
      for (const connectionKey of connectionPositions) {
        removePositions.add(connectionKey);
      }

      this.totalWinFromSpin += cascadeWinResult.totalWin;

      const cascadeResult = this.engine.executeCascade(
        this.currentGrid,
        removePositions,
        this.rng,
        {
          symbolWeights: this._getSymbolWeightsForCurrentSpin({
            allowRainbow: this._shouldAllowRainbowSymbolInCurrentSpin(),
            includeScatter: true,
          }),
        },
      );

      this.currentGrid = cascadeResult.grid;
      this._enforceSingleRainbowPerSpin();

      cascades.push({
        beforeGrid,
        afterGrid: CascadeEngine.cloneGrid(this.currentGrid),
        winPositions: new Set(removePositions),
        connectionPositions,
        moveData: cascadeResult.moveData,
      });

      this.cascadeCount += 1;
      cascadeIndex += 1;
    }

    this._resolveRainbowActivation();

    if (this.rainbowTriggered && this.isInFreeSpins) {
      this.bonusHadRainbowActivationThisSession = true;
    }

    this.totalWinFromSpin += this.spinCollectionValue;

    const scatterResult = this.detector.findScatters(this.currentGrid);
    let bonusMode = null;

    if (!this.isInFreeSpins) {
      const nextMode = this._getModeFromScatterCount(scatterResult.count);
      if (nextMode) {
        bonusMode = this._createBonusMeta(nextMode);
        this._initializeBonusMode(nextMode, bonusMode.initialSpins);
      }
    }

    const totalWin =
      Math.round(
        (this.totalWinFromSpin * Number(betAmount) + Number.EPSILON) * 100,
      ) / 100;

    // (No backend.reportWin here; reporting is handled by the UI layer per refactor plan)

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
      bonusMode,
      scatterCount: scatterResult.count,
      scatterPositions: scatterResult.positions,
      bonusFeatures: {
        rainbowTriggered: this.rainbowTriggered,
        bonusEventTimeline: this.bonusEventTimeline,
        debugHighlightPositions: this._getDebugHighlightPositions(),
      },
    };
  }

  detectWins(grid) {
    return this.detector.findWins(grid);
  }

  _buildCascadeWinResult(grid, cluster) {
    return this.detector.buildWinResult(grid, cluster ? [cluster] : []);
  }

  _getBonusModeConfig(modeType) {
    const modes = this.config?.bonuses?.modes || {};
    const modeConfig = modes[modeType];
    return modeConfig && typeof modeConfig === "object" ? modeConfig : null;
  }

  _createBonusMeta(modeType) {
    const modeConfig = this._getBonusModeConfig(modeType);
    if (!modeConfig) {
      return null;
    }

    return {
      type: modeType,
      name: modeConfig.name,
      description: modeConfig.description,
      initialSpins: Number(modeConfig.initialSpins || 0),
      triggerScatters: Number(modeConfig.triggerScatters || 0),
    };
  }

  getBonus(finalGrid) {
    const scatterResult = this.detector.findScatters(finalGrid);
    const modeType = this._getModeFromScatterCount(scatterResult.count);

    if (!modeType) {
      return null;
    }

    const bonusMeta = this._createBonusMeta(modeType);
    const initialSpins = bonusMeta?.initialSpins || 0;
    this._initializeBonusMode(modeType, initialSpins);

    return {
      ...bonusMeta,
      spins: initialSpins,
      scatterCount: scatterResult.count,
    };
  }

  _initializeBonusMode(modeType, initialSpins) {
    const modeConfig = this._getBonusModeConfig(modeType);
    if (!modeConfig) {
      throw new Error(`Unknown bonus mode: ${modeType}`);
    }

    this.bonusMode = new BonusMode(initialSpins, {
      id: modeType,
      name: modeConfig.name,
      description: modeConfig.description,
      tier: modeConfig.tier,
      persistGoldenSquaresAfterActivation:
        modeConfig.persistGoldenSquaresAfterActivation,
      guaranteedRainbowEverySpin: modeConfig.guaranteedRainbowEverySpin,
    });
    this.isInFreeSpins = true;
    this.freeSpinsRemaining = initialSpins;
    this.goldenSquares = new Set();
    this.pendingGoldenSquareReset = false;
    this.bonusHadRainbowActivationThisSession = false;
    this._resetSpinFeatureState();
  }

  startBonusMode(modeType) {
    if (this.isInFreeSpins) {
      throw new Error("Cannot start bonus buy during free spins");
    }

    const bonusMeta = this._createBonusMeta(modeType);
    if (!bonusMeta?.initialSpins) {
      throw new Error(`Unknown bonus mode: ${modeType}`);
    }

    const initialSpins = bonusMeta.initialSpins;
    this._initializeBonusMode(modeType, initialSpins);

    return {
      ...bonusMeta,
      initialSpins,
    };
  }

  getBonusBuyOffers(betAmount) {
    const offers = Object.values(this.config?.bonuses?.modes || {})
      .filter((mode) => Number(mode?.bonusBuyMultiplier) > 0)
      .sort(
        (left, right) =>
          Number(left.triggerScatters || 0) -
          Number(right.triggerScatters || 0),
      )
      .map((mode) => {
        const multiplier = Number(mode.bonusBuyMultiplier);
        return {
          modeType: mode.id,
          multiplier,
          cost:
            Math.round(
              (Number(betAmount) * multiplier + Number.EPSILON) * 100,
            ) / 100,
        };
      });

    return {
      enabled: Boolean(this.config?.bonusBuy?.enabled),
      offers,
    };
  }

  handleFreeSpinsRetrigger(newScatterCount) {
    if (!this.isInFreeSpins || !this.bonusMode) {
      return 0;
    }

    if (newScatterCount < 2) {
      return 0;
    }

    const currentModeId = this.bonusMode.id;

    if (currentModeId === "LEPRECHAUN" && newScatterCount >= 4) {
      this._upgradeBonusMode("GLITTER_GOLD", 4);
      return 4;
    }

    if (newScatterCount >= 3) {
      this.bonusMode.remaining += 4;
      this.freeSpinsRemaining = this.bonusMode.remaining;
      return 4;
    }

    if (newScatterCount === 2) {
      this.bonusMode.remaining += 2;
      this.freeSpinsRemaining = this.bonusMode.remaining;
      return 2;
    }

    return 0;
  }

  _upgradeBonusMode(modeType, additionalSpins) {
    const spins = this.freeSpinsRemaining + additionalSpins;
    this._initializeBonusMode(modeType, spins);
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
      this.pendingGoldenSquareReset = false;
      this.bonusHadRainbowActivationThisSession = false;
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
        collectorSteps: round.collectorSteps.map((entry) => ({
          ...entry,
          suckedSources: Array.isArray(entry.suckedSources)
            ? entry.suckedSources.map((source) => ({ ...source }))
            : [],
          clearedSources: Array.isArray(entry.clearedSources)
            ? entry.clearedSources.map((source) => ({ ...source }))
            : [],
          postCollectReveals: Array.isArray(entry.postCollectReveals)
            ? entry.postCollectReveals.map((reveal) => ({ ...reveal }))
            : [],
          postCollectCloverHits: Array.isArray(entry.postCollectCloverHits)
            ? entry.postCollectCloverHits.map((hit) => ({
                ...hit,
                targets: Array.isArray(hit.targets)
                  ? hit.targets.map((target) => ({ ...target }))
                  : [],
              }))
            : [],
        })),
      })),
    };
  }

  getPaytable() {
    const scatterTriggers = Object.fromEntries(
      Object.values(this.config?.bonuses?.modes || {})
        .sort(
          (left, right) =>
            Number(left.triggerScatters || 0) -
            Number(right.triggerScatters || 0),
        )
        .map((mode) => [
          mode.triggerScatters,
          `${mode.name} (${mode.initialSpins} free spins)`,
        ]),
    );

    return {
      symbols: this.config.symbols,
      basePayouts: CascadeDetector.BASE_PAYOUTS,
      clusterPaytable: CascadeDetector.CLUSTER_PAYTABLE,
      clusterMultipliers: CascadeDetector.CLUSTER_MULTIPLIERS,
      scatterTriggers,
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
    const weights = this._getSymbolWeightsForCurrentSpin({
      allowRainbow: this._shouldAllowRainbowSymbolInCurrentSpin(),
      includeScatter: true,
    });

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

    const chance = Number(this.config?.balance?.freeSpinRainbowChance ?? 0.35);
    return this.rng.nextFloat() < chance;
  }

  _prepareSpinGoldenSquareState() {
    const shouldPersistAcrossSpins = this.isInFreeSpins;

    if (!shouldPersistAcrossSpins) {
      this.goldenSquares.clear();
      this.pendingGoldenSquareReset = false;
      return;
    }

    if (this.pendingGoldenSquareReset) {
      this.goldenSquares.clear();
      this.pendingGoldenSquareReset = false;
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

  _shouldForceMinimumBonusRainbowSpin() {
    if (!this.isInFreeSpins || !this.bonusMode) {
      return false;
    }

    if (
      this.bonusMode.id !== "GLITTER_GOLD" &&
      this.bonusMode.id !== "LEPRECHAUN"
    ) {
      return false;
    }

    if (this.bonusHadRainbowActivationThisSession) {
      return false;
    }

    return Number(this.bonusMode.remaining) === 1;
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

    if (rainbows.length === 1) {
      this.rainbowSpawnedThisSpin = true;
      return;
    }

    if (!this.rainbowSpawnedThisSpin) {
      this.rainbowSpawnedThisSpin = true;
    }

    const keepIndex = this.rng.nextInt(0, rainbows.length - 1);
    for (let index = 0; index < rainbows.length; index++) {
      if (index === keepIndex) {
        continue;
      }

      const extra = rainbows[index];
      this.currentGrid[extra.y][extra.x] = this._rollReplacementSymbol();
    }
  }

  _rollReplacementSymbol() {
    const table = this._getSymbolWeightsForCurrentSpin({
      allowRainbow: false,
      includeScatter: true,
    });

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

  _applyDebugSpinGuarantees() {
    if (!this.debugModeEnabled) {
      return;
    }

    if (this._shouldUseScriptedDebugBoard()) {
      this.currentGrid = this._createDebugBaseGrid();
    }

    if (this.debugShowAllSymbols || this.debugShowAllSymbolsHighlighted) {
      this._applyDebugAllSymbolsBoard();
    }

    if (this.debugScatterBaitEnabled && !this.isInFreeSpins) {
      this._forceScatterCount(2, DEBUG_SCATTER_BAIT_POSITIONS);
    }

    if (this.debugConnectionSequenceEnabled) {
      this._applyForcedDebugConnectionGroup(
        this._getDebugConnectionSequenceBoard(),
      );
    }

    if (this.debugWildConnectionsEnabled) {
      this.currentGrid = this._getDebugWildConnectionBoard();
    }

    if (this.debugForceConnectionAndRainbow) {
      this._injectRainbowIfMissing();
      this._enforceSingleRainbowPerSpin();
      this._applyForcedDebugConnection(this._pickDebugConnectionPattern());
    }

    this.debugSpinCounter += 1;
  }

  _pickDebugConnectionPattern({ useSequence = false } = {}) {
    const rainbowKeys = new Set(
      this._findSymbolPositions(9).map((entry) => `${entry.x},${entry.y}`),
    );

    const candidatePatterns = useSequence
      ? this._getDebugConnectionSequenceBoard().map((entry) => entry.pattern)
      : this._getDefaultDebugConnectionPatterns();

    for (const pattern of candidatePatterns) {
      const intersectsRainbow = pattern.some(({ x, y }) =>
        rainbowKeys.has(`${x},${y}`),
      );

      if (!intersectsRainbow) {
        return pattern;
      }
    }

    return null;
  }

  _getDefaultDebugConnectionPatterns() {
    const patterns = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x <= this.gridWidth - 5; x++) {
        patterns.push([
          { x, y },
          { x: x + 1, y },
          { x: x + 2, y },
          { x: x + 3, y },
          { x: x + 4, y },
        ]);
      }
    }

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y <= this.gridHeight - 5; y++) {
        patterns.push([
          { x, y },
          { x, y: y + 1 },
          { x, y: y + 2 },
          { x, y: y + 3 },
          { x, y: y + 4 },
        ]);
      }
    }

    return patterns;
  }

  _getDebugConnectionSequenceBoard() {
    const boardCount = DEBUG_CONNECTION_SEQUENCE_BOARDS.length;
    if (boardCount === 0) {
      return [];
    }

    const board =
      DEBUG_CONNECTION_SEQUENCE_BOARDS[this.debugSpinCounter % boardCount] ||
      [];

    return board.map((entry) => ({
      symbolId: entry.symbolId,
      pattern: entry.pattern.map((cell) => ({ ...cell })),
    }));
  }

  _getDebugWildConnectionBoard() {
    const boardCount = DEBUG_WILD_CONNECTION_BOARDS.length;
    if (boardCount === 0) {
      return this._createDebugBaseGrid();
    }

    const board =
      DEBUG_WILD_CONNECTION_BOARDS[this.debugSpinCounter % boardCount] ||
      DEBUG_WILD_CONNECTION_BOARDS[0];

    return board.map((row) => [...row]);
  }

  _applyForcedDebugConnection(
    pattern,
    symbolId = this._rollDebugRegularSymbol(),
    { allowExistingWins = false } = {},
  ) {
    if (!pattern) {
      return false;
    }

    if (!allowExistingWins) {
      const currentWins = this.detector.findWins(this.currentGrid);
      if (currentWins.clusters.length > 0) {
        return false;
      }
    }

    for (const { x, y } of pattern) {
      this.currentGrid[y][x] = symbolId;
    }

    return true;
  }

  _applyForcedDebugConnectionGroup(connectionGroup = []) {
    let appliedCount = 0;

    for (const connection of connectionGroup) {
      if (
        this._applyForcedDebugConnection(
          connection.pattern,
          connection.symbolId,
          {
            allowExistingWins: true,
          },
        )
      ) {
        appliedCount += 1;
      }
    }

    return appliedCount > 0;
  }

  _rollDebugRegularSymbol() {
    const regularSymbols = [...CascadeDetector.REGULAR_SYMBOL_IDS];
    const index = this.rng.nextInt(0, regularSymbols.length - 1);
    return regularSymbols[index];
  }

  _getSymbolWeightsForCurrentSpin({
    allowRainbow = true,
    includeScatter = true,
  } = {}) {
    const fallbackBaseProfile = {
      ten: 30,
      jack: 27,
      queen: 24,
      king: 20,
      ace: 17,
      trap: 9,
      cheese: 8,
      beer: 6,
      bread: 5,
      topHat: 4,
      wild: 3,
      scatter: 2,
      rainbow: 2,
    };
    const fallbackFreeSpinsProfile = {
      ten: 36,
      jack: 32,
      queen: 28,
      king: 24,
      ace: 20,
      trap: 9,
      cheese: 8,
      beer: 6,
      bread: 5,
      topHat: 4,
      wild: 2,
      scatter: 1,
      rainbow: 2,
    };

    const configuredProfiles = this.config?.balance?.symbolWeightProfiles || {};
    const profile = this.isInFreeSpins
      ? {
          ...fallbackFreeSpinsProfile,
          ...(configuredProfiles.bonuses || {}),
        }
      : {
          ...fallbackBaseProfile,
          ...(configuredProfiles.base || {}),
        };

    return [
      { id: 1, weight: profile.ten },
      { id: 2, weight: profile.jack },
      { id: 3, weight: profile.queen },
      { id: 4, weight: profile.king },
      { id: 5, weight: profile.ace },
      { id: 11, weight: profile.trap },
      { id: 12, weight: profile.cheese },
      { id: 13, weight: profile.beer },
      { id: 14, weight: profile.bread },
      { id: 15, weight: profile.topHat },
      { id: 6, weight: profile.wild },
      { id: 7, weight: includeScatter ? profile.scatter : 0 },
      { id: 9, weight: allowRainbow ? profile.rainbow : 0 },
    ].filter((entry) => entry.weight > 0);
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

  _resolveDebugState(debugConfig = {}) {
    const enabled = Boolean(debugConfig?.enabled);
    const selectedOptions = enabled
      ? this._resolveDebugOptionIds(debugConfig)
      : [];

    return {
      enabled,
      selectedOptions,
    };
  }

  _applyDebugState(debugConfig = {}) {
    const debugState = this._resolveDebugState(debugConfig);
    this.debugModeEnabled = debugState.enabled;
    this.debugSelectedOptions = debugState.selectedOptions;
    this.debugSelectedOptionSet = new Set(debugState.selectedOptions);
    this.debugForceConnectionAndRainbow = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.CONNECTION_RAINBOW,
    );
    this.debugShowAllSymbols = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.ALL_SYMBOLS,
    );
    this.debugShowAllSymbolsHighlighted = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.ALL_SYMBOLS_HIGHLIGHTED,
    );
    this.debugConnectionSequenceEnabled = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.CONNECTION_SEQUENCE,
    );
    this.debugWildConnectionsEnabled = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.WILD_CONNECTIONS,
    );
    this.debugScatterBaitEnabled = this.debugSelectedOptionSet.has(
      DEBUG_OPTION_IDS.SCATTER_BAIT,
    );
    this.debugSpinCounter = 0;
  }

  _resolveDebugOptionIds(debugConfig = {}) {
    const rawSelectedOptions = Array.isArray(debugConfig?.selectedOptions)
      ? debugConfig.selectedOptions
      : [];

    const normalizedOptions = [
      ...new Set(
        rawSelectedOptions
          .map((entry) => String(entry || "").trim())
          .filter(Boolean),
      ),
    ];

    if (normalizedOptions.length > 0) {
      return normalizedOptions;
    }

    if (Boolean(debugConfig?.forceConnectionAndRainbow)) {
      return [DEBUG_OPTION_IDS.CONNECTION_RAINBOW];
    }

    return [];
  }

  _shouldUseScriptedDebugBoard() {
    return (
      this.debugShowAllSymbols ||
      this.debugShowAllSymbolsHighlighted ||
      this.debugConnectionSequenceEnabled ||
      this.debugWildConnectionsEnabled ||
      (this.debugScatterBaitEnabled && !this.isInFreeSpins)
    );
  }

  _createDebugBaseGrid() {
    return Array.from({ length: this.gridHeight }, (_, y) =>
      Array.from({ length: this.gridWidth }, (_, x) => {
        const index = y * this.gridWidth + x;
        return DEBUG_BASE_GRID_SEQUENCE[
          index % DEBUG_BASE_GRID_SEQUENCE.length
        ];
      }),
    );
  }

  _applyDebugAllSymbolsBoard() {
    for (const { x, y, symbolId } of DEBUG_SHOWCASE_SPECIALS) {
      if (y < this.gridHeight && x < this.gridWidth) {
        this.currentGrid[y][x] = symbolId;
      }
    }
  }

  _getDebugHighlightPositions() {
    if (!this.debugShowAllSymbolsHighlighted) {
      return [];
    }

    return Array.from({ length: this.gridHeight }, (_, y) =>
      Array.from({ length: this.gridWidth }, (_, x) => ({ x, y })),
    ).flat();
  }

  _forceScatterCount(targetCount, preferredPositions = []) {
    const preferredKeys = new Set();

    for (const { x, y } of preferredPositions) {
      if (preferredKeys.size >= targetCount) {
        break;
      }

      if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) {
        continue;
      }

      this.currentGrid[y][x] = 7;
      preferredKeys.add(`${x},${y}`);
    }

    const scatterPositions = this._findSymbolPositions(7);
    for (const position of scatterPositions) {
      const key = `${position.x},${position.y}`;
      if (preferredKeys.has(key)) {
        continue;
      }

      this.currentGrid[position.y][position.x] = this._rollDebugRegularSymbol();
    }

    while (this._findSymbolPositions(7).length < targetCount) {
      const cell = this._pickRandomRegularPosition();
      if (!cell) {
        break;
      }

      this.currentGrid[cell.y][cell.x] = 7;
    }
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

    this.chainRoundsTriggered = this._runGoldenSquareChainRounds(1);

    this._resolveGoldenSquarePostSpinCleanup(true);
  }

  _resolveGoldenSquarePostSpinCleanup(wasActivated) {
    if (!this.isInFreeSpins) {
      if (wasActivated) {
        this.goldenSquares.clear();
      }
      this.pendingGoldenSquareReset = false;
      return;
    }

    if (!wasActivated) {
      return;
    }

    if (!this.bonusMode?.persistGoldenSquaresAfterActivation) {
      this.pendingGoldenSquareReset = true;
    }
  }

  finalizeSpinVisualState() {
    if (!this.pendingGoldenSquareReset) {
      return;
    }

    this.goldenSquares.clear();
    this.pendingGoldenSquareReset = false;
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
    const eventRound = {
      roundIndex,
      reveals: [],
      cloverHits: [],
      collectorSteps: [],
      roundCollectionValue: 0,
      potCount: 0,
    };

    const tileState = new Map();
    const collectorQueue = [];
    const queuedCollectors = new Set();

    const parseKey = (key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    };

    const queueCollector = (key) => {
      if (queuedCollectors.has(key)) {
        return;
      }
      collectorQueue.push(key);
      queuedCollectors.add(key);
    };

    const getCollectorCount = () =>
      [...tileState.values()].filter(
        (tile) =>
          tile.type === "collector_empty" || tile.type === "collector_full",
      ).length;

    const revealAtKey = (key, targetList) => {
      const { x, y } = parseKey(key);
      const roll = this.rng.nextFloat();
      const chances = this._getGoldenSquareOutcomeChances();
      const collectorCount = getCollectorCount();
      const adjustedPotChance = this._getAdjustedPotChance(
        chances.pot,
        collectorCount,
      );

      const createCoinTile = () => {
        const value = this._rollCoinValue();
        const tile = {
          key,
          x,
          y,
          type: "coin",
          value,
          tier: this._getCoinTier(value),
        };
        tileState.set(key, tile);
        targetList.push({ x, y, type: "coin", value, tier: tile.tier });
        return tile;
      };

      if (roll < chances.coin) {
        return createCoinTile();
      }

      if (roll < chances.coin + chances.clover) {
        const multiplier = this._rollCloverMultiplierValue();
        const tile = {
          key,
          x,
          y,
          type: "clover",
          value: multiplier,
        };
        tileState.set(key, tile);
        this.cloverSymbolsHit.push(multiplier);
        targetList.push({ x, y, type: "clover", value: multiplier });
        return tile;
      }

      if (roll < chances.coin + chances.clover + adjustedPotChance) {
        const tile = {
          key,
          x,
          y,
          type: "collector_empty",
          value: 1,
        };
        tileState.set(key, tile);
        this.potSymbolsHit.push(1);
        targetList.push({ x, y, type: "collector", value: 1 });
        queueCollector(key);
        return tile;
      }

      return createCoinTile();
    };

    const applyCloverMultipliers = (
      cloverKeys,
      roundTargetList,
      stepTargetList,
    ) => {
      for (const cloverKey of cloverKeys) {
        const cloverTile = tileState.get(cloverKey);
        if (!cloverTile || cloverTile.type !== "clover") {
          continue;
        }

        const targets = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) {
              continue;
            }

            const tx = cloverTile.x + dx;
            const ty = cloverTile.y + dy;
            if (
              tx < 0 ||
              tx >= this.gridWidth ||
              ty < 0 ||
              ty >= this.gridHeight
            ) {
              continue;
            }

            const targetKey = `${tx},${ty}`;
            const targetTile = tileState.get(targetKey);
            if (!targetTile) {
              continue;
            }

            if (targetTile.type === "coin") {
              const before = targetTile.value;
              const after = before * cloverTile.value;
              targetTile.value = after;
              targetTile.tier = this._getCoinTier(after);
              targets.push({ x: tx, y: ty, type: "coin", before, after });
              continue;
            }

            if (targetTile.type === "collector_full") {
              const before = targetTile.value;
              const after = before * cloverTile.value;
              targetTile.value = after;
              targets.push({
                x: tx,
                y: ty,
                type: "collector",
                collectorState: "full",
                before,
                after,
              });
            }
          }
        }

        if (targets.length === 0) {
          continue;
        }

        const cloverHit = {
          x: cloverTile.x,
          y: cloverTile.y,
          multiplier: cloverTile.value,
          targets,
        };

        if (Array.isArray(roundTargetList)) {
          roundTargetList.push(cloverHit);
        }
        if (Array.isArray(stepTargetList)) {
          stepTargetList.push(cloverHit);
        }
      }
    };

    const initialCloverKeys = [];
    const sortedGoldenKeys = [...this.goldenSquares].sort((left, right) => {
      const [lx, ly] = left.split(",").map(Number);
      const [rx, ry] = right.split(",").map(Number);
      return ly === ry ? lx - rx : ly - ry;
    });

    for (const key of sortedGoldenKeys) {
      const revealedTile = revealAtKey(key, eventRound.reveals);
      if (revealedTile?.type === "clover") {
        initialCloverKeys.push(key);
      }
    }

    if (
      this.debugModeEnabled &&
      this.debugForceConnectionAndRainbow &&
      collectorQueue.length === 0
    ) {
      const forcedCollectorKey = sortedGoldenKeys.find((key) => {
        const tile = tileState.get(key);
        return tile && tile.type !== "collector_empty";
      });

      if (forcedCollectorKey) {
        const { x, y } = parseKey(forcedCollectorKey);
        const currentTile = tileState.get(forcedCollectorKey);
        if (currentTile?.type === "clover") {
          const cloverIndex = initialCloverKeys.indexOf(forcedCollectorKey);
          if (cloverIndex >= 0) {
            initialCloverKeys.splice(cloverIndex, 1);
          }

          const cloverValueIndex = this.cloverSymbolsHit.findIndex(
            (value) => value === currentTile.value,
          );
          if (cloverValueIndex >= 0) {
            this.cloverSymbolsHit.splice(cloverValueIndex, 1);
          }
        }

        tileState.set(forcedCollectorKey, {
          key: forcedCollectorKey,
          x,
          y,
          type: "collector_empty",
          value: 1,
        });

        const revealIndex = eventRound.reveals.findIndex(
          (entry) => entry.x === x && entry.y === y,
        );
        if (revealIndex >= 0) {
          eventRound.reveals[revealIndex] = {
            x,
            y,
            type: "collector",
            value: 1,
          };
        } else {
          eventRound.reveals.push({ x, y, type: "collector", value: 1 });
        }

        this.potSymbolsHit.push(1);
        queueCollector(forcedCollectorKey);
      }
    }

    applyCloverMultipliers(initialCloverKeys, eventRound.cloverHits);

    let runningCollectedTotal = 0;
    const processedCollectors = new Set();

    while (collectorQueue.length > 0) {
      const collectorKey = collectorQueue.shift();
      if (processedCollectors.has(collectorKey)) {
        continue;
      }

      const collectorTile = tileState.get(collectorKey);
      if (
        !collectorTile ||
        (collectorTile.type !== "collector_empty" &&
          collectorTile.type !== "collector_full")
      ) {
        processedCollectors.add(collectorKey);
        continue;
      }

      const suckedSources = [];
      const spentClovers = [];
      for (const [key, tile] of tileState.entries()) {
        if (key === collectorKey) {
          continue;
        }

        if (tile.type === "coin" || tile.type === "collector_full") {
          suckedSources.push({
            x: tile.x,
            y: tile.y,
            type: tile.type === "coin" ? "coin" : "collector",
            value: tile.value,
          });
          continue;
        }

        if (tile.type === "clover") {
          spentClovers.push({
            x: tile.x,
            y: tile.y,
            type: "clover",
            value: tile.value,
          });
        }
      }

      suckedSources.sort((left, right) =>
        left.y === right.y ? left.x - right.x : left.y - right.y,
      );
      spentClovers.sort((left, right) =>
        left.y === right.y ? left.x - right.x : left.y - right.y,
      );
      const clearedSources = [...suckedSources, ...spentClovers];

      const collectedBeforeMultiplier = suckedSources.reduce(
        (sum, source) => sum + source.value,
        0,
      );
      const multiplier = collectorTile.value;
      const collectedValue = collectedBeforeMultiplier * multiplier;
      runningCollectedTotal += collectedValue;

      collectorTile.type = "collector_full";
      collectorTile.value = collectedValue;
      tileState.set(collectorKey, collectorTile);

      const sourceKeys = clearedSources.map((entry) => `${entry.x},${entry.y}`);
      for (const sourceKey of sourceKeys) {
        tileState.delete(sourceKey);
      }

      const step = {
        x: collectorTile.x,
        y: collectorTile.y,
        multiplier,
        collectedBeforeMultiplier,
        collectedValue,
        runningTotalAfter: runningCollectedTotal,
        suckedSources,
        clearedSources,
        postCollectReveals: [],
        postCollectCloverHits: [],
      };

      const postCollectCloverKeys = [];
      for (const sourceKey of sourceKeys) {
        if (sourceKey === collectorKey) {
          continue;
        }

        const revealedTile = revealAtKey(sourceKey, step.postCollectReveals);
        if (revealedTile?.type === "clover") {
          postCollectCloverKeys.push(sourceKey);
        }
      }

      applyCloverMultipliers(
        postCollectCloverKeys,
        null,
        step.postCollectCloverHits,
      );

      eventRound.collectorSteps.push(step);
      processedCollectors.add(collectorKey);
    }

    const finalCoins = [...tileState.values()]
      .filter((tile) => tile.type === "coin")
      .reduce((sum, tile) => sum + tile.value, 0);
    const totalCollectedByCollectors = [...tileState.values()]
      .filter((tile) => tile.type === "collector_full")
      .reduce((sum, tile) => sum + Number(tile.value || 0), 0);

    eventRound.roundCollectionValue = Math.min(
      10000,
      totalCollectedByCollectors + finalCoins,
    );
    eventRound.potCount = eventRound.collectorSteps.length;

    this.bonusEventTimeline.push(eventRound);

    return {
      potCount: eventRound.potCount,
      roundCollectionValue: eventRound.roundCollectionValue,
    };
  }

  _getGoldenSquareOutcomeChances() {
    const fallback = { coin: 0.9, clover: 0.08, pot: 0.02 };
    const byMode = this.config?.balance?.goldenSquareOutcomeChances || {};
    const modeId = this.bonusMode?.id;
    const configured = modeId ? byMode[modeId] : null;

    return {
      ...fallback,
      ...(byMode.default || {}),
      ...(configured || {}),
    };
  }

  _getAdjustedPotChance(basePotChance, collectorCount) {
    const chance = Number(basePotChance || 0);
    if (chance <= 0) {
      return 0;
    }

    const adjustments = this.config?.balance?.potChanceAdjustment || {};
    const globalReduction = Number(adjustments.globalReduction ?? 0.75);
    const perCollectorDecay = Number(adjustments.perCollectorDecay ?? 0.65);

    return (
      chance * globalReduction * Math.pow(perCollectorDecay, collectorCount)
    );
  }

  _pickRandomRegularPosition() {
    const regularSymbols = CascadeDetector.REGULAR_SYMBOL_IDS;
    const candidates = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const value = this.currentGrid[y][x];
        if (regularSymbols.has(value)) {
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
    const modeId = this.bonusMode?.id;
    const weights = this.config?.balance?.coinValueWeights || {};

    // Look for a table matching the specific mode name, then fall back to default
    const table = weights[modeId] || weights.default;

    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.nextInt(0, total - 1);

    for (const entry of table) {
      roll -= entry.weight;
      if (roll < 0) {
        return entry.value;
      }
    }

    return modeId === "TREASURE_RAINBOW" ? 5 : 0.2;
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
    const fallbackTable = [
      { multiplier: 2, weight: 40 },
      { multiplier: 3, weight: 28 },
      { multiplier: 4, weight: 16 },
      { multiplier: 5, weight: 10 },
      { multiplier: 10, weight: 6 },
    ];
    const table =
      this.config?.balance?.cloverMultiplierWeights || fallbackTable;

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
    const modes = Object.values(this.config?.bonuses?.modes || {}).sort(
      (left, right) =>
        Number(right.triggerScatters || 0) - Number(left.triggerScatters || 0),
    );

    const mode = modes.find(
      (entry) => scatterCount >= Number(entry.triggerScatters || 0),
    );

    return mode?.id || null;
  }
}
