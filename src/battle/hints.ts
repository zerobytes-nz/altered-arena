// Counter hints for the team builder: what to bring against a line-up. The tips describe how the sim
// really works, and `good` lists the abilities that answer it (those bench cards get a ★).
import type { AbilityId, MonsterId, UnitDef } from './units.ts';

const MONSTER_HINTS: Record<MonsterId, { tip: string; good: AbilityId[] }> = {
  dragon: { tip: "The Dragon's Tail Sweep stuns everyone near it: keep healers in the back and freeze it with Frost Nova.", good: ['frostNova', 'mend', 'regrowth', 'aimedShot'] },
  jinn: { tip: 'The Jinn makes its allies hit harder: take it out first with Backstab or Aimed Shot.', good: ['backstab', 'aimedShot', 'flurry'] },
  medusa: { tip: 'Medusas shoot from the back row: Assassins blink to them, Snipers and Archers pick them off.', good: ['backstab', 'aimedShot', 'volley'] },
  drake: { tip: 'Drakes heal themselves when they bite: stun them with Shield Bash or Frost Nova.', good: ['shieldBash', 'frostNova', 'aimedShot'] },
  imp: { tip: 'Imps attack in a frenzy: a Warrior in front and a healer behind hold them off.', good: ['shieldBash', 'mend', 'regrowth', 'whirlwind'] },
  lizard: { tip: 'Lizards call a little one at half health: area hits (Fireball, Whirlwind, Frost Nova) catch both.', good: ['fireball', 'whirlwind', 'frostNova', 'volley'] },
};
const ORDER: MonsterId[] = ['dragon', 'jinn', 'medusa', 'drake', 'imp', 'lizard'];

export function hintsFor(enemies: UnitDef[]): { tip: string; good: Set<AbilityId> } {
  const ids = new Set(enemies.filter((e) => !e.cls).map((e) => e.art as MonsterId));
  const top = ORDER.find((id) => ids.has(id));
  if (top) return { tip: MONSTER_HINTS[top].tip, good: new Set(MONSTER_HINTS[top].good) };
  // A friend's team of heroes
  return { tip: 'Their front unit takes 20% less damage: Backstab, Aimed Shot and Volley reach the back row.', good: new Set(['backstab', 'aimedShot', 'volley', 'fireball']) };
}
