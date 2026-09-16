# Creeper meshy loco (combat)

Bank creeper and climber visual. Dancers are not in this pack.
Museum / Field Notes stay on `creeper-ember-hollow.glb` until a later pass.

Required:

- `game/assets/creeper-meshy-walk.glb` (3305960, sha256 2685d127…)
- `game/assets/creeper-meshy-extra.glb` (5834196, sha256 3865d85e…)

Clips: `Armature|walking_man|baselayer`, `climbing_up_wall`, `climbing_down_wall`,
`Angry_Ground_Stomp`. Run/throw GLBs are optional later files; this ship does not
include them. Do not retarget throw/climb onto the walk SkinnedMesh.

Loader zeros `Material_1` emissive. Height still 6.15 m. Attach yaw `+Math.PI`
so +Z files face bank −Z travel. Collision hull stays on bank-demons (radius 3.4).

`loadCreeperLoco()` rejects if walk or extra is missing; bank combat then keeps
the procedural InstancedMesh. Existing `play(climb|walk)` still works.
