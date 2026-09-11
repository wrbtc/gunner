# Release validation — v0.54.27

## Older Intel Safari / short desktop viewport

A QA report from an older Intel-based Safari device showed the menu problem at
approximately **650–720px** of browser content height. The public report keeps
only the browser class and viewport range needed to reproduce the layout issue;
personal attribution and the device fingerprint are intentionally omitted.

The captured loading report reached shader submission only after roughly 57
seconds of earlier work. The former outer 60-second wall then stopped a still
progressing boot before the graphics layer could produce its own bounded
diagnostic. v0.54.26 replaces that outer wall with a 60-second stall watchdog:
startup and loading progress re-arm it, while a full interval without progress
fails as `STARTUP_TIMEOUT` and preserves one bounded pre-timeout snapshot.

Live copy-loading report on **gunner.satoshis.watch** (build 0.54.25, Safari 17.6
on that Intel class): `loading.active` shaders, progress submit 1392/12616,
`PREPARATION_TIMEOUT` / "Flight preparation timed out", `preTimeoutSnapshot`
absent. Trace: collision end ~56799ms, graphics begin ~56800ms, startup failed
~61327ms (~4.5s into graphics). Visibility at failure: visible.

The primary remaining bug is the **shader submit stall**. At that submit rate
the remaining light-count jobs still overrun cinematic's 30s budget after the
watchdog. v0.54.27 conserves intermediate plasma light-count variants when
remaining serial compile work exceeds 80% of remaining graphics time. Fast
compilers (modern Safari/Chrome, `compileMs` under 16ms or
`KHR_parallel_shader_compile`) keep every planned job. Conserved runs still
compile the in-flight job, the fullest remaining world and cockpit counts, and
capture, then shrink `progress.total`. Timeout still emits exactly one cinematic
`preTimeoutSnapshot`. A `PREPARATION_TIMEOUT` fail without a cinematic snapshot
still attaches deadline evidence so copy-loading reports are never missing
`preTimeoutSnapshot`.

The menu fix sizes the overlay from `visualViewport` / `100svh` / safe-area
insets, allows overflow scroll, and keeps a reserved deploy row so the 24 ammo
ticks and DEPLOY GUNNER cannot pack below a Dock-safe view. Compaction applies
at `max-height: 920px` and via `html[data-app-short]` (visual viewport), not only
the older 850/760/720/650 poster rules. Art, FPS counter, and the ammo-progress
loader stay in place.

A later Intel Safari measurement at about **1207×864** (window plus Dock) showed
`.ammo-progress` and `#startButton` still below the fold because those controls
lived under Coming Soon in an end-aligned, `overflow: hidden` column, and
`max-height: 850px` never fired. Preparing/ready now start-packs the deploy
stack first and collapses Coming Soon on short heights.

Concept-24 poster CSS (`#intro.mission-poster`, styles class around 054-20-c24)
did not fit that window:

- `overflow:hidden` clipped the overlay instead of scrolling
- `.poster-body` packed to the bottom (`align-items:end`)
- no short-viewport poster compaction — legacy `@media(max-height:760px)` only
  shrank `.chapter` / `.deployment-bar`, which the poster no longer uses
- ~1280×800 class with Safari chrome + Dock → about **650–720px** content height
- ~1280×~864 class (toolbar plus Dock) missed the old `max-height: 850px` pad
- footer behind the Dock; COMING SOON / Uncharted compressed; ammo ticks and Deploy below the fold

A follow-up production screenshot from the same browser class showed two more
bugs after v0.54.23 shipped `REPORT FAILED LOAD` as a footer `quietButton`:

- Chapter blurb / Uncharted / footer stacked on themselves (`align-items:end`
  plus `.chapter-copy{position:absolute}` painting into the footer).
- `REPORT FAILED LOAD` was faint 11px text next to PLAY MUSIC, crushed into the
  Dock, so the tester could not start a copy-report QA pass.

This branch keeps `REPORT FAILED LOAD` in the reserved deploy column. Idle
Report is a 44px outline so DEPLOY GUNNER stays the primary gold CTA. On the
fail path (`#intro.load-failed` and `.loading-failure`), REPORT and COPY use
the same gold fill as Deploy and stay in that reserved row.

`--app-inset-bottom` is now capped at **24px** (layout viewport minus visual
viewport only). The older short-window pad was **56px** at `max-height:850px`
and **64px** at `650px`, applied inside an already-visible visual box, which
could push Deploy below the Dock-safe fold.

The preparing/ready column now uses the same start-pack as the fail path:
ammo → DEPLOY → Coming Soon in `.poster-right`, `justify-content: flex-start`,
and no `overflow: hidden` on that column. Short viewports (`max-height: 920px`
and `html[data-app-short]`) collapse Coming Soon so the first paint shows ammo
ticks and DEPLOY above the Dock.

Fail UI: `#intro.load-failed` packs RETRY / gold REPORT / gold COPY in the
reserved deploy row so those controls stay initially in-viewport on ~650–864px
Safari+Dock heights.

Stage budgets after the stall watchdog:

| Stage | Owner | Wall budget | Yield style |
| --- | --- | --- | --- |
| Module + top-level await | `mobile-entry.js` `enterGame` | 60s since progress | import race |
| Scene assembly | `createPreparationSequence` | 30s | MessageChannel + paint |
| Egg collision | `boundedPreparation` → `prepareCollision` | 30s | 2ms slices |
| Shader compile/link | `cinematic.prepare` | 30s | MessageChannel; 10ms stall poll |
| Audio PCM | `prepareBuffers` | min(10s, assembly remaining) | worker; fallback on timeout |

Older integrated Intel graphics with Safari can be a weak GL driver path:
`KHR_parallel_shader_compile` may be missing, and compile/link can block the 30s
graphics budget. Nested `setTimeout(0)` collision slices can spend most of the
30s collision budget idle. Shader submit now degrades by dropping intermediate
light-count jobs when projected remaining compile work cannot finish in time.
A later Intel copy-report should show either a successful boot with
`compilerNote` `conserved-light-variants`, or a graphics-layer timeout with
`Graphics preparation timed out` and exactly one cinematic `preTimeoutSnapshot`.

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
