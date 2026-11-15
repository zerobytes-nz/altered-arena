import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { DEMO_PROFILES, type DemoId } from '../demo.ts';
import { connect, connectDemo, forgetProfile, loadProfile, type Profile } from '../profile.ts';
import { normalizeCode } from '../theoswap.ts';
import { button, text } from '../ui.ts';

/** Enter a TheoSwap user code (or pick a demo player) to turn your NFTs into unit-card AWIs. */
export class ConnectScene extends Phaser.Scene {
  private busy = false;
  private status!: Phaser.GameObjects.Text;
  private field!: HTMLInputElement;
  private autoCode = '';

  constructor() { super('Connect'); }

  /** `code` comes from a ?userCode= deep link: fill it in and connect right away. */
  init(data: { code?: string }): void {
    this.autoCode = data?.code ?? '';
    // Use the deep-link code once: Phaser hands a restarted scene its last data again.
    if (data) delete data.code;
  }

  create(): void {
    this.busy = false;
    this.add.image(GAME_W / 2, GAME_H / 2, 'bg.arena').setAlpha(0.3);
    text(this, GAME_W / 2, 100, 'CONNECT THEOSWAP', 48, '#ffffff', '900').setOrigin(0.5).setStroke('#2a1d48', 10);
    text(this, GAME_W / 2, 160, 'Your NFTs become unit-card AWIs\n(Altered World Items) in this game.', 23, '#c9bfff', '600').setOrigin(0.5).setAlign('center');

    text(this, GAME_W / 2, 270, 'Enter the player code from your TheoSwap profile', 21, COLORS.text, '600').setOrigin(0.5);
    const dom = this.add.dom(GAME_W / 2, 340).createFromHTML(
      '<input type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="16" placeholder="PLAYER CODE" ' +
      'style="width:440px;height:76px;box-sizing:border-box;padding:0 18px;font:800 34px system-ui,sans-serif;letter-spacing:4px;text-align:center;' +
      'text-transform:uppercase;color:#fff;background:#120d1f;border:4px solid #7b5cff;border-radius:12px;outline:none;user-select:text;-webkit-user-select:text">');
    this.field = dom.node.querySelector('input') as HTMLInputElement;
    this.field.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); });
    button(this, GAME_W / 2, 440, 'Connect', () => this.submit(), 440, 84, COLORS.accent, 32);
    this.status = text(this, GAME_W / 2, 520, '', 21, '#ffb3c6', '600').setOrigin(0.5).setWordWrapWidth(640).setAlign('center');

    text(this, GAME_W / 2, 610, 'No NFTs handy? Try a demo player:', 23, COLORS.text, '700').setOrigin(0.5);
    (Object.keys(DEMO_PROFILES) as DemoId[]).forEach((id, i) => {
      const y = 690 + i * 120, d = DEMO_PROFILES[id];
      button(this, GAME_W / 2, y, d.name, () => this.run(() => connectDemo(id)), 440, 76, 0x3a2a6b, 28);
      text(this, GAME_W / 2, y + 50, `${d.blurb} · test code ${d.testCode}`, 17, COLORS.dim, '600').setOrigin(0.5);
    });

    const p = loadProfile();
    if (p) {
      text(this, GAME_W / 2, 1060, `Connected: ${p.label}`, 21, '#7dffcf', '700').setOrigin(0.5);
      button(this, GAME_W / 2, 1110, 'Disconnect (play as guest)', () => { forgetProfile(); this.scene.restart(); }, 400, 60, 0x6c1d45, 22);
    }
    button(this, GAME_W / 2, 1210, '← Back', () => this.leave('Menu'), 260, 72, COLORS.panel, 26);

    if (this.autoCode) { this.field.value = this.autoCode; this.submit(); }
    else if (!this.sys.game.device.input.touch) this.field.focus({ preventScroll: true }); // a phone keyboard would cover the demos
  }

  private submit(): void {
    const code = normalizeCode(this.field.value);
    if (code.length < 4) { this.status.setColor('#ffb3c6').setText('Enter the code from your TheoSwap profile.'); return; }
    this.run(() => connect(code));
  }

  private run(task: () => Promise<Profile>): void {
    if (this.busy) return;
    this.busy = true;
    this.status.setColor('#c9bfff').setText('Connecting to TheoSwap…');
    task().then(
      (profile) => this.leave('Reveal', { profile }),
      (e: unknown) => { this.busy = false; this.status.setColor('#ffb3c6').setText(e instanceof Error ? e.message : 'Something went wrong.'); },
    );
  }

  private leave(key: string, data?: object): void {
    this.field.blur();
    this.scene.start(key, data);
  }
}
