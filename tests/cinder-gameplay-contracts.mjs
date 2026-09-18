import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CINDER_GAMEPLAY_SOLID} from '../game/src/cinder-maw.js';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const cinder=read('game/src/cinder-maw.js'),tanker=read('game/src/tanker-bug.js'),main=read('game/main.js');
const packageJson=JSON.parse(read('package.json')),manifest=JSON.parse(read('SOURCE-MANIFEST.json'));
const assetPath='game/assets/field-notes-v02/cinder-maw-fieldnotes-v02.glb',asset=readFileSync(new URL(assetPath,root));

assert.equal(packageJson.version,'0.54.88');
assert.equal(manifest.version,'0.54.88');
assert.equal(CINDER_GAMEPLAY_SOLID.asset,'field-notes-v02/cinder-maw-fieldnotes-v02');
assert.equal(CINDER_GAMEPLAY_SOLID.bytes,1483396);
assert.equal(CINDER_GAMEPLAY_SOLID.sha256,'2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52');
assert.equal(asset.byteLength,CINDER_GAMEPLAY_SOLID.bytes);
assert.equal(createHash('sha256').update(asset).digest('hex'),CINDER_GAMEPLAY_SOLID.sha256);
assert.equal(CINDER_GAMEPLAY_SOLID.armature,'TankArmature');
assert.deepEqual(CINDER_GAMEPLAY_SOLID.clips,['cinder_idle','cinder_jaw_inspect','cinder_weight_shift']);
for(const bone of ['body','neck','head','jaw','cinder_mouth','tail_base','tail_mid','tail_tip','front_L_upper','front_R_foot','hind_L_upper','hind_R_foot'])assert.ok(CINDER_GAMEPLAY_SOLID.bones.includes(bone));

assert.match(cinder,/fetch\(url\)/);
assert.match(cinder,/Cinder Maw gameplay solid hash mismatch/);
assert.match(cinder,/upperAxis:lower\.position\.clone\(\)\.normalize\(\)/);
assert.match(cinder,/lowerAxis:foot\.position\.clone\(\)\.normalize\(\)/);
assert.match(cinder,/headingOffset:Math\.PI/);
assert.match(tanker,/const VISUAL_SCALE=5\.8,HIT_SCALE=2/);
assert.match(tanker,/rig\.motionBones/);
assert.match(tanker,/poseCinderLeg\(rig,l,goal,stanceHeading,normal\)/);
assert.match(tanker,/e\.windupSeconds=2\.2/);
assert.match(tanker,/e\.radius=4\.5/);
assert.match(tanker,/e\.hp=2340/);
assert.match(tanker,/radius=r\*HIT_SCALE/);
assert.match(tanker,/radius=\.85\*HIT_SCALE/);
assert.doesNotMatch(cinder,/cinder-maw-v02\.glb/);
assert.match(main,/tanker-bug\.js\?v=054-87/);
assert.match(main,/cinder-maw\.js\?v=054-87/);

const row=manifest.files.find(item=>item.path===assetPath);
assert.deepEqual(row,{path:assetPath,bytes:CINDER_GAMEPLAY_SOLID.bytes,sha256:CINDER_GAMEPLAY_SOLID.sha256});
assert.match(manifest.releaseNote,/Ember Priests/);
assert.match(manifest.releaseNote,/Encounter count, routing, HP, collision, attack cadence, mud behavior, scoring and timing remain unchanged/);

console.log(JSON.stringify({passed:true,identity:'0.54.88',asset:CINDER_GAMEPLAY_SOLID.sha256,bones:CINDER_GAMEPLAY_SOLID.bones.length},null,2));
