/**
 * PayoutCalculator - Calculates wins from reel positions
 *
 * Responsible for:
 * - Detecting winning combinations
 * - Calculating payout amounts
 * - Evaluating special symbols (wild, scatter)
 */

export class PayoutCalculator {
  constructor(gameConfig) {
    this.symbols = gameConfig.symbols || [];
    this.paylines = gameConfig.paylines || [];
    this.paytable = gameConfig.paytable || {};
    this.wildSymbol = gameConfig.wildSymbol || null;
    this.scatterSymbol = gameConfig.scatterSymbol || null;
  }

  /**
   * Detect all wins on given reel positions
   * @param {array} reelPositions - Which symbol on each reel [0, 2, 1]
   * @param {number} betPerLine - Bet amount per payline
   * @returns {object} { totalWin, wins: [], scatterData }
   */
  detectWins(reelPositions, betPerLine) {
    const wins = [];
    let totalWin = 0;

    // Check paylines for matching symbols
    if (this.paylines && this.paylines.length > 0) {
      for (const payline of this.paylines) {
        const lineWin = this._checkPayline(reelPositions, payline, betPerLine);
        if (lineWin.win > 0) {
          wins.push(lineWin);
          totalWin += lineWin.win;
        }
      }
    }

    // Check for scatter wins
    const scatterData = this._checkScatters(reelPositions, betPerLine);
    if (scatterData.count >= (scatterData.minCount || 3)) {
      wins.push({
        type: "scatter",
        count: scatterData.count,
        win: scatterData.win,
        multiplier: scatterData.multiplier,
      });
      totalWin += scatterData.win;
    }

    return {
      totalWin,
      wins,
      scatterData: scatterData.count > 0 ? scatterData : null,
    };
  }

  /**
   * Check single payline for wins
   * @private
   */
  _checkPayline(reelPositions, payline, betPerLine) {
    // Get symbols on this payline
    const symbols = payline.map((reelIndex, lineIndex) => {
      return this._getSymbolAtPosition(reelIndex, reelPositions[reelIndex]);
    });

    // Check if all non-wild symbols are the same
    const nonWildSymbols = symbols.filter((s) => s !== this.wildSymbol);

    if (nonWildSymbols.length === 0) {
      // All wilds - this shouldn't count as win typically
      return { win: 0, line: payline, symbols };
    }

    const firstSymbol = nonWildSymbols[0];
    const allMatch = nonWildSymbols.every((s) => s === firstSymbol);

    if (!allMatch) {
      return { win: 0, line: payline, symbols };
    }

    // Get payout for this symbol
    const payoutMultiplier = this.paytable[firstSymbol] || 0;
    const win = payoutMultiplier * betPerLine;

    return {
      win,
      line: payline,
      symbols,
      matchingSymbol: firstSymbol,
      payoutMultiplier,
    };
  }

  /**
   * Check for scatter wins
   * @private
   */
  _checkScatters(reelPositions, betPerLine) {
    if (!this.scatterSymbol) {
      return { count: 0, win: 0 };
    }

    // Count scatter symbols across all reels
    let scatterCount = 0;
    for (let i = 0; i < reelPositions.length; i++) {
      if (
        this._getSymbolAtPosition(i, reelPositions[i]) === this.scatterSymbol
      ) {
        scatterCount++;
      }
    }

    // Scatter payouts typically don't depend on position, just count
    const scatterPaytable = this.paytable.scatter || {};
    const multiplier = scatterPaytable[scatterCount] || 0;
    const win = multiplier * betPerLine;

    return {
      count: scatterCount,
      win,
      multiplier,
    };
  }

  /**
   * Get symbol at reel/position
   * @private
   */
  _getSymbolAtPosition(reelIndex, positionIndex) {
    if (!this.symbols[reelIndex]) {
      return null;
    }
    return this.symbols[reelIndex][
      positionIndex % this.symbols[reelIndex].length
    ];
  }

  /**
   * Validate that a win amount is legal
   * Used by backend to prevent tampering
   */
  validateWin(reelPositions, betPerLine, claimedWin) {
    const calculated = this.detectWins(reelPositions, betPerLine);
    return {
      isValid: calculated.totalWin === claimedWin,
      expectedWin: calculated.totalWin,
      claimedWin,
    };
  }
}

export default PayoutCalculator;
