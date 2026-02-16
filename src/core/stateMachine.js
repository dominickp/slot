/**
 * StateMachine - Manages game state transitions
 *
 * Game Flow:
 * IDLE -> AWAITING_RESULT -> SPINNING -> RESULT_DISPLAY -> IDLE
 */

export class StateMachine {
  constructor() {
    this.state = "IDLE";
    this.listeners = new Map();

    // Define valid transitions
    this.validTransitions = {
      IDLE: ["AWAITING_RESULT"],
      AWAITING_RESULT: ["SPINNING", "ERROR"],
      SPINNING: ["RESULT_DISPLAY", "ERROR"],
      RESULT_DISPLAY: ["IDLE"],
      ERROR: ["IDLE"],
    };
  }

  /**
   * Transition to new state
   * @param {string} newState - Target state
   * @throws {Error} if transition is invalid
   */
  transition(newState) {
    const validNextStates = this.validTransitions[this.state];

    if (!validNextStates || !validNextStates.includes(newState)) {
      throw new Error(`Invalid transition: ${this.state} -> ${newState}`);
    }

    const oldState = this.state;
    this.state = newState;

    console.log(`[State] ${oldState} -> ${newState}`);
    this.emit("stateChanged", { oldState, newState });
  }

  /**
   * Check if in specific state
   * @param {string} state - State to check
   */
  is(state) {
    return this.state === state;
  }

  /**
   * Register listener for state changes
   * @param {string} event - Event name ('stateChanged', 'enterState:IDLE', etc.)
   * @param {function} callback - Event handler
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unregister listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   * @private
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => cb(data));
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
}

export default StateMachine;
