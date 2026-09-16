# Field Guide skinned solids (v0.54.80)

Alien Field Guide VIEW 3D museum meshes. Combat and world visuals stay on the
live procedural rimmer / plasma paths, the lava loco bank creeper, live Cinder
Maw tanks, orange-spirit dancers, and the live sky dragons. Do not treat this
identity as a combat mesh swap.

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

Museum pose: rimmers and plasma stay rest pose. Ember Hollow VIEW 3D defaults
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
