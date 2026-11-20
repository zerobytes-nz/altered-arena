import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { preloadAll, setupAssets } from '../assets.ts';
import { normalizeCode } from '../theoswap.ts';
import { decodeTeam } from '../modes/teamcode.ts';

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
    // Deep link from TheoSwap (the game's website is …/?userCode=CODE): connect with that code.
    const url = new URL(location.href);
    const code = normalizeCode(url.searchParams.get('userCode') ?? '');
    if (code) {
      url.searchParams.delete('userCode');
      history.replaceState(null, '', url); // a reload shouldn't connect again
      this.scene.start('Connect', { code });
      return;
    }
    // Friend link (…/?vs=ABC-1234): straight to the team screen against that team.
    const vs = (url.searchParams.get('vs') ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase();
    if (vs && decodeTeam(vs)) {
      url.searchParams.delete('vs');
      history.replaceState(null, '', url);
      this.scene.start('Team', { mode: { kind: 'friend', code: `${vs.slice(0, 3)}-${vs.slice(3)}` } });
    } else this.scene.start('Menu');
  }
}
