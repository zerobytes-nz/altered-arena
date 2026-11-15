import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { button, muteButton, notice, text } from '../ui.ts';
import { stage, STAGE_COUNT } from '../battle/stages.ts';
import { isUnlocked, loadLadder, nextStage } from '../state.ts';
import { canInstall, install, isInstalled, onInstallChange, openInChromeUrl, tryCloseApp } from '../systems/install.ts';
import { sfx } from '../systems/audio.ts';

/** Title + the ladder of 10 stages. Tap a stage you have reached, then Fight. */
export class MenuScene extends Phaser.Scene {
  private selected = 1;
  private rows: { bg: Phaser.GameObjects.Rectangle; n: number }[] = [];
  private fight!: ReturnType<typeof button>;

  constructor() { super('Menu'); }

  create(): void {
    this.selected = nextStage();
    this.add.image(GAME_W / 2, GAME_H / 2, 'bg.arena').setAlpha(0.55);
    text(this, GAME_W / 2, 130, 'ALTERED', 76, '#ffffff', '900').setOrigin(0.5).setStroke('#2a1d48', 10);
    text(this, GAME_W / 2, 205, 'ARENA', 76, '#ffc94d', '900').setOrigin(0.5).setStroke('#2a1d48', 10);
    text(this, GAME_W / 2, 262, 'Your NFTs become unit cards. Pick 3. Watch them fight.', 21, COLORS.dim, '600').setOrigin(0.5);

    // Units parade across the title
    (['warrior', 'ranger', 'mage', 'healer', 'rogue'] as const).forEach((u, i) => {
      this.add.sprite(130 + i * 115, 400, `unit.${u}.idle`).setOrigin(0.5, 1).play({ key: `unit.${u}.idle`, startFrame: i % 4 });
    });

    this.ladder();
    this.fight = button(this, GAME_W / 2, 1150, '', () => this.play(), 460, 104, COLORS.accent, 36);
    this.select(this.selected);
    muteButton(this, GAME_W - 50, 50);
    this.appButtons();
    this.input.keyboard?.once('keydown-SPACE', () => this.play());
  }

  /** Ten stage rows, stage 10 at the top. */
  private ladder(): void {
    const lad = loadLadder();
    const top = 440, h = 58;
    this.rows = [];
    for (let n = STAGE_COUNT; n >= 1; n--) {
      const y = top + (STAGE_COUNT - n) * h + h / 2;
      const open = isUnlocked(n), done = n <= lad.cleared;
      const bg = this.add.rectangle(GAME_W / 2, y, 560, h - 8, done ? 0x1f3a3a : open ? COLORS.panel : 0x1a1426, 0.92)
        .setStrokeStyle(2, n === STAGE_COUNT ? COLORS.gold : COLORS.panelEdge, open ? 0.5 : 0.15);
      const st = stage(n);
      text(this, GAME_W / 2 - 258, y, `${n}`, 26, open ? '#ffffff' : '#5a4f78', '900').setOrigin(0, 0.5);
      text(this, GAME_W / 2 - 208, y, `${st.name}${n === STAGE_COUNT ? '  👑' : ''}`, 23, open ? COLORS.text : '#5a4f78', '700').setOrigin(0, 0.5);
      const stars = lad.stars[n - 1] ?? 0;
      const right = done ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : open ? 'NEXT' : '🔒';
      text(this, GAME_W / 2 + 262, y, right, done ? 24 : 20, done ? '#ffc94d' : open ? '#9fe8ff' : '#5a4f78', '800').setOrigin(1, 0.5);
      if (open) bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { sfx.tap(); this.select(n); });
      this.rows.push({ bg, n });
    }
  }

  private select(n: number): void {
    this.selected = n;
    for (const r of this.rows) r.bg.setStrokeStyle(r.n === n ? 5 : 2, r.n === n ? 0xffffff : r.n === STAGE_COUNT ? COLORS.gold : COLORS.panelEdge, r.n === n ? 0.9 : isUnlocked(r.n) ? 0.5 : 0.15);
    this.fight.label.setText(`⚔  FIGHT STAGE ${n}`);
  }

  private play(): void {
    // Fullscreen + portrait lock need a user gesture; both are best-effort.
    if (this.sys.game.device.input.touch && !this.scale.isFullscreen) {
      try { this.scale.startFullscreen(); } catch { /* not allowed */ }
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o?.lock?.('portrait').catch(() => {});
    }
    this.scene.start('Team', { stage: this.selected });
  }

  /** Top corners: "Install app" (until it is installed) and "Exit" (in full screen or the installed app). */
  private appButtons(): void {
    const inst = button(this, 130, 50, '📲 Install app', () => this.installApp(), 220, 60, COLORS.good, 22);
    const exit = button(this, GAME_W - 170, 50, '✕ Exit', () => this.exitApp(), 120, 60, 0x6c1d45, 22);
    const sync = () => {
      inst.setVisible(canInstall());
      exit.setVisible(isInstalled() || this.scale.isFullscreen);
    };
    sync();
    const off = onInstallChange(sync);
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync).on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync).off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    });
  }

  private installApp(): void {
    install().then((r) => {
      if (r === 'ios') {
        notice(this, 'INSTALL ON IPHONE / IPAD', [
          '1.  Tap the Share button  ⬆  in the browser bar',
          '2.  Choose  "Add to Home Screen"',
          '3.  Open Altered Arena from your home screen:',
          '     it plays full screen, even offline.',
        ]);
      } else if (r === 'use-chrome') {
        notice(this, 'INSTALL WITH CHROME', [
          'This browser builds an old-style app, and',
          'Android warns about it. Chrome installs it',
          'cleanly:',
          '1.  Tap  "Open in Chrome"  below',
          '2.  Tap  📲 Install app  again there',
        ], { label: 'Open in Chrome', onTap: () => { location.href = openInChromeUrl(); } });
      } else if (r === 'unavailable') {
        notice(this, 'INSTALL', ['Open your browser menu  ⋮  and choose', '"Install app" or "Add to Home screen".']);
      }
    });
  }

  private exitApp(): void {
    if (this.scale.isFullscreen && !isInstalled()) { this.scale.stopFullscreen(); return; }
    tryCloseApp().then((closed) => {
      if (!closed) notice(this, 'CLOSE THE GAME', ['Swipe up, or use your phone\'s Home or', 'Back button. Your progress is saved.']);
    });
  }
}
