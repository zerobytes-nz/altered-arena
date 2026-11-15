import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { unitsFromItems } from '../awi.ts';
import { CLASSES, RARITIES, RARITY_COLOR, type UnitDef } from '../battle/units.ts';
import type { Profile } from '../profile.ts';
import { autoTeam, nextStage } from '../state.ts';
import { button, hex, text, unitCard } from '../ui.ts';
import { sfx } from '../systems/audio.ts';

/** NFTs that became the same card (same unit, same rarity) are shown once, ×N. */
interface Reveal { unit: UnitDef; tokens: string[] }

function group(units: UnitDef[]): Reveal[] {
  const out = new Map<string, Reveal>();
  for (const u of units) {
    const base = u.name.replace(/ #.*$/, '');
    const k = `${base}|${u.rarity}`;
    const token = u.name.slice(base.length).trim();
    const r = out.get(k);
    if (r) r.tokens.push(token); else out.set(k, { unit: u, tokens: [token] });
  }
  return [...out.values()];
}

/** One card per AWI: "Your NFT became a Legendary Mage", with a fanfare per tier. Tap for the next card. */
export class RevealScene extends Phaser.Scene {
  private profile!: Profile;
  private reveals: Reveal[] = [];
  private i = 0;
  private card?: Phaser.GameObjects.Container;
  private counter!: Phaser.GameObjects.Text;

  constructor() { super('Reveal'); }

  init(data: { profile: Profile }): void {
    this.profile = data.profile;
    this.reveals = group(unitsFromItems(this.profile.results));
    this.i = 0;
    this.card = undefined;
  }

  create(): void {
    this.add.image(GAME_W / 2, GAME_H / 2, 'bg.arena').setAlpha(0.25);
    const p = this.profile;
    const note = p.source === 'cache' ? ' · offline: last saved items' : p.source === 'demo' ? ' · sample data' : '';
    text(this, GAME_W / 2, 60, `${p.label}${note}`, 22, COLORS.dim, '600').setOrigin(0.5);
    this.counter = text(this, GAME_W / 2, 1120, '', 20, COLORS.dim, '600').setOrigin(0.5);
    button(this, GAME_W / 2, 1210, 'Skip →', () => this.done(), 260, 72, COLORS.panel, 26);

    if (!this.reveals.length) {
      text(this, GAME_W / 2, 520, 'No AWIs yet', 52, '#ffffff', '900').setOrigin(0.5);
      text(this, GAME_W / 2, 610, 'None of this player\'s NFTs are\nAltered Arena unit cards yet.\nYou\'ll fight with the free guest units.', 24, COLORS.text, '600')
        .setOrigin(0.5).setAlign('center');
      return;
    }
    this.show();
    this.input.on('pointerup', (_: unknown, over: unknown[]) => { if (!over.length) this.next(); });
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
  }

  private next(): void {
    if (this.i >= this.reveals.length - 1) { this.done(); return; }
    this.i++;
    this.show();
  }

  private show(): void {
    const { unit: u, tokens } = this.reveals[this.i];
    const tier = RARITIES.indexOf(u.rarity), rc = RARITY_COLOR[u.rarity];
    const old = this.card;
    if (old) this.tweens.add({ targets: old, x: old.x - 260, alpha: 0, duration: 200, onComplete: () => old.destroy() });

    const c = this.add.container(GAME_W / 2 + 260, 0).setAlpha(0);
    const n = tokens.length;
    const lead = text(this, 0, 170, n > 1 ? `${n} of your NFTs became` : 'Your NFT became a', 26, COLORS.text, '600').setOrigin(0.5);
    const title = text(this, 0, 225, `${u.rarity.toUpperCase()} ${u.cls ? CLASSES[u.cls].name.toUpperCase() : ''}`, 46, hex(rc), '900')
      .setOrigin(0.5).setStroke('#120d1f', 8);
    const rays = this.add.star(0, 590, 12, 150, 330, rc, tier >= 2 ? 0.35 : 0.15);
    const glow = this.add.circle(0, 590, 250, rc, tier >= 2 ? 0.3 : 0.12);
    const card = unitCard(this, 0, 590, u, 1.6);
    c.add([rays, glow, lead, title, card]);
    if (n > 1) {
      c.add(text(this, 150, 340, `×${n}`, 52, '#ffffff', '900').setOrigin(0.5).setStroke('#120d1f', 8));
      c.add(text(this, 0, 870, tokens.join('  '), 22, COLORS.dim, '600').setOrigin(0.5).setWordWrapWidth(620).setAlign('center'));
    }

    this.tweens.add({ targets: c, x: GAME_W / 2, alpha: 1, duration: 280, ease: 'Back.Out' });
    card.setScale(1.1);
    this.tweens.add({ targets: card, scale: 1.6, duration: 380, ease: 'Back.Out' });
    this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    if (tier >= 2) this.tweens.add({ targets: glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 700 });
    if (tier === 3) this.cameras.main.flash(250, 255, 220, 120);
    this.card = c;
    sfx.reveal(tier);
    this.counter.setText(`${this.i + 1} / ${this.reveals.length} · tap for next`);
  }

  private done(): void {
    autoTeam();
    this.scene.start('Team', { stage: nextStage() });
  }
}
