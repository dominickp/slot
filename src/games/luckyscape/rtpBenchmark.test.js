import { Console } from "node:console";
import { LuckyScapeSlot } from "./luckyScapeSlot.js";

// What this gives you:
//     Isolated RTP: Now you can see if the GLITTER_GOLD bonus alone has a 120% RTP while your Base Game has an 85% RTP.
//     Profit Rate: For bonuses, "Hit Rate" doesn't mean much because they always pay something. The Profit Rate (>Cost) tells you exactly how often buying the 100x bonus actually returned more than 100x. If this is higher than ~15-20%, the bonus is usually too easy to profit on.
//     Avg / Max Win: Tells you if your mathematical top-end is reaching high enough or if the payouts are too flat.

// You can override these with environment variables if needed
const BET_AMOUNT = Number.parseFloat(process.env.RTP_BENCH_BET || "1");
const RUNS = Number.parseInt(process.env.RTP_BENCH_RUNS || "10000", 10);
const benchmarkConsole = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
});

function toPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatTable(rows) {
  if (rows.length === 0) {
    return "(no rows)";
  }

  const headers = Object.keys(rows[0]);
  const stringRows = rows.map((row) =>
    headers.map((header) => String(row[header] ?? "")),
  );
  const columnWidths = headers.map((header, index) =>
    Math.max(header.length, ...stringRows.map((row) => row[index].length)),
  );
  const padCell = (value, index) => value.padEnd(columnWidths[index], " ");
  const separator = columnWidths.map((width) => "-".repeat(width)).join("-+-");

  const lines = [
    headers.map((header, index) => padCell(header, index)).join(" | "),
    separator,
    ...stringRows.map((row) =>
      row.map((value, index) => padCell(value, index)).join(" | "),
    ),
  ];

  return lines.join("\n");
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
  const scatterTriggerCounts = {
    3: 0,
    4: 0,
    5: 0,
  };

  for (let i = 0; i < runs; i++) {
    let runWin = 0;
    totalCost += BET_AMOUNT;

    // 1. Play the base spin
    const result = await slot.spin(null, BET_AMOUNT);
    runWin += result.totalWin || 0;

    if (result.scatterCount >= 3 && result.scatterCount <= 5) {
      scatterTriggerCounts[result.scatterCount]++;
    }

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
    scatterTriggerCounts,
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
    benchmarkConsole.log(`Starting isolated benchmarks (${RUNS} runs each)...`);

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

    benchmarkConsole.log(formatTable(tableData));

    const scatterTableData = [3, 4, 5].map((scatterCount) => {
      const hitCount = baseResult.scatterTriggerCounts[scatterCount] || 0;
      const hitRate = baseResult.runs > 0 ? hitCount / baseResult.runs : 0;

      return {
        Outcome: `${scatterCount} Scatters`,
        Hits: hitCount,
        Frequency: toPercent(hitRate),
        Odds:
          hitCount > 0
            ? `1 in ${(baseResult.runs / hitCount).toFixed(0)}`
            : "Never",
      };
    });

    benchmarkConsole.log("\nBase Game Scatter Frequency");
    benchmarkConsole.log(formatTable(scatterTableData));

    // Provide some immediate tuning suggestions based on the new isolated metrics
    benchmarkConsole.log("\n--- Quick Tuning Analysis ---");
    for (const r of results) {
      if (r.rtp > 1.05) {
        benchmarkConsole.warn(
          `⚠️ ${r.mode} RTP is too high (${toPercent(r.rtp)}). Reduce coin values or payout combinations.`,
        );
      } else if (r.rtp < 0.9) {
        benchmarkConsole.warn(
          `⚠️ ${r.mode} RTP is too low (${toPercent(r.rtp)}). Increase multipliers or feature frequencies.`,
        );
      }

      if (r.mode !== "Base Game" && r.profitRate > 0.3) {
        benchmarkConsole.warn(
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
