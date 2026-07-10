import { describe, test, expect } from "bun:test";
import {
  THRESHOLDS,
  DISPLAY_MAX,
  FFT_SIZE,
  ANALYSER_SMOOTHING,
  RMS_SMOOTHING_RATE,
  thresholdFor,
  toPercent,
  getVolumePercent,
  getThresholdPercent,
  rmsSmoothingFactor,
  computeRms,
  smoothRms
} from "./audio-data.js";

describe("audio-data.js", () => {
  describe("定数", () => {
    test("THRESHOLDS は weak/medium/strong の number", () => {
      expect(typeof THRESHOLDS.weak).toBe("number");
      expect(typeof THRESHOLDS.medium).toBe("number");
      expect(typeof THRESHOLDS.strong).toBe("number");
    });

    test("THRESHOLDS は weak < medium < strong", () => {
      expect(THRESHOLDS.weak).toBeLessThan(THRESHOLDS.medium);
      expect(THRESHOLDS.medium).toBeLessThan(THRESHOLDS.strong);
    });

    test("THRESHOLDS の値は 0..1 範囲", () => {
      for (const k of ["weak", "medium", "strong"]) {
        expect(THRESHOLDS[k]).toBeGreaterThan(0);
        expect(THRESHOLDS[k]).toBeLessThan(1);
      }
    });

    test("DISPLAY_MAX > 0 かつ 1 未満", () => {
      expect(DISPLAY_MAX).toBeGreaterThan(0);
      expect(DISPLAY_MAX).toBeLessThan(1);
    });

    test("FFT_SIZE は 2 の累乗", () => {
      expect(FFT_SIZE).toBe(2048);
      expect((FFT_SIZE & (FFT_SIZE - 1)) === 0).toBe(true);
    });

    test("ANALYSER_SMOOTHING は 0..1 範囲", () => {
      expect(ANALYSER_SMOOTHING).toBeGreaterThanOrEqual(0);
      expect(ANALYSER_SMOOTHING).toBeLessThanOrEqual(1);
    });

    test("RMS_SMOOTHING_RATE > 0", () => {
      expect(RMS_SMOOTHING_RATE).toBeGreaterThan(0);
    });
  });

  describe("thresholdFor", () => {
    test("既知 difficulty は対応する値", () => {
      expect(thresholdFor("weak")).toBe(THRESHOLDS.weak);
      expect(thresholdFor("medium")).toBe(THRESHOLDS.medium);
      expect(thresholdFor("strong")).toBe(THRESHOLDS.strong);
    });
    test("未知 difficulty は medium フォールバック", () => {
      expect(thresholdFor("extreme")).toBe(THRESHOLDS.medium);
      expect(thresholdFor("")).toBe(THRESHOLDS.medium);
      expect(thresholdFor(undefined)).toBe(THRESHOLDS.medium);
      expect(thresholdFor(null)).toBe(THRESHOLDS.medium);
    });
  });

  describe("toPercent", () => {
    test("0 → 0", () => expect(toPercent(0)).toBe(0));
    test("max → 100", () => expect(toPercent(DISPLAY_MAX)).toBe(100));
    test("max/2 → 50", () => expect(toPercent(DISPLAY_MAX / 2)).toBe(50));
    test("max を超えると 100 でクランプ", () => {
      expect(toPercent(DISPLAY_MAX * 2)).toBe(100);
    });
    test("負値は 0", () => {
      expect(toPercent(-1)).toBe(0);
    });
    test("非 finite は 0", () => {
      expect(toPercent(NaN)).toBe(0);
      expect(toPercent(Infinity)).toBe(0);
    });
    test("max 引数で別スケール可", () => {
      expect(toPercent(50, 100)).toBe(50);
      expect(toPercent(150, 100)).toBe(100);
    });
    test("max <= 0 は 0", () => {
      expect(toPercent(1, 0)).toBe(0);
      expect(toPercent(1, -1)).toBe(0);
    });
  });

  describe("getVolumePercent / getThresholdPercent", () => {
    test("DISPLAY_MAX で 100", () => {
      expect(getVolumePercent(DISPLAY_MAX)).toBe(100);
      expect(getThresholdPercent(DISPLAY_MAX)).toBe(100);
    });
    test("0 で 0", () => {
      expect(getVolumePercent(0)).toBe(0);
      expect(getThresholdPercent(0)).toBe(0);
    });
    test("閾値別の percent が DISPLAY_MAX 比率で得られる", () => {
      expect(getThresholdPercent(THRESHOLDS.weak)).toBeCloseTo((THRESHOLDS.weak / DISPLAY_MAX) * 100, 5);
      expect(getThresholdPercent(THRESHOLDS.medium)).toBeCloseTo((THRESHOLDS.medium / DISPLAY_MAX) * 100, 5);
      expect(getThresholdPercent(THRESHOLDS.strong)).toBeCloseTo((THRESHOLDS.strong / DISPLAY_MAX) * 100, 5);
    });
  });

  describe("rmsSmoothingFactor", () => {
    test("dt=0 → 0", () => {
      expect(rmsSmoothingFactor(0)).toBe(0);
    });
    test("dt 負 → 0", () => {
      expect(rmsSmoothingFactor(-0.1)).toBe(0);
    });
    test("dt が大きいと 1 に漸近", () => {
      expect(rmsSmoothingFactor(10)).toBeCloseTo(1, 5);
    });
    test("rate * dt = 1 で約 0.632", () => {
      const r = 1 / RMS_SMOOTHING_RATE;
      expect(rmsSmoothingFactor(r)).toBeCloseTo(1 - Math.exp(-1), 5);
    });
    test("非 finite は 0", () => {
      expect(rmsSmoothingFactor(NaN)).toBe(0);
    });
  });

  describe("computeRms", () => {
    test("空 / null 配列は 0", () => {
      expect(computeRms(null)).toBe(0);
      expect(computeRms([])).toBe(0);
    });
    test("全て 0 なら 0", () => {
      expect(computeRms([0, 0, 0, 0])).toBe(0);
    });
    test("全て 1 なら 1", () => {
      expect(computeRms([1, 1, 1, 1])).toBe(1);
    });
    test("[-1, 1] 交互なら 1", () => {
      expect(computeRms([-1, 1, -1, 1])).toBe(1);
    });
    test("0.5 一定なら 0.5", () => {
      expect(computeRms([0.5, 0.5, 0.5, 0.5])).toBe(0.5);
    });
  });

  describe("smoothRms", () => {
    test("dt=0 なら prev のまま", () => {
      expect(smoothRms(0.3, 0.9, 0)).toBe(0.3);
    });
    test("dt が大きいと rms に追従", () => {
      expect(smoothRms(0, 1, 10)).toBeCloseTo(1, 3);
    });
    test("prev = rms なら prev のまま", () => {
      expect(smoothRms(0.5, 0.5, 0.016)).toBe(0.5);
    });
    test("dt が小さいと prev に近い", () => {
      const v = smoothRms(0, 1, 0.001);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(0.5);
    });
  });
});
