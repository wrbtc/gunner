import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {creeperLocoVisualBounds, measureClipGait, locoGaitPlayRate} from '../game/src/creeper-loco.js?v=054-61';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const loco = read('game/src/creeper-loco.js');
const bank = read('game/src/bank-demons.js');
const main = read('game/main.js');
const note = read('game/assets/CREEPER-LAVA-LOCO.md');
const attributes = read('.gitattributes');
const pointer = read('game/assets/creeper-lava-loco-003.glb');

assert.match(loco, /CREEPER_LOCO_ASSET = 'creeper-lava-loco-003'/);
assert.match(loco, /walk: 'HW_human_walk'/);
assert.match(loco, /climb: 'CL_cliff_climb'/);
assert.match(loco, /idle: 'HW_human_idle'/);
assert.doesNotMatch(loco, /walk:'KW_knuckle_walk'/);
assert.doesNotMatch(loco, /walk: 'KW_knuckle_walk'/);
assert.match(loco, /new URL\(`\.\.\/assets\/\$\{CREEPER_LOCO_ASSET\}\.glb`/);
assert.match(loco, /Shared materials/);
assert.doesNotMatch(loco, /creeperLocoReducedCap/);
assert.doesNotMatch(loco, /REDUCED_VISIBLE/);
assert.match(loco, /applyBoneTransform/);
assert.match(loco, /visual\.scale\.setScalar\(layout\.uniform\)/);
assert.match(loco, /visual\.rotation\.y \+= Math\.PI/);
assert.match(loco, /visual\.position\.set\(0, layout\.plantY, 0\)/);
assert.match(loco, /measureClipGait/);
assert.match(loco, /locoGaitPlayRate/);
assert.doesNotMatch(loco, /0\.70/);
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

const walkClip = new THREE.AnimationClip('HW_human_walk', 1.25, [
  new THREE.VectorKeyframeTrack('root.position', [0, 1.25], [0, 0, 0, 0, 0, 1.6]),
]);
const walkGait = measureClipGait(walkClip, {uniform: 2});
assert.ok(Math.abs(walkGait.duration - 1.25) < 1e-6);
assert.ok(Math.abs(walkGait.strideMeters - 3.2) < 1e-3);
assert.ok(Math.abs(walkGait.speed - 3.2 / 1.25) < 1e-3);
assert.equal(walkGait.axis, 'z');
assert.equal(locoGaitPlayRate({walkSpeed: 3.2 / 1.25}, 'walk', 3.2 / 1.25, 1), 1);
assert.ok(locoGaitPlayRate({walkSpeed: 2}, 'walk', 1, 1) > 0.4);
assert.ok(locoGaitPlayRate({walkSpeed: 2}, 'walk', 1, 1) < 0.6);
assert.equal(locoGaitPlayRate({walkSpeed: 2}, 'idle', 0, 1), 1);

const bounce = new THREE.AnimationClip('HW_human_walk', 1, [
  new THREE.VectorKeyframeTrack('root.position', [0, 0.5, 1], [0, 0, 0, 0, 0.03, 0, 0, 0, 0]),
]);
assert.ok(measureClipGait(bounce).strideMeters < 0.05);

assert.match(bank, /locoKit=null/);
assert.match(bank, /a\.locoVisual=locoKit\.attach\(a\.root\)/);
assert.match(bank, /a\.climb\?'climb':\(world<\.12&&gait\.idle\?'idle':'walk'\)/);
assert.match(bank, /gait\.walkSpeed/);
assert.match(bank, /gait\.idle/);
assert.doesNotMatch(bank, /KW_knuckle_walk/);
assert.doesNotMatch(bank, /creeperLocoReducedCap/);
assert.match(bank, /locoVisual\.play/);
assert.match(bank, /pose\(a,time,-1\)/);
assert.match(bank, /Math\.atan2\(-dir\.x,-dir\.z\)/);
assert.doesNotMatch(bank, /locoVisual\.root\.rotation/);
assert.doesNotMatch(bank, /\.4\+Math\.min\(a\.speed\|\|0,5\)\*\.18/);

assert.match(main, /loadCreeperLoco/);
assert.match(main, /creeper-loco\.js\?v=054-61/);
assert.match(main, /bank-demons\.js\?v=054-61/);
assert.match(main, /optionalCreeperLoco/);
assert.match(main, /locoKit:creeperLocoBootstrap\?\.value/);
assert.match(main, /version:'0\.54\.61'/);
assert.doesNotMatch(main, /version:'0\.54\.52'/);
assert.doesNotMatch(main, /version:'0\.54\.57'/);
assert.doesNotMatch(main, /version:'0\.54\.58'/);
assert.doesNotMatch(main, /version:'0\.54\.59'/);
assert.doesNotMatch(main, /version:'0\.54\.60'/);

assert.match(note, /creeper-lava-loco-003\.glb/);
assert.match(note, /HW_human_walk/);
assert.match(note, /HW_human_idle/);
assert.match(note, /CL_cliff_climb/);
assert.match(note, /Git LFS/);
assert.match(note, /\+Math\.PI/);
assert.match(note, /1c10edf73aca5c0a8f2b214690043382a251e20ca193d4bb8b91554349164b67/);
assert.match(note, /27117680/);
assert.match(note, /operator[\s\S]{0,20}must land/);
assert.doesNotMatch(note, /KW_knuckle_walk \(loop walk\)/);
assert.doesNotMatch(note, /0\.54\.50/);
assert.doesNotMatch(note, /e8140b9486256eaa4b3e8240fb0985b54e46f5930cf108a38963447c47b23de5/);
assert.match(attributes, /game\/assets\/creeper-lava-loco-003\.glb filter=lfs diff=lfs merge=lfs -text/);

const intendedOid = '1c10edf73aca5c0a8f2b214690043382a251e20ca193d4bb8b91554349164b67';
const standinOid = 'e8140b9486256eaa4b3e8240fb0985b54e46f5930cf108a38963447c47b23de5';
if (pointer.includes('git-lfs.github.com')){
  assert.match(pointer, /oid sha256:(1c10edf73aca5c0a8f2b214690043382a251e20ca193d4bb8b91554349164b67|e8140b9486256eaa4b3e8240fb0985b54e46f5930cf108a38963447c47b23de5)/);
  assert.doesNotMatch(pointer, /9cd194e6/);
  assert.doesNotMatch(pointer, /a9dcb2b6/);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.54.61');
assert.notEqual(packageJson.version, '0.54.57');
assert.notEqual(packageJson.version, '0.54.58');
assert.notEqual(packageJson.version, '0.54.59');
assert.notEqual(packageJson.version, '0.54.60');
const manifest = JSON.parse(read('SOURCE-MANIFEST.json'));
assert.equal(manifest.version, '0.54.61');
const locoRow = manifest.files.find(row => row.path.endsWith('creeper-lava-loco-003.glb'));
assert.ok(locoRow.sha256 === intendedOid || locoRow.sha256 === standinOid);
if (locoRow.sha256 === intendedOid) assert.equal(locoRow.bytes, 27117680);
else assert.equal(locoRow.bytes, 9840676);
assert.notEqual(locoRow.sha256, '744f1b66188f462923f2628f851671cc067965e7ada67bd25bb8294b6c29330d');
assert.doesNotMatch(locoRow.sha256, /^9cd194e6/);
assert.doesNotMatch(locoRow.sha256, /^a9dcb2b6/);
assert.match(manifest.note, /1c10edf7/);
assert.match(manifest.note, /27117680/);
assert.match(manifest.note, /HW_human_walk/);
assert.match(manifest.note, /operator must land/);

const binary = new URL('game/assets/creeper-lava-loco-003.glb', root);
let binaryPresent = false;
let clipProbe = null;
if (existsSync(binary)){
  const bytes = readFileSync(binary);
  const head = bytes.subarray(0, 80).toString('utf8');
  if (!head.includes('git-lfs.github.com')){
    const {createHash} = await import('node:crypto');
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.notEqual(digest.slice(0, 8), '9cd194e6');
    assert.notEqual(digest.slice(0, 8), 'a9dcb2b6');
    assert.notEqual(bytes.byteLength, 9750920, 'must not ship the stub lean LFS object');
    if (bytes.byteLength === 27117680){
      assert.equal(digest, intendedOid);
      binaryPresent = true;
    } else {
      assert.equal(digest, standinOid);
    }
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
    if (binaryPresent){
      const walk = clipProbe.find(item => item.name === 'HW_human_walk');
      const climb = clipProbe.find(item => item.name === 'CL_cliff_climb');
      assert.ok(walk && climb, 'upright GLB must export HW_human_walk and CL_cliff_climb');
      assert.ok(walk.keys > 2, 'walk must be live keys, not a 2-key rest stub');
      assert.ok(climb.keys > 2, 'climb must be live keys, not a 2-key rest stub');
      assert.notEqual(walk.interpolation, 'STEP');
      assert.notEqual(climb.interpolation, 'STEP');
    }
  }
}

console.log(JSON.stringify({passed:true,checks:48,binaryPresent,clipProbe},null,2));
