/**
 * GameEngine - Main game loop and state management
 *
 * Coordinates:
 * - State transitions
 * - API communication
 * - Game logic
 * - Renderer updates
 */

import StateMachine from "./stateMachine.js";

export class GameEngine {
  constructor(gameConfig, rendererConfig = {}) {
    this.gameConfig = gameConfig;
    this.rendererConfig = rendererConfig;

    this.stateMachine = new StateMachine();
    this.currentResult = null;
    this.playerBalance = 1000; // Demo starting balance
    this.betAmount = 10;

    this.isRunning = false;
  }

  /**
   * Initialize the game engine
   */
  async init() {
    console.log("[GameEngine] Initializing...");
    console.log(`[GameEngine] Game: ${this.gameConfig.name}`);
    console.log(`[GameEngine] Starting balance: ${this.playerBalance}`);

    this.isRunning = true;
    this.stateMachine.transition("IDLE");
  }

  /**
   * Request spin from backend (or simulated backend)
   * @param {BackendService} backend - API service
   */
  async requestSpin(backend) {
    if (!this.stateMachine.is("IDLE")) {
      console.warn(
        "[GameEngine] Cannot spin from state:",
        this.stateMachine.getState(),
      );
      return false;
    }

    if (this.playerBalance < this.betAmount) {
      console.warn("[GameEngine] Insufficient balance");
      return false;
    }

    try {
      this.stateMachine.transition("AWAITING_RESULT");

      // Deduct bet
      this.playerBalance -= this.betAmount;

      // Request result from backend
      this.currentResult = await backend.requestSpin(
        this.gameConfig.id,
        this.betAmount,
      );

      console.log("[GameEngine] Received spin result:", this.currentResult);

      this.stateMachine.transition("SPINNING");
      return true;
    } catch (error) {
      console.error("[GameEngine] Spin error:", error);

      // Refund bet on error
      this.playerBalance += this.betAmount;
      this.stateMachine.transition("ERROR");
      return false;
    }
  }

  /**
   * Complete animation and show results
   * Called by renderer when animation finishes
   */
  onAnimationComplete() {
    if (!this.stateMachine.is("SPINNING")) {
      console.warn("[GameEngine] Animation complete but not spinning");
      return;
    }

    // Award winnings if any
    if (this.currentResult.winAmount > 0) {
      console.log(`[GameEngine] Win! +${this.currentResult.winAmount}`);
      this.playerBalance += this.currentResult.winAmount;
    } else {
      console.log("[GameEngine] No win this spin");
    }

    // Show result display (paytable, win animation, etc.)
    this.stateMachine.transition("RESULT_DISPLAY");
  }

  /**
   * Return to idle state for next spin
   */
  nextSpin() {
    if (!this.stateMachine.is("RESULT_DISPLAY")) {
      console.warn("[GameEngine] Not in result display state");
      return;
    }

    this.currentResult = null;
    this.stateMachine.transition("IDLE");
  }

  /**
   * Set bet amount
   */
  setBetAmount(amount) {
    if (amount <= 0 || amount > this.playerBalance) {
      console.warn(`[GameEngine] Invalid bet: ${amount}`);
      return false;
    }
    this.betAmount = amount;
    return true;
  }

  /**
   * Get game state for debugging/UI
   */
  getGameState() {
    return {
      state: this.stateMachine.getState(),
      playerBalance: this.playerBalance,
      betAmount: this.betAmount,
      currentResult: this.currentResult,
      canSpin:
        this.stateMachine.is("IDLE") && this.playerBalance >= this.betAmount,
    };
  }

  /**
   * Register listener for state changes
   */
  onStateChange(callback) {
    this.stateMachine.on("stateChanged", callback);
  }

  /**
   * Stop the game
   */
  destroy() {
    this.isRunning = false;
    console.log("[GameEngine] Game destroyed");
  }
}

export default GameEngine;
