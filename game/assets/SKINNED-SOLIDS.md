# Field Guide skinned solids (v0.54.61)

Alien Field Guide VIEW 3D museum meshes. Combat and world visuals stay on the
live procedural rimmer / plasma paths and the lava loco bank creeper. Do not
treat this identity as a combat mesh swap.

Expected binaries next to this note:

| Path | Bytes | sha256 |
| --- | ---: | --- |
| `game/assets/rimmer-skinned-solid.glb` | 1153368 | `1cc99c3e0c0c0a4116f11bf82b1550b212c6cac1b0582edcff1950f7e115b456` |
| `game/assets/plasma-bug-skinned-solid.glb` | 1135104 | `127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f` |
| `game/assets/creeper-ember-hollow.glb` | 4803580 | `085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f` |

`.gitattributes` routes those three paths through Git LFS. This tip wires the
loaders and hash gates only. The real objects must be LFS-landed on those
paths and `SOURCE-MANIFEST.json` files[] bytes/sha256 refreshed. Slim Ember
Hollow before LFS if needed; keep the look. Do not commit a placeholder,
empty file, or invented GLB.

Until a binary is present, Field Guide VIEW 3D keeps the previous museum
fallback (procedural rimmer / plasma, lava loco creeper when that GLB loads).
`loadSkinnedSolids()` rejects LFS pointers, hash/size mismatches, and the
blocked morph prefixes `75ddc18f` / `a2ac5ebb` / `1c10edf7` / `45123f4c` /
`9cd194e6` / `a9dcb2b6`.

Museum pose only: rest pose, cloned materials, no combat mixers, no live-actor
mutation. The dragon Field Guide card is portrait / ENLARGE only and must not
retarget live sky dragons. Leave `game/src/sky-activity.js` and
`hellWorld.skyActivity` alone. HERO, Cinder Maw, and dancing-creeper orange
spirits are unchanged. Eggs stay on the existing procedural guide model.
Soft-GPU stays off.
