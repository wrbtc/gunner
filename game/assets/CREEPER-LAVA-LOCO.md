# Creeper lava loco (003)

Bank creeper and climber combat visual.

Expected binary next to this note:

`game/assets/creeper-lava-loco-003.glb` (lean remesh ~9.3MB / ~22k faces)

- Clips on the exported armature: `KW_knuckle_walk` (loop walk), `CL_cliff_climb` (climb)
- Mesh: lean lava remesh (~22k faces, was ~53.5k / ~28MB)
- Pelvis / crotch: recolor-only to dark basalt skin (no punched holes, no orange glow)
- Attach applies uniform scale, plantY, and a single `+Math.PI` yaw so the +Z GLB
  matches bank walk/climb roots that face −Z. Walk and climb inherit that yaw;
  do not flip climb separately.
- Weight sheeting on some poses is a known follow-up; ship the mesh anyway

Until the binary is present, `loadCreeperLoco()` rejects and bank combat keeps the
procedural InstancedMesh parts so the flight still boots. Drop the lean GLB at the
path above; the loader attaches shared-material skinned clones automatically.

`.gitattributes` routes `creeper-lava-loco-003.glb` through Git LFS. Do not
commit a placeholder or empty file. If this tip still has the prior ~28MB LFS
object or only a pointer, replace it on this same path with the lean remesh
from pack `gunner-creeper-lean-05452-COMPLETE.tgz` (`creeper-lava-loco-003.glb`)
and refresh `SOURCE-MANIFEST.json` bytes/sha256.

Do not identify this ship as 0.54.51. Soft-GPU stays off. No menu CSS and no
art redesign.
