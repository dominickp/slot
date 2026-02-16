/**
 * Treasure at the End of the Rainbow (5 scatters)
 * - 12 free spins
 * - Golden squares never disappear during the bonus
 * - Guaranteed rainbow every free spin
 */

import { BonusMode } from "./bonusMode.js";

export class CascadeMaster extends BonusMode {
  constructor(initialSpins = 12) {
    super(initialSpins, {
      id: "TREASURE_RAINBOW",
      name: "Treasure at the End of the Rainbow",
      persistGoldenSquaresAfterActivation: true,
      guaranteedRainbowEverySpin: true,
    });
  }

  /**
   * Increment cascade multiplier and apply to wins
   * Each cascade multiplies results by cascade count
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
      tier: 3,
    };
  }
}

export default CascadeMaster;
