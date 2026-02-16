/**
 * Luck of the Leprechaun (3 scatters)
 * - 8 free spins
 * - Golden squares persist between spins until a rainbow activation
 */

import { BonusMode } from "./bonusMode.js";

export class LockAndLoad extends BonusMode {
  constructor(initialSpins = 8) {
    super(initialSpins, {
      id: "LEPRECHAUN",
      name: "Luck of the Leprechaun",
      persistGoldenSquaresAfterActivation: false,
      guaranteedRainbowEverySpin: false,
    });
  }

  /**
   * Apply lock to winning positions
   * Lock is persistent for rest of bonus
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
      tier: 1,
    };
  }
}

export default LockAndLoad;
