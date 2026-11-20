// What a battle is for: a ladder stage, a friend's team (by code) or today's daily challenge.
// The team builder, battle and result screens take a Mode and get the enemies and seed from here.
import { stage as ladderStage, STAGE_COUNT } from '../battle/stages.ts';
import type { UnitDef } from '../battle/units.ts';
import { daily } from './daily.ts';
import { decodeTeam } from './teamcode.ts';

export type Mode = { kind: 'ladder'; stage: number } | { kind: 'friend'; code: string } | { kind: 'daily'; date: string };

export interface Fight {
  mode: Mode;
  title: string;          // "STAGE 3 · IMP GATE"
  sub: string;            // under the title in battle
  enemies: UnitDef[];
  seed: number | null;    // fixed seed (daily, friend), or null for a fresh one each time
  boss: boolean;
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

export function fightFor(mode: Mode): Fight | null {
  if (mode.kind === 'ladder') {
    const st = ladderStage(mode.stage);
    return { mode, title: `STAGE ${st.n} · ${st.name.toUpperCase()}`, sub: st.name, enemies: st.enemies, seed: null, boss: st.n === STAGE_COUNT };
  }
  if (mode.kind === 'friend') {
    const enemies = decodeTeam(mode.code);
    if (!enemies) return null;
    return { mode, title: `FRIEND · ${mode.code}`, sub: "A friend's team", enemies, seed: (hash(mode.code) % 100000) + 1, boss: false };
  }
  const d = daily(mode.date);
  return { mode, title: d.name.toUpperCase(), sub: 'Same fight for everyone today', enemies: d.enemies, seed: d.seed, boss: false };
}

export const ladder = (stage: number): Mode => ({ kind: 'ladder', stage });
