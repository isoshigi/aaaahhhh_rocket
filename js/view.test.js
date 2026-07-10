import { describe, test, expect } from "bun:test";
import {
  SKY_STOPS,
  STAR_OP_BREAKS,
  PIXELS_PER_METER,
  SKY_HORIZON_Y,
  CLOUD_VISIBLE_MIN_ALT,
  CLOUD_FADE_FULL_ALT,
  CLOUD_FADE_END_ALT,
  STAR_FADE_START_ALT,
  STAR_FADE_END_ALT,
  EARTH_FADE_START_ALT,
  EARTH_FADE_END_ALT,
  EARTH_NEAR_CY,
  EARTH_NEAR_R,
  EARTH_MID_CY,
  EARTH_FINAL_CY,
  EARTH_FINAL_R,
  EARTH_MID_ALT_END,
  ATMOSPHERE_STROKE_WIDTH,
  lerp,
  clamp,
  smoothstep,
  rgbStr,
  getSkyColor,
  computeCloudOpacity,
  computeStarOpacity,
  computeEarthView,
  cloudScreenY
} from "./view.js";

describe("view.js", () => {
  describe("定数の構造", () => {
    test("SKY_STOPS は alt 昇順の 4 段", () => {
      expect(SKY_STOPS).toHaveLength(4);
      for (let i = 1; i < SKY_STOPS.length; i++) {
        expect(SKY_STOPS[i].alt).toBeGreaterThan(SKY_STOPS[i - 1].alt);
      }
    });

    test("SKY_STOPS の各 r/g/b は 0..255", () => {
      for (const s of SKY_STOPS) {
        expect(s.r).toBeGreaterThanOrEqual(0);
        expect(s.r).toBeLessThanOrEqual(255);
        expect(s.g).toBeGreaterThanOrEqual(0);
        expect(s.g).toBeLessThanOrEqual(255);
        expect(s.b).toBeGreaterThanOrEqual(0);
        expect(s.b).toBeLessThanOrEqual(255);
      }
    });

    test("STAR_OP_BREAKS は昇順で 0..1 範囲", () => {
      for (let i = 1; i < STAR_OP_BREAKS.length; i++) {
        expect(STAR_OP_BREAKS[i]).toBeGreaterThan(STAR_OP_BREAKS[i - 1]);
      }
      for (const b of STAR_OP_BREAKS) {
        expect(b).toBeGreaterThan(0);
        expect(b).toBeLessThan(1);
      }
    });
  });

  describe("lerp", () => {
    test("t=0 → a", () => expect(lerp(10, 20, 0)).toBe(10));
    test("t=1 → b", () => expect(lerp(10, 20, 1)).toBe(20));
    test("t=0.5 → 中点", () => expect(lerp(0, 100, 0.5)).toBe(50));
    test("t<0 / t>1 も線形外挿", () => {
      expect(lerp(0, 10, -1)).toBe(-10);
      expect(lerp(0, 10, 2)).toBe(20);
    });
  });

  describe("clamp", () => {
    test.each([
      [5,   0, 10, 5],
      [-1,  0, 10, 0],
      [11,  0, 10, 10],
      [0,   0, 10, 0],
      [10,  0, 10, 10]
    ])("clamp(%i, %i, %i) = %i", (x, lo, hi, expected) => {
      expect(clamp(x, lo, hi)).toBe(expected);
    });
  });

  describe("smoothstep", () => {
    test("端点で 0 / 1", () => {
      expect(smoothstep(0, 10, 0)).toBe(0);
      expect(smoothstep(0, 10, 10)).toBe(1);
    });
    test("範囲外はクランプ", () => {
      expect(smoothstep(0, 10, -5)).toBe(0);
      expect(smoothstep(0, 10, 20)).toBe(1);
    });
    test("中点付近で 0.5", () => {
      expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
    });
    test("単調増加", () => {
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = smoothstep(0, 20, i);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });
  });

  describe("rgbStr", () => {
    test("rgb(r,g,b) 形式", () => {
      expect(rgbStr({ r: 10, g: 20, b: 30 })).toBe("rgb(10,20,30)");
    });
  });

  describe("getSkyColor", () => {
    test("最下端より下は最下端の色", () => {
      expect(getSkyColor(-1000)).toBe(rgbStr(SKY_STOPS[0]));
    });
    test("最上端より上は最上端の色", () => {
      expect(getSkyColor(999999)).toBe(rgbStr(SKY_STOPS[SKY_STOPS.length - 1]));
    });
    test("最下端ちょうど", () => {
      expect(getSkyColor(0)).toBe(rgbStr(SKY_STOPS[0]));
    });
    test("各 stop 境界の直前/直後で単調変化", () => {
      const samples = [0, 1999, 2000, 50000, 99999, 100000, 150000, 200000];
      const colors = samples.map(getSkyColor);
      for (let i = 1; i < colors.length; i++) {
        expect(colors[i] <= colors[i - 1] || colors[i] >= colors[i - 1]).toBe(true);
      }
    });
    test("0–2000 の補間: 1000 でほぼ中間色", () => {
      const mid = getSkyColor(1000);
      const expected = rgbStr({
        r: Math.round((SKY_STOPS[0].r + SKY_STOPS[1].r) / 2),
        g: Math.round((SKY_STOPS[0].g + SKY_STOPS[1].g) / 2),
        b: Math.round((SKY_STOPS[0].b + SKY_STOPS[1].b) / 2)
      });
      expect(mid).toBe(expected);
    });
    test("rgb() 形式で返る", () => {
      expect(getSkyColor(12345)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    });
  });

  describe("computeCloudOpacity", () => {
    test(`${CLOUD_VISIBLE_MIN_ALT - 1} → 0`, () =>
      expect(computeCloudOpacity(CLOUD_VISIBLE_MIN_ALT - 1)).toBe(0));
    test(`${CLOUD_VISIBLE_MIN_ALT} → 1`, () =>
      expect(computeCloudOpacity(CLOUD_VISIBLE_MIN_ALT)).toBe(1));
    test(`${CLOUD_FADE_FULL_ALT} → 1`, () =>
      expect(computeCloudOpacity(CLOUD_FADE_FULL_ALT)).toBe(1));
    test(`${CLOUD_FADE_END_ALT} → 0`, () =>
      expect(computeCloudOpacity(CLOUD_FADE_END_ALT)).toBeCloseTo(0, 5));
    test(`${CLOUD_FADE_END_ALT + 1} → 0`, () =>
      expect(computeCloudOpacity(CLOUD_FADE_END_ALT + 1)).toBe(0));
  });

  describe("computeStarOpacity", () => {
    test(`${STAR_FADE_START_ALT - 1} → 0`, () =>
      expect(computeStarOpacity(STAR_FADE_START_ALT - 1)).toBe(0));
    test(`${STAR_FADE_START_ALT} → 0`, () =>
      expect(computeStarOpacity(STAR_FADE_START_ALT)).toBe(0));
    test(`${STAR_FADE_END_ALT} → 1`, () =>
      expect(computeStarOpacity(STAR_FADE_END_ALT)).toBe(1));
    test(`${STAR_FADE_END_ALT + 1} → 1`, () =>
      expect(computeStarOpacity(STAR_FADE_END_ALT + 1)).toBe(1));
    test("中間で smoothstep 値", () => {
      const mid = (STAR_FADE_START_ALT + STAR_FADE_END_ALT) / 2;
      expect(computeStarOpacity(mid)).toBeCloseTo(0.5, 1);
    });
  });

  describe("computeEarthView", () => {
    test("地上付近は opacity 0、EARTH_NEAR_CY / EARTH_NEAR_R", () => {
      const v = computeEarthView(0);
      expect(v.opacity).toBe(0);
      expect(v.cy).toBe(EARTH_NEAR_CY);
      expect(v.r).toBe(EARTH_NEAR_R);
    });

    test(`${EARTH_FADE_END_ALT} は完全に視界、EARTH_MID_CY`, () => {
      const v = computeEarthView(EARTH_FADE_END_ALT);
      expect(v.opacity).toBe(1);
      expect(v.cy).toBe(EARTH_MID_CY);
    });

    test(`${EARTH_MID_ALT_END - 1} でほぼ FAR_CY / FAR_R に到達`, () => {
      const v = computeEarthView(EARTH_MID_ALT_END - 1);
      const t = (EARTH_MID_ALT_END - 1 - EARTH_FADE_END_ALT) / (EARTH_MID_ALT_END - EARTH_FADE_END_ALT);
      const expectedCy = lerp(EARTH_MID_CY, 1600, t);
      const expectedR  = lerp(EARTH_NEAR_R, 1400, t);
      expect(v.cy).toBeCloseTo(expectedCy, 1);
      expect(v.r).toBeCloseTo(expectedR, 1);
    });

    test(`${EARTH_MID_ALT_END} ちょうどで FINAL_CY / FINAL_R に切り替わる`, () => {
      const v = computeEarthView(EARTH_MID_ALT_END);
      expect(v.cy).toBe(EARTH_FINAL_CY);
      expect(v.r).toBe(EARTH_FINAL_R);
    });

    test("上限以降は EARTH_FINAL_CY / EARTH_FINAL_R で一定", () => {
      const v1 = computeEarthView(150000);
      const v2 = computeEarthView(999999);
      expect(v2.cy).toBe(EARTH_FINAL_CY);
      expect(v2.r).toBe(EARTH_FINAL_R);
      expect(v1.cy).toBe(EARTH_FINAL_CY);
      expect(v1.r).toBe(EARTH_FINAL_R);
    });

    test("cy は高度とともに単調減少", () => {
      let prev = Infinity;
      for (const alt of [0, 5000, 15000, 25000, 60000, 120000, 200000]) {
        const v = computeEarthView(alt);
        expect(v.cy).toBeLessThanOrEqual(prev + 1e-9);
        prev = v.cy;
      }
    });

    test("atmosR は r より ATMOSPHERE_STROKE_WIDTH 大きい", () => {
      const v = computeEarthView(12345);
      expect(v.atmosR).toBeCloseTo(v.r + ATMOSPHERE_STROKE_WIDTH, 5);
    });

    test("atmosOpacity は opacity の 0.6 倍", () => {
      const v = computeEarthView(12345);
      expect(v.atmosOpacity).toBeCloseTo(v.opacity * 0.6, 5);
    });
  });

  describe("cloudScreenY", () => {
    test("relative 0 → SKY_HORIZON_Y", () => {
      expect(cloudScreenY(1000, 1000)).toBe(SKY_HORIZON_Y);
    });
    test("相対高度 +1m → 0.05px 加算", () => {
      expect(cloudScreenY(1001, 1000)).toBeCloseTo(SKY_HORIZON_Y + PIXELS_PER_METER, 5);
    });
    test("相対高度 -1m → 0.05px 減算", () => {
      expect(cloudScreenY(999, 1000)).toBeCloseTo(SKY_HORIZON_Y - PIXELS_PER_METER, 5);
    });
  });
});
