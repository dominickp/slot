/**
 * Pixi Grid Renderer
 *
 * Renders a configurable cluster slot grid using Pixi.js
 * Handles symbol display, animations, and win highlights
 */

import * as PIXI from "pixi.js";

// Symbol IDs mapping
const SYMBOLS = {
  EMPTY: 0,
  RED: 1,
  GREEN: 2,
  PURPLE: 3,
  YELLOW: 4,
  BLUE: 5,
  WILD: 6,
  SCATTER: 7,
  CLOVER: 8,
  RAINBOW: 9,
  BUCKET: 10,
};

// Symbol colors/styling
const SYMBOL_COLORS = {
  [SYMBOLS.RED]: 0x9d8665,
  [SYMBOLS.GREEN]: 0xa09170,
  [SYMBOLS.PURPLE]: 0xaa9f87,
  [SYMBOLS.YELLOW]: 0xb5a68c,
  [SYMBOLS.BLUE]: 0xc2b39a,
  [SYMBOLS.WILD]: 0xcfbf9f,
  [SYMBOLS.SCATTER]: 0xb68f4c,
  [SYMBOLS.CLOVER]: 0x67c37d,
  [SYMBOLS.RAINBOW]: 0x6fb5e8,
  [SYMBOLS.BUCKET]: 0xe1a974,
};

const SYMBOL_LABELS = {
  [SYMBOLS.RED]: "10",
  [SYMBOLS.GREEN]: "J",
  [SYMBOLS.PURPLE]: "Q",
  [SYMBOLS.YELLOW]: "K",
  [SYMBOLS.BLUE]: "A",
  [SYMBOLS.WILD]: "🎩",
  [SYMBOLS.SCATTER]: "FS",
  [SYMBOLS.CLOVER]: "🍀",
  [SYMBOLS.RAINBOW]: "🌈",
  [SYMBOLS.BUCKET]: "🏺",
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
      const pulse = new PIXI.Graphics();
      pulse.roundRect(8, 8, this.cellSize - 16, this.cellSize - 16, 8);
      pulse.stroke({ color: 0x93d1ff, width: 2, alpha: 0.66 });
      cellContainer.addChild(pulse);
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
      background.stroke({ color: 0xffdc78, width: highlighted ? 4 : 3 });

      const innerGlow = new PIXI.Graphics();
      innerGlow.rect(4, 4, this.cellSize - 8, this.cellSize - 8);
      innerGlow.fill({ color: 0xe6bc5a, alpha: highlighted ? 0.42 : 0.28 });
      background.addChild(innerGlow);
    } else {
      background.fill(0x333333);
      background.stroke({ color: 0x555555, width: 2 });
    }

    if (activeRainbow && (highlighted || bonusGolden)) {
      const rainbowPulse = new PIXI.Graphics();
      rainbowPulse.rect(6, 6, this.cellSize - 12, this.cellSize - 12);
      rainbowPulse.stroke({ color: 0x93d1ff, width: 2, alpha: 0.65 });
      background.addChild(rainbowPulse);
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

  async _animateBadgeAtCell(x, y, text, color, duration = 300) {
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

  async _animateFocusedTileAtCell(x, y, duration = 520, options = {}) {
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
    duration = 380,
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
          item.packet.x =
            start.x + (item.destination.x - start.x) * eased;
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
    duration = 340,
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

  async _animateFlipRevealAtCell(x, y, text, color, duration = 360) {
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
      label: "POT",
      accentColor: 0xffb873,
    };
  }

  async _animateTileSpinRevealAtCell(x, y, revealData, duration = 320) {
    await this.ready;

    return new Promise((resolve) => {
      const key = `${x}_${y}`;
      const revealSymbolId = revealData.symbolId;
      const currentSymbolId = this._getVisibleSymbolIdAt(x, y);
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

      if (revealData.label) {
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
        const duration = 560;
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
      620,
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
      label: existing.label || "POT",
      accentColor: 0xffb873,
    });
  }

  async animateScatterTrigger(scatterPositions = [], options = {}) {
    await this.ready;

    if (!Array.isArray(scatterPositions) || scatterPositions.length === 0) {
      return;
    }

    const duration = Number(options.duration || 1000);
    const intensity = Math.max(
      0.2,
      Math.min(1, Number(options.intensity ?? 1)),
    );
    const overlays = [];

    for (const position of scatterPositions) {
      const center = this._cellCenter(position.x, position.y);
      const sprite = this._createCellSizedSprite(SYMBOLS.SCATTER, 5);
      sprite.pivot.set(sprite.width / 2, sprite.height / 2);
      sprite.position.set(center.x, center.y);

      const ring = new PIXI.Graphics();
      ring.circle(0, 0, this.cellSize * 0.42);
      ring.stroke({ color: 0xffd16a, width: 4, alpha: 0.82 });
      ring.position.set(center.x, center.y);

      this.animationContainer.addChild(ring);
      this.animationContainer.addChild(sprite);
      overlays.push({ sprite, ring });
    }

    await new Promise((resolve) => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        for (const item of overlays) {
          const pulse = Math.sin(progress * Math.PI * 3);
          const wiggle = Math.sin(progress * Math.PI * 4.5);
          item.sprite.scale.set(1 + pulse * (0.1 * intensity));
          item.sprite.rotation = wiggle * (0.055 * intensity);
          item.ring.scale.set(1 + pulse * (0.06 * intensity));
          item.ring.alpha = 0.36 + (pulse + 1) * (0.18 * intensity);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
          return;
        }

        resolve();
      };

      animate();
    });

    for (const item of overlays) {
      this.animationContainer.removeChild(item.sprite);
      this.animationContainer.removeChild(item.ring);
      item.sprite.destroy({ children: true });
      item.ring.destroy({ children: true });
    }
  }

  async animateSpinTransition(fromGrid, toGrid, duration = 520, options = {}) {
    await this.ready;

    return new Promise((resolve) => {
      const { columnStaggerMs = 28, showBonusOverlays = false } = options;

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

  async animateGridDrop(gridData, duration = 420, options = {}) {
    await this.ready;

    return new Promise((resolve) => {
      const padding = 5;

      const {
        changedKeys = null,
        baseGrid = null,
        columnStaggerMs = 16,
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
          const startY = -this.cellSize * 1.6;
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
    sprite.stroke({ color: isBonusPalette ? 0xfff1cf : 0xe0d0b2, width: 2 });

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
    duration = 300,
  ) {
    await this.ready;

    return new Promise((resolve) => {
      // 1. Highlight winning symbols briefly
      this.render(beforeGrid, winPositions, { showBonusOverlays: false });

      const highlightMs = Math.min(120, Math.max(40, duration * 0.35));
      const fadeMs = Math.max(120, duration * 0.75);
      const fallDistance = this.cellSize * 1.15;

      setTimeout(() => {
        // 2. Animate removal (fade out)
        const startTime = Date.now();
        const animateRemoval = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / fadeMs, 1);

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
              if (typeof child.__baseY !== "number") {
                child.__baseY = child.y;
              }

              child.y = child.__baseY + fallDistance * progress;
              child.alpha = 1 - progress;
            }
          }

          if (progress < 1) {
            requestAnimationFrame(animateRemoval);
          } else {
            // 3. Drop only changed cells to avoid full-grid flicker
            const changedKeys = this._getChangedKeys(beforeGrid, afterGrid);
            const baseGrid = beforeGrid.map((row) => [...row]);

            for (const key of changedKeys) {
              const [x, y] = key.split("_").map(Number);
              baseGrid[y][x] = SYMBOLS.EMPTY;
            }

            this.animateGridDrop(afterGrid, Math.max(160, duration * 1.1), {
              changedKeys,
              baseGrid,
              columnStaggerMs: 12,
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
  async animateSpinStart(duration = 500) {
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
  async animateWin(winAmount, winPositions, duration = 800) {
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

    const { betAmount = 1 } = options;
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
        const sortedReveals = [...reveals].sort((left, right) => {
          if (left.y === right.y) {
            return left.x - right.x;
          }
          return left.y - right.y;
        });

        const revealCount = sortedReveals.length;
        const revealDuration =
          revealCount > 20 ? 220 : revealCount > 12 ? 250 : 290;
        const revealStagger =
          revealCount > 20 ? 12 : revealCount > 12 ? 16 : 24;

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
      }

      if (cloverHits.length > 0) {
        for (const cloverHit of cloverHits) {
          const coinTargets = cloverHit.targets.filter(
            (target) => target.type === "coin",
          );
          const collectorTargets = cloverHit.targets.filter(
            (target) => target.type === "collector",
          );

          const cloverFocusDuration =
            560 + coinTargets.length * 620 + collectorTargets.length * 360;
          const cloverFocusPromise = this._animateFocusedTileAtCell(
            cloverHit.x,
            cloverHit.y,
            Math.max(620, cloverFocusDuration),
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
            360,
          );

          await this._wait(120);

          await this._animateMultiplierBurstFromClover(
            cloverHit,
            [...coinTargets, ...collectorTargets],
            360,
          );

          await this._wait(70);

          for (const target of coinTargets) {
            const key = `${target.x}_${target.y}`;
            const existing = this.revealedSymbolMap.get(key);

            await this._animateCellUpgradePulse(
              target.x,
              target.y,
              target.before,
              target.after,
              340,
              {
                valueColor: existing?.accentColor ?? 0x2e2418,
              },
            );

            if (existing) {
              this.revealedSymbolMap.set(key, {
                ...existing,
                label: this._formatBonusValue(target.after),
              });
            }

            this.render(this.lastRenderedGrid, new Set(), {
              showBonusOverlays: true,
            });
            await this._wait(90);
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

            this.render(this.lastRenderedGrid, new Set(), {
              showBonusOverlays: true,
            });
            await this._wait(100);
          }

          await this._wait(80);
          await cloverFocusPromise;
        }
      }

      if (collectorSteps.length > 0) {
        const coinValues = new Map();

        for (const reveal of reveals) {
          if (reveal.type === "coin") {
            coinValues.set(`${reveal.x},${reveal.y}`, reveal.value);
          }
        }

        for (const cloverHit of cloverHits) {
          for (const target of cloverHit.targets || []) {
            if (target.type === "coin") {
              coinValues.set(`${target.x},${target.y}`, target.after);
            }
          }
        }

        const collectibleSources = Array.from(coinValues.entries()).map(
          ([key, value]) => {
            const [x, y] = key.split(",").map(Number);
            return {
              x,
              y,
              value,
              label: this._formatBonusValue(value),
            };
          },
        );

        for (const step of collectorSteps) {
          const sources = collectibleSources.filter(
            (source) => source.x !== step.x || source.y !== step.y,
          );

          const potFocusDuration = sources.length > 0 ? 1320 : 760;
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
          await this._wait(180);
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
          420,
        );
      }

      await this._wait(80);
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
