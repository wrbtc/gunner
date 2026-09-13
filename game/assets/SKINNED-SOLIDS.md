# Field Guide skinned solids (v0.54.61)

Alien Field Guide VIEW 3D museum meshes. Combat and world visuals stay on the
live procedural rimmer / plasma paths, the lava loco bank creeper, and the live
sky dragons. Do not treat this identity as a combat mesh swap.

Expected binaries next to this note:

| Path | Bytes | sha256 |
| --- | ---: | --- |
| `game/assets/rimmer-skinned-solid.glb` | 1153368 | `1cc99c3e0c0c0a4116f11bf82b1550b212c6cac1b0582edcff1950f7e115b456` |
| `game/assets/plasma-bug-skinned-solid.glb` | 1135104 | `127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f` |
| `game/assets/creeper-ember-hollow.glb` | 1091768 | `25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe` |
| `game/assets/dragon-fg-a.glb` | 64020728 | `38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27` |

Ember Hollow is the slim pack: armature `EmberArmature`, clips `ember_idle` and
`ember_walk`. VIEW 3D plays `ember_idle` only. Reject the 4.58MB SOLID pack
(`4803580` bytes, sha256 `085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f`).

Dragon Field Guide A is a static museum mesh (no clips). VIEW 3D only and must not
retarget live sky dragons. Leave `game/src/sky-activity.js` and
`hellWorld.skyActivity` alone. Remesh is out of scope.

`.gitattributes` routes those four paths through Git LFS. This tip wires the
loaders and hash gates only. The real objects must be LFS-landed on those
paths and `SOURCE-MANIFEST.json` files[] bytes/sha256 refreshed. Do not commit
a placeholder, empty file, or invented GLB.

Until a binary is present, Field Guide VIEW 3D keeps the previous museum
fallback (procedural rimmer / plasma, lava loco creeper when that GLB loads).
The dragon card keeps the identification still until `dragon-fg-a.glb` lands.
`loadSkinnedSolids()` rejects LFS pointers, hash/size mismatches, the rejected
SOLID Hollow pack, and the blocked morph prefixes `75ddc18f` / `a2ac5ebb` /
`1c10edf7` / `45123f4c` / `9cd194e6` / `a9dcb2b6`. Dragon A loads only when
the Field Guide asks for that card, not during boot.

Museum pose: rimmers and plasma stay rest pose. Ember Hollow VIEW 3D plays
`ember_idle` only (`ember_walk` is present on the pack and must not start).
Dragon A stays rest pose. Cloned materials, no combat mixers, no live-actor
mutation. The Queen stays ENLARGE. HERO, Cinder Maw, and dancing-creeper orange
spirits are unchanged. Eggs use `egg-shell-a` / `egg-maggot-a` when present.
Soft-GPU stays off.
