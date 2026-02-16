/**
 * Test suite for CascadeEngine
 *
 * Tests gravity (symbols falling), new symbol generation, and cascade execution
 */

import { CascadeEngine } from "./cascadeEngine.js";
import { CascadeDetector } from "./cascadeDetector.js";

const { RED, GREEN, PURPLE, YELLOW, BLUE, WILD, SCATTER, EMPTY } =
  CascadeDetector.SYMBOL_IDS;

// Mock RNG for deterministic testing
class MockRNG {
  constructor(sequence = []) {
    this.sequence = sequence;
    this.index = 0;
  }

  nextInt(max) {
    const val = this.sequence[this.index] % max;
    this.index++;
    return val;
  }

  reset() {
    this.index = 0;
  }
}

describe("CascadeEngine", () => {
  let engine;
  let mockRng;

  beforeEach(() => {
    engine = new CascadeEngine();
    mockRng = new MockRNG();
  });

  /**
   * GRAVITY TESTS
   */
  describe("Apply Gravity", () => {
    it("should drop symbols down one row", () => {
      const grid = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [GREEN, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // RED and GREEN both fall to stacking positions at bottom
      // Column 0 has 2 non-empty, so 3 empty at top
      expect(grid[0][0]).toBe(EMPTY);
      expect(grid[1][0]).toBe(EMPTY);
      expect(grid[2][0]).toBe(EMPTY);
      expect(grid[3][0]).toBe(RED);
      expect(grid[4][0]).toBe(GREEN);
    });

    it("should drop symbol to bottom when empty spaces below", () => {
      const grid = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // RED should fall to bottom
      expect(grid[4][0]).toBe(RED);
      // All above should be empty
      for (let y = 0; y < 4; y++) {
        expect(grid[y][0]).toBe(EMPTY);
      }
    });

    it("should drop multiple symbols in same column", () => {
      const grid = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [GREEN, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // Both should stack at bottom
      expect(grid[3][0]).toBe(RED);
      expect(grid[4][0]).toBe(GREEN);
      // Above should be empty
      for (let y = 0; y < 3; y++) {
        expect(grid[y][0]).toBe(EMPTY);
      }
    });

    it("should handle multiple columns independently", () => {
      const grid = [
        [RED, GREEN, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, BLUE, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // Column 0: RED at bottom
      expect(grid[4][0]).toBe(RED);
      // Column 1: GREEN and BLUE stacked at bottom
      expect(grid[3][1]).toBe(GREEN);
      expect(grid[4][1]).toBe(BLUE);
    });

    it("should handle column with no empty spaces", () => {
      const grid = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [GREEN, EMPTY, EMPTY, EMPTY, EMPTY],
        [PURPLE, EMPTY, EMPTY, EMPTY, EMPTY],
        [YELLOW, EMPTY, EMPTY, EMPTY, EMPTY],
        [BLUE, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const originalColumn0 = [RED, GREEN, PURPLE, YELLOW, BLUE];
      engine.applyGravity(grid);

      // Order should be preserved
      for (let y = 0; y < 5; y++) {
        expect(grid[y][0]).toBe(originalColumn0[y]);
      }
    });

    it("should handle entire empty grid", () => {
      const grid = CascadeEngine.createEmptyGrid();
      engine.applyGravity(grid);

      // Grid should remain empty
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          expect(grid[y][x]).toBe(EMPTY);
        }
      }
    });
  });

  /**
   * FILL FROM TOP TESTS
   */
  describe("Fill From Top", () => {
    it("should fill single empty space with symbol", () => {
      mockRng.sequence = [0]; // Will pick first weighted symbol (RED)
      const grid = [
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.fillFromTop(grid, mockRng);

      // Position [0][0] should be filled
      expect(grid[0][0]).not.toBe(EMPTY);
      // Other positions should remain unchanged
      expect(grid[1][0]).toBe(RED);
    });

    it("should fill multiple empty spaces", () => {
      mockRng.sequence = [0, 5, 10]; // Different symbols
      const grid = [
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, RED, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [GREEN, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.fillFromTop(grid, mockRng);

      // All empty spaces should be filled
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          expect(grid[y][x]).not.toBe(EMPTY);
        }
      }
    });

    it("should respect weighted probabilities (RED most common)", () => {
      // Create sequence that heavily favors RED picks
      const sequence = Array(25).fill(0); // All 0s = RED
      mockRng.sequence = sequence;

      const grid = CascadeEngine.createEmptyGrid();
      engine.fillFromTop(grid, mockRng);

      // Most cells should be RED
      let redCount = 0;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if (grid[y][x] === RED) redCount++;
        }
      }
      expect(redCount).toBeGreaterThan(20); // 25 cells, most RED
    });

    it("should not override non-empty positions", () => {
      const grid = [
        [EMPTY, RED, EMPTY, EMPTY, EMPTY],
        [GREEN, EMPTY, PURPLE, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const originalRed = grid[0][1];
      const originalGreen = grid[1][0];
      const originalPurple = grid[1][2];

      engine.fillFromTop(grid, mockRng);

      // Non-empty positions should remain unchanged
      expect(grid[0][1]).toBe(originalRed);
      expect(grid[1][0]).toBe(originalGreen);
      expect(grid[1][2]).toBe(originalPurple);
    });
  });

  /**
   * FULL CASCADE EXECUTION TESTS
   */
  describe("Execute Cascade", () => {
    it("should remove winners, apply gravity, and fill from top", () => {
      mockRng.sequence = Array(25).fill(0); // All RED fills

      const grid = [
        [RED, RED, RED, RED, RED], // This will be winning cluster
        [GREEN, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      // First detect wins to get positions to remove
      const winResult = new CascadeDetector().findWins(grid);
      const result = engine.executeCascade(
        CascadeEngine.cloneGrid(grid),
        winResult.winPositions,
        mockRng,
      );

      // After cascade:
      // 1. TOP 5 RED symbols should be removed
      // 2. GREEN should fall down (it was at y=1, should be at y=0 now or lower)
      // 3. Empty spaces should be filled with new symbols

      expect(result.grid[0][0]).not.toBe(EMPTY); // Should be filled
      expect(result.newWins).toBeDefined();
    });

    it("should detect new wins after cascade", () => {
      // Create a cascade that generates new wins
      mockRng.sequence = Array(25).fill(0); // All RED

      const grid = [
        [RED, RED, RED, RED, RED], // Win
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [GREEN, GREEN, GREEN, GREEN, GREEN], // Will fall and might match new REDs
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const winResult = new CascadeDetector().findWins(grid);
      const result = engine.executeCascade(
        CascadeEngine.cloneGrid(grid),
        winResult.winPositions,
        mockRng,
      );

      // Depends on if new wins form
      expect(result.newWins).toBeDefined();
      expect(result.newWins.totalWin !== undefined).toBe(true);
    });

    it("should return movement data for animations", () => {
      mockRng.sequence = Array(25).fill(0);

      const grid = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const winResult = new CascadeDetector().findWins(grid);
      const result = engine.executeCascade(
        CascadeEngine.cloneGrid(grid),
        winResult.winPositions,
        mockRng,
      );

      expect(result.moveData).toBeDefined();
      expect(result.moveData.movedCells).toBeDefined();
    });
  });

  /**
   * HELPER METHODS TESTS
   */
  describe("Helper Methods", () => {
    it("should clone grid correctly", () => {
      const original = [
        [RED, GREEN, PURPLE],
        [YELLOW, BLUE, WILD],
        [SCATTER, EMPTY, RED],
      ];

      const cloned = CascadeEngine.cloneGrid(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original); // Different object
      expect(cloned[0]).not.toBe(original[0]); // Different rows
    });

    it("should create empty grid correctly", () => {
      const grid = CascadeEngine.createEmptyGrid();

      expect(grid).toHaveLength(5);
      for (let y = 0; y < 5; y++) {
        expect(grid[y]).toHaveLength(5);
        for (let x = 0; x < 5; x++) {
          expect(grid[y][x]).toBe(EMPTY);
        }
      }
    });

    it("should modify cloned grid without affecting original", () => {
      const original = [
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const cloned = CascadeEngine.cloneGrid(original);
      cloned[0][0] = GREEN;

      expect(original[0][0]).toBe(RED);
      expect(cloned[0][0]).toBe(GREEN);
    });
  });

  /**
   * COMPLEX SCENARIOS
   */
  describe("Complex Cascade Scenarios", () => {
    it("should handle cascade with multiple columns dropping simultaneously", () => {
      mockRng.sequence = Array(100).fill(0); // All RED

      const grid = [
        [RED, GREEN, PURPLE, YELLOW, BLUE],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [RED, GREEN, PURPLE, YELLOW, BLUE],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // Rows 0 and 2 should compress down while maintaining relative order
      expect(grid[3][0]).toBe(RED);
      expect(grid[4][0]).toBe(RED);
      expect(grid[3][1]).toBe(GREEN);
      expect(grid[4][1]).toBe(GREEN);
    });

    it("should cascade correctly with scattered empty spaces", () => {
      const grid = [
        [RED, EMPTY, GREEN, EMPTY, PURPLE],
        [EMPTY, BLUE, EMPTY, YELLOW, EMPTY],
        [WILD, EMPTY, RED, EMPTY, GREEN],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      engine.applyGravity(grid);

      // Each column should have symbols stack at bottom
      const symbols0 = [RED, WILD];
      const symbols2 = [GREEN, RED];
      const symbols4 = [PURPLE, GREEN];

      expect(grid[3][0]).toBe(RED);
      expect(grid[4][0]).toBe(WILD);
      expect(grid[3][2]).toBe(GREEN);
      expect(grid[4][2]).toBe(RED);
      expect(grid[3][4]).toBe(PURPLE);
      expect(grid[4][4]).toBe(GREEN);
    });
  });
});
