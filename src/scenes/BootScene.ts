import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { preloadAll, setupAssets } from '../assets.ts';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    const w = 420, x = (GAME_W - w) / 2, y = GAME_H / 2;
    this.add.rectangle(x, y, w, 14, COLORS.panel).setOrigin(0, 0.5);
    const bar = this.add.rectangle(x, y, 1, 14, COLORS.panelEdge).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => { bar.width = Math.max(1, w * p); });
    document.getElementById('loading')?.remove();
    preloadAll(this);
  }

  create(): void {
    setupAssets(this);
    this.scene.start('Menu');
  }
}
