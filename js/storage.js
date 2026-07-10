import {
  KEY,
  DIFFICULTY_LABELS,
  formatAltitude,
  formatDate,
  createRecord,
  applyEntry,
  parseStoredData
} from "./storage-core.js";

const Storage = (() => {
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return parseStoredData(raw);
    } catch (e) {
      return { best: 0, history: [] };
    }
  }

  function save(entry, now = new Date()) {
    const data = load();
    const record = createRecord(entry, now);
    const next = applyEntry(data, record);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('localStorage save failed', e);
    }
    return next;
  }

  return { load, save, formatAltitude, formatDate, DIFFICULTY_LABELS };
})();

export { Storage };
