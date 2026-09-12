import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';

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
assert.doesNotMatch(loco, /material\.clone\(/);

assert.match(bank, /locoKit=null/);
assert.match(bank, /a\.locoVisual=locoKit\.attach\(a\.root\)/);
assert.match(bank, /a\.climb\?'climb':'walk'/);
assert.match(bank, /creeperLocoReducedCap/);
assert.match(bank, /locoVisual\.play/);
assert.match(bank, /pose\(a,time,-1\)/);

assert.match(main, /loadCreeperLoco/);
assert.match(main, /creeper-loco\.js\?v=054-49/);
assert.match(main, /optionalCreeperLoco/);
assert.match(main, /locoKit:creeperLocoBootstrap\?\.value/);
assert.match(main, /version:'0\.54\.49'/);
assert.doesNotMatch(main, /version:'0\.54\.50'/);

assert.match(note, /creeper-lava-loco-003\.glb/);
assert.match(note, /KW_knuckle_walk/);
assert.match(note, /CL_cliff_climb/);
assert.match(note, /Git LFS/);
assert.doesNotMatch(note, /0\.54\.50/);
assert.match(attributes, /game\/assets\/creeper-lava-loco-003\.glb filter=lfs diff=lfs merge=lfs -text/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.54.49');
assert.notEqual(packageJson.version, '0.54.50');

const binary = new URL('game/assets/creeper-lava-loco-003.glb', root);
if (existsSync(binary)){
  const bytes = readFileSync(binary).byteLength;
  assert.ok(bytes > 1_000_000, 'shipped loco GLB should be the full binary');
}

console.log(JSON.stringify({passed:true,checks:18,binaryPresent:existsSync(binary)},null,2));
