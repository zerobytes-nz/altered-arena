// The ladder: 10 stages, each a fixed enemy line-up. Stage 10 is the Golem King.
import { makeMonster, type MonsterId, type UnitDef } from './units.ts';

export interface Stage { n: number; name: string; enemies: UnitDef[] }

type Line = (MonsterId | `${MonsterId}!`)[]; // "!" = boss

const LADDER: { name: string; line: Line }[] = [
  { name: 'Slime Pit', line: ['slime', 'slime'] },
  { name: 'Night Wings', line: ['slime', 'bat', 'slime'] },
  { name: 'Goblin Gate', line: ['goblin', 'bat', 'goblin'] },
  { name: 'Bone Yard', line: ['goblin', 'skeleton', 'skeleton'] },
  { name: 'Orc Camp', line: ['goblin', 'orc', 'slime'] },
  { name: 'Bat Cave', line: ['bat', 'skeleton', 'bat', 'skeleton'] },
  { name: 'Stone Hall', line: ['orc', 'golem', 'skeleton'] },
  { name: 'War Band', line: ['goblin', 'orc', 'skeleton', 'bat'] },
  { name: 'Living Rock', line: ['golem', 'skeleton', 'orc'] },
  { name: 'The Golem King', line: ['skeleton', 'golem!', 'skeleton'] },
];

export const STAGE_COUNT = LADDER.length;

export function stage(n: number): Stage {
  const s = LADDER[Math.max(1, Math.min(STAGE_COUNT, n)) - 1];
  return {
    n, name: s.name,
    enemies: s.line.map((m, i) => {
      const boss = m.endsWith('!');
      const id = m.replace('!', '') as MonsterId;
      return makeMonster(id, n, `e${n}:${i}`, boss ? { boss: true, name: 'Golem King' } : {});
    }),
  };
}
