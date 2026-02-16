import { LuckyScapeSlot } from "./luckyScapeSlot.js";

describe("LuckyScapeSlot rainbow enforcement", () => {
  it("keeps a single rainbow visible when already spawned this spin", () => {
    const slot = new LuckyScapeSlot();
    slot.currentGrid = [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 9, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ];
    slot.rainbowSpawnedThisSpin = true;

    slot._enforceSingleRainbowPerSpin();

    expect(slot.currentGrid[2][2]).toBe(9);
  });

  it("replaces only extra rainbows and keeps one", () => {
    const slot = new LuckyScapeSlot();
    slot.currentGrid = [
      [1, 1, 1, 1, 1, 1],
      [1, 9, 1, 1, 1, 1],
      [1, 1, 1, 9, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ];
    slot.rainbowSpawnedThisSpin = true;

    slot._enforceSingleRainbowPerSpin();

    const rainbowCount = slot.currentGrid
      .flat()
      .filter((symbol) => symbol === 9).length;

    expect(rainbowCount).toBe(1);
  });
});

describe("LuckyScapeSlot collector payout consistency", () => {
  it("uses final collector values after clover multipliers for round payout", () => {
    const slot = new LuckyScapeSlot();

    slot.goldenSquares = new Set(["0,0", "1,0"]);
    slot.bonusEventTimeline = [];

    slot._getGoldenSquareOutcomeChances = () => ({
      coin: 0.5,
      clover: 0.3,
      pot: 0.2,
    });
    slot._rollCoinValue = () => 100;
    slot._rollCloverMultiplierValue = () => 3;

    const floatRolls = [0.1, 0.95, 0.6];
    let floatIndex = 0;
    slot.rng.nextFloat = () => {
      const roll = floatRolls[floatIndex] ?? 0;
      floatIndex += 1;
      return roll;
    };

    const round = slot._executeSingleChainRound(1);

    expect(round.roundCollectionValue).toBe(300);
    expect(slot.bonusEventTimeline).toHaveLength(1);
    expect(slot.bonusEventTimeline[0].roundCollectionValue).toBe(300);
  });

  it("reduces pot chance as collector count increases", () => {
    const slot = new LuckyScapeSlot();

    const baseChance = 0.05;
    const chanceAtZeroCollectors = slot._getAdjustedPotChance(baseChance, 0);
    const chanceAtOneCollector = slot._getAdjustedPotChance(baseChance, 1);
    const chanceAtThreeCollectors = slot._getAdjustedPotChance(baseChance, 3);

    expect(chanceAtZeroCollectors).toBeCloseTo(0.0375);
    expect(chanceAtOneCollector).toBeLessThan(chanceAtZeroCollectors);
    expect(chanceAtThreeCollectors).toBeLessThan(chanceAtOneCollector);
    expect(chanceAtThreeCollectors).toBeGreaterThan(0);
  });
});

describe("LuckyScapeSlot minimum bonus rainbow safeguard", () => {
  it("forces rainbow on final GLITTER_GOLD spin when none seen", () => {
    const slot = new LuckyScapeSlot();
    slot.isInFreeSpins = true;
    slot.bonusMode = { id: "GLITTER_GOLD", remaining: 1 };
    slot.bonusSawRainbowThisSession = false;

    expect(slot._shouldForceMinimumBonusRainbowSpin()).toBe(true);
  });

  it("does not force rainbow if one already appeared in GLITTER_GOLD", () => {
    const slot = new LuckyScapeSlot();
    slot.isInFreeSpins = true;
    slot.bonusMode = { id: "GLITTER_GOLD", remaining: 1 };
    slot.bonusSawRainbowThisSession = true;

    expect(slot._shouldForceMinimumBonusRainbowSpin()).toBe(false);
  });
});
