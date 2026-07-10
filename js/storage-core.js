export const KEY = 'aaaahhhh_rocket:scores';
export const MAX_HISTORY = 5;

export const DIFFICULTY_LABELS = {
  weak: '弱',
  medium: '中',
  strong: '強'
};

/**
 * @param {number} m
 * @returns {string}
 */
export function formatAltitude(m) {
  if (m >= 100000) return (m / 1000).toFixed(1) + ' km';
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return Math.floor(m) + ' m';
}

/**
 * @param {string} iso
 * @param {Date} [now]
 * @returns {string}
 */
export function formatDate(iso, now = new Date()) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  } catch (e) {
    return '';
  }
}

/**
 * @param {string} difficulty
 * @returns {string}
 */
export function difficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] || difficulty;
}

/**
 * @param {{altitude: number, difficulty: string}} entry
 * @param {Date} [now]
 * @returns {{altitude: number, difficulty: string, date: string}}
 */
export function createRecord(entry, now = new Date()) {
  return {
    altitude: Math.floor(entry.altitude),
    difficulty: difficultyLabel(entry.difficulty),
    date: now.toISOString()
  };
}

/**
 * @param {{best: number, history: Array}} data
 * @param {{altitude: number, difficulty: string, date: string}} record
 * @returns {{best: number, history: Array}}
 */
export function applyEntry(data, record) {
  const next = {
    best: data.best,
    history: data.history.slice()
  };
  next.history.unshift(record);
  next.history.sort((a, b) => b.altitude - a.altitude);
  next.history = next.history.slice(0, MAX_HISTORY);
  if (record.altitude > next.best) {
    next.best = record.altitude;
  }
  return next;
}

/**
 * @param {string|null} raw
 * @returns {{best: number, history: Array}}
 */
export function parseStoredData(raw) {
  if (!raw) return { best: 0, history: [] };
  try {
    const data = JSON.parse(raw);
    return {
      best: Number(data.best) || 0,
      history: Array.isArray(data.history) ? data.history : []
    };
  } catch (e) {
    return { best: 0, history: [] };
  }
}
