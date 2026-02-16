/**
 * RNG - Random Number Generator
 *
 * Provides cryptographically secure random number generation
 * with optional seeding for reproducibility in testing.
 *
 * For production, this would call the backend API instead
 * to ensure outcomes cannot be manipulated client-side.
 */

export class RNG {
  constructor(seed = null) {
    this.seed = seed;
    this.seedIndex = 0;

    if (seed !== null) {
      // Seeded mode (for testing)
      this.seedArray = this._generateSeedSequence(seed);
    }
  }

  /**
   * Generate seeded pseudo-random value
   * Uses simple but effective xorshift algorithm
   * @private
   */
  _generateSeedSequence(seed, length = 1000) {
    const array = [];
    let x = this._hashString(seed);

    for (let i = 0; i < length; i++) {
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      array.push(Math.abs(x) / 2147483647);
    }

    return array;
  }

  /**
   * Simple hash function for seed strings
   * @private
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Get next random number in range [0, 1)
   */
  nextFloat() {
    if (this.seed !== null && this.seedArray) {
      // Seeded mode
      const value = this.seedArray[this.seedIndex % this.seedArray.length];
      this.seedIndex++;
      return value;
    }

    // Unseeded mode - use crypto API
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] / (0xffffffff + 1);
  }

  /**
   * Get random integer in range [min, max]
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   */
  nextInt(min, max) {
    if (min > max) {
      throw new Error(`Invalid range: ${min} > ${max}`);
    }

    const range = max - min + 1;
    return min + Math.floor(this.nextFloat() * range);
  }

  /**
   * Get array of random integers
   * @param {number} count - How many values to generate
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   */
  nextInts(count, min, max) {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(this.nextInt(min, max));
    }
    return result;
  }

  /**
   * Shuffle array using Fisher-Yates shuffle
   * Uses cryptographically secure random values
   */
  shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Pick random element from array
   */
  pick(array) {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Reset seeded RNG to beginning
   */
  reset() {
    if (this.seed !== null) {
      this.seedIndex = 0;
    }
  }

  /**
   * Get RNG state for debugging
   */
  getState() {
    return {
      seeded: this.seed !== null,
      seed: this.seed,
      seedIndex: this.seedIndex,
    };
  }
}

export default RNG;
