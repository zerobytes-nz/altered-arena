import Phaser from 'phaser';
import manifest from '../assets.manifest.json';
import urls from 'virtual:asset-urls';

/**
 * All art comes from assets.manifest.json. Game code refers to assets by manifest key only
 * (e.g. `unit.lizard.attack`); paths, sizes and frame data live in the manifest.
 */
export interface AssetDef {
  key: string;
  type: 'image' | 'spritesheet' | 'audio';
  path: string;
  width: number; height: number;
  frameWidth: number; frameHeight: number; frameCount: number;
  displayScale: number;
  animation?: { frameRate: number; repeat: number };
  /** Real art for this key is pixel art: drawn with nearest-neighbour scaling so it stays crisp. */
  pixelArt?: boolean;
}

const DEFS = new Map<string, AssetDef>((manifest.assets as AssetDef[]).map((a) => [a.key, a]));

export function asset(key: string): AssetDef {
  const a = DEFS.get(key);
  if (!a) throw new Error(`Unknown asset key "${key}" (not in assets.manifest.json)`);
  return a;
}

/** True when the file in use is real art (licensed or CC0), not the committed placeholder. */
export const isRealArt = (key: string): boolean => !urls[key].startsWith(`${manifest.roots.placeholder}/`);

/** The whole game is about 1.2 MB of art, so Boot loads all of it. Call from preload(). */
export function preloadAll(scene: Phaser.Scene): void {
  for (const a of DEFS.values()) {
    const url = urls[a.key];
    if (a.type === 'spritesheet') scene.load.spritesheet(a.key, url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
    else if (a.type === 'image') scene.load.image(a.key, url);
    else scene.load.audio(a.key, url);
  }
}

/** Call once after loading: animations for every sheet, and sharp scaling for real pixel art. */
export function setupAssets(scene: Phaser.Scene): void {
  for (const a of DEFS.values()) {
    if (!scene.textures.exists(a.key)) continue;
    if (a.pixelArt && isRealArt(a.key)) scene.textures.get(a.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!a.animation || scene.anims.exists(a.key)) continue;
    scene.anims.create({
      key: a.key,
      frames: scene.anims.generateFrameNumbers(a.key, { start: 0, end: a.frameCount - 1 }),
      frameRate: a.animation.frameRate || 10,
      repeat: a.animation.repeat,
    });
  }
}

/** Seconds an animation lasts (one loop). */
export const animSeconds = (key: string): number => { const a = asset(key); return a.frameCount / (a.animation?.frameRate || 10); };
