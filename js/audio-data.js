export const THRESHOLDS = Object.freeze({
  weak: 0.05,
  medium: 0.12,
  strong: 0.20
});

export const DISPLAY_MAX = 0.35;
export const FFT_SIZE = 2048;
export const ANALYSER_SMOOTHING = 0.3;
export const RMS_SMOOTHING_RATE = 12;

/**
 * @param {string} difficulty
 * @returns {number}
 */
export function thresholdFor(difficulty) {
  return THRESHOLDS[difficulty] ?? THRESHOLDS.medium;
}

/**
 * @param {number} value
 * @param {number} [max=DISPLAY_MAX]
 * @returns {number}
 */
export function toPercent(value, max = DISPLAY_MAX) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  const pct = (value / max) * 100;
  return pct < 0 ? 0 : pct > 100 ? 100 : pct;
}

/**
 * @param {number} volume
 * @param {number} [max=DISPLAY_MAX]
 * @returns {number}
 */
export function getVolumePercent(volume, max = DISPLAY_MAX) {
  return toPercent(volume, max);
}

/**
 * @param {number} threshold
 * @param {number} [max=DISPLAY_MAX]
 * @returns {number}
 */
export function getThresholdPercent(threshold, max = DISPLAY_MAX) {
  return toPercent(threshold, max);
}

/**
 * @param {number} dt
 * @param {number} [rate=RMS_SMOOTHING_RATE]
 * @returns {number}
 */
export function rmsSmoothingFactor(dt, rate = RMS_SMOOTHING_RATE) {
  if (dt <= 0) return 0;
  if (!Number.isFinite(dt) || !Number.isFinite(rate)) return 0;
  const k = 1 - Math.exp(-dt * rate);
  return k < 0 ? 0 : k > 1 ? 1 : k;
}

/**
 * @param {Float32Array} samples
 * @returns {number}
 */
export function computeRms(samples) {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * @param {number} prev
 * @param {number} rms
 * @param {number} dt
 * @param {number} [rate=RMS_SMOOTHING_RATE]
 * @returns {number}
 */
export function smoothRms(prev, rms, dt, rate = RMS_SMOOTHING_RATE) {
  const k = rmsSmoothingFactor(dt, rate);
  return prev + (rms - prev) * k;
}
