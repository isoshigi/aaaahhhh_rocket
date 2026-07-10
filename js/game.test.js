import { describe, test, expect } from "bun:test";
import {
  STATE,
  COUNTDOWN_STEPS,
  COUNTDOWN_END,
  GRACE_PERIOD_MS,
  SPEED_COEFFICIENT,
  FINAL_ALTITUDE,
  EXPLOSION_DELAY_MS,
  isVictory,
  gainAltitude,
  computeDt,
  getCountdownStepIndex,
  tickCountdown,
  tickFlying,
  tickExploded,
  shouldKeepVolumeForAltitude
} from "./game.js";

describe("game.js", () => {
  describe("定数の整合性", () => {
    test("STATE 4 種が定義されている", () => {
      expect(STATE.TITLE).toBe("title");
      expect(STATE.COUNTDOWN).toBe("countdown");
      expect(STATE.FLYING).toBe("flying");
      expect(STATE.EXPLODED).toBe("exploded");
    });

    test("COUNTDOWN_STEPS は at 昇順、最後だけ go=true", () => {
      expect(COUNTDOWN_STEPS.length).toBeGreaterThan(0);
      for (let i = 1; i < COUNTDOWN_STEPS.length; i++) {
        expect(COUNTDOWN_STEPS[i].at).toBeGreaterThan(COUNTDOWN_STEPS[i - 1].at);
      }
      const goCount = COUNTDOWN_STEPS.filter(s => s.go).length;
      expect(goCount).toBe(1);
      expect(COUNTDOWN_STEPS[COUNTDOWN_STEPS.length - 1].go).toBe(true);
    });

    test("COUNTDOWN_END は最後のステップ at より大きい", () => {
      expect(COUNTDOWN_END).toBeGreaterThan(COUNTDOWN_STEPS[COUNTDOWN_STEPS.length - 1].at);
    });

    test("主要定数 > 0", () => {
      expect(GRACE_PERIOD_MS).toBeGreaterThan(0);
      expect(SPEED_COEFFICIENT).toBeGreaterThan(0);
      expect(FINAL_ALTITUDE).toBeGreaterThan(0);
      expect(EXPLOSION_DELAY_MS).toBeGreaterThan(0);
    });
  });

  describe("isVictory", () => {
    test("FINAL_ALTITUDE 未満は false", () => {
      expect(isVictory(0)).toBe(false);
      expect(isVictory(FINAL_ALTITUDE - 1)).toBe(false);
    });
    test("FINAL_ALTITUDE ちょうどで true", () => {
      expect(isVictory(FINAL_ALTITUDE)).toBe(true);
    });
    test("FINAL_ALTITUDE 超過でも true", () => {
      expect(isVictory(FINAL_ALTITUDE + 1)).toBe(true);
    });
  });

  describe("gainAltitude", () => {
    test("volume <= threshold なら変化なし", () => {
      expect(gainAltitude(1000, 0.05, 0.10, 0.016)).toBe(1000);
      expect(gainAltitude(1000, 0.10, 0.10, 0.016)).toBe(1000);
    });
    test("volume > threshold で線形増加", () => {
      const dt = 0.016;
      const threshold = 0.10;
      const volume = 0.20;
      const altitude = 1000;
      const expected = altitude + (volume - threshold) * SPEED_COEFFICIENT * dt;
      expect(gainAltitude(altitude, volume, threshold, dt)).toBeCloseTo(expected, 10);
    });
    test("dt=0 なら変化なし", () => {
      expect(gainAltitude(1000, 0.5, 0.1, 0)).toBe(1000);
    });
    test("dt 負なら変化なし", () => {
      expect(gainAltitude(1000, 0.5, 0.1, -0.01)).toBe(1000);
    });
  });

  describe("computeDt", () => {
    test("差分秒を返す (maxDt 明示時)", () => {
      expect(computeDt(1500, 1000, 10)).toBe(0.5);
      expect(computeDt(1016, 1000, 10)).toBe(0.016);
    });
    test("差分が maxDt を超えると上限にクランプ", () => {
      expect(computeDt(10000, 0)).toBe(0.05);
      expect(computeDt(2000, 1000)).toBe(0.05);
    });
    test("maxDt を明示的に指定できる", () => {
      expect(computeDt(2000, 1000, 10)).toBe(1);
    });
    test("負の差分は 0", () => {
      expect(computeDt(500, 1000)).toBe(0);
    });
  });

  describe("getCountdownStepIndex", () => {
    test("負 elapsed は -1", () => {
      expect(getCountdownStepIndex(-1)).toBe(-1);
    });
    test("最初のステップ直前 (at=0 未満) は -1", () => {
      expect(getCountdownStepIndex(COUNTDOWN_STEPS[0].at - 0.001)).toBe(-1);
    });
    test("各ステップ境界でインデックスを返す", () => {
      for (let i = 0; i < COUNTDOWN_STEPS.length; i++) {
        const s = COUNTDOWN_STEPS[i];
        expect(getCountdownStepIndex(s.at)).toBe(i);
        if (i + 1 < COUNTDOWN_STEPS.length) {
          expect(getCountdownStepIndex(s.at + 1)).toBe(i);
        }
      }
    });
    test("COUNTDOWN_END 直前 (最後のステップ)", () => {
      expect(getCountdownStepIndex(COUNTDOWN_END - 1)).toBe(COUNTDOWN_STEPS.length - 1);
    });
  });

  describe("tickCountdown", () => {
    test("elapsed >= COUNTDOWN_END で FLYING 遷移、flyingStart を返す", () => {
      const r = tickCountdown({ elapsed: COUNTDOWN_END, lastCountdownStep: 0, now: 5000 });
      expect(r.nextState).toBe(STATE.FLYING);
      expect(r.transition).toBe(true);
      expect(r.flyingStart).toBe(5000);
      expect(r.shouldShowAaah).toBe(true);
      expect(r.shouldShowReady).toBe(false);
      expect(r.shouldShowCountdown).toBe(false);
    });

    test("elapsed < COUNTDOWN_END で同じ stepIndex なら transition なし", () => {
      const r = tickCountdown({ elapsed: 100, lastCountdownStep: 0, now: 0 });
      expect(r.nextState).toBe(STATE.COUNTDOWN);
      expect(r.transition).toBe(false);
    });

    test("新しい stepIndex に進んだら text / className / isGo を返す", () => {
      const r = tickCountdown({ elapsed: 900, lastCountdownStep: 0, now: 0 });
      expect(r.nextState).toBe(STATE.COUNTDOWN);
      expect(r.transition).toBe(true);
      expect(r.stepIndex).toBe(1);
      expect(r.text).toBe("2");
      expect(r.isGo).toBe(false);
      expect(r.className).toBe("countdown");
    });

    test("GO ステップは className に ' go' 付与、isGo=true", () => {
      const r = tickCountdown({ elapsed: 2700, lastCountdownStep: 2, now: 0 });
      expect(r.isGo).toBe(true);
      expect(r.className).toBe("countdown go");
      expect(r.text).toBe("GO!");
    });

    test("elapsed < 0 のような不正値で COUNTDOWN 維持 (transition なし)", () => {
      const r = tickCountdown({ elapsed: -1, lastCountdownStep: -1, now: 0 });
      expect(r.nextState).toBe(STATE.COUNTDOWN);
      expect(r.transition).toBe(false);
    });
  });

  describe("tickFlying", () => {
    test("graced 中 (flyingStart+GRACE_PERIOD_MS 未満) は volume 低くても EXPLODED しない", () => {
      const r = tickFlying({
        altitude: 100, dt: 0.016, now: GRACE_PERIOD_MS - 1, volume: 0, threshold: 0.1, flyingStart: 0
      });
      expect(r.nextState).toBe(STATE.FLYING);
      expect(r.altitude).toBe(100);
    });

    test("graced 経過 + volume <= threshold で EXPLODED、explosionStartTime = now", () => {
      const r = tickFlying({
        altitude: 100, dt: 0.016, now: GRACE_PERIOD_MS + 1, volume: 0.05, threshold: 0.1, flyingStart: 0
      });
      expect(r.nextState).toBe(STATE.EXPLODED);
      expect(r.transition).toBe(true);
      expect(r.altitude).toBe(100);
      expect(r.explosionStartTime).toBe(GRACE_PERIOD_MS + 1);
    });

    test("volume > threshold なら altitude が増加", () => {
      const r = tickFlying({
        altitude: 0, dt: 0.016, now: 1000, volume: 0.2, threshold: 0.1, flyingStart: 0
      });
      expect(r.nextState).toBe(STATE.FLYING);
      expect(r.altitude).toBeGreaterThan(0);
    });

    test("altitude >= FINAL_ALTITUDE で victory、altitude は FINAL_ALTITUDE にクランプ", () => {
      const r = tickFlying({
        altitude: FINAL_ALTITUDE - 10, dt: 100, now: 1000, volume: 0.5, threshold: 0.1, flyingStart: 0
      });
      expect(r.victory).toBe(true);
      expect(r.altitude).toBe(FINAL_ALTITUDE);
      expect(r.nextState).toBe(STATE.TITLE);
      expect(r.transition).toBe(true);
    });

    test("dt=0 なら altitude 変わらず (volume > threshold でも)", () => {
      const r = tickFlying({
        altitude: 100, dt: 0, now: 1000, volume: 0.5, threshold: 0.1, flyingStart: 0
      });
      expect(r.nextState).toBe(STATE.FLYING);
      expect(r.altitude).toBe(100);
    });
  });

  describe("tickExploded", () => {
    test("経過時間 < EXPLOSION_DELAY_MS なら EXPLODED 維持", () => {
      const r = tickExploded({ now: EXPLOSION_DELAY_MS - 1, explosionStartTime: 0 });
      expect(r.nextState).toBe(STATE.EXPLODED);
      expect(r.shouldShowScore).toBe(false);
      expect(r.transition).toBe(false);
    });

    test("経過時間 >= EXPLOSION_DELAY_MS で TITLE 遷移 + shouldShowScore=true", () => {
      const r = tickExploded({ now: EXPLOSION_DELAY_MS, explosionStartTime: 0 });
      expect(r.nextState).toBe(STATE.TITLE);
      expect(r.shouldShowScore).toBe(true);
      expect(r.transition).toBe(true);
    });
  });

  describe("shouldKeepVolumeForAltitude", () => {
    test("volume > threshold → true", () => {
      expect(shouldKeepVolumeForAltitude(0.2, 0.1)).toBe(true);
    });
    test("volume == threshold → false (境界で false)", () => {
      expect(shouldKeepVolumeForAltitude(0.1, 0.1)).toBe(false);
    });
    test("volume < threshold → false", () => {
      expect(shouldKeepVolumeForAltitude(0.05, 0.1)).toBe(false);
    });
  });
});
