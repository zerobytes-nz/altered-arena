import Phaser from 'phaser';
import { GAME_W, COLORS } from '../config.ts';
import { button, text, unitCard } from '../ui.ts';
import { stage as getStage, STAGE_COUNT } from '../battle/stages.ts';
import type { UnitDef } from '../battle/units.ts';
import { recordWin } from '../state.ts';
import { sfx } from '../systems/audio.ts';

interface Data {
  stage: number; win: boolean; survivors: number; time: number; timedOut: boolean; team: UnitDef[];
  mvp: { uid: string; dealt: number; healed: number };
}

/** Victory or defeat: stars (= units still standing), the MVP card, and what to do next. */
export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(d: Data): void {
    this.add.image(GAME_W / 2, 640, 'bg.arena').setAlpha(0.4);
    const st = getStage(d.stage);
    const champion = d.win && d.stage === STAGE_COUNT;
    const stars = d.win ? Math.max(1, d.survivors) : 0;
    const first = d.win ? recordWin(d.stage, stars) : false;

    text(this, GAME_W / 2, 150, champion ? 'ARENA CHAMPION!' : d.win ? 'VICTORY!' : 'DEFEAT', champion ? 60 : 84, d.win ? '#ffc94d' : '#ff4d6d', '900')
      .setOrigin(0.5).setStroke('#1a1030', 12);
    text(this, GAME_W / 2, 225, `Stage ${d.stage} · ${st.name}`, 28, COLORS.text, '700').setOrigin(0.5);

    if (d.win) {
      for (let i = 0; i < 3; i++) {
        const s = text(this, GAME_W / 2 + (i - 1) * 110, 330, '★', 110, i < stars ? '#ffc94d' : '#3a2f58', '900').setOrigin(0.5).setStroke('#1a1030', 8).setScale(0);
        this.tweens.add({ targets: s, scale: 1, delay: 200 + i * 220, duration: 260, ease: 'Back.Out', onStart: () => i < stars && sfx.coin() });
      }
      text(this, GAME_W / 2, 420, `${d.survivors} of 3 units standing · ${d.time.toFixed(0)} s${d.timedOut ? ' (time out)' : ''}`, 22, COLORS.dim, '600').setOrigin(0.5);
    } else {
      text(this, GAME_W / 2, 330, d.timedOut ? 'Time ran out and they had more health left.' : 'Your team was knocked out.', 24, COLORS.text, '600').setOrigin(0.5);
      text(this, GAME_W / 2, 380, 'Try a different team: a Healer keeps fights going,\na Warrior holds the front line.', 21, COLORS.dim, '600').setOrigin(0.5).setAlign('center');
    }

    const mvp = d.team.find((u) => u.uid === d.mvp.uid);
    if (mvp) {
      text(this, GAME_W / 2, 480, 'MVP', 26, '#ffc94d', '900').setOrigin(0.5);
      const card = unitCard(this, GAME_W / 2, 660, mvp, 1).setScale(0.2);
      this.tweens.add({ targets: card, scale: 1, duration: 300, delay: 300, ease: 'Back.Out' });
      const line = d.mvp.healed > d.mvp.dealt ? `${d.mvp.healed} healed` : `${d.mvp.dealt} damage${d.mvp.healed ? ` · ${d.mvp.healed} healed` : ''}`;
      text(this, GAME_W / 2, 830, line, 24, COLORS.text, '700').setOrigin(0.5);
    }
    if (first && !champion) text(this, GAME_W / 2, 880, `Stage ${d.stage + 1} unlocked!`, 26, '#7dffcf', '800').setOrigin(0.5);

    const again = () => this.scene.start('Team', { stage: d.stage });
    if (d.win && d.stage < STAGE_COUNT) {
      button(this, GAME_W / 2, 990, `▶  NEXT: STAGE ${d.stage + 1}`, () => this.scene.start('Team', { stage: d.stage + 1 }), 460, 96, COLORS.accent, 32);
      button(this, GAME_W / 2 - 120, 1110, '↻ Replay', again, 220, 80, COLORS.panel, 26);
    } else {
      button(this, GAME_W / 2, 990, d.win ? '↻  PLAY AGAIN' : '↻  TRY AGAIN', again, 460, 96, d.win ? COLORS.good : COLORS.accent, 32);
      button(this, GAME_W / 2 - 120, 1110, '✎ Team', again, 220, 80, COLORS.panel, 26);
    }
    button(this, GAME_W / 2 + 120, 1110, '☰ Ladder', () => this.scene.start('Menu'), 220, 80, COLORS.panel, 26);
  }
}
