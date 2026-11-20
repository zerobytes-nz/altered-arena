// Packs the downloaded art packs into every licensed file the manifest expects, in one go.
//
//   npm run assets:pack-arena -- [folder]      (default: art-src/, which is gitignored)
//
// Unzip each pack into its own sub-folder of that folder first (any folder names; the packs are found by
// their contents). Packs used (download them yourself, see PLAN.md → Art; none of these files may be committed):
//   CraftPix Free RPG Monster Sprites Pixel Art     → monsters (lizard, drake, imp, medusa, jinn, dragon)
//   CraftPix Knight Characters Free Sprite          → Warrior (silver), Ranger (bronze), Rogue (black)
//   CraftPix Wizard Character Free Sprite           → Mage (fire wizard), Healer (purple wizard), Frost Mage (ice wizard)
//   Batareya Pixel Art CCG-like Frames              → card frames
//   Free Pixel Magic Sprite Effects Pack            → slash, explosion, heal, stun effects
//
// Units: every animation is scaled with ONE scale per character (so it doesn't change size between
// animations) and placed so its feet (the middle of the lowest pixels) stand at the frame's centre, 10 px
// above the bottom. The cartoon heroes' animations each come on a different canvas size, so the feet are found
// per animation; the pixel-art monsters share one canvas, so their idle feet are used for every animation.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadManifest, PUBLIC_DIR, ROOT } from './lib/assets.mjs';

const SRC = path.resolve(process.argv[2] ?? path.join(ROOT, 'art-src'));
const m = loadManifest();
const asset = (key) => m.assets.find((a) => a.key === key) ?? die(`manifest has no ${key}`);
function die(msg) { console.error(msg); process.exit(1); }

/** All files under SRC (skipping macOS junk), relative paths with forward slashes. */
const ALL = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '__MACOSX' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.png$/i.test(e.name) && fs.statSync(p).size > 0) ALL.push(p);
  }
})(SRC);
const find = (re) => ALL.filter((f) => re.test(f.split(path.sep).join('/')));
const lastNum = (f) => Number((path.basename(f).match(/(\d+)(?!.*\d)/) ?? [0, 0])[1]);
const byNum = (fs_) => [...fs_].sort((a, b) => lastNum(a) - lastNum(b));

/** Pick `n` frames: sampled evenly when there are more, repeated when there are fewer. */
const sample = (files, n) => Array.from({ length: n }, (_, i) => files[Math.min(files.length - 1, Math.round((i * (files.length - 1)) / Math.max(1, n - 1)))]);

const cache = new Map();
async function img(f) { if (!cache.has(f)) cache.set(f, await loadImage(fs.readFileSync(f))); return cache.get(f); }
function pixels(im) { const c = createCanvas(im.width, im.height).getContext('2d'); c.drawImage(im, 0, 0); return c.getImageData(0, 0, im.width, im.height).data; }

/** Union of the visible pixels of some frames, and the feet: the mean x of the visible pixels in the lowest 12%. */
async function measure(files) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  const ims = await Promise.all(files.map(img));
  const data = ims.map(pixels);
  ims.forEach((im, k) => {
    const d = data[k];
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  });
  const band = Math.max(2, Math.round((y1 - y0) * 0.12));
  let sx = 0, n = 0;
  ims.forEach((im, k) => {
    const d = data[k];
    for (let y = y1 - band; y <= y1; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 8) { sx += x; n++; }
  });
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, feetX: n ? sx / n : (x0 + x1) / 2, bottom: y1 };
}

const written = [];
function save(a, canvas) {
  const out = path.join(PUBLIC_DIR, m.roots.licensed, a.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  written.push(path.relative(ROOT, out));
}

/** Draw frames into a manifest strip: feet at (frame centre, frameHeight − 10), one scale for all. */
async function strip(a, files, { scale, feetX, bottom, pixel }) {
  const vis = await measure(files); // visible area, to report anything that doesn't fit
  const cv = createCanvas(a.width, a.height), c = cv.getContext('2d');
  c.imageSmoothingEnabled = !pixel; c.imageSmoothingQuality = 'high';
  const frames = sample(files, a.frameCount);
  let clipped = 0;
  for (const [i, f] of frames.entries()) {
    const im = await img(f);
    const dx = i * a.frameWidth + Math.round(a.frameWidth / 2 - feetX * scale);
    const dy = Math.round(a.frameHeight - 10 - (bottom + 1) * scale);
    if (dx + vis.x0 * scale < i * a.frameWidth - 1 || dx + (vis.x1 + 1) * scale > (i + 1) * a.frameWidth + 1 || dy + vis.y0 * scale < -1) clipped++;
    c.save(); c.beginPath(); c.rect(i * a.frameWidth, 0, a.frameWidth, a.frameHeight); c.clip();
    c.drawImage(im, dx, dy, Math.round(im.width * scale), Math.round(im.height * scale));
    c.restore();
  }
  save(a, cv);
  return clipped;
}

const ANIMS = ['idle', 'walk', 'attack', 'hurt', 'dead'];
const notes = [];

// ── Heroes (cartoon packs, smooth scaling) ─────────────────────────────────
// [pack folder, idle height in game pixels]; the halberd and spear make those two taller.
const HEROES = {
  warrior: ['silver_knight', 108], ranger: ['bronze_knight', 128], rogue: ['black_knight', 124],
  mage: ['wizard_fire', 110], healer: ['wizard', 106], frostmage: ['wizard_ice', 110],
};
const HERO_ANIM = { idle: 'IDLE', walk: 'WALK', attack: 'ATTACK', hurt: 'HURT', dead: 'DIE' };
for (const [cls, [folder, height]] of Object.entries(HEROES)) {
  const of = (anim) => byNum(find(new RegExp(`/PNG/${folder}/[^/]*${HERO_ANIM[anim]}_\\d+\\.png$`, 'i')));
  const idle = of('idle');
  if (!idle.length) { notes.push(`skipped ${cls}: no PNG/${folder}/…IDLE_*.png found`); continue; }
  const scale = height / (await measure(idle)).h;
  for (const anim of ANIMS) {
    const files = of(anim);
    if (!files.length) { notes.push(`skipped unit.${cls}.${anim}: no ${HERO_ANIM[anim]} frames`); continue; }
    const mm = await measure(files);
    const clipped = await strip(asset(`unit.${cls}.${anim}`), files, { scale, feetX: mm.feetX, bottom: mm.bottom, pixel: false });
    if (clipped) notes.push(`unit.${cls}.${anim}: ${clipped} frame(s) don't fit the frame (edges cut)`);
  }
}

// ── Monsters (pixel art, nearest-neighbour) ────────────────────────────────
// [pack folder, scale]. Whole numbers keep pixels square; the others are as big as the tallest animation allows.
const MONSTERS = { lizard: ['lizard', 2], drake: ['small_dragon', 2], imp: ['demon', 1.25], medusa: ['medusa', 1.5], jinn: ['jinn_animation', 1.5], dragon: ['dragon', 1.15] };
const MON_ANIM = { idle: 'Idle', walk: 'Walk', attack: 'Attack', hurt: 'Hurt', dead: 'Death' };
for (const [id, [folder, scale]] of Object.entries(MONSTERS)) {
  const of = (anim) => byNum(find(new RegExp(`/PNG/${folder}/${MON_ANIM[anim]}\\d+\\.png$`)));
  const idle = of('idle');
  if (!idle.length) { notes.push(`skipped ${id}: no PNG/${folder}/Idle*.png found`); continue; }
  const feet = await measure(idle);
  for (const anim of ANIMS) {
    // The jinn floats: it has no Walk, so it drifts on its Flight frames.
    const files = of(anim).length ? of(anim) : anim === 'walk' ? byNum(find(new RegExp(`/PNG/${folder}/Flight\\d+\\.png$`))) : [];
    if (!files.length) { notes.push(`skipped unit.${id}.${anim}: no ${MON_ANIM[anim]} frames`); continue; }
    const clipped = await strip(asset(`unit.${id}.${anim}`), files, { scale, feetX: feet.feetX, bottom: feet.bottom, pixel: true });
    if (clipped) notes.push(`unit.${id}.${anim}: ${clipped} frame(s) don't fit the frame (edges cut)`);
  }
}

// ── Card frames (Batareya, 64×96 → 3×, tinted per rarity) ─────────────────
const CARDS = { common: [1, null], rare: [11, [140, 205, 255]], epic: [25, [205, 160, 255]], legendary: [10, null] };
for (const [r, [n, tint]] of Object.entries(CARDS)) {
  const f = find(new RegExp(`/base ${n}\\.png$`))[0];
  if (!f) { notes.push(`skipped card.${r}: Batareya "base ${n}.png" not found (or empty)`); continue; }
  const a = asset(`card.${r}`), im = await img(f);
  const cv = createCanvas(a.width, a.height), c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(im, 0, 0, a.width, a.height);
  if (tint) { // multiply the metal towards the rarity colour, keep transparency
    const d = c.getImageData(0, 0, a.width, a.height);
    for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.round((d.data[i + k] * tint[k]) / 255);
    c.putImageData(d, 0, 0);
  }
  save(a, cv);
}

// ── Effects (Free Pixel Magic Sprite Effects, 72×72 frames in a strip) ────
// The pack's slash (3_2) is a solid white beam that hides the fighters, so fx.slash stays on our own art.
const FX = { 'fx.explosion': '9', 'fx.heal': '5', 'fx.stun': '2' };
for (const [key, name] of Object.entries(FX)) {
  const f = find(new RegExp(`/1 Magic/${name}\\.png$`))[0];
  if (!f) { notes.push(`skipped ${key}: "1 Magic/${name}.png" not found`); continue; }
  const a = asset(key), im = await img(f), n = Math.floor(im.width / 72);
  const cv = createCanvas(a.width, a.height), c = cv.getContext('2d');
  const k = a.frameWidth / 72;
  c.imageSmoothingEnabled = k < 1;
  sample([...Array(n).keys()], a.frameCount).forEach((src, i) => c.drawImage(im, src * 72, 0, 72, 72, i * a.frameWidth, 0, a.frameWidth, a.frameHeight));
  save(a, cv);
}

console.log(`Wrote ${written.length} files to ${m.roots.licensed}/ (gitignored) from ${path.relative(ROOT, SRC) || SRC}.`);
for (const n of notes) console.log('  note: ' + n);
