import {
  GRACE_PERIOD_MS,
  SPEED_COEFFICIENT,
  FINAL_ALTITUDE,
  EXPLOSION_DELAY_MS,
  COUNTDOWN_END
} from "./config.js";

export {
  GRACE_PERIOD_MS,
  SPEED_COEFFICIENT,
  FINAL_ALTITUDE,
  EXPLOSION_DELAY_MS,
  COUNTDOWN_END
};

export const STATE = Object.freeze({
  TITLE: 'title',
  COUNTDOWN: 'countdown',
  FLYING: 'flying',
  EXPLODED: 'exploded'
});

export const COUNTDOWN_STEPS = Object.freeze([
  Object.freeze({ at: 0,    text: '3'    }),
  Object.freeze({ at: 900,  text: '2'    }),
  Object.freeze({ at: 1800, text: '1'    }),
  Object.freeze({ at: 2700, text: 'GO!', go: true })
]);

/**
 * @param {number} altitude
 * @returns {boolean}
 */
export function isVictory(altitude) {
  return altitude >= FINAL_ALTITUDE;
}

/**
 * @param {number} altitude
 * @param {number} volume
 * @param {number} threshold
 * @param {number} dt
 * @returns {number}
 */
export function gainAltitude(altitude, volume, threshold, dt) {
  if (dt <= 0) return altitude;
  if (volume <= threshold) return altitude;
  return altitude + (volume - threshold) * SPEED_COEFFICIENT * dt;
}

/**
 * @param {number} now
 * @param {number} lastTime
 * @param {number} [maxDt=0.05]
 * @returns {number}
 */
export function computeDt(now, lastTime, maxDt = 0.05) {
  const raw = (now - lastTime) / 1000;
  return raw > maxDt ? maxDt : raw < 0 ? 0 : raw;
}

/**
 * @param {number} elapsed
 * @returns {number}
 */
export function getCountdownStepIndex(elapsed) {
  if (elapsed < 0) return -1;
  for (let i = COUNTDOWN_STEPS.length - 1; i >= 0; i--) {
    if (elapsed >= COUNTDOWN_STEPS[i].at) return i;
  }
  return -1;
}

/**
 * @param {{elapsed: number, lastCountdownStep: number, now: number}} params
 * @returns {{nextState: string, transition: boolean, flyingStart?: number, stepIndex?: number, isGo?: boolean, text?: string, className?: string, shouldShowReady?: boolean, shouldShowCountdown?: boolean, shouldShowAaah?: boolean}}
 */
export function tickCountdown({ elapsed, lastCountdownStep, now }) {
  if (elapsed >= COUNTDOWN_END) {
    return {
      nextState: STATE.FLYING,
      transition: true,
      flyingStart: now,
      shouldShowReady: false,
      shouldShowCountdown: false,
      shouldShowAaah: true
    };
  }

  const stepIndex = getCountdownStepIndex(elapsed);
  if (stepIndex < 0 || stepIndex === lastCountdownStep) {
    return {
      nextState: STATE.COUNTDOWN,
      transition: false
    };
  }

  const step = COUNTDOWN_STEPS[stepIndex];
  return {
    nextState: STATE.COUNTDOWN,
    transition: true,
    stepIndex,
    isGo: !!step.go,
    text: step.text,
    className: 'countdown' + (step.go ? ' go' : ''),
    shouldShowReady: false,
    shouldShowCountdown: true
  };
}

/**
 * @param {{altitude: number, dt: number, now: number, volume: number, threshold: number, flyingStart: number}} params
 * @returns {{nextState: string, transition: boolean, altitude: number, victory: boolean, explosionStartTime: number|null}}
 */
export function tickFlying({ altitude, dt, now, volume, threshold, flyingStart }) {
  const isAbove = volume > threshold;
  const inGracePeriod = (now - flyingStart) < GRACE_PERIOD_MS;

  if (!inGracePeriod && !isAbove) {
    return {
      nextState: STATE.EXPLODED,
      transition: true,
      altitude,
      victory: false,
      explosionStartTime: now
    };
  }

  const nextAltitude = gainAltitude(altitude, volume, threshold, dt);
  if (isVictory(nextAltitude)) {
    return {
      nextState: STATE.TITLE,
      transition: true,
      altitude: FINAL_ALTITUDE,
      victory: true,
      explosionStartTime: null
    };
  }

  return {
    nextState: STATE.FLYING,
    transition: false,
    altitude: nextAltitude,
    victory: false,
    explosionStartTime: null
  };
}

/**
 * @param {{now: number, explosionStartTime: number}} params
 * @returns {{nextState: string, transition: boolean, shouldShowScore: boolean}}
 */
export function tickExploded({ now, explosionStartTime }) {
  if (now - explosionStartTime >= EXPLOSION_DELAY_MS) {
    return {
      nextState: STATE.TITLE,
      transition: true,
      shouldShowScore: true
    };
  }
  return {
    nextState: STATE.EXPLODED,
    transition: false,
    shouldShowScore: false
  };
}

/**
 * @param {number} volume
 * @param {number} threshold
 * @returns {boolean}
 */
export function shouldKeepVolumeForAltitude(volume, threshold) {
  return volume > threshold;
}
