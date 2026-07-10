import { describe, test, expect } from "bun:test";
import { generateAaaah, getAaaahTier } from "./aaah.js";

describe("aaah.js", () => {
  describe("generateAaaah", () => {
    test("altitude 0 → 5A + 0 stars", () => {
      expect(generateAaaah(0)).toBe("AAAAAHHHH!!!!");
    });

    test("altitude 24999 → 5A + 0 stars (境界)", () => {
      expect(generateAaaah(24999)).toBe("AAAAAHHHH!!!!");
    });

    test("altitude 25000 → 5A + 1 star", () => {
      expect(generateAaaah(25000)).toBe("AAAAAHHHH\u2B50!!!!");
    });

    test("altitude 49999 → 5A + 1 star (A 減少前)", () => {
      expect(generateAaaah(49999)).toBe("AAAAAHHHH\u2B50!!!!");
    });

    test("altitude 50000 → 4A + 2 stars (A 減少)", () => {
      expect(generateAaaah(50000)).toBe("AAAAHHHH\u2B50\u2B50!!!!");
    });

    test("altitude 100000 → 4A + 4 stars", () => {
      expect(generateAaaah(100000)).toBe("AAAAHHHH" + "\u2B50".repeat(4) + "!!!!");
    });

    test("altitude 200000 → stars 上限 8", () => {
      const stars = (generateAaaah(200000).match(/\u2B50/g) || []).length;
      expect(stars).toBe(8);
    });

    test("altitude 999999 → A は 4 を超えない (min(1, x))", () => {
      const s = generateAaaah(999999);
      expect(s.startsWith("AAAAHHHH")).toBe(true);
    });

    test("必ず !!!! で終わる", () => {
      for (const alt of [0, 100, 12345, 99999, 500000]) {
        expect(generateAaaah(alt).endsWith("!!!!")).toBe(true);
      }
    });
  });

  describe("getAaaahTier", () => {
    test("0 / 999 → 1", () => {
      expect(getAaaahTier(0)).toBe(1);
      expect(getAaaahTier(999)).toBe(1);
    });
    test("1000 / 4999 → 2", () => {
      expect(getAaaahTier(1000)).toBe(2);
      expect(getAaaahTier(4999)).toBe(2);
    });
    test("5000 / 19999 → 3", () => {
      expect(getAaaahTier(5000)).toBe(3);
      expect(getAaaahTier(19999)).toBe(3);
    });
    test("20000 / 99999 → 4", () => {
      expect(getAaaahTier(20000)).toBe(4);
      expect(getAaaahTier(99999)).toBe(4);
    });
    test("100000 / 999999 → 5", () => {
      expect(getAaaahTier(100000)).toBe(5);
      expect(getAaaahTier(999999)).toBe(5);
    });
  });
});
