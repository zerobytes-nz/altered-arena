// The connected TheoSwap player: who they are, where their items came from, and the raw user-items results
// (unit cards are rebuilt from those with awi.ts, so a card-rule change never needs a re-connect).
// Kept in localStorage, so the player stays connected and keeps their NFT units offline.
import { DEMO_PROFILES, type DemoId } from './demo.ts';
import { ConnectError, fetchItems, type ApiItem } from './theoswap.ts';

export type Source = 'live' | 'cache' | 'demo';
export interface Profile {
  label: string;        // "Code ABCD1234", "Whale (demo)"
  code?: string;        // the user code, when one was entered
  demo?: DemoId;
  source: Source;       // live answer, offline cache, or bundled sample data
  at: number;           // when the items were fetched
  results: ApiItem[];
}

const LS_PROFILE = 'altered-arena.profile.v1';

export function loadProfile(): Profile | null {
  try { const v = localStorage.getItem(LS_PROFILE); const p = v ? (JSON.parse(v) as Profile) : null; return p && Array.isArray(p.results) ? p : null; } catch { return null; }
}
const saveProfile = (p: Profile): void => { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch { /* private mode */ } };
export const forgetProfile = (): void => { try { localStorage.removeItem(LS_PROFILE); } catch { /* private mode */ } };

/** Sign in with a TheoSwap user code. Throws ConnectError with a message for the player. */
export async function connect(code: string): Promise<Profile> {
  const { results, cached, at } = await fetchItems(code);
  const p: Profile = { label: `Code ${code}`, code, source: cached ? 'cache' : 'live', at, results };
  saveProfile(p);
  return p;
}

/**
 * A demo player: their TheoSwap test code when the server can answer it, else the bundled sample data
 * (same items), so a demo never fails on stage.
 */
export async function connectDemo(id: DemoId): Promise<Profile> {
  const d = DEMO_PROFILES[id];
  let p: Profile;
  try {
    const { results, cached, at } = await fetchItems(d.testCode);
    if (!results.length) throw new ConnectError('empty');
    p = { label: `${d.name} (demo)`, demo: id, source: cached ? 'cache' : 'live', at, results };
  } catch {
    p = { label: `${d.name} (demo)`, demo: id, source: 'demo', at: Date.now(), results: d.sample };
  }
  saveProfile(p);
  return p;
}
