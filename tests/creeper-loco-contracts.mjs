import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js?v=052';
import {creeperLocoVisualBounds} from '../game/src/creeper-loco.js?v=054-74';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const loco = read('game/src/creeper-loco.js');
const bank = read('game/src/bank-demons.js');
const main = read('game/main.js');
const note = ['CREEPER-LAVA-LOCO.md', 'CREEPER-MESHY-LOCO.md']
  .filter(name => existsSync(new URL(`game/assets/${name}`, root)))
  .map(name => read(`game/assets/${name}`))
  .join('\n');
const attributes = read('.gitattributes');

const locoAsset = loco.match(/CREEPER_LOCO_ASSET = '([a-z0-9-]+)'/)?.[1];
const stringConstant = name => loco.match(
  new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*'([^']+)'`),
)?.[1];
const clipObject = kind => loco.match(
  new RegExp(`clipNamed\\([^\\n]*?,\\s*([A-Z][A-Z0-9_]*)\\.${kind}\\)`),
)?.[1] || 'CREEPER_LOCO_CLIPS';
const clipName = kind => {
  const objectName = clipObject(kind);
  const body = loco.match(
    new RegExp(`(?:export\\s+)?const\\s+${objectName}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)`),
  )?.[1];
  return body?.match(new RegExp(`\\b${kind}:\\s*'([^']+)'`))?.[1];
};
const walkClip = clipName('walk');
const climbClip = clipName('climb');
const namedRequiredAssets = [
  ...loco.matchAll(/loadNamed\(loader,\s*('[a-z0-9-]+'|[A-Z][A-Z0-9_]*)\)(?!\.catch)/g),
].map(match => match[1].startsWith("'") ? match[1].slice(1, -1) : stringConstant(match[1]));
const requiredAssets = namedRequiredAssets.length ? namedRequiredAssets : [locoAsset];

assert.match(locoAsset || '', /^[a-z0-9][a-z0-9-]*$/);
assert.match(walkClip || '', /^[A-Za-z0-9_| -]+$/);
assert.match(climbClip || '', /^[A-Za-z0-9_| -]+$/);
assert.ok(requiredAssets.length > 0 && requiredAssets.every(Boolean), 'loader assets must resolve');
assert.match(loco, /Shared materials/);
assert.doesNotMatch(loco, /creeperLocoReducedCap/);
assert.doesNotMatch(loco, /REDUCED_VISIBLE/);
assert.match(loco, /applyBoneTransform/);
assert.match(loco, /visual\.scale\.setScalar\([A-Za-z0-9_.]+\.uniform\)/);
assert.match(loco, /visual\.rotation\.y \+= Math\.PI/);
assert.match(loco, /visual\.position\.set\(0, [A-Za-z0-9_.]+\.plantY, 0\)/);
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
assert.doesNotMatch(bank, /creeperLocoReducedCap/);
assert.match(bank, /locoVisual\.play/);
assert.match(bank, /pose\(a,time,-1\)/);
assert.match(bank, /Math\.atan2\(-dir\.x,-dir\.z\)/);
assert.doesNotMatch(bank, /locoVisual\.root\.rotation/);

assert.match(main, /loadCreeperLoco/);
assert.match(main, /creeper-loco\.js\?v=[A-Za-z0-9.-]+/);
assert.match(main, /bank-demons\.js\?v=[A-Za-z0-9.-]+/);
assert.match(main, /optionalCreeperLoco/);
assert.match(main, /locoKit:creeperLocoBootstrap\?\.value/);
assert.match(main, /version:'0\.54\.83'/);
assert.doesNotMatch(main, /version:'0\.54\.52'/);
assert.doesNotMatch(main, /version:'0\.54\.57'/);
assert.doesNotMatch(main, /version:'0\.54\.58'/);
assert.doesNotMatch(main, /version:'0\.54\.59'/);
assert.doesNotMatch(main, /version:'0\.54\.60'/);
assert.doesNotMatch(main, /version:'0\.54\.61'/);
assert.doesNotMatch(main, /version:'0\.54\.62'/);
assert.doesNotMatch(main, /version:'0\.54\.68'/);
assert.doesNotMatch(main, /version:'0\.54\.69'/);
assert.doesNotMatch(main, /version:'0\.54\.70'/);

for (const asset of requiredAssets) assert.match(note, new RegExp(`${asset}\\.glb`));
assert.ok(note.includes(walkClip));
assert.ok(note.includes(climbClip));
assert.match(note, /\+Math\.PI/);
assert.doesNotMatch(note, /0\.54\.50/);
for (const asset of requiredAssets){
  assert.ok(
    attributes.split('\n').includes(`game/assets/${asset}.glb filter=lfs diff=lfs merge=lfs -text`),
    `${asset}.glb must be tracked by Git LFS`,
  );
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.54.83');
assert.notEqual(packageJson.version, '0.54.57');
assert.notEqual(packageJson.version, '0.54.58');
assert.notEqual(packageJson.version, '0.54.59');
assert.notEqual(packageJson.version, '0.54.60');
assert.notEqual(packageJson.version, '0.54.61');
assert.notEqual(packageJson.version, '0.54.62');
assert.notEqual(packageJson.version, '0.54.63');
assert.notEqual(packageJson.version, '0.54.64');
assert.notEqual(packageJson.version, '0.54.65');
assert.notEqual(packageJson.version, '0.54.66');
assert.notEqual(packageJson.version, '0.54.67');
assert.notEqual(packageJson.version, '0.54.68');
assert.notEqual(packageJson.version, '0.54.69');
assert.notEqual(packageJson.version, '0.54.70');
const manifest = JSON.parse(read('SOURCE-MANIFEST.json'));
assert.equal(manifest.version, '0.54.83');
const locoRows = requiredAssets.map(asset => {
  const row = manifest.files.find(item => item.path === `game/assets/${asset}.glb`);
  assert.ok(row, `manifest row missing for ${asset}.glb`);
  assert.match(row.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 1_000_000);
  assert.match(manifest.note, new RegExp(row.sha256.slice(0, 8)));
  assert.match(manifest.note, new RegExp(String(row.bytes)));
  return row;
});

let binaryPresent = 0;
const clipProbe = [];
for (const [index, asset] of requiredAssets.entries()){
  const binary = new URL(`game/assets/${asset}.glb`, root);
  if (!existsSync(binary)) continue;
  const bytes = readFileSync(binary);
  const head = bytes.subarray(0, 80).toString('utf8');
  if (!head.includes('git-lfs.github.com')){
    assert.ok(bytes.byteLength > 1_000_000, 'shipped loco GLB should be the full binary');
    assert.equal(bytes.byteLength, locoRows[index].bytes);
    binaryPresent++;
    const jsonLen = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
    clipProbe.push(...(gltf.animations || []).map(animation => {
      const inputs = [...new Set(animation.samplers.map(sampler => sampler.input))];
      const keys = inputs.map(index => gltf.accessors[index]?.count ?? 0);
      const span = inputs.map(index => {
        const accessor = gltf.accessors[index];
        return (accessor?.max?.[0] ?? 0) - (accessor?.min?.[0] ?? 0);
      });
      return {
        asset,
        name: animation.name,
        keys: Math.max(0, ...keys),
        maxspan: Math.max(0, ...span),
        interpolation: animation.samplers[0]?.interpolation,
      };
    }));
  }
}
if (binaryPresent === requiredAssets.length){
  const walk = clipProbe.find(item => item.name === walkClip);
  const climb = clipProbe.find(item => item.name === climbClip);
  assert.ok(walk && climb, 'required loco clips must exist in the shipped GLBs');
  for (const clip of [walk, climb]){
    assert.ok(clip.keys >= 2, `${clip.name} must contain animation keys`);
    assert.ok(clip.maxspan > 0, `${clip.name} must span positive time`);
    assert.ok(['LINEAR', 'STEP', 'CUBICSPLINE', undefined].includes(clip.interpolation));
  }
}

console.log(JSON.stringify({passed:true,checks:36,binaryPresent,requiredAssets,walkClip,climbClip,clipProbe},null,2));
