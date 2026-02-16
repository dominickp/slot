/**
 * Pixi Grid Renderer
 *
 * Renders a configurable cluster slot grid using Pixi.js
 * Handles symbol display, animations, and win highlights
 */

import * as PIXI from "pixi.js";
import {
  ANIMATION_TIMING,
  getRevealPacing,
} from "../config/animationTiming.js";

// Symbol IDs mapping
const SYMBOLS = {
  EMPTY: 0,
  TEN: 1,
  JACK: 2,
  QUEEN: 3,
  KING: 4,
  ACE: 5,
  WILD: 6,
  SCATTER: 7,
  CLOVER: 8,
  RAINBOW: 9,
  BUCKET: 10,
  TRAP: 11,
  CHEESE: 12,
  BEER: 13,
  BREAD: 14,
  TOP_HAT: 15,
};

// Symbol colors/styling
const SYMBOL_COLORS = {
  [SYMBOLS.TEN]: 0x9d8665,
  [SYMBOLS.JACK]: 0xa09170,
  [SYMBOLS.QUEEN]: 0xaa9f87,
  [SYMBOLS.KING]: 0xb5a68c,
  [SYMBOLS.ACE]: 0xc2b39a,
  [SYMBOLS.WILD]: 0xe6d7b6,
  [SYMBOLS.SCATTER]: 0xb68f4c,
  [SYMBOLS.CLOVER]: 0x67c37d,
  [SYMBOLS.RAINBOW]: 0x6fb5e8,
  [SYMBOLS.BUCKET]: 0xe1a974,
  [SYMBOLS.TRAP]: 0xb39064,
  [SYMBOLS.CHEESE]: 0xd1ad4f,
  [SYMBOLS.BEER]: 0xc5844d,
  [SYMBOLS.BREAD]: 0xba8b58,
  [SYMBOLS.TOP_HAT]: 0x2f2f36,
};

const SYMBOL_LABELS = {
  [SYMBOLS.TEN]: "10",
  [SYMBOLS.JACK]: "J",
  [SYMBOLS.QUEEN]: "Q",
  [SYMBOLS.KING]: "K",
  [SYMBOLS.ACE]: "A",
  [SYMBOLS.WILD]: "W",
  [SYMBOLS.SCATTER]: "FS",
  [SYMBOLS.CLOVER]: "🍀",
  [SYMBOLS.RAINBOW]: "🌈",
  [SYMBOLS.BUCKET]: "🏺",
  [SYMBOLS.TRAP]: "⛓",
  [SYMBOLS.CHEESE]: "🧀",
  [SYMBOLS.BEER]: "🍺",
  [SYMBOLS.BREAD]: "🥖",
  [SYMBOLS.TOP_HAT]: "🎩",
  101: "🟤",
  102: "⚪",
  103: "🟡",
};

const REVEAL_SYMBOLS = {
  BRONZE_COIN: 101,
  SILVER_COIN: 102,
  GOLD_COIN: 103,
  CLOVER: SYMBOLS.CLOVER,
  POT: SYMBOLS.BUCKET,
};

export class GridRenderer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.cellSize = options.cellSize || 80;
    this.padding = options.padding || 10;
    this.rows = options.rows || 5;
    this.cols = options.cols || 6;

    this.app = null;
    this.gridContainer = null;
    this.animationContainer = null;
    this.bonusLabel = null;

    // Store symbols for animation
    this.symbolCells = {}; // { x_y: PIXI.Container }
    this.winHighlights = []; // For highlighting winning symbols
    this.persistentConnectionHighlights = new Set();
    this.revealedSymbolMap = new Map(); // key => { symbolId, label, accentColor }
    this.persistentPotKey = null;
    this.lastRenderedGrid = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(SYMBOLS.EMPTY),
    );
    this.bonusVisuals = {
      modeName: null,
      modeId: null,
      goldenSquares: new Set(),
      rainbowTriggered: false,
      rainbowPositions: [],
      persistGoldenSquaresAfterActivation: false,
      guaranteedRainbowEverySpin: false,
    };

    this.ready = this._initApp();
  }

  _normalizePosKey(posKey) {
    if (typeof posKey !== "string") {
      return "";
    }

    if (posKey.includes("_")) {
      return posKey;
    }

    if (posKey.includes(",")) {
      const [x, y] = posKey.split(",");
      return `${x}_${y}`;
    }

    return posKey;
  }

  _isWinningPosition(winPositions, key) {
    if (!winPositions || typeof winPositions.has !== "function") {
      return false;
    }

    return winPositions.has(key) || winPositions.has(key.replace("_", ","));
  }

  _isHighlightedPosition(winPositions, key) {
    if (this._isWinningPosition(winPositions, key)) {
      return true;
    }

    return (
      this.persistentConnectionHighlights.has(key) ||
      this.persistentConnectionHighlights.has(key.replace("_", ","))
    );
  }

  _clearAnimationLayer() {
    if (!this.animationContainer) {
      return;
    }

    for (let i = this.animationContainer.children.length - 1; i >= 0; i--) {
      const child = this.animationContainer.children[i];
      this.animationContainer.removeChild(child);
      if (typeof child.destroy === "function") {
        child.destroy({ children: true });
      }
    }
  }

  _getChangedKeys(beforeGrid, afterGrid) {
    const changedKeys = new Set();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (beforeGrid[y][x] !== afterGrid[y][x]) {
          changedKeys.add(`${x}_${y}`);
        }
      }
    }
    return changedKeys;
  }

  _buildCascadeStartRows(beforeGrid, afterGrid, winPositions) {
    const startRows = new Map();

    for (let x = 0; x < this.cols; x++) {
      const survivors = [];

      for (let y = 0; y < this.rows; y++) {
        const symbol = beforeGrid?.[y]?.[x] ?? SYMBOLS.EMPTY;
        if (symbol === SYMBOLS.EMPTY) {
          continue;
        }

        const key = `${x}_${y}`;
        if (this._isWinningPosition(winPositions, key)) {
          continue;
        }

        survivors.push({ symbol, y });
      }

      let survivorIndex = survivors.length - 1;
      let spawnedCount = 0;

      for (let y = this.rows - 1; y >= 0; y--) {
        const symbol = afterGrid?.[y]?.[x] ?? SYMBOLS.EMPTY;
        if (symbol === SYMBOLS.EMPTY) {
          continue;
        }

        const key = `${x}_${y}`;
        const survivor = survivorIndex >= 0 ? survivors[survivorIndex] : null;

        if (survivor && survivor.symbol === symbol) {
          startRows.set(key, survivor.y);
          survivorIndex -= 1;
          continue;
        }

        startRows.set(key, -1 - spawnedCount * 0.55);
        spawnedCount += 1;
      }
    }

    return startRows;
  }

  _hasBonusPosition(source, x, y) {
    if (!source) {
      return false;
    }

    const commaKey = `${x},${y}`;
    const underscoreKey = `${x}_${y}`;

    if (typeof source.has === "function") {
      return source.has(commaKey) || source.has(underscoreKey);
    }

    return false;
  }

  _getGoldenMultiplier(x, y) {
    const goldenSquares = this.bonusVisuals.goldenSquares;
    if (!goldenSquares || typeof goldenSquares.has !== "function") {
      return null;
    }

    if (goldenSquares.has(`${x},${y}`) || goldenSquares.has(`${x}_${y}`)) {
      return 1;
    }

    return null;
  }

  _drawCellBonusOverlay(cellContainer, x, y) {
    if (!this.bonusVisuals?.modeName) {
      return;
    }

    if (this.bonusVisuals.rainbowTriggered) {
      return;
    }
  }

  _drawCellBackground(cellContainer, options = {}) {
    const {
      highlighted = false,
      bonusGolden = false,
      activeRainbow = false,
    } = options;

    const oldBackground = cellContainer.children[0];
    if (oldBackground) {
      cellContainer.removeChild(oldBackground);
      if (typeof oldBackground.destroy === "function") {
        oldBackground.destroy({ children: true });
      }
    }

    const background = new PIXI.Graphics();
    background.rect(0, 0, this.cellSize, this.cellSize);

    if (highlighted || bonusGolden) {
      background.fill({ color: 0x8a6a24, alpha: 1 });

      const innerGlow = new PIXI.Graphics();
      innerGlow.rect(4, 4, this.cellSize - 8, this.cellSize - 8);
      innerGlow.fill({ color: 0xe6bc5a, alpha: highlighted ? 0.42 : 0.28 });
      background.addChild(innerGlow);
    } else {
      background.fill(0x333333);
      background.stroke({ color: 0x555555, width: 2 });
    }

    if (activeRainbow && (highlighted || bonusGolden)) {
      // Intentionally no extra pulse stroke to keep bonus visuals cleaner.
    }

    cellContainer.addChildAt(background, 0);
  }

  _renderBonusLabel(show = true) {
    if (this.bonusLabel && this.app?.stage) {
      this.app.stage.removeChild(this.bonusLabel);
      this.bonusLabel.destroy();
      this.bonusLabel = null;
    }

    // Intentionally no floating debug/status text above the game board.
  }

  async _initApp() {
    const appOptions = {
      width: this.cols * this.cellSize + this.padding * 2,
      height: this.rows * this.cellSize + this.padding * 2,
      backgroundColor: 0x1a1a2e,
      antialias: true,
    };

    const app = new PIXI.Application();
    if (typeof app.init === "function") {
      await app.init(appOptions);
    }

    this.app = app;
    this.container.appendChild(this.app.canvas);

    this.gridContainer = new PIXI.Container();
    this.gridContainer.position.set(this.padding, this.padding);
    this.app.stage.addChild(this.gridContainer);

    this.animationContainer = new PIXI.Container();
    this.animationContainer.position.set(this.padding, this.padding);
    this.app.stage.addChild(this.animationContainer);

    this._createGrid();
  }

  /**
   * Create empty grid structure
   */
  _createGrid() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const key = `${x}_${y}`;
        const cellContainer = new PIXI.Container();
        cellContainer.position.set(x * this.cellSize, y * this.cellSize);

        this._drawCellBackground(cellContainer, {
          highlighted: false,
          bonusGolden: false,
          activeRainbow: false,
        });

        this.gridContainer.addChild(cellContainer);
        this.symbolCells[key] = cellContainer;
      }
    }
  }

  /**
   * Render a grid state (2D array of symbol IDs)
   */
  render(gridData, winPositions = new Set(), options = {}) {
    if (!this.gridContainer) {
      return;
    }

    const { showBonusOverlays = true } = options;

    this.lastRenderedGrid = gridData.map((row) => [...row]);

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const key = `${x}_${y}`;
        const revealData = this.revealedSymbolMap.get(key);
        const symbolId = revealData?.symbolId ?? gridData[y][x];
        const cellContainer = this.symbolCells[key];
        const isWin = this._isHighlightedPosition(winPositions, key);
        const hasGoldenSquare = Boolean(this._getGoldenMultiplier(x, y));

        this._drawCellBackground(cellContainer, {
          highlighted: isWin,
          bonusGolden: hasGoldenSquare,
          activeRainbow: Boolean(this.bonusVisuals.rainbowTriggered),
        });

        // Remove old symbol (keep background)
        while (cellContainer.children.length > 1) {
          const child = cellContainer.removeChildAt(1);
          if (child && typeof child.destroy === "function") {
            child.destroy({ children: true });
          }
        }

        if (symbolId !== SYMBOLS.EMPTY) {
          const symbol = this._createSymbolSprite(symbolId);

          // Position symbol
          const padding = 5;
          symbol.position.set(padding, padding);
          symbol.width = this.cellSize - padding * 2;
          symbol.height = this.cellSize - padding * 2;

          symbol.alpha = isWin || hasGoldenSquare ? 0.97 : 1;

          cellContainer.addChild(symbol);

          if (revealData?.label) {
            const label = new PIXI.Text({
              text: revealData.label,
              style: {
                fontFamily: "Arial",
                fontSize: 22,
                fontWeight: "bold",
                fill: revealData.accentColor ?? 0x132235,
                align: "center",
                stroke: { color: 0xfdf5dc, width: 4, join: "round" },
              },
            });

            label.anchor.set(0.5, 1);
            label.position.set(this.cellSize / 2, this.cellSize - 10);
            cellContainer.addChild(label);
          }
        }

        if (showBonusOverlays) {
          this._drawCellBonusOverlay(cellContainer, x, y);
        }
      }
    }

    this._renderBonusLabel(showBonusOverlays);
  }

  _createCellSizedSprite(symbolId, padding = 5) {
    const sprite = this._createSymbolSprite(symbolId);
    sprite.width = this.cellSize - padding * 2;
    sprite.height = this.cellSize - padding * 2;
    sprite.__baseScaleX = sprite.scale.x;
    sprite.__baseScaleY = sprite.scale.y;
    return sprite;
  }

  _resetSpriteToBaseScale(sprite) {
    if (!sprite || !sprite.scale) {
      return;
    }

    const scaleX =
      typeof sprite.__baseScaleX === "number"
        ? sprite.__baseScaleX
        : sprite.scale.x;
    const scaleY =
      typeof sprite.__baseScaleY === "number"
        ? sprite.__baseScaleY
        : sprite.scale.y;

    sprite.scale.set(scaleX, scaleY);
  }

  _formatBonusValue(value) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  _createOverlayBadge(text, color) {
    const label = new PIXI.Text({
      text,
      style: {
        fontFamily: "Arial",
        fontSize: 16,
        fontWeight: "bold",
        fill: color,
        align: "center",
      },
    });

    const badgeWidth = Math.max(68, Math.ceil(label.width) + 20);
    const badgeHeight = 32;

    const badge = new PIXI.Container();
    const background = new PIXI.Graphics();
    background.roundRect(
      -badgeWidth / 2,
      -badgeHeight / 2,
      badgeWidth,
      badgeHeight,
      10,
    );
    background.fill({ color: 0x000000, alpha: 0.68 });
    background.stroke({ color, width: 2 });
    badge.addChild(background);

    label.anchor.set(0.5, 0.5);
    badge.addChild(label);
    return badge;
  }

  _coinTierStyle(tier) {
    if (tier === "gold") {
      return { label: "GOLD", color: 0xffd94a };
    }

    if (tier === "silver") {
      return { label: "SILVER", color: 0xd7e2f0 };
    }

    return { label: "BRONZE", color: 0xd69763 };
  }

  _cellCenter(x, y) {
    return {
      x: x * this.cellSize + this.cellSize / 2,
      y: y * this.cellSize + this.cellSize / 2,
    };
  }

  async _animateBadgeAtCell(
    x,
    y,
    text,
    color,
    duration = ANIMATION_TIMING.renderer.defaults.badgeMs,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const center = this._cellCenter(x, y);
      const badge = this._createOverlayBadge(text, color);
      badge.position.set(center.x, center.y);
      badge.alpha = 0;
      this.animationContainer.addChild(badge);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        badge.alpha =
          progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;
        badge.y = center.y - 12 * progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.animationContainer.removeChild(badge);
          badge.destroy({ children: true });
          resolve();
        }
      };

      animate();
    });
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _animateFocusedTileAtCell(
    x,
    y,
    duration = ANIMATION_TIMING.renderer.defaults.focusedTileMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const center = this._cellCenter(x, y);
      const symbolId = this._getVisibleSymbolIdAt(x, y);
      const tilePadding = 5;
      const width = this.cellSize - tilePadding * 2;
      const height = this.cellSize - tilePadding * 2;
      const {
        accentColor = 0x93ffb8,
        maxScale = 1.18,
        growMs = 170,
        shrinkMs = 170,
      } = options;

      const safeGrowMs = Math.max(80, Math.min(duration / 2, growMs));
      const safeShrinkMs = Math.max(80, Math.min(duration / 2, shrinkMs));
      const holdMs = Math.max(0, duration - safeGrowMs - safeShrinkMs);

      const overlay = new PIXI.Container();
      overlay.position.set(center.x, center.y);

      const focusTile = this._createCellSizedSprite(symbolId, 0);
      focusTile.width = width;
      focusTile.height = height;
      focusTile.pivot.set(width / 2, height / 2);
      focusTile.position.set(0, 0);
      overlay.addChild(focusTile);

      const glow = new PIXI.Graphics();
      glow.roundRect(-width / 2, -height / 2, width, height, 14);
      glow.stroke({ color: accentColor, width: 4, alpha: 0.9 });
      overlay.addChild(glow);

      const aura = new PIXI.Graphics();
      aura.roundRect(
        -width / 2 - 3,
        -height / 2 - 3,
        width + 6,
        height + 6,
        16,
      );
      aura.fill({ color: accentColor, alpha: 0.16 });
      overlay.addChildAt(aura, 0);

      this.animationContainer.addChild(overlay);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        let scaleProgress = 0;

        if (elapsed <= safeGrowMs) {
          const growProgress = elapsed / safeGrowMs;
          scaleProgress = 1 - Math.pow(1 - growProgress, 3);
        } else if (elapsed <= safeGrowMs + holdMs) {
          scaleProgress = 1;
        } else {
          const shrinkProgress = Math.min(
            (elapsed - safeGrowMs - holdMs) / safeShrinkMs,
            1,
          );
          scaleProgress = 1 - Math.pow(shrinkProgress, 3);
        }

        const focusScale = 1 + (maxScale - 1) * scaleProgress;
        overlay.scale.set(focusScale);
        overlay.position.set(center.x, center.y);
        overlay.rotation = 0;
        glow.alpha = 0.25 + scaleProgress * 0.7;
        aura.alpha = 0.06 + scaleProgress * 0.24;

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        this.animationContainer.removeChild(overlay);
        overlay.destroy({ children: true });
        resolve();
      };

      animate();
    });
  }

  async _animateMultiplierBurstFromClover(
    cloverHit,
    targets,
    duration = ANIMATION_TIMING.renderer.defaults.multiplierBurstMs,
  ) {
    await this.ready;

    if (!Array.isArray(targets) || targets.length === 0) {
      return;
    }

    const start = this._cellCenter(cloverHit.x, cloverHit.y);
    const multiplierLabel = `x${this._formatBonusValue(cloverHit.multiplier)}`;

    const packets = targets.map((target) => {
      const packet = new PIXI.Container();

      const badge = new PIXI.Graphics();
      badge.roundRect(-22, -14, 44, 28, 10);
      badge.fill({ color: 0x294527, alpha: 0.86 });
      badge.stroke({ color: 0x7fe18f, width: 2 });
      packet.addChild(badge);

      const text = new PIXI.Text({
        text: multiplierLabel,
        style: {
          fontFamily: "Arial",
          fontSize: 14,
          fontWeight: "bold",
          fill: 0xd8ffe0,
          align: "center",
        },
      });
      text.anchor.set(0.5, 0.5);
      packet.addChild(text);

      packet.position.set(start.x, start.y);
      packet.alpha = 0;
      packet.scale.set(0.86);
      this.animationContainer.addChild(packet);

      return {
        packet,
        destination: this._cellCenter(target.x, target.y),
      };
    });

    await new Promise((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        for (const item of packets) {
          item.packet.x = start.x + (item.destination.x - start.x) * eased;
          item.packet.y =
            start.y +
            (item.destination.y - start.y) * eased -
            Math.sin(progress * Math.PI) * (this.cellSize * 0.16);

          item.packet.alpha =
            progress < 0.15
              ? progress / 0.15
              : progress > 0.88
                ? 1 - (progress - 0.88) / 0.12
                : 1;
          item.packet.scale.set(0.86 + Math.sin(progress * Math.PI) * 0.26);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        resolve();
      };

      animate();
    });

    for (const item of packets) {
      this.animationContainer.removeChild(item.packet);
      item.packet.destroy({ children: true });
    }
  }

  async _animateCellUpgradePulse(
    x,
    y,
    beforeValue,
    afterValue,
    duration = ANIMATION_TIMING.renderer.defaults.upgradePulseMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const center = this._cellCenter(x, y);
      const symbolId = this._getVisibleSymbolIdAt(x, y);
      const tilePadding = 5;
      const width = this.cellSize - tilePadding * 2;
      const height = this.cellSize - tilePadding * 2;

      const overlay = new PIXI.Container();
      overlay.position.set(center.x, center.y);

      const tile = this._createCellSizedSprite(symbolId, 0);
      tile.width = width;
      tile.height = height;
      tile.pivot.set(width / 2, height / 2);
      tile.position.set(0, 0);
      overlay.addChild(tile);

      const glow = new PIXI.Graphics();
      glow.roundRect(-width / 2, -height / 2, width, height, 14);
      glow.stroke({ color: 0x93ffb8, width: 4, alpha: 0.86 });
      glow.alpha = 0;
      overlay.addChild(glow);

      const valueText = new PIXI.Text({
        text: this._formatBonusValue(beforeValue),
        style: {
          fontFamily: "Arial",
          fontSize: 26,
          fontWeight: "bold",
          fill: options.valueColor ?? 0x2e2418,
          align: "center",
          stroke: { color: 0xf7ffe0, width: 5, join: "round" },
        },
      });
      valueText.anchor.set(0.5, 1);
      valueText.position.set(0, height / 2 - 7);
      overlay.addChild(valueText);

      this.animationContainer.addChild(overlay);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const expandPhase = progress < 0.45 ? progress / 0.45 : 1;
        const settlePhase = progress < 0.45 ? 0 : (progress - 0.45) / 0.55;

        const scale =
          progress < 0.45 ? 1 + 0.24 * expandPhase : 1.24 - 0.24 * settlePhase;

        overlay.scale.set(scale);
        overlay.y = center.y - Math.sin(Math.PI * progress) * 8;
        overlay.rotation = Math.sin(Math.PI * progress) * 0.035;

        glow.alpha = progress < 0.5 ? progress * 1.6 : (1 - progress) * 1.4;

        if (progress >= 0.45) {
          valueText.text = this._formatBonusValue(afterValue);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        this.animationContainer.removeChild(overlay);
        overlay.destroy({ children: true });
        resolve();
      };

      animate();
    });
  }

  async _animateFlipRevealAtCell(
    x,
    y,
    text,
    color,
    duration = ANIMATION_TIMING.renderer.defaults.flipRevealMs,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const center = this._cellCenter(x, y);
      const badge = this._createOverlayBadge(text, color);
      badge.position.set(center.x, center.y);
      this.animationContainer.addChild(badge);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const fold = Math.abs(1 - progress * 2);
        badge.scale.x = Math.max(0.05, fold);
        badge.scale.y = 0.9 + 0.1 * (1 - fold);
        badge.alpha = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.animationContainer.removeChild(badge);
          badge.destroy({ children: true });
          resolve();
        }
      };

      animate();
    });
  }

  _getVisibleSymbolIdAt(x, y) {
    const key = `${x}_${y}`;
    if (this.revealedSymbolMap.has(key)) {
      return this.revealedSymbolMap.get(key).symbolId;
    }

    const row = this.lastRenderedGrid[y] || [];
    return row[x] ?? SYMBOLS.EMPTY;
  }

  _getRevealSymbolId(reveal) {
    if (reveal.type === "clover") {
      return REVEAL_SYMBOLS.CLOVER;
    }

    if (reveal.type === "collector") {
      return REVEAL_SYMBOLS.POT;
    }

    if (reveal.tier === "gold") {
      return REVEAL_SYMBOLS.GOLD_COIN;
    }

    if (reveal.tier === "silver") {
      return REVEAL_SYMBOLS.SILVER_COIN;
    }

    return REVEAL_SYMBOLS.BRONZE_COIN;
  }

  _buildRevealTileData(reveal) {
    const symbolId = this._getRevealSymbolId(reveal);

    if (reveal.type === "coin") {
      const tierStyle = this._coinTierStyle(reveal.tier);
      return {
        symbolId,
        label: this._formatBonusValue(reveal.value),
        accentColor: tierStyle.color,
      };
    }

    if (reveal.type === "clover") {
      return {
        symbolId,
        label: `x${this._formatBonusValue(reveal.value)}`,
        accentColor: 0x52c86e,
      };
    }

    return {
      symbolId,
      label: "",
      accentColor: 0xffb873,
    };
  }

  _coinTierFromValue(value) {
    if (Number(value) >= 25) {
      return "gold";
    }

    if (Number(value) >= 5) {
      return "silver";
    }

    return "bronze";
  }

  async _animateTileSpinRevealAtCell(
    x,
    y,
    revealData,
    duration = ANIMATION_TIMING.renderer.defaults.tileSpinRevealMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const key = `${x}_${y}`;
      const revealSymbolId = revealData.symbolId;
      const currentSymbolId = options.startFromEmpty
        ? SYMBOLS.EMPTY
        : this._getVisibleSymbolIdAt(x, y);
      const tilePadding = 5;
      const width = this.cellSize - tilePadding * 2;
      const height = this.cellSize - tilePadding * 2;

      const tileContainer = new PIXI.Container();
      tileContainer.position.set(
        x * this.cellSize + tilePadding + width / 2,
        y * this.cellSize + tilePadding + height / 2,
      );

      const front = this._createCellSizedSprite(currentSymbolId, 0);
      front.position.set(0, 0);
      front.width = width;
      front.height = height;
      front.pivot.set(width / 2, height / 2);

      const back = this._createCellSizedSprite(revealSymbolId, 0);
      back.position.set(0, 0);
      back.width = width;
      back.height = height;
      back.pivot.set(width / 2, height / 2);
      back.visible = false;
      back.scale.x = 0.05;

      if (revealData.label && options.showLabelDuringFlip) {
        const revealLabel = new PIXI.Text({
          text: revealData.label,
          style: {
            fontFamily: "Arial",
            fontSize: 24,
            fontWeight: "bold",
            fill: revealData.accentColor ?? 0x132235,
            align: "center",
            stroke: { color: 0xfef6e0, width: 5, join: "round" },
          },
        });
        revealLabel.anchor.set(0.5, 1);
        revealLabel.position.set(0, height / 2 - 6);
        back.addChild(revealLabel);
      }

      const shine = new PIXI.Graphics();
      shine.roundRect(-width / 2, -height / 2, width, height, 14);
      shine.stroke({ color: 0xffe9a8, width: 3, alpha: 0.72 });
      shine.alpha = 0;

      tileContainer.addChild(front);
      tileContainer.addChild(back);
      tileContainer.addChild(shine);
      this.animationContainer.addChild(tileContainer);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const spinPhase =
          progress < 0.5 ? progress / 0.5 : (progress - 0.5) / 0.5;
        const squash = Math.sin(Math.PI * progress) * 0.08;
        const tilt = Math.sin(Math.PI * progress) * 0.09;

        tileContainer.y =
          y * this.cellSize +
          tilePadding +
          height / 2 -
          Math.sin(Math.PI * progress) * 8;

        if (progress < 0.5) {
          front.visible = true;
          back.visible = false;
          front.scale.x = Math.max(0.04, 1 - spinPhase);
          front.scale.y = 1 - squash;
          front.rotation = tilt;
          shine.alpha = spinPhase * 0.45;
        } else {
          front.visible = false;
          back.visible = true;
          back.scale.x = Math.max(0.04, spinPhase);
          back.scale.y = 1 - squash;
          back.rotation = -tilt;
          shine.alpha = (1 - spinPhase) * 0.75;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        this.animationContainer.removeChild(tileContainer);
        tileContainer.destroy({ children: true });
        this.revealedSymbolMap.set(key, { ...revealData });
        this.render(this.lastRenderedGrid, new Set(), {
          showBonusOverlays: true,
        });
        resolve();
      };

      animate();
    });
  }

  async animateCenterCallout(
    text,
    duration = ANIMATION_TIMING.renderer.defaults.centerCalloutMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const color = options.color ?? 0xffef9a;
      const centerX = (this.cols * this.cellSize) / 2;
      const centerY = (this.rows * this.cellSize) / 2;

      const label = new PIXI.Text({
        text,
        style: {
          fontFamily: "Arial",
          fontSize: 46,
          fontWeight: "bold",
          fill: color,
          align: "center",
          stroke: { color: 0x1a102b, width: 9, join: "round" },
          dropShadow: {
            color: 0x000000,
            alpha: 0.85,
            blur: 6,
            angle: Math.PI / 3,
            distance: 4,
          },
        },
      });

      label.anchor.set(0.5, 0.5);
      label.position.set(centerX, centerY);
      this.animationContainer.addChild(label);

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const pulse = Math.sin(progress * Math.PI);

        label.y = centerY - progress * 42;
        label.alpha = 1 - Math.pow(progress, 1.15);
        label.scale.set(1 + pulse * 0.16);

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        this.animationContainer.removeChild(label);
        label.destroy();
        resolve();
      };

      animate();
    });
  }

  async _animateCollectFlowToPot(sources, collectorStep, betAmount) {
    await this.ready;

    const collectorCenter = this._cellCenter(collectorStep.x, collectorStep.y);

    const tokens = sources.map((source) => {
      const token = new PIXI.Container();
      const orb = new PIXI.Graphics();
      orb.circle(0, 0, 16);
      orb.fill({ color: 0xffd27f, alpha: 0.94 });
      orb.stroke({ color: 0xfff0bf, width: 2 });
      token.addChild(orb);

      const valueLabel = new PIXI.Text({
        text: source.label ?? this._formatBonusValue(source.value ?? 0),
        style: {
          fontFamily: "Arial",
          fontSize: 13,
          fontWeight: "bold",
          fill: 0x3b2a07,
          align: "center",
        },
      });
      valueLabel.anchor.set(0.5, 0.5);
      token.addChild(valueLabel);

      const start = this._cellCenter(source.x, source.y);
      token.position.set(start.x, start.y);
      this.animationContainer.addChild(token);
      return { token, start };
    });

    if (tokens.length > 0) {
      await new Promise((resolve) => {
        const duration = ANIMATION_TIMING.renderer.defaults.collectFlowTravelMs;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 2.5);

          for (const item of tokens) {
            item.token.x =
              item.start.x + (collectorCenter.x - item.start.x) * eased;
            item.token.y =
              item.start.y + (collectorCenter.y - item.start.y) * eased;
            item.token.alpha = 1 - progress * 0.35;
            item.token.scale.set(1 - progress * 0.62);
          }

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };

        animate();
      });
    }

    for (const item of tokens) {
      this.animationContainer.removeChild(item.token);
      item.token.destroy({ children: true });
    }

    await this._animateBadgeAtCell(
      collectorStep.x,
      collectorStep.y,
      `POT +${this._formatBonusValue(collectorStep.collectedValue * betAmount)}`,
      0xffc77a,
      ANIMATION_TIMING.renderer.defaults.collectFlowBadgeMs,
    );
  }

  _enforcePersistentPot() {
    if (!this.persistentPotKey) {
      return;
    }

    for (const [key, value] of this.revealedSymbolMap.entries()) {
      if (
        value?.symbolId === REVEAL_SYMBOLS.POT &&
        key !== this.persistentPotKey
      ) {
        this.revealedSymbolMap.delete(key);
      }
    }

    const existing = this.revealedSymbolMap.get(this.persistentPotKey) || {};
    this.revealedSymbolMap.set(this.persistentPotKey, {
      ...existing,
      symbolId: REVEAL_SYMBOLS.POT,
      label: existing.label || "",
      accentColor: 0xffb873,
    });
  }

  async animateScatterTrigger(scatterPositions = [], options = {}) {
    await this.ready;

    if (!Array.isArray(scatterPositions) || scatterPositions.length === 0) {
      return;
    }

    const duration = Number(
      options.duration || ANIMATION_TIMING.renderer.defaults.scatterTriggerMs,
    );
    const intensity = Math.max(
      0.2,
      Math.min(1, Number(options.intensity ?? 1)),
    );
    const activeSymbols = [];

    for (const position of scatterPositions) {
      const key = `${position.x}_${position.y}`;
      const cellContainer = this.symbolCells[key];
      if (!cellContainer || cellContainer.children.length <= 1) {
        continue;
      }

      const symbolNode = cellContainer.children[1];
      if (!symbolNode?.scale || !symbolNode?.pivot || !symbolNode?.position) {
        continue;
      }

      const width = symbolNode.width || this.cellSize - 10;
      const height = symbolNode.height || this.cellSize - 10;
      const centerX = symbolNode.x + width / 2;
      const centerY = symbolNode.y + height / 2;

      activeSymbols.push({
        symbolNode,
        baseScaleX: symbolNode.scale.x,
        baseScaleY: symbolNode.scale.y,
        baseRotation: symbolNode.rotation || 0,
        baseX: symbolNode.x,
        baseY: symbolNode.y,
        width,
        height,
      });
    }

    if (activeSymbols.length === 0) {
      return;
    }

    await new Promise((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        for (const item of activeSymbols) {
          const pulse = Math.max(0, Math.sin(progress * Math.PI * 2.4));
          const scaleFactor = 1 + pulse * (0.08 * intensity);
          const scaledWidth = item.width * scaleFactor;
          const scaledHeight = item.height * scaleFactor;
          const offsetX = (scaledWidth - item.width) / 2;
          const offsetY = (scaledHeight - item.height) / 2;

          item.symbolNode.scale.set(
            item.baseScaleX * scaleFactor,
            item.baseScaleY * scaleFactor,
          );
          item.symbolNode.position.set(
            item.baseX - offsetX,
            item.baseY - offsetY,
          );
          item.symbolNode.rotation = item.baseRotation;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        resolve();
      };

      animate();
    });

    for (const item of activeSymbols) {
      item.symbolNode.scale.set(item.baseScaleX, item.baseScaleY);
      item.symbolNode.rotation = item.baseRotation;
      item.symbolNode.position.set(item.baseX, item.baseY);
    }
  }

  async animateSpinTransition(
    fromGrid,
    toGrid,
    duration = ANIMATION_TIMING.renderer.defaults.spinTransitionMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const {
        columnStaggerMs = ANIMATION_TIMING.renderer.stagger
          .spinTransitionColumnMs,
        showBonusOverlays = false,
      } = options;

      const padding = 5;
      const outDistance = this.rows * this.cellSize + this.cellSize * 0.85;
      const startTime = Date.now();
      const totalDuration = duration + (this.cols - 1) * columnStaggerMs;
      const landingPhase = 0.2;

      this._clearAnimationLayer();
      this.persistentConnectionHighlights.clear();
      this.revealedSymbolMap.clear();
      this.persistentPotKey = null;
      this.render(
        Array.from({ length: this.rows }, () =>
          Array(this.cols).fill(SYMBOLS.EMPTY),
        ),
        new Set(),
        { showBonusOverlays: false },
      );

      const lanes = [];

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const fromSymbol = fromGrid?.[y]?.[x] ?? SYMBOLS.EMPTY;
          const toSymbol = toGrid?.[y]?.[x] ?? SYMBOLS.EMPTY;
          const targetX = x * this.cellSize + padding;
          const targetY = y * this.cellSize + padding;
          const startDelay = x * columnStaggerMs;

          let incoming = null;
          let outgoing = null;

          if (toSymbol !== SYMBOLS.EMPTY) {
            incoming = this._createCellSizedSprite(toSymbol, padding);
            incoming.x = targetX;
            incoming.y = -this.cellSize * 1.5;
            incoming.alpha = 0.95;
            this.animationContainer.addChild(incoming);
          }

          if (fromSymbol !== SYMBOLS.EMPTY) {
            outgoing = this._createCellSizedSprite(fromSymbol, padding);
            outgoing.x = targetX;
            outgoing.y = targetY;
            this.animationContainer.addChild(outgoing);
          }

          lanes.push({ incoming, outgoing, targetY, startDelay });
        }
      }

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const allDone = elapsed >= totalDuration;

        for (const lane of lanes) {
          const localElapsed = elapsed - lane.startDelay;
          if (localElapsed <= 0) {
            continue;
          }

          const progress = Math.min(localElapsed / duration, 1);
          const easedOut = 1 - (1 - progress) * (1 - progress);
          const easedIn = progress * progress;

          if (lane.outgoing) {
            lane.outgoing.y = lane.targetY + outDistance * easedOut;
            lane.outgoing.alpha = 1 - progress;
          }

          if (lane.incoming) {
            const startY = -this.cellSize * 1.5;
            const dropProgress = Math.min(progress / (1 - landingPhase), 1);
            const dropEase = dropProgress * dropProgress * dropProgress;
            lane.incoming.y = startY + (lane.targetY - startY) * dropEase;

            if (progress > 1 - landingPhase) {
              const settleProgress =
                (progress - (1 - landingPhase)) / landingPhase;
              const damping = Math.exp(-6.5 * settleProgress);
              const oscillation = Math.sin(settleProgress * Math.PI * 2.1);
              const landingOvershoot = this.cellSize * 0.06;
              lane.incoming.y += landingOvershoot * damping * oscillation;
            }

            this._resetSpriteToBaseScale(lane.incoming);
          }
        }

        if (!allDone) {
          requestAnimationFrame(animate);
          return;
        }

        for (const lane of lanes) {
          if (lane.incoming) {
            this._resetSpriteToBaseScale(lane.incoming);
            this.animationContainer.removeChild(lane.incoming);
            lane.incoming.destroy({ children: true });
          }
          if (lane.outgoing) {
            this.animationContainer.removeChild(lane.outgoing);
            lane.outgoing.destroy({ children: true });
          }
        }

        this.render(toGrid, new Set(), { showBonusOverlays });
        resolve();
      };

      animate();
    });
  }

  async animateGridDrop(
    gridData,
    duration = ANIMATION_TIMING.renderer.defaults.gridDropMs,
    options = {},
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const padding = 5;

      const {
        changedKeys = null,
        baseGrid = null,
        startRowByKey = null,
        columnStaggerMs = ANIMATION_TIMING.renderer.stagger.gridDropColumnMs,
        rowStaggerMs = 0,
        showBonusOverlays = false,
      } = options;

      const fallPortion = 0.78;

      this._clearAnimationLayer();

      const initialGrid =
        baseGrid ||
        Array.from({ length: this.rows }, () =>
          Array(this.cols).fill(SYMBOLS.EMPTY),
        );

      this.render(initialGrid, new Set(), { showBonusOverlays });

      const dropSprites = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const key = `${x}_${y}`;

          if (changedKeys && !changedKeys.has(key)) {
            continue;
          }

          const symbolId = gridData[y][x];
          if (symbolId === SYMBOLS.EMPTY) {
            continue;
          }

          const sprite = this._createCellSizedSprite(symbolId, padding);

          const targetX = x * this.cellSize + padding;
          const targetY = y * this.cellSize + padding;
          const startRow =
            startRowByKey && startRowByKey.has(key)
              ? startRowByKey.get(key)
              : null;
          const startY =
            typeof startRow === "number"
              ? startRow * this.cellSize + padding
              : -this.cellSize * 1.6;
          const startDelay = x * columnStaggerMs + y * rowStaggerMs;

          sprite.x = targetX;
          sprite.y = startY;

          this.animationContainer.addChild(sprite);

          const travelDistance = Math.max(1, targetY - startY);
          const baseDropMs = Math.max(180, duration * fallPortion);
          const extraDropMs = Math.min(220, travelDistance * 0.55);
          const dropDurationMs = baseDropMs + extraDropMs;
          const settleDurationMs = Math.max(
            160,
            duration * (1 - fallPortion) + 60,
          );

          dropSprites.push({
            sprite,
            targetY,
            startY,
            startDelay,
            dropDurationMs,
            settleDurationMs,
          });
        }
      }

      const maxRuntime =
        duration * 2.8 +
        (this.cols - 1) * columnStaggerMs +
        (this.rows - 1) * rowStaggerMs;

      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;

        let allSettled = true;

        for (const item of dropSprites) {
          const { sprite, targetY, startY, startDelay } = item;
          const localElapsed = elapsed - startDelay;

          if (localElapsed <= 0) {
            sprite.y = startY;
            this._resetSpriteToBaseScale(sprite);
            allSettled = false;
            continue;
          }

          const dropProgress = Math.min(localElapsed / item.dropDurationMs, 1);

          if (dropProgress < 1) {
            const easeIn = dropProgress * dropProgress * dropProgress;
            sprite.y = startY + (targetY - startY) * easeIn;
            this._resetSpriteToBaseScale(sprite);
            allSettled = false;
            continue;
          }

          const settleElapsed = localElapsed - item.dropDurationMs;
          const settleProgress = Math.min(
            settleElapsed / item.settleDurationMs,
            1,
          );

          const damping = Math.exp(-7.2 * settleProgress);
          const oscillation = Math.sin(settleProgress * Math.PI * 2.2);
          const overshoot = Math.min(
            this.cellSize * 0.07,
            (targetY - startY) * 0.055,
          );
          sprite.y = targetY + overshoot * damping * oscillation;
          this._resetSpriteToBaseScale(sprite);

          if (settleProgress < 1) {
            allSettled = false;
          }
        }

        const reachedSafetyLimit = elapsed >= maxRuntime;
        if (!allSettled && !reachedSafetyLimit) {
          requestAnimationFrame(animate);
          return;
        }

        for (const item of dropSprites) {
          this._resetSpriteToBaseScale(item.sprite);
          this.animationContainer.removeChild(item.sprite);
          item.sprite.destroy({ children: true });
        }

        this.render(gridData, new Set(), { showBonusOverlays });
        resolve();
      };

      animate();
    });
  }

  /**
   * Create a visual symbol sprite
   */
  _createSymbolSprite(symbolId) {
    const baseColor = SYMBOL_COLORS[symbolId] || 0x888888;
    const isBonusPalette = Boolean(this.bonusVisuals?.modeName);
    const color = isBonusPalette ? this._boostColor(baseColor, 1.2) : baseColor;
    const label = SYMBOL_LABELS[symbolId] || "?";

    // Create symbol background
    const sprite = new PIXI.Graphics();
    sprite.roundRect(0, 0, 100, 100, 16);
    sprite.fill(color);

    // Add label text
    const text = new PIXI.Text({
      text: label,
      style: {
        fontFamily: "Georgia",
        fontSize: 36,
        fontWeight: "bold",
        fill: isBonusPalette ? 0x2f1f08 : 0x2b2419,
        align: "center",
      },
    });

    text.anchor.set(0.5, 0.5);
    text.position.set(50, 50);
    sprite.addChild(text);

    return sprite;
  }

  _boostColor(color, factor) {
    const red = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
    const green = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
    const blue = Math.min(255, Math.floor((color & 0xff) * factor));
    return (red << 16) | (green << 8) | blue;
  }

  /**
   * Animate cascade - remove symbols and apply gravity
   */
  async animateCascade(
    beforeGrid,
    winPositions,
    afterGrid,
    movementData,
    duration = ANIMATION_TIMING.renderer.defaults.cascadeMs,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      // 1. Highlight winning symbols briefly
      this.render(beforeGrid, winPositions, { showBonusOverlays: false });

      const highlightMs = Number(
        ANIMATION_TIMING.renderer.defaults.cascadeHighlightPauseMs,
      );
      const fadeMs = Math.max(120, duration * 0.75);

      setTimeout(() => {
        const burstOverlays = [];

        for (const posKey of winPositions) {
          const normalizedKey = this._normalizePosKey(posKey);
          const [x, y] = normalizedKey.split("_").map(Number);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
          }

          const center = this._cellCenter(x, y);
          const burst = new PIXI.Container();
          burst.position.set(center.x, center.y);

          const flash = new PIXI.Graphics();
          flash.circle(0, 0, this.cellSize * 0.18);
          flash.fill({ color: 0xffd88a, alpha: 0.95 });
          burst.addChild(flash);

          const ring = new PIXI.Graphics();
          ring.circle(0, 0, this.cellSize * 0.2);
          ring.stroke({ color: 0xffefba, width: 3, alpha: 0.9 });
          burst.addChild(ring);

          const sparks = [];
          const sparkCount = 8;
          for (let i = 0; i < sparkCount; i++) {
            const spark = new PIXI.Graphics();
            spark.circle(0, 0, 2.2);
            spark.fill({
              color: i % 2 === 0 ? 0xfff1c7 : 0xffc16a,
              alpha: 0.95,
            });
            spark.__angle =
              (Math.PI * 2 * i) / sparkCount + (Math.PI / 12) * (i % 3);
            spark.__distance = this.cellSize * (0.26 + (i % 4) * 0.035);
            burst.addChild(spark);
            sparks.push(spark);
          }

          this.animationContainer.addChild(burst);
          burstOverlays.push({ burst, flash, ring, sparks });
        }

        // 2. Animate removal (fade out)
        const startTime = Date.now();
        const animateRemoval = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / fadeMs, 1);

          for (const overlay of burstOverlays) {
            const burstProgress = Math.min(1, progress * 1.08);
            overlay.flash.scale.set(1 + burstProgress * 1.25);
            overlay.flash.alpha = Math.max(0, 0.9 - burstProgress * 1.35);

            overlay.ring.scale.set(1 + burstProgress * 1.95);
            overlay.ring.alpha = Math.max(0, 0.92 - burstProgress * 1.28);

            for (const spark of overlay.sparks) {
              const distance = spark.__distance * burstProgress;
              spark.x = Math.cos(spark.__angle) * distance;
              spark.y = Math.sin(spark.__angle) * distance;
              spark.alpha = Math.max(0, 1 - burstProgress * 1.25);
              spark.scale.set(Math.max(0.25, 1 - burstProgress * 0.55));
            }
          }

          for (const posKey of winPositions) {
            const normalizedKey = this._normalizePosKey(posKey);
            const cellContainer = this.symbolCells[normalizedKey];
            if (!cellContainer || cellContainer.children.length <= 1) {
              continue;
            }

            for (
              let index = 1;
              index < cellContainer.children.length;
              index++
            ) {
              const child = cellContainer.children[index];
              if (typeof child.__baseScaleX !== "number") {
                child.__baseScaleX = child.scale?.x ?? 1;
              }
              if (typeof child.__baseScaleY !== "number") {
                child.__baseScaleY = child.scale?.y ?? 1;
              }
              if (typeof child.__baseY !== "number") {
                child.__baseY = child.y ?? 0;
              }

              const pop =
                Math.sin(Math.PI * Math.min(progress / 0.45, 1)) * 0.12;
              const shrink = 1 - Math.pow(progress, 1.2) * 0.34;
              const scale = Math.max(0.45, shrink + pop);

              child.scale.set(
                child.__baseScaleX * scale,
                child.__baseScaleY * scale,
              );
              child.y =
                child.__baseY -
                Math.sin(progress * Math.PI) * (this.cellSize * 0.06);
              child.alpha = 1 - progress;
            }
          }

          if (progress < 1) {
            requestAnimationFrame(animateRemoval);
          } else {
            for (const overlay of burstOverlays) {
              this.animationContainer.removeChild(overlay.burst);
              overlay.burst.destroy({ children: true });
            }

            // 3. Drop only changed cells to avoid full-grid flicker
            const changedKeys = this._getChangedKeys(beforeGrid, afterGrid);
            const startRowByKey = this._buildCascadeStartRows(
              beforeGrid,
              afterGrid,
              winPositions,
            );
            const baseGrid = beforeGrid.map((row) => [...row]);

            for (const key of changedKeys) {
              const [x, y] = key.split("_").map(Number);
              baseGrid[y][x] = SYMBOLS.EMPTY;
            }

            this.animateGridDrop(afterGrid, Math.max(160, duration * 1.1), {
              changedKeys,
              baseGrid,
              startRowByKey,
              columnStaggerMs:
                ANIMATION_TIMING.renderer.stagger.cascadeDropColumnMs,
              rowStaggerMs: 0,
              showBonusOverlays: false,
            }).then(() => {
              resolve();
            });
          }
        };

        animateRemoval();
      }, highlightMs);
    });
  }

  /**
   * Animate spin effect on reels
   */
  async animateSpinStart(
    duration = ANIMATION_TIMING.renderer.defaults.spinStartMs,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      const startTime = Date.now();
      const startBlur = 0;
      const endBlur = 5;

      const animateSpin = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply blur effect
        const blur = startBlur + (endBlur - startBlur) * progress;
        this.gridContainer.blur = blur;

        if (progress < 1) {
          requestAnimationFrame(animateSpin);
        } else {
          this.gridContainer.blur = 0;
          resolve();
        }
      };

      animateSpin();
    });
  }

  /**
   * Show win animation
   */
  async animateWin(
    winAmount,
    winPositions,
    duration = ANIMATION_TIMING.renderer.defaults.winFloatMs,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      // Create floating text
      const winText = new PIXI.Text({
        text: `+${winAmount}`,
        style: {
          fontFamily: "Arial",
          fontSize: 48,
          fontWeight: "bold",
          fill: 0xffff00,
          stroke: { color: 0x1a102b, width: 8, join: "round" },
          dropShadow: {
            color: 0x000000,
            alpha: 0.9,
            blur: 6,
            angle: Math.PI / 3,
            distance: 4,
          },
        },
      });

      winText.anchor.set(0.5, 0.5);
      winText.position.set(
        (this.cols * this.cellSize) / 2,
        (this.rows * this.cellSize) / 2,
      );

      this.animationContainer.addChild(winText);

      // Animate floating up and fade out
      const startTime = Date.now();
      const animateFloat = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        winText.y = (this.rows * this.cellSize) / 2 - progress * 60;
        winText.alpha = 1 - progress;
        winText.scale.set(1 + progress * 0.3);

        if (progress < 1) {
          requestAnimationFrame(animateFloat);
        } else {
          this.animationContainer.removeChild(winText);
          winText.destroy();
          resolve();
        }
      };

      animateFloat();
    });
  }

  async animateBonusFeatureSequence(eventRounds = [], options = {}) {
    await this.ready;

    const {
      betAmount = 1,
      onCloverMultiply = null,
      onCollectorCollect = null,
    } = options;
    if (!Array.isArray(eventRounds) || eventRounds.length === 0) {
      return;
    }

    for (const round of eventRounds) {
      const reveals = Array.isArray(round.reveals) ? round.reveals : [];
      const cloverHits = Array.isArray(round.cloverHits)
        ? round.cloverHits
        : [];
      const collectorSteps = Array.isArray(round.collectorSteps)
        ? round.collectorSteps
        : [];

      if (reveals.length === 0 && collectorSteps.length === 0) {
        continue;
      }

      if (reveals.length > 0) {
        const rainbowFocusPromise =
          this.bonusVisuals?.rainbowTriggered &&
          Array.isArray(this.bonusVisuals?.rainbowPositions) &&
          this.bonusVisuals.rainbowPositions.length > 0
            ? this._animateFocusedTileAtCell(
                this.bonusVisuals.rainbowPositions[0].x,
                this.bonusVisuals.rainbowPositions[0].y,
                Math.max(
                  ANIMATION_TIMING.renderer.bonusSequence.rainbowFocusMinMs,
                  reveals.length *
                    ANIMATION_TIMING.renderer.bonusSequence
                      .rainbowFocusPerRevealMs +
                    ANIMATION_TIMING.renderer.bonusSequence.rainbowFocusBaseMs,
                ),
                {
                  accentColor: 0x93d1ff,
                  maxScale: 1.16,
                  growMs: 150,
                  shrinkMs: 170,
                },
              )
            : null;

        const sortedReveals = [...reveals].sort((left, right) => {
          if (left.y === right.y) {
            return left.x - right.x;
          }
          return left.y - right.y;
        });

        const revealCount = sortedReveals.length;
        const revealPacing = getRevealPacing(revealCount);
        const revealDuration = revealPacing.durationMs;
        const revealStagger = revealPacing.staggerMs;

        await Promise.all(
          sortedReveals.map(
            (reveal, index) =>
              new Promise((resolve) => {
                setTimeout(() => {
                  const revealData = this._buildRevealTileData(reveal);
                  this._animateTileSpinRevealAtCell(
                    reveal.x,
                    reveal.y,
                    revealData,
                    revealDuration,
                  ).then(resolve);
                }, index * revealStagger);
              }),
          ),
        );

        if (rainbowFocusPromise) {
          await rainbowFocusPromise;
        }
      }

      if (cloverHits.length > 0) {
        for (const cloverHit of cloverHits) {
          if (typeof onCloverMultiply === "function") {
            onCloverMultiply(cloverHit);
          }

          const coinTargets = cloverHit.targets.filter(
            (target) => target.type === "coin",
          );
          const collectorTargets = cloverHit.targets.filter(
            (target) => target.type === "collector",
          );
          const allTargets = [...coinTargets, ...collectorTargets];

          const cloverFocusDuration =
            ANIMATION_TIMING.renderer.bonusSequence.cloverFocusBaseMs +
            Math.max(0, allTargets.length - 1) *
              ANIMATION_TIMING.renderer.bonusSequence.cloverFocusPerTargetMs;
          const cloverFocusPromise = this._animateFocusedTileAtCell(
            cloverHit.x,
            cloverHit.y,
            Math.max(
              ANIMATION_TIMING.renderer.bonusSequence.cloverFocusMinMs,
              cloverFocusDuration,
            ),
            {
              accentColor: 0x67e07f,
              maxScale: 1.18,
              growMs: 170,
              shrinkMs: 170,
            },
          );

          await this._animateBadgeAtCell(
            cloverHit.x,
            cloverHit.y,
            `x${this._formatBonusValue(cloverHit.multiplier)}`,
            0x67e07f,
            ANIMATION_TIMING.renderer.bonusSequence.cloverBadgeMs,
          );

          await this._wait(
            ANIMATION_TIMING.renderer.bonusSequence.cloverBadgeGapMs,
          );

          await this._animateMultiplierBurstFromClover(
            cloverHit,
            allTargets,
            ANIMATION_TIMING.renderer.defaults.multiplierBurstMs,
          );

          for (const target of coinTargets) {
            const key = `${target.x}_${target.y}`;
            const existing = this.revealedSymbolMap.get(key);

            if (existing) {
              const updatedTier = this._coinTierFromValue(target.after);
              this.revealedSymbolMap.set(key, {
                ...existing,
                symbolId: this._getRevealSymbolId({
                  type: "coin",
                  tier: updatedTier,
                }),
                accentColor: this._coinTierStyle(updatedTier).color,
                label: this._formatBonusValue(target.after),
              });
            }
          }

          for (const target of collectorTargets) {
            const key = `${target.x}_${target.y}`;
            const existing = this.revealedSymbolMap.get(key);
            if (existing) {
              this.revealedSymbolMap.set(key, {
                ...existing,
                label: `x${this._formatBonusValue(target.after)}`,
              });
            }
          }

          this.render(this.lastRenderedGrid, new Set(), {
            showBonusOverlays: true,
          });

          await this._wait(
            ANIMATION_TIMING.renderer.bonusSequence.cloverSettleGapMs,
          );
          await cloverFocusPromise;
        }
      }

      if (collectorSteps.length > 0) {
        for (const step of collectorSteps) {
          if (typeof onCollectorCollect === "function") {
            onCollectorCollect(step);
          }

          const sources = Array.isArray(step.suckedSources)
            ? step.suckedSources.map((source) => ({
                ...source,
                label: this._formatBonusValue(source.value ?? 0),
              }))
            : [];
          const clearedSources = Array.isArray(step.clearedSources)
            ? step.clearedSources
            : sources;

          const potFocusDuration =
            sources.length > 0
              ? ANIMATION_TIMING.renderer.bonusSequence
                  .collectorFocusWithSourcesMs
              : ANIMATION_TIMING.renderer.bonusSequence
                  .collectorFocusWithoutSourcesMs;
          const potFocusPromise = this._animateFocusedTileAtCell(
            step.x,
            step.y,
            potFocusDuration,
            {
              accentColor: 0xffc77a,
              maxScale: 1.2,
              growMs: 180,
              shrinkMs: 180,
            },
          );

          await this._animateCollectFlowToPot(sources, step, betAmount);

          for (const source of clearedSources) {
            const sourceKey = `${source.x}_${source.y}`;
            if (sourceKey === `${step.x}_${step.y}`) {
              continue;
            }

            if (source.type === "clover") {
              this.revealedSymbolMap.set(sourceKey, {
                symbolId: SYMBOLS.EMPTY,
                label: "",
                accentColor: 0x52c86e,
              });
              continue;
            }

            const existingSource = this.revealedSymbolMap.get(sourceKey) || {};
            if (source.type === "collector") {
              this.revealedSymbolMap.set(sourceKey, {
                ...existingSource,
                symbolId: REVEAL_SYMBOLS.POT,
                label: "",
                accentColor: 0xffb873,
              });
              continue;
            }

            const sourceTier = this._coinTierFromValue(source.value ?? 0);
            const sourceSymbolId =
              existingSource.symbolId ||
              this._getRevealSymbolId({ type: "coin", tier: sourceTier });
            const sourceAccent =
              existingSource.accentColor ||
              this._coinTierStyle(sourceTier).color;

            this.revealedSymbolMap.set(sourceKey, {
              ...existingSource,
              symbolId: sourceSymbolId,
              label: "",
              accentColor: sourceAccent,
            });
          }

          this.render(this.lastRenderedGrid, new Set(), {
            showBonusOverlays: true,
          });

          await potFocusPromise;

          const collectorKey = `${step.x}_${step.y}`;
          const existing = this.revealedSymbolMap.get(collectorKey) || {};
          this.revealedSymbolMap.set(collectorKey, {
            ...existing,
            symbolId: REVEAL_SYMBOLS.POT,
            label: this._formatBonusValue(step.collectedValue),
            accentColor: 0xffc77a,
          });

          this.render(this.lastRenderedGrid, new Set(), {
            showBonusOverlays: true,
          });

          const postCollectReveals = Array.isArray(step.postCollectReveals)
            ? step.postCollectReveals
            : [];

          if (postCollectReveals.length > 0) {
            const sortedPostReveals = [...postCollectReveals].sort(
              (left, right) => {
                if (left.y === right.y) {
                  return left.x - right.x;
                }
                return left.y - right.y;
              },
            );

            const revealCount = sortedPostReveals.length;
            const revealPacing = getRevealPacing(revealCount);
            const revealDuration = revealPacing.durationMs;
            const revealStagger = revealPacing.staggerMs;

            await Promise.all(
              sortedPostReveals.map(
                (reveal, index) =>
                  new Promise((resolve) => {
                    setTimeout(() => {
                      const revealData = this._buildRevealTileData(reveal);
                      this._animateTileSpinRevealAtCell(
                        reveal.x,
                        reveal.y,
                        revealData,
                        revealDuration,
                        { startFromEmpty: true },
                      ).then(resolve);
                    }, index * revealStagger);
                  }),
              ),
            );
          }

          const postCollectCloverHits = Array.isArray(
            step.postCollectCloverHits,
          )
            ? step.postCollectCloverHits
            : [];

          for (const cloverHit of postCollectCloverHits) {
            if (typeof onCloverMultiply === "function") {
              onCloverMultiply(cloverHit);
            }

            const coinTargets = (cloverHit.targets || []).filter(
              (target) => target.type === "coin",
            );
            const collectorTargets = (cloverHit.targets || []).filter(
              (target) => target.type === "collector",
            );
            const allTargets = [...coinTargets, ...collectorTargets];

            const cloverFocusPromise = this._animateFocusedTileAtCell(
              cloverHit.x,
              cloverHit.y,
              Math.max(
                ANIMATION_TIMING.renderer.bonusSequence.cloverFocusBaseMs,
                ANIMATION_TIMING.renderer.bonusSequence.cloverFocusBaseMs +
                  Math.max(0, allTargets.length - 1) *
                    ANIMATION_TIMING.renderer.bonusSequence
                      .cloverFocusPerTargetMs,
              ),
              {
                accentColor: 0x67e07f,
                maxScale: 1.18,
                growMs: 170,
                shrinkMs: 170,
              },
            );

            await this._animateBadgeAtCell(
              cloverHit.x,
              cloverHit.y,
              `x${this._formatBonusValue(cloverHit.multiplier)}`,
              0x67e07f,
              ANIMATION_TIMING.renderer.bonusSequence.postCollectCloverBadgeMs,
            );

            await this._wait(
              ANIMATION_TIMING.renderer.bonusSequence.postCollectCloverGapMs,
            );

            await this._animateMultiplierBurstFromClover(
              cloverHit,
              allTargets,
              ANIMATION_TIMING.renderer.bonusSequence.postCollectBurstMs,
            );

            for (const target of coinTargets) {
              const key = `${target.x}_${target.y}`;
              const existingTarget = this.revealedSymbolMap.get(key);
              if (existingTarget) {
                const updatedTier = this._coinTierFromValue(target.after);
                this.revealedSymbolMap.set(key, {
                  ...existingTarget,
                  symbolId: this._getRevealSymbolId({
                    type: "coin",
                    tier: updatedTier,
                  }),
                  accentColor: this._coinTierStyle(updatedTier).color,
                  label: this._formatBonusValue(target.after),
                });
              }
            }

            for (const target of collectorTargets) {
              const key = `${target.x}_${target.y}`;
              const existingTarget = this.revealedSymbolMap.get(key);
              if (existingTarget) {
                const isFullPot = target.collectorState === "full";
                this.revealedSymbolMap.set(key, {
                  ...existingTarget,
                  label: isFullPot
                    ? this._formatBonusValue(target.after)
                    : `x${this._formatBonusValue(target.after)}`,
                });
              }
            }

            this.render(this.lastRenderedGrid, new Set(), {
              showBonusOverlays: true,
            });

            await this._wait(
              ANIMATION_TIMING.renderer.bonusSequence.postCollectSettleGapMs,
            );
            await cloverFocusPromise;
          }

          await this._wait(
            ANIMATION_TIMING.renderer.bonusSequence.collectorStepGapMs,
          );
        }

        const lastCollector = collectorSteps[collectorSteps.length - 1];
        if (lastCollector) {
          this.persistentPotKey = `${lastCollector.x}_${lastCollector.y}`;
        }
      }

      this._enforcePersistentPot();
      this.render(this.lastRenderedGrid, new Set(), {
        showBonusOverlays: true,
      });

      if (
        collectorSteps.length > 0 &&
        Number(round.roundCollectionValue || 0) > 0
      ) {
        const totalCredits = round.roundCollectionValue * betAmount;
        await this._animateBadgeAtCell(
          Math.floor(this.cols / 2),
          Math.floor(this.rows / 2),
          `COLLECTED ${this._formatBonusValue(totalCredits)}`,
          0xffe27a,
          ANIMATION_TIMING.renderer.bonusSequence.roundCollectedBadgeMs,
        );
      }

      await this._wait(
        ANIMATION_TIMING.renderer.bonusSequence.betweenRoundsGapMs,
      );
    }
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    if (!this.app) {
      return;
    }

    this.app.renderer.resize(width, height);
  }

  setBonusVisuals(visualData = {}) {
    const goldenSquares = new Set();
    if (visualData.goldenSquares) {
      for (const key of visualData.goldenSquares) {
        goldenSquares.add(String(key));
      }
    }

    this.bonusVisuals = {
      modeName: visualData.modeName || visualData.mode || null,
      modeId: visualData.modeId || null,
      goldenSquares,
      rainbowTriggered: Boolean(visualData.rainbowTriggered),
      rainbowPositions: Array.isArray(visualData.rainbowPositions)
        ? visualData.rainbowPositions.map((entry) => ({ ...entry }))
        : [],
      persistGoldenSquaresAfterActivation: Boolean(
        visualData.persistGoldenSquaresAfterActivation,
      ),
      guaranteedRainbowEverySpin: Boolean(
        visualData.guaranteedRainbowEverySpin,
      ),
    };
  }

  setPersistentConnectionHighlights(positions = new Set()) {
    const normalized = new Set();
    if (positions && typeof positions[Symbol.iterator] === "function") {
      for (const key of positions) {
        normalized.add(this._normalizePosKey(String(key)));
      }
    }

    this.persistentConnectionHighlights = normalized;
  }

  clearPersistentConnectionHighlights() {
    this.persistentConnectionHighlights.clear();
  }

  clearBonusVisuals() {
    this.bonusVisuals = {
      modeName: null,
      modeId: null,
      goldenSquares: new Set(),
      rainbowTriggered: false,
      rainbowPositions: [],
      persistGoldenSquaresAfterActivation: false,
      guaranteedRainbowEverySpin: false,
    };

    this.revealedSymbolMap.clear();
    this.persistentPotKey = null;

    this._renderBonusLabel();
  }

  /**
   * Clean up
   */
  destroy() {
    if (!this.app) {
      return;
    }

    if (this.bonusLabel && this.app.stage) {
      this.app.stage.removeChild(this.bonusLabel);
      this.bonusLabel.destroy();
      this.bonusLabel = null;
    }

    this.app.destroy(true, true);
  }
}

export default GridRenderer;
