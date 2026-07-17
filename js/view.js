export const SKY_STOPS = [
  { alt: 0,      r: 168, g: 216, b: 255 },
  { alt: 2000,   r: 58,  g: 123, b: 213 },
  { alt: 100000, r: 0,   g: 0,   b: 20  },
  { alt: 200000, r: 0,   g: 0,   b: 5   }
];

export const STAR_OP_CLASSES = ['star-op-1', 'star-op-2', 'star-op-3', 'star-op-4'];
export const STAR_OP_BREAKS = [0.6, 0.75, 0.9];

export const PIXELS_PER_METER = 0.05;
export const SKY_HORIZON_Y = 400;

export const CLOUD_VISIBLE_MIN_ALT = 2000;
export const CLOUD_FADE_FULL_ALT = 10000;
export const CLOUD_FADE_END_ALT = 30000;

export const STAR_FADE_START_ALT = 10000;
export const STAR_FADE_END_ALT = 20000;

export const EARTH_FADE_START_ALT = 10000;
export const EARTH_FADE_END_ALT = 20000;
export const EARTH_NEAR_CY = 2400;
export const EARTH_NEAR_R = 1800;
export const EARTH_MID_CY = 2200;
export const EARTH_MID_R = 1800;
export const EARTH_FAR_CY = 1600;
export const EARTH_FAR_R = 1400;
export const EARTH_FINAL_CY = 1500;
export const EARTH_FINAL_R = 1300;
export const EARTH_MID_ALT_END = 100000;
export const ATMOSPHERE_STROKE_WIDTH = 20;

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * @param {number} x
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} x
 * @returns {number}
 */
export function smoothstep(lo, hi, x) {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * @param {{r: number, g: number, b: number}} c
 * @returns {string}
 */
export function rgbStr(c) { return `rgb(${c.r},${c.g},${c.b})`; }

/**
 * @param {number} altitude
 * @returns {string}
 */
export function getSkyColor(altitude) {
  const stops = SKY_STOPS;
  if (altitude <= stops[0].alt) return rgbStr(stops[0]);
  const last = stops.length - 1;
  if (altitude >= stops[last].alt) return rgbStr(stops[last]);
  for (let i = 0; i < last; i++) {
    if (altitude < stops[i + 1].alt) {
      const t = (altitude - stops[i].alt) / (stops[i + 1].alt - stops[i].alt);
      return rgbStr({
        r: Math.round(lerp(stops[i].r, stops[i + 1].r, t)),
        g: Math.round(lerp(stops[i].g, stops[i + 1].g, t)),
        b: Math.round(lerp(stops[i].b, stops[i + 1].b, t))
      });
    }
  }
  return rgbStr(stops[last]);
}

/**
 * @param {number} altitude
 * @returns {number}
 */
export function computeCloudOpacity(altitude) {
  if (altitude < CLOUD_VISIBLE_MIN_ALT) return 0;
  if (altitude < CLOUD_FADE_FULL_ALT) return 1;
  return 1 - smoothstep(CLOUD_FADE_FULL_ALT, CLOUD_FADE_END_ALT, altitude);
}

/**
 * @param {number} altitude
 * @returns {number}
 */
export function computeStarOpacity(altitude) {
  if (altitude < STAR_FADE_START_ALT) return 0;
  if (altitude < STAR_FADE_END_ALT) return smoothstep(STAR_FADE_START_ALT, STAR_FADE_END_ALT, altitude);
  return 1;
}

/**
 * @param {number} altitude
 * @returns {{cy: number, r: number, opacity: number, atmosR: number, atmosOpacity: number}}
 */
export function computeEarthView(altitude) {
  const opacity = computeStarOpacity(altitude);

  let cy, r;
  if (altitude < EARTH_FADE_END_ALT) {
    const t = smoothstep(EARTH_FADE_START_ALT, EARTH_FADE_END_ALT, altitude);
    cy = lerp(EARTH_NEAR_CY, EARTH_MID_CY, t);
    r = EARTH_NEAR_R;
  } else if (altitude < EARTH_MID_ALT_END) {
    const t = (altitude - EARTH_FADE_END_ALT) / (EARTH_MID_ALT_END - EARTH_FADE_END_ALT);
    cy = lerp(EARTH_MID_CY, EARTH_FAR_CY, t);
    r = lerp(EARTH_MID_R, EARTH_FAR_R, t);
  } else {
    cy = EARTH_FINAL_CY;
    r = EARTH_FINAL_R;
  }

  return {
    cy,
    r,
    opacity,
    atmosR: r + ATMOSPHERE_STROKE_WIDTH,
    atmosOpacity: opacity * 0.6
  };
}

/**
 * @param {number} cloudWorldAlt
 * @param {number} altitude
 * @returns {number}
 */
export function cloudScreenY(cloudWorldAlt, altitude) {
  const relAlt = cloudWorldAlt - altitude;
  return SKY_HORIZON_Y - relAlt * PIXELS_PER_METER;
}
