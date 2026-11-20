// Team codes for friend battles: 3 unit cards in 7 characters, e.g. "K3F-1A0Q".
// Each unit = kind (5 guest classes + 10 NFT unit kinds) × rarity → 2 base-36 chars; then 1 char for which
// units share a collection and which buff that collection gives. The battle itself needs no server:
// the sim is deterministic, so both phones play the same fight for the same team, code and seed.
import { BONUS_INFO, CLASSES, CLASS_IDS, RARITIES, UNIT_ITEMS, bonusKindOf, makeUnit, teamBonuses, type BonusKind, type Collection, type UnitDef } from '../battle/units.ts';

const ITEM_IDS = Object.keys(UNIT_ITEMS);
const KINDS = [...CLASS_IDS.map((c) => `class:${c}`), ...ITEM_IDS];
const PATTERNS = [[], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
const BONUS: BonusKind[] = ['might', 'vigor', 'haste'];

function kindOf(u: UnitDef): number {
  const item = ITEM_IDS.findIndex((id) => UNIT_ITEMS[id].cls === u.cls && UNIT_ITEMS[id].ability === u.ability && u.source === 'nft');
  return item >= 0 ? CLASS_IDS.length + item : Math.max(0, CLASS_IDS.indexOf(u.cls ?? 'warrior'));
}

/** The code for a team of 3. */
export function encodeTeam(team: UnitDef[]): string {
  let s = '';
  for (const u of team.slice(0, 3)) s += (kindOf(u) * 4 + RARITIES.indexOf(u.rarity)).toString(36).padStart(2, '0');
  const b = teamBonuses(team)[0];
  let pat = 0, kind = 0;
  if (b) {
    const idx = team.map((u, i) => (u.collection?.id === b.collection.id ? i : -1)).filter((i) => i >= 0);
    pat = PATTERNS.findIndex((p) => p.length === idx.length && p.every((v, i) => v === idx[i]));
    kind = BONUS.indexOf(b.kind);
  }
  s += (Math.max(0, pat) * 3 + kind).toString(36);
  s = s.toUpperCase();
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

/** A collection id whose hash gives the wanted buff (so the friend's team gets the same bonus). */
function collectionFor(kind: BonusKind): Collection {
  for (let i = 0; ; i++) { const c = { id: `friend:${kind}:${i}`, name: `${BONUS_INFO[kind].name} set` }; if (bonusKindOf(c) === kind) return c; }
}

/** The friend's 3 unit cards, or null when the code is not valid. */
export function decodeTeam(code: string): UnitDef[] | null {
  const s = code.replace(/[^0-9a-z]/gi, '').toLowerCase();
  if (s.length !== 7) return null;
  const team: UnitDef[] = [];
  for (let i = 0; i < 3; i++) {
    const n = parseInt(s.slice(i * 2, i * 2 + 2), 36);
    const k = Math.floor(n / 4), r = n % 4;
    if (!(k >= 0 && k < KINDS.length)) return null;
    const kind = KINDS[k];
    const uid = `friend:${i}`;
    if (kind.startsWith('class:')) {
      const cls = kind.slice(6) as (typeof CLASS_IDS)[number];
      team.push(makeUnit(cls, RARITIES[r], { uid, name: CLASSES[cls].name, source: 'enemy' }));
    } else {
      const it = UNIT_ITEMS[kind];
      team.push(makeUnit(it.cls, RARITIES[r], { uid, name: it.name, ability: it.ability, art: it.art, source: 'enemy' }));
    }
  }
  const c = parseInt(s[6], 36);
  if (!(c >= 0 && c < PATTERNS.length * 3)) return null;
  const pat = PATTERNS[Math.floor(c / 3)], col = collectionFor(BONUS[c % 3]);
  for (const i of pat) team[i].collection = col;
  return team;
}

/** A link that opens the game straight into a battle against this team. */
export const shareLink = (code: string): string => `${location.origin}${location.pathname}?vs=${code}`;
