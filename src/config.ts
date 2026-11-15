// Screen size and switches. Portrait 720×1280 (9:16), scaled to fit the phone (Scale.FIT).
export const GAME_W = 720;
export const GAME_H = 1280;

const params = new URLSearchParams(location.search);
/** ?debug: FPS meter and window.__game. */
export const DEBUG = params.has('debug');
/** ?nft: add sample NFT-style unit cards (two collections) to test rarity and the collection bonus before milestone 2. */
export const SAMPLE_NFTS = params.has('nft');

export const COLORS = {
  bg: 0x120d1f,
  panel: 0x231a3a,
  panelEdge: 0xb79cff,
  accent: 0x7b5cff,
  good: 0x2a9d8f,
  bad: 0xc0392b,
  gold: 0xffc94d,
  text: '#efe9ff',
  dim: '#a99cd0',
};
