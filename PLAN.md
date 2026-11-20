# Altered Arena — Plan

Showcase game #2 for TheoSwap (Jira epic **THEOS-33**): a portrait auto-battler played in the phone browser.
It shows that the **same NFTs** a player already owns become **different AWIs (Altered World Items)** in different games.
In Altered Run (game #1, a landscape runner) an NFT becomes a hero skin, weapon, pet or trinket. Here it becomes a **unit card**.

Stack: **Phaser 3 + TypeScript + Vite**, static build, portrait, mobile-first, the same as Altered Run so the tooling carries over.

## How it differs from Altered Run

| | Altered Run | Altered Arena |
|---|---|---|
| Orientation | Landscape | **Portrait** (720×1280, Scale.FIT) |
| Play | Twitch: tap, swipe and dodge for 60–90 s | **Plan**: pick 3 units, then watch about 30 s of auto-battle |
| Progress | High score | **Ladder of 10 stages**, 1–3 stars each |
| What an NFT becomes | One of 4 equipment slots | **A unit card**: class, rarity, attack/health/speed, one ability |
| Look | Bright side-scroller | Dark arena, cards with rarity frames, top-vs-bottom battle |

## Game design

- **Team builder.** You see the stage's enemies, then fill 3 slots from your unit cards. Tap a card to add it and tap a team card to take it out.
- **Battle (about 20–30 s).** Your 3 units start at the bottom and the enemies at the top. Each unit walks to the nearest enemy and attacks when in range.
  Every attack made and every hit taken charges **energy**. At 100 the unit casts its **one ability**.
  At 30 s **sudden death** starts and damage ramps up. At 45 s the side with more of its health left wins.
  ×1/×2 speed button.
- **Rows.** Slot 1 on the team screen is the **front**: that unit stands forward and takes 20% less damage. Slots 2–3 are the back row.
  Enemies line up the same way (mirrored).
- **Tap to cast.** When a unit's ability is charged its team-strip card glows **TAP!**. Tap it (or the unit) to cast now at **+15% power**
  ("WELL TIMED"). If you don't, it casts by itself after 3 s, so hands-off play still works. Enemies always cast at once.
- **Ladder.** 10 stages, from *Lizard Marsh* to the *Dragon King* boss. Clearing a stage unlocks the next. Stars = your units still standing (min 1).
  Progress and the last team are kept in `localStorage`. Each team screen shows a **💡 counter tip** for the stage, and a ★ on the cards whose ability is good against it.
- **Ladder run: pick 1 of 3 rewards.** Each time you clear a stage further than your run has reached, pick a reward
  (+20% attack / +25% health / +20% speed for one unit, +8% attack and health for the team, or abilities start 40% charged).
  Rewards stack and last until you **lose** a ladder fight (or beat the Dragon King). `src/modes/run.ts`.
- **Daily challenge.** One fixed fight per UTC day (3–4 monsters, same seed for everyone). Keeps your best stars and time; *Share result* sends "★★★ in 15 s". `src/modes/daily.ts`.
- **Friend battles.** Your team as a 7-character code (`ABC-1234`, also a `?vs=CODE` link). Your friend types it in (menu → *Friend battle*) or opens the link
  and fights your team, with its collection bonus. No server needed. `src/modes/teamcode.ts`.
- **Unit cards (AWIs).** Each card has a **class**, a **rarity tier**, **attack / health / speed** and **one ability**:

  | Class | Role | Ability |
  |---|---|---|
  | Warrior | Tank, melee | **Shield Bash**: big hit + stun |
  | Ranger | Ranged | **Volley**: 5 arrows at random enemies (+1 Epic, +2 Legendary) |
  | Mage | Area damage | **Fireball**: explodes on the target and burns everyone near it |
  | Healer | Support | **Mend**: heals the most hurt ally (Legendary: the whole team) |
  | Rogue | Assassin, crits | **Backstab**: blinks behind the weakest enemy and strikes |

  NFT unit cards come in 10 kinds, two per class, each with its own ability: Knight (Shield Bash) / Berserker (Whirlwind),
  Archer (Volley) / Sniper (Aimed Shot), Pyromancer (Fireball) / Frost Mage (Frost Nova), Cleric (Mend) / Druid (Regrowth),
  Assassin (Backstab) / Duelist (Flurry). Guest units use the first ability of their class.

  Rarity: Common / Rare / Epic / Legendary. It gives health and attack ×1 / 1.15 / 1.32 / 1.55 and ability power ×1 / 1.1 / 1.22 / 1.4.
- **Collection bonus.** 2 units from the same NFT collection give the **whole team** +15%, and 3 give +30% with abilities starting half charged.
  Each collection always gives the same buff (Might = attack, Vigor = health, Haste = speed), picked by a hash of the collection id.
- **Guests** get 5 free Common units (one per class). Default team: Warrior, Ranger, Healer.
- **Juice:** hit-stop on crits and casts, a cast banner, a boss intro on stage 10 (camera zooms in, roar, name), victory confetti, a glowing aura under Legendary units.
- **Monsters:** Lizard (Call Kin: a little lizard joins once, at half health), Drake (Fire Bite: heals itself), Imp (Frenzy), Medusa (ranged, Volley),
  Jinn (Dark Blessing: allies hit harder), Dragon (Tail Sweep: area stun; the stage 10 boss). Each stage adds +6% stats.
  (Until 2026-11-21 these were Slime / Bat / Goblin / Skeleton / Orc / Golem, renamed to match the art; the stats did not change.)

### Balance targets (checked with `npm run sim`)
`npm run sim` runs every guest team and some NFT-style teams against every stage, with 40–60 seeds each, in about 2 s.
The battle code is plain TypeScript with no Phaser, run by Node directly. Results after the milestone 3 balance pass (auto-cast, no tapping; tapping makes every team a bit stronger):
- Guest teams clear stages 1–5; good guest picks (Warrior + Healer + one more) reach stage 6–8.
- Rare NFT teams reach stage 9 (Rare Warrior + Ranger + Healer: 53% at stage 9). Every single Rare NFT unit next to a Rare Knight and Cleric clears stage 8.
- Stage 10 (the Dragon King): Rare 0%, Epic 82%, Rare with the 3-collection bonus 100%, Rare with 4 run rewards 100%, Legendary 100%.
- Median battle length: 26 s.
- Stage order changed: Ash Peaks (dragon + medusa + jinn) is now stage 8, War Band stage 9.

So a guest demo plays well, and connecting real NFTs is visibly what gets you to the top. That is the TheoSwap pitch.

## Milestones

### 1. Core battle loop on a phone (done)
- Boot → Menu (ladder) → Team builder → Battle → Result (stars, MVP, next / replay / ladder).
- Deterministic sim (`src/battle/sim.ts`: seeded RNG, fixed 60 Hz step), drawn by `BattleScene`. Pooled projectiles, effects and damage numbers.
- Guest units, the 10-stage ladder, all 10 abilities, the collection bonus (try it with `?nft`: sample NFT-style cards from two made-up collections).
- Placeholder art for every asset, from the manifest, swappable file by file for licensed art (see *Art and open source*).
- Sound: the Web Audio synth from Altered Run plus battle sounds. No audio files.
- PWA manifest (portrait), icons, service worker, Install app / Exit buttons (the Android install-via-Chrome logic from Altered Run).
- Performance in the browser pane at phone size (375×812, WebGL): **61 fps**, JS + render **0.3 ms median / 0.7 ms p95 per frame**
  in a 6-unit stage-7 battle (`?debug` shows the FPS meter). Not yet measured on a real phone.

### 2. TheoSwap integration (done)
- **TheoSwap setup** (theoswap MCP; every write dry-run first and approved): hidden game **Altered Arena (game 8)**; free draft config
  **"Altered Arena Unit Cards" (config 16)**, the game's default, private. 10 items `unit_knight` … `unit_duelist` grouped by class,
  each with a **Rarity** attribute (21 slots: 11 Common / 6 Rare / 3 Epic / 1 Legendary, the same as Altered Run).
  **To do on the TheoSwap Developer page:** publish config 16 (and assign collections) before real players get unit cards; release the game when ready.
- **Sign-in:** menu → *Connect TheoSwap* → player code, or the deep link `?userCode=CODE` (the code is removed from the URL after use).
  `src/profile.ts` keeps the connected player (label, source, raw results) in `localStorage`.
- **Unit cards from items** (`src/awi.ts`): itemId → unit kind and ability, Rarity → tier, contract → collection, token id → name ("Frost Mage #2").
  TheoSwap's test NFTs all use the zero-address contract, which is treated as *no collection*, so demo teams don't get a free bonus.
  The collection name comes from the API if it sends one, else "Collection 0x1234…abcd". Not yet seen with real NFTs.
- **AWI reveal cards** (`RevealScene`): "Your NFT became a Legendary Mage", the card at full size, a fanfare per tier (flash for Legendary), ×N for duplicates.
  Afterwards the best 3 NFT units are put in the team.
- **Team builder:** NFT units first, then the guests, in a list that scrolls by drag or mouse wheel.
- **Demo profiles** (`src/demo.ts`): Whale `AAAAAAAA` (11 NFTs, 2 Legendary, every unit kind), Collector `BBBBBBBB` (4), New player `CCCCCCCC` (1).
  They ask TheoSwap first and fall back to the bundled copy of the same items.
- **Offline:** the last good answer per code (`theoswap.ts`), plus the profile and team in `localStorage`.
- Not checked yet: a live call with the test key (no `.env` here), and real phones.

### 3. Polish and deploy
- Done (2026-11-21): real art (below), Kenney CC0 UI (9-slice buttons and panel frames), the Frost Mage's own ice-wizard art,
  rows, tap-to-cast, counter tips, the ladder run with rewards, the daily challenge, friend battles, juice, and the balance pass above.
  Checked in the browser pane at 375×812; not yet on a real phone.
- Still to do: deploy to `games.theoswap.io/altered-arena` (same nginx proxy pattern as Altered Run, see README) and set the game's website to
  `…/?userCode=$USER_CODE`; game icon, banner and item images on TheoSwap; publish config 16 (Developer page). Balance with real players.

### 4. Optional: "Your NFT in other games"
A screen per NFT: its unit card here next to what it is in Altered Run (and any other TheoSwap game).
This needs a TheoSwap endpoint or a second config lookup. Ask before changing TheoSwap.io.

## Art and open source
The repo is **open source** (MIT). Art that may not be redistributed is never committed, using the same rails as Altered Run:
- `assets.manifest.json` is the single source of truth: every asset's key, path, size, frames, animation, use, source pack, and `pixelArt`.
- `public/assets/placeholder/`: committed original art from `scripts/placeholder-art.mjs` (byte-for-byte reproducible; CI checks it).
- `public/assets/cc0/`: committed CC0 art (Kenney UI: `ui/button.png`, `ui/panel.png`).
- `public/assets/licensed/`: **gitignored**, your own copies of licensed packs.
- The game picks `licensed/` → `cc0/` → `placeholder/` file by file, by exact pixel size.
- `npm run check-assets` (pre-commit hook + CI) blocks licensed files, non-CC0 files in `cc0/`, unlisted media, `.env` files and keys.
- [ASSETS.md](ASSETS.md) is generated and lists every file to supply.

**Packs in use (download them yourself; licences checked 2026-11-21, check again on download).**
Unzip each into its own folder under `art-src/` (gitignored), then `npm run assets:pack-arena` writes all 67 licensed files:
- **Heroes:** CraftPix [Knight Characters Free Sprite](https://craftpix.net/freebies/knight-character-free-sprite/) (silver knight → Warrior,
  bronze knight → Ranger, black knight → Rogue) and [Wizard Character Free Sprite](https://craftpix.net/freebies/wizard-character-free-sprite/)
  (fire wizard → Mage, purple wizard → Healer, ice wizard → the Frost Mage NFT unit). Cartoon art, not pixel art, so it is scaled smoothly.
- **Monsters:** CraftPix [Free RPG Monster Sprites Pixel Art](https://craftpix.net/freebies/free-rpg-monster-sprites-pixel-art/):
  lizard, small dragon (Drake), demon (Imp), medusa, jinn, dragon. Pixel art, nearest-neighbour scaling.
- **Card frames:** [Batareya: Pixel Art CCG-like Frames](https://batareya.itch.io/pixel-art-ccg-like-frames): bases 1 / 11 / 25 / 10 for
  Common / Rare / Epic / Legendary, 3×, Rare and Epic tinted blue and purple. The `.rar` needs `unrar` or `7z` (7z could not unpack 4 of its 25 frames; none of them are used).
  *Avoid* LayerLab's free "GUI – Card Frame": its licence needs written approval for NFT/blockchain use.
- **FX:** [Free Pixel Magic Sprite Effects Pack](https://free-game-assets.itch.io/free-pixel-magic-sprite-effects-pack): explosion (smoke burst, tinted in game),
  heal (hearts), stun (rune ring). Its slash is a solid white beam that hides the fighters, so the slash stays on our own art.
- CraftPix licence (all of the above, via the publisher): free for commercial use, no redistribution of the files, no AI training.
- Unit frames are 288×160 so weapon swings and death falls fit; feet stand at the frame centre, 10 px above the bottom.
  A few swings still lose their tip (rogue and healer attacks, lizard attack and death, the top of the jinn's death).
- Downloaded but not used: Free Tiny Pixel Hero Sprites with Bow Attacks, Free Wizard Sprite Sheets (pixel), both clash with the chosen heroes.
- **UI (CC0, committed in `public/assets/cc0/ui/`):** [Kenney Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack) `9-slice/Ancient/white.png` → `ui.button`
  and [Kenney Fantasy UI Borders](https://kenney.nl/assets/fantasy-ui-borders) `Border/panel-border-001.png` → `ui.panel`. Both are white, drawn as
  9-slice at 2× and tinted in code (`button()` and `frame()` in `src/ui.ts`).

## Secrets
- **No API key in commits or in the browser.** The game only calls its own server: `./api/user-items?userCode=…`.
  - In production, nginx adds the key (live key for real players, test key for the demo test codes). This is the same proxy as Altered Run.
  - In `npm run dev` / `preview`, `vite.config.ts` does the same in Node, with `THEOSWAP_API_KEY` from `.env`. The name has no `VITE_` prefix, so it is never bundled.
- `check-assets` rejects any `VITE_*KEY/SECRET/TOKEN` name, any `THEOSWAP_API_KEY` or `apiKey` use in `src/`, and hard-coded key values.
  `npm run deploy` refuses to upload a build that contains the key.

## Repo layout
```
assets.manifest.json      every art file (single source of truth)
public/assets/placeholder/  committed original art    public/assets/licensed/  gitignored real art
scripts/                  check-assets, assets-status, assets-docs, gen-placeholders, pack-frames, gen-pwa-icons, deploy, sim
src/
  battle/                 units.ts (classes, rarity, collection bonus), stages.ts (ladder), sim.ts (the battle). No Phaser.
  scenes/                 Boot, Menu (ladder), Connect, Reveal, Team, Battle, Result
  systems/                audio (Web Audio synth), install (PWA / Android via Chrome)
  state.ts                roster, team and ladder progress (localStorage)
  theoswap.ts             user-items client via the proxy, offline cache
  profile.ts              the connected player (code or demo), kept in localStorage
  awi.ts                  user-items results → unit cards
  demo.ts                 demo players: test codes + bundled sample items
  ui.ts                   buttons, unit card, notices
```
