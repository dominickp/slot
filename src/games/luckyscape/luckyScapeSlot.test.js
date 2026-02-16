import { LuckyScapeSlot } from "./luckyScapeSlot.js";

describe("LuckyScapeSlot rainbow enforcement", () => {
  it("keeps a single rainbow visible when already spawned this spin", () => {
    const slot = new LuckyScapeSlot();
    slot.currentGrid = [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 9, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ];
    slot.rainbowSpawnedThisSpin = true;

    slot._enforceSingleRainbowPerSpin();

    expect(slot.currentGrid[2][2]).toBe(9);
  });

  it("replaces only extra rainbows and keeps one", () => {
    const slot = new LuckyScapeSlot();
    slot.currentGrid = [
      [1, 1, 1, 1, 1, 1],
      [1, 9, 1, 1, 1, 1],
      [1, 1, 1, 9, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ];
    slot.rainbowSpawnedThisSpin = true;

    slot._enforceSingleRainbowPerSpin();

    const rainbowCount = slot.currentGrid
      .flat()
      .filter((symbol) => symbol === 9).length;

    expect(rainbowCount).toBe(1);
  });
});
