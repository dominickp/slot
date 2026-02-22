/**
 * CascadeDetector - Core win detection algorithm for Lucky Cascade
 *
 * Responsible for:
 * - Finding winning clusters (5+ adjacent matching symbols)
 * - Calculating payouts via size-banded paytable rows
 * - Supporting exact-symbol cluster matching
 * - Detecting multiple simultaneous wins
 *
 * Algorithm: Flood-fill connected component detection
 * Time Complexity: O(n²) per detection
 */

export class CascadeDetector {
  /**
   * Symbol ID constants
   */
  static SYMBOL_IDS = {
    TEN: 1,
    JACK: 2,
    QUEEN: 3,
    KING: 4,
    ACE: 5,
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
    TRAP: 11,
    CHEESE: 12,
    BEER: 13,
    BREAD: 14,
    TOP_HAT: 15,
    EMPTY: 0,
  };

  static REGULAR_SYMBOL_IDS = new Set([1, 2, 3, 4, 5, 11, 12, 13, 14, 15]);

  static NON_CLUSTER_SYMBOL_IDS = new Set([0, 7, 8, 9, 10]);

  /**
   * Base payouts per symbol (in units of bet)
   */
  static BASE_PAYOUTS = {
    1: 0.1,
    2: 0.1,
    3: 0.1,
    4: 0.1,
    5: 0.1,
    6: 1.0,
    11: 0.3,
    12: 0.3,
    13: 0.5,
    14: 0.5,
    15: 1.0,
    7: "special", // SCATTER (doesn't use cluster payout)
    8: "special", // CLOVER symbol
    9: "special", // RAINBOW symbol
    10: "special", // BUCKET symbol
  };

  /**
   * Le Bandit-style cluster paytable by symbol and size band.
   *
   * Size bands:
   * - 5
   * - 6
   * - 7
   * - 8
   * - 9-10
   * - 11-12
   * - 13+
   */
  static CLUSTER_PAYTABLE = {
    // 10, J, Q, K, A
    1: {
      5: 0.1,
      6: 0.2,
      7: 0.3,
      8: 0.5,
      "9-10": 1.5,
      "11-12": 5.0,
      "13+": 15.0,
    },
    2: {
      5: 0.1,
      6: 0.2,
      7: 0.3,
      8: 0.5,
      "9-10": 1.5,
      "11-12": 5.0,
      "13+": 15.0,
    },
    3: {
      5: 0.1,
      6: 0.2,
      7: 0.3,
      8: 0.5,
      "9-10": 1.5,
      "11-12": 5.0,
      "13+": 15.0,
    },
    4: {
      5: 0.1,
      6: 0.2,
      7: 0.3,
      8: 0.5,
      "9-10": 1.5,
      "11-12": 5.0,
      "13+": 15.0,
    },
    5: {
      5: 0.1,
      6: 0.2,
      7: 0.3,
      8: 0.5,
      "9-10": 1.5,
      "11-12": 5.0,
      "13+": 15.0,
    },
    // Wild (kept in play)
    6: {
      5: 1.0,
      6: 1.5,
      7: 2.0,
      8: 3.0,
      "9-10": 10.0,
      "11-12": 30.0,
      "13+": 100.0,
    },
    // Trap / Cheese
    11: {
      5: 0.3,
      6: 0.4,
      7: 0.5,
      8: 0.7,
      "9-10": 2.5,
      "11-12": 7.5,
      "13+": 25.0,
    },
    12: {
      5: 0.3,
      6: 0.4,
      7: 0.5,
      8: 0.7,
      "9-10": 2.5,
      "11-12": 7.5,
      "13+": 25.0,
    },
    // Beer / Bread
    13: {
      5: 0.5,
      6: 0.7,
      7: 1.0,
      8: 1.5,
      "9-10": 5.0,
      "11-12": 15.0,
      "13+": 50.0,
    },
    14: {
      5: 0.5,
      6: 0.7,
      7: 1.0,
      8: 1.5,
      "9-10": 5.0,
      "11-12": 15.0,
      "13+": 50.0,
    },
    // Top Hat
    15: {
      5: 1.0,
      6: 1.5,
      7: 2.0,
      8: 3.0,
      "9-10": 10.0,
      "11-12": 30.0,
      "13+": 100.0,
    },
  };

  /**
   * Legacy multipliers (kept for compatibility display hooks).
   * Runtime payout logic uses CLUSTER_PAYTABLE.
   */
  static CLUSTER_MULTIPLIERS = {
    5: 1.0,
    6: 1.5,
    7: 2.0,
    8: 2.0, // 8+ all get 2x
  };

  constructor(gridWidth = 5, gridHeight = 5) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
  }

  /**
   * Main entry point: Find all winning clusters in a grid
   *
   * @param {number[][]} grid - 5x5 grid of symbol IDs
   * @returns {Object} {
   *   clusters: Array of winning clusters
   *   totalWin: Sum of all payouts (in units of bet)
   *   winPositions: Set of all positions that are part of a win
   * }
   */
  findWins(grid) {
    const visited = new Set();
    const clusters = [];

    // Scan entire grid for unvisited symbols
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const posKey = this._posKey(x, y);

        // Skip if already part of a cluster or non-paying special
        if (visited.has(posKey)) continue;
        if (CascadeDetector.NON_CLUSTER_SYMBOL_IDS.has(grid[y][x])) continue;

        // Start flood-fill from this position
        const cluster = this._findCluster(grid, x, y, visited);

        // Only consider valid wins (5+ symbols)
        if (cluster.positions.length >= 5) {
          clusters.push(cluster);
        }
      }
    }

    // Calculate payouts and aggregate results
    const winPositions = new Set();
    let totalWin = 0;

    for (const cluster of clusters) {
      // Calculate payout for this cluster
      const payout = this._calculateClusterPayout(cluster, grid);
      totalWin += payout;

      // Mark all positions in cluster as winning
      for (const pos of cluster.positions) {
        winPositions.add(this._posKey(pos.x, pos.y));
      }
    }

    return {
      clusters,
      totalWin,
      winPositions,
    };
  }

  /**
   * Flood-fill algorithm to find connected component of matching symbols
   * Uses BFS to avoid stack overflow on large clusters
   *
   * @private
   * @param {number[][]} grid - Game grid
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {Set} visited - Visited positions tracker
   * @returns {Object} {positions: [{x, y}], symbolId: number}
   */
  _findCluster(grid, startX, startY, visited) {
    const positions = [];
    const symbolId = grid[startY][startX];
    const queue = [[startX, startY]];
    const posKey = this._posKey(startX, startY);

    visited.add(posKey);

    // BFS queue processing
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      positions.push({ x, y });

      // Check all 4 adjacent positions
      const neighbors = [
        [x + 1, y], // Right
        [x - 1, y], // Left
        [x, y + 1], // Down
        [x, y - 1], // Up
      ];

      for (const [nx, ny] of neighbors) {
        // Check bounds
        if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) {
          continue;
        }

        const nPosKey = this._posKey(nx, ny);

        // Skip if already visited
        if (visited.has(nPosKey)) {
          continue;
        }

        const neighborSymbol = grid[ny][nx];

        // Match if same symbol or if neighbor is wild or current is wild
        const matches = this._symbolsMatch(symbolId, neighborSymbol);

        if (matches) {
          visited.add(nPosKey);
          queue.push([nx, ny]);
        }
      }
    }

    return {
      positions,
      symbolId,
    };
  }

  /**
   * Check if two symbols match.
   * Matching is exact-symbol only; no substitution.
   *
   * @private
   * @param {number} symbol1 - First symbol ID
   * @param {number} symbol2 - Second symbol ID
   * @returns {boolean} True if symbols match
   */
  _symbolsMatch(symbol1, symbol2) {
    // Exclude empty and special symbols immediately
    if (
      symbol1 === CascadeDetector.SYMBOL_IDS.EMPTY ||
      symbol2 === CascadeDetector.SYMBOL_IDS.EMPTY ||
      symbol1 === CascadeDetector.SYMBOL_IDS.SCATTER ||
      symbol2 === CascadeDetector.SYMBOL_IDS.SCATTER ||
      symbol1 === CascadeDetector.SYMBOL_IDS.CLOVER ||
      symbol2 === CascadeDetector.SYMBOL_IDS.CLOVER ||
      symbol1 === CascadeDetector.SYMBOL_IDS.RAINBOW ||
      symbol2 === CascadeDetector.SYMBOL_IDS.RAINBOW ||
      symbol1 === CascadeDetector.SYMBOL_IDS.BUCKET ||
      symbol2 === CascadeDetector.SYMBOL_IDS.BUCKET
    ) {
      return false;
    }

    // Same symbol always matches
    if (symbol1 === symbol2) return true;

    // Wild substitution: If the root (symbol1) is a regular symbol, it matches a Wild
    if (
      symbol1 !== CascadeDetector.SYMBOL_IDS.WILD &&
      symbol2 === CascadeDetector.SYMBOL_IDS.WILD
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate payout for a winning cluster
   * Payout comes from the symbol row + cluster size band in CLUSTER_PAYTABLE.
   *
   * @private
   * @param {Object} cluster - Cluster with positions and symbolId
   * @param {number[][]} grid - Game grid (to check all symbols in cluster)
   * @returns {number} Payout in units of bet
   */
  _calculateClusterPayout(cluster, grid) {
    const { positions } = cluster;
    const clusterSize = positions.length;
    const highestSymbolId = this._getHighestPayingSymbolInCluster(
      positions,
      grid,
    );
    const paytable = CascadeDetector.CLUSTER_PAYTABLE[highestSymbolId];

    if (!paytable) {
      return 0;
    }

    const band = this._getClusterSizeBand(clusterSize);
    return Number(paytable[band] || 0);
  }

  _getHighestPayingSymbolInCluster(positions, grid) {
    let highestSymbolId = null;
    let highestFiveClusterPayout = -Infinity;

    for (const pos of positions) {
      const symbolId = grid[pos.y][pos.x];
      const paytable = CascadeDetector.CLUSTER_PAYTABLE[symbolId];
      if (!paytable) {
        continue;
      }

      const fiveOfAKindPayout = Number(paytable[5] || 0);
      if (fiveOfAKindPayout > highestFiveClusterPayout) {
        highestFiveClusterPayout = fiveOfAKindPayout;
        highestSymbolId = symbolId;
      }
    }

    return highestSymbolId;
  }

  _getClusterSizeBand(clusterSize) {
    if (clusterSize <= 5) {
      return 5;
    }

    if (clusterSize === 6) {
      return 6;
    }

    if (clusterSize === 7) {
      return 7;
    }

    if (clusterSize === 8) {
      return 8;
    }

    if (clusterSize <= 10) {
      return "9-10";
    }

    if (clusterSize <= 12) {
      return "11-12";
    }

    return "13+";
  }

  /**
   * Check for scatter symbols and their count
   * Scatters don't need to match or form clusters; any 3+ triggers bonus
   *
   * @param {number[][]} grid - Game grid
   * @returns {Object} {
   *   count: number of scatters,
   *   positions: Array of scatter positions,
   *   bonusMode: String identifier of bonus triggered
   * }
   */
  findScatters(grid) {
    const scatterPositions = [];

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.SCATTER) {
          scatterPositions.push({ x, y });
        }
      }
    }

    const count = scatterPositions.length;
    let bonusMode = null;

    // Determine which bonus mode is triggered
    if (count >= 5) {
      bonusMode = "TREASURE_RAINBOW";
    } else if (count === 4) {
      bonusMode = "GLITTER_GOLD";
    } else if (count === 3) {
      bonusMode = "LEPRECHAUN";
    }

    return {
      count,
      positions: scatterPositions,
      bonusMode,
    };
  }

  /**
   * Compute Super Cascades removal positions.
   *
   * Removes:
   * - All current winning positions
   * - Any additional visible regular symbols that match
   *   regular symbol types participating in winning clusters
   *
   * @param {number[][]} grid - Game grid
   * @param {Object} winResult - Result from findWins(grid)
   * @returns {Set<string>} Position keys to remove
   */
  getSuperCascadeRemovalPositions(grid, winResult) {
    const positionsToRemove = new Set(winResult?.winPositions || []);
    const matchingRegularSymbols = new Set();

    for (const cluster of winResult?.clusters || []) {
      for (const pos of cluster.positions) {
        const symbolId = grid[pos.y][pos.x];
        if (CascadeDetector.REGULAR_SYMBOL_IDS.has(symbolId)) {
          matchingRegularSymbols.add(symbolId);
        }
      }
    }

    if (matchingRegularSymbols.size === 0) {
      return positionsToRemove;
    }

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (matchingRegularSymbols.has(grid[y][x])) {
          positionsToRemove.add(this._posKey(x, y));
        }
      }
    }

    return positionsToRemove;
  }

  /**
   * Mark positions as empty (for cascade removal)
   *
   * @param {number[][]} grid - Game grid (mutated)
   * @param {Set} positionsToRemove - Set of position keys to remove
   */
  removeWinningSymbols(grid, positionsToRemove) {
    for (const posKey of positionsToRemove) {
      const { x, y } = this._parseKey(posKey);
      grid[y][x] = CascadeDetector.SYMBOL_IDS.EMPTY;
    }
  }

  /**
   * Utility: Convert [x, y] to string key
   * @private
   */
  _posKey(x, y) {
    return `${x},${y}`;
  }

  /**
   * Utility: Parse string key back to [x, y]
   * @private
   */
  _parseKey(posKey) {
    const [x, y] = posKey.split(",").map(Number);
    return { x, y };
  }

  /**
   * Debug helper: Print grid to console
   * @param {number[][]} grid - Game grid
   */
  printGrid(grid) {
    const symbols = {
      0: "  . ",
      1: "  R ",
      2: "  G ",
      3: "  P ",
      4: "  Y ",
      5: "  B ",
      6: "  * ",
      7: "  S ",
      8: "  C ",
      9: "  R ",
      10: "  U ",
      11: "  T ",
      12: "  C ",
      13: "  B ",
      14: "  R ",
      15: "  H ",
    };

    for (let y = 0; y < this.gridHeight; y++) {
      let row = "";
      for (let x = 0; x < this.gridWidth; x++) {
        row += symbols[grid[y][x]] || "  ? ";
      }
      console.log(row);
    }
    console.log("---");
  }
}

export default CascadeDetector;
