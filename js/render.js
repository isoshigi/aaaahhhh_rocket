import {
  SKY_STOPS,
  PIXELS_PER_METER,
  STAR_OP_CLASSES,
  STAR_OP_BREAKS,
  getSkyColor,
  computeCloudOpacity,
  computeStarOpacity,
  computeEarthView,
  rgbStr
} from "./view.js";

import {
  CLOUD_COUNT,
  STAR_COUNT,
  RECYCLE_RANGE_M,
  RECYCLE_BEHIND_M,
  PARTICLE_POOL_SIZE,
  PARTICLE_VOLUME_THRESHOLD,
  PARTICLE_GRAVITY,
  PARTICLE_EMIT_RATE,
  EXPLOSION_PARTICLE_COUNT,
  SKY_UPDATE_INTERVAL_S
} from "./config.js";

const Render = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let svg, cloudGroup, starGroup, earthGroup, particleGroup, rocketGroup, skyRect, atmosphereGroup;

  let cloudBaseX, cloudWorldAlts, cloudNodes;
  let starNodes;
  let earthCircle, earthAtmosphere;
  let rocketVisible = true;

  let particlePool, activeParticles;

  let lastSkyUpdate = -1;
  let lastSkyColor = '';

  function init() {
    svg = document.getElementById('world');
    cloudGroup = document.getElementById('clouds');
    starGroup = document.getElementById('stars');
    earthGroup = document.getElementById('earth');
    particleGroup = document.getElementById('particles');
    rocketGroup = document.getElementById('rocket');
    skyRect = document.getElementById('sky');
    atmosphereGroup = document.getElementById('atmosphere');

    cloudBaseX = new Float32Array(CLOUD_COUNT);
    cloudWorldAlts = new Float32Array(CLOUD_COUNT);
    cloudNodes = [];

    starNodes = [];

    particlePool = [];
    activeParticles = [];

    initClouds();
    initStars();
    initEarth();
    initAtmosphere();
    initRocket();
    initParticlePool();
  }

  function initClouds() {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const g = document.createElementNS(SVG_NS, 'g');
      const w = 60 + Math.random() * 100;
      const h = 22 + Math.random() * 18;

      const cloud = document.createElementNS(SVG_NS, 'g');
      const numBumps = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numBumps; j++) {
        const c = document.createElementNS(SVG_NS, 'ellipse');
        c.setAttribute('cx', (j - (numBumps - 1) / 2) * (w * 0.28));
        c.setAttribute('cy', (Math.random() - 0.5) * h * 0.3);
        c.setAttribute('rx', w * (0.22 + Math.random() * 0.12));
        c.setAttribute('ry', h * (0.4 + Math.random() * 0.2));
        c.setAttribute('fill', 'rgba(255,255,255,0.92)');
        cloud.appendChild(c);
      }
      g.appendChild(cloud);
      cloudGroup.appendChild(g);
      cloudNodes.push(g);
      cloudBaseX[i] = Math.random() * 1100 - 50;
      cloudWorldAlts[i] = (Math.random() - 0.5) * 600;
    }
  }

  function initStars() {
    for (let i = 0; i < STAR_COUNT; i++) {
      const star = document.createElementNS(SVG_NS, 'circle');
      const r = 0.6 + Math.random() * 1.8;
      const baseOp = 0.5 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      const offset = Math.random() * 5;

      star.setAttribute('r', r);
      star.setAttribute('cx', Math.random() * 1000);
      star.setAttribute('cy', Math.random() * 800);

      const hue = Math.random();
      star.setAttribute('fill', hue < 0.2 ? '#ffe9c4' : hue < 0.35 ? '#c4d9ff' : '#ffffff');

      const opClass = baseOp < STAR_OP_BREAKS[0] ? STAR_OP_CLASSES[0]
                    : baseOp < STAR_OP_BREAKS[1] ? STAR_OP_CLASSES[1]
                    : baseOp < STAR_OP_BREAKS[2] ? STAR_OP_CLASSES[2]
                    : STAR_OP_CLASSES[3];
      star.classList.add('star-twinkle', opClass);
      star.style.setProperty('--twinkle-dur', speed.toFixed(2) + 's');
      star.style.setProperty('--twinkle-delay', (-offset).toFixed(2) + 's');

      starGroup.appendChild(star);
      starNodes.push(star);
    }
  }

  function initEarth() {
    earthCircle = document.createElementNS(SVG_NS, 'circle');
    earthCircle.setAttribute('cx', 500);
    earthCircle.setAttribute('cy', 2400);
    earthCircle.setAttribute('r', 1800);
    earthCircle.setAttribute('fill', 'url(#earth-grad)');
    earthCircle.style.opacity = '0';
    earthGroup.appendChild(earthCircle);
  }

  function initAtmosphere() {
    earthAtmosphere = document.createElementNS(SVG_NS, 'circle');
    earthAtmosphere.setAttribute('cx', 500);
    earthAtmosphere.setAttribute('cy', 2400);
    earthAtmosphere.setAttribute('r', 1820);
    earthAtmosphere.setAttribute('fill', 'none');
    earthAtmosphere.setAttribute('stroke', 'rgba(100,180,255,0.5)');
    earthAtmosphere.setAttribute('stroke-width', '20');
    earthAtmosphere.style.opacity = '0';
    atmosphereGroup.appendChild(earthAtmosphere);
  }

  function initRocket() {
    rocketGroup.innerHTML = '';
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'rocket-body');

    const finL = document.createElementNS(SVG_NS, 'path');
    finL.setAttribute('d', 'M -22,12 L -38,32 L -22,32 Z');
    finL.setAttribute('fill', '#dc2626');
    finL.setAttribute('stroke', '#1a1a1a');
    finL.setAttribute('stroke-width', '1.5');
    finL.setAttribute('stroke-linejoin', 'round');
    body.appendChild(finL);

    const finR = document.createElementNS(SVG_NS, 'path');
    finR.setAttribute('d', 'M 22,12 L 38,32 L 22,32 Z');
    finR.setAttribute('fill', '#dc2626');
    finR.setAttribute('stroke', '#1a1a1a');
    finR.setAttribute('stroke-width', '1.5');
    finR.setAttribute('stroke-linejoin', 'round');
    body.appendChild(finR);

    const hull = document.createElementNS(SVG_NS, 'path');
    hull.setAttribute('d', 'M -22,-40 L 22,-40 L 26,30 L -26,30 Z');
    hull.setAttribute('fill', '#f5f5f5');
    hull.setAttribute('stroke', '#1a1a1a');
    hull.setAttribute('stroke-width', '2');
    hull.setAttribute('stroke-linejoin', 'round');
    body.appendChild(hull);

    const stripe = document.createElementNS(SVG_NS, 'rect');
    stripe.setAttribute('x', -22);
    stripe.setAttribute('y', 0);
    stripe.setAttribute('width', 44);
    stripe.setAttribute('height', 5);
    stripe.setAttribute('fill', '#dc2626');
    body.appendChild(stripe);

    const nose = document.createElementNS(SVG_NS, 'path');
    nose.setAttribute('d', 'M -22,-40 L 0,-66 L 22,-40 Z');
    nose.setAttribute('fill', '#dc2626');
    nose.setAttribute('stroke', '#1a1a1a');
    nose.setAttribute('stroke-width', '2');
    nose.setAttribute('stroke-linejoin', 'round');
    body.appendChild(nose);

    const winFrame = document.createElementNS(SVG_NS, 'circle');
    winFrame.setAttribute('cx', 0);
    winFrame.setAttribute('cy', -12);
    winFrame.setAttribute('r', 9);
    winFrame.setAttribute('fill', '#1a1a1a');
    body.appendChild(winFrame);

    const win = document.createElementNS(SVG_NS, 'circle');
    win.setAttribute('cx', 0);
    win.setAttribute('cy', -12);
    win.setAttribute('r', 7);
    win.setAttribute('fill', '#60a5fa');
    win.setAttribute('stroke', '#93c5fd');
    win.setAttribute('stroke-width', '1');
    body.appendChild(win);

    const winHi = document.createElementNS(SVG_NS, 'circle');
    winHi.setAttribute('cx', -2);
    winHi.setAttribute('cy', -14);
    winHi.setAttribute('r', 2);
    winHi.setAttribute('fill', 'rgba(255,255,255,0.7)');
    body.appendChild(winHi);

    rocketGroup.appendChild(body);
  }

  function initParticlePool() {
    particleGroup.innerHTML = '';
    particlePool = [];
    activeParticles = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.style.display = 'none';
      particleGroup.appendChild(circle);
      particlePool.push(circle);
    }
  }

  function showRocket(show) {
    rocketVisible = show;
    rocketGroup.style.opacity = show ? '1' : '0';
    rocketGroup.classList.toggle('paused', !show);
  }

  function update(state) {
    const { altitude, dt, time, volume, hasExploded } = state;

    updateSky(altitude, time);
    updateClouds(altitude);
    updateStarGroupOpacity(altitude);
    updateEarth(altitude);
    updateParticles(dt, volume, hasExploded);
  }

  function updateStarGroupOpacity(altitude) {
    const opacity = computeStarOpacity(altitude);
    starGroup.style.opacity = opacity.toFixed(3);
  }

  function updateSky(altitude, time) {
    if (time - lastSkyUpdate < SKY_UPDATE_INTERVAL_S) return;
    lastSkyUpdate = time;
    const color = getSkyColor(altitude);
    if (color !== lastSkyColor) {
      skyRect.style.fill = color;
      lastSkyColor = color;
    }
  }

  function updateClouds(altitude) {
    const cloudOpacity = computeCloudOpacity(altitude);
    cloudGroup.style.opacity = cloudOpacity.toFixed(3);

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const relAlt = cloudWorldAlts[i] - altitude;
      const screenY = 400 - relAlt * PIXELS_PER_METER;
      cloudNodes[i].setAttribute('transform', `translate(${cloudBaseX[i]},${screenY})`);

      if (relAlt < -RECYCLE_RANGE_M) {
        cloudWorldAlts[i] = altitude + RECYCLE_RANGE_M + Math.random() * 4000;
        cloudBaseX[i] = Math.random() * 1100 - 50;
      } else if (relAlt > RECYCLE_BEHIND_M) {
        cloudWorldAlts[i] = altitude - RECYCLE_RANGE_M - Math.random() * 4000;
        cloudBaseX[i] = Math.random() * 1100 - 50;
      }
    }
  }

  function updateEarth(altitude) {
    const v = computeEarthView(altitude);
    const cyStr = v.cy.toFixed(1);
    const rStr = v.r.toFixed(1);
    earthCircle.setAttribute('cy', cyStr);
    earthCircle.setAttribute('r', rStr);
    earthCircle.style.opacity = v.opacity.toFixed(3);
    earthAtmosphere.setAttribute('cy', cyStr);
    earthAtmosphere.setAttribute('r', v.atmosR.toFixed(1));
    earthAtmosphere.style.opacity = v.atmosOpacity.toFixed(3);
  }

  function acquireNode() {
    return particlePool.length > 0 ? particlePool.pop() : null;
  }

  function releaseNode(node) {
    node.style.display = 'none';
    particlePool.push(node);
  }

  function emitParticle(volume) {
    const node = acquireNode();
    if (!node) return;

    const p = {
      x: (Math.random() - 0.5) * 28,
      y: 32 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 25,
      vy: 60 + Math.random() * 80 + volume * 100,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.6,
      size: 4 + Math.random() * 6 + volume * 8,
      node: node
    };

    node.style.display = '';
    node.setAttribute('cx', p.x.toFixed(1));
    node.setAttribute('cy', p.y.toFixed(1));
    node.setAttribute('r', p.size.toFixed(1));
    node.setAttribute('fill', Math.random() < 0.55
      ? `hsl(${30 + Math.random() * 20}, 100%, 60%)`
      : 'rgba(180,180,180,0.7)');

    activeParticles.push(p);
  }

  function emitExplosion() {
    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const node = acquireNode();
      if (!node) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      const p = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.8,
        size: 3 + Math.random() * 5,
        node: node
      };

      node.style.display = '';
      node.setAttribute('cx', p.x.toFixed(1));
      node.setAttribute('cy', p.y.toFixed(1));
      node.setAttribute('r', p.size.toFixed(1));
      node.setAttribute('fill', Math.random() < 0.5 ? 'hsl(20, 100%, 60%)' : 'hsl(50, 100%, 70%)');

      activeParticles.push(p);
    }
  }

  function updateParticles(dt, volume, hasExploded) {
    if (!hasExploded && volume > PARTICLE_VOLUME_THRESHOLD) {
      if (Math.random() < volume * PARTICLE_EMIT_RATE * dt) {
        emitParticle(volume);
      }
    }

    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        releaseNode(p.node);
        activeParticles[i] = activeParticles[activeParticles.length - 1];
        activeParticles.pop();
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += PARTICLE_GRAVITY * dt;

      const t = p.life / p.maxLife;
      p.node.setAttribute('cx', p.x.toFixed(1));
      p.node.setAttribute('cy', p.y.toFixed(1));
      p.node.setAttribute('r', (p.size * (1 + t * 1.5)).toFixed(1));
      p.node.setAttribute('opacity', (1 - t).toFixed(3));
    }
  }

  function triggerExplosion() {
    showRocket(false);
    emitExplosion();
  }

  function clearAll() {
    for (const p of activeParticles) releaseNode(p.node);
    activeParticles = [];
  }

  function reset() {
    clearAll();
    showRocket(true);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      cloudWorldAlts[i] = (Math.random() - 0.5) * 6000;
      cloudBaseX[i] = Math.random() * 1100 - 50;
    }
    skyRect.style.fill = rgbStr(SKY_STOPS[0]);
    cloudGroup.style.opacity = '0';
    earthCircle.style.opacity = '0';
    earthAtmosphere.style.opacity = '0';
    starGroup.style.opacity = '0';
    lastSkyUpdate = -1;
    lastSkyColor = '';
  }

  return { init, update, reset, triggerExplosion, showRocket };
})();

export { Render };
