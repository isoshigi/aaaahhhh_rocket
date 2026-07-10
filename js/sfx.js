const Sfx = (() => {
  let ctx = null;

  function context() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  function countdownBeep() {
    const c = context();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  }

  function countdownGo() {
    const c = context();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 1760;
    gain.gain.setValueAtTime(0.4, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.35);
  }

  function explosion() {
    const c = context();
    const length = c.sampleRate * 0.6;
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / c.sampleRate;
      const envelope = Math.exp(-t * 8);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.6;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.6);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.8, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.6);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(c.currentTime);
    source.stop(c.currentTime + 0.6);
  }

  return { countdownBeep, countdownGo, explosion };
})();

export { Sfx };
