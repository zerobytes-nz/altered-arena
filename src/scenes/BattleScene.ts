import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, DEBUG } from '../config.ts';
import { button, muteButton, text } from '../ui.ts';
import { stage as getStage, type Stage } from '../battle/stages.ts';
import { ABILITIES, BONUS_INFO, type UnitDef } from '../battle/units.ts';
import { Battle, STEP, SUDDEN_DEATH_AT, TIME_LIMIT, type BEvent, type Fighter, type Projectile, type State } from '../battle/sim.ts';
import { animSeconds } from '../assets.ts';
import { sfx, startMusic, stopMusic } from '../systems/audio.ts';

const BAR_W = 70;

interface View {
  f: Fighter;
  spr: Phaser.GameObjects.Sprite;
  shadowY: number;
  hpBg: Phaser.GameObjects.Rectangle;
  hp: Phaser.GameObjects.Rectangle;
  hpLag: Phaser.GameObjects.Rectangle;
  en: Phaser.GameObjects.Rectangle;
  stun: Phaser.GameObjects.Sprite;
  anim: string;
  flashT: number;
  lagHp: number;
  deadT: number;
}

/** Draws a Battle. The sim runs at a fixed 60 Hz; this scene only turns its state and events into pictures and sound. */
export class BattleScene extends Phaser.Scene {
  private st!: Stage;
  private team!: UnitDef[];
  private battle!: Battle;
  private views = new Map<number, View>();
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private shotPool: Phaser.GameObjects.Image[] = [];
  private fxPool: Phaser.GameObjects.Sprite[] = [];
  private numPool: Phaser.GameObjects.Text[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private timerText!: Phaser.GameObjects.Text;
  private shownSec = -1;
  private acc = 0;
  private speed = 1;
  private started = false;
  private ended = false;
  private lastSfx: Record<string, number> = {};
  private fpsText?: Phaser.GameObjects.Text;

  constructor() { super('Battle'); }

  init(data: { stage: number; team: UnitDef[] }): void {
    this.st = getStage(data.stage);
    this.team = data.team;
    this.views.clear(); this.shots.clear();
    this.shotPool = []; this.fxPool = []; this.numPool = [];
    this.acc = 0; this.started = false; this.ended = false; this.shownSec = -1; this.lastSfx = {};
  }

  create(): void {
    this.add.image(GAME_W / 2, GAME_H / 2, 'bg.arena');
    this.battle = new Battle(this.team, this.st.enemies, (Date.now() & 0xffff) + 1);
    for (const f of this.battle.fighters) this.addView(f);

    this.sparks = this.add.particles(0, 0, 'fx.dot', {
      lifespan: { min: 250, max: 500 }, speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 },
      gravityY: 400, emitting: false,
    }).setDepth(5000);

    // HUD
    text(this, 30, 40, `STAGE ${this.st.n}`, 22, '#ff8fa3', '900');
    text(this, 30, 70, this.st.name, 20, COLORS.dim, '700');
    this.timerText = text(this, GAME_W / 2, 70, '0:30', 48, '#ffffff', '900').setOrigin(0.5).setStroke('#000000', 6).setDepth(6000);
    muteButton(this, GAME_W - 50, 60).setDepth(6000);
    const sp = button(this, GAME_W - 140, 60, '×1', () => { this.speed = this.speed === 1 ? 2 : 1; sp.label.setText(`×${this.speed}`); }, 90, 60, COLORS.panel, 28);
    sp.setDepth(6000);

    const bonuses = this.battle.bonuses;
    const line = bonuses.length
      ? bonuses.map((b) => `◆ ${b.collection.name}: +${Math.round(b.pct * 100)}% ${BONUS_INFO[b.kind].stat}`).join('   ')
      : 'Tap ×1 to speed up';
    text(this, GAME_W / 2, 1100, line, 20, bonuses.length ? '#ffc94d' : COLORS.dim, '700').setOrigin(0.5);
    this.teamStrip();

    if (DEBUG) this.fpsText = text(this, 30, 1240, '', 18, '#7dffcf', '700').setDepth(9999);
    this.countdown();
  }

  /** Your three units along the bottom, with live health. */
  private teamStrip(): void {
    this.battle.fighters.filter((f) => f.side === 0).forEach((f, i) => {
      const x = 130 + i * 230, y = 1190;
      this.add.rectangle(x, y, 210, 110, COLORS.panel, 0.85).setStrokeStyle(2, COLORS.panelEdge, 0.4);
      this.add.sprite(x - 60, y + 46, `unit.${f.def.art}.idle`, 0).setOrigin(0.5, 1).setScale(0.7);
      text(this, x - 10, y - 34, f.def.name, 19, '#ffffff', '800');
      if (f.def.ability) text(this, x - 10, y - 8, ABILITIES[f.def.ability].name, 15, COLORS.dim, '700');
    });
  }

  private countdown(): void {
    const t = text(this, GAME_W / 2, 610, '3', 140, '#ffffff', '900').setOrigin(0.5).setStroke('#2a1d48', 14).setDepth(7000);
    let n = 3;
    sfx.count();
    const tick = () => {
      n--;
      if (n > 0) { t.setText(String(n)); sfx.count(); this.pop(t); return; }
      t.setText('FIGHT!').setColor('#ffc94d');
      this.pop(t);
      sfx.fight();
      startMusic();
      this.started = true;
      this.tweens.add({ targets: t, alpha: 0, delay: 450, duration: 300, onComplete: () => t.destroy() });
    };
    this.pop(t);
    this.time.addEvent({ delay: 420, repeat: 2, callback: tick });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopMusic());
  }

  private pop(t: Phaser.GameObjects.Text): void { t.setScale(1.6); this.tweens.add({ targets: t, scale: 1, duration: 240, ease: 'Back.Out' }); }

  // ───────────────────────────── Views ─────────────────────────────

  private addView(f: Fighter): void {
    const key = `unit.${f.def.art}.idle`;
    const spr = this.add.sprite(f.x, f.y, key).setOrigin(0.5, 0.92).setScale(f.def.size).play({ key, startFrame: f.id % 4 });
    spr.setFlipX(f.facing < 0);
    const col = f.side === 0 ? 0x4cd16b : 0xe63946;
    const hpBg = this.add.rectangle(0, 0, BAR_W + 4, 12, 0x000000, 0.7).setOrigin(0, 0.5);
    const hpLag = this.add.rectangle(0, 0, BAR_W, 8, 0xffffff, 0.8).setOrigin(0, 0.5);
    const hp = this.add.rectangle(0, 0, BAR_W, 8, col).setOrigin(0, 0.5);
    const en = this.add.rectangle(0, 0, 0, 4, 0xffd23f).setOrigin(0, 0.5);
    const stun = this.add.sprite(0, 0, 'fx.stun').play('fx.stun').setVisible(false);
    if (f.def.boss) spr.setTint(0xffe0a0);
    const v: View = { f, spr, shadowY: 0, hpBg, hp, hpLag, en, stun, anim: key, flashT: 0, lagHp: f.hp, deadT: 0 };
    this.views.set(f.id, v);
    if (f.def.size < 1) { spr.setScale(0.2); this.tweens.add({ targets: spr, scale: f.def.size, duration: 250, ease: 'Back.Out' }); }
  }

  private play(v: View, state: State | 'attack', force = false): void {
    const key = `unit.${v.f.def.art}.${state}`;
    if (!force && v.anim === key) return;
    v.anim = key;
    v.spr.play(key);
    if (state === 'attack') v.spr.anims.timeScale = Math.max(1, animSeconds(key) / (1 / (v.f.spd * v.f.spdMul)));
    else v.spr.anims.timeScale = state === 'walk' ? Math.max(0.6, v.f.move / 100) : 1;
  }

  private sync(dtMs: number): void {
    for (const v of this.views.values()) {
      const f = v.f, s = f.def.size;
      v.spr.setPosition(f.x, f.y).setDepth(f.y).setFlipX(f.facing < 0);
      if (f.alive) {
        if (f.state !== 'attack' && !(v.anim.endsWith('.attack') && v.spr.anims.isPlaying)) this.play(v, f.state);
      } else {
        v.deadT += dtMs;
        if (v.deadT > 900) v.spr.setAlpha(Math.max(0.35, 1 - (v.deadT - 900) / 600));
      }
      if (v.flashT > 0 && (v.flashT -= dtMs) <= 0) { if (f.def.boss) v.spr.setTint(0xffe0a0); else v.spr.clearTint(); }
      // bars above the head
      const top = f.y - 112 * s - 6, bx = f.x - BAR_W / 2;
      const vis = f.alive;
      v.hpBg.setVisible(vis).setPosition(bx - 2, top).setDepth(4000);
      v.hpLag.setVisible(vis).setPosition(bx, top).setDepth(4001);
      v.hp.setVisible(vis).setPosition(bx, top).setDepth(4002);
      v.en.setVisible(vis && !!f.def.ability).setPosition(bx, top + 8).setDepth(4002);
      v.hp.width = (BAR_W * f.hp) / f.maxHp;
      v.lagHp = Math.max(f.hp, v.lagHp - (f.maxHp * dtMs) / 900);
      v.hpLag.width = (BAR_W * v.lagHp) / f.maxHp;
      v.en.width = (BAR_W * f.energy) / 100;
      v.en.fillColor = f.energy >= 100 ? 0xffffff : 0xffd23f;
      v.stun.setVisible(f.alive && f.stun > 0).setPosition(f.x, top - 18).setDepth(4003);
    }
    // projectiles
    for (const p of this.battle.projectiles) {
      const img = this.shots.get(p.id);
      if (!img) continue;
      const tx = p.target.x, ty = p.target.y - 45 * p.target.def.size;
      img.setPosition(p.x, p.y).setRotation(Math.atan2(ty - p.y, tx - p.x)).setDepth(p.y + 50);
    }
    for (const [id, img] of this.shots) {
      if (!this.battle.projectiles.some((p) => p.id === id)) { img.setVisible(false); this.shotPool.push(img); this.shots.delete(id); }
    }
  }

  // ───────────────────────────── Effects ─────────────────────────────

  private fx(key: string, x: number, y: number, scale = 1, tint?: number): void {
    const s = this.fxPool.pop() ?? this.add.sprite(0, 0, key);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { s.setVisible(false); this.fxPool.push(s); });
    s.setTexture(key).setPosition(x, y).setScale(scale).setVisible(true).setAlpha(1).setDepth(4500);
    if (tint !== undefined) s.setTint(tint); else s.clearTint();
    s.play(key);
  }

  private ring(x: number, y: number, tint: number, r = 80): void {
    const s = this.fxPool.pop() ?? this.add.sprite(0, 0, 'fx.ring');
    s.setTexture('fx.ring').setPosition(x, y).setTint(tint).setVisible(true).setAlpha(0.9).setScale(0.2).setDepth(4400);
    this.tweens.add({ targets: s, scale: r / 64, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => { s.setVisible(false); this.fxPool.push(s); } });
  }

  private number(x: number, y: number, s: string, color: string, big = false): void {
    const t = this.numPool.pop() ?? text(this, 0, 0, '', 28, '#ffffff', '900').setOrigin(0.5).setStroke('#000000', 5);
    t.setText(s).setColor(color).setFontSize(big ? 38 : 28).setPosition(x + (Math.random() - 0.5) * 24, y).setAlpha(1).setVisible(true).setDepth(5500).setScale(big ? 1.3 : 1);
    this.tweens.add({ targets: t, y: y - 60, scale: 1, duration: 650, ease: 'Cubic.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 400, duration: 250, onComplete: () => { t.setVisible(false); this.numPool.push(t); } });
  }

  private burst(x: number, y: number, tint: number, n: number): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(n, x, y);
  }

  /** At most one of each sound per 60 ms, so a volley doesn't turn into noise. */
  private snd(name: string, f: () => void): void {
    const now = this.time.now;
    if ((this.lastSfx[name] ?? 0) + 60 > now) return;
    this.lastSfx[name] = now;
    f();
  }

  private banner(s: string, color: string, y = 610): Phaser.GameObjects.Text {
    const t = text(this, GAME_W / 2, y, s, 64, color, '900').setOrigin(0.5).setStroke('#1a1030', 10).setDepth(7000);
    this.pop(t);
    return t;
  }

  private handle(e: BEvent): void {
    switch (e.t) {
      case 'attack': {
        const v = this.views.get(e.f.id);
        if (v) this.play(v, 'attack', true);
        break;
      }
      case 'damage': {
        const v = this.views.get(e.f.id);
        const hy = e.f.y - 55 * e.f.def.size;
        this.number(e.f.x, e.f.y - 120 * e.f.def.size, e.crit ? `${e.amount}!` : String(e.amount), e.crit ? '#ffd23f' : e.f.side === 0 ? '#ff8fa3' : '#ffffff', e.crit);
        if (v) { v.spr.setTintFill(0xffffff); v.flashT = 70; }
        if (e.src.range < 150 && !e.ability) this.fx('fx.slash', e.f.x, hy, e.crit ? 1.3 : 1);
        this.burst(e.f.x, hy, e.f.side === 0 ? 0xff8fa3 : 0xfff1c0, e.crit ? 10 : 5);
        if (e.crit) this.cameras.main.shake(90, 0.004);
        this.snd('hit', () => (e.crit ? sfx.smash() : sfx.slash()));
        break;
      }
      case 'heal':
        this.number(e.f.x, e.f.y - 120 * e.f.def.size, `+${e.amount}`, '#7dffcf');
        this.fx('fx.heal', e.f.x, e.f.y - 40 * e.f.def.size);
        this.snd('heal', sfx.heal);
        break;
      case 'cast': {
        const v = this.views.get(e.f.id);
        if (v && e.ability !== 'split') this.play(v, 'attack', true);
        const t = text(this, e.f.x, e.f.y - 150 * e.f.def.size, ABILITIES[e.ability].name + '!', 24, e.f.side === 0 ? '#ffe58a' : '#ffb0b8', '900').setOrigin(0.5).setStroke('#000000', 5).setDepth(5600);
        this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, delay: 500, duration: 400, onComplete: () => t.destroy() });
        this.ring(e.f.x, e.f.y - 40 * e.f.def.size, e.f.side === 0 ? 0xffe58a : 0xff6b81, 70);
        this.snd('cast', sfx.cast);
        break;
      }
      case 'stun': this.snd('stun', sfx.clang); break;
      case 'blink':
        this.burst(e.fromX, e.fromY - 50, 0xb084ff, 12);
        this.burst(e.f.x, e.f.y - 50, 0xb084ff, 12);
        this.snd('blink', sfx.whistle);
        break;
      case 'shot': this.addShot(e.p); this.snd('shot', e.p.kind === 'arrow' ? sfx.throw : sfx.zap); break;
      case 'boom':
        this.fx('fx.explosion', e.x, e.y - 30, e.r / 60, e.kind === 'slam' ? 0xc8b89a : undefined);
        this.ring(e.x, e.y, e.kind === 'slam' ? 0xd9c8a0 : 0xff8a3d, e.r);
        this.cameras.main.shake(160, 0.008);
        this.snd('boom', e.kind === 'slam' ? sfx.stomp : sfx.crash);
        break;
      case 'buff': this.ring(e.f.x, e.f.y - 40, e.kind === 'atk' ? 0xff6b3d : 0xffe066, 55); this.snd('buff', sfx.buff); break;
      case 'spawn': this.addView(e.f); break;
      case 'die': {
        const v = this.views.get(e.f.id);
        if (v) this.play(v, 'dead', true);
        this.burst(e.f.x, e.f.y - 40, 0xffffff, 14);
        this.snd('die', sfx.squish);
        break;
      }
      case 'suddenDeath': {
        const t = this.banner('SUDDEN DEATH', '#ff4d6d');
        this.timerText.setColor('#ff4d6d');
        this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() });
        this.snd('sd', sfx.hurt);
        break;
      }
      case 'end': this.finish(e.result); break;
    }
  }

  private addShot(p: Projectile): void {
    const key = p.kind === 'arrow' ? 'fx.arrow' : 'fx.orb';
    const img = this.shotPool.pop() ?? this.add.image(0, 0, key);
    img.setTexture(key).setVisible(true).setPosition(p.x, p.y);
    if (p.kind === 'fireball') img.setTint(0xff8a3d).setScale(1.6);
    else if (p.kind === 'orb') img.setTint(p.from.def.art === 'healer' ? 0x7dffcf : 0xc58bff).setScale(1);
    else img.clearTint().setScale(1);
    this.shots.set(p.id, img);
  }

  private finish(result: 'win' | 'lose'): void {
    if (this.ended) return;
    this.ended = true;
    stopMusic();
    const win = result === 'win';
    (win ? sfx.finish : sfx.die)();
    this.banner(win ? 'VICTORY!' : 'DEFEAT', win ? '#ffc94d' : '#ff4d6d');
    const survivors = this.battle.alive(0).length;
    const mvp = this.battle.fighters.filter((f) => f.side === 0).reduce((a, b) => (b.dealt + b.healed > a.dealt + a.healed ? b : a));
    const timedOut = this.battle.time >= TIME_LIMIT;
    this.time.delayedCall(1600, () => this.scene.start('Result', {
      stage: this.st.n, win, survivors, time: this.battle.time, timedOut, team: this.team,
      mvp: { uid: mvp.def.uid, dealt: Math.round(mvp.dealt), healed: Math.round(mvp.healed) },
    }));
  }

  // ───────────────────────────── Loop ─────────────────────────────

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 100);
    if (this.started && !this.battle.result) {
      this.acc += (dt / 1000) * this.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        this.battle.step();
        for (const e of this.battle.events) this.handle(e);
        this.battle.events.length = 0;
        this.acc -= STEP; steps++;
      }
      if (steps === 8) this.acc = 0;
    }
    this.sync(dt);
    const left = this.battle.time < SUDDEN_DEATH_AT ? Math.ceil(SUDDEN_DEATH_AT - this.battle.time) : Math.ceil(TIME_LIMIT - this.battle.time);
    if (left !== this.shownSec) {
      this.shownSec = left;
      this.timerText.setText(`0:${String(Math.max(0, left)).padStart(2, '0')}`);
    }
    if (this.fpsText && (this.game.loop.frame % 15) === 0) {
      this.fpsText.setText(`${this.game.loop.actualFps.toFixed(0)} fps · ${this.views.size} units · ${this.battle.projectiles.length} shots`);
    }
  }
}
