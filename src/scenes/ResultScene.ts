import Phaser from 'phaser';
import { GAME_W, COLORS } from '../config.ts';
import { button, frame, notice, text, unitCard } from '../ui.ts';
import { STAGE_COUNT } from '../battle/stages.ts';
import type { UnitDef } from '../battle/units.ts';
import { recordWin } from '../state.ts';
import { sfx } from '../systems/audio.ts';
import { fightFor, ladder, type Mode } from '../modes/fight.ts';
import { addBoon, boonText, earnsPick, loadRun, offers, resetRun, type Boon } from '../modes/run.ts';
import { loadBest, recordDaily, shareText } from '../modes/daily.ts';
import { encodeTeam, shareLink } from '../modes/teamcode.ts';

interface Data {
  mode: Mode; win: boolean; survivors: number; time: number; timedOut: boolean; team: UnitDef[];
  mvp: { uid: string; dealt: number; healed: number };
}

/** Share text (and a link) with the phone's share sheet, or copy it. */
export async function share(scene: Phaser.Scene, msg: string, url?: string): Promise<void> {
  const nav = navigator as Navigator & { share?: (d: { text?: string; url?: string }) => Promise<void> };
  try {
    if (nav.share) { await nav.share({ text: msg, url }); return; }
    await navigator.clipboard.writeText(url ? `${msg} ${url}` : msg);
    notice(scene, 'Copied', [url ? 'The message and link are copied.' : 'The result is copied.', 'Paste it to a friend.']);
  } catch { /* the player closed the share sheet */ }
}

/** Victory or defeat: stars (= units still standing), the MVP card, a reward pick on the ladder, and what to do next. */
export class ResultScene extends Phaser.Scene {
  private d!: Data;
  constructor() { super('Result'); }

  create(d: Data): void {
    this.d = d;
    this.add.image(GAME_W / 2, 640, 'bg.arena').setAlpha(0.4);
    const m = d.mode, fight = fightFor(m);
    const stars = d.win ? Math.max(1, d.survivors) : 0;
    const champion = d.win && m.kind === 'ladder' && m.stage === STAGE_COUNT;

    text(this, GAME_W / 2, 140, champion ? 'ARENA CHAMPION!' : d.win ? 'VICTORY!' : 'DEFEAT', champion ? 60 : 84, d.win ? '#ffc94d' : '#ff4d6d', '900')
      .setOrigin(0.5).setStroke('#1a1030', 12);
    text(this, GAME_W / 2, 212, fight?.title ?? '', 26, COLORS.text, '700').setOrigin(0.5);
    if (d.win) this.confetti(champion ? 140 : 70);

    if (d.win) {
      for (let i = 0; i < 3; i++) {
        const s = text(this, GAME_W / 2 + (i - 1) * 110, 310, '★', 100, i < stars ? '#ffc94d' : '#3a2f58', '900').setOrigin(0.5).setStroke('#1a1030', 8).setScale(0);
        this.tweens.add({ targets: s, scale: 1, delay: 200 + i * 220, duration: 260, ease: 'Back.Out', onStart: () => i < stars && sfx.coin() });
      }
      text(this, GAME_W / 2, 392, `${d.survivors} of 3 units standing · ${d.time.toFixed(0)} s${d.timedOut ? ' (time out)' : ''}`, 22, COLORS.dim, '600').setOrigin(0.5);
    } else {
      text(this, GAME_W / 2, 300, d.timedOut ? 'Time ran out and they had more health left.' : 'Your team was knocked out.', 24, COLORS.text, '600').setOrigin(0.5);
      text(this, GAME_W / 2, 350, 'Check the 💡 tip on the team screen, and put\nyour toughest unit in the FRONT slot.', 21, COLORS.dim, '600').setOrigin(0.5).setAlign('center');
    }

    if (m.kind === 'ladder') this.ladderResult(m.stage, stars, champion);
    else if (m.kind === 'daily') this.dailyResult(stars);
    else this.friendResult(m.code);
  }

  private mvp(y: number, scale = 0.8): void {
    const d = this.d, mvp = d.team.find((u) => u.uid === d.mvp.uid);
    if (!mvp) return;
    text(this, GAME_W / 2, y - 140 * scale - 26, 'MVP', 24, '#ffc94d', '900').setOrigin(0.5);
    const card = unitCard(this, GAME_W / 2, y, mvp, scale).setScale(0.2);
    this.tweens.add({ targets: card, scale, duration: 300, delay: 300, ease: 'Back.Out' });
    const line = d.mvp.healed > d.mvp.dealt ? `${d.mvp.healed} healed` : `${d.mvp.dealt} damage${d.mvp.healed ? ` · ${d.mvp.healed} healed` : ''}`;
    text(this, GAME_W / 2, y + 144 * scale + 18, line, 22, COLORS.text, '700').setOrigin(0.5);
  }

  // ── Ladder: record the stars, offer a reward on a new best stage, end the run on a loss ──
  private ladderResult(stage: number, stars: number, champion: boolean): void {
    const d = this.d;
    if (!d.win) {
      const had = loadRun().boons.length;
      resetRun();
      if (had) text(this, GAME_W / 2, 420, `Run over: your ${had} reward${had > 1 ? 's are' : ' is'} gone. Win again to earn new ones.`, 20, '#ffb3c6', '700').setOrigin(0.5);
      this.mvp(640);
      button(this, GAME_W / 2, 990, '↻  TRY AGAIN', () => this.scene.start('Team', { mode: ladder(stage) }), 460, 96, COLORS.accent, 32);
      button(this, GAME_W / 2 - 120, 1110, '✎ Team', () => this.scene.start('Team', { mode: ladder(stage) }), 220, 80, COLORS.panel, 26);
      button(this, GAME_W / 2 + 120, 1110, '☰ Menu', () => this.scene.start('Menu'), 220, 80, COLORS.panel, 26);
      return;
    }
    const first = recordWin(stage, stars);
    if (champion) { resetRun(); this.mvp(640); text(this, GAME_W / 2, 880, 'You beat the Dragon King! Your run is complete.', 22, '#7dffcf', '800').setOrigin(0.5); }
    else if (earnsPick(stage)) { this.rewards(stage); return; }
    else { this.mvp(640); if (first) text(this, GAME_W / 2, 880, `Stage ${stage + 1} unlocked!`, 26, '#7dffcf', '800').setOrigin(0.5); }
    this.ladderButtons(stage);
  }

  private ladderButtons(stage: number): void {
    if (stage < STAGE_COUNT) {
      button(this, GAME_W / 2, 990, `▶  NEXT: STAGE ${stage + 1}`, () => this.scene.start('Team', { mode: ladder(stage + 1) }), 460, 96, COLORS.accent, 32);
      button(this, GAME_W / 2 - 120, 1110, '↻ Replay', () => this.scene.start('Team', { mode: ladder(stage) }), 220, 80, COLORS.panel, 26);
    } else {
      button(this, GAME_W / 2, 990, '↻  PLAY AGAIN', () => this.scene.start('Team', { mode: ladder(stage) }), 460, 96, COLORS.good, 32);
      button(this, GAME_W / 2 - 120, 1110, '✎ Team', () => this.scene.start('Team', { mode: ladder(stage) }), 220, 80, COLORS.panel, 26);
    }
    button(this, GAME_W / 2 + 120, 1110, '☰ Menu', () => this.scene.start('Menu'), 220, 80, COLORS.panel, 26);
  }

  /** Pick 1 of 3 rewards; it lasts until you lose. */
  private rewards(stage: number): void {
    text(this, GAME_W / 2, 470, 'CHOOSE A REWARD', 34, '#7dffcf', '900').setOrigin(0.5).setStroke('#1a1030', 8);
    text(this, GAME_W / 2, 512, 'It stays with your team until you lose a fight.', 19, COLORS.dim, '600').setOrigin(0.5);
    const picks = offers(this.d.team);
    const cards: Phaser.GameObjects.Container[] = [];
    const choose = (b: Boon | null) => {
      addBoon(stage, b);
      sfx.buff();
      cards.forEach((c) => c.disableInteractive());
      this.scene.start('Team', { mode: ladder(Math.min(STAGE_COUNT, stage + 1)) });
    };
    picks.forEach((b, i) => {
      const y = 600 + i * 130;
      const c = this.add.container(GAME_W / 2, y).setSize(600, 112);
      const icon = b.kind === 'atk' ? '⚔' : b.kind === 'hp' ? '♥' : b.kind === 'spd' ? '⚡' : b.kind === 'charge' ? '🔋' : '📯';
      c.add(this.add.rectangle(0, 0, 600, 112, COLORS.panel, 0.95));
      c.add(frame(this, 0, 0, 600, 112, 0x7dffcf));
      c.add(text(this, -250, 0, icon, 48, '#ffffff', '900').setOrigin(0.5));
      const t = text(this, -200, 0, boonText(b), 24, COLORS.text, '800').setOrigin(0, 0.5).setWordWrapWidth(430);
      if (t.height > 90) t.setScale(90 / t.height);
      c.add(t);
      c.setInteractive({ useHandCursor: true }).on('pointerup', () => choose(b));
      c.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, delay: 500 + i * 150, duration: 260, ease: 'Back.Out' });
      cards.push(c);
    });
    text(this, GAME_W / 2, 1000, 'Tap a reward to carry on to the next stage', 20, COLORS.dim, '600').setOrigin(0.5);
    button(this, GAME_W / 2, 1110, '☰ Menu (skip the reward)', () => { addBoon(stage, null); this.scene.start('Menu'); }, 420, 72, COLORS.panel, 22);
  }

  // ── Daily: keep today's best and share it ──
  private dailyResult(stars: number): void {
    const best = recordDaily(stars, this.d.time);
    if (best && this.d.win) text(this, GAME_W / 2, 430, "New best for today!", 24, '#7dffcf', '800').setOrigin(0.5);
    this.mvp(660);
    const b = loadBest();
    if (b) button(this, GAME_W / 2, 990, '📤  SHARE RESULT', () => share(this, shareText(b), `${location.origin}${location.pathname}`), 460, 96, COLORS.good, 30);
    button(this, GAME_W / 2 - 120, 1110, '↻ Try again', () => this.scene.start('Team', { mode: this.d.mode }), 220, 80, COLORS.panel, 24);
    button(this, GAME_W / 2 + 120, 1110, '☰ Menu', () => this.scene.start('Menu'), 220, 80, COLORS.panel, 26);
  }

  // ── Friend: rematch, or dare them back with your team ──
  private friendResult(code: string): void {
    this.mvp(660);
    const mine = encodeTeam(this.d.team);
    const msg = this.d.win ? `I beat your Altered Arena team ${code}! Can you beat mine?` : `Your Altered Arena team ${code} beat me. Try mine:`;
    button(this, GAME_W / 2, 990, '📤  SEND YOUR TEAM', () => share(this, msg, shareLink(mine)), 460, 96, COLORS.good, 30);
    button(this, GAME_W / 2 - 120, 1110, '↻ Rematch', () => this.scene.start('Team', { mode: this.d.mode }), 220, 80, COLORS.panel, 24);
    button(this, GAME_W / 2 + 120, 1110, '⚔ Friends', () => this.scene.start('Friends'), 220, 80, COLORS.panel, 24);
  }

  private confetti(n: number): void {
    const cols = [0xffc94d, 0x7dffcf, 0xff6b81, 0x9fe8ff, 0xb084ff];
    const p = this.add.particles(0, 0, 'fx.px', {
      x: { min: 0, max: GAME_W }, y: -20, lifespan: 2600, speedY: { min: 180, max: 420 }, speedX: { min: -80, max: 80 },
      rotate: { min: 0, max: 360 }, scaleX: { min: 0.8, max: 1.6 }, scaleY: { min: 1.4, max: 2.4 }, gravityY: 120,
      tint: cols, quantity: 3, frequency: 30, emitting: true,
    }).setDepth(9000);
    this.time.delayedCall(Math.min(2500, n * 25), () => p.stop());
  }
}
