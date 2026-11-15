import Phaser from 'phaser';
import { GAME_W, COLORS } from '../config.ts';
import { button, muteButton, text, unitCard } from '../ui.ts';
import { stage as getStage, type Stage } from '../battle/stages.ts';
import { ABILITIES, BONUS_INFO, teamBonuses, type UnitDef } from '../battle/units.ts';
import { loadTeam, roster, saveTeam } from '../state.ts';
import { sfx } from '../systems/audio.ts';

const SLOT_X = [130, 360, 590];
const SLOT_Y = 470;
const BENCH_TOP = 740, BENCH_BOTTOM = 1154; // the Fight button sits below

/** Pick 3 units: tap a card below to add it, tap a team card to take it out. Shows the stage's enemies. */
export class TeamScene extends Phaser.Scene {
  private st!: Stage;
  private team: (UnitDef | null)[] = [];
  private slotCards: (Phaser.GameObjects.Container | null)[] = [null, null, null];
  private benchCards = new Map<string, { card: Phaser.GameObjects.Container; tick: Phaser.GameObjects.Text }>();
  private bonusText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private fight!: ReturnType<typeof button>;

  constructor() { super('Team'); }

  init(data: { stage?: number }): void {
    this.st = getStage(data.stage ?? 1);
    this.team = loadTeam();
    this.slotCards = [null, null, null];
    this.benchCards.clear();
  }

  create(): void {
    this.add.image(GAME_W / 2, 640, 'bg.arena').setAlpha(0.35);
    button(this, 70, 50, '‹', () => this.scene.start('Menu'), 90, 64, COLORS.panel, 40);
    text(this, GAME_W / 2, 50, `STAGE ${this.st.n} · ${this.st.name.toUpperCase()}`, 28, '#ffffff', '900').setOrigin(0.5);
    muteButton(this, GAME_W - 50, 50);

    // Enemy preview
    this.add.rectangle(GAME_W / 2, 175, 680, 150, 0x3a1020, 0.55).setStrokeStyle(2, 0xe63946, 0.4);
    text(this, 34, 108, 'ENEMIES', 18, '#ff8fa3', '800');
    const n = this.st.enemies.length;
    this.st.enemies.forEach((e, i) => {
      const x = GAME_W / 2 + (i - (n - 1) / 2) * 150;
      const s = this.add.sprite(x, 222, `unit.${e.art}.idle`).setOrigin(0.5, 1).setFlipX(true).setScale(0.8 * e.size).play(`unit.${e.art}.idle`);
      s.anims.setProgress(i * 0.3);
      text(this, x, 236, e.boss ? `${e.name} 👑` : e.name, 17, '#ffd0d8', '700').setOrigin(0.5);
    });

    text(this, 34, 272, 'YOUR TEAM', 18, '#9fe8ff', '800');
    SLOT_X.forEach((x) => this.add.image(x, SLOT_Y, 'ui.slot').setScale(0.95));
    this.bonusText = text(this, GAME_W / 2, 632, '', 20, '#9fe8ff', '700').setOrigin(0.5).setAlign('center').setWordWrapWidth(680);
    this.infoText = text(this, GAME_W / 2, 672, 'Tap a card below to add it. Tap a team card to take it out.', 18, COLORS.dim, '600').setOrigin(0.5).setAlign('center').setWordWrapWidth(660);

    this.bench();
    this.team.forEach((u, i) => this.placeCard(i, u));
    this.fight = button(this, GAME_W / 2, 1212, '⚔  FIGHT', () => this.go(), 460, 92, COLORS.accent, 38);
    this.refresh();
    this.input.keyboard?.once('keydown-SPACE', () => this.go());
  }

  /** Your unit cards (NFT units first), in a list that scrolls by drag or mouse wheel when it is taller than the space. */
  private bench(): void {
    const units = roster();
    const nNft = units.filter((u) => u.source === 'nft').length;
    text(this, 34, 712, nNft ? `YOUR UNITS · ${nNft} from your NFTs` : 'YOUR UNITS', 18, '#d9d0ff', '800');
    const perRow = units.length > 6 ? 5 : 3, scale = perRow === 5 ? 0.6 : 0.68;
    const cw = 192 * scale + 14, ch = 288 * scale + 12;
    const box = this.add.container(0, 0);
    units.forEach((u, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const inRow = Math.min(perRow, units.length - row * perRow);
      const x = GAME_W / 2 + (col - (inRow - 1) / 2) * cw;
      const y = BENCH_TOP + ch / 2 + row * ch;
      const card = unitCard(this, x, y, u, scale);
      const tick = text(this, x, y, '✓', 72, '#ffffff', '900').setOrigin(0.5).setStroke('#000000', 8).setVisible(false);
      card.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
        // a tap, not the end of a scroll, and inside the visible part of the list
        if (Math.abs(p.upY - p.downY) < 14 && p.y >= BENCH_TOP && p.y <= BENCH_BOTTOM) this.toggle(u);
      });
      box.add([card, tick]);
      this.benchCards.set(u.uid, { card, tick });
    });

    const contentH = Math.ceil(units.length / perRow) * ch + 6;
    const maxScroll = Math.max(0, contentH - (BENCH_BOTTOM - BENCH_TOP));
    if (!maxScroll) return;
    const shape = this.make.graphics({}, false).fillRect(0, BENCH_TOP - 4, GAME_W, BENCH_BOTTOM - BENCH_TOP + 4);
    box.setMask(shape.createGeometryMask());
    const hint = text(this, GAME_W - 34, 712, '▼ drag for more', 18, '#9fe8ff', '700').setOrigin(1, 0);
    let scroll = 0, from = 0;
    const setScroll = (v: number) => {
      scroll = Phaser.Math.Clamp(v, 0, maxScroll);
      box.y = -scroll;
      hint.setText(scroll >= maxScroll - 1 ? '▲ drag back up' : '▼ drag for more');
    };
    const inBench = (p: Phaser.Input.Pointer) => p.downY >= BENCH_TOP && p.downY <= BENCH_BOTTOM;
    this.input.on('pointerdown', () => { from = scroll; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && inBench(p) && Math.abs(p.y - p.downY) > 12) setScroll(from - (p.y - p.downY));
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => setScroll(scroll + dy * 0.6));
  }

  private toggle(u: UnitDef): void {
    const at = this.team.findIndex((t) => t?.uid === u.uid);
    if (at >= 0) { this.remove(at); return; }
    const free = this.team.findIndex((t) => !t);
    this.describe(u);
    if (free < 0) { sfx.count(); this.infoText.setText(`Team is full. Tap a team card to take it out first.\n${this.infoText.text}`); return; }
    sfx.tap();
    this.team[free] = u;
    this.placeCard(free, u);
    this.refresh();
  }

  private remove(i: number): void {
    sfx.tap();
    this.team[i] = null;
    this.slotCards[i]?.destroy();
    this.slotCards[i] = null;
    this.refresh();
  }

  private placeCard(i: number, u: UnitDef | null): void {
    this.slotCards[i]?.destroy();
    this.slotCards[i] = null;
    if (!u) return;
    const card = unitCard(this, SLOT_X[i], SLOT_Y, u, 0.95);
    card.setInteractive({ useHandCursor: true }).on('pointerup', () => this.remove(i));
    card.setScale(0.6);
    this.tweens.add({ targets: card, scale: 0.95, duration: 180, ease: 'Back.Out' });
    this.slotCards[i] = card;
  }

  private describe(u: UnitDef): void {
    const ab = u.ability ? `${ABILITIES[u.ability].name}: ${ABILITIES[u.ability].text}` : '';
    this.infoText.setText(`${u.rarity} ${u.name}. ${ab}`);
  }

  private refresh(): void {
    const team = this.team.filter((u): u is UnitDef => !!u);
    for (const [uid, b] of this.benchCards) {
      const on = team.some((t) => t.uid === uid);
      b.card.setAlpha(on ? 0.4 : 1);
      b.tick.setVisible(on);
    }
    const bonuses = teamBonuses(team);
    if (bonuses.length) {
      this.bonusText.setColor('#ffc94d').setText(bonuses.map((b) =>
        `◆ ${b.collection.name} ×${b.count}: +${Math.round(b.pct * 100)}% ${BONUS_INFO[b.kind].stat} ${BONUS_INFO[b.kind].icon}${b.startEnergy ? ', abilities start half charged' : ''}`).join('\n'));
    } else {
      this.bonusText.setColor('#9fe8ff').setText('Collection bonus: 2+ units from one NFT collection buff the team');
    }
    this.fight.setEnabled(team.length === 3);
  }

  private go(): void {
    const team = this.team.filter((u): u is UnitDef => !!u);
    if (team.length !== 3) return;
    saveTeam(team);
    this.scene.start('Battle', { stage: this.st.n, team });
  }
}
