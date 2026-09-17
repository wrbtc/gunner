# Creeper meshy loco (combat)

Bank creeper and climber visual. Dancers are not in this pack.
Museum / Field Notes stay on `creeper-ember-hollow.glb` until a later pass.

Required:

- `game/assets/creeper-meshy-walk.glb` (3305960, sha256 2685d12783e4ae3afb055262fcc9beebf84b71033a7f127128e90d947293c840)
- `game/assets/creeper-meshy-extra.glb` (5834196, sha256 3865d85e1eaed7cc9564541c817627d9f7eec44a0a529866b273d0f418d6ff1d)
- `game/assets/creeper-meshy-throw.glb` (3484224, sha256 73e2a6c1ee0e62dde0d51707e4757c43394b319d4fb6f049324fd9ff6d4a083f)
- `game/assets/creeper-meshy-run.glb` (3301368, sha256 7e0d07346c3b42373936cd34276cee25e911bc4dc995517f678fa34dfca17b37)

Clips: `Armature|walking_man|baselayer`, longest `Armature|running|baselayer` on
run, `climbing_up_wall`, `climbing_down_wall`, `Angry_Ground_Stomp`, longest
`rigify_clip` on throw. Walk and run share bind pose; play run on the walk
scene. Do not retarget throw/climb onto the walk SkinnedMesh. Mud leaves the
RightHand at 2.90s; combat windup is 2.9s. Ground run plays when speed > 10 or
moveRate > 1.2 (rapid/provoked). Ash's 3.2 threshold sits below a calm roam.

Loader zeros `Material_1` emissive. Height still 6.15 m. Attach yaw `+Math.PI`
so +Z files face bank −Z travel. Collision hull stays on bank-demons (radius 3.4).

`loadCreeperLoco()` rejects if walk, extra, throw, or run is missing; bank combat
then keeps the procedural InstancedMesh.
