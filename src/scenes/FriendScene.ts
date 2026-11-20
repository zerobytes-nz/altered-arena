import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { button, text, unitCard } from '../ui.ts';
import { loadTeam } from '../state.ts';
import { decodeTeam, encodeTeam, shareLink } from '../modes/teamcode.ts';
import { share } from './ResultScene.ts';

/** Friend battles: send your team as a code or link, or enter a friend's code and fight their team. */
export class FriendScene extends Phaser.Scene {
  private field!: HTMLInputElement;
  private status!: Phaser.GameObjects.Text;

  constructor() { super('Friends'); }

  create(): void {
    this.add.image(GAME_W / 2, GAME_H / 2, 'bg.arena').setAlpha(0.3);
    text(this, GAME_W / 2, 90, 'FRIEND BATTLES', 48, '#ffffff', '900').setOrigin(0.5).setStroke('#2a1d48', 10);
    text(this, GAME_W / 2, 145, 'Send your team. Your friend fights it on their phone.', 21, '#c9bfff', '600').setOrigin(0.5);

    const team = loadTeam();
    const code = encodeTeam(team);
    text(this, GAME_W / 2, 210, 'YOUR TEAM CODE', 18, '#9fe8ff', '800').setOrigin(0.5);
    text(this, GAME_W / 2, 258, code, 56, '#ffc94d', '900').setOrigin(0.5).setStroke('#1a1030', 8);
    team.forEach((u, i) => unitCard(this, GAME_W / 2 + (i - 1) * 150, 420, u, 0.62));
    button(this, GAME_W / 2, 580, '📤  Send my team', () => share(this, `Can you beat my Altered Arena team ${code}?`, shareLink(code)), 440, 80, COLORS.good, 28);
    text(this, GAME_W / 2, 634, 'Change it on the team screen of any stage.', 17, COLORS.dim, '600').setOrigin(0.5);

    text(this, GAME_W / 2, 730, "FIGHT A FRIEND'S TEAM", 18, '#ff8fa3', '800').setOrigin(0.5);
    const dom = this.add.dom(GAME_W / 2, 800).createFromHTML(
      '<input type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="9" placeholder="ABC-1234" ' +
      'style="width:440px;height:76px;box-sizing:border-box;padding:0 18px;font:800 34px system-ui,sans-serif;letter-spacing:4px;text-align:center;' +
      'text-transform:uppercase;color:#fff;background:#120d1f;border:4px solid #e63946;border-radius:12px;outline:none;user-select:text;-webkit-user-select:text">');
    this.field = dom.node.querySelector('input') as HTMLInputElement;
    this.field.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.fight(); });
    button(this, GAME_W / 2, 900, '⚔  Fight their team', () => this.fight(), 440, 84, COLORS.accent, 30);
    this.status = text(this, GAME_W / 2, 970, '', 20, '#ffb3c6', '600').setOrigin(0.5);

    button(this, GAME_W / 2, 1200, '← Back', () => this.leave('Menu'), 260, 72, COLORS.panel, 26);
  }

  private fight(): void {
    const raw = this.field.value.replace(/[^0-9a-z]/gi, '').toUpperCase();
    if (!decodeTeam(raw)) { this.status.setText('That is not a team code (7 letters and digits, like ABC-1234).'); return; }
    this.leave('Team', { mode: { kind: 'friend', code: `${raw.slice(0, 3)}-${raw.slice(3)}` } });
  }

  private leave(key: string, data?: object): void { this.field.blur(); this.scene.start(key, data); }
}
