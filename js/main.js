import {
  STATE,
  FINAL_ALTITUDE,
  computeDt,
  tickCountdown,
  tickFlying,
  tickExploded
} from "./game.js";
import { generateAaaah, getAaaahTier } from "./aaah.js";
import { Storage } from "./storage.js";
import { Audio } from "./audio.js";
import { Render } from "./render.js";
import { setRandomLead } from "./lead.js";
import { Sfx } from "./sfx.js";

(() => {
  let state = STATE.TITLE;
  let altitude = 0;
  let difficulty = 'medium';
  let lastTime = 0;
  let totalTime = 0;
  let explosionStartTime = 0;
  let countdownStart = 0;
  let flyingStart = 0;
  let lastCountdownStep = -1;
  let lastTier = 0;

  let titleEl, gameEl, scoreEl;
  let titleBestEl, titleVolumeEl, titleThresholdEl, titleWarningEl;
  let gameVolumeEl, gameThresholdEl, altitudeTextEl, aaahEl;
  let readyHintEl, countdownEl;
  let finalAltitudeEl, finalDifficultyEl, bestAltitudeEl, historyListEl;
  let btnRetry, btnTitle, micTestBtn;
  let gameContainer;

  function init() {
    titleEl = document.getElementById('screen-title');
    gameEl = document.getElementById('screen-game');
    scoreEl = document.getElementById('screen-score');
    gameContainer = gameEl;

    titleBestEl = document.getElementById('title-best');
    titleVolumeEl = document.getElementById('title-volume');
    titleThresholdEl = document.getElementById('title-threshold-mark');
    titleWarningEl = document.getElementById('mic-warning');

    gameVolumeEl = document.getElementById('game-volume');
    gameThresholdEl = document.getElementById('game-threshold-mark');
    altitudeTextEl = document.getElementById('altitude-text');
    aaahEl = document.getElementById('aaah-overlay');
    readyHintEl = document.getElementById('ready-hint');
    countdownEl = document.getElementById('countdown-overlay');

    finalAltitudeEl = document.getElementById('final-altitude');
    finalDifficultyEl = document.getElementById('final-difficulty');
    bestAltitudeEl = document.getElementById('best-altitude');
    historyListEl = document.getElementById('history-list');

    btnRetry = document.getElementById('btn-retry');
    btnTitle = document.getElementById('btn-title');
    micTestBtn = document.getElementById('mic-test-btn');

    Render.init();

    micTestBtn.addEventListener('click', testMic);
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => startGame(btn.dataset.difficulty));
    });
    btnRetry.addEventListener('click', retryGame);
    btnTitle.addEventListener('click', backToTitle);

    Audio.onVolume(() => {
      const pct = Audio.getVolumePercent();
      if (titleVolumeEl) titleVolumeEl.style.width = pct + '%';
      if (gameVolumeEl) gameVolumeEl.style.width = pct + '%';
    });

    setRandomLead();
    refreshTitleBest();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function refreshTitleBest() {
    const data = Storage.load();
    titleBestEl.textContent = Storage.formatAltitude(data.best);
  }

  function showScreen(name) {
    titleEl.style.display = name === 'title' ? 'flex' : 'none';
    gameEl.style.display = name === 'game' ? 'block' : 'none';
    scoreEl.style.display = name === 'score' ? 'flex' : 'none';
  }

  async function testMic() {
    if (Audio.isActive()) return;
    const ok = await Audio.start('medium');
    if (!ok) {
      titleWarningEl.classList.remove('hidden');
      return;
    }
    titleWarningEl.classList.add('hidden');
    Audio.startLoop();
    if (titleThresholdEl) titleThresholdEl.style.left = Audio.getThresholdPercent() + '%';
    micTestBtn.classList.add('active');
    micTestBtn.textContent = '🎤 テスト中...';
  }

  async function startGame(diff) {
    if (state === STATE.FLYING || state === STATE.COUNTDOWN) return;
    difficulty = diff;
    const ok = await Audio.start(difficulty);
    if (!ok) {
      titleWarningEl.classList.remove('hidden');
      return;
    }
    titleWarningEl.classList.add('hidden');
    Audio.startLoop();
    if (titleThresholdEl) titleThresholdEl.style.left = Audio.getThresholdPercent() + '%';
    if (gameThresholdEl) gameThresholdEl.style.left = Audio.getThresholdPercent() + '%';

    altitude = 0;
    totalTime = 0;
    lastTier = 0;
    lastCountdownStep = -1;
    countdownStart = performance.now();
    Render.reset();
    Render.update({
      altitude: 0,
      dt: 0,
      time: 0,
      volume: 0,
      hasExploded: false
    });
    aaahEl.textContent = 'AAAAHHHH!!!!';
    aaahEl.className = 'aaah tier-1';
    aaahEl.style.display = 'none';
    readyHintEl.style.display = 'block';
    countdownEl.style.display = 'none';
    state = STATE.COUNTDOWN;
    showScreen('game');
  }

  function retryGame() {
    Audio.stop();
    startGame(difficulty);
  }

  function backToTitle() {
    Audio.stop();
    state = STATE.TITLE;
    setRandomLead();
    refreshTitleBest();
    micTestBtn.classList.remove('active');
    micTestBtn.textContent = '🎤 マイクをテスト';
    showScreen('title');
  }

  function loop(now) {
    const dt = computeDt(now, lastTime);
    lastTime = now;
    totalTime += dt;

    if (state === STATE.COUNTDOWN) {
      updateCountdown(dt, now);
    } else if (state === STATE.FLYING) {
      updateFlying(dt, now);
    } else if (state === STATE.EXPLODED) {
      updateExploded(dt, now);
    } else {
      Render.update({
        altitude: 0,
        dt,
        time: totalTime,
        volume: Audio.getVolume(),
        hasExploded: false
      });
    }

    requestAnimationFrame(loop);
  }

  function updateCountdown(dt, now) {
    const volume = Audio.getVolume();
    const r = tickCountdown({ elapsed: now - countdownStart, lastCountdownStep, now });

    if (r.transition && r.nextState === STATE.FLYING) {
      readyHintEl.style.display = 'none';
      countdownEl.style.display = 'none';
      aaahEl.style.display = 'block';
      flyingStart = r.flyingStart;
    } else if (r.transition && r.stepIndex !== undefined) {
      lastCountdownStep = r.stepIndex;
      countdownEl.textContent = r.text;
      countdownEl.className = r.className;
      countdownEl.style.display = 'block';
      readyHintEl.style.display = 'none';
      if (r.isGo) {
        Sfx.countdownGo();
      } else {
        Sfx.countdownBeep();
      }
    }
    state = r.nextState;

    Render.update({
      altitude: 0,
      dt,
      time: totalTime,
      volume,
      hasExploded: false
    });
  }

  function updateFlying(dt, now) {
    const volume = Audio.getVolume();
    const threshold = Audio.getThreshold();
    const r = tickFlying({ altitude, dt, now, volume, threshold, flyingStart });

    if (r.transition && r.nextState === STATE.EXPLODED) {
      altitude = r.altitude;
      explosionStartTime = r.explosionStartTime;
      triggerExplosion();
    } else if (r.transition && r.victory) {
      altitude = r.altitude;
      showVictory();
    } else {
      altitude = r.altitude;
      updateAaaah();
      Render.update({
        altitude,
        dt,
        time: totalTime,
        volume,
        hasExploded: false
      });
      altitudeTextEl.textContent = Storage.formatAltitude(altitude);
    }
    state = r.nextState;
  }

  function updateAaaah() {
    const text = generateAaaah(altitude);
    const tier = getAaaahTier(altitude);
    if (aaahEl.textContent !== text) aaahEl.textContent = text;
    if (tier !== lastTier) {
      aaahEl.className = 'aaah tier-' + tier;
      lastTier = tier;
    }
  }

  function triggerExplosion() {
    Sfx.explosion();
    Render.triggerExplosion();
    gameEl.classList.add('shake');
    gameEl.classList.add('flash');
    setTimeout(() => {
      gameEl.classList.remove('shake');
      gameEl.classList.remove('flash');
    }, 500);
  }

  function updateExploded(dt, now) {
    const volume = Audio.getVolume();
    Render.update({
      altitude,
      dt,
      time: totalTime,
      volume,
      hasExploded: true
    });
    const r = tickExploded({ now, explosionStartTime });
    if (r.transition && r.shouldShowScore) {
      showScore();
    }
    state = r.nextState;
  }

  function showVictory() {
    Audio.stop();
    const data = Storage.save({
      altitude: FINAL_ALTITUDE,
      difficulty
    });
    finalAltitudeEl.textContent = Storage.formatAltitude(FINAL_ALTITUDE) + ' 🎉';
    finalDifficultyEl.textContent = '難易度: ' + Storage.DIFFICULTY_LABELS[difficulty] + ' (到達!)';
    bestAltitudeEl.textContent = Storage.formatAltitude(data.best);
    renderHistory(data.history);
    showScreen('score');
    state = STATE.TITLE;
  }

  function showScore() {
    Audio.stop();
    const data = Storage.save({
      altitude,
      difficulty
    });
    finalAltitudeEl.textContent = Storage.formatAltitude(altitude);
    finalDifficultyEl.textContent = '難易度: ' + Storage.DIFFICULTY_LABELS[difficulty];
    bestAltitudeEl.textContent = Storage.formatAltitude(data.best);
    renderHistory(data.history);
    showScreen('score');
    state = STATE.TITLE;
  }

  function renderHistory(history) {
    historyListEl.innerHTML = '';
    if (!history || history.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'まだ記録なし';
      historyListEl.appendChild(li);
      return;
    }
    history.forEach((h, i) => {
      const li = document.createElement('li');

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = (i + 1) + '.';

      const alt = document.createElement('span');
      alt.className = 'alt';
      alt.textContent = Storage.formatAltitude(h.altitude);

      const meta = document.createElement('span');
      meta.className = 'meta';

      const diffTag = document.createElement('span');
      diffTag.className = 'diff-tag';
      diffTag.textContent = h.difficulty;

      meta.appendChild(diffTag);
      meta.appendChild(document.createTextNode(Storage.formatDate(h.date)));

      li.appendChild(rank);
      li.appendChild(alt);
      li.appendChild(meta);
      historyListEl.appendChild(li);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
