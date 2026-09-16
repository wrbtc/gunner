import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const bytes=name=>readFileSync(new URL(name,root));
const sha256=name=>createHash('sha256').update(bytes(name)).digest('hex');

const sky=read('game/src/sky-activity.js');
const world=read('game/src/hell-world.js');
const guide=read('game/src/guide-models.js');
const solids=read('game/src/skinned-solids.js');
const viewer=read('game/src/field-guide-viewer.js');
const briefing=read('game/src/mission-screen.js');
const main=read('game/main.js');
const note=read('game/assets/SKINNED-SOLIDS.md');
const manifest=JSON.parse(read('SOURCE-MANIFEST.json'));

// Live canyon wyverns stay on the 0.54.60 module. Field Guide dragons use a
// separate museum solid and must never retarget this combat path.
assert.equal(sha256('game/src/sky-activity.js'),'06c3ef75ab6e5f4c8b25eed6f6e25fec73a546e22b73d73ccf16ec038d08f54a');
const skyRow=manifest.files.find(row=>row.path==='game/src/sky-activity.js');
const worldRow=manifest.files.find(row=>row.path==='game/src/hell-world.js');
assert.equal(skyRow.sha256,'06c3ef75ab6e5f4c8b25eed6f6e25fec73a546e22b73d73ccf16ec038d08f54a');
assert.equal(sha256('game/src/hell-world.js'),worldRow.sha256);
assert.match(world,/hotSpillTargetOffset/);

assert.match(world,/import \{createSkyActivity\} from '\.\/sky-activity\.js\?v=052'/);
assert.match(world,/const skyActivity=createSkyActivity\(scene\)/);
assert.match(world,/skyActivity,/);
assert.match(main,/hellWorld\.skyActivity\.setCombat\(/);
assert.match(main,/hellWorld\.skyActivity\.update\(/);
assert.match(main,/dragonSlots:hellWorld\.skyActivity\.dragons\.length/);
assert.doesNotMatch(main,/setGuideModelProvider\([\s\S]*skyActivity/);
assert.doesNotMatch(main,/buildGuideModel\([\s\S]*skyActivity/);

assert.match(briefing,/id==='queen'\?'ENLARGE ↗':'VIEW 3D ↗'/);
assert.doesNotMatch(briefing,/id==='dragons'\|\|id==='queen'/);
assert.match(viewer,/const MODEL_IDS=\['eggs','creepers','dancers','rimmers','tanks','plasma','dragons'\]/);
assert.match(viewer,/'dragons'/);

for(const source of [guide,solids,viewer,briefing]){
 assert.doesNotMatch(source,/sky-activity/);
 assert.doesNotMatch(source,/skyActivity/);
 assert.doesNotMatch(source,/createSkyActivity/);
}
assert.match(guide,/id==='dragons'/);
assert.match(solids,/dragon-fg-a/);
assert.match(solids,/38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27/);
assert.match(solids,/64020728/);
assert.doesNotMatch(solids,/sky-activity|skyActivity|createSkyActivity/);
assert.match(note,/must not\nretarget live sky dragons/);
assert.match(note,/sky-activity\.js/);
assert.match(note,/hellWorld\.skyActivity/);

assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.match(main,/powerPreference: 'high-performance'/);

console.log(JSON.stringify({passed:true,identity:'0.54.80',skyActivity:'untouched',softGpu:'off'},null,2));
