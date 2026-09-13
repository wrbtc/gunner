import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const solids=read('game/src/skinned-solids.js');
const guide=read('game/src/guide-models.js');
const main=read('game/main.js');
const note=read('game/assets/SKINNED-SOLIDS.md');
const attributes=read('.gitattributes');
const packageJson=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('SOURCE-MANIFEST.json'));

const expected=[
 {path:'game/assets/rimmer-skinned-solid.glb',bytes:1153368,sha256:'1cc99c3e0c0c0a4116f11bf82b1550b212c6cac1b0582edcff1950f7e115b456'},
 {path:'game/assets/plasma-bug-skinned-solid.glb',bytes:1135104,sha256:'127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f'},
 {path:'game/assets/creeper-ember-hollow.glb',bytes:1091768,sha256:'25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe'},
 {path:'game/assets/dragon-fg-a.glb',bytes:64020728,sha256:'38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27'},
 {path:'game/assets/vein-ascetic-skinned-draft.glb',bytes:2502928,sha256:'3b3dc30a3ae7dafe87b82932f37c1c371fcbce7a0db4f6491dff494e6b05bce4'}
];
const forbidden=['75ddc18f','a2ac5ebb','1c10edf7','45123f4c','9cd194e6','a9dcb2b6'];

assert.equal(packageJson.version,'0.54.65');
assert.equal(manifest.version,'0.54.65');
assert.match(manifest.note,/0\.54\.65/);
assert.match(manifest.note,/Field Guide/);
assert.match(manifest.note,/VIEW 3D/);
assert.doesNotMatch(manifest.note,/combat mesh swap/i);

assert.match(solids,/export function loadSkinnedSolids/);
assert.match(solids,/FORBIDDEN_MORPH_PREFIXES/);
assert.match(guide,/skinnedSolids\?\.creepers/);
assert.match(guide,/skinnedSolids\?\.rimmers/);
assert.match(guide,/skinnedSolids\?\.plasma/);
assert.match(guide,/skinnedSolids\?\.tanks/);
assert.match(guide,/skinnedSolids\?\.dancers/);
assert.match(guide,/solidGuideRoot\(skinnedSolids\?\.dancers\)\|\|createBankGuideModel\(true\)/);
assert.match(solids,/TankArmature/);
assert.match(solids,/VeinArmature/);
assert.match(solids,/cinder_idle/);
assert.match(solids,/cinder_jaw_inspect/);
assert.match(solids,/cinder_weight_shift/);
assert.match(solids,/ritual_idle/);
assert.match(solids,/ritual_walk/);
assert.match(solids,/cinder_mouth/);
assert.match(solids,/\['rimmers','plasma','creepers','tanks','dancers'\]/);
assert.match(main,/settleOptionalAsset\(loadSkinnedSolids\(\),'guide-solids'\)/);
assert.match(main,/skinnedSolidsBootstrap\?\.value/);
assert.doesNotMatch(main,/createRimmers\([\s\S]{0,400}solid/);
assert.doesNotMatch(main,/createPlasmaBugs\([\s\S]{0,400}solid/);
assert.match(main,/createEggNests\([\s\S]{0,240}eggSolids:eggSolidsBootstrap\?\.value/);
assert.doesNotMatch(main,/createRimmers\([\s\S]{0,200}eggSolids/);
assert.match(note,/Museum pose/);
assert.match(note,/ember_idle/);
assert.match(note,/EmberArmature/);
assert.match(note,/Reject the 4\.58MB SOLID/);
assert.match(note,/Combat and world visuals stay/);
assert.match(note,/dragon-fg-a/);
assert.match(note,/38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27/);
assert.match(note,/64020728/);
assert.match(note,/field-notes-v02\/cinder-maw-fieldnotes-v02/);
assert.match(note,/vein-ascetic-skinned-draft/);
assert.match(note,/TankArmature/);
assert.match(note,/VeinArmature/);
assert.match(note,/ritual_idle/);
assert.match(note,/2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52/);
assert.match(note,/3b3dc30a3ae7dafe87b82932f37c1c371fcbce7a0db4f6491dff494e6b05bce4/);
assert.match(note,/1483396/);
assert.match(note,/2502928/);
assert.doesNotMatch(note,/Roland|Phil|Dee/);
assert.match(solids,/REJECTED_EMBER_SOLID/);
assert.match(solids,/EmberArmature/);
assert.match(solids,/ember_idle/);
assert.match(solids,/ember_walk/);
assert.match(solids,/085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f/);
assert.match(manifest.note,/25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe/);
assert.match(manifest.note,/1091768/);
assert.match(manifest.note,/085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f/);
assert.match(manifest.note,/reject/);
assert.match(manifest.note,/38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27/);
assert.match(manifest.note,/64020728/);
assert.match(solids,/loadGuideDragonSolid/);
assert.match(solids,/BOOT_SOLIDS/);
assert.match(solids,/static:true/);
assert.match(guide,/skinnedSolids\?\.dragons/);
assert.match(main,/loadGuideDragonSolid/);

for(const row of expected){
 assert.match(attributes,new RegExp(row.path.replace(/\//g,'\\/')+' filter=lfs'));
 assert.match(solids,new RegExp(row.sha256));
 assert.match(solids,new RegExp(String(row.bytes)));
 assert.match(manifest.note,new RegExp(row.sha256));
 assert.match(manifest.note,new RegExp(String(row.bytes)));
 const manifestRow=manifest.files.find(item=>item.path===row.path);
 assert.deepEqual(manifestRow,{path:row.path,bytes:row.bytes,sha256:row.sha256});
}

for(const prefix of forbidden){
 assert.match(solids,new RegExp(prefix));
 assert.ok(manifest.files.every(row=>!row.sha256.startsWith(prefix)),'must not land morph creeper '+prefix);
}

const candidateRows=[
 {path:'game/assets/field-notes-v02/cinder-maw-fieldnotes-v02.glb',bytes:1483396,sha256:'2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52'},
 {path:'game/assets/field-notes-v02/egg-maggot-fieldnotes-v02.glb',bytes:1075680,sha256:'344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96'}
];
const eggParts=read('game/src/field-guide-egg-parts.js');
for(const row of candidateRows){
 assert.match(attributes,new RegExp(row.path.replace(/\//g,'\\/')+' filter=lfs'));
 assert.match(solids+eggParts,new RegExp(row.sha256));
 assert.match(solids+eggParts,new RegExp(String(row.bytes)));
 assert.match(note+manifest.note,new RegExp(row.sha256));
 assert.match(note+manifest.note,new RegExp(String(row.bytes)));
 const manifestRow=manifest.files.find(item=>item.path===row.path);
 assert.deepEqual(manifestRow,{path:row.path,bytes:row.bytes,sha256:row.sha256});
 const bytes=readFileSync(new URL(row.path,root));assert.equal(bytes.length,row.bytes);
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
}
const binaryStatus={};
for(const row of expected){
 const file=new URL(row.path,root);
 let state='missing';
 if(existsSync(file)){
  const bytes=readFileSync(file);
  const head=bytes.subarray(0,80).toString('utf8');
  state=head.includes('git-lfs.github.com')?'pointer':(bytes.byteLength===row.bytes?'binary':'unexpected');
  if(state==='binary'){
   const {createHash}=await import('node:crypto');
   assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
  }
 }
 binaryStatus[row.path]=state;
}

console.log(JSON.stringify({passed:true,identity:'0.54.65',binaryStatus},null,2));
