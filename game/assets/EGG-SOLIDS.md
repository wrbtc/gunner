# Brood egg solids (v0.54.61)

Live nest and Field Guide VIEW 3D egg meshes. Maggot sits inside the shell
until rupture. Placement, clusters, gallery, queen brood, HP/hit, filaments,
sockets, and rupture physics stay on the existing `makeEgg` path.

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

Rimmers, plasma, Ember Hollow slim (`25a1be82…`), and Dragon A stay on their
already wired paths. Leave `game/src/sky-activity.js` and live canyon wyverns
alone. Soft-GPU stays off.
