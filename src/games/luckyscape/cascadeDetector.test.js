import { CascadeDetector } from "./cascadeDetector.js";

const { RED, GREEN, PURPLE, YELLOW, BLUE, WILD, SCATTER, RAINBOW, EMPTY } =
  CascadeDetector.SYMBOL_IDS;

describe("CascadeDetector (Le Bandit placeholder rules)", () => {
  let detector;

  beforeEach(() => {
    detector = new CascadeDetector();
  });

  describe("Cluster detection", () => {
    it("detects a 5-symbol horizontal cluster", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].positions).toHaveLength(5);
      expect(result.totalWin).toBeCloseTo(0.35);
    });

    it("detects L-shaped cluster", () => {
      const grid = [
        [PURPLE, PURPLE, PURPLE, EMPTY, EMPTY],
        [PURPLE, EMPTY, EMPTY, EMPTY, EMPTY],
        [PURPLE, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].positions).toHaveLength(5);
      expect(result.clusters[0].symbolId).toBe(PURPLE);
    });

    it("does not count clusters under 5 symbols", () => {
      const grid = [
        [BLUE, BLUE, BLUE, BLUE, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.clusters).toHaveLength(0);
      expect(result.totalWin).toBe(0);
    });
  });

  describe("Payout multipliers", () => {
    it("applies 1.5x for 6-symbol cluster", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [RED, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.totalWin).toBeCloseTo(0.35 * 1.5);
    });

    it("applies 2x for 8+ symbol cluster", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [RED, RED, RED, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.totalWin).toBeCloseTo(0.35 * 2.0);
    });

    it("does not merge different regular symbols into one cluster", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [BLUE, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.totalWin).toBeCloseTo(0.35);
    });
  });

  describe("Wild behavior", () => {
    it("does not substitute wild with regular symbols", () => {
      const grid = [
        [RED, RED, WILD, RED, RED],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.clusters).toHaveLength(0);
    });

    it("still allows pure wild cluster", () => {
      const grid = [
        [WILD, WILD, WILD, WILD, WILD],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findWins(grid);

      expect(result.clusters).toHaveLength(1);
      expect(result.totalWin).toBeCloseTo(1.6);
    });
  });

  describe("Scatter modes", () => {
    it("maps 3 scatters to LEPRECHAUN", () => {
      const grid = [
        [SCATTER, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, SCATTER, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, SCATTER, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findScatters(grid);

      expect(result.count).toBe(3);
      expect(result.bonusMode).toBe("LEPRECHAUN");
    });

    it("maps 4 scatters to GLITTER_GOLD", () => {
      const grid = [
        [SCATTER, SCATTER, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, SCATTER, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, SCATTER, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findScatters(grid);

      expect(result.count).toBe(4);
      expect(result.bonusMode).toBe("GLITTER_GOLD");
    });

    it("maps 5+ scatters to TREASURE_RAINBOW", () => {
      const grid = [
        [SCATTER, SCATTER, SCATTER, EMPTY, EMPTY],
        [SCATTER, EMPTY, EMPTY, EMPTY, EMPTY],
        [SCATTER, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const result = detector.findScatters(grid);

      expect(result.count).toBe(5);
      expect(result.bonusMode).toBe("TREASURE_RAINBOW");
    });
  });

  describe("Super cascades", () => {
    it("removes all instances of winning regular symbol types", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [GREEN, GREEN, EMPTY, GREEN, GREEN],
        [EMPTY, EMPTY, RED, EMPTY, EMPTY],
        [BLUE, EMPTY, EMPTY, EMPTY, BLUE],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const winResult = detector.findWins(grid);
      const positions = detector.getSuperCascadeRemovalPositions(
        grid,
        winResult,
      );

      expect(positions).toContain("0,0");
      expect(positions).toContain("4,0");
      expect(positions).toContain("2,2");
      expect(positions).not.toContain("0,1");
    });

    it("ignores special symbols for super-cascade expansion", () => {
      const grid = [
        [RED, RED, RED, RED, RED],
        [RAINBOW, SCATTER, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, RED, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
        [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
      ];

      const winResult = detector.findWins(grid);
      const positions = detector.getSuperCascadeRemovalPositions(
        grid,
        winResult,
      );

      expect(positions).not.toContain("0,1");
      expect(positions).not.toContain("1,1");
    });
  });
});
