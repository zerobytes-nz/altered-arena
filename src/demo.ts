// Demo profiles, so the game can be shown without real wallets.
// Each one has a TheoSwap test code (filled with set_test_items for game 8, config 16) and bundled sample
// data in the same shape as user-items `results`. The sample is used when TheoSwap can't be reached or the
// build has no API key, so the demos always work, even offline.
import type { ApiItem } from './theoswap.ts';

export type DemoId = 'whale' | 'collector' | 'newbie';

/** TheoSwap test NFTs all come from the zero-address "contract": not a real collection (see awi.ts). */
export const TEST_CONTRACT = '0x0000000000000000000000000000000000000000';

const nft = (token: number, itemId: string, Rarity: string): ApiItem => ({ contract: TEST_CONTRACT, token_id: token, itemData: { itemId, Rarity } });

// Sample data = what get_test_items shows for these test codes (saved 2026-11-16).
export const DEMO_PROFILES: Record<DemoId, { name: string; blurb: string; testCode: string; sample: ApiItem[] }> = {
  whale: {
    name: 'Whale', blurb: '11 NFTs, 2 Legendary', testCode: 'AAAAAAAA',
    sample: [
      nft(172, 'unit_pyromancer', 'Legendary'), nft(11, 'unit_assassin', 'Legendary'),
      nft(21, 'unit_knight', 'Epic'), nft(65, 'unit_cleric', 'Epic'), nft(1, 'unit_archer', 'Epic'),
      nft(25, 'unit_berserker', 'Rare'), nft(2, 'unit_frostmage', 'Rare'), nft(8, 'unit_duelist', 'Rare'),
      nft(6, 'unit_sniper', 'Common'), nft(20, 'unit_druid', 'Common'), nft(4, 'unit_knight', 'Common'),
    ],
  },
  collector: {
    name: 'Collector', blurb: '4 NFTs, a full team', testCode: 'BBBBBBBB',
    sample: [nft(38, 'unit_knight', 'Rare'), nft(1, 'unit_archer', 'Epic'), nft(33, 'unit_cleric', 'Rare'), nft(36, 'unit_assassin', 'Rare')],
  },
  newbie: {
    name: 'New player', blurb: '1 NFT + free units', testCode: 'CCCCCCCC',
    sample: [nft(15, 'unit_pyromancer', 'Rare')],
  },
};
