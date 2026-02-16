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
    { id: 1, name: "10", payout: 0.35, rarity: "common" },
    { id: 2, name: "J", payout: 0.45, rarity: "common" },
    { id: 3, name: "Q", payout: 0.65, rarity: "common" },
    { id: 4, name: "K", payout: 0.85, rarity: "uncommon" },
    { id: 5, name: "A", payout: 1.15, rarity: "uncommon" },
    { id: 6, name: "Top Hat", payout: 1.6, rarity: "rare" },
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
      LEPRECHAUN: 60,
      GLITTER_GOLD: 90,
      TREASURE_RAINBOW: 120,
    },
  },

  // RTP and volatility
  rtp: 0.96,
  volatility: "high",
  maxWin: 5000,

  // Payout distribution (target)
  payoutDistribution: {
    noWin: 0.5,
    smallWin: 0.28,
    mediumWin: 0.14,
    largeWin: 0.06,
    bonusOnly: 0.015,
    majorWin: 0.005,
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
