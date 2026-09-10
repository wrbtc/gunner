# Gunner

A desktop browser arcade flight game built with JavaScript, Three.js and Web Audio.
Fly through a volcanic canyon, destroy nests and creatures, and survive the Queen.

**Play Gunner: https://gunner.satoshis.watch/**

This is **v0.54.10**, the complete walkie-radio voice update to the v0.54.9 golden master.
All 12 pilot lines use the supplied radio takes, including push-to-talk open/close sounds.
Gameplay and rendering remain the golden master.
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

The v0.54.8 loading fixes received a smooth-play report on an Apple M3. This
release preserves that gameplay. Apple M1 testing is pending; the historical
v0.54.7 Safari timeout and unconfirmed replay-cadence reports remain documented.
No claim of universal browser support or sustained frame rate is made.
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

The golden master preserves v0.54.8 gameplay and rendering quality. v0.54.9 adds
the production address and loading-report support for that origin. Telemetry
remains disabled. See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) for the testing limits.
