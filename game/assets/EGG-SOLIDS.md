# Brood egg solids (v0.54.64)

Live-nest source meshes plus the rigid Field Notes shell. Field Notes Intact
egg (`id=eggs`) assembles `egg-shell-a.glb` with the independently rigged
larva at `field-notes-v02/egg-maggot-fieldnotes-v02.glb` and a leathery
window so the maggot stays visible inside. That larva does not replace the
live nest embryo. Placement, clusters, gallery, queen brood, HP/hit,
filaments, sockets, and rupture physics stay on the existing `makeEgg` path.

Expected binaries next to this note:

| Path | Bytes | sha256 |
| --- | ---: | --- |
| `game/assets/egg-shell-a.glb` | 817236 | `368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2` |
| `game/assets/egg-maggot-a.glb` | 732684 | `3b9e16e23d55689a12db03edf8a9f658df878501486a34af12b8a79c9daa1127` |

`.gitattributes` routes those paths through Git LFS. This tip wires the
loaders and hash gates only. Do not commit a placeholder, empty file, or
invented GLB. Until both objects land, nests keep the procedural shell and
embryo.

An opaque shell bake is adapted to a leathery window (alpha / roughness) so a
careful look shows a vague maggot silhouette. No glow, slit, or extra limbs.

The original static maggot source remains identified above for live-nest
provenance. Field Notes Intact egg and the Larva specimen use the
1075680-byte rigged larva with SHA-256
`344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96`
and clip `maggot_wriggle` through `field-guide-egg-parts.js`. The Shell
specimen stays shell-only.

Rimmers, plasma, Ember Hollow slim (`25a1be82…`), and Dragon A stay on their
already wired paths. Leave `game/src/sky-activity.js` and live canyon wyverns
alone. Soft-GPU stays off.
