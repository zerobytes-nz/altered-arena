// The daily challenge: one line-up per day (UTC), the same for everyone, with a fixed battle seed, so the
// same team and the same taps give the same fight. Your best result of the day is kept and can be shared.
import { makeMonster, type MonsterId, type UnitDef } from '../battle/units.ts';
import { rng } from '../battle/sim.ts';

export interface Daily { date: string; name: string; seed: number; enemies: UnitDef[] }
export interface DailyBest { date: string; stars: number; time: number }

const LS_DAILY = 'altered-arena.daily.v1';
const POOL: MonsterId[] = ['lizard', 'drake', 'imp', 'medusa', 'jinn', 'dragon'];

export const today = (): string => new Date().toISOString().slice(0, 10);

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

export function daily(date = today()): Daily {
  const seed = hash(`altered-arena:${date}`);
  const r = rng(seed);
  const n = r() < 0.4 ? 4 : 3;
  const level = 5 + Math.floor(r() * 4); // like stages 5–8
  const line: MonsterId[] = [];
  while (line.length < n) {
    const m = POOL[Math.floor(r() * POOL.length)];
    if (m === 'dragon' && (line.includes('dragon') || n === 4)) continue; // one dragon, and not in a crowd
    line.push(m);
  }
  const d = new Date(`${date}T00:00:00Z`);
  const name = `Daily · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  return { date, name, seed: (seed % 100000) + 1, enemies: line.map((m, i) => makeMonster(m, level, `d${i}`)) };
}

export function loadBest(): DailyBest | null {
  try { const b = JSON.parse(localStorage.getItem(LS_DAILY) ?? 'null') as DailyBest | null; return b && b.date === today() ? b : null; } catch { return null; }
}
/** Keep the better result (more stars, then faster). Returns true if this was a new best. */
export function recordDaily(stars: number, time: number): boolean {
  const b = loadBest();
  if (b && (b.stars > stars || (b.stars === stars && b.time <= time))) return false;
  try { localStorage.setItem(LS_DAILY, JSON.stringify({ date: today(), stars, time })); } catch { /* private mode */ }
  return true;
}

export const shareText = (b: DailyBest): string =>
  `Altered Arena daily ${b.date}: ${b.stars ? '★'.repeat(b.stars) + '☆'.repeat(3 - b.stars) : 'lost'}${b.stars ? ` in ${b.time.toFixed(0)} s` : ''}`;
