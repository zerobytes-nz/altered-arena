// Balance check: runs every guest team of 3 (and a few NFT-style teams) against every ladder stage,
// many seeds each, and prints win rates and battle lengths. No browser needed.
//   npm run sim            (all guest teams)
//   npm run sim -- --seeds 200
// Node runs the game's own TypeScript (src/battle/) directly (type stripping, Node ≥ 22.18).
import { simulate } from '../src/battle/sim.ts';
import { stage, STAGE_COUNT } from '../src/battle/stages.ts';
import { GUEST_UNITS, makeUnit, CLASS_IDS } from '../src/battle/units.ts';

const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 60;
const teams = [];
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++)
  teams.push({ name: [a, b, c].map((i) => CLASS_IDS[i].slice(0, 4)).join('+'), units: [GUEST_UNITS[a], GUEST_UNITS[b], GUEST_UNITS[c]] });
const col = { id: '0xabc', name: 'Test Apes' };
teams.push({ name: 'RARE war+rang+heal', units: ['warrior', 'ranger', 'healer'].map((c, i) => makeUnit(c, 'Rare', { uid: `r${i}` })) });
teams.push({ name: 'EPIC war+mage+heal', units: ['warrior', 'mage', 'healer'].map((c, i) => makeUnit(c, 'Epic', { uid: `e${i}` })) });
teams.push({ name: 'RARE x3 collection', units: ['warrior', 'ranger', 'healer'].map((c, i) => makeUnit(c, 'Rare', { uid: `c${i}`, collection: col })) });
teams.push({ name: 'LEG war+mage+heal', units: ['warrior', 'mage', 'healer'].map((c, i) => makeUnit(c, 'Legendary', { uid: `l${i}` })) });

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('team', 22)}${Array.from({ length: STAGE_COUNT }, (_, i) => pad(`S${i + 1}`, 9)).join('')}   (win% / avg s)`);
const timeAll = [];
for (const t of teams) {
  let row = pad(t.name, 22);
  for (let s = 1; s <= STAGE_COUNT; s++) {
    const st = stage(s);
    let w = 0, time = 0;
    for (let k = 0; k < seeds; k++) { const r = simulate(t.units, st.enemies, k + 1); if (r.result === 'win') w++; time += r.time; }
    timeAll.push(time / seeds);
    row += pad(`${Math.round((100 * w) / seeds)}/${(time / seeds).toFixed(0)}`, 9);
  }
  console.log(row);
}
timeAll.sort((a, b) => a - b);
console.log(`\nbattle length: median ${timeAll[timeAll.length >> 1].toFixed(1)} s, min ${timeAll[0].toFixed(1)}, max ${timeAll.at(-1).toFixed(1)}\n`);
