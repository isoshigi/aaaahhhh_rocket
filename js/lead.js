const LEADS = Object.freeze([
  '叫べ。止まったら爆散する。',
  '声を限りに叫べ。ロケットは君の声で飛ぶ。',
  '静寂は爆死への片道切符だ。',
  '叫び続けろ。命が続く限り。',
  '黙るな。黙れば終わる。',
  '声が燃料だ。切らすな。',
  '叫びが足りないと、ロケットは落ちる。',
  'お前の絶叫で、宇宙へ届け。',
]);

/** @returns {void} */
export function setRandomLead() {
  const el = document.querySelector('.lead');
  if (!el) return;
  el.textContent = LEADS[Math.floor(Math.random() * LEADS.length)];
}
