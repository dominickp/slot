import { LuckyScapeSlot } from "./luckyScapeSlot.js";
import { LUCKY_ESCAPE_CONFIG } from "./config.js";

// What this gives you:
//     Isolated RTP: Now you can see if the GLITTER_GOLD bonus alone has a 120% RTP while your Base Game has an 85% RTP.
//     Profit Rate: For bonuses, "Hit Rate" doesn't mean much because they always pay something. The Profit Rate (>Cost) tells you exactly how often buying the 100x bonus actually returned more than 100x. If this is higher than ~15-20%, the bonus is usually too easy to profit on.
//     Avg / Max Win: Tells you if your mathematical top-end is reaching high enough or if the payouts are too flat.

// You can override these with environment variables if needed
const BET_AMOUNT = Number.parseFloat(process.env.RTP_BENCH_BET || "1");
const RUNS = Number.parseInt(process.env.RTP_BENCH_RUNS || "10000", 10);

function toPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Simulates standard base-game spins.
 * If a bonus is triggered naturally, it plays out the free spins
 * and includes the total win in that spin's return.
 */
async function simulateBaseGame(runs) {
  const slot = new LuckyScapeSlot();
  let totalCost = 0;
  let totalWin = 0;
  let hits = 0;
  let profits = 0;
  let bonusTriggers = 0;
  let maxWin = 0;

  for (let i = 0; i < runs; i++) {
    let runWin = 0;
    totalCost += BET_AMOUNT;

    // 1. Play the base spin
    const result = await slot.spin(null, BET_AMOUNT);
    runWin += result.totalWin || 0;

    // 2. If it triggered a bonus, play all the free spins immediately
    if (result.bonusMode) {
      bonusTriggers++;
      let guard = 1000;
      while (slot.isInFreeSpins && guard > 0) {
        const bonusResult = await slot.spin(null, BET_AMOUNT);
        runWin += bonusResult.totalWin || 0;

        if (bonusResult.scatterCount >= 2) {
          slot.handleFreeSpinsRetrigger(bonusResult.scatterCount);
        }

        slot.advanceFreeSpins();
        guard--;
      }
    }

    // 3. Record metrics for this run
    totalWin += runWin;
    if (runWin > 0) hits++;
    if (runWin > BET_AMOUNT) profits++;
    if (runWin > maxWin) maxWin = runWin;
  }

  return {
    mode: "Base Game",
    runs,
    costPerRun: BET_AMOUNT,
    totalCost,
    totalWin,
    rtp: totalCost > 0 ? totalWin / totalCost : 0,
    hitRate: hits / runs,
    profitRate: profits / runs, // How often spin pays more than bet
    bonusTriggerRate: bonusTriggers / runs,
    avgWin: totalWin / runs,
    maxWin,
  };
}

/**
 * Simulates buying a specific bonus directly.
 * The cost of the bonus is treated as the input cost.
 */
async function simulateBonusMode(modeType, runs) {
  const slot = new LuckyScapeSlot();

  // Find the cost of this specific bonus buy
  const offers = slot.getBonusBuyOffers(BET_AMOUNT).offers;
  const offer = offers.find((o) => o.modeType === modeType);
  const costPerRun = offer ? offer.cost : 0;

  if (!costPerRun) {
    throw new Error(`Bonus buy offer not found for ${modeType}`);
  }

  let totalCost = 0;
  let totalWin = 0;
  let hits = 0;
  let profits = 0;
  let maxWin = 0;

  for (let i = 0; i < runs; i++) {
    totalCost += costPerRun;
    let runWin = 0;

    // Force start the bonus
    slot.startBonusMode(modeType);

    // Play all free spins
    let guard = 1000;
    while (slot.isInFreeSpins && guard > 0) {
      const result = await slot.spin(null, BET_AMOUNT);
      runWin += result.totalWin || 0;

      if (result.scatterCount >= 2) {
        slot.handleFreeSpinsRetrigger(result.scatterCount);
      }

      slot.advanceFreeSpins();
      guard--;
    }

    // Record metrics for this run
    totalWin += runWin;
    if (runWin > 0) hits++;
    if (runWin > costPerRun) profits++;
    if (runWin > maxWin) maxWin = runWin;
  }

  return {
    mode: modeType,
    runs,
    costPerRun,
    totalCost,
    totalWin,
    rtp: totalCost > 0 ? totalWin / totalCost : 0,
    hitRate: hits / runs, // How often the bonus paid anything > 0
    profitRate: profits / runs, // How often the bonus paid MORE than it cost to buy
    bonusTriggerRate: 1, // It's forced, so 100%
    avgWin: totalWin / runs,
    maxWin,
  };
}

describe("LuckyScape Isolated RTP Benchmark", () => {
  // We set a very high timeout because running 30,000 spins total might take a minute or two
  it("benchmarks base game and independent bonus modes", async () => {
    console.log(`Starting isolated benchmarks (${RUNS} runs each)...`);

    const baseResult = await simulateBaseGame(RUNS);
    const leprechaunResult = await simulateBonusMode("LEPRECHAUN", RUNS);
    const glitterGoldResult = await simulateBonusMode("GLITTER_GOLD", RUNS);

    const results = [baseResult, leprechaunResult, glitterGoldResult];

    // Format the data nicely for the console
    const tableData = results.map((r) => ({
      Mode: r.mode,
      Runs: r.runs,
      "Cost/Run": r.costPerRun.toFixed(2),
      RTP: toPercent(r.rtp),
      "Hit Rate (>0)": toPercent(r.hitRate),
      "Profit Rate (>Cost)": toPercent(r.profitRate),
      "Avg Win": r.avgWin.toFixed(2),
      "Max Win": r.maxWin.toFixed(2),
      "Nat. Bonus Freq":
        r.mode === "Base Game" && r.bonusTriggerRate > 0
          ? `1 in ${Math.round(1 / r.bonusTriggerRate)}`
          : "N/A",
    }));

    console.table(tableData);

    // Provide some immediate tuning suggestions based on the new isolated metrics
    console.log("\n--- Quick Tuning Analysis ---");
    for (const r of results) {
      if (r.rtp > 1.05) {
        console.warn(
          `⚠️ ${r.mode} RTP is too high (${toPercent(r.rtp)}). Reduce coin values or payout combinations.`,
        );
      } else if (r.rtp < 0.9) {
        console.warn(
          `⚠️ ${r.mode} RTP is too low (${toPercent(r.rtp)}). Increase multipliers or feature frequencies.`,
        );
      }

      if (r.mode !== "Base Game" && r.profitRate > 0.3) {
        console.warn(
          `⚠️ ${r.mode} is highly profitable. Players win their money back over ${toPercent(r.profitRate)} of the time. You may want to lower the average win but increase the max win potential.`,
        );
      }
    }

    // Keep standard expectations so Jest passes
    expect(baseResult.runs).toBe(RUNS);
    expect(leprechaunResult.runs).toBe(RUNS);
    expect(glitterGoldResult.runs).toBe(RUNS);
  }, 600000); // 10 minute timeout to be safe
});
