# Release validation — v0.54.52

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

The primary remaining bug after light-count conservation is **serial
`getUniforms` / `getAttributes`**. v0.54.30 conserves intermediate plasma
light-count variants when remaining serial compile work exceeds 80% of remaining
graphics time. Fast compilers (modern Safari/Chrome, `compileMs` under 16ms or
`KHR_parallel_shader_compile`) keep every planned job. Conserved runs still
compile the in-flight job, the fullest remaining world and cockpit counts, and
capture, then shrink `progress.total`. Timeout still emits exactly one cinematic
`preTimeoutSnapshot`. A `PREPARATION_TIMEOUT` fail without a cinematic snapshot
still attaches deadline evidence so copy-loading reports are never missing
`preTimeoutSnapshot`.

A later Intel-class Safari 17.6 copy-loading report on **gunner.satoshis.watch**
(build 0.54.30) reached shaders after collision, with conservation already on
(`compilerNote` `conserved-light-variants`). Compile was cheap
(`recentCompileMs` ~48). The 30s graphics wall fired at `elapsedMs` ~30082
during `lastPhase` uniforms / `lastCompletedPhase` link-ready-poll, variant
`L0:c5:rtrue`, 136/142 programs finished, six pending. `parallelCompile` was
true. `recentUniformsMs` ~196 / `maxUniformsMs` ~261. Remaining work was
first-use uniform location queries, not a compile stall.

v0.54.32 keeps that conservation path and stops burning the wall on
introspection: each link slice starts at most one blocking
`getUniforms`/`getAttributes` once the 4ms slice is spent, remaining first-use
queries are skipped when they would exceed half the graphics budget, the last
10% of the wall, the next estimated query, or time reserved for queued compile
jobs, and link-ready programs still count as finished. Three.js warms locations
on first draw. A single driver call that itself exceeds the whole timeout still
fails. Programs that never become ready still time out. Skipped first-use
queries set `compilerNote` `deferred-uniforms` unless conservation already
recorded `conserved-light-variants`.

The menu fix sizes the overlay from `visualViewport` / `100svh` / safe-area
insets, allows overflow scroll, and keeps a reserved deploy row so the 24 ammo
ticks and DEPLOY GUNNER cannot pack below a Dock-safe view. Compaction applies
at `max-height: 920px` and via `html[data-app-short]` (visual viewport ≤864), not
only the older 850/760/720/650 poster rules. Art, FPS counter, and the
ammo-progress loader stay in place. Typical laptop heights keep end-pack so ammo
and DEPLOY sit just above the footer.

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

Idle/success Deploy is ammo → DEPLOY only. `#reportFailedLoad` and the
copy-report block stay hidden until `#intro.load-failed`, where REPORT and
COPY use the gold 44px fail-path fill in the reserved deploy row. Other
tester chrome is a quiet footer `QA` disclosure after PLAY MUSIC — not a
second brass CTA and not a poster badge.

`--app-inset-bottom` is the larger of leftover layout-vs-visual slack (capped
at **24px**) and macOS Dock overlap: `screenY+outerHeight` minus
`availTop+availHeight`, plus **8px** clearance, capped at **96px**. Intel
maximized Safari can keep layout≈visual while the window still paints into
the Dock, so slack alone stays 0. The older short-window pad was **56px** at
`max-height:850px` and **64px** at `650px`, applied inside an already-visible
visual box, which could push Deploy below the Dock-safe fold.

The preparing/ready column uses ammo → DEPLOY first in `.poster-right`, no
`overflow: hidden` on that column, and a Dock-safe bottom inset of at least 8px.
Tall and typical laptop heights (`max-height: 920px` compaction without
start-pack) end-pack with `.mission-footer { margin-top: auto }`. Short
viewports (`html[data-app-short]`, `max-height: 850px` / `760px`) start-pack so
Deploy stays above the Dock. Those short locks collapse Uncharted and the
sector note so at most a quiet COMING SOON line follows Deploy.
At `max-height: 760px` that line is dropped if the CTA would still fight the
Dock. Masthead shrinks before the brass DEPLOY control (54px).

Fail UI: `#intro.load-failed` packs RETRY / gold REPORT / gold COPY in the
reserved deploy row so those controls stay initially in-viewport on ~650–864px
Safari+Dock heights.

Stage budgets after the stall watchdog:

| Stage | Owner | Wall budget | Yield style |
| --- | --- | --- | --- |
| Module + top-level await | `mobile-entry.js` `enterGame` | 60s since progress | import race |
| Scene assembly | `createPreparationSequence` | 30s | MessageChannel + paint |
| Egg collision | `boundedPreparation` → `prepareCollision` | 30s | 2ms slices |
| Shader compile/link | `cinematic.prepare` | 30s | MessageChannel; 10ms stall poll; deferred uniforms |
| Audio PCM | `prepareBuffers` | min(10s, assembly remaining) | worker; fallback on timeout |

Older integrated Intel graphics with Safari can be a weak GL driver path:
`KHR_parallel_shader_compile` may be present while `getUniforms` still blocks
for hundreds of milliseconds per program. Nested `setTimeout(0)` collision
slices can spend most of the 30s collision budget idle. Shader submit still
drops intermediate light-count jobs when projected remaining compile work
cannot finish in time. First-use uniform/attribute queries then yield per slice
and skip when they would consume the remaining graphics wall. A later Intel
copy-report should show a successful boot with `compilerNote`
`conserved-light-variants` or `deferred-uniforms`, or a graphics-layer timeout
with `Graphics preparation timed out` and exactly one cinematic
`preTimeoutSnapshot` when programs never become ready.

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

## Hidden-tab scene construction deadline

A later Intel-class Safari load on **gunner.satoshis.watch** (build 0.54.34)
completed world+models, then hit `PREPARATION_TIMEOUT` at about 32s during
scene construction (`Preparing plasma bugs`) with `visibilityAtFailure=hidden`.
Retry with the window frontmost entered flight. That is background-tab
starvation of rAF/MessageChannel: the construction wall kept burning while
the tab was hidden, not a graphics/uniforms stall.

v0.54.35 pauses the scene-construction and bounded-preparation deadlines
while `document.visibilityState !== 'visible'` and counts only visible
elapsed time. Visible-tab stalls still fail at the existing 30s budget.
Graphics-prep uniforms deferral, present-hold, and Reduced auto remain.
Soft-GPU stays off.

v0.54.37 is a menu-layout follow-up only: typical laptop heights keep
end-pack (ammo + DEPLOY above a fold-anchored footer), start-pack stays on
the short Intel Safari + Dock class, idle Deploy is ammo → DEPLOY only,
and tester chrome is fail-path gold Report/Copy plus a quiet footer QA
disclosure. Soft-GPU stays off.

## Pause / hidden present hold and reduced auto

On an Intel MacBook Pro 13-inch 2016 class (Iris Graphics 550, Monterey,
Safari 17.6), a live load can still leave sustained FPS in the fail band
(~7–10), including about 8 FPS while the overlay reads FLIGHT SUSPENDED.
Simulation is already gated on pause; the render loop had still been running
the full cinematic present (MSAA + contact unless Reduced Effects is on).

Present-hold while `game.paused` or `document.hidden` is true remains: rAF
continues for UI clocks, but the HDR/MSAA/contact pass is not redrawn. After
Deploy, if the HUD FPS band stays `low` (~<30) for about four seconds of
visible unpaused flight, Reduced Effects is turned on once. The existing
Reduced checkbox remains the user override. No user-agent sniff is used.

## Reduced low-draw path (v0.54.38)

Live 0.54.34 Iris Safari combat with Reduced already on still sat at about
8–9 FPS (fail vs the ≥20 degraded bar), while present-hold while paused
already passed (~52–60). Contact-only Reduced was not the remaining cost:
the world still drew into the prepared 4x MSAA HDR target, quarter-res bloom
still ran, and PCF-soft shadow maps still updated every frame (sun 2048 plus
a 1024 intrusion spot).

v0.54.38 keeps the prepared 4x HDR target allocated and, when Reduced is on
(auto or manual), draws the world into a preallocated 0-sample twin, skips
contact and bloom, and freezes shadow-map updates. `shadowMap.enabled` and
PCFSoft stay on so prepared `USE_SHADOWMAP` programs are not rebuilt.
Both full-resolution HDR targets remain allocated (4x + 0-sample), so a
VRAM residual from the unused twin is expected. Canvas `antialias` and
`powerPreference: high-performance` stay as they were. Soft-GPU stays off
(`failIfMajorPerformanceCaveat: false`). Pixel ratio stays capped at 1; it
is not resized at runtime. Shader first-use uniform/attribute work is not
reopened. Menu Deploy-above-Dock packing from 0.54.36/0.54.37 is unchanged.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto after a sustained low HUD band). Record unpaused combat HUD
FPS. Target is ≥20 with Reduced on. Reduced OFF should not get worse in a
harmful way (same 4x HDR, contact, bloom, and live shadows). Present-hold
while paused/hidden should still hold the last frame. Do not enable Soft-GPU.

Physical Intel Safari combat FPS acceptance of this deeper Reduced path is
still pending.

## Unused 4x HDR park (v0.54.39)

Live 0.54.38 Iris Safari (Soft-GPU OFF, Reduced ON) still sat at about 3–8 FPS
in unpaused combat versus the ≥20 degraded bar. The 0-sample twin was the live
draw target, but the prepared 4x HDR color+depth buffer stayed allocated at
full resolution beside it.

v0.54.39 keeps both target objects so sample counts are never mutated on the
live HDR, and parks the unused world HDR at 1×1. Reduced combat has one live
full-resolution color+depth target (`hdrLite`). Turning Reduced OFF restores
4x MSAA by reallocating `hdr` and can hitch once. Soft-GPU stays off.
Shader first-use uniforms are not reopened. Present-hold while paused or
hidden, hidden-tab construction deadlines, LOAD graphics prep, and 0.54.37
menu Deploy-above-Dock packing are unchanged. World resolution is unchanged.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto). Record unpaused combat HUD FPS. Target is ≥20 with Reduced
on. Toggling Reduced OFF may hitch once while 4x HDR reallocates. Do not
enable Soft-GPU.

Physical Intel Safari combat FPS acceptance of this single-live-HDR Reduced
path is still pending.

## Reduced half-res world target (v0.54.40)

Live 0.54.39 Iris Safari (Soft-GPU OFF, Reduced ON) still sat at about 3–9 FPS
in unpaused combat versus the ≥20 degraded bar. Dual-HDR park left one live
full-resolution 0-sample color+depth target, so Iris still paid full fill-rate
for the canyon and cockpit.

v0.54.40 sizes that live Reduced world target to half canvas (`width>>1`,
`height>>1`, scale 0.5 ≤ 0.75). The unused 4x HDR twin stays parked at 1×1.
The composite still presents at canvas size, so the HTML HUD/UI stays crisp.
Contact and bloom stay skipped, shadow-map updates stay frozen, and sample
counts are never mutated on the live target. Turning Reduced OFF still
restores 4x MSAA by reallocating `hdr` and can hitch once. Soft-GPU stays
off. Shader first-use uniforms are not reopened. Present-hold while paused
or hidden, hidden-tab construction deadlines, LOAD graphics prep, and
0.54.37 menu Deploy-above-Dock packing are unchanged.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto). Record unpaused combat HUD FPS. Target is ≥20 with Reduced
on. Toggling Reduced OFF may hitch once while 4x HDR reallocates. Do not
enable Soft-GPU.

Physical Intel Safari combat FPS acceptance of this half-res Reduced path is
still pending.

## Hive menu composition restore (v0.54.41)

Live 0.54.39 drifted from hive.satoshis.watch / concept-24: Deploy sat mid-float
on typical laptop heights, Coming Soon rendered under Deploy via `order:0/1`,
`max-height:850` start-packed ordinary windows into an empty canyon above the
footer, and the footer QA disclosure broke the quiet-button baseline.

v0.54.41 restores the hive right-stack DOM (Coming Soon → ammo → DEPLOY) and
drops the tall `order:0/1` swap. Typical laptops and the 850/760 bands keep
end-pack (`flex-end` plus `.mission-footer { margin-top: auto }`) with
compaction only. Start-pack, Coming Soon extra collapse, and Deploy-first
`order` apply only on `html[data-app-short]` (visual viewport ≤864) so ammo
and DEPLOY stay ≥8px above the Dock. The production footer no longer ships QA;
fail-path gold Report/Copy remain. Soft-GPU stays off. Iris half-res, uniforms,
LOAD, and present-hold are unchanged.

## Reduced particle / atmosphere / light caps (v0.54.42)

Live 0.54.40 Iris Safari (Soft-GPU OFF, Reduced ON) still sat at about 3–9 FPS
(mean ~5.7) in unpaused combat versus the ≥20 degraded bar. Half-res world,
parked 4x HDR, skipped bloom/contact, and frozen shadows left dense particles,
the 12-step heat-atmosphere sky, and extra dynamic PointLights on the live
fill path.

v0.54.42 keeps those shipped Reduced draws as-is and, when Reduced is on
(auto or manual), applies runtime Intel-integrated-tier caps:

- Skip the volumetric ash-sky draw (flat background stands in). Canyon
  geometry is unchanged.
- Cap canyon ember/ash point batches to 12% and skip steam plumes.
- Skip blast-world wind ash and mayhem ambient vents/embers/collapses.
- Cap combat ParticlePool draw (160) and burst counts (25%).
- Zero excess unshadowed PointLight intensities (river extras, rift fill,
  hot-spill, mayhem flashes, tanker nozzles, plasma glows, plasma bursts).
  Lights stay in the graph so prepared `NUM_POINT_LIGHTS` programs are not
  rebuilt.

Reduced OFF restores full counts, the volume sky, and the extra lights.
Soft-GPU stays off. Shader first-use uniforms are not reopened. Present-hold,
hidden-tab construction deadlines, LOAD graphics prep, parked 4x HDR, and
half-res world are unchanged. Menu hive composition is owned by 0.54.41 and
is not touched here.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto). Record unpaused combat HUD FPS. Target is ≥20 with Reduced
on. Expect a flatter sky, thinner ash/embers, and fewer local light flashes
on the Intel integrated tier. Reduced OFF should match the shipped 0.54.40
present (4x HDR, contact, bloom, live shadows, full particles/sky/lights).
Do not enable Soft-GPU.

Physical Intel Safari combat FPS acceptance of these Reduced fill caps is
still pending.

## Reduced quarter-res world target (v0.54.44)

Live 0.54.42 Iris Safari (Soft-GPU OFF, Reduced ON) still sat at about 7–12 FPS
(mean ~9.6) in unpaused combat versus the ≥20 degraded bar (GATE-05442-FPS: 0
samples ≥20). P2 particle/atmosphere/light caps lifted the 0.54.40 3–9 band
but left Iris paying half-canvas fill for the canyon and cockpit.

v0.54.44 sizes the live Reduced world target to quarter canvas (`width>>2`,
`height>>2`, scale 0.25 ≤ 0.5). Half-res (scale 0.5) already shipped in
0.54.40. The unused 4x HDR twin stays parked at 1×1. The composite still
presents at canvas size, so the HTML HUD/UI stays crisp. Contact and bloom
stay skipped, shadow-map updates stay frozen, P2 particle/light caps stay
as-is, and sample counts are never mutated on the live target. Turning
Reduced OFF still restores 4x MSAA by reallocating `hdr` and can hitch once.
Soft-GPU stays off. Shader first-use uniforms are not reopened. Present-hold
while paused or hidden, hidden-tab construction deadlines, LOAD graphics prep,
0.54.41 hive composition, and 0.54.42 fill caps are unchanged. Menu short
end-pack is owned by 0.54.47 and is not touched here.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto). Record unpaused combat HUD FPS. Target is ≥20 with Reduced
on. Expect a softer world image on the Intel integrated Reduced tier; HUD
stays crisp. Toggling Reduced OFF may hitch once while 4x HDR reallocates.
Do not enable Soft-GPU.

Physical Intel Safari combat FPS acceptance of this quarter-res Reduced path
is still pending.

## Reduced scene / CPU budget (v0.54.46)

Live 0.54.44 Iris Safari (Soft-GPU OFF, Reduced ON) still sat at about 7–14 FPS
(mean ~10.6) in unpaused combat versus the ≥20 degraded bar (GATE-05444-FPS).
Quarter-res, P2 particle/atmosphere/light caps, parked HDR, and frozen shadow
map updates left a fill plateau: further world-target shrinks no longer moved
the HUD. Remaining cost was PCF receive sampling, per-frame geology/hotSpill
CPU, and decorative / distant draw calls.

v0.54.46 keeps those shipped Reduced draws as-is and, when Reduced is on
(auto or manual), applies runtime Intel-integrated-tier scene/CPU gates:

- Skip shadow *receive* (`receiveShadow=false` on prepared meshes). This is a
  runtime uniform, so prepared `USE_SHADOWMAP` programs are not rebuilt.
  `shadowMap.enabled` and PCFSoft stay on; `castShadow` stays on so the shadow
  list and `NUM_*_SHADOWS` stay stable. Map updates stay frozen.
- Throttle geology visibility to 4 Hz and skip hot-spill nearest-light search
  when Reduced. Lava time and nearby bank/cliff cull still run.
- Hide decorative / distant geology draws: instanced talus, hot-crust
  intrusions, scanned cliff extras, molten cascades, canyon continuations, and
  blast-world ruins. Nearby bank/cliff reach tightens from 820 m to 380 m.

Quarter-res live HDR, P2 fill caps, parked unused 4x HDR, skipped bloom/contact,
and Soft-GPU OFF remain. Shader first-use uniforms are not reopened. Menu CSS
is not touched. Menu short end-pack is owned by 0.54.47 and is not stolen here.
The every-2nd-rAF present skip is included in v0.54.51 from the v0.54.50
Intel-tier lane.

QA retest on that Iris-class Safari: Deploy with Reduced ON (checkbox or
wait for auto). Record unpaused combat HUD FPS. Target is ≥20 with Reduced
on. Expect a shorter visible canyon, no distant continuations/talus/cascades,
and unshadowed nearby rock. Reduced OFF should match the shipped 0.54.44
present (4x HDR, contact, bloom, live shadows, full geology). Do not enable
Soft-GPU.

Physical Intel Safari combat FPS acceptance of this Reduced scene/CPU path
is still pending.

## Short-viewport hive end-pack (v0.54.47)

Live 0.54.46 includes the hive restore from 0.54.41 and the Reduced scene/CPU
budget, but `html[data-app-short]` (viewport ≤864 / Dock) still start-packed:
`.poster-right { justify-content:flex-start }`, Deploy-first `order:0/1`, and
`.mission-footer { margin-top:8px }`. That left Deploy mid-screen, a quiet
Coming Soon line in the bottom-right, and an empty canyon above the footer.

v0.54.47 is menu CSS/HTML only. Coming Soon extras still collapse on
`data-app-short`, and the Dock inset still keeps Deploy ≥8px above the Dock.
Short no longer start-packs, swaps order, or overrides footer margin: every
height end-packs with `flex-end` plus `.mission-footer { margin-top: auto }`
so ammo and DEPLOY hug the fold like hive. Soft-GPU stays off. 0.54.46
Reduced scene/CPU, 0.54.44 quarter-res, 0.54.42 particle/atmosphere/light
caps, uniforms, LOAD, and Iris HDR are untouched. Dock-overlap inset on the
short path is owned by 0.54.48.

## Dock inset on short Intel Safari (v0.54.48)

Live 0.54.47 end-pack order passed on Intel Safari Soft-GPU OFF, maximized
short (`html[data-app-short]`, visual height about 802): Coming Soon → ammo →
DEPLOY, no canyon. Clearance failed: Deploy screen-bottom sat about **1px**
above `availTop+availHeight` (need ≥8px). `--app-inset-bottom` measured **0**
because layout≈visual, so the 24px slack path never fired.
`env(safe-area-inset-bottom)` was also 0. The CSS 12px floor was not enough
when visualViewport still painted into the Dock.

v0.54.48 is menu viewport/CSS only. `app-viewport.js` sets
`--app-inset-bottom` from Dock overlap (`screenY+outerHeight` vs
`availTop+availHeight`) on every height, adds 8px clearance, and caps at 96px.
Short CSS uses `padding-bottom: max(20px, 8px + var(--app-inset-bottom), env(safe-area-inset-bottom))`.
End-pack stays (`flex-end` + `.mission-footer { margin-top: auto }`). No
flex-start or order swap. Soft-GPU, Iris, uniforms, and Reduced scene/CPU
are untouched.

## Bank creeper lava loco (v0.54.49)

v0.54.49 swaps bank creeper / climber *visuals* to the lava loco GLB
(`game/assets/creeper-lava-loco-003.glb`) when that binary is present.
Walk uses `KW_knuckle_walk`; climb uses `CL_cliff_climb`. Combat (HP,
windup, mud throw, targeting, wall-climb routing) is unchanged. Ember
dancers stay on the procedural InstancedMesh path. Materials are shared
across clones. Reduced caps visible loco skins at 6 so Iris fill does
not grow with one unique program per actor. If the GLB is missing, load
rejects and the previous InstancedMesh ashborn parts remain so the
flight still boots. Weight sheeting on some poses is a known follow-up.
Do not treat 0.54.50 (held Iris half-rAF) as this identity.

In-game eyeball: a near bank creeper or climber should read as the lava
basalt gorilla (dark crotch/pelvis, no orange glow hole), not the old
procedural ashborn parts. Menu / Dock / Reduced scene-CPU / quarter-res
/ fill caps are unchanged from 0.54.48.

## Reduced every-2nd-rAF present throttle (v0.54.50, included in v0.54.51)

When Reduced is on, the cinematic/world pass presents on every second rAF.
Simulation, input, HTML HUD and world CPU updates continue on every tick; the
canvas holds the prior frame on the skipped present. The FPS readout counts real
presents and is titled `Intel Reduced present`. Reduced OFF retains the normal
every-rAF presentation path. Soft-GPU remains off and the shipped quarter-res,
fill-cap and scene/CPU reductions stay in place.

Physical Intel Safari combat acceptance remains pending. Test with Reduced ON
and record unpaused combat FPS; the degraded target is at least 20 presented
frames per second.

## Master Mode debug flight (v0.54.51)

`MASTER MODE` is an explicit Flight Settings checkbox. It preserves normal
enemy spawning, movement, warnings, attacks, projectile collision resolution,
animation and player weapons. Incoming hits cannot mutate hull state or add a
damage-review record, and cannot trigger mud/fire glass deposits, Rimmer or
Queen flashbang held-frame/bloom/blur/desaturation/audio filtering, damage
flash, view shake, impact particles, low-hull cue or damage audio. Enabling the
mode clears any active glass or sting effect immediately and keeps camera shake
at zero while enabled. The preference is stored with the other Flight Settings.
A flight that starts with or ever enables Master Mode is marked as debug-only;
its score is not offered to the shared leaderboard even if the mode is later
turned off.

QA should verify all current incoming attack families (ordinary fireball,
creeper stone, tanker fireball, Rimmer spike, Queen bomb/sting and plasma
pressure) while confirming enemies complete their normal attack/cooldown cycle.
Disable Master Mode and verify ordinary hull damage and effects return.

## Creeper lean remesh and loco yaw (v0.54.52)

Live 0.54.51 lava creepers walked and climbed backwards. Bank walk roots still
use `atan2(-dir.x,-dir.z)` (−Z front). The GLB faces +Z. v0.54.52 adds one
`+Math.PI` yaw in the creeper loco attach path so the child inherits it for
both walk and climb. Climb is not flipped separately. Scale and plantY stay.

Bank creepers remain on `game/assets/creeper-lava-loco-003.glb`. The intended
binary is the lean remesh (~22k faces / ~9.3MB, was ~53.5k / ~28MB). If this
tip still has the prior LFS object or only a pointer, replace that same path
from pack `gunner-creeper-lean-05452-COMPLETE.tgz` and refresh the source
manifest hashes. Soft-GPU stays off. Menu CSS and art direction are unchanged.

In-game eyeball: a near bank creeper or climber should knuckle-walk / cliff-climb
facing the travel direction, not reverse. Master Mode, Reduced present throttle,
and menu/Dock packing are unchanged from 0.54.51.

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
