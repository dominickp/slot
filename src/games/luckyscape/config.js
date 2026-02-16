/**
 * Le Bandit-style game configuration with placeholder assets.
 */

import { CascadeDetector } from "./cascadeDetector.js";

export const LUCKY_ESCAPE_CONFIG = {
  id: "le-bandit-placeholder",
  name: "Le Bandit (Placeholder)",

  // Grid setup
  gridWidth: 6,
  gridHeight: 5,

  // Symbol definitions
  symbols: [
    { id: 1, name: "10", payout: 0.1, rarity: "common" },
    { id: 2, name: "J", payout: 0.1, rarity: "common" },
    { id: 3, name: "Q", payout: 0.1, rarity: "common" },
    { id: 4, name: "K", payout: 0.1, rarity: "common" },
    { id: 5, name: "A", payout: 0.1, rarity: "common" },
    { id: 11, name: "Trap", payout: 0.3, rarity: "uncommon" },
    { id: 12, name: "Cheese", payout: 0.3, rarity: "uncommon" },
    { id: 13, name: "Beer", payout: 0.5, rarity: "rare" },
    { id: 14, name: "Bread", payout: 0.5, rarity: "rare" },
    { id: 15, name: "Top Hat", payout: 1.0, rarity: "epic" },
    { id: 6, name: "Wild", payout: "special", rarity: "special" },
    { id: 7, name: "Free Spins", payout: "special", rarity: "bonus trigger" },
    {
      id: 8,
      name: "Clover Reveal",
      payout: "special",
      rarity: "reveal-only",
    },
    {
      id: 9,
      name: "Rainbow Symbol",
      payout: "special",
      rarity: "feature",
    },
    {
      id: 10,
      name: "Pot Reveal",
      payout: "special",
      rarity: "reveal-only",
    },
  ],

  // External art/audio asset manifest (replace these files with your own)
  assets: {
    symbols: {
      1: "/assets/symbols/10.png",
      2: "/assets/symbols/J.png",
      3: "/assets/symbols/Q.png",
      4: "/assets/symbols/K.png",
      5: "/assets/symbols/A.png",
      6: "/assets/symbols/wild.png",
      7: "/assets/symbols/scatter_fs.png",
      8: "/assets/symbols/reveal_clover.png",
      9: "/assets/symbols/rainbow.png",
      10: "/assets/symbols/reveal_pot.png",
      11: "/assets/symbols/trap.png",
      12: "/assets/symbols/cheese.png",
      13: "/assets/symbols/beer.png",
      14: "/assets/symbols/bread.png",
      15: "/assets/symbols/top_hat.png",
      101: "/assets/symbols/coin_bronze.png",
      102: "/assets/symbols/coin_silver.png",
      103: "/assets/symbols/coin_gold.png",
    },
    sounds: {
      button: "/assets/audio/ui_button.ogg",
      "spin-start": "/assets/audio/spin_start.ogg",
      cascade: "/assets/audio/cascade.ogg",
      win: "/assets/audio/win.ogg",
      "bonus-start": "/assets/audio/bonus_start.ogg",
      "free-spin-start": "/assets/audio/free_spin_start.ogg",
      rainbow: "/assets/audio/rainbow.ogg",
      "clover-multiply": "/assets/audio/clover_multiply.ogg",
      "collector-collect": "/assets/audio/collector_collect.ogg",
      "big-win": "/assets/audio/big_win.ogg",
      "bg-music": "/assets/audio/background_music.ogg",
    },
  },

  // Win mechanics
  winMechanic: "cluster_pays",
  minClusterSize: 5,
  clusterMultipliers: CascadeDetector.CLUSTER_MULTIPLIERS,

  // Cascades
  cascadesEnabled: true,
  maxCascadesPerSpin: 20,

  // Free spins configuration
  freeSpins: {
    enabled: true,
    scatterRequired: 3,
    modes: [
      {
        name: "Luck of the Leprechaun",
        triggerScatters: 3,
        initialSpins: 8,
        mechanic: "golden-squares-persist-until-rainbow",
        description:
          "Golden squares persist between spins until activated by Rainbow.",
      },
      {
        name: "All That Glitters Is Gold",
        triggerScatters: 4,
        initialSpins: 12,
        mechanic: "golden-squares-never-expire",
        description:
          "Golden squares remain active for the full free-spin round.",
      },
      {
        name: "Treasure at the End of the Rainbow",
        triggerScatters: 5,
        initialSpins: 12,
        mechanic: "golden-squares-never-expire-guaranteed-rainbow",
        description:
          "Guaranteed Rainbow every free spin with persistent golden squares.",
      },
    ],
    maxRetriggers: 0,
    retriggersAdd: {
      "Luck of the Leprechaun": 0,
      "All That Glitters Is Gold": 0,
      "Treasure at the End of the Rainbow": 0,
    },
  },

  bonusBuy: {
    enabled: true,
    multipliers: {
      LEPRECHAUN: 100,
      GLITTER_GOLD: 250,
    },
  },

  // RTP and volatility
  rtp: 0.9634,
  volatility: "medium",
  maxWin: 10000,
  minBet: 0.1,
  maxBet: 100.0,

  // Payout distribution (target)
  payoutDistribution: {
    noWin: 0.5,
    smallWin: 0.28,
    mediumWin: 0.14,
    largeWin: 0.06,
    bonusOnly: 0.015,
    majorWin: 0.005,
  },

  // Balance/tuning knobs used by LuckyScapeSlot runtime logic
  balance: {
    // Chance to allow rainbow symbol generation during free spins (unless guaranteed)
    freeSpinRainbowChance: 0.35,

    // Weighted symbol profiles used for grid generation and cascade refills
    symbolWeightProfiles: {
      base: {
        ten: 30,
        jack: 27,
        queen: 24,
        king: 20,
        ace: 17,
        trap: 9,
        cheese: 8,
        beer: 6,
        bread: 5,
        topHat: 4,
        wild: 3,
        scatter: 2,
        rainbow: 2,
      },
      freeSpins: {
        ten: 36,
        jack: 32,
        queen: 28,
        king: 24,
        ace: 20,
        trap: 9,
        cheese: 8,
        beer: 6,
        bread: 5,
        topHat: 4,
        wild: 2,
        scatter: 1,
        rainbow: 2,
      },
    },

    // Golden square reveal outcomes by mode
    goldenSquareOutcomeChances: {
      default: { coin: 0.9, clover: 0.08, pot: 0.02 },
      LEPRECHAUN: { coin: 0.88, clover: 0.09, pot: 0.03 },
      GLITTER_GOLD: { coin: 0.86, clover: 0.1, pot: 0.04 },
      TREASURE_RAINBOW: { coin: 0.83, clover: 0.12, pot: 0.05 },
    },

    // Pot spawn chance shaping: lower global rate + decay per existing collector
    potChanceAdjustment: {
      globalReduction: 0.75,
      perCollectorDecay: 0.65,
    },

    // Coin value weighted tables
    coinValueWeights: {
      default: [
        { value: 0.2, weight: 18 },
        { value: 0.5, weight: 16 },
        { value: 1, weight: 14 },
        { value: 2, weight: 12 },
        { value: 3, weight: 10 },
        { value: 4, weight: 9 },
        { value: 5, weight: 7 },
        { value: 10, weight: 5 },
        { value: 15, weight: 4 },
        { value: 20, weight: 3 },
        { value: 25, weight: 2 },
        { value: 50, weight: 2 },
        { value: 100, weight: 1 },
        { value: 250, weight: 1 },
        { value: 500, weight: 1 },
      ],
      TREASURE_RAINBOW: [
        { value: 5, weight: 14 },
        { value: 10, weight: 12 },
        { value: 15, weight: 10 },
        { value: 20, weight: 8 },
        { value: 25, weight: 4 },
        { value: 50, weight: 3 },
        { value: 100, weight: 2 },
        { value: 250, weight: 1 },
        { value: 500, weight: 1 },
      ],
    },

    // Clover multiplier weighted table
    cloverMultiplierWeights: [
      { multiplier: 2, weight: 40 },
      { multiplier: 3, weight: 28 },
      { multiplier: 4, weight: 16 },
      { multiplier: 5, weight: 10 },
      { multiplier: 10, weight: 6 },
    ],
  },

  // Animation timing (in milliseconds)
  timing: {
    spinDuration: 1200,
    cascadeRemoval: 360,
    symbolFall: 420,
    symbolAppear: 200,
    cascadeDelay: 120,
    winDisplay: 1800,
  },

  // Features
  features: {
    autoplay: true,
    turbo: true,
    soundEnabled: true,
    particleEffects: true,
  },
};

/**
 * Helper function to get symbol by ID
 */
export function getSymbolById(id) {
  return LUCKY_ESCAPE_CONFIG.symbols.find((s) => s.id === id);
}

/**
 * Helper function to get bonus mode by scatter count
 */
export function getBonusModeByScatterCount(count) {
  const mode =
    LUCKY_ESCAPE_CONFIG.freeSpins.modes.find(
      (m) => m.triggerScatters === count,
    ) ||
    (count >= 5
      ? LUCKY_ESCAPE_CONFIG.freeSpins.modes.find((m) => m.triggerScatters === 5)
      : null);
  return mode || null;
}

/**
 * Helper function to calculate RTP target for a session
 */
export function calculateTargetSessionRtp(spinCount, avgBetAmount) {
  return spinCount * avgBetAmount * LUCKY_ESCAPE_CONFIG.rtp;
}

export default LUCKY_ESCAPE_CONFIG;
