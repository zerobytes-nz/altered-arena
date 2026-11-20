import Phaser from 'phaser';
import { ABILITIES, CLASSES, MONSTERS, RARITY_COLOR, type UnitDef } from './battle/units.ts';
import { COLORS } from './config.ts';
import { isMuted, onMuteChange, sfx, toggleMute } from './systems/audio.ts';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 26, color = COLORS.text, weight = '700') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight });
}

export type Button = Phaser.GameObjects.Container & { setEnabled(on: boolean): Button; label: Phaser.GameObjects.Text };

export function button(scene: Phaser.Scene, x: number, y: number, label: string, onTap: () => void, w = 320, h = 88, fill: number = COLORS.accent, size = 32): Button {
  const shadow = scene.add.rectangle(0, 6, w, h, 0x000000, 0.35);
  const bg = scene.add.rectangle(0, 0, w, h, fill).setStrokeStyle(4, 0xffffff, 0.3);
  const t = text(scene, 0, 0, label, size).setOrigin(0.5);
  const c = scene.add.container(x, y, [shadow, bg, t]).setSize(w, h) as Button;
  let enabled = true;
  c.label = t;
  c.setEnabled = (on: boolean) => { enabled = on; c.setAlpha(on ? 1 : 0.45); return c; };
  bg.setInteractive({ useHandCursor: true })
    .on('pointerdown', () => enabled && c.setScale(0.96))
    .on('pointerout', () => c.setScale(1))
    .on('pointerup', () => { c.setScale(1); if (!enabled) return; sfx.tap(); onTap(); });
  return c;
}

/** Round speaker button that toggles sound (also the M key). Stays in sync across scenes. */
export function muteButton(scene: Phaser.Scene, x: number, y: number, r = 30) {
  const bg = scene.add.circle(0, 0, r, 0x000000, 0.4).setStrokeStyle(2, 0xffffff, 0.35);
  const t = text(scene, 0, 1, '', Math.round(r * 0.95), '#ffffff').setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]).setSize(r * 2, r * 2);
  const draw = (m: boolean) => t.setText(m ? '🔇' : '🔊');
  draw(isMuted());
  const off = onMuteChange(draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { toggleMute(); sfx.tap(); });
  return c;
}

const CARD_FILL: Record<UnitDef['rarity'], number> = { Common: 0x24212e, Rare: 0x14263d, Epic: 0x261540, Legendary: 0x33240c };

const fmtSpd = (s: number) => s.toFixed(2).replace(/0$/, '');

/**
 * A unit card (192×288 at scale 1): frame by rarity, the unit's idle animation, name, class,
 * attack / health / speed, its ability, and its collection when it comes from an NFT.
 */
export function unitCard(scene: Phaser.Scene, x: number, y: number, u: UnitDef, scale = 1): Phaser.GameObjects.Container {
  const r = u.rarity.toLowerCase();
  const items: Phaser.GameObjects.GameObject[] = [];
  items.push(scene.add.rectangle(0, 0, 176, 272, CARD_FILL[u.rarity])); // shows through frames with an open centre
  items.push(scene.add.image(0, 0, `card.${r}`));
  const spr = scene.add.sprite(0, 6, `unit.${u.art}.idle`).setOrigin(0.5, 1).play(`unit.${u.art}.idle`);
  spr.anims.setProgress((u.uid.length * 0.37) % 1); // cards side by side don't bob in step
  items.push(spr);
  if (u.cls) items.push(scene.add.image(-68, -116, `ui.icon.${u.cls}`).setScale(0.85));
  const role = u.cls ? CLASSES[u.cls] : MONSTERS[u.art as keyof typeof MONSTERS];
  items.push(text(scene, 82, -130, u.rarity.toUpperCase(), 16, hex(RARITY_COLOR[u.rarity]), '900').setOrigin(1, 0).setStroke('#000000', 5));
  const name = text(scene, 0, 27, u.name, u.name.length > 10 ? 22 : 26, '#ffffff', '900').setOrigin(0.5).setStroke('#000000', 5);
  if (name.width > 180) name.setScale(180 / name.width); // "Frost Mage #4821"
  items.push(name);
  const stats: [string, string, string][] = [['⚔', String(u.atk), '#ffb38a'], ['♥', String(u.hp), '#ff8fa3'], ['⚡', fmtSpd(u.spd), '#ffe58a']];
  stats.forEach(([ic, v, col], i) => {
    items.push(text(scene, (i - 1) * 60, 64, `${ic}${v}`, 21, col, '900').setOrigin(0.5).setStroke('#000000', 4));
  });
  if (u.ability) items.push(text(scene, 0, 98, ABILITIES[u.ability].name, 21, '#ffffff', '800').setOrigin(0.5));
  items.push(text(scene, 0, 124, u.collection ? `◆ ${u.collection.name}` : role.role, 16, u.collection ? '#9fe8ff' : '#c9bfff', '800').setOrigin(0.5));
  const c = scene.add.container(x, y, items).setSize(192, 288).setScale(scale);
  return c;
}

/** A dimmed full-screen panel with a title, lines of text and a close tap. */
export function notice(scene: Phaser.Scene, title: string, lines: string[], action?: { label: string; onTap: () => void }): void {
  const W = scene.scale.gameSize.width, H = scene.scale.gameSize.height;
  const layer = scene.add.container(0, 0).setDepth(1000);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  const ph = 200 + lines.length * 40 + (action ? 100 : 0);
  const panel = scene.add.rectangle(W / 2, H / 2, 640, ph, COLORS.panel).setInteractive().setStrokeStyle(3, COLORS.panelEdge, 0.6);
  const top = H / 2 - ph / 2;
  layer.add([shade, panel, text(scene, W / 2, top + 50, title, 32).setOrigin(0.5)]);
  lines.forEach((l, i) => layer.add(text(scene, W / 2 - 280, top + 110 + i * 40, l, 23, COLORS.text, '600').setOrigin(0, 0.5)));
  if (action) layer.add(button(scene, W / 2, top + ph - 100, action.label, action.onTap, 320, 70, COLORS.good, 26));
  layer.add(text(scene, W / 2, top + ph - 34, 'Tap outside to close', 18, COLORS.dim, '600').setOrigin(0.5));
  shade.on('pointerup', () => layer.destroy());
}
