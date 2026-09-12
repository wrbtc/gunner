# Creeper lava loco (003)

Bank creeper and climber combat visual.

Expected binary next to this note:

`game/assets/creeper-lava-loco-003.glb` (lean remesh + live clips, 9840676 bytes)

- Clips on the exported armature: `KW_knuckle_walk` (loop walk), `CL_cliff_climb` (climb)
- Live clips: 48 LINEAR keys each. Do not ship REST-pose stub clips
  (2 identical keys / STEP / zero armature travel).
- Mesh: lean lava remesh (~22k faces, was ~53.5k / ~28MB)
- Pelvis / crotch: recolor-only to dark basalt skin (no punched holes, no orange glow)
- Attach applies uniform scale, plantY, and a single `+Math.PI` yaw so the +Z GLB
  matches bank walk/climb roots that face −Z. Walk and climb inherit that yaw;
  do not flip climb separately.
- Weight sheeting on some poses is a known follow-up; ship the mesh anyway

Until the binary is present, `loadCreeperLoco()` rejects and bank combat keeps the
procedural InstancedMesh parts so the flight still boots. Drop the lean+live-clip
GLB at the path above; the loader attaches shared-material skinned clones
automatically.

`.gitattributes` routes `creeper-lava-loco-003.glb` through Git LFS. Do not
commit a placeholder or empty file. The live-clip LFS object is
`sha256:e8140b9486256eaa4b3e8240fb0985b54e46f5930cf108a38963447c47b23de5`
(9840676 bytes). If this tip still has the REST-pose stub object
(`744f1b66…` / 9750920 bytes), replace it on this same path and refresh
`SOURCE-MANIFEST.json` bytes/sha256.

Do not identify this ship as 0.54.57 or 0.54.58. Soft-GPU stays off. No menu
CSS, no Reduced work, and no art redesign. The 0.54.52 attach yaw stays.
