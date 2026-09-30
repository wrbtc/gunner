import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {assetIdentity} from './remesh-asset-identities.js';

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
 {path:'game/assets/egg-shell-a.glb',...assetIdentity(packageJson.version,'egg-shell-a')},
 {path:'game/assets/field-notes-v02/egg-maggot-fieldnotes-v02.glb',...assetIdentity(packageJson.version,'egg-maggot-fieldnotes-v02')}
];

assert.equal(packageJson.version,'0.54.103');
assert.equal(manifest.version,'0.54.103');
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
assert.match(guide,/else if\(id==='eggs'\)root=solidGuideRoot\(skinnedSolids\?\.eggs\|\|await loadGuideIntactEgg\(\)\)/);
assert.doesNotMatch(guide,/eggNests\.guideModel\(\)/);
assert.match(read('game/src/field-guide-egg-parts.js'),/export function assembleIntactEgg/);
assert.match(read('game/src/field-guide-egg-parts.js'),new RegExp(expected[1].sha256));
assert.match(read('game/src/field-guide-egg-parts.js'),/Intact egg roots/);
assert.doesNotMatch(read('game/src/field-guide-egg-parts.js'),/opacity=Math\.min\(material\.opacity,\.32\)/);
assert.match(main,/settleOptionalAsset\(loadEggSolids\(\),'egg-solids'\)/);
assert.match(main,/eggSolids:eggSolidsBootstrap\?\.value/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.match(main,/powerPreference: 'high-performance'/);
assert.doesNotMatch(sky,/egg-shell-a|egg-maggot-a/);
assert.doesNotMatch(note,/Roland|Phil|Dee/);
assert.match(note,new RegExp(`${expected[1].bytes}-byte rigged larva`));
assert.match(note,/live-nest bind geometry/);
assert.equal(provenance.sourceShellSHA256,expected[0].sha256);
assert.equal(provenance.sourceMaggotSHA256,expected[1].sha256);
assert.equal(provenance.liveNestMaggot,expected[1].path);
assert.equal(provenance.liveNestMaggotSHA256,expected[1].sha256);

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

console.log(JSON.stringify({passed:true,identity:'0.54.103',binaryStatus},null,2));
