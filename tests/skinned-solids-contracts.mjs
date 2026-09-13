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
 {path:'game/assets/dragon-fg-a.glb',bytes:64020728,sha256:'38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27'}
];
const forbidden=['75ddc18f','a2ac5ebb','1c10edf7','45123f4c','9cd194e6','a9dcb2b6'];

assert.equal(packageJson.version,'0.54.61');
assert.equal(manifest.version,'0.54.61');
assert.match(manifest.note,/0\.54\.61/);
assert.match(manifest.note,/Field Guide/);
assert.match(manifest.note,/VIEW 3D/);
assert.doesNotMatch(manifest.note,/combat mesh swap/i);

assert.match(solids,/export function loadSkinnedSolids/);
assert.match(solids,/FORBIDDEN_MORPH_PREFIXES/);
assert.match(guide,/skinnedSolids\?\.creepers/);
assert.match(guide,/skinnedSolids\?\.rimmers/);
assert.match(guide,/skinnedSolids\?\.plasma/);
assert.match(main,/settleOptionalAsset\(loadSkinnedSolids\(\),'guide-solids'\)/);
assert.match(main,/skinnedSolidsBootstrap\?\.value/);
assert.doesNotMatch(main,/createRimmers\([\s\S]{0,400}solid/);
assert.doesNotMatch(main,/createPlasmaBugs\([\s\S]{0,400}solid/);
assert.doesNotMatch(main,/createEggNests\([\s\S]{0,200}solid/);
assert.match(note,/Museum pose/);
assert.match(note,/ember_idle/);
assert.match(note,/EmberArmature/);
assert.match(note,/Reject the 4\.58MB SOLID/);
assert.match(note,/Combat and world visuals stay/);
assert.match(note,/dragon-fg-a/);
assert.match(note,/38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27/);
assert.match(note,/64020728/);
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
 if(manifestRow){
  assert.equal(manifestRow.bytes,row.bytes);
  assert.equal(manifestRow.sha256,row.sha256);
 }
}

for(const prefix of forbidden){
 assert.match(solids,new RegExp(prefix));
 assert.ok(manifest.files.every(row=>!row.sha256.startsWith(prefix)),'must not land morph creeper '+prefix);
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

console.log(JSON.stringify({passed:true,identity:'0.54.61',binaryStatus},null,2));
