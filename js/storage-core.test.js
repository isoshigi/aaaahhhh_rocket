import { describe, test, expect } from "bun:test";
import {
  KEY,
  MAX_HISTORY,
  DIFFICULTY_LABELS,
  formatAltitude,
  formatDate,
  difficultyLabel,
  createRecord,
  applyEntry,
  parseStoredData
} from "./storage-core.js";

describe("storage-core.js", () => {
  describe("定数", () => {
    test("KEY", () => expect(KEY).toBe("aaaahhhh_rocket:scores"));
    test("MAX_HISTORY は 5", () => expect(MAX_HISTORY).toBe(5));
    test("DIFFICULTY_LABELS", () => {
      expect(DIFFICULTY_LABELS.weak).toBe("弱");
      expect(DIFFICULTY_LABELS.medium).toBe("中");
      expect(DIFFICULTY_LABELS.strong).toBe("強");
    });
  });

  describe("formatAltitude", () => {
    test.each([
      [0,     "0 m"],
      [500,   "500 m"],
      [999,   "999 m"],
      [1000,  "1.00 km"],
      [1500,  "1.50 km"],
      [99999, "100.00 km"],
      [100000, "100.0 km"],
      [200000, "200.0 km"]
    ])("formatAltitude(%i) = %s", (m, expected) => {
      expect(formatAltitude(m)).toBe(expected);
    });
  });

  describe("formatDate", () => {
    test("MM/DD HH:MM 形式 (UTC パース、local 表示)", () => {
      const s = formatDate("2024-01-15T10:30:00Z");
      expect(s).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    test("不正な ISO 文字列は空文字", () => {
      expect(formatDate("not a date")).toBe("");
    });

    test("now 引数なしでも throw しない", () => {
      expect(() => formatDate("2024-01-01T00:00:00Z")).not.toThrow();
    });
  });

  describe("difficultyLabel", () => {
    test("既知の difficulty は日本語化", () => {
      expect(difficultyLabel("weak")).toBe("弱");
      expect(difficultyLabel("medium")).toBe("中");
      expect(difficultyLabel("strong")).toBe("強");
    });
    test("未知の difficulty はそのまま", () => {
      expect(difficultyLabel("extreme")).toBe("extreme");
    });
  });

  describe("createRecord", () => {
    test("altitude を floor して整数化", () => {
      const r = createRecord({ altitude: 1234.7, difficulty: "medium" });
      expect(r.altitude).toBe(1234);
    });
    test("difficulty を日本語化", () => {
      const r = createRecord({ altitude: 1000, difficulty: "medium" });
      expect(r.difficulty).toBe("中");
    });
    test("未知 difficulty はそのまま", () => {
      const r = createRecord({ altitude: 1000, difficulty: "extreme" });
      expect(r.difficulty).toBe("extreme");
    });
    test("date は ISO 8601 文字列", () => {
      const r = createRecord({ altitude: 1000, difficulty: "medium" }, new Date("2024-01-15T10:30:00Z"));
      expect(r.date).toBe("2024-01-15T10:30:00.000Z");
      expect(Number.isNaN(Date.parse(r.date))).toBe(false);
    });
    test("now 引数で date を確定できる", () => {
      const fixed = new Date("2024-06-01T00:00:00.000Z");
      const r = createRecord({ altitude: 1, difficulty: "weak" }, fixed);
      expect(r.date).toBe("2024-06-01T00:00:00.000Z");
    });
  });

  describe("applyEntry", () => {
    test("空 data に 1 件追加すると best 更新と history 1 件", () => {
      const r = applyEntry({ best: 0, history: [] }, { altitude: 5000, difficulty: "中", date: "x" });
      expect(r.best).toBe(5000);
      expect(r.history).toEqual([{ altitude: 5000, difficulty: "中", date: "x" }]);
    });
    test("元 data を変更しない (immutable)", () => {
      const orig = { best: 100, history: [{ altitude: 100, difficulty: "弱", date: "x" }] };
      const copy = JSON.parse(JSON.stringify(orig));
      applyEntry(orig, { altitude: 200, difficulty: "中", date: "y" });
      expect(orig).toEqual(copy);
    });
    test("best を下げる更新は無視", () => {
      const r = applyEntry(
        { best: 10000, history: [{ altitude: 10000, difficulty: "中", date: "x" }] },
        { altitude: 3000, difficulty: "弱", date: "y" }
      );
      expect(r.best).toBe(10000);
    });
    test("best を上向きに更新", () => {
      const r = applyEntry(
        { best: 3000, history: [{ altitude: 3000, difficulty: "中", date: "x" }] },
        { altitude: 8000, difficulty: "強", date: "y" }
      );
      expect(r.best).toBe(8000);
    });
    test("history は altitude 降順", () => {
      const base = { best: 0, history: [] };
      const r1 = applyEntry(base, { altitude: 1000, difficulty: "弱", date: "x" });
      const r2 = applyEntry(r1, { altitude: 5000, difficulty: "中", date: "y" });
      const r3 = applyEntry(r2, { altitude: 3000, difficulty: "中", date: "z" });
      const h = r3.history;
      expect(h[0].altitude).toBe(5000);
      expect(h[1].altitude).toBe(3000);
      expect(h[2].altitude).toBe(1000);
    });
    test("history は最大 MAX_HISTORY 件 (5)", () => {
      let data = { best: 0, history: [] };
      for (let i = 0; i < 10; i++) {
        data = applyEntry(data, { altitude: i * 1000, difficulty: "中", date: String(i) });
      }
      expect(data.history).toHaveLength(MAX_HISTORY);
      const alts = data.history.map(r => r.altitude);
      expect(alts).toEqual([9000, 8000, 7000, 6000, 5000]);
    });
  });

  describe("parseStoredData", () => {
    test("null / undefined / 空文字 → 初期値", () => {
      expect(parseStoredData(null)).toEqual({ best: 0, history: [] });
      expect(parseStoredData(undefined)).toEqual({ best: 0, history: [] });
      expect(parseStoredData("")).toEqual({ best: 0, history: [] });
    });
    test("不正 JSON → 初期値", () => {
      expect(parseStoredData("{bad json")).toEqual({ best: 0, history: [] });
    });
    test("best が数値以外なら 0 に正規化", () => {
      const r = parseStoredData(JSON.stringify({ best: "x", history: [] }));
      expect(r.best).toBe(0);
    });
    test("history が配列以外なら [] に正規化", () => {
      const r = parseStoredData(JSON.stringify({ best: 0, history: "oops" }));
      expect(r.history).toEqual([]);
    });
    test("正しいデータを読み込める", () => {
      const r = parseStoredData(JSON.stringify({
        best: 5000,
        history: [{ altitude: 5000, difficulty: "中", date: "2024-01-01T00:00:00Z" }]
      }));
      expect(r.best).toBe(5000);
      expect(r.history).toHaveLength(1);
      expect(r.history[0].altitude).toBe(5000);
    });
  });
});
