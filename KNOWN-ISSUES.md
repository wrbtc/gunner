# Release validation — v0.54.19

## Device validation

v0.54.8 guarantees iterator progress per collision-preparation slice and cancels
scheduled collision work on timeout. Retry cleanup is scoped to its own attempt.
Title GPU rendering also pauses during collision preparation, then resumes.
The corresponding preview candidate passed a bounded Apple M3 Pro Chromium
148.0.7778.96 / Metal check: Ready, Start, Skip and five seconds of flight.
A user reported smooth play on an Apple M3. The browser was not specified in
that report. A later Safari report on an older macOS machine reached the loaded
game, but the hardware was not confirmed to be Apple silicon. Apple M1
acceptance is still pending. v0.54.19 preserves these gameplay fixes, adds
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
