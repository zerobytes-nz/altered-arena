// What the player has: their units (NFT unit cards from the connected TheoSwap profile, then the free guest
// units), the team they picked, and how far up the ladder they are. Kept in localStorage.
import { DEFAULT_TEAM, GUEST_UNITS, makeUnit, type UnitDef } from './battle/units.ts';
import { unitsFromItems } from './awi.ts';
import { loadProfile } from './profile.ts';
import { STAGE_COUNT } from './battle/stages.ts';
import { SAMPLE_NFTS } from './config.ts';

const LS_TEAM = 'altered-arena.team.v1';
const LS_LADDER = 'altered-arena.ladder.v1';

const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown): void { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / full */ } },
};

// ?nft: sample NFT-style unit cards from two made-up collections, to try the collection bonus.
const APES = { id: 'sample:apes', name: 'Sample Apes' };
const PUNKS = { id: 'sample:punks', name: 'Sample Punks' };
const SAMPLES: UnitDef[] = [
  makeUnit('warrior', 'Epic', { uid: 'nft:1', name: 'Iron Ape', collection: APES, source: 'nft' }),
  makeUnit('mage', 'Rare', { uid: 'nft:2', name: 'Ape Magus', collection: APES, source: 'nft' }),
  makeUnit('healer', 'Common', { uid: 'nft:3', name: 'Ape Medic', collection: APES, source: 'nft' }),
  makeUnit('rogue', 'Legendary', { uid: 'nft:4', name: 'Neon Punk', collection: PUNKS, source: 'nft' }),
];

/** The unit cards made from the connected player's NFTs, best rarity first. */
export const nftUnits = (): UnitDef[] => unitsFromItems(loadProfile()?.results ?? []);

/** Every unit card the player can field: their NFT units first, then the free guest units. */
export function roster(): UnitDef[] {
  return [...nftUnits(), ...(SAMPLE_NFTS ? SAMPLES : []), ...GUEST_UNITS];
}

/** After connecting: put the best NFT units in the team, filled up with the default guests. */
export function autoTeam(): void {
  const ids = nftUnits().slice(0, 3).map((u) => u.uid);
  for (const id of DEFAULT_TEAM) if (ids.length < 3) ids.push(id);
  store.set(LS_TEAM, ids);
}

export function loadTeam(): UnitDef[] {
  const all = roster();
  const ids = store.get<string[]>(LS_TEAM) ?? DEFAULT_TEAM;
  const team = ids.map((id) => all.find((u) => u.uid === id)).filter((u): u is UnitDef => !!u);
  return team.length === 3 ? team : DEFAULT_TEAM.map((id) => all.find((u) => u.uid === id)!);
}
export const saveTeam = (team: UnitDef[]): void => store.set(LS_TEAM, team.map((u) => u.uid));

export interface Ladder { cleared: number; stars: number[] }
export function loadLadder(): Ladder {
  const l = store.get<Ladder>(LS_LADDER);
  return l && Array.isArray(l.stars) ? l : { cleared: 0, stars: Array(STAGE_COUNT).fill(0) };
}
/** Record a result. Returns true if this was the first clear of that stage. */
export function recordWin(stage: number, stars: number): boolean {
  const l = loadLadder();
  const first = stage > l.cleared;
  l.cleared = Math.max(l.cleared, stage);
  l.stars[stage - 1] = Math.max(l.stars[stage - 1] ?? 0, stars);
  store.set(LS_LADDER, l);
  return first;
}
/** The stage the Fight button offers: the first one not cleared yet (or the last). */
export const nextStage = (): number => Math.min(STAGE_COUNT, loadLadder().cleared + 1);
export const isUnlocked = (n: number): boolean => n <= loadLadder().cleared + 1;
