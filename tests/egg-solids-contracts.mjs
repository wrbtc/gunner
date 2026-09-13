import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const solids=read('game/src/egg-solids.js');
const nests=read('game/src/egg-nests.js');
const main=read('game/main.js');
const guide=read('game/src/guide-models.js');
const note=read('game/assets/EGG-SOLIDS.md');
const attributes=read('.gitattributes');
const sky=read('game/src/sky-activity.js');
const packageJson=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('SOURCE-MANIFEST.json'));
const provenance=JSON.parse(read('game/assets/field-guide/EGG-PROVENANCE.json'));

const expected=[
 {path:'game/assets/egg-shell-a.glb',bytes:817236,sha256:'368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2'},
 {path:'game/assets/egg-maggot-a.glb',bytes:732684,sha256:'3b9e16e23d55689a12db03edf8a9f658df878501486a34af12b8a79c9daa1127'}
];

assert.equal(packageJson.version,'0.54.61');
assert.equal(manifest.version,'0.54.61');
assert.match(solids,/export function loadEggSolids/);
assert.match(solids,/adaptEggShellMaterial/);
assert.match(solids,/opacity=\.46/);
assert.doesNotMatch(solids,/slit|emissiveIntensity=\s*[1-9]/);
assert.match(nests,/eggSolids=null/);
assert.match(nests,/kitShell=eggSolids\?\.shell/);
assert.match(nests,/kitMaggot=eggSolids\?\.maggot/);
assert.match(nests,/function makeEgg/);
assert.match(nests,/egg\.shell\.visible=false/);
assert.match(nests,/egg\.socket\.visible=true/);
assert.match(nests,/embryo\.position\.z=\.15/);
assert.match(nests,/useBakedShell\?source\.shell\.material\.clone\(\)/);
assert.match(guide,/if\(id==='eggs'\)root=eggNests\.guideModel\(\)/);
assert.match(main,/settleOptionalAsset\(loadEggSolids\(\),'egg-solids'\)/);
assert.match(main,/eggSolids:eggSolidsBootstrap\?\.value/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.match(main,/powerPreference: 'high-performance'/);
assert.doesNotMatch(sky,/egg-shell-a|egg-maggot-a/);
assert.doesNotMatch(note,/Roland|Phil|Dee/);
assert.match(note,/Maggot sits inside/);
assert.equal(provenance.sourceShellSHA256,expected[0].sha256);
assert.equal(provenance.sourceMaggotSHA256,expected[1].sha256);

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
