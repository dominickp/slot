/**
 * BonusMode - Base class for all free spins bonus modes
 *
 * Each mode handles:
 * - State management during free spins
 * - Win multiplier application
 * - Mode-specific display/state hooks
 * - Visual data for renderer
 */

export class BonusMode {
  constructor(initialSpins, options = {}) {
    this.remaining = initialSpins;
    this.spinsCompleted = 0;
    this.totalWon = 0;
    this.id = options.id || "BONUS";
    this.name = options.name || "Bonus";
    this.persistGoldenSquaresAfterActivation = Boolean(
      options.persistGoldenSquaresAfterActivation,
    );
    this.guaranteedRainbowEverySpin = Boolean(
      options.guaranteedRainbowEverySpin,
    );
  }

  /**
   * Called when a cascade completes during free spins
   * Returns multiplier to apply to that cascade's wins
   *
   * @param {number} cascadeIndex - Which cascade in this spin (1-based)
   * @param {number[][]} grid - Current game grid
   * @param {Object} winResult - Result from detectWins()
   * @returns {number} Multiplier to apply to cascade win
   */
  onCascade(cascadeIndex, grid, winResult) {
    // Base implementation: no multiplier
    return 1.0;
  }

  /**
   * Called when retrigger (more scatters) occur during free spins
   *
   * Retrigger behavior is centralized in LuckyScapeSlot.
   * Mode classes should not award spins directly.
   *
   * @param {number} newScatterCount - Number of scatters found
   * @returns {number} Additional spins to award
   */
  onRetrigger(newScatterCount) {
    // Base implementation: no additional spins
    return 0;
  }

  /**
   * Called when a free spin completes
   * Updates internal state, returns any visual data
   *
   * @param {number} spinWin - Win amount from this spin
   * @returns {Object} State changes for renderer
   */
  onSpinComplete(spinWin) {
    this.spinsCompleted++;
    this.remaining--;
    this.totalWon += spinWin;

    return {
      remaining: this.remaining,
      spinsCompleted: this.spinsCompleted,
      totalWon: this.totalWon,
      isComplete: this.remaining <= 0,
    };
  }

  /**
   * Get visual display data for UI
   * Returns any mode-specific information to show player
   *
   * @returns {Object} Display data
   */
  getDisplayData() {
    return {
      id: this.id,
      name: this.name,
      remaining: this.remaining,
      spinsCompleted: this.spinsCompleted,
      totalWon: this.totalWon,
      persistGoldenSquaresAfterActivation:
        this.persistGoldenSquaresAfterActivation,
      guaranteedRainbowEverySpin: this.guaranteedRainbowEverySpin,
    };
  }

  /**
   * Check if bonus is complete
   */
  isComplete() {
    return this.remaining <= 0;
  }
}

export default BonusMode;
