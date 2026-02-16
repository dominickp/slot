/**
 * BaseSlot - Abstract base class for all slot game implementations
 *
 * All specific slot games inherit from this and override methods
 * to implement their unique mechanics
 */

import GameEngine from "../core/gameEngine.js";
import PayoutCalculator from "../core/payoutCalculator.js";

export class BaseSlot {
  constructor(config) {
    this.config = config;
    this.engine = null;
    this.payoutCalculator = null;

    this._validateConfig();
    this._initializeComponents();
  }

  /**
   * Validate game configuration
   * @private
   */
  _validateConfig() {
    const required = ["id", "name", "symbols", "rtp"];
    for (const field of required) {
      if (!(field in this.config)) {
        throw new Error(`Missing required config: ${field}`);
      }
    }

    if (this.config.rtp < 0 || this.config.rtp > 1) {
      throw new Error("RTP must be between 0 and 1");
    }
  }

  /**
   * Initialize game components
   * @private
   */
  _initializeComponents() {
    this.engine = new GameEngine(this.config);
    this.payoutCalculator = new PayoutCalculator(this.config);
  }

  /**
   * Initialize the game (called before play starts)
   */
  async init() {
    await this.engine.init();
    this.onInit();
  }

  /**
   * Hook for subclasses to initialize
   * Override in child classes for custom setup
   */
  onInit() {
    // Override in child classes
  }

  /**
   * Handle spin request
   * Abstract - must be overridden
   */
  async spin(backend) {
    throw new Error("spin() must be implemented by subclass");
  }

  /**
   * Detect wins for this game type
   * Override for custom win detection logic
   */
  detectWins(reelPositions, betAmount) {
    return this.payoutCalculator.detectWins(reelPositions, betAmount);
  }

  /**
   * Get bonus features (free spins, etc.)
   * Override for games with bonus mechanics
   */
  getBonus(reelPositions) {
    return null;
  }

  /**
   * Get game state
   */
  getState() {
    return {
      ...this.engine.getGameState(),
      gameName: this.config.name,
      rtp: this.config.rtp,
    };
  }

  /**
   * Register callback for state changes
   */
  onStateChange(callback) {
    this.engine.onStateChange(callback);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.engine) {
      this.engine.destroy();
    }
  }

  /**
   * Get game configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get payout table for display
   */
  getPaytable() {
    return this.config.paytable || {};
  }
}

export default BaseSlot;
