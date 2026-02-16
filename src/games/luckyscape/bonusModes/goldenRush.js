/**
 * All That Glitters Is Gold (4 scatters)
 * - 12 free spins
 * - Golden squares never disappear during the bonus
 */

import { BonusMode } from "./bonusMode.js";

export class GoldenRush extends BonusMode {
  constructor(initialSpins = 12) {
    super(initialSpins, {
      id: "GLITTER_GOLD",
      name: "All That Glitters Is Gold",
      persistGoldenSquaresAfterActivation: true,
      guaranteedRainbowEverySpin: false,
    });
  }

  /**
   * Apply golden squares to winning positions
   * Golden squares persist and gain multiplier after spin 4
   */
  onCascade(cascadeIndex, grid, winResult) {
    return 1.0;
  }

  /**
   * Retriggers are handled in LuckyScapeSlot
   * Keep method for interface compatibility
   */
  onRetrigger(newScatterCount) {
    return 0;
  }

  getDisplayData() {
    return {
      ...super.getDisplayData(),
      tier: 2,
    };
  }
}

export default GoldenRush;
