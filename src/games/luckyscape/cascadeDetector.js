/**
 * CascadeDetector - Core win detection algorithm for Lucky Cascade
 *
 * Responsible for:
 * - Finding winning clusters (5+ adjacent matching symbols)
 * - Calculating payouts with cluster size bonuses
 * - Supporting wild symbol substitution
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
    EMPTY: 0,
  };

  /**
   * Base payouts per symbol (in units of bet)
   */
  static BASE_PAYOUTS = {
    1: 0.35,
    2: 0.45,
    3: 0.65,
    4: 0.85,
    5: 1.15,
    6: 1.6,
    7: "special", // SCATTER (doesn't use cluster payout)
    8: "special", // CLOVER symbol
    9: "special", // RAINBOW symbol
    10: "special", // BUCKET symbol
  };

  /**
   * Cluster size multipliers (favors larger clusters)
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
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.EMPTY) continue;
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.SCATTER) continue;
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.CLOVER) continue;
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.RAINBOW) continue;
        if (grid[y][x] === CascadeDetector.SYMBOL_IDS.BUCKET) continue;

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
   * Check if two symbols match (considering wild substitution)
   * Wild (6) matches any regular symbol (1-5) but not special symbols or empty
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

    // Wild substitution disabled for Le Bandit-style feel.
    return false;
  }

  /**
   * Calculate payout for a winning cluster
   * Payout = base_payout × cluster_multiplier
   *
   * For mixed clusters (with wild), use the highest payout symbol in cluster
   *
   * @private
   * @param {Object} cluster - Cluster with positions and symbolId
   * @param {number[][]} grid - Game grid (to check all symbols in cluster)
   * @returns {number} Payout in units of bet
   */
  _calculateClusterPayout(cluster, grid) {
    const { positions } = cluster;
    let basePayout = 0;

    // Check all positions in cluster for highest payout symbol
    let maxPayout = 0;
    for (const pos of positions) {
      const symbolId = grid[pos.y][pos.x];
      const symbolPayout = CascadeDetector.BASE_PAYOUTS[symbolId] || 0;
      maxPayout = Math.max(maxPayout, symbolPayout);
    }

    basePayout = maxPayout;
    const clusterSize = positions.length;

    // Get multiplier based on cluster size (cap at 8+)
    const multiplierKey = Math.min(clusterSize, 8);
    const multiplier =
      CascadeDetector.CLUSTER_MULTIPLIERS[multiplierKey] || 2.0;

    return basePayout * multiplier;
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
   * - Any additional visible regular symbols (1-5) that match
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
        if (
          symbolId >= CascadeDetector.SYMBOL_IDS.RED &&
          symbolId <= CascadeDetector.SYMBOL_IDS.WILD
        ) {
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
