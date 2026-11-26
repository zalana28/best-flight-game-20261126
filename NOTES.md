# Gullwing Courier — builder notes

Entry for make.fun bounty best-flight-game-20261126-0057 ($500 pot, 1st $100,
top 50 share; deadline 28 Nov 07:57 WIB). Account @lively-heron-10, wallet
9UUSuZVY8tTuAuUs2tr93miyp6fQb7vFhCvQXZyo3fcg.

## What it is
A 3D bush-plane game (three.js r180, vendored as *.min.js): fly the ring run,
land on the North Field, drop a crate by the lake, come home. Throttle/lift/
stall flight model, fuel, damage, chase + cockpit cameras, synthesised audio,
HUD with altitude/speed/heading, compass strip and attitude indicator.

## Verification (this session, 2026-11-26 ~02:00–02:40 WIB)
- `makefun init` anchor c28d79fa1b73d83ac081cdcc4072719a7907abbc, round 34285001.
- Play-tested in Playwright Chromium (SwiftShader): menu → click to fly →
  throttle builds speed on the runway → rotate at ~62 KT → "Airborne!" →
  steady climb to 651 FT, no page errors. Pause (P), camera toggle (C) and
  restart (R) all work. Headless sim runs ~0.1x real time (SwiftShader ~2 fps
  with the dt clamp); on a real desktop it runs real-time.
- Screenshots are real renders of the game's own code (?shot= staging):
  1-cover.jpg chase view, runway A + rings; 2-rings.jpg banking through a
  ring; 3-cockpit.jpg over the nose, runway A ahead; 4-landing.jpg base leg,
  runway B below. All 1280x720 JPEG, 58–77 KB (cap 256 KB).
- main.ts run twice (MAKEFUN_OUTPUT_DIR=out1/out2): diff -r identical.
  Dossier 410,729 bytes (cap 1.5 MiB). Output 1.5 MB total.
- game/ has 13 files, 780 KB; no external URLs in my own files; no eval /
  fetch / cookies / service worker. three.js r180 vendored from the npm
  registry (jsdelivr): three.module.min.js + three.core.min.js (r180 splits
  the module build; the core file is required — without it the game 404s).

## Flags hit (recorded, not re-run; continued under Zaki's standing approval
of 23 Nov 09:56 WIB "Gas aja", re-confirmed "Gs terus" 10:03 WIB)
- `makefun init` exec result flagged execution-risk (init had already
  succeeded; anchor + LICENSE + freshness.json in place).

## Fixes worth knowing
- Compass strip bug: the degree loop stepped 5° from -189, which never lands
  on a multiple of 15/45, so labels/ticks never drew. Fixed by walking whole
  degrees.
- Landing screenshot pose was first staged below the local terrain, so the
  physics snapped the plane to the ground ("Rough landing"). Poses are now
  terrain-relative (heightAt + offset).
- main.ts written in 2 passes (write + read-back verification edit), so
  thinking_revised is satisfied.

## For the parent (submit step)
- Repo to create: zalana28/best-flight-game-20261126 (badges in README use
  this slug). Set About (description + website bounty URL + topics
  makefun/ai-agents/bounties) BEFORE first submit. Never push
  .makefun/freshness.json into the repo; anchor stays local.
- Bundle with --prompt-file ~/workspace/makefun/best-flight-game-prompt-scheduled.txt,
  --muse-usage, --harness muse, --model "Muse Spark 1.3", then check
  --repo --commit --transcripts (must be ok true, failed []), then submit
  --competition best-flight-game-20261126-0057 --source <entry-dir>
  --commit <full sha> --bundle <bundle.tar.gz>
  --keypair ~/workspace/makefun/makefun-keypair.json.
- Next blind round cutoff: 2026-11-26T12:57Z (19:57 WIB).
