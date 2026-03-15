/**
 * Le Bandit-style game configuration with placeholder assets.
 */

import { CascadeDetector } from "./cascadeDetector.js";

const BASE_URL =
  typeof import.meta.env?.BASE_URL === "string"
    ? import.meta.env.BASE_URL
    : "/";

const withBasePath = (assetPath) => {
  const normalizedBase = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const normalizedAsset = String(assetPath || "").replace(/^\/+/, "");
  return `${normalizedBase}${normalizedAsset}`;
};

const BONUS_MODE_CONFIGS = {
  LEPRECHAUN: {
    id: "LEPRECHAUN",
    name: "Dom's Little Guy Bonus",
    triggerScatters: 3,
    initialSpins: 9,
    mechanic: "golden-squares-persist-until-rainbow",
    description:
      "In this bonus, blue squares persist between spins until activated by [17] at which point they are reset.",
    persistGoldenSquaresAfterActivation: false,
    guaranteedRainbowEverySpin: false,
    tier: 1,
    bonusBuyMultiplier: 100,
  },
  GLITTER_GOLD: {
    id: "GLITTER_GOLD",
    name: "Dom's Big Boy Bonus",
    triggerScatters: 4,
    initialSpins: 12,
    mechanic: "golden-squares-never-expire",
    description:
      "In this bonus, blue squares build and stay active for the entire bonus and do not reset when activated by a [17].",
    persistGoldenSquaresAfterActivation: true,
    guaranteedRainbowEverySpin: false,
    tier: 2,
    bonusBuyMultiplier: 250,
  },
  TREASURE_RAINBOW: {
    id: "TREASURE_RAINBOW",
    name: "Dom's Supreme Secret Bonus",
    triggerScatters: 5,
    initialSpins: 12,
    mechanic: "golden-squares-never-expire-guaranteed-rainbow",
    description:
      "This is a secret bonus. Guaranteed [17] every free spin with persistent blue squares.",
    persistGoldenSquaresAfterActivation: true,
    guaranteedRainbowEverySpin: true,
    tier: 3,
  },
};

const BONUS_MODE_LIST = Object.values(BONUS_MODE_CONFIGS).sort(
  (left, right) => left.triggerScatters - right.triggerScatters,
);

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
      1: withBasePath("assets/symbols/10.png"),
      2: withBasePath("assets/symbols/J.png"),
      3: withBasePath("assets/symbols/Q.png"),
      4: withBasePath("assets/symbols/K.png"),
      5: withBasePath("assets/symbols/A.png"),
      6: withBasePath("assets/symbols/wild.png"),
      7: withBasePath("assets/symbols/scatter_fs.png"),
      8: withBasePath("assets/symbols/reveal_clover.png"),
      9: withBasePath("assets/symbols/rainbow.png"),
      10: withBasePath("assets/symbols/reveal_pot.png"),
      11: withBasePath("assets/symbols/trap.png"),
      12: withBasePath("assets/symbols/cheese.png"),
      13: withBasePath("assets/symbols/beer.png"),
      14: withBasePath("assets/symbols/bread.png"),
      15: withBasePath("assets/symbols/top_hat.png"),
      101: withBasePath("assets/symbols/coin_bronze.png"),
      102: withBasePath("assets/symbols/coin_silver.png"),
      103: withBasePath("assets/symbols/coin_gold.png"),
    },
    sounds: {
      button: withBasePath("assets/audio/ui_button.ogg"),
      "spin-start": withBasePath("assets/audio/free_spin_start.ogg"),
      cascade: withBasePath("assets/audio/cascade.ogg"),
      win: withBasePath("assets/audio/win.ogg"),
      "bonus-start": withBasePath("assets/audio/bonus_start.ogg"),
      "free-spin-start": withBasePath("assets/audio/free_spin_start.ogg"),
      rainbow: withBasePath("assets/audio/rainbow.ogg"),
      "clover-multiply": withBasePath("assets/audio/clover_multiply.ogg"),
      "collector-collect": withBasePath("assets/audio/collector_collect.ogg"),
      "collector-pop": withBasePath("assets/audio/collector_pop.ogg"),
      "big-win": withBasePath("assets/audio/big_win.ogg"),
      "bg-music": withBasePath("assets/audio/background_music.ogg"),
      "coin-reveal": withBasePath("assets/audio/coin_reveal.ogg"),
      "feature-trigger": withBasePath("assets/audio/feature-trigger.ogg"),
      retrigger: withBasePath("assets/audio/retrigger.ogg"),
    },
  },

  visuals: {
    randomRotationSymbolIds: [4, 5, 14, 15],
    randomRotationAnglesDeg: [0, 90, 180, 270],
    gridColors: {
      boardBackground: 0x1a1a2e,
      cellFill: "#2d2d2d",
      cellBorder: 0x555555,
    },
    highlightColors: {
      goldFill: "#2f6ca5",
      goldInnerGlow: "#1a232a",
    },
    focusPulseColors: {
      collector: "#cb380b",
      rainbow: "#cb0b88",
    },
    collectorColors: {
      valueText: "#f5cdb6",
      tokenText: "#eb6b3c",
    },
    coinTierColors: {
      bronze: "#67e07f",
      silver: "#d69763",
      gold: "#ffffff",
    },
    cloverMultiplierColors: {
      primary: 0xff4f63,
      soft: 0xffc2cb,
      dark: 0x4a1a20,
    },
    collectorSuctionMotion: {
      curveStrength: 0.5,
      curveLift: 0.5,
      controlPointT: 0.46,
      jitterAmplitude: 1.5,
      jitterFrequency: 1.0,
      durationScale: 1.35,
    },
    bonusWinCelebration: {
      title: "Bonus Total Win",
      countUp: {
        unitStep: 1,
        startTickMs: 44,
        endTickMs: 11,
        maxDurationMs: 3200,
        holdFinalMs: 900,
      },
      tiers: [
        {
          id: "nice",
          label: "NICE WIN",
          multiplier: 2,
          accentColor: "#7cf0b5",
        },
        {
          id: "big",
          label: "BIG WIN",
          multiplier: 5,
          accentColor: "#6ea8ff",
        },
        {
          id: "epic",
          label: "EPIC WIN",
          multiplier: 10,
          accentColor: "#8b6dff",
        },
        {
          id: "legendary",
          label: "LEGENDARY WIN",
          multiplier: 50,
          accentColor: "#ffd972",
        },
      ],
      defaultTier: {
        id: "bonus",
        label: "BONUS WIN",
        accentColor: "#9db2db",
      },
    },
  },

  clusterMultipliers: CascadeDetector.CLUSTER_MULTIPLIERS,

  // Cascades
  maxCascadesPerSpin: 20,

  // Bonus configuration
  bonuses: {
    enabled: true,
    scatterRequired: BONUS_MODE_LIST[0]?.triggerScatters || 3,
    modes: BONUS_MODE_CONFIGS,
  },

  bonusBuy: {
    enabled: true,
  },

  // RTP and limits
  rtp: 0.9634,
  maxWin: 10000,
  minBet: 0.5,
  maxBet: 100.0,

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
        rainbow: 0.7,
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
      LEPRECHAUN: { coin: 0.9, clover: 0.08, pot: 0.04 },
      GLITTER_GOLD: { coin: 0.9, clover: 0.08, pot: 0.04 },
      TREASURE_RAINBOW: { coin: 0.83, clover: 0.08, pot: 0.05 },
    },

    // Pot spawn chance shaping: lower global rate + decay per existing collector
    potChanceAdjustment: {
      globalReduction: 0.75,
      perCollectorDecay: 0.65,
    },

    // Coin value weighted tables
    coinValueWeights: {
      default: [
        { value: 0.2, weight: 100 }, // Make the "dud" coins common
        { value: 0.5, weight: 50 },
        { value: 1, weight: 25 },
        { value: 2, weight: 10 },
        { value: 3, weight: 5 },
        { value: 7, weight: 2 },
        { value: 50, weight: 0.1 }, // Extremely rare "Jackpot" coins
      ],
      LEPRECHAUN: [
        // Use these for the 100x bonus
        { value: 1, weight: 50 },
        { value: 3, weight: 30 },
        { value: 8, weight: 15 },
        { value: 15, weight: 5 },
        { value: 100, weight: 1 },
      ],
      GLITTER_GOLD: [
        // Even better for the 250x bonus
        { value: 2, weight: 50 },
        { value: 5, weight: 30 },
        { value: 10, weight: 15 },
        { value: 20, weight: 5 },
        { value: 150, weight: 0.5 },
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
      { multiplier: 2, weight: 80 }, // Mostly 2x
      { multiplier: 3, weight: 15 },
      { multiplier: 5, weight: 4 },
      { multiplier: 10, weight: 1 }, // 10x is a rare event
    ],
  },

  audio: {
    backgroundMusicVolumeScale: 0.1,
  },

  // Internal debug mode controls (kept gated to avoid accidental user access)
  debug: {
    enabled: false,
    forceConnectionAndRainbow: true,
    defaultOptions: ["connection-rainbow"],
    options: {
      "connection-rainbow": {
        label: "Connection + Rainbow",
        aliases: ["default", "force-win", "connection", "rainbow"],
      },
      "all-symbols": {
        label: "All Symbols Board",
        aliases: ["all", "symbols", "showcase"],
      },
      "all-symbols-highlighted": {
        label: "All Symbols Highlighted",
        aliases: ["all-highlighted", "highlighted", "showcase-highlighted"],
      },
      "connection-sequence": {
        label: "Connection Sequence",
        aliases: ["sequence", "connections"],
      },
      "wild-connections": {
        label: "Wild Connection Check",
        aliases: ["wild", "wilds", "wild-check", "wild-connection"],
      },
      "scatter-bait": {
        label: "2 Scatter Bait",
        aliases: ["scatter", "bait", "tease"],
      },
      "retrigger-test": {
        label: "Bonus Retrigger Test",
        aliases: ["retrigger", "bonus-retrigger", "retrigger-check"],
      },
    },
    gate: {
      allowedHosts: ["localhost", "127.0.0.1"],
      queryParam: "debug",
      enabledValues: ["1", "true", "on", "yes"],
    },
  },
};
