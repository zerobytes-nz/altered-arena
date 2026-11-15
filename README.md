# Altered Arena

A portrait auto-battler for the phone browser (Phaser 3 + TypeScript + Vite), and TheoSwap showcase game #2.
Players' NFTs become **AWIs (Altered World Items)**: **unit cards** with a class, a rarity, attack / health / speed and
one ability. Pick 3, watch them fight for about 30 seconds, and climb a ladder of 10 stages. Two or more units from the
same NFT collection buff the whole team. See [PLAN.md](PLAN.md) for the design and milestones.

The same NFTs are hero skins and weapons in [Altered Run](https://github.com/zerobytes-nz/altered-run), game #1.

```bash
npm install      # also installs the pre-commit hook
npm run dev      # http://localhost:5181   (?debug = FPS meter, ?nft = sample cards from two collections)
npm run build    # static site in dist/
npm run sim      # balance check: every team vs every stage, no browser
```

Controls: taps only. Tap a stage, tap **Fight**, tap cards to build your team, tap **Fight** again. ×1/×2 speeds up a battle.
Keyboard: Space = Fight, M = mute.

## Art: read [ASSETS.md](ASSETS.md)

A fresh clone runs on **original placeholder art** (MIT, `public/assets/placeholder/`). Art from packs that **may not be
redistributed** (CraftPix freebies, itch.io packs) is never in this repo. [ASSETS.md](ASSETS.md) lists every file to supply
(size, frames, what it's for, which pack) and how to drop it into `public/assets/licensed/` (gitignored).

| Command | What it does |
|---|---|
| `npm run assets:status` | Which assets are licensed ● / cc0 ◆ / placeholder ○ / missing ✖ |
| `npm run assets:pack -- <key> <files…>` | Turn downloaded frames into the exact sheet the game expects (pixel art stays sharp) |
| `npm run check-assets` | Fails if licensed art, non-CC0 art in `cc0/`, unlisted media or secrets are in git (runs on pre-commit and CI) |
| `npm run assets:docs` | Regenerate ASSETS.md from `assets.manifest.json` |
| `npm run assets:placeholders` | Regenerate the placeholder art from the manifest |
| `npm run pwa:icons` | Redraw the home-screen icons in `public/icons/` (from committable art only) |

`assets.manifest.json` is the single source of truth for every image. Game code only uses manifest keys.

## Install on a phone

`npm run build` writes a service worker (offline play) and `manifest.webmanifest` (portrait, full screen). On Android,
**Install app** on the menu uses Chrome's install (other Android browsers trigger a Play Protect warning, so the game offers
"Open in Chrome" instead). On iPhone it shows the Share → Add to Home Screen steps.

## TheoSwap and secrets

Players tap **Connect TheoSwap** on the menu and enter the player code from their TheoSwap profile, or open the game
with `?userCode=CODE` (the link TheoSwap sends them to). Each NFT becomes a unit card, revealed one by one.
The three demo players (Whale, Collector, New player) use TheoSwap test codes `AAAAAAAA` / `BBBBBBBB` / `CCCCCCCC`
and fall back to the same items bundled in `src/demo.ts` when there is no key or no signal.

**No API key is ever in the browser or in git.** The game only calls its own server: `./api/user-items?userCode=…`.
- `npm run dev` / `npm run preview`: `vite.config.ts` forwards that to TheoSwap's `/api/public/user-items` and adds
  `THEOSWAP_API_KEY` from `.env` (copy `.env.example`; use the game's **test** key). The name has no `VITE_` prefix, so Vite never bundles it.
- Production: nginx does the same (below), holding the live key.
- `check-assets` rejects key-like `VITE_*` names, any key use in `src/`, and hard-coded key values. `npm run deploy` refuses to upload a build that contains the key.

## Deploy (games.theoswap.io/altered-arena)

Put `DEPLOY_TARGET=user@host:/var/www/games.theoswap.io/altered-arena/` in `.env`, then:

```bash
npm run deploy:check   # build, then list what rsync would change (uploads nothing)
npm run deploy         # build, then rsync dist/ to DEPLOY_TARGET
```

nginx, in the `games.theoswap.io` site (same pattern as Altered Run; the test codes come from the game's TheoSwap test items):

```nginx
# Top of the site file, OUTSIDE server { }:
map $arg_userCode $altered_arena_key {
    default    "LIVE_API_KEY_HERE";
    AAAAAAAA   "TEST_API_KEY_HERE";   # demo players (TheoSwap test items of game 8)
    BBBBBBBB   "TEST_API_KEY_HERE";
    CCCCCCCC   "TEST_API_KEY_HERE";
}

# Inside server { }:
location = /altered-arena/api/user-items {
    limit_except GET { deny all; }
    if ($arg_userCode !~ "^[A-Za-z0-9]{4,16}$") { return 400; }
    set $args "apiKey=$altered_arena_key&userCode=$arg_userCode";
    proxy_pass https://www.theoswap.io/api/public/user-items;
    proxy_ssl_server_name on;
    proxy_set_header Host www.theoswap.io;
    proxy_set_header X-Forwarded-For $remote_addr;
    add_header Cache-Control "no-store" always;
}
location = /altered-arena/sw.js               { add_header Cache-Control "no-cache"; }
location = /altered-arena/index.html          { add_header Cache-Control "no-cache"; }
location = /altered-arena/manifest.webmanifest { add_header Cache-Control "no-cache"; }
```

## Licence

Code and placeholder art: [MIT](LICENSE). Third-party art isn't included.
