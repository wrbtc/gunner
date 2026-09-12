# Creeper lava loco (003)

Bank creeper and climber combat visual.

Expected binary next to this note:

`game/assets/creeper-lava-loco-003.glb` (~27MB)

- Clips on the exported armature: `KW_knuckle_walk` (loop walk), `CL_cliff_climb` (climb)
- Mesh: lava remesh ~53k faces
- Pelvis / crotch: recolor-only to dark basalt skin (no punched holes, no orange glow)
- Weight sheeting on some poses is a known follow-up; ship the mesh anyway

Until the binary is present, `loadCreeperLoco()` rejects and bank combat keeps the
procedural InstancedMesh parts so the flight still boots. Drop the GLB at the
path above; the loader attaches shared-material skinned clones automatically.

Do not depend on an external inbox for the git tip. The PR is merge-ready for
code and version identity; add the binary on this same path in a follow-up
commit when the bytes are available.
