export const AAAH_A_BASE = 5;
export const AAAH_A_DROP_ALT = 50000;
export const AAAH_STAR_INTERVAL = 25000;
export const AAAH_STAR_MAX = 8;

/**
 * @param {number} altitude
 * @returns {string}
 */
export function generateAaaah(altitude) {
  const aCount = AAAH_A_BASE - Math.min(1, Math.floor(altitude / AAAH_A_DROP_ALT));
  const starCount = Math.min(AAAH_STAR_MAX, Math.floor(altitude / AAAH_STAR_INTERVAL));
  return 'A'.repeat(aCount) + 'HHHH' + '\u2B50'.repeat(starCount) + '!!!!';
}

/**
 * @param {number} altitude
 * @returns {number}
 */
export function getAaaahTier(altitude) {
  return 1 + (altitude >= 1000) + (altitude >= 5000) + (altitude >= 20000) + (altitude >= 100000);
}
