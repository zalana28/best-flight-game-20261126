# Gullwing Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zalana28/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zalana28/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Gullwing Courier is an island air-taxi flight game: a little cream-and-teal bush plane, three sorties, and a valley that does not forgive sloppy flying. Built for the make.fun best flight game bounty.

## The game

You are the courier for a chain of island airstrips. Three sorties, flown in order:

1. **Ring Run** — thread all 8 rings over the valley.
2. **Island Hop** — put her down on Runway B, the North Field.
3. **Supply Drop** — take off again and drop the crate on the marked field by the lake, then come home.

Flying rewards throttle and turn discipline: below about 50 knots the wing stops flying and the nose drops, fuel burns with the throttle, and a hard landing is a crash. Land on a runway to refuel.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/game/ in desktop Chrome. Click to fly: W/S throttle, arrow keys pitch and bank (bank to turn), Q/E rudder, hold the left mouse button to steer with the mouse, Space drops the crate, C switches chase/cockpit camera, P pauses, M mutes.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library. Two runs write identical bytes.

## Layout

- `game/index.html` — page, HUD and import map
- `game/src/main.js` — boot, game loop, camera, screenshot staging
- `game/src/flight.js` — the flight model: thrust, drag, lift, stall, landings
- `game/src/terrain.js` — island heightfield, lake, runways, trees, clouds, sky
- `game/src/aircraft.js` — the bush plane, built from primitives
- `game/src/hud.js` — altitude, speed, heading, compass, attitude indicator
- `game/src/missions.js` — rings, landings, the drop, scoring
- `game/src/audio.js` — synthesised engine, wind and chimes (Web Audio, no files)
- `game/src/controls.js` — keyboard and mouse input
- `game/src/noise.js` — seeded random numbers and value noise for the world
- `game/vendor/three.module.min.js` — vendored three.js

## License

MIT. See `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n0w15zdz&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
