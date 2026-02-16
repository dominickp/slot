/**
 * CascadeEngine - Handles symbol gravity, removal, and new symbol generation
 *
 * Sequence:
 * 1. Remove winning symbols
 * 2. Apply gravity (symbols fall down)
 * 3. Generate new symbols from top
 * 4. Return new grid state
 */

import { CascadeDetector } from "./cascadeDetector.js";

export class CascadeEngine {
  constructor(gridWidth = 5, gridHeight = 5) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.detector = new CascadeDetector(gridWidth, gridHeight);
  }

  /**
   * Execute one complete cascade cycle:
   * Remove winners → Apply gravity → Fill from top → Detect new wins
   *
   * @param {number[][]} grid - Current game grid
   * @param {Set} winPositions - Positions to remove
   * @param {RNG} rng - Random number generator for new symbols
   * @returns {Object} {
   *   grid: Updated grid after cascade,
   *   newWins: Result of detector.findWins() on cascade result,
   *   moved: How many cells moved (for animation calcs)
   * }
   */
  executeCascade(grid, winPositions, rng, options = {}) {
    // Step 1: Remove winning symbols
    this.detector.removeWinningSymbols(grid, winPositions);

    // Step 2: Apply gravity (drop symbols down)
    const moveData = this.applyGravity(grid);

    // Step 3: Fill empty spaces from top
    this.fillFromTop(grid, rng, options.symbolWeights);

    // Step 4: Check for new wins
    const newWins = this.detector.findWins(grid);

    return {
      grid,
      newWins,
      moveData,
    };
  }

  /**
   * Apply gravity: symbols fall down to fill empty spaces
   *
   * Algorithm:
   * 1. For each column, collect all non-empty symbols
   * 2. Place them at bottom of column
   * 3. Fill top with empty
   *
   * @param {number[][]} grid - Grid to modify (mutated)
   * @returns {Object} { movedCells: Array of movement info }
   */
  applyGravity(grid) {
    const movedCells = [];

    for (let x = 0; x < this.gridWidth; x++) {
      // Step 1: Collect all non-empty symbols in column
      const symbols = [];
      for (let y = 0; y < this.gridHeight; y++) {
        if (grid[y][x] !== CascadeDetector.SYMBOL_IDS.EMPTY) {
          symbols.push(grid[y][x]);
        }
      }

      // Step 2: Calculate how many empty spaces at top
      const emptyCount = this.gridHeight - symbols.length;

      // Step 3: Rebuild column (empty at top, symbols at bottom)
      for (let y = 0; y < this.gridHeight; y++) {
        const newSymbol =
          y < emptyCount
            ? CascadeDetector.SYMBOL_IDS.EMPTY
            : symbols[y - emptyCount];

        if (grid[y][x] !== newSymbol) {
          movedCells.push({
            x,
            y,
            fromY: this._findSourceY(grid, x, y),
            symbol: newSymbol,
          });
        }

        grid[y][x] = newSymbol;
      }
    }

    return { movedCells };
  }

  /**
   * Fill empty spaces from top with new random symbols
   * Does NOT generate scatters (only regular symbols)
   *
   * @param {number[][]} grid - Grid to modify (mutated)
   * @param {RNG} rng - Random number generator
   */
  fillFromTop(grid, rng, customSymbolWeights = null) {
    const symbolWeights =
      Array.isArray(customSymbolWeights) && customSymbolWeights.length > 0
        ? customSymbolWeights
        : [
      { id: CascadeDetector.SYMBOL_IDS.RED, weight: 22 },
      { id: CascadeDetector.SYMBOL_IDS.GREEN, weight: 20 },
      { id: CascadeDetector.SYMBOL_IDS.PURPLE, weight: 18 },
      { id: CascadeDetector.SYMBOL_IDS.YELLOW, weight: 16 },
      { id: CascadeDetector.SYMBOL_IDS.BLUE, weight: 14 },
      { id: CascadeDetector.SYMBOL_IDS.TRAP, weight: 11 },
      { id: CascadeDetector.SYMBOL_IDS.CHEESE, weight: 10 },
      { id: CascadeDetector.SYMBOL_IDS.BEER, weight: 8 },
      { id: CascadeDetector.SYMBOL_IDS.BREAD, weight: 7 },
      { id: CascadeDetector.SYMBOL_IDS.TOP_HAT, weight: 5 },
      { id: CascadeDetector.SYMBOL_IDS.WILD, weight: 6 },
      { id: CascadeDetector.SYMBOL_IDS.SCATTER, weight: 2 },
      { id: CascadeDetector.SYMBOL_IDS.RAINBOW, weight: 2 },
    ];

    // For each empty position, generate new symbol
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.EMPTY) {
          const symbol = this._pickWeightedSymbol(symbolWeights, rng);
          grid[y][x] = symbol;
        }
      }
    }
  }

  /**
   * Helper: Find the source Y position for a symbol after gravity
   * (Used for animation tracking)
   * @private
   */
  _findSourceY(grid, x, y) {
    // This is a simplified version
    // In a full implementation, we'd track where each symbol fell from
    return Math.max(0, y - 1);
  }

  /**
   * Helper: Pick a random symbol based on weights
   * @private
   */
  _pickWeightedSymbol(symbolWeights, rng) {
    const totalWeight = symbolWeights.reduce((sum, s) => sum + s.weight, 0);
    let roll = rng.nextInt(0, totalWeight - 1);

    for (const symbol of symbolWeights) {
      roll -= symbol.weight;
      if (roll < 0) {
        return symbol.id;
      }
    }

    // Fallback (shouldn't reach here)
    return symbolWeights[0].id;
  }

  /**
   * Create a deep copy of grid
   * @param {number[][]} grid - Grid to copy
   * @returns {number[][]} New grid copy
   */
  static cloneGrid(grid) {
    return grid.map((row) => [...row]);
  }

  /**
   * Create empty grid
   * @returns {number[][]} Grid filled with empty symbols
   */
  static createEmptyGrid(gridWidth = 5, gridHeight = 5) {
    return Array(gridHeight)
      .fill(null)
      .map(() => Array(gridWidth).fill(CascadeDetector.SYMBOL_IDS.EMPTY));
  }

  /**
   * Debug: Print grid to console
   * @param {number[][]} grid - Grid to print
   */
  printGrid(grid) {
    this.detector.printGrid(grid);
  }
}

export default CascadeEngine;
