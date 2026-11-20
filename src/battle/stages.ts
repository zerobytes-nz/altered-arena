// The ladder: 10 stages, each a fixed enemy line-up. Stage 10 is the Dragon King.
import { makeMonster, type MonsterId, type UnitDef } from './units.ts';

export interface Stage { n: number; name: string; enemies: UnitDef[] }

type Line = (MonsterId | `${MonsterId}!`)[]; // "!" = boss

const LADDER: { name: string; line: Line }[] = [
  { name: 'Lizard Marsh', line: ['lizard', 'lizard'] },
  { name: 'Drake Nest', line: ['lizard', 'drake', 'lizard'] },
  { name: 'Imp Gate', line: ['imp', 'drake', 'imp'] },
  { name: 'Serpent Steps', line: ['imp', 'medusa', 'medusa'] },
  { name: 'Brass Lamp', line: ['imp', 'jinn', 'lizard'] },
  { name: 'Drake Roost', line: ['drake', 'medusa', 'drake', 'medusa'] },
  { name: 'Ember Hall', line: ['jinn', 'dragon', 'medusa'] },
  { name: 'War Band', line: ['imp', 'jinn', 'medusa', 'drake'] },
  { name: 'Ash Peaks', line: ['dragon', 'medusa', 'jinn'] },
  { name: 'The Dragon King', line: ['medusa', 'dragon!', 'medusa'] },
];

export const STAGE_COUNT = LADDER.length;

export function stage(n: number): Stage {
  const s = LADDER[Math.max(1, Math.min(STAGE_COUNT, n)) - 1];
  return {
    n, name: s.name,
    enemies: s.line.map((m, i) => {
      const boss = m.endsWith('!');
      const id = m.replace('!', '') as MonsterId;
      return makeMonster(id, n, `e${n}:${i}`, boss ? { boss: true, name: 'Dragon King' } : {});
    }),
  };
}
