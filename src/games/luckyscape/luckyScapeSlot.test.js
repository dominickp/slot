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

  it("includes coins revealed after collector suction in round payout", () => {
    const slot = new LuckyScapeSlot();

    slot.goldenSquares = new Set(["0,0", "1,0"]);
    slot._getGoldenSquareOutcomeChances = () => ({
      coin: 0.5,
      clover: 0,
      pot: 0.5,
    });
    slot._getAdjustedPotChance = (basePotChance) => basePotChance;

    const coinValues = [5, 7];
    slot._rollCoinValue = () => coinValues.shift();

    const floatRolls = [0.6, 0.1, 0.1];
    let floatIndex = 0;
    slot.rng.nextFloat = () => {
      const roll = floatRolls[floatIndex] ?? 0;
      floatIndex += 1;
      return roll;
    };

    const round = slot._executeSingleChainRound(1);

    expect(round.potCount).toBe(1);
    expect(round.roundCollectionValue).toBe(12);
  });
});

describe("LuckyScapeSlot minimum bonus rainbow safeguard", () => {
  it("forces rainbow on final GLITTER_GOLD spin when none has activated golds", () => {
    const slot = new LuckyScapeSlot();
    slot.isInFreeSpins = true;
    slot.bonusMode = { id: "GLITTER_GOLD", remaining: 1 };
    slot.bonusHadRainbowActivationThisSession = false;

    expect(slot._shouldForceMinimumBonusRainbowSpin()).toBe(true);
  });

  it("does not force rainbow if one already activated golds in GLITTER_GOLD", () => {
    const slot = new LuckyScapeSlot();
    slot.isInFreeSpins = true;
    slot.bonusMode = { id: "GLITTER_GOLD", remaining: 1 };
    slot.bonusHadRainbowActivationThisSession = true;

    expect(slot._shouldForceMinimumBonusRainbowSpin()).toBe(false);
  });
});

describe("LuckyScapeSlot super-cascade removal integration", () => {
  it("removes extra matching symbols outside the connected cluster", async () => {
    const slot = new LuckyScapeSlot();

    slot._generateRandomGrid = () => [
      [1, 1, 1, 1, 1, 2],
      [2, 2, 2, 2, 2, 2],
      [1, 3, 3, 3, 3, 3],
      [4, 4, 4, 4, 4, 4],
      [5, 5, 5, 5, 5, 5],
    ];
    slot._getSymbolWeightsForCurrentSpin = () => [{ id: 2, weight: 1 }];

    const result = await slot.spin(null, 1);

    expect(result.cascades.length).toBeGreaterThan(0);
    expect(result.cascades[0].winPositions.has("0,0")).toBe(true);
    expect(result.cascades[0].winPositions.has("0,2")).toBe(true);
    expect(result.cascades[0].connectionPositions.has("0,0")).toBe(true);
    expect(result.cascades[0].connectionPositions.has("0,2")).toBe(false);
  });

  it("always removes every connected position even if super-cascade under-returns", async () => {
    const slot = new LuckyScapeSlot();

    slot._generateRandomGrid = () => [
      [1, 1, 1, 1, 1, 2],
      [2, 3, 4, 5, 11, 12],
      [13, 14, 15, 2, 3, 4],
      [5, 11, 12, 13, 14, 15],
      [2, 3, 4, 5, 11, 12],
    ];
    slot._getSymbolWeightsForCurrentSpin = () => [{ id: 2, weight: 1 }];

    const originalSuperRemoval =
      slot.detector.getSuperCascadeRemovalPositions.bind(slot.detector);
    slot.detector.getSuperCascadeRemovalPositions = () => new Set(["0,0"]);

    const result = await slot.spin(null, 1);

    slot.detector.getSuperCascadeRemovalPositions = originalSuperRemoval;

    expect(result.cascades.length).toBeGreaterThan(0);
    expect(result.cascades[0].connectionPositions.has("0,0")).toBe(true);
    expect(result.cascades[0].connectionPositions.has("4,0")).toBe(true);
    expect(result.cascades[0].winPositions.has("0,0")).toBe(true);
    expect(result.cascades[0].winPositions.has("4,0")).toBe(true);
  });
});

describe("LuckyScapeSlot debug spin guarantees", () => {
  it("forces at least one rainbow and one connection when debug mode is enabled", () => {
    const slot = new LuckyScapeSlot({
      debug: {
        enabled: true,
        forceConnectionAndRainbow: true,
      },
    });

    slot.currentGrid = [
      [1, 2, 3, 4, 5, 11],
      [12, 13, 14, 15, 1, 2],
      [3, 4, 5, 11, 12, 13],
      [14, 15, 1, 2, 3, 4],
      [5, 11, 12, 13, 14, 15],
    ];

    slot._applyDebugSpinGuarantees();

    const rainbowCount = slot.currentGrid
      .flat()
      .filter((symbol) => symbol === 9).length;
    const winCount = slot.detector.findWins(slot.currentGrid).clusters.length;

    expect(rainbowCount).toBe(1);
    expect(winCount).toBeGreaterThan(0);
  });

  it("forces at least one collector reveal during chain round in debug mode", () => {
    const slot = new LuckyScapeSlot({
      debug: {
        enabled: true,
        forceConnectionAndRainbow: true,
      },
    });

    slot.goldenSquares = new Set(["0,0", "1,0", "2,0", "3,0", "4,0"]);
    slot._getGoldenSquareOutcomeChances = () => ({
      coin: 1,
      clover: 0,
      pot: 0,
    });
    slot._rollCoinValue = () => 1;
    slot.rng.nextFloat = () => 0;

    const round = slot._executeSingleChainRound(1);

    expect(round.potCount).toBeGreaterThan(0);
    expect(
      slot.bonusEventTimeline[0].reveals.some((r) => r.type === "collector"),
    ).toBe(true);
  });
});
