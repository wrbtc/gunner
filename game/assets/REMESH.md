# Real time remesh (v0.54.89)

The source models below were drawn at their full sculpt density: the egg shell
and larva are instanced for hundreds of nest eggs, and the bank creepers are
48 live skinned actors. Each file was reduced with glTF Transform 4
(`weld`, then `simplify` with meshoptimizer, then `prune` and `dedup`), which
edits only geometry and texture encoding. Skeletons, joint names, skin weights,
clip names, UV layouts and rig extras are unchanged.

| File | Triangles | Bytes | Other changes |
| --- | --- | --- | --- |
| `egg-shell-a.glb` | 26,032 to 4,896 | 817,236 to 323,500 | none |
| `field-notes-v02/egg-maggot-fieldnotes-v02.glb` | 26,132 to 1,998 | 1,075,680 to 240,068 | unused black emissive map pruned |
| `creeper-meshy-walk.glb` | 26,158 to 7,994 | 3,305,960 to 547,064 | texture PNG to WebP q80; emissive map dropped (the loader clears it) |
| `creeper-meshy-run.glb` | 26,158 to 7,994 | 3,301,368 to 542,444 | same |
| `creeper-meshy-throw.glb` | 26,158 to 7,994 | 3,484,224 to 678,732 | same; two key stub clip `Armature\|clip0\|baselayer` removed |
| `creeper-meshy-extra.glb` | 26,158 to 7,994 | 5,834,196 to 639,828 | same; duplicate emissive image removed |
| `rimmer-meshy-v2-rigged.glb` | 41,610 to 16,981 | 18,054,908 to 2,473,592 | 2048 textures to 1024 WebP (normal q90, others q80); TANGENT dropped (three.js derives it) |
| `dragon-fg-a.glb` | 1,954,288 to 99,998 | 64,020,728 to 3,507,348 | textures to 1024 WebP q80 |

No Draco or meshopt compression: the game loads these with a plain GLTFLoader.
