# Field Guide skinned solids (v0.54.86)

Alien Field Guide VIEW 3D meshes. The Meshy Rimmer v2 is shared with gameplay
through independent skeleton instances. Combat and world visuals stay on the
existing plasma, lava loco bank creeper, Cinder Maw tank, orange-spirit dancer
and sky dragon paths. The earlier Rimmer asset below is retained only as history.

Expected binaries next to this note:

| Path | Bytes | sha256 |
| --- | ---: | --- |
| `game/assets/rimmer-skinned-solid.glb` | 1153368 | `1cc99c3e0c0c0a4116f11bf82b1550b212c6cac1b0582edcff1950f7e115b456` |
| `game/assets/plasma-bug-skinned-solid.glb` | 1135104 | `127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f` |
| `game/assets/creeper-ember-hollow.glb` | 1091768 | `25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe` |
| `game/assets/dragon-fg-a.glb` | 64020728 | `38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27` |
| `game/assets/field-notes-v02/cinder-maw-fieldnotes-v02.glb` | 1483396 | `2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52` |
| `game/assets/vein-ascetic-skinned.glb` | 1908316 | `9d67a8c5fcdc4a5d8bbbdbae9f428e87a963a978682c0e572f62af28567e495e` |
| `game/assets/field-notes-v02/egg-maggot-fieldnotes-v02.glb` | 1075680 | `344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96` |

Ember Hollow is the slim pack: armature `EmberArmature`, clips `ember_idle` and
`ember_walk`. VIEW 3D plays `ember_idle` only. Reject the 4.58MB SOLID pack
(`4803580` bytes, sha256 `085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f`).

Cinder Maw presentation rig: armature `TankArmature`, clips `cinder_idle`,
`cinder_jaw_inspect`, and `cinder_weight_shift`. VIEW 3D defaults to
`cinder_idle`. Bones `body` / `jaw` / `cinder_mouth` must survive. This replaces
the unbound source draft (`cinder-maw-skinned-draft.glb`, 1004440 bytes,
sha256 `2af643fb2751ad128e6b06cf9a3244348220a4a58cb9884603e6cf9a6e13a1d4`)
for Field Notes only; the source surface/material bytes are preserved and the
live Cinder Maw gameplay model is untouched.

Egg larva presentation rig: armature `MaggotArmature`, clip `maggot_wriggle`.
The Larva specimen stays independent. Field Notes Intact egg nests this
larva inside `egg-shell-a.glb` for the museum only and does not replace the
live nest embryo.

Vein Anunnaki museum solid: armature `VeinArmature`, clips `ritual_idle` and
`ritual_walk`. VIEW 3D plays `ritual_idle` only. Reject the superseded draft
`vein-ascetic-skinned-draft.glb` (`2502928` bytes, sha256
`3b3dc30a3ae7dafe87b82932f37c1c371fcbce7a0db4f6491dff494e6b05bce4`).

Dragon Field Guide A is a static museum mesh (no clips). VIEW 3D only and must not
retarget live sky dragons. Leave `game/src/sky-activity.js` and
`hellWorld.skyActivity` alone. Remesh is out of scope.

`.gitattributes` routes those paths through Git LFS. This tip includes the real
Dragon A object at the hash and size above; `SOURCE-MANIFEST.json` binds it.
Do not replace it with a placeholder, empty file, or invented GLB.

Dragon A remains lazy: it downloads only after the Field Guide asks for the
dragon card. Existing boot-time museum solids and gameplay assets keep their
previous loading paths.
`loadSkinnedSolids()` rejects LFS pointers, hash/size mismatches, the rejected
SOLID Hollow pack, and the blocked morph prefixes `75ddc18f` / `a2ac5ebb` /
`1c10edf7` / `45123f4c` / `9cd194e6` / `a9dcb2b6`. Dragon A loads only when
the Field Guide asks for that card, not during boot.

Museum pose: Rimmer defaults to `rimmer_idle`; plasma stays in rest pose. Ember Hollow VIEW 3D defaults
to `ember_idle`; Cinder Maw defaults to `cinder_idle`; Vein Ascetic defaults to
`ritual_idle`; the larva defaults to `maggot_wriggle`; the shell and Dragon A
stay rigid. Motion selection and pause remain inside Field Notes. Cloned
materials, no combat mixers, no live-actor mutation. The Queen stays ENLARGE.
HERO is unchanged. Soft-GPU stays off.

Museum cameras height-fit every specimen so the subject fills the card; thumbs
and VIEW 3D share that crop. Cinder Maw is framed huge and close. Dragon A
faces the camera (not rear / flying away). Card first paint withholds the
prior identification stills and shows a branded preparing tile until the
museum thumb lands.

Every VIEW 3D specimen supports bounded camera zoom by wheel/trackpad, − / +
buttons, or keyboard − / +. Horizontal drag turns the specimen; vertical drag
repositions it within bounded view space. RESET VIEW restores position,
rotation, and 100% zoom.

## Meshy Rimmer v2 gameplay exception

The Rimmer now uses `rimmer-meshy-v2-rigged.glb` for both Field Guide and gameplay, with independent skeleton instances. Source GLB SHA-256 `1cb5086983d89f8d310d2f71f7cca26a4f87234a6abf57c12d51b47b0ccedc75`; rigged output `e39e0226358fad716a20d9ac744c47fe8b7f00cfe958e07fc510ecbe24c97927`, 18054908 bytes. Original position, normal, UV, index and embedded texture buffers are preserved; tangents, a 30-joint deform rig and three clips are additive. `rimmer_idle`, `rimmer_walk` and `rimmer_warning` are showroom clips; gameplay uses grounded skeletal articulation and game-owned route translation. Other species keep their existing combat paths.

Gameplay fits the new articulated legs with a neutral stance inset of 0.12 source units and an 8.7-world-unit visual gait cycle; swing feet return to neutral while stance feet remain anchored. These visual gait choices retain the original route, speed, timing, HP, damage, scoring and hit proxies. The three rigid leg segments deform the original joined surface through skin weights.

The gameplay thorax is raised 0.1875 source units (4.5 world units) before and during warning so the real mouth can see over its terrace. Line of sight, laser and spikes share that actual mouth. Original collision proxy positions and their 17.4-world-unit bob phase remain unchanged. Terrain support checks the entire weighted low-foot surface, including secondary claws, and freezes each planted foot’s world position and orientation. Swing paths clear terrain and avoid the unequal upper links’ inner reach limit. Hidden actors defer foot planning until admission.

Upper walking-leg armour uses anatomical segment ownership through the raised knee caps, with blending at the hip and knee. The upper shells are no longer cut by a horizontal weight mask or assigned to the torso/scythes. The original joint positions, clips, terrain solver and combat behavior remain unchanged.
