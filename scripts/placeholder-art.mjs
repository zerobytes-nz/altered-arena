// Original placeholder art for Altered Arena (MIT, same as the code).
// Each drawer paints ONE frame in logical units (frame size × displayScale);
// gen-placeholders.mjs scales it up to the real pixel size in the manifest.
// Keys must match assets.manifest.json. Everything here is deterministic (no Math.random),
// so CI can check that the committed PNGs match the generator byte for byte.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
function limb(c, x, y, ang, len, wid, col) {
  c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; rr(c, -wid / 2, 0, wid, len, wid / 2); c.restore();
}
function outline(c, col = 'rgba(10,6,20,0.85)', w = 3) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function shadow(c, w, ground, rx = 26) { c.fillStyle = 'rgba(0,0,0,0.28)'; ellipse(c, w / 2, ground + 2, rx, 6); }

// ───────────────────────────── Units ─────────────────────────────

// Placeholder looks for the monsters are stand-ins (slime body for the lizard, bat for the drake, golem for the dragon).
const UNITS = {
  warrior: { kind: 'humanoid', body: '#5b7bb5', head: '#f0c9a0', limb: '#3d4f7a', accent: '#e0b030', eye: '#1b2233', weapon: 'sword', shield: '#8a9bb5', helm: '#aab6cc' },
  ranger: { kind: 'humanoid', body: '#3f7d3f', head: '#e8b98e', limb: '#2c5a2c', accent: '#a7d36b', eye: '#1b2233', weapon: 'bow', hood: '#2f6a32' },
  mage: { kind: 'humanoid', body: '#7a3fb5', head: '#f0c9a0', limb: '#55287f', accent: '#ff8a3d', eye: '#1b2233', weapon: 'staff', hat: '#5a2a8f', orb: '#ff8a3d' },
  healer: { kind: 'humanoid', body: '#e8e4d8', head: '#f3cfa8', limb: '#b8b2a0', accent: '#4cc9a0', eye: '#1b2233', weapon: 'staff', orb: '#7dffcf', halo: true },
  rogue: { kind: 'humanoid', body: '#2b2d42', head: '#d9a77c', limb: '#1e2033', accent: '#e63946', eye: '#f1f1f1', weapon: 'daggers', mask: '#e63946' },
  imp: { kind: 'humanoid', body: '#7a5a30', head: '#7fbf4f', limb: '#5d8f3a', accent: '#c9a050', eye: '#ffde59', weapon: 'club', ears: true, small: true },
  medusa: { kind: 'humanoid', body: '#d8d4c4', head: '#ece8da', limb: '#c4bfac', accent: '#6b6455', eye: '#ff4d4d', weapon: 'bow', bones: true },
  jinn: { kind: 'humanoid', body: '#6b4a3a', head: '#5f8f4a', limb: '#4f7a3c', accent: '#b03a2e', eye: '#ffde59', weapon: 'axe', tusks: true, big: true },
  lizard: { kind: 'slime', body: '#4cd16b', dark: '#2c9a48', eye: '#0e2a14' },
  drake: { kind: 'bat', body: '#4a3a6b', wing: '#6b4f9a', eye: '#ffde59' },
  dragon: { kind: 'golem', body: '#8a8478', dark: '#5f5a50', accent: '#6fd3ff', eye: '#6fd3ff' },
};

const POSES = {
  idle: (i, n) => { const t = Math.sin((i / n) * TAU); return { bob: t * 1.5, lean: 0, armA: 0.25 + t * 0.05, armB: -0.2, legA: 0.06, legB: -0.06, swing: 0, squash: 1 + t * 0.03 }; },
  walk: (i, n) => { const t = Math.sin((i / n) * TAU); return { bob: -Math.abs(t) * 3, lean: 0.06, armA: -t * 0.6, armB: t * 0.6, legA: t * 0.55, legB: -t * 0.55, swing: 0, squash: 1 + Math.abs(t) * 0.06 }; },
  // hit lands on frame 3: 0–2 wind up, 3 strike, 4–5 recover
  attack: (i) => {
    const k = [0.3, 0.7, 1, -1, -0.6, -0.2][i];
    return { bob: 0, lean: k < 0 ? 0.2 : -0.12 * k, armA: k > 0 ? -2.4 * k : 1.3 * -k + 0.2, armB: -0.3, legA: 0.2, legB: -0.25, swing: k, squash: k < 0 ? 0.92 : 1 + 0.05 * k, strike: i === 3 };
  },
  hurt: (i) => ({ bob: 0, lean: i === 0 ? -0.35 : -0.15, armA: 0.9, armB: 0.6, legA: 0.25, legB: -0.1, swing: 0, squash: i === 0 ? 0.9 : 0.96, hurt: true }),
  dead: (i, n) => { const t = i / (n - 1); return { bob: 0, lean: 0, armA: 1.2, armB: 1.4, legA: 0.3, legB: -0.1, swing: 0, squash: 1, fall: Math.min(1, t * 1.3), dead: true }; },
};

function weapon(c, u, p) {
  const s = p.strike;
  if (u.weapon === 'sword') {
    c.fillStyle = '#d9e2f0'; rr(c, -3, 18, 6, 34, 2); c.fillStyle = u.accent; rr(c, -8, 16, 16, 5, 2); c.fillStyle = '#6b4a2a'; rr(c, -2.5, 8, 5, 9, 2);
    if (s) { c.fillStyle = 'rgba(255,255,255,0.5)'; rr(c, -5, 18, 10, 38, 4); }
  } else if (u.weapon === 'axe') {
    c.fillStyle = '#6b4a2a'; rr(c, -3, 6, 6, 44, 2); c.fillStyle = '#b8c0cc'; c.beginPath(); c.moveTo(2, 34); c.quadraticCurveTo(22, 40, 18, 54); c.lineTo(2, 48); c.fill();
  } else if (u.weapon === 'club') {
    c.fillStyle = '#8a5a2a'; c.beginPath(); c.moveTo(-2, 6); c.lineTo(2, 6); c.lineTo(7, 34); c.lineTo(-7, 34); c.fill(); circle(c, 0, 34, 7);
  } else if (u.weapon === 'staff') {
    c.fillStyle = '#7a5530'; rr(c, -2.5, -26, 5, 64, 2);
    c.fillStyle = u.orb; circle(c, 0, -28, s ? 9 : 6);
    if (s || p.swing > 0.6) { c.fillStyle = 'rgba(255,255,255,0.55)'; circle(c, 0, -28, s ? 14 : 9); }
  } else if (u.weapon === 'daggers') {
    c.fillStyle = '#cfd6e6'; c.beginPath(); c.moveTo(-3, 16); c.lineTo(3, 16); c.lineTo(0, 36); c.fill(); c.fillStyle = u.accent; rr(c, -5, 13, 10, 4, 2);
  }
}

function bow(c, u, p) {
  // Held out in front at chest height, drawn back during the wind-up.
  const draw = p.swing > 0 ? p.swing : 0;
  c.save(); c.translate(16, -56);
  c.strokeStyle = u.bones ? '#8a8270' : '#8a5a2a'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.arc(-6, 0, 20, -1.15, 1.15); c.stroke();
  c.strokeStyle = 'rgba(240,240,240,0.9)'; c.lineWidth = 1.5;
  const sx = 2 - 14 * draw, top = [-6 + 20 * Math.cos(-1.15), 20 * Math.sin(-1.15)], bot = [top[0], -top[1]];
  c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(sx, 0); c.lineTo(bot[0], bot[1]); c.stroke();
  if (draw > 0.2) { c.fillStyle = '#d9cfa8'; rr(c, sx, -1.5, 26, 3, 1); c.fillStyle = '#e0e0e0'; c.beginPath(); c.moveTo(sx + 26, -4); c.lineTo(sx + 32, 0); c.lineTo(sx + 26, 4); c.fill(); }
  c.restore();
}

function humanoid(c, u, p, w, h) {
  const ground = h - 10;
  const k = u.big ? 1.15 : u.small ? 0.82 : 1;
  if (!p.dead || p.fall < 1) shadow(c, w, ground, 24 * k);
  c.save();
  c.translate(w / 2, ground);
  if (p.dead) { c.translate(34 * p.fall, 0); c.rotate(-p.fall * 1.45); c.scale(1 - 0.18 * p.fall, 1 - 0.18 * p.fall); }
  c.scale(k, k * p.squash);
  c.translate(0, p.bob);
  c.rotate(p.lean);
  outline(c);
  // back arm + leg
  limb(c, -4, -30, p.legB, 30, 10, u.limb);
  limb(c, -6, -58, p.armB + 0.15, 24, 8, u.limb);
  if (u.shield) { c.save(); c.translate(-14, -46); c.fillStyle = u.shield; rr(c, -9, -14, 18, 26, 6); c.fillStyle = u.accent; circle(c, 0, -1, 3.5); c.restore(); }
  // torso
  c.fillStyle = u.body; rr(c, -13, -66, 26, 38, 8);
  if (u.bones) { c.fillStyle = '#7a7466'; for (let r = 0; r < 3; r++) rr(c, -9, -58 + r * 8, 18, 3, 1.5); }
  c.fillStyle = u.accent; c.fillRect(-13, -38, 26, 5);
  // legs (front)
  limb(c, 4, -30, p.legA, 30, 10, u.limb);
  // head
  const hy = -80;
  c.fillStyle = u.head; circle(c, 1, hy, 15);
  if (u.helm) { c.fillStyle = u.helm; c.beginPath(); c.arc(1, hy, 16, Math.PI, 0); c.fill(); c.fillRect(-15, hy - 2, 32, 5); c.fillStyle = u.accent; c.fillRect(-1, hy - 24, 5, 9); }
  if (u.hood) { c.fillStyle = u.hood; c.beginPath(); c.arc(-1, hy - 1, 17, Math.PI * 0.95, Math.PI * 2.05); c.fill(); c.beginPath(); c.moveTo(-16, hy); c.lineTo(-22, hy + 10); c.lineTo(-10, hy + 4); c.fill(); }
  if (u.hat) { c.fillStyle = u.hat; c.beginPath(); c.moveTo(-18, hy - 8); c.lineTo(22, hy - 8); c.lineTo(-2, hy - 40); c.fill(); c.fillStyle = u.accent; c.fillRect(-12, hy - 12, 26, 4); }
  if (u.halo) { c.strokeStyle = '#ffe58a'; c.lineWidth = 3; c.beginPath(); c.ellipse(1, hy - 21, 12, 4, 0, 0, TAU); c.stroke(); outline(c); }
  if (u.mask) { c.fillStyle = u.mask; c.fillRect(-14, hy - 4, 30, 6); c.fillRect(-22, hy - 4, 9, 3); }
  if (u.ears) { c.fillStyle = u.head; c.beginPath(); c.moveTo(-12, hy - 4); c.lineTo(-28, hy - 12); c.lineTo(-11, hy + 4); c.fill(); }
  if (u.tusks) { c.fillStyle = '#f5f0dc'; c.beginPath(); c.moveTo(8, hy + 8); c.lineTo(11, hy + 1); c.lineTo(13, hy + 9); c.fill(); }
  if (u.bones) { c.fillStyle = '#2a2620'; circle(c, 9, hy - 2, 4); c.fillRect(3, hy + 7, 10, 2); }
  // eye
  c.fillStyle = u.eye;
  if (p.dead && p.fall > 0.6) { c.fillRect(6, hy - 2, 8, 2); c.fillRect(9, hy - 5, 2, 8); }
  else if (p.hurt) { c.fillRect(6, hy - 1, 8, 2.5); }
  else c.fillRect(8, hy - 4, 5, u.bones ? 4 : 5);
  // front arm + weapon
  c.save(); c.translate(6, -58); c.rotate(p.armA);
  c.fillStyle = u.limb; rr(c, -4, 0, 8, 24, 4);
  if (u.weapon !== 'bow') { c.translate(0, 22); c.rotate(-0.25); weapon(c, u, p); }
  c.restore();
  if (u.weapon === 'bow') bow(c, u, p);
  if (u.weapon === 'daggers') { c.save(); c.translate(-6, -58); c.rotate(p.armB + 0.15); c.translate(0, 22); weapon(c, u, p); c.restore(); }
  c.restore();
}

function slime(c, u, p, w, h, i, anim) {
  const ground = h - 10;
  shadow(c, w, ground, 30);
  let sx = 1, sy = 1, dx = 0;
  if (anim === 'idle') { const t = Math.sin((i / 4) * TAU); sx = 1 + t * 0.06; sy = 1 - t * 0.06; }
  if (anim === 'walk') { const t = Math.sin((i / 6) * TAU); sx = 1 - t * 0.12; sy = 1 + t * 0.14; }
  if (anim === 'attack') { const k = [0.3, 0.6, 1, -1, -0.5, -0.1][i]; sx = k > 0 ? 1 + 0.15 * k : 1.25; sy = k > 0 ? 1 - 0.2 * k : 0.85; dx = k < 0 ? 16 * -k : -6 * k; }
  if (anim === 'hurt') { sx = 1.2; sy = 0.8; dx = -6; }
  if (anim === 'dead') { const t = i / 5; sx = 1 + t * 0.7; sy = 1 - t * 0.8; }
  c.save(); c.translate(w / 2 + dx, ground); c.scale(sx, sy); outline(c);
  c.fillStyle = u.dark; c.beginPath(); c.moveTo(-32, 0); c.quadraticCurveTo(-34, -46, 0, -50); c.quadraticCurveTo(34, -46, 32, 0); c.closePath(); c.fill();
  c.fillStyle = u.body; c.beginPath(); c.moveTo(-28, -3); c.quadraticCurveTo(-30, -42, 0, -46); c.quadraticCurveTo(30, -42, 28, -3); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(c, -10, -32, 7, 4);
  c.fillStyle = u.eye;
  if (anim === 'dead' && i >= 3) { c.fillRect(4, -26, 8, 2); c.fillRect(16, -26, 8, 2); } else { circle(c, 8, -24, 3.5); circle(c, 20, -24, 3.5); }
  c.restore();
}

function bat(c, u, p, w, h, i, anim) {
  const ground = h - 10;
  let fy = -46, flap = Math.sin((i / (anim === 'walk' ? 6 : 4)) * TAU), rot = 0, dx = 0;
  if (anim === 'attack') { const k = [0.3, 0.6, 1, -1, -0.5, -0.1][i]; dx = k < 0 ? 20 * -k : -8 * k; fy += k < 0 ? 14 * -k : -6 * k; flap = k; }
  if (anim === 'hurt') { dx = -8; rot = -0.4; flap = 0.8; }
  if (anim === 'dead') { const t = i / 5; fy = lerp(-46, -10, Math.min(1, t * 1.4)); rot = t * 2.6; flap = 0.2; }
  c.fillStyle = 'rgba(0,0,0,0.22)'; ellipse(c, w / 2 + dx, ground + 2, 18, 4);
  c.save(); c.translate(w / 2 + dx, ground + fy); c.rotate(rot); outline(c);
  for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1); c.rotate(-flap * 0.5);
    c.fillStyle = u.wing; c.beginPath(); c.moveTo(6, -4); c.quadraticCurveTo(26, -30, 46, -14); c.quadraticCurveTo(38, -6, 40, 4); c.quadraticCurveTo(30, -2, 26, 8); c.quadraticCurveTo(18, 0, 6, 6); c.closePath(); c.fill();
    c.restore();
  }
  c.fillStyle = u.body; ellipse(c, 0, 0, 14, 16);
  c.beginPath(); c.moveTo(-10, -12); c.lineTo(-6, -26); c.lineTo(-2, -12); c.fill(); c.beginPath(); c.moveTo(2, -12); c.lineTo(6, -26); c.lineTo(10, -12); c.fill();
  c.fillStyle = u.eye; if (anim === 'dead' && i > 2) { c.fillRect(-1, -4, 10, 2); } else { circle(c, 2, -4, 2.5); circle(c, 9, -4, 2.5); }
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(2, 6); c.lineTo(4, 11); c.lineTo(6, 6); c.fill();
  c.restore();
}

function golem(c, u, p, w, h, i, anim) {
  const ground = h - 8;
  shadow(c, w, ground, 34);
  c.save(); c.translate(w / 2, ground);
  if (p.dead) { c.translate(40 * p.fall, 0); c.rotate(-p.fall * 1.4); c.scale(1 - 0.25 * p.fall, 1 - 0.25 * p.fall); }
  c.translate(0, p.bob); c.rotate(p.lean * 0.6); outline(c);
  const stone = (x, y, ww, hh, col = u.body) => { c.fillStyle = col; rr(c, x, y, ww, hh, 6); c.strokeStyle = 'rgba(10,6,20,0.55)'; c.lineWidth = 2; c.stroke(); };
  limb(c, -12, -34, p.legB, 32, 16, u.dark);
  c.save(); c.translate(-22, -76); c.rotate(p.armB + 0.15); stone(-9, 0, 18, 40, u.dark); c.restore();
  stone(-28, -94, 56, 62);
  c.fillStyle = u.accent; circle(c, 4, -64, 6);
  stone(-16, -116, 34, 26, u.body);
  c.fillStyle = u.eye; if (p.dead && p.fall > 0.6) c.fillRect(4, -104, 10, 2); else { c.fillRect(2, -106, 6, 4); c.fillRect(11, -106, 5, 4); }
  limb(c, 10, -34, p.legA, 32, 16, u.body);
  c.save(); c.translate(24, -78); c.rotate(p.armA * 0.8); stone(-10, 0, 20, 42, u.body); stone(-12, 36, 24, 18, u.dark); c.restore();
  c.restore();
}

function unit(id, anim) {
  const u = UNITS[id];
  return (c, w, h, i, n) => {
    const p = POSES[anim](i, n);
    if (u.kind === 'humanoid') humanoid(c, u, p, w, h);
    else if (u.kind === 'slime') slime(c, u, p, w, h, i, anim);
    else if (u.kind === 'bat') bat(c, u, p, w, h, i, anim);
    else golem(c, u, p, w, h, i, anim);
  };
}

// ───────────────────────────── Cards, icons, UI ─────────────────────────────

const CARD = {
  common: { edge: '#8b93a8', mid: '#5a6178', dark: '#2a2e3c', gem: '#c8cfe0' },
  rare: { edge: '#5cc8ff', mid: '#2c6fb5', dark: '#122a4a', gem: '#9fe8ff' },
  epic: { edge: '#c58bff', mid: '#7a3fc5', dark: '#2a1248', gem: '#e5c8ff' },
  legendary: { edge: '#ffd66b', mid: '#c08a1e', dark: '#3a2808', gem: '#fff1b8' },
};

function card(r) {
  return (c, w, h) => {
    const p = CARD[r];
    c.fillStyle = p.dark; rr(c, 0, 0, w, h, 16);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.edge); g.addColorStop(1, p.mid);
    c.fillStyle = g; rr(c, 3, 3, w - 6, h - 6, 14);
    c.fillStyle = p.dark; rr(c, 10, 10, w - 20, h - 20, 10);
    // art window
    const wg = c.createLinearGradient(0, 14, 0, 150); wg.addColorStop(0, 'rgba(255,255,255,0.10)'); wg.addColorStop(1, 'rgba(255,255,255,0.02)');
    c.fillStyle = wg; rr(c, 16, 16, w - 32, 136, 8);
    c.strokeStyle = p.edge; c.lineWidth = 2; c.beginPath(); c.roundRect(16, 16, w - 32, 136, 8); c.stroke();
    // name banner
    c.fillStyle = p.mid; rr(c, 8, 156, w - 16, 30, 6);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(12, 159, w - 24, 3);
    // gems in the corners, more for rarer cards
    const gems = { common: 0, rare: 1, epic: 2, legendary: 3 }[r];
    c.fillStyle = p.gem;
    for (let k = 0; k <= gems; k++) { const x = w / 2 + (k - gems / 2) * 18; c.beginPath(); c.moveTo(x, h - 16); c.lineTo(x + 6, h - 10); c.lineTo(x, h - 4); c.lineTo(x - 6, h - 10); c.fill(); }
    if (r === 'legendary') {
      c.fillStyle = p.edge;
      for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) circle(c, x, y, 7);
      c.fillStyle = p.gem; for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) circle(c, x, y, 3);
    }
  };
}

const ICON_COL = { warrior: '#5b7bb5', ranger: '#3f7d3f', mage: '#7a3fb5', healer: '#2a9d8f', rogue: '#b02a3a' };
function icon(id) {
  return (c, w, h) => {
    c.fillStyle = 'rgba(10,6,20,0.9)'; circle(c, w / 2, h / 2, w / 2);
    c.fillStyle = ICON_COL[id]; circle(c, w / 2, h / 2, w / 2 - 3);
    c.save(); c.translate(w / 2, h / 2); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineCap = 'round';
    if (id === 'warrior') { c.rotate(0.785); rr(c, -2.5, -15, 5, 22, 2); c.fillRect(-8, 5, 16, 4); rr(c, -2, 9, 4, 7, 2); }
    if (id === 'ranger') { c.lineWidth = 3; c.beginPath(); c.arc(-4, 0, 13, -1.2, 1.2); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(1, -12); c.lineTo(1, 12); c.stroke(); c.fillRect(-12, -1, 22, 2); c.beginPath(); c.moveTo(14, 0); c.lineTo(8, -5); c.lineTo(8, 5); c.fill(); }
    if (id === 'mage') { c.beginPath(); c.moveTo(0, -15); c.quadraticCurveTo(12, 0, 6, 10); c.quadraticCurveTo(0, 16, -6, 10); c.quadraticCurveTo(-12, 0, 0, -15); c.fill(); c.fillStyle = ICON_COL.mage; circle(c, 0, 6, 4); }
    if (id === 'healer') { c.fillRect(-4, -13, 8, 26); c.fillRect(-13, -4, 26, 8); }
    if (id === 'rogue') { c.rotate(-0.6); c.beginPath(); c.moveTo(0, -16); c.lineTo(5, 4); c.lineTo(-5, 4); c.fill(); c.fillRect(-8, 4, 16, 3); rr(c, -2, 7, 4, 8, 2); }
    c.restore();
  };
}

function slot(c, w, h) {
  c.fillStyle = 'rgba(255,255,255,0.04)'; rr(c, 4, 4, w - 8, h - 8, 14);
  c.strokeStyle = 'rgba(190,170,255,0.55)'; c.lineWidth = 3; c.setLineDash([12, 9]);
  c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 14); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(190,170,255,0.55)'; rr(c, w / 2 - 3, h / 2 - 22, 6, 44, 3); rr(c, w / 2 - 22, h / 2 - 3, 44, 6, 3);
}

// ───────────────────────────── Effects ─────────────────────────────

function slash(c, w, h, i, n) {
  const t = (i + 1) / n;
  c.save(); c.translate(w / 2, h / 2); c.rotate(-0.6 + t * 0.5);
  c.strokeStyle = `rgba(255,255,255,${1 - t * 0.7})`; c.lineCap = 'round';
  c.lineWidth = 10 * (1 - t * 0.6); c.beginPath(); c.arc(0, 0, 18 + t * 22, -1.2, 1.0); c.stroke();
  c.strokeStyle = `rgba(255,240,180,${0.8 - t * 0.6})`; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 12 + t * 18, -1.0, 0.8); c.stroke();
  c.restore();
}

function explosion(c, w, h, i, n) {
  const t = (i + 1) / n, cx = w / 2, cy = h / 2;
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, 20 + t * 40);
  g.addColorStop(0, `rgba(255,250,210,${1 - t})`); g.addColorStop(0.4, `rgba(255,160,60,${0.95 - t * 0.7})`); g.addColorStop(1, 'rgba(200,40,20,0)');
  c.fillStyle = g; circle(c, cx, cy, 20 + t * 40);
  const r = rng(7);
  c.fillStyle = `rgba(255,200,90,${1 - t})`;
  for (let k = 0; k < 10; k++) { const a = r() * TAU, d = (14 + r() * 20) + t * 30; circle(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 * (1 - t) + 1); }
}

function heal(c, w, h, i, n) {
  const t = (i + 1) / n, cx = w / 2;
  const g = c.createRadialGradient(cx, h * 0.6, 0, cx, h * 0.6, 40);
  g.addColorStop(0, `rgba(125,255,207,${0.6 * (1 - t)})`); g.addColorStop(1, 'rgba(125,255,207,0)');
  c.fillStyle = g; circle(c, cx, h * 0.6, 40);
  const r = rng(11);
  for (let k = 0; k < 6; k++) {
    const x = cx + (r() - 0.5) * 60, y = h * 0.85 - ((r() * 0.4 + t) % 1) * 70, s = 4 + r() * 3;
    c.fillStyle = `rgba(200,255,230,${1 - t * 0.8})`; c.fillRect(x - s / 3, y - s, (s * 2) / 3, s * 2); c.fillRect(x - s, y - s / 3, s * 2, (s * 2) / 3);
  }
}

function stun(c, w, h, i, n) {
  const cx = w / 2, cy = h / 2;
  c.strokeStyle = 'rgba(255,230,120,0.5)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, 18, 6, 0, 0, TAU); c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = (i / n) * TAU + (k * TAU) / 3, x = cx + Math.cos(a) * 18, y = cy + Math.sin(a) * 6;
    c.fillStyle = '#ffe066'; c.beginPath();
    for (let j = 0; j < 10; j++) { const rr2 = j % 2 ? 2.5 : 6, b = (j * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(b) * rr2, y + Math.sin(b) * rr2); }
    c.fill();
  }
}

function arrow(c, w, h) {
  c.fillStyle = '#d9cfa8'; rr(c, 6, h / 2 - 1.5, w - 18, 3, 1);
  c.fillStyle = '#e8e8f0'; c.beginPath(); c.moveTo(w - 14, h / 2 - 5); c.lineTo(w - 2, h / 2); c.lineTo(w - 14, h / 2 + 5); c.fill();
  c.fillStyle = '#e63946'; c.beginPath(); c.moveTo(2, h / 2 - 6); c.lineTo(12, h / 2); c.lineTo(2, h / 2 + 6); c.lineTo(6, h / 2); c.fill();
}

function orb(c, w, h) {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; circle(c, w / 2, h / 2, w / 2);
}

function ring(c, w, h) {
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 12; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 12, 0, TAU); c.stroke();
}

// ───────────────────────────── Arena ─────────────────────────────

function arena(c, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d0f1f'); g.addColorStop(0.45, '#2a1d38'); g.addColorStop(0.55, '#221d3a'); g.addColorStop(1, '#0f1426');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // stone tiles on the floor
  const r = rng(3), top = 150, bottom = 1060, tile = 60;
  for (let y = top; y < bottom; y += tile) {
    const off = ((y - top) / tile) % 2 ? tile / 2 : 0;
    for (let x = -tile + off; x < w + tile; x += tile) {
      const v = Math.floor(r() * 14);
      c.fillStyle = `rgba(${120 + v},${110 + v},${150 + v},0.07)`;
      rr(c, x + 3, y + 3, tile - 6, tile - 6, 6);
    }
  }
  // arena circle + centre line
  c.strokeStyle = 'rgba(200,180,255,0.14)'; c.lineWidth = 6;
  c.beginPath(); c.ellipse(w / 2, (top + bottom) / 2, w * 0.42, (bottom - top) * 0.44, 0, 0, TAU); c.stroke();
  c.setLineDash([18, 14]); c.lineWidth = 3; c.beginPath(); c.moveTo(30, (top + bottom) / 2); c.lineTo(w - 30, (top + bottom) / 2); c.stroke(); c.setLineDash([]);
  // team tints: red for the enemy half, blue for yours
  const t1 = c.createLinearGradient(0, top, 0, top + 300); t1.addColorStop(0, 'rgba(230,57,70,0.18)'); t1.addColorStop(1, 'rgba(230,57,70,0)');
  c.fillStyle = t1; c.fillRect(0, top, w, 300);
  const t2 = c.createLinearGradient(0, bottom - 300, 0, bottom); t2.addColorStop(0, 'rgba(76,201,240,0)'); t2.addColorStop(1, 'rgba(76,201,240,0.18)');
  c.fillStyle = t2; c.fillRect(0, bottom - 300, w, 300);
  // walls
  c.fillStyle = '#140b18'; c.fillRect(0, 0, w, top - 10);
  for (let x = 0; x < w; x += 48) { c.fillStyle = `rgba(90,60,110,${0.25 + (x / 48) % 2 * 0.1})`; rr(c, x + 2, top - 46, 44, 34, 4); }
  c.fillStyle = '#0b0f1c'; c.fillRect(0, bottom + 10, w, h - bottom);
  // torches
  for (const x of [60, w - 60]) {
    const tg = c.createRadialGradient(x, top - 70, 0, x, top - 70, 70);
    tg.addColorStop(0, 'rgba(255,170,80,0.45)'); tg.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = tg; circle(c, x, top - 70, 70);
    c.fillStyle = '#ffb347'; circle(c, x, top - 72, 7); c.fillStyle = '#5a3a2a'; c.fillRect(x - 3, top - 66, 6, 20);
  }
}

// ───────────────────────────── Registry ─────────────────────────────

export const drawers = {};
for (const id of Object.keys(UNITS)) for (const a of Object.keys(POSES)) drawers[`unit.${id}.${a}`] = unit(id, a);
for (const r of Object.keys(CARD)) drawers[`card.${r}`] = card(r);
for (const id of Object.keys(ICON_COL)) drawers[`ui.icon.${id}`] = icon(id);
Object.assign(drawers, {
  'ui.slot': slot,
  'fx.slash': slash, 'fx.explosion': explosion, 'fx.heal': heal, 'fx.stun': stun,
  'fx.arrow': arrow, 'fx.orb': orb, 'fx.ring': ring,
  'fx.dot': (c, w, h) => { c.fillStyle = '#fff'; circle(c, w / 2, h / 2, w / 2); },
  'fx.px': (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); },
  'bg.arena': arena,
});
