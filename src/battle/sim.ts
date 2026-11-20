// The auto-battle. Deterministic for a given seed, stepped at a fixed 60 Hz, with no Phaser in it:
// BattleScene draws it, and `npm run sim` runs thousands of battles in Node to balance the ladder.
//
// Each side's units walk to the nearest enemy and attack when in range. Every attack and every hit
// taken charges energy; at 100 the unit casts its one ability. At 30 s "sudden death" starts and all
// damage ramps up; at 45 s the side with more health left (as a share of its total) wins.
import { RARITY_POWER, teamBonuses, type AbilityId, type TeamBonus, type UnitDef } from './units.ts';

export const ARENA = { left: 50, right: 670, top: 200, bottom: 1010 };
export const STEP = 1 / 60;
export const SUDDEN_DEATH_AT = 30;
export const TIME_LIMIT = 45;
const SWING = 0.21;     // attack wind-up: the hit lands on frame 3 of the 6-frame, 14 fps attack animation
const ENERGY_ON_ATTACK = 14;
const ENERGY_ON_HIT = 55; // × share of max health lost
const BODY = 30;          // body radius at size 1

export type Side = 0 | 1; // 0 = player (bottom), 1 = enemy (top)
export type State = 'idle' | 'walk' | 'attack' | 'hurt' | 'dead';

export interface Fighter {
  id: number;
  def: UnitDef;
  side: Side;
  x: number; y: number;
  hp: number; maxHp: number;
  atk: number; spd: number; range: number; move: number;
  energy: number;
  target: Fighter | null;
  retarget: number;
  cd: number;          // seconds until the next attack may start
  swing: number;       // > 0 while winding up an attack
  stun: number;
  state: State;
  stateT: number;      // seconds in the current state
  facing: 1 | -1;
  atkMul: number; atkMulT: number;
  spdMul: number; spdMulT: number;
  splitDone: boolean;
  alive: boolean;
  dealt: number; healed: number;
  slot: number;
}

export type ProjKind = 'arrow' | 'orb' | 'fireball';
export interface Projectile {
  id: number; kind: ProjKind; from: Fighter; target: Fighter;
  x: number; y: number; speed: number; dmg: number; aoe: number; alive: boolean; ability: boolean;
}

export type BEvent =
  | { t: 'attack'; f: Fighter }
  | { t: 'damage'; f: Fighter; src: Fighter; amount: number; crit: boolean; ability: boolean }
  | { t: 'heal'; f: Fighter; amount: number }
  | { t: 'cast'; f: Fighter; ability: AbilityId }
  | { t: 'stun'; f: Fighter; dur: number }
  | { t: 'blink'; f: Fighter; fromX: number; fromY: number }
  | { t: 'shot'; p: Projectile }
  | { t: 'boom'; x: number; y: number; r: number; kind: 'fire' | 'slam' | 'frost' | 'spin' }
  | { t: 'buff'; f: Fighter; kind: 'atk' | 'spd' }
  | { t: 'spawn'; f: Fighter }
  | { t: 'die'; f: Fighter }
  | { t: 'suddenDeath' }
  | { t: 'end'; result: Result };

export type Result = 'win' | 'lose';

/** Small fast seeded RNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where units stand at the start. Player row at the bottom (left/centre/right), enemies at the top. */
export function startPos(side: Side, i: number, n: number, def: UnitDef): { x: number; y: number } {
  const w = ARENA.right - ARENA.left;
  const x = ARENA.left + (w * (i + 1)) / (n + 1);
  const ranged = def.range > 150;
  if (side === 0) return { x, y: ranged ? 930 : 860 };
  return { x, y: ranged ? 270 : 350 };
}

export class Battle {
  readonly fighters: Fighter[] = [];
  readonly projectiles: Projectile[] = [];
  readonly events: BEvent[] = [];
  readonly bonuses: TeamBonus[];
  time = 0;
  result: Result | null = null;
  suddenDeath = false;
  private nextId = 1;
  private readonly rand: () => number;
  private readonly startHp: [number, number] = [0, 0];

  constructor(team: UnitDef[], enemies: UnitDef[], seed = 1) {
    this.rand = rng(seed);
    this.bonuses = teamBonuses(team);
    team.forEach((d, i) => this.add(d, 0, i, team.length));
    enemies.forEach((d, i) => this.add(d, 1, i, enemies.length));
    for (const f of this.fighters) this.startHp[f.side] += f.maxHp;
  }

  private add(def: UnitDef, side: Side, i: number, n: number, at?: { x: number; y: number }): Fighter {
    const p = at ?? startPos(side, i, n, def);
    let hp = def.hp, atk = def.atk, spd = def.spd, energy = 0;
    if (side === 0) for (const b of this.bonuses) {
      if (b.kind === 'vigor') hp *= 1 + b.pct;
      if (b.kind === 'might') atk *= 1 + b.pct;
      if (b.kind === 'haste') spd *= 1 + b.pct;
      energy = Math.max(energy, b.startEnergy);
    }
    const f: Fighter = {
      id: this.nextId++, def, side, x: p.x, y: p.y, hp: Math.round(hp), maxHp: Math.round(hp), atk, spd,
      range: def.range, move: def.move, energy, target: null, retarget: 0, cd: 0.3 + i * 0.12, swing: 0, stun: 0,
      state: 'idle', stateT: 0, facing: side === 0 ? 1 : -1, atkMul: 1, atkMulT: 0, spdMul: 1, spdMulT: 0,
      splitDone: false, alive: true, dealt: 0, healed: 0, slot: i,
    };
    this.fighters.push(f);
    return f;
  }

  alive(side: Side): Fighter[] { return this.fighters.filter((f) => f.alive && f.side === side); }

  /** Health left on a side, as a share of its starting total. */
  hpShare(side: Side): number {
    let hp = 0;
    for (const f of this.fighters) if (f.alive && f.side === side) hp += f.hp;
    return hp / Math.max(1, this.startHp[side]);
  }

  /** Advance by exactly one STEP. Callers drain `events` after each call. */
  step(): void {
    if (this.result) return;
    const dt = STEP;
    this.time += dt;
    if (!this.suddenDeath && this.time >= SUDDEN_DEATH_AT) { this.suddenDeath = true; this.events.push({ t: 'suddenDeath' }); }

    for (const f of this.fighters) if (f.alive) this.think(f, dt);
    this.separate();
    this.moveProjectiles(dt);

    const a = this.countAlive(0), b = this.countAlive(1);
    if (a === 0 || b === 0) this.finish(b === 0 ? 'win' : 'lose');
    else if (this.time >= TIME_LIMIT) this.finish(this.hpShare(0) >= this.hpShare(1) ? 'win' : 'lose');
  }

  private countAlive(side: Side): number { let n = 0; for (const f of this.fighters) if (f.alive && f.side === side) n++; return n; }

  private finish(r: Result): void { this.result = r; this.events.push({ t: 'end', result: r }); }

  private setState(f: Fighter, s: State): void { if (f.state !== s) { f.state = s; f.stateT = 0; } }

  private nearestEnemy(f: Fighter): Fighter | null {
    let best: Fighter | null = null, bd = Infinity;
    for (const o of this.fighters) {
      if (!o.alive || o.side === f.side) continue;
      const d = (o.x - f.x) ** 2 + (o.y - f.y) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private think(f: Fighter, dt: number): void {
    f.stateT += dt;
    f.cd -= dt;
    if (f.atkMulT > 0 && (f.atkMulT -= dt) <= 0) f.atkMul = 1;
    if (f.spdMulT > 0 && (f.spdMulT -= dt) <= 0) f.spdMul = 1;
    if (f.stun > 0) { f.stun -= dt; f.swing = 0; this.setState(f, 'idle'); return; }
    if (f.state === 'hurt' && f.stateT < 0.18) return;

    if (!f.target || !f.target.alive || (f.retarget -= dt) <= 0) { f.target = this.nearestEnemy(f); f.retarget = 0.6; }
    const t = f.target;
    if (!t) { this.setState(f, 'idle'); return; }
    f.facing = t.x < f.x - 4 ? -1 : t.x > f.x + 4 ? 1 : f.facing;

    // Winding up an attack: the hit lands when the swing finishes.
    if (f.swing > 0) {
      f.swing -= dt;
      if (f.swing <= 0) this.land(f, t);
      return;
    }
    if (f.state === 'attack' && f.stateT < 0.42) return; // let the attack animation finish

    if (f.energy >= 100 && f.def.ability && this.cast(f, t)) { f.energy = 0; return; }

    const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
    const reach = f.range + BODY * (f.def.size + t.def.size) * 0.5;
    if (d > reach) {
      const v = f.move * dt;
      f.x += (dx / d) * v; f.y += (dy / d) * v;
      this.setState(f, 'walk');
      return;
    }
    if (f.cd <= 0) {
      f.cd = 1 / (f.spd * f.spdMul);
      f.swing = SWING;
      this.setState(f, 'attack');
      this.events.push({ t: 'attack', f });
    } else if (f.state === 'walk' || f.state === 'attack') this.setState(f, 'idle');
  }

  /** The attack's wind-up finished: melee hits now, ranged fires a projectile. */
  private land(f: Fighter, t: Fighter): void {
    f.energy = Math.min(100, f.energy + ENERGY_ON_ATTACK);
    if (!t.alive) return;
    if (f.range > 150) {
      this.shoot(f, t, f.def.art === 'mage' || f.def.art === 'healer' ? 'orb' : 'arrow', this.roll(f.atk * f.atkMul), 0, false);
    } else this.damage(f, t, f.atk * f.atkMul, false);
  }

  private roll(base: number): number { return base * (0.9 + this.rand() * 0.2); }

  private shoot(f: Fighter, t: Fighter, kind: ProjKind, dmg: number, aoe: number, ability: boolean): void {
    const p: Projectile = { id: this.nextId++, kind, from: f, target: t, x: f.x + f.facing * 20, y: f.y - 50 * f.def.size, speed: kind === 'arrow' ? 900 : 620, dmg, aoe, alive: true, ability };
    this.projectiles.push(p);
    this.events.push({ t: 'shot', p });
  }

  private moveProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const tx = p.target.x, ty = p.target.y - 45 * p.target.def.size;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), v = p.speed * dt;
      if (d <= v + 6) {
        p.alive = false;
        if (p.aoe > 0) this.explode(p.from, tx, p.target.y, p.aoe, p.dmg, 'fire');
        else if (p.target.alive) this.damage(p.from, p.target, p.dmg, p.ability, true);
      } else { p.x += (dx / d) * v; p.y += (dy / d) * v; }
    }
    // drop finished projectiles without allocating a new array
    let w = 0;
    for (let i = 0; i < this.projectiles.length; i++) if (this.projectiles[i].alive) this.projectiles[w++] = this.projectiles[i];
    this.projectiles.length = w;
  }

  private explode(src: Fighter, x: number, y: number, r: number, dmg: number, kind: 'fire' | 'slam' | 'frost' | 'spin', stun = 0): void {
    this.events.push({ t: 'boom', x, y, r, kind });
    for (const o of this.fighters) {
      if (!o.alive || o.side === src.side) continue;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 > r * r) continue;
      this.damage(src, o, dmg, true, true);
      if (stun > 0 && o.alive) { o.stun = Math.max(o.stun, stun); this.events.push({ t: 'stun', f: o, dur: stun }); }
    }
  }

  private damage(src: Fighter, t: Fighter, base: number, ability: boolean, rolled = false): void {
    if (!t.alive) return;
    let amount = rolled ? base : this.roll(base);
    const critChance = src.def.art === 'rogue' ? 0.25 : 0.08;
    const crit = !ability && this.rand() < critChance;
    if (crit) amount *= 1.6;
    if (this.suddenDeath) amount *= 1 + (this.time - SUDDEN_DEATH_AT) * 0.15;
    amount = Math.max(1, Math.round(amount));
    t.hp -= amount;
    src.dealt += amount;
    t.energy = Math.min(100, t.energy + (ENERGY_ON_HIT * amount) / t.maxHp);
    this.events.push({ t: 'damage', f: t, src, amount, crit, ability });
    if (t.hp <= 0) {
      t.hp = 0; t.alive = false; t.swing = 0; t.stun = 0;
      this.setState(t, 'dead');
      this.events.push({ t: 'die', f: t });
      return;
    }
    if (amount > t.maxHp * 0.1 && t.swing <= 0 && t.state !== 'attack') this.setState(t, 'hurt');
    // Lizards call a smaller one once, the first time they drop under half health.
    if (t.def.ability === 'split' && !t.splitDone && t.hp < t.maxHp / 2) { t.splitDone = true; this.split(t); }
  }

  private heal(f: Fighter, amount: number, by: Fighter): void {
    if (!f.alive) return;
    const a = Math.round(Math.min(amount, f.maxHp - f.hp));
    if (a <= 0) return;
    f.hp += a; by.healed += a;
    this.events.push({ t: 'heal', f, amount: a });
  }

  private split(t: Fighter): void {
    const d: UnitDef = { ...t.def, uid: t.def.uid + ':s', name: `Little ${t.def.name}`, hp: Math.round(t.def.hp * 0.4), atk: Math.round(t.def.atk * 0.6), size: t.def.size * 0.7, ability: null };
    const f = this.add(d, t.side, t.slot, 1, { x: Math.min(ARENA.right, Math.max(ARENA.left, t.x + (t.x < 360 ? 40 : -40))), y: t.y - 10 });
    this.events.push({ t: 'cast', f: t, ability: 'split' });
    this.events.push({ t: 'spawn', f });
  }

  /** Use the unit's ability. Returns false if it can't be used right now (it then attacks normally). */
  private cast(f: Fighter, t: Fighter): boolean {
    const ab = f.def.ability!;
    const p = RARITY_POWER[f.def.rarity];
    const legendary = f.def.rarity === 'Legendary';
    const foes = this.fighters.filter((o) => o.alive && o.side !== f.side);
    const friends = this.fighters.filter((o) => o.alive && o.side === f.side);
    const near = Math.hypot(t.x - f.x, t.y - f.y) <= f.range + BODY * 2;
    switch (ab) {
      case 'shieldBash': {
        if (!near) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        this.damage(f, t, f.atk * f.atkMul * 1.8 * p, true);
        if (t.alive) { const d = 1.4 * p; t.stun = Math.max(t.stun, d); t.swing = 0; this.events.push({ t: 'stun', f: t, dur: d }); }
        break;
      }
      case 'volley': {
        this.events.push({ t: 'cast', f, ability: ab });
        const n = 5 + (f.def.rarity === 'Epic' ? 1 : legendary ? 2 : 0);
        for (let i = 0; i < n; i++) this.shoot(f, foes[Math.floor(this.rand() * foes.length)], 'arrow', this.roll(f.atk * f.atkMul * 0.65 * p), 0, true);
        break;
      }
      case 'fireball':
        this.events.push({ t: 'cast', f, ability: ab });
        this.shoot(f, t, 'fireball', this.roll(f.atk * f.atkMul * 2.0 * p), 120 * (legendary ? 1.2 : 1), true);
        break;
      case 'mend': {
        const hurt = friends.filter((o) => o.hp < o.maxHp);
        if (!hurt.length) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        if (legendary) for (const o of friends) this.heal(o, o.maxHp * 0.22 * p, f);
        else { const lo = hurt.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a)); this.heal(lo, lo.maxHp * 0.38 * p, f); }
        break;
      }
      case 'backstab': {
        const weak = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
        const fromX = f.x, fromY = f.y;
        const behind = weak.side === 1 ? -1 : 1; // "behind" = the far side from its own team's push
        f.x = Math.min(ARENA.right, Math.max(ARENA.left, weak.x + (weak.x < 360 ? 30 : -30)));
        f.y = Math.min(ARENA.bottom, Math.max(ARENA.top, weak.y + behind * 50));
        f.target = weak; f.retarget = 1.5; f.facing = weak.x < f.x ? -1 : 1;
        this.events.push({ t: 'blink', f, fromX, fromY });
        this.events.push({ t: 'cast', f, ability: ab });
        this.damage(f, weak, f.atk * f.atkMul * 2.6 * p, true);
        break;
      }
      case 'drain': {
        if (!near) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        const before = t.hp;
        this.damage(f, t, f.atk * f.atkMul * 1.6 * p, true);
        this.heal(f, before - t.hp, f);
        break;
      }
      case 'frenzy':
        this.events.push({ t: 'cast', f, ability: ab });
        f.spdMul = 1.6 * p; f.spdMulT = 4;
        this.events.push({ t: 'buff', f, kind: 'spd' });
        break;
      case 'warcry':
        this.events.push({ t: 'cast', f, ability: ab });
        for (const o of friends) { o.atkMul = 1.25 * p; o.atkMulT = 5; this.events.push({ t: 'buff', f: o, kind: 'atk' }); }
        break;
      case 'slam':
        if (!near) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        this.explode(f, f.x, f.y, 130 * f.def.size, f.atk * f.atkMul * 1.4 * p, 'slam', 1.0);
        break;
      case 'whirlwind':
        if (!near) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        this.explode(f, f.x, f.y, 125, f.atk * f.atkMul * 1.5 * p, 'spin');
        break;
      case 'aimedShot': {
        const weak = foes.reduce((a, b) => (b.hp < a.hp ? b : a));
        this.events.push({ t: 'cast', f, ability: ab });
        this.shoot(f, weak, 'arrow', this.roll(f.atk * f.atkMul * 3.4 * p), 0, true);
        break;
      }
      case 'frostNova':
        this.events.push({ t: 'cast', f, ability: ab });
        this.explode(f, t.x, t.y, 115 * (legendary ? 1.2 : 1), f.atk * f.atkMul * 1.7 * p, 'frost', 1.3 * p);
        break;
      case 'regrowth':
        if (!friends.some((o) => o.hp < o.maxHp)) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        for (const o of friends) this.heal(o, o.maxHp * (legendary ? 0.2 : 0.15) * p, f);
        break;
      case 'flurry':
        if (!near) return false;
        this.events.push({ t: 'cast', f, ability: ab });
        for (let i = 0; i < 4 && t.alive; i++) this.damage(f, t, f.atk * f.atkMul * 1.05 * p, true);
        break;
      case 'split':
        return false; // triggered by damage, not energy
    }
    this.setState(f, 'attack');
    f.cd = Math.max(f.cd, 0.45);
    return true;
  }

  /** Push overlapping bodies apart and keep everyone inside the arena. */
  private separate(): void {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (!b.alive) continue;
        const min = BODY * (a.def.size + b.def.size) * 0.9;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 0.01) { dx = a.id < b.id ? 1 : -1; dy = 0; d = 1; }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
      a.x = Math.min(ARENA.right, Math.max(ARENA.left, a.x));
      a.y = Math.min(ARENA.bottom, Math.max(ARENA.top, a.y));
    }
  }
}

/** Run a whole battle with no drawing (balance testing). */
export function simulate(team: UnitDef[], enemies: UnitDef[], seed = 1): { result: Result; time: number; survivors: number } {
  const b = new Battle(team, enemies, seed);
  while (!b.result) { b.step(); b.events.length = 0; }
  return { result: b.result, time: b.time, survivors: b.alive(0).length };
}
