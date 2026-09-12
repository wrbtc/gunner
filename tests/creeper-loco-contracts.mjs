import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {creeperLocoVisualBounds} from '../game/src/creeper-loco.js?v=054-59';

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
assert.match(main, /creeper-loco\.js\?v=054-59/);
assert.match(main, /bank-demons\.js\?v=054-59/);
assert.match(main, /optionalCreeperLoco/);
assert.match(main, /locoKit:creeperLocoBootstrap\?\.value/);
assert.match(main, /version:'0\.54\.59'/);
assert.doesNotMatch(main, /version:'0\.54\.57'/);
assert.doesNotMatch(main, /version:'0\.54\.58'/);

assert.match(note, /creeper-lava-loco-003\.glb/);
assert.match(note, /KW_knuckle_walk/);
assert.match(note, /CL_cliff_climb/);
assert.match(note, /Git LFS/);
assert.match(note, /lean remesh/);
assert.match(note, /\+Math\.PI/);
assert.match(note, /48 LINEAR keys/);
assert.match(note, /e8140b9486256eaa4b3e8240fb0985b54e46f5930cf108a38963447c47b23de5/);
assert.doesNotMatch(note, /0\.54\.50/);
assert.match(attributes, /game\/assets\/creeper-lava-loco-003\.glb filter=lfs diff=lfs merge=lfs -text/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.54.59');
assert.notEqual(packageJson.version, '0.54.57');
assert.notEqual(packageJson.version, '0.54.58');

const binary = new URL('game/assets/creeper-lava-loco-003.glb', root);
let binaryPresent = false;
let clipProbe = null;
if (existsSync(binary)){
  const bytes = readFileSync(binary);
  const head = bytes.subarray(0, 80).toString('utf8');
  if (!head.includes('git-lfs.github.com')){
    assert.ok(bytes.byteLength > 1_000_000, 'shipped loco GLB should be the full binary');
    assert.notEqual(bytes.byteLength, 9750920, 'must not ship the stub lean LFS object');
    binaryPresent = true;
    const jsonLen = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
    clipProbe = (gltf.animations || []).map(animation => {
      const inputs = [...new Set(animation.samplers.map(sampler => sampler.input))];
      const keys = inputs.map(index => gltf.accessors[index]?.count ?? 0);
      const span = inputs.map(index => {
        const accessor = gltf.accessors[index];
        return (accessor?.max?.[0] ?? 0) - (accessor?.min?.[0] ?? 0);
      });
      return {
        name: animation.name,
        keys: Math.max(0, ...keys),
        maxspan: Math.max(0, ...span),
        interpolation: animation.samplers[0]?.interpolation,
      };
    });
    const walk = clipProbe.find(item => item.name === 'KW_knuckle_walk');
    const climb = clipProbe.find(item => item.name === 'CL_cliff_climb');
    assert.ok(walk && climb, 'live-clip GLB must export both loco clips');
    assert.equal(walk.keys, 48);
    assert.equal(climb.keys, 48);
    assert.equal(walk.interpolation, 'LINEAR');
    assert.equal(climb.interpolation, 'LINEAR');
  }
}

console.log(JSON.stringify({passed:true,checks:36,binaryPresent,clipProbe},null,2));
