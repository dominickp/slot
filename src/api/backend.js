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
   * Report the result of a spin or bonus to the backend
   *
   * @param {Object} params
   *   - betAmount: The cost of the spin or bonus
   *   - winAmount: The win amount for the spin or bonus
   *   - gameId: (optional) Which game
   *   - bonusType: (optional) If this is a bonus buy, the type
   *   - extra: (optional) Any extra metadata
   * @returns {Promise} Backend response (updated balance, confirmation, etc)
   */
  async reportWin({ betAmount, winAmount, gameId, bonusType, extra }) {
    if (this.isDemo) {
      // Simulate local accounting only
      return {
        ok: true,
        remainingCredits: null,
        winAmount,
        betAmount,
        gameId,
        bonusType,
        ...extra,
        serverTime: Date.now(),
      };
    }
    const response = await fetch(this._apiUrl("/api/report-win"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        betAmount,
        winAmount,
        gameId,
        bonusType,
        ...extra,
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
    return response.json();
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
