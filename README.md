# Iron Horizon

Playable top-down WW2-inspired battleship combat prototype built with Vite, TypeScript, and Phaser 3.

## What is implemented

- Main menu
- Nation select for USA, Japan, Germany, and U.K.
- Battle scenario with:
  - representative Tier IX battleship per nation
  - 2 enemy surface ships
  - periodic aircraft threats
  - manual main battery aiming/fire
  - auto-firing secondaries and AA
  - `Ctrl`-click priority targeting for secondaries and AA
  - torpedoes on torpedo-equipped ships only
  - fires, flooding, repair party, reloads, health bars, zoom
- Options menu with persisted local-storage settings
- Procedural placeholder art plus [ART_ASSET_REQUESTS.md](./ART_ASSET_REQUESTS.md) for a future image-generation pass

## Important note on data

The supplied CSV covered authoritative hull handling and detection data. That data is wired directly into movement, concealment feel, and hull baselines.

The prompt referenced weapon and shell tables, but those tables were not included in the provided payload. Because of that, `src/data/weapons.ts` contains typed prototype weapon, AA, torpedo, and survivability values chosen to create a coherent playable slice around the provided hull stats. The repo keeps those values centralized so they can be replaced with authoritative tables later without rewriting systems.

## Run

```bash
npm install
npm run dev
```

## Controls

- `W` / `Up`: increase throttle
- `S` / `Down`: decrease throttle / reverse
- `A` / `Left`: rudder left
- `D` / `Right`: rudder right
- `1`: AP
- `2`: HE
- `3`: torpedo mode
- `Left click`: fire main battery at cursor
- `Right click`: launch torpedo spread
- `Ctrl` + click ship: secondary priority target
- `Ctrl` + click aircraft: AA priority target
- `R`: repair party
- Mouse wheel: zoom
- `Esc`: back to menu

## Files

- `src/data/ships.ts`: normalized supplied hull data
- `src/data/weapons.ts`: prototype weapon/survivability data
- `src/config/balance.ts`: central balance constants
- `src/systems/`: movement, damage, targeting, AA, torpedoes, battle sim
- `src/scenes/`: main menu, nation select, options, credits, battle

## Verification

```bash
npm run build
npm run verify:prototype
```

The verifier checks:

1. Main guns damage enemies
2. Enemies damage the player
3. Secondaries auto-fire
4. `Ctrl`-click secondary priority
5. AA engages aircraft
6. `Ctrl`-click AA priority
7. Torpedoes only on equipped ships
8. Torpedoes deal meaningful damage and cause flooding
9. Fire/flood DOT ticks and expires
10. Default scenario is winnable with reasonable play
11. Ignoring threats can still lose the scenario
