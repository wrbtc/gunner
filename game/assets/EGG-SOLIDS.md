# Brood egg solids (v0.54.87)

Live nests and Field Notes now share the accepted rigid shell and reworked
larva identity. Field Notes Intact egg (`id=eggs`) plays the independently
rigged larva at `field-notes-v02/egg-maggot-fieldnotes-v02.glb` behind a
leathery window. Live nests extract that same asset's bind geometry into the
existing instanced embryo path; they do not run per-egg animation mixers.
Placement, clusters, gallery, queen brood, HP/hit, filaments, sockets, and
rupture physics stay on the existing `makeEgg` path.

Expected binaries next to this note:

| Path | Bytes | sha256 |
| --- | ---: | --- |
| `game/assets/egg-shell-a.glb` | 817236 | `368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2` |
| `game/assets/field-notes-v02/egg-maggot-fieldnotes-v02.glb` | 1075680 | `344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96` |

`.gitattributes` routes both paths through Git LFS. Exact byte length and hash
are checked before either source is accepted. If either optional source fails,
nests keep the procedural shell and embryo.

An opaque shell bake is adapted to a leathery window (alpha / roughness) so a
careful look shows a vague maggot silhouette. No glow, slit, or extra limbs.

Field Notes Intact egg, the Larva specimen, and live-nest bind geometry use the
1075680-byte rigged larva with SHA-256
`344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96`
and clip `maggot_wriggle` through `field-guide-egg-parts.js`. Only the guide
plays that clip; the live-nest batching remains deterministic. The Shell
specimen stays shell-only.

Rimmers, plasma, Ember Hollow slim (`25a1be82…`), and Dragon A stay on their
already wired paths. Leave `game/src/sky-activity.js` and live canyon wyverns
alone. Soft-GPU stays off.
