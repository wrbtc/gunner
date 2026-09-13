# Creeper lava loco (003)

Bank creeper and climber combat visual.

Expected binary next to this note:

`game/assets/creeper-lava-loco-003.glb` (upright human pack, 27117680 bytes)

- Clips on the exported armature: `HW_human_walk` (loop walk), `CL_cliff_climb`
  (climb), optional `HW_human_idle` (near-zero world speed)
- `KW_knuckle_walk` may remain as a leftover clip. Do not bind it as walk.
- Live clips: real keyframes (not 2 rest keys / STEP / zero armature travel)
- Mesh: upright human remesh (~21955 faces / ~25.9MB)
- Attach applies uniform scale, plantY, and a single `+Math.PI` yaw so the +Z
  GLB matches bank walk/climb roots that face −Z. Walk and climb inherit that
  yaw; do not flip climb separately. Drop the yaw only after a packed binary
  proves facing is already correct.
- Walk playRate follows measured `HW_human_walk` stride (meters/cycle and
  duration) so plant distance matches world travel. Do not use the old 0.70 m/s
  −Y knuckle-walk plan.

Until the binary is present, `loadCreeperLoco()` rejects and bank combat keeps
the procedural InstancedMesh parts so the flight still boots. Drop the upright
pack at the path above; the loader attaches shared-material skinned clones
automatically.

`.gitattributes` routes `creeper-lava-loco-003.glb` through Git LFS. Do not
commit a placeholder or empty file. The upright LFS object is
`sha256:1c10edf73aca5c0a8f2b214690043382a251e20ca193d4bb8b91554349164b67`
(27117680 bytes). This tip still has the lean LFS object
(`e8140b94…` / 9840676) because the 27MB pack was not on the build host and
GitHub rejects a pointer to an unknown LFS object. The operator must land
sha256 1c10edf7 size 27117680 on this same path and refresh
`SOURCE-MANIFEST.json` bytes/sha256. Do not invent a fake binary. Reject stub
`744f1b66…` / 9750920 and rejected upright hashes `9cd194e6…` and `a9dcb2b6…`.

Do not identify this ship as 0.54.59 or 0.54.60. Soft-GPU stays off. No menu
CSS, no Reduced work, and no Field Guide / art redesign. The 0.54.52 attach
yaw stays.
