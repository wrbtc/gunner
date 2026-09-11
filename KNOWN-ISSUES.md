# Release validation — v0.54.26

## Older Intel Safari / short desktop viewport

A QA report from an older Intel-based Safari device showed the menu problem at
approximately **650–720px** of browser content height. The public report keeps
only the browser class and viewport range needed to reproduce the layout issue;
personal attribution and the device fingerprint are intentionally omitted.

Concept-24 poster CSS (`#intro.mission-poster`, styles class around 054-20-c24)
did not fit that window:

- `overflow:hidden` clipped the overlay instead of scrolling
- `.poster-body` packed to the bottom (`align-items:end`)
- no short-viewport poster compaction — legacy `@media(max-height:760px)` only
  shrank `.chapter` / `.deployment-bar`, which the poster no longer uses
- ~1280×800 class with Safari chrome + Dock → about **650–720px** content height
- footer behind the Dock; COMING SOON / Uncharted compressed; bottom controls cramped

The menu fix sizes the overlay from `visualViewport` / `100svh` / safe-area
insets, allows overflow scroll, adds a Dock-safe bottom inset, and adds
poster-specific `max-height: 760px` / `720px` / `650px` rules. Art, FPS counter,
and the ammo-progress loader stay in place.

A follow-up production screenshot from the same browser class showed two more
bugs after v0.54.23 shipped `REPORT FAILED LOAD` as a footer `quietButton`:

- Chapter blurb / Uncharted / footer stacked on themselves (`align-items:end`
  plus `.chapter-copy{position:absolute}` painting into the footer).
- `REPORT FAILED LOAD` was faint 11px text next to PLAY MUSIC, crushed into the
  Dock, so the tester could not start a copy-report QA pass.

This branch moves that control into the Deploy column as a 44px gold
`.report-load-button`, styles `COPY LOADING REPORT` the same way, and clips
poster columns so copy cannot paint over the footer.

Load may still fail on this browser class. The visible copy-report control is the
first diagnostic step; treat a timeout rewrite as a follow-up after that report.
Inventory:

| Stage | Owner | Wall budget | Yield style |
| --- | --- | --- | --- |
| Module + top-level await | `mobile-entry.js` `enterGame` | 60s | import race |
| Scene assembly | `createPreparationSequence` | 30s | MessageChannel + paint |
| Egg collision | `boundedPreparation` → `prepareCollision` | 30s | 2ms slices |
| Shader compile/link | `cinematic.prepare` | 30s | MessageChannel; 10ms stall poll |
| Audio PCM | `prepareBuffers` | min(10s, assembly remaining) | worker; fallback on timeout |

Older integrated Intel graphics with Safari can be a weak GL driver path:
`KHR_parallel_shader_compile` may be missing, compile/link can block the 30s
graphics budget, and nested
`setTimeout(0)` collision slices can spend most of the 30s collision budget idle.
This revision only changes collision slice scheduling to MessageChannel by
default (same yield class as graphics prep). Deadlines, shader compile, and
readiness gates are unchanged. Increasing timeouts alone is not treated as a
fix. Capture a loading report from this Intel Safari before any broader load
change.

## Device validation

v0.54.8 guarantees iterator progress per collision-preparation slice and cancels
scheduled collision work on timeout. Retry cleanup is scoped to its own attempt.
Title GPU rendering also pauses during collision preparation, then resumes.
The corresponding preview candidate passed a bounded Apple M3 Pro Chromium
148.0.7778.96 / Metal check: Ready, Start, Skip and five seconds of flight.
A user reported smooth play on an Apple M3. The browser was not specified in
that report. A later Safari report on an older macOS machine reached the loaded
game, but the hardware was not confirmed to be Apple silicon. Apple M1
acceptance is still pending. v0.54.19 preserves these gameplay fixes and adds
bounded graphics-preparation diagnostics and exposes an in-flight FPS counter;
it does not claim a replay-performance fix.
The report below describes v0.54.7.

Reported environment: Apple M1, Safari 17.6. Scene assembly ran from 6.950s to
22.417s after page start (15.467s duration). Egg-collision preparation then ran
from 27.706s to 58.294s and timed out. Graphics preparation was not reached.
These are stage timestamps from one reported device run, not universal timings.

Start with `game/src/egg-nests.js` → `prepareCollision`, the loading deadline and
cancellation paths in `game/src/mission-screen.js`, and the startup caller in
`game/main.js`.

A conditional liveness flaw was demonstrated with injected clock readings: the
2ms preparation loop can schedule another slice without advancing the iterator.
This is a source-level finding, not a reproduced Safari root cause. v0.54.8
also addresses concurrent title rendering and scheduled-work cancellation.
Preserve collision results and meaningful readiness gates when fixing progress;
increasing deadlines alone does not prove a fix.

## Replay performance

Some bounded Chromium runs showed replay cadence around 33.3ms versus roughly
16.7ms on the first flight, including on more than one source revision. The cause
was not established. Avoid attributing it to a specific patch without a controlled
comparison. Local contract tests do not validate sustained GPU performance.
An informal Windows run was also reported as slow, without controlled FPS or
hardware measurements. Linux performance has not yet been characterized. Use
the built-in FPS counter and record the environment details below when testing.

## Testing and patch requests

For each browser run, record exact browser/engine version, OS, device or VM,
graphics backend, fresh/warm cache state and actual steps exercised. Mark missing
platforms as untested. A browser emulation setting does not establish another OS
or physical-device result.

Exercise fresh startup, Start, audio activation, gameplay, pause/resume, loss/win,
replay and loading failure recovery. Measure stage durations separately from page
timestamps. Use local score fixtures; never send test submissions to a live game.
Submit focused patches with reproduction steps and regression tests. Report what
was actually run rather than inferring success from source inspection.
