import { describe, it, expect } from "vitest";
import { shuffle, shuffleInPlace } from "./shuffle";

describe("shuffle", () => {
  it("returns a new array without mutating the original", () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    const result = shuffle(original);

    expect(original).toEqual(originalCopy);
    expect(result).not.toBe(original);
  });

  it("returns array with same length", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.length).toBe(arr.length);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual(arr.sort());
  });

  it("handles empty array", () => {
    const result = shuffle([]);
    expect(result).toEqual([]);
  });

  it("handles single element", () => {
    const result = shuffle([42]);
    expect(result).toEqual([42]);
  });

  it("produces different orderings over many runs", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set<string>();

    // Run shuffle 100 times and collect unique orderings
    for (let i = 0; i < 100; i++) {
      results.add(JSON.stringify(shuffle(arr)));
    }

    // Should have multiple different orderings
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("shuffleInPlace", () => {
  it("mutates the original array", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffleInPlace(arr);
    expect(result).toBe(arr);
  });

  it("contains all original elements", () => {
    const original = [1, 2, 3, 4, 5];
    const arr = [...original];
    shuffleInPlace(arr);
    expect(arr.sort()).toEqual(original.sort());
  });
});
