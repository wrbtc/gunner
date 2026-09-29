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
| `game/assets/egg-shell-a.glb` | 323500 | `516613a95b3eba0fff77e2e78197cab6becebec7bcb91124517bb963ad6f994c` |
| `game/assets/field-notes-v02/egg-maggot-fieldnotes-v02.glb` | 240068 | `dce9f57242857ebcf84a567a25932278ea1e6454cb3e6aeb2c26bc83a1402d7d` |

`.gitattributes` routes both paths through Git LFS. Exact byte length and hash
are checked before either source is accepted. If either optional source fails,
nests keep the procedural shell and embryo.

An opaque shell bake is adapted to a leathery window (alpha / roughness) so a
careful look shows a vague maggot silhouette. No glow, slit, or extra limbs.

Field Notes Intact egg, the Larva specimen, and live-nest bind geometry use the
240068-byte rigged larva with SHA-256
`dce9f57242857ebcf84a567a25932278ea1e6454cb3e6aeb2c26bc83a1402d7d`
and clip `maggot_wriggle` through `field-guide-egg-parts.js`. Only the guide
plays that clip; the live-nest batching remains deterministic. The Shell
specimen stays shell-only.

Rimmers, plasma, Ember Hollow slim (`25a1be82…`), and Dragon A stay on their
already wired paths. Leave `game/src/sky-activity.js` and live canyon wyverns
alone. Soft-GPU stays off.
