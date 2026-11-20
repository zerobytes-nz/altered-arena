// AWIs (Altered World Items): what a player's NFTs become in Altered Arena.
//
// TheoSwap's user-items API returns one entry per NFT, picked from this game's config tree
// ("Altered Arena Unit Cards", game 8): an itemId such as "unit_frostmage" plus the rolled Rarity.
// Each entry becomes one unit card. The NFT's contract is its collection (for the team bonus).
import { RARITIES, UNIT_ITEMS, makeUnit, type Collection, type Rarity, type UnitDef } from './battle/units.ts';
import type { ApiItem } from './theoswap.ts';
import { TEST_CONTRACT } from './demo.ts';

const pickRarity = (v: unknown): Rarity => ((RARITIES as readonly string[]).includes(String(v)) ? (v as Rarity) : 'Common');

const short = (addr: string) => (/^0x[0-9a-f]{40}$/i.test(addr) ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr || 'Unknown');

/** Names for collections the API sends without one (lower-case contract → name). */
const KNOWN: Record<string, string> = {
  '0x71a302d3f021e35982937bed204e24a4a0c51e52': 'TheoCats', // TheoSwap supporters (config "Theo Swap")
};

/**
 * The collection an NFT belongs to: its contract. The name comes from the API when it sends one.
 * TheoSwap's test NFTs all share the zero address, which is not a real collection, so they get none
 * (otherwise every demo team of 3 NFTs would get the full collection bonus).
 */
export function collectionOf(r: ApiItem): Collection | null {
  const id = (r.contract ?? '').toLowerCase();
  if (!id || id === TEST_CONTRACT) return null;
  const any = r as Record<string, unknown>;
  const name = [any.collectionName, any.collection_name, any.contractName, any.name].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  return { id, name: name?.trim() || KNOWN[id] || `Collection ${short(id)}` };
}

/**
 * Turn user-items results into unit cards, best rarity first. Items this game doesn't know (another
 * config, a renamed item) are skipped. Each NFT is its own card, named after its token: "Frost Mage #42".
 */
export function unitsFromItems(results: ApiItem[]): UnitDef[] {
  const out: UnitDef[] = [];
  const seen = new Set<string>();
  for (const r of results ?? []) {
    const def = UNIT_ITEMS[r?.itemData?.itemId ?? ''];
    if (!def) continue;
    const token = String(r.token_id ?? r.tokenId ?? '?');
    let uid = `nft:${(r.contract ?? '').toLowerCase()}:${token}`;
    for (let n = 2; seen.has(uid); n++) uid = `${uid}~${n}`;
    seen.add(uid);
    out.push(makeUnit(def.cls, pickRarity(r.itemData?.Rarity), {
      uid, name: `${def.name} #${token}`, ability: def.ability, art: def.art, collection: collectionOf(r), source: 'nft',
    }));
  }
  return out.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity));
}
