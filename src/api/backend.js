/**
 * BackendService - API client for communicating with game backend
 *
 * In demo mode: Simulates backend with client-side RNG
 * In production: Calls real API endpoints
 *
 * This abstraction allows easy transition from demo to production
 */

import RNG from "../core/rng.js";

export class BackendService {
  constructor(config = {}) {
    this.config = config;
    this.isDemo = config.demoMode !== false;
    this.rng = config.rng || new RNG(); // Can pass seed for testing
    this.simulatedDelay = config.simulatedDelay || 100; // ms
  }

  /**
   * Request spin outcome from backend
   *
   * @param {string} gameId - Which game to spin
   * @param {number} betAmount - The bet amount
   * @returns {Promise} Spin result { reelStops, winAmount, features, ... }
   */
  async requestSpin(gameId, betAmount) {
    if (this.isDemo) {
      return this._simulatedSpin(gameId, betAmount);
    } else {
      return this._apiSpin(gameId, betAmount);
    }
  }

  /**
   * Simulated backend spin (for demo)
   * @private
   */
  async _simulatedSpin(gameId, betAmount) {
    // Simulate network delay
    await this._delay(this.simulatedDelay);

    // Generate random reel positions
    const reelCount = 3;
    const symbolsPerReel = 22; // Standard slot machine

    const reelStops = [];
    for (let i = 0; i < reelCount; i++) {
      reelStops.push(this.rng.nextInt(0, symbolsPerReel - 1));
    }

    // Simulate payout calculation
    // (In real game, this would check actual paytable)
    const winAmount = this._calculateDemoWin(reelStops, betAmount);

    return {
      reelStops,
      winAmount,
      betAmount,
      rtp: 0.96,
      features: [],
      timestamp: Date.now(),
      signature: "demo",
    };
  }

  /**
   * Calculate demo win amount (simple logic)
   * @private
   */
  _calculateDemoWin(reelStops, betAmount) {
    // Check for matching symbols
    if (reelStops[0] === reelStops[1] && reelStops[1] === reelStops[2]) {
      // All three match
      const multiplier = reelStops[0] < 10 ? 100 : 50; // Higher cards pay less
      return multiplier * betAmount;
    }

    if (reelStops[0] === reelStops[1] || reelStops[1] === reelStops[2]) {
      // Two match
      const multiplier = reelStops[0] < 10 ? 10 : 5;
      return multiplier * betAmount;
    }

    return 0; // No win
  }

  /**
   * Real API spin (for production)
   * @private
   */
  async _apiSpin(gameId, betAmount) {
    try {
      const response = await fetch("/api/game/spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._getSessionToken()}`,
        },
        body: JSON.stringify({
          gameId,
          betAmount,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusCode}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[BackendService] API error:", error);
      throw error;
    }
  }

  /**
   * Get session token for API authentication
   * @private
   */
  _getSessionToken() {
    // In real implementation, get from session storage
    return "demo-token";
  }

  /**
   * Helper to simulate async delay
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set RNG seed for reproducible testing
   */
  setSeed(seed) {
    this.rng = new RNG(seed);
  }

  /**
   * Get current RNG state
   */
  getRngState() {
    return this.rng.getState();
  }
}

export default BackendService;
