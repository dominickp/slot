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
      "spin-start": withBasePath("assets/audio/spin_start.ogg"),
      cascade: withBasePath("assets/audio/cascade.ogg"),
      win: withBasePath("assets/audio/win.ogg"),
      "bonus-start": withBasePath("assets/audio/bonus_start.ogg"),
      "free-spin-start": withBasePath("assets/audio/spin_start.ogg"),
      rainbow: withBasePath("assets/audio/rainbow.ogg"),
      "clover-multiply": withBasePath("assets/audio/clover_multiply.ogg"),
      "collector-collect": withBasePath("assets/audio/collector_collect.ogg"),
      "collector-pop": withBasePath("assets/audio/collector_pop.ogg"),
      "big-win": withBasePath("assets/audio/big_win.ogg"),
      "bg-music": withBasePath("assets/audio/background_music.ogg"),
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
      collector: "#cb0b88",
      rainbow: 0x93d1ff,
    },
    collectorColors: {
      valueText: "#e876c2",
      tokenText: "#e876c2",
    },
    coinTierColors: {
      bronze: 0x67e07f,
      silver: 0xd69763,
      gold: 0x6fb5e8,
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
          multiplier: 100,
          accentColor: "#7cf0b5",
        },
        {
          id: "big",
          label: "BIG WIN",
          multiplier: 250,
          accentColor: "#6ea8ff",
        },
        {
          id: "epic",
          label: "EPIC WIN",
          multiplier: 500,
          accentColor: "#8b6dff",
        },
        {
          id: "legendary",
          label: "LEGENDARY WIN",
          multiplier: 1000,
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

  audio: {
    backgroundMusicVolumeScale: 0.1,
  },

  // Internal debug mode controls (kept gated to avoid accidental user access)
  debug: {
    enabled: false,
    forceConnectionAndRainbow: true,
    gate: {
      allowedHosts: ["localhost", "127.0.0.1"],
      queryParam: "debug",
      enabledValues: ["1", "true", "on", "yes"],
    },
  },
};

export default LUCKY_ESCAPE_CONFIG;
