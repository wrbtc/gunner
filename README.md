# Gunner

A desktop browser arcade flight game built with JavaScript, Three.js and Web Audio.
Fly through a volcanic canyon, destroy nests and creatures, and survive the Queen.

**Play Gunner: https://gunner.satoshis.watch/**

This is the **v0.54.56 runtime with the concept-24 / hive menu**. The Alien Field Guide creeper card uses the shipped lava remesh
(cracked basalt / molten veins, pale bone face mask, glowing eyes, knuckle-walk / cliff-climb). Bank creepers and climbers still use the lava loco skinned mesh when
`creeper-lava-loco-003.glb` is present (knuckle-walk / cliff-climb), with a single attach yaw so the +Z GLB matches −Z travel. It fits the briefing to short desktop viewports, keeps its report
controls clear of the macOS Dock, and adds the supplied Queen reveal growl and raised-arms shriek,
timed to the cinematic, and keeps menu/outcome music silent until the player
explicitly presses `PLAY MUSIC`. The right stack is Coming Soon → ammo → DEPLOY.
Typical laptops end-pack so ammo and DEPLOY sit just above the footer. Short
`html[data-app-short]` collapses Coming Soon extras and keeps a Dock inset
from window-vs-avail overlap (not layout−visual slack alone),
but still end-packs so ammo and DEPLOY hug the fold ≥8px above the Dock. Idle Deploy is ammo → DEPLOY only. `REPORT FAILED LOAD` and the copy-report
block stay hidden until `#intro.load-failed`. The production footer has no QA
disclosure. The fail-path gold
REPORT/COPY controls stay in the reserved deploy row. Diagnostics never send
data automatically. It includes the full-poster chapter presentation, complete
walkie-radio voice set, current aircraft and field guide, opening and outcome
presentation, the 24-stage loading path, bounded Safari graphics diagnostics,
and an always-visible in-flight FPS counter.
Flight Settings includes a deliberate `MASTER MODE` debug checkbox. It leaves
enemy movement, attacks, animation, collisions and player weapons running, while
preventing incoming hits from damaging the hull or applying glass splashes,
flashbang/held-frame effects, view shake, damage tint, hit particles or damage
audio. Enabling it also clears any player-hit obstruction already in progress.
Any flight that uses Master Mode is marked as a debug flight and is never offered
to the shared leaderboard.
The outer boot deadline is a stall watchdog: progress heartbeats keep a long
load alive past 60 seconds of total page time while still failing a genuinely
stalled startup.
It includes the complete game runtime, procedural geometry and shaders, models,
textures, illustrations, recorded dialogue, audio synthesis, and optional score
backend source. Three.js is vendored; no frontend build or package install is needed.

## Run locally

Use Python 3 and a desktop browser with WebGL2:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory game
```

Open **http://127.0.0.1:8000/**. Use HTTP rather than opening `index.html` directly.
The game displays its controls and field guide. Mobile devices receive a desktop
notice. Audio starts after a user gesture.

This static mode runs the game without a score server. Shared-score requests may
return 404 and are reported as unavailable. To test real score save/retry flows:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python backend/fixture_server.py game
```

Open the loopback URL printed by that command. Its score database is temporary
and discarded on exit. It connects only to a local in-process backend. Loading
failure diagnostics are enabled on the public game and at `http://127.0.0.1:8000/`.

## Development status

The v0.54.8 loading fixes received a smooth-play report on an Apple M3. A later
Safari report on an older macOS machine reached the loaded game, but the machine
was not confirmed to be Apple silicon. Apple M1 acceptance therefore remains
pending. v0.54.19 added bounded shader-preparation evidence to failure reports
and an FPS readout for real-device testing. The concept-24 release changes only
the menu structure, styling and chapter image. No claim of universal browser
support or sustained frame rate is made.
See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for timings and investigation entry points.

This export preserves gameplay behavior, with these publication adaptations:

- Personal paths and original deployment domains were removed.
- Browser play telemetry is disabled (`enabled:false` in `game/main.js`).
- Diagnostics support the public game and loopback; backend demo origins require
  configuration before a separate deployment.
- Database defaults are local, and tests use repository-relative paths.
- Embedded image metadata and private model review notes were removed; image
  pixels and model geometry, textures and rig are unchanged.

No live scores, statistics, keys, credentials, operational configuration or private
repository history are included. `SOURCE-MANIFEST.json` lists the exported game
file hashes. Art metadata is included only where it documents assets and licensing.

## Source map

| Path | Contents |
| --- | --- |
| `game/main.js` | Startup, renderer, flight loop, combat and lifecycle |
| `game/src/mission-screen.js` | Loading stages, scheduling, timeout and failure report |
| `game/src/egg-nests.js` | Egg geometry, collision preparation and destruction |
| `game/src/static-raycast.js` | Terrain ray acceleration |
| `game/src/mayhem-audio.js` | Procedural sound and audio preparation |
| `game/src/audio-preparation-worker.js` | Background audio buffer generation |
| `game/src/` | World, enemies, flight, effects, scores and UI modules |
| `game/assets/` | All shipped game models, images and recorded dialogue |
| `game/vendor/` | Three.js r160 and loaders |
| `backend/` | Optional score API, local fixture server and statistics source |
| `tests/` | Portable source contracts and backend tests |

## Test

With a recent Node.js (22 or later):

```sh
npm test
```

After installing the Python requirements above:

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

These are source and API contracts, not a claim of browser, GPU or operating-system
coverage. No browser test is run by `npm test`.

## License

Original code and original game assets are released under the [MIT License](LICENSE).
Third-party material retains its existing licenses: Three.js is MIT, the named
Poly Haven geology assets are CC0, and the bundled audio provenance records the
Kokoro generation tools. See [third-party notices](game/THIRD-PARTY-NOTICES.md)
and the provenance/license files alongside assets. Generative tools were used
for some original models, illustrations and dialogue audio.

## Release address

`https://gunner.satoshis.watch/` is the canonical public game. The repository
homepage and HTML canonical/Open Graph URLs point there. The public repository
does not advertise internal testing sites.

This export is the v0.54.56 successor to the production concept-24 runtime,
subject only to the publication adaptations listed above. Telemetry remains disabled. See
[KNOWN-ISSUES.md](KNOWN-ISSUES.md) for the testing limits.
