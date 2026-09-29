# Creeper meshy loco (combat)

Bank creeper and climber visual. Dancers are not in this pack.
Museum / Field Notes stay on `creeper-ember-hollow.glb` until a later pass.

Required:

- `game/assets/creeper-meshy-walk.glb` (547064, sha256 d026e20c8e305eb4dd119078610e11bb07fe80864e9daf5c519f8822ddb81b76)
- `game/assets/creeper-meshy-extra.glb` (639828, sha256 3961ada1fe32d7b3b4bf69c6ad3ae368d25bf1e0084e7fc3ec662ade38ac55c6)
- `game/assets/creeper-meshy-throw.glb` (678732, sha256 306247b72028f84224c7eac60f42fd604e50bd7f550d028fec489b097f0409ee)
- `game/assets/creeper-meshy-run.glb` (542444, sha256 456e51f9bfaecfe7987e4a140c6f148b4a0ab1749df12a54565177fd94b49337)

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
