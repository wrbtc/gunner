# Gunner

A desktop browser arcade flight game built with JavaScript, Three.js and Web Audio.
Fly through a volcanic canyon, destroy nests and creatures, and survive the Queen.

This is the **latest development snapshot, v0.54.8**.
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
failure diagnostics are enabled at `http://127.0.0.1:8000/` in static mode.

## Development status

**Known issue: startup can fail on Safari.** A reported Apple M1 / Safari 17.6 run
completed scene construction, then timed out preparing egg collisions before
graphics preparation. A successful Chromium run does not establish Safari support.
See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for timings and investigation entry points.

This export preserves gameplay behavior, with these publication adaptations:

- Personal paths and original deployment domains were removed.
- Browser play telemetry is disabled (`enabled:false` in `game/main.js`).
- Diagnostics use a loopback origin; backend origins use reserved example domains.
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
