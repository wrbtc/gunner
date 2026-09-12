import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {creeperLocoVisualBounds} from '../game/src/creeper-loco.js?v=054-58';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const loco = read('game/src/creeper-loco.js');
const bank = read('game/src/bank-demons.js');
const main = read('game/main.js');
const note = read('game/assets/CREEPER-LAVA-LOCO.md');
const attributes = read('.gitattributes');

assert.match(loco, /CREEPER_LOCO_ASSET = 'creeper-lava-loco-003'/);
assert.match(loco, /walk:'KW_knuckle_walk'/);
assert.match(loco, /climb:'CL_cliff_climb'/);
assert.match(loco, /new URL\(`\.\.\/assets\/\$\{CREEPER_LOCO_ASSET\}\.glb`/);
assert.match(loco, /Shared materials/);
assert.match(loco, /creeperLocoReducedCap/);
assert.match(loco, /REDUCED_VISIBLE = 6/);
assert.match(loco, /applyBoneTransform/);
assert.match(loco, /visual\.scale\.setScalar\(layout\.uniform\)/);
assert.match(loco, /visual\.rotation\.y \+= Math\.PI/);
assert.match(loco, /visual\.position\.set\(0, layout\.plantY, 0\)/);
assert.doesNotMatch(loco, /material\.clone\(/);
assert.doesNotMatch(loco, /kind === 'climb'[\s\S]{0,80}Math\.PI/);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0], 4));
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4));
const bone = new THREE.Bone();
const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
mesh.add(bone);
mesh.bind(new THREE.Skeleton([bone]));
bone.position.y = 10;
const skinnedRoot = new THREE.Group();
skinnedRoot.add(mesh);
const visualBounds = creeperLocoVisualBounds(skinnedRoot);
assert.equal(visualBounds.skinned, 1);
assert.deepEqual(visualBounds.box.min.toArray(), [0, 10, 0]);
assert.deepEqual(visualBounds.box.max.toArray(), [0, 11, 0]);

assert.match(bank, /locoKit=null/);
assert.match(bank, /a\.locoVisual=locoKit\.attach\(a\.root\)/);
assert.match(bank, /a\.climb\?'climb':'walk'/);
assert.match(bank, /creeperLocoReducedCap/);
assert.match(bank, /locoVisual\.play/);
assert.match(bank, /pose\(a,time,-1\)/);
assert.match(bank, /Math\.atan2\(-dir\.x,-dir\.z\)/);
assert.doesNotMatch(bank, /locoVisual\.root\.rotation/);

assert.match(main, /loadCreeperLoco/);
assert.match(main, /creeper-loco\.js\?v=054-58/);
assert.match(main, /bank-demons\.js\?v=054-58/);
assert.match(main, /optionalCreeperLoco/);
assert.match(main, /locoKit:creeperLocoBootstrap\?\.value/);
assert.match(main, /version:'0\.54\.58'/);
assert.doesNotMatch(main, /version:'0\.54\.51'/);

assert.match(note, /creeper-lava-loco-003\.glb/);
assert.match(note, /KW_knuckle_walk/);
assert.match(note, /CL_cliff_climb/);
assert.match(note, /Git LFS/);
assert.match(note, /lean remesh/);
assert.match(note, /\+Math\.PI/);
assert.doesNotMatch(note, /0\.54\.50/);
assert.match(attributes, /game\/assets\/creeper-lava-loco-003\.glb filter=lfs diff=lfs merge=lfs -text/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.54.58');

const binary = new URL('game/assets/creeper-lava-loco-003.glb', root);
let binaryPresent = false;
if (existsSync(binary)){
  const bytes = readFileSync(binary);
  const head = bytes.subarray(0, 80).toString('utf8');
  if (!head.includes('git-lfs.github.com')){
    assert.ok(bytes.byteLength > 1_000_000, 'shipped loco GLB should be the full binary');
    binaryPresent = true;
  }
}

console.log(JSON.stringify({passed:true,checks:28,binaryPresent},null,2));
