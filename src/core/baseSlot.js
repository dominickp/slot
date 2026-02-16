/**
 * BaseSlot - Abstract base class for all slot games
 *
 * Provides:
 * - Configuration management
 * - RNG integration
 * - Payout calculation delegation
 * - Game state tracking
 */

import RNG from "./rng.js";

export class BaseSlot {
  constructor(config = {}) {
    this.config = config;
    this.rng = new RNG();
    this.state = {
      balance: 1000,
      betAmount: 0,
      totalWin: 0,
      isSpinning: false,
      inFreeSpins: false,
      freeSpinsRemaining: 0,
    };
  }

  /**
   * Get the RNG instance (can be seeded by backend for testing)
   */
  getRNG() {
    return this.rng;
  }

  /**
   * Seed the RNG for deterministic results
   */
  seedRNG(seed) {
    this.rng = new RNG(seed);
  }

  /**
   * Get current game state
   */
  getState() {
    throw new Error("getState() must be implemented by subclass");
  }

  /**
   * Execute a spin
   */
  async spin(backend, betAmount) {
    throw new Error("spin() must be implemented by subclass");
  }

  /**
   * Get paytable information
   */
  getPaytable() {
    throw new Error("getPaytable() must be implemented by subclass");
  }

  /**
   * Validate bet amount
   */
  validateBet(betAmount) {
    const numericBet = Number(betAmount);
    const minBet = Number(this.config.minBet ?? 0);
    const maxBet = Number(this.config.maxBet ?? Infinity);

    return (
      Number.isFinite(numericBet) &&
      numericBet >= minBet &&
      numericBet <= maxBet
    );
  }

  /**
   * Update balance
   */
  updateBalance(amount) {
    this.state.balance += amount;
    return this.state.balance;
  }
}

export default BaseSlot;
