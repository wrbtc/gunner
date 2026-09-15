import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const sha256=name=>createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex');
const manifest=JSON.parse(read('SOURCE-MANIFEST.json'));
const main=read('game/main.js');
const hellWorld=read('game/src/hell-world.js');
const eggNests=read('game/src/egg-nests.js');
const cinemaSource=read('game/src/cinematic-pass.js');
const fieldGuideViewer=read('game/src/field-guide-viewer.js');
const renderBlock=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){'));
const checks=[];

assert.match(main,/new THREE\.WebGLRenderer\(\{\s*canvas:\s*dom\.canvas,\s*antialias:\s*false/);
assert.match(main,/powerPreference:\s*'high-performance'/);
assert.match(main,/failIfMajorPerformanceCaveat:\s*false/);
assert.match(cinemaSource,/samples:4/);
const renderer={getRenderTarget:()=>null,setRenderTarget:()=>{},getDrawingBufferSize:v=>v.set(1400,900),render:()=>{},clearDepth:()=>{}};
assert.equal(createCinematicPass(renderer).stats().worldMsaaSamples,4);
checks.push('canvas-antialias-off-world-hdr-msaa-4');

assert.match(main,/scratchPresentationView/);
assert.doesNotMatch(renderBlock,/getWorldPosition\(new THREE\.Vector3\(\)\)/);
assert.match(hellWorld,/hotSpillTargetOffset/);
assert.doesNotMatch(hellWorld,/\.add\(new THREE\.Vector3\(side\*20,-5,0\)\)/);
assert.match(eggNests,/debrisPrev=new THREE\.Vector3\(\)/);
assert.match(eggNests,/debrisLocal=new THREE\.Vector3\(\)/);
assert.match(eggNests,/debrisLerp=new THREE\.Vector3\(\)/);
assert.doesNotMatch(eggNests,/e\.bodyWorld\.clone\(\)/);
assert.doesNotMatch(eggNests,/e\.bodyPrev\.clone\(\)\.lerp\(e\.bodyWorld/);
checks.push('scratch-vector-reuse-sites');

assert.match(main,/titlePresented/);
assert.match(main,/function titleIdleHold\(\)/);
assert.match(main,/titleHold=titleIdleHold\(\)/);
assert.match(main,/if\(!titleHold\)/);
assert.match(main,/collisionHold\|\|holdPresent\|\|titleHold/);
assert.match(main,/if\(game\.title\)titlePresented=true/);
for(const path of ['game/main.js','game/src/hell-world.js','game/src/egg-nests.js']){
 const row=manifest.files.find(item=>item.path===path);
 assert.ok(row);
 assert.equal(sha256(path),row.sha256);
}
const titleIdleHoldBody=main.match(/function titleIdleHold\(\)\{return ([^}]+);\}/)?.[1];
assert.ok(titleIdleHoldBody);
const evalTitleIdleHold=new Function('game','settingsOnly','fieldGuideOpen','titlePresented',`return ${titleIdleHoldBody.replace("$('#fieldGuide')?.open",'fieldGuideOpen')};`);
const titleState={title:true};
assert.equal(evalTitleIdleHold(titleState,false,false,false),false,'hold waits for first title present');
assert.equal(evalTitleIdleHold(titleState,false,false,true),true,'idle ready title holds');
assert.equal(evalTitleIdleHold(titleState,true,false,true),false,'settings open releases hold');
assert.equal(evalTitleIdleHold(titleState,false,true,true),false,'field guide open releases hold');
assert.equal(evalTitleIdleHold({title:false},false,false,true),false,'deploy clears title');
assert.match(main,/function reset\(\)\{[\s\S]*game\.title=false;[\s\S]*titlePresented=false/);
assert.match(main,/function start\([\s\S]*reset\(\)/);
checks.push('title-idle-hold-wiring');

assert.match(fieldGuideViewer,/new THREE\.WebGLRenderer\(\{alpha:false,antialias:true/);
checks.push('field-guide-viewer-independent');

const presentStart=renderBlock.indexOf("if(!game.contextLost&&!graphicsPreparation&&loadingSnapshot().status!=='failed'){");
assert.ok(presentStart>0);
const presentTail=renderBlock.slice(presentStart,renderBlock.lastIndexOf('}'));
const present=new Function('env',`const {game,graphicsPreparation,loadingSnapshot,renderer,cinematic,frameMetrics,requestAnimationFrame,render,document,titleHold,visualTime,exteriorView,elapsed,WORLD_ONLY,scene,camera,reducedOpening}=env;
const reducedMotion={matches:false};
${presentTail}`);

function runPresent({game,titleHold=false,status='ready',active=null,paused=false,hidden=false}){
 const calls={reset:0,draw:0,raf:0};
 present({
  game:{title:true,running:false,opening:false,ended:false,captureFreeze:false,contextLost:false,paused,...game},
  graphicsPreparation:false,loadingSnapshot:()=>({status,active}),titleHold,
  visualTime:0,exteriorView:true,elapsed:.02,WORLD_ONLY:false,scene:{},camera:{},
  reducedOpening:()=>false,
  renderer:{info:{reset(){calls.reset++;},render:{calls:9,triangles:40,points:2}}},
  cinematic:{render(){calls.draw++;}},frameMetrics:{},document:{hidden},
  requestAnimationFrame(){calls.raf++;},render:()=>{},
 });
 return calls;
}

assert.deepEqual(runPresent({game:{title:true},titleHold:false}),{reset:1,draw:1,raf:1});
assert.deepEqual(runPresent({game:{title:true},titleHold:true}),{reset:0,draw:0,raf:1});
assert.deepEqual(runPresent({game:{title:false,opening:true,running:true},titleHold:false}),{reset:1,draw:1,raf:1});
for(const [label,titleHold,expected] of [
 ['first-title-present',false,1],
 ['idle-ready-title',true,0],
 ['settings-open',false,1],
 ['field-guide-open',false,1],
 ['deploy-start',false,1],
]){
 const calls=runPresent({game:{title:label!=='deploy-start'},titleHold});
 assert.equal(calls.draw,expected,label);
 assert.equal(calls.raf,1,label);
}
checks.push('title-present-hold-branch');

assert.match(renderBlock,/if\(!titleHold\)\{[\s\S]*hellWorld\.update/);
assert.match(renderBlock,/if\(!titleHold\)\{[\s\S]*eggNests\?\.update/);
checks.push('title-world-update-hold');

for(const [status,active,paused,hidden,expected] of [
 ['preparing','collision',false,false,0],
 ['ready',null,false,true,0],
 ['ready',null,true,false,0],
 ['ready',null,false,false,1],
]){
 const calls=runPresent({game:{title:false,running:true},titleHold:false,status,active,paused,hidden});
 assert.equal(calls.draw,expected,JSON.stringify({status,active,paused,hidden}));
}
checks.push('pause-hidden-collision-holds-retained');

const scratch=new THREE.Vector3(),camera={getWorldPosition(out){return out.set(4,5,6);}};
assert.deepEqual(camera.getWorldPosition(scratch).toArray(),camera.getWorldPosition(new THREE.Vector3()).toArray());
checks.push('scratch-presentation-view-numerics');

console.log(JSON.stringify({passed:true,checks,count:checks.length,scope:'T1 perf: canvas AA off, title idle hold, scratch vectors, existing present holds preserved.'}));
