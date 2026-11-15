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
- **Ladder.** 10 stages, from *Slime Pit* to the *Golem King* boss. Clearing a stage unlocks the next. Stars = your units still standing (min 1).
  Progress and the last team are kept in `localStorage`.
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
- **Monsters:** Slime (splits once at half health), Bat (Drain), Goblin (Frenzy), Skeleton archer (Volley), Orc (War Cry), Golem (Ground Slam). Each stage adds +6% stats.

### Balance targets (checked with `npm run sim`)
`npm run sim` runs every guest team and some NFT-style teams against every stage, with 40–60 seeds each, in about 2 s.
The battle code is plain TypeScript with no Phaser, run by Node directly. Results at commit time:
- Guest teams clear stages 1–5. Good guest picks (Warrior + Healer + one more) clear stage 6. Stage 7 needs NFT units.
- Rare/Epic teams reach stages 8–9. A Rare team with the 3-collection bonus clears stage 9.
- Only Legendary teams (or very good luck) beat the stage 10 boss.
- Median battle length: about 25 s.
- Single Rare NFT units next to a Rare Knight and Cleric: Pyromancer, Frost Mage, Sniper and Duelist teams stall at stage 7 (the Golem); tune in milestone 3.

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
- Real art: the packs below in `public/assets/licensed/` (not in git). Pixel-art filtering is already handled (`pixelArt` in the manifest).
- Juice: hit-stop, a better ability banner, victory confetti, unit level-up between stages.
- Balance pass on a real phone, with players.
- Deploy to `games.theoswap.io/altered-arena` (same nginx proxy pattern as Altered Run, see README). Set the game's website to `…/?userCode=$USER_CODE`.

### 4. Optional: "Your NFT in other games"
A screen per NFT: its unit card here next to what it is in Altered Run (and any other TheoSwap game).
This needs a TheoSwap endpoint or a second config lookup. Ask before changing TheoSwap.io.

## Art and open source
The repo is **open source** (MIT). Art that may not be redistributed is never committed, using the same rails as Altered Run:
- `assets.manifest.json` is the single source of truth: every asset's key, path, size, frames, animation, use, source pack, and `pixelArt`.
- `public/assets/placeholder/`: committed original art from `scripts/placeholder-art.mjs` (byte-for-byte reproducible; CI checks it).
- `public/assets/cc0/`: committed CC0 art (none yet).
- `public/assets/licensed/`: **gitignored**, your own copies of licensed packs.
- The game picks `licensed/` → `cc0/` → `placeholder/` file by file, by exact pixel size.
- `npm run check-assets` (pre-commit hook + CI) blocks licensed files, non-CC0 files in `cc0/`, unlisted media, `.env` files and keys.
- [ASSETS.md](ASSETS.md) is generated and lists every file to supply.

**Suggested packs (download yourself; licences checked 2026-11-15, check again on download):**
- **Monsters:** [CraftPix: Free RPG Monster Sprites Pixel Art](https://craftpix.net/freebies/free-rpg-monster-sprites-pixel-art/):
  6 monsters, 128×128 frames, idle/walk/attack/hurt/death. Same frame size as the manifest, so it packs 1:1. CraftPix freebie licence: commercial use OK, no redistribution.
- **Card frames:** [Batareya: Pixel Art CCG-like Frames](https://batareya.itch.io/pixel-art-ccg-like-frames) (free pack, 25 frames, 64×96, packed 3× to 192×288).
  Commercial use OK, no redistribution.
  *Avoid* LayerLab's free "GUI – Card Frame": its licence needs written approval for NFT/blockchain use.
- **FX:** [Free Game Assets (CraftPix): Free Pixel Magic Sprite Effects Pack](https://free-game-assets.itch.io/free-pixel-magic-sprite-effects-pack):
  heal, spark, charm and more. The page gives no licence; the publisher points to the CraftPix licence.
- **Hero classes (unit-card battlers):** CraftPix freebies in the same pixel style as the monsters (licensed/, not in git). Their animation lists are not published, so check on download:
  [Knight Character Free Sprite](https://craftpix.net/freebies/knight-character-free-sprite/) Swordsman → Warrior ·
  [Free Tiny Pixel Hero Sprites with Bow Attacks](https://craftpix.net/?p=71864) → Ranger (idle/walk/attack; no hurt/death listed) ·
  [Free Wizard Sprite Sheets](https://free-game-assets.itch.io/free-wizard-sprite-sheets-pixel-art) fire mage → Mage, light magician → Healer, dark magician → Rogue (stand-in).
  No free pack found yet with all five classes and hurt/death animations. Paid fallback: [gegx Heroes & Classes](https://gegx.itch.io/heroes-classes) (€6.99, 4-direction, no hurt/death, tagged AI-assisted).
- **UI (milestone 3, CC0, so it can be committed in `cc0/`):** [Kenney Fantasy UI Borders](https://kenney.nl/assets/fantasy-ui-borders) (140 files: panels and frames)
  and [Kenney Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack) (750 files: buttons, bars, panels). Both are listed as CC0 on kenney.nl.
  Buttons and panels are drawn in code today; using these means adding 9-slice panel/button keys to the manifest.

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
