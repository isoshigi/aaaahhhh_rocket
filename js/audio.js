import {
  THRESHOLDS,
  DISPLAY_MAX,
  FFT_SIZE,
  ANALYSER_SMOOTHING,
  RMS_SMOOTHING_RATE,
  thresholdFor,
  getVolumePercent as toVolumePercent,
  getThresholdPercent as toThresholdPercent,
  computeRms,
  smoothRms
} from "./audio-data.js";

const Audio = (() => {
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let stream = null;
  let threshold = 0;
  let smoothedRms = 0;
  let lastFrameTime = 0;
  let listeners = [];
  let ticking = false;

  async function start(difficulty) {
    if (audioContext) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
      source.connect(analyser);
      dataArray = new Float32Array(analyser.fftSize);
      threshold = thresholdFor(difficulty);
      lastFrameTime = performance.now();
      return true;
    } catch (e) {
      console.error('Audio init failed', e);
      return false;
    }
  }

  function tick() {
    if (!analyser) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    analyser.getFloatTimeDomainData(dataArray);
    const rms = computeRms(dataArray);
    smoothedRms = smoothRms(smoothedRms, rms, dt, RMS_SMOOTHING_RATE);

    for (const cb of listeners) cb(smoothedRms, dt);

    requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!analyser || ticking) return;
    ticking = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(tick);
  }

  function onVolume(cb) { listeners.push(cb); }
  function getVolume() { return smoothedRms; }
  function getThreshold() { return threshold; }
  function getDisplayMax() { return DISPLAY_MAX; }
  function isActive() { return audioContext !== null; }
  function getThresholdPercent() { return toThresholdPercent(threshold); }
  function getVolumePercent() { return toVolumePercent(smoothedRms); }

  function stop() {
    ticking = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
    audioContext = null;
    analyser = null;
    stream = null;
    threshold = 0;
    smoothedRms = 0;
  }

  return {
    start, stop, startLoop, onVolume,
    getVolume, getThreshold, getThresholdPercent, getVolumePercent,
    getDisplayMax, isActive, THRESHOLDS
  };
})();

export { Audio };
