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
    // Demo mode is now controlled by VITE_DEMO_MODE env var ("false" disables demo mode)
    const envDemo =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.VITE_DEMO_MODE !== "undefined"
        ? String(import.meta.env.VITE_DEMO_MODE).toLowerCase()
        : undefined;
    this.isDemo =
      typeof config.demoMode !== "undefined"
        ? config.demoMode
        : envDemo === "false" || envDemo === "0" || envDemo === "no"
          ? false
          : true;
    this.rng = config.rng || new RNG(); // Can pass seed for testing
    this.simulatedDelay = config.simulatedDelay || 100; // ms
    this.apiBaseUrl =
      config.apiBaseUrl ||
      (typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env.VITE_API_BASE_URL
        : "");
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
      const response = await fetch(this._apiUrl("/api/spin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          betAmount,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response
          .json()
          .catch(() => ({ error: "Unknown API error" }));
        throw new Error(
          `API error ${response.status}: ${errorPayload.error || "Request failed"}`,
        );
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
   * Get player credit state from backend
   */
  async getPlayerState() {
    if (this.isDemo) {
      return {
        ok: true,
        remainingCredits: null,
        dailyBudget: null,
        resetAt: null,
        serverTime: Date.now(),
      };
    }

    return this._apiGet("/api/player/state");
  }

  /**
   * Get recent wins leaderboard
   */
  async getRecentWins(limit = 20) {
    if (this.isDemo) {
      return { ok: true, rows: [] };
    }

    return this._apiGet(`/api/leaderboard/recent?limit=${Number(limit) || 20}`);
  }

  /**
   * Get top wins leaderboard
   */
  async getTopWins(limit = 20) {
    if (this.isDemo) {
      return { ok: true, rows: [] };
    }

    return this._apiGet(`/api/leaderboard/top?limit=${Number(limit) || 20}`);
  }

  async _apiGet(path) {
    const response = await fetch(this._apiUrl(path), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ error: "Unknown API error" }));
      throw new Error(
        `API error ${response.status}: ${errorPayload.error || "Request failed"}`,
      );
    }

    return response.json();
  }

  _apiUrl(path) {
    if (!this.apiBaseUrl) {
      throw new Error(
        "VITE_API_BASE_URL is not configured; set demoMode=true or provide an API base URL.",
      );
    }

    const base = String(this.apiBaseUrl).replace(/\/$/, "");
    const suffix = String(path).startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
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
