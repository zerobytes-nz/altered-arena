// Units: the classes a unit-card AWI can be, the monsters of the ladder, and how rarity and
// collections change their stats. Pure data + functions (no Phaser), shared by the game and `npm run sim`.

export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_COLOR: Record<Rarity, number> = { Common: 0xb8c2e0, Rare: 0x4cc9f0, Epic: 0xb084ff, Legendary: 0xffc94d };
/** Health and attack multiplier per tier. */
export const RARITY_STAT: Record<Rarity, number> = { Common: 1, Rare: 1.15, Epic: 1.32, Legendary: 1.55 };
/** Ability strength multiplier per tier. */
export const RARITY_POWER: Record<Rarity, number> = { Common: 1, Rare: 1.1, Epic: 1.22, Legendary: 1.4 };

export type ClassId = 'warrior' | 'ranger' | 'mage' | 'healer' | 'rogue';
export type MonsterId = 'slime' | 'bat' | 'goblin' | 'skeleton' | 'orc' | 'golem';
export type AbilityId = 'shieldBash' | 'volley' | 'fireball' | 'mend' | 'backstab' | 'drain' | 'frenzy' | 'warcry' | 'slam' | 'split'
  | 'whirlwind' | 'aimedShot' | 'frostNova' | 'regrowth' | 'flurry';

/** Scales every unit's health: sets how long battles last (about 20–30 s) without changing who wins. */
export const HP_SCALE = 2;

export const CLASS_IDS: ClassId[] = ['warrior', 'ranger', 'mage', 'healer', 'rogue'];

interface Base { name: string; role: string; hp: number; atk: number; spd: number; range: number; move: number; ability: AbilityId | null; size?: number }

/** spd = attacks per second. range in arena pixels (melee ≈ 70). move in px/s. */
export const CLASSES: Record<ClassId, Base> = {
  warrior: { name: 'Warrior', role: 'Tank', hp: 620, atk: 30, spd: 0.85, range: 70, move: 95, ability: 'shieldBash' },
  ranger: { name: 'Ranger', role: 'Ranged', hp: 340, atk: 30, spd: 1.15, range: 330, move: 90, ability: 'volley' },
  mage: { name: 'Mage', role: 'Area damage', hp: 300, atk: 40, spd: 0.7, range: 300, move: 85, ability: 'fireball' },
  healer: { name: 'Healer', role: 'Support', hp: 360, atk: 18, spd: 0.9, range: 280, move: 85, ability: 'mend' },
  rogue: { name: 'Rogue', role: 'Assassin', hp: 380, atk: 36, spd: 1.35, range: 70, move: 125, ability: 'backstab' },
};

export const MONSTERS: Record<MonsterId, Base> = {
  slime: { name: 'Slime', role: 'Brawler', hp: 300, atk: 18, spd: 0.8, range: 65, move: 70, ability: 'split' },
  bat: { name: 'Bat', role: 'Diver', hp: 200, atk: 18, spd: 1.4, range: 60, move: 150, ability: 'drain' },
  goblin: { name: 'Goblin', role: 'Brawler', hp: 300, atk: 24, spd: 1.1, range: 65, move: 110, ability: 'frenzy' },
  skeleton: { name: 'Skeleton', role: 'Archer', hp: 260, atk: 24, spd: 1.0, range: 320, move: 80, ability: 'volley' },
  orc: { name: 'Orc', role: 'Bruiser', hp: 560, atk: 34, spd: 0.8, range: 72, move: 85, ability: 'warcry', size: 1.1 },
  golem: { name: 'Golem', role: 'Tank', hp: 820, atk: 32, spd: 0.6, range: 80, move: 60, ability: 'slam', size: 1.15 },
};

export const ABILITIES: Record<AbilityId, { name: string; text: string }> = {
  shieldBash: { name: 'Shield Bash', text: 'Hits hard and stuns the target.' },
  volley: { name: 'Volley', text: 'Fires a spray of arrows at random enemies.' },
  fireball: { name: 'Fireball', text: 'Explodes on the target, burning everyone near it.' },
  mend: { name: 'Mend', text: 'Heals the most hurt ally. Legendary heals the whole team.' },
  backstab: { name: 'Backstab', text: 'Blinks behind the weakest enemy and strikes.' },
  drain: { name: 'Drain', text: 'Bites and heals itself.' },
  frenzy: { name: 'Frenzy', text: 'Attacks much faster for a few seconds.' },
  warcry: { name: 'War Cry', text: 'All allies hit harder for a few seconds.' },
  slam: { name: 'Ground Slam', text: 'Damages and stuns everything around it.' },
  split: { name: 'Split', text: 'Spawns a small slime once.' },
  whirlwind: { name: 'Whirlwind', text: 'Spins and hits every enemy around it.' },
  aimedShot: { name: 'Aimed Shot', text: 'One huge shot at the weakest enemy.' },
  frostNova: { name: 'Frost Nova', text: 'Damages and freezes enemies around the target.' },
  regrowth: { name: 'Regrowth', text: 'Heals the whole team.' },
  flurry: { name: 'Flurry', text: 'Four quick hits on the target.' },
};

export interface Collection { id: string; name: string }

/** One unit card: a guest unit, an NFT's unit-card AWI, or a monster. */
export interface UnitDef {
  uid: string;
  name: string;
  art: ClassId | MonsterId;   // sprite id: manifest keys unit.<art>.<anim>
  cls: ClassId | null;        // null for monsters
  rarity: Rarity;
  hp: number; atk: number; spd: number; range: number; move: number;
  ability: AbilityId | null;
  size: number;               // draw + body size multiplier
  collection: Collection | null;
  source: 'guest' | 'nft' | 'enemy';
  boss?: boolean;
}

export function makeUnit(cls: ClassId, rarity: Rarity, opts: { uid: string; name?: string; ability?: AbilityId; collection?: Collection | null; source?: 'guest' | 'nft' }): UnitDef {
  const b = CLASSES[cls], k = RARITY_STAT[rarity];
  return {
    uid: opts.uid, name: opts.name ?? b.name, art: cls, cls, rarity,
    hp: Math.round(b.hp * k * HP_SCALE), atk: Math.round(b.atk * k), spd: b.spd, range: b.range, move: b.move,
    ability: opts.ability ?? b.ability, size: b.size ?? 1, collection: opts.collection ?? null, source: opts.source ?? 'guest',
  };
}

export function makeMonster(id: MonsterId, level: number, uid: string, opts: { boss?: boolean; name?: string } = {}): UnitDef {
  const b = MONSTERS[id];
  const k = 1 + 0.06 * (level - 1);
  const boss = opts.boss ? 1.8 : 1;
  return {
    uid, name: opts.name ?? b.name, art: id, cls: null, rarity: opts.boss ? 'Legendary' : 'Common',
    hp: Math.round(b.hp * k * boss * HP_SCALE), atk: Math.round(b.atk * k * (opts.boss ? 1.2 : 1)), spd: b.spd, range: b.range, move: b.move,
    ability: b.ability, size: (b.size ?? 1) * (opts.boss ? 1.45 : 1), collection: null, source: 'enemy', boss: opts.boss,
  };
}

/**
 * The unit-card AWIs in TheoSwap config "Altered Arena Unit Cards" (game 8): config itemId → class, name, ability.
 * Two units per class; same stats per class, different ability.
 */
export const UNIT_ITEMS: Record<string, { cls: ClassId; name: string; ability: AbilityId }> = {
  unit_knight: { cls: 'warrior', name: 'Knight', ability: 'shieldBash' },
  unit_berserker: { cls: 'warrior', name: 'Berserker', ability: 'whirlwind' },
  unit_archer: { cls: 'ranger', name: 'Archer', ability: 'volley' },
  unit_sniper: { cls: 'ranger', name: 'Sniper', ability: 'aimedShot' },
  unit_pyromancer: { cls: 'mage', name: 'Pyromancer', ability: 'fireball' },
  unit_frostmage: { cls: 'mage', name: 'Frost Mage', ability: 'frostNova' },
  unit_cleric: { cls: 'healer', name: 'Cleric', ability: 'mend' },
  unit_druid: { cls: 'healer', name: 'Druid', ability: 'regrowth' },
  unit_assassin: { cls: 'rogue', name: 'Assassin', ability: 'backstab' },
  unit_duelist: { cls: 'rogue', name: 'Duelist', ability: 'flurry' },
};

/** Free units every player has. Guests pick 3 of these. */
export const GUEST_UNITS: UnitDef[] = CLASS_IDS.map((c) => makeUnit(c, 'Common', { uid: `guest:${c}`, source: 'guest' }));
export const DEFAULT_TEAM = ['guest:warrior', 'guest:ranger', 'guest:healer'];

// ───────────────────────────── Collection bonus ─────────────────────────────

export type BonusKind = 'might' | 'vigor' | 'haste';
export const BONUS_INFO: Record<BonusKind, { name: string; stat: string; icon: string }> = {
  might: { name: 'Might', stat: 'attack', icon: '⚔' },
  vigor: { name: 'Vigor', stat: 'health', icon: '♥' },
  haste: { name: 'Haste', stat: 'speed', icon: '⚡' },
};

export interface TeamBonus { collection: Collection; count: number; kind: BonusKind; pct: number; startEnergy: number }

/** Which buff a collection gives: fixed per collection (hash of its id), so it is the same in every battle. */
export function bonusKindOf(c: Collection): BonusKind {
  let h = 2166136261;
  for (let i = 0; i < c.id.length; i++) h = Math.imul(h ^ c.id.toLowerCase().charCodeAt(i), 16777619);
  return (['might', 'vigor', 'haste'] as const)[(h >>> 0) % 3];
}

/** 2 units from one collection: +15% to the whole team. 3: +30%, and abilities start half charged. */
export function teamBonuses(team: UnitDef[]): TeamBonus[] {
  const by = new Map<string, { c: Collection; n: number }>();
  for (const u of team) if (u.collection) {
    const e = by.get(u.collection.id) ?? { c: u.collection, n: 0 };
    e.n++; by.set(u.collection.id, e);
  }
  return [...by.values()].filter((e) => e.n >= 2).map(({ c, n }) => ({
    collection: c, count: n, kind: bonusKindOf(c), pct: n >= 3 ? 0.3 : 0.15, startEnergy: n >= 3 ? 50 : 0,
  }));
}
