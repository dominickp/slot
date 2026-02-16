import { LuckyScapeSlot } from "./luckyScapeSlot.js";
import { LUCKY_ESCAPE_CONFIG } from "./config.js";

const BET_AMOUNT = Number.parseFloat(process.env.RTP_BENCH_BET || "1");

const SAMPLE_SIZES = {
  paidSpins: Number.parseInt(process.env.RTP_BENCH_PAID_SPINS || "3000", 10),
};

function toPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function stdDev(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildTuningHints(metrics) {
  const hints = [];

  if (metrics.rtp > 1.05) {
    hints.push(
      "RTP high: reduce payouts/feature value via _rollCoinValue(), _rollCloverMultiplierValue(), _getAdjustedPotChance(), and/or CLUSTER_PAYTABLE.",
    );
  } else if (metrics.rtp < 0.9) {
    hints.push(
      "RTP low: increase payout/value via _rollCoinValue(), _rollCloverMultiplierValue(), _getAdjustedPotChance(), and/or CLUSTER_PAYTABLE.",
    );
  }

  if (metrics.coefficientOfVariation > 7) {
    hints.push(
      "Volatility high: lower top-end outcomes in _rollCoinValue(), reduce high multipliers in _rollCloverMultiplierValue(), and/or soften feature chaining in _getAdjustedPotChance().",
    );
  } else if (metrics.coefficientOfVariation < 3) {
    hints.push(
      "Volatility low: raise upper-tail outcomes in _rollCoinValue(), increase rare clover multipliers, or raise high-symbol/paytable tails.",
    );
  }

  if (hints.length === 0) {
    hints.push(
      "RTP/volatility are within coarse benchmark bands; fine-tune with longer runs if needed.",
    );
  }

  return hints;
}

async function playTriggeredBonus(slot, modeStats) {
  let totalBonusWin = 0;
  let freeSpinsPlayed = 0;

  let guard = 1000;
  while (slot.isInFreeSpins && guard > 0) {
    const result = await slot.spin(null, BET_AMOUNT);
    totalBonusWin += Number(result.totalWin || 0);
    freeSpinsPlayed += 1;

    if (result.scatterCount >= 2) {
      slot.handleFreeSpinsRetrigger(result.scatterCount);
    }

    slot.advanceFreeSpins();
    guard -= 1;
  }

  if (guard <= 0) {
    throw new Error(
      "Free-spin guard exhausted during configured RTP simulation",
    );
  }

  modeStats.freeSpinsPlayed += freeSpinsPlayed;
  modeStats.totalWin += totalBonusWin;

  return totalBonusWin;
}

async function simulateConfiguredGame({ paidSpins, seed }) {
  const slot = new LuckyScapeSlot();
  slot.seedRNG(seed);

  let totalBet = 0;
  let totalWin = 0;
  let paidSpinHits = 0;
  let bonusTriggers = 0;

  const returnsPerPaidSpin = [];
  const modeBreakdown = {
    LEPRECHAUN: { triggers: 0, freeSpinsPlayed: 0, totalWin: 0 },
    GLITTER_GOLD: { triggers: 0, freeSpinsPlayed: 0, totalWin: 0 },
    TREASURE_RAINBOW: { triggers: 0, freeSpinsPlayed: 0, totalWin: 0 },
  };

  for (let index = 0; index < paidSpins; index++) {
    const paidSpinResult = await slot.spin(null, BET_AMOUNT);
    totalBet += BET_AMOUNT;

    let spinReturn = Number(paidSpinResult.totalWin || 0);

    if (paidSpinResult.totalWin > 0) {
      paidSpinHits += 1;
    }

    if (paidSpinResult.bonusMode?.type) {
      bonusTriggers += 1;
      const modeId = paidSpinResult.bonusMode.type;
      if (modeBreakdown[modeId]) {
        modeBreakdown[modeId].triggers += 1;
      }

      const bonusWin = await playTriggeredBonus(
        slot,
        modeBreakdown[modeId] || {
          triggers: 0,
          freeSpinsPlayed: 0,
          totalWin: 0,
        },
      );

      spinReturn += bonusWin;
    }

    totalWin += spinReturn;
    returnsPerPaidSpin.push(spinReturn);
  }

  const meanReturnPerPaidSpin = totalWin / Math.max(1, paidSpins);
  const returnStdDev = stdDev(returnsPerPaidSpin);
  const coefficientOfVariation =
    meanReturnPerPaidSpin > 0 ? returnStdDev / meanReturnPerPaidSpin : Infinity;

  return {
    paidSpins,
    totalBet,
    totalWin,
    rtp: totalBet > 0 ? totalWin / totalBet : 0,
    paidSpinHitRate: paidSpins > 0 ? paidSpinHits / paidSpins : 0,
    bonusTriggerRate: paidSpins > 0 ? bonusTriggers / paidSpins : 0,
    meanReturnPerPaidSpin,
    returnStdDev,
    coefficientOfVariation,
    modeBreakdown,
  };
}

describe("Configured slot RTP benchmark", () => {
  it("simulates real configured gameplay and prints RTP/volatility + tuning hints", async () => {
    const metrics = await simulateConfiguredGame({
      paidSpins: SAMPLE_SIZES.paidSpins,
      seed: 20260216,
    });

    const targetRtp = Number(LUCKY_ESCAPE_CONFIG.rtp || 0);

    console.table([
      {
        paidSpins: metrics.paidSpins,
        totalBet: metrics.totalBet.toFixed(2),
        totalWin: metrics.totalWin.toFixed(2),
        measuredRtp: toPercent(metrics.rtp),
        targetRtp: toPercent(targetRtp),
        paidHitRate: toPercent(metrics.paidSpinHitRate),
        bonusTriggerRate: toPercent(metrics.bonusTriggerRate),
        stdDev: metrics.returnStdDev.toFixed(4),
        cv: Number.isFinite(metrics.coefficientOfVariation)
          ? metrics.coefficientOfVariation.toFixed(4)
          : "inf",
      },
    ]);

    console.table(
      Object.entries(metrics.modeBreakdown).map(([mode, stats]) => ({
        mode,
        triggers: stats.triggers,
        triggerRate: toPercent(stats.triggers / Math.max(1, metrics.paidSpins)),
        avgFreeSpinsPerTrigger:
          stats.triggers > 0
            ? (stats.freeSpinsPlayed / stats.triggers).toFixed(2)
            : "0.00",
        avgWinPerTrigger:
          stats.triggers > 0
            ? (stats.totalWin / stats.triggers).toFixed(2)
            : "0.00",
      })),
    );

    const hints = buildTuningHints(metrics);
    console.log("Tuning hints:");
    for (const hint of hints) {
      console.log(`- ${hint}`);
    }

    expect(Number.isFinite(metrics.rtp)).toBe(true);
    expect(Number.isFinite(metrics.returnStdDev)).toBe(true);
    expect(metrics.totalBet).toBeCloseTo(metrics.paidSpins * BET_AMOUNT, 6);
  }, 240000);
});
