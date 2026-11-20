// A ladder run: every first win of a higher stage lets you pick 1 of 3 rewards, kept until you lose.
// Rewards change the unit cards before a fight (stats) or the fight's start (energy).
import type { UnitDef } from '../battle/units.ts';

export type Boon =
  | { kind: 'atk' | 'hp' | 'spd'; uid: string; name: string; pct: number }
  | { kind: 'charge'; pct: 0 }
  | { kind: 'rally'; pct: number };

export interface Run { at: number; boons: Boon[] }

const LS_RUN = 'altered-arena.run.v1';
export function loadRun(): Run {
  try { const r = JSON.parse(localStorage.getItem(LS_RUN) ?? 'null') as Run | null; if (r && Array.isArray(r.boons)) return r; } catch { /* none */ }
  return { at: 0, boons: [] };
}
const saveRun = (r: Run): void => { try { localStorage.setItem(LS_RUN, JSON.stringify(r)); } catch { /* private mode */ } };
export const resetRun = (): void => saveRun({ at: 0, boons: [] });

/** A win on `stage` earns a pick if it is higher than anything won this run. */
export const earnsPick = (stage: number): boolean => stage > loadRun().at;
export function addBoon(stage: number, b: Boon | null): void {
  const r = loadRun();
  r.at = Math.max(r.at, stage);
  if (b) r.boons.push(b);
  saveRun(r);
}

export const boonText = (b: Boon): string =>
  b.kind === 'atk' ? `${b.name}: +${Math.round(b.pct * 100)}% attack ⚔`
    : b.kind === 'hp' ? `${b.name}: +${Math.round(b.pct * 100)}% health ♥`
      : b.kind === 'spd' ? `${b.name}: +${Math.round(b.pct * 100)}% speed ⚡`
        : b.kind === 'charge' ? 'Whole team: abilities start 40% charged'
          : `Whole team: +${Math.round(b.pct * 100)}% attack and health`;

/** Three different rewards for this team. */
export function offers(team: UnitDef[]): Boon[] {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const u = () => pick(team);
  const all: Boon[] = [];
  const a = u(), h = u(), s = u();
  all.push({ kind: 'atk', uid: a.uid, name: a.name, pct: 0.2 });
  all.push({ kind: 'hp', uid: h.uid, name: h.name, pct: 0.25 });
  all.push({ kind: 'spd', uid: s.uid, name: s.name, pct: 0.15 });
  all.push({ kind: 'charge', pct: 0 });
  all.push({ kind: 'rally', pct: 0.08 });
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 3);
}

/** The team with this run's rewards applied, and the energy the team starts with. */
export function applyRun(team: UnitDef[]): { team: UnitDef[]; startEnergy: number } {
  const { boons } = loadRun();
  let startEnergy = 0;
  const out = team.map((d) => ({ ...d }));
  for (const b of boons) {
    if (b.kind === 'charge') { startEnergy = Math.min(80, startEnergy + 40); continue; }
    for (const d of out) {
      if (b.kind === 'rally') { d.atk = Math.round(d.atk * (1 + b.pct)); d.hp = Math.round(d.hp * (1 + b.pct)); continue; }
      if (d.uid !== b.uid) continue;
      if (b.kind === 'atk') d.atk = Math.round(d.atk * (1 + b.pct));
      if (b.kind === 'hp') d.hp = Math.round(d.hp * (1 + b.pct));
      if (b.kind === 'spd') d.spd = Math.round(d.spd * (1 + b.pct) * 100) / 100;
    }
  }
  return { team: out, startEnergy };
}

/** Boons that apply to a unit (for a ★ on its card). */
export const boonsOf = (uid: string): number => loadRun().boons.filter((b) => b.kind === 'rally' || ('uid' in b && b.uid === uid)).length;

