import assert from 'node:assert/strict';
import * as T from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';
const checks=[],observerErrors=[];
async function check(name,fn){await fn();checks.push(name);}
function fixture(){
 const world=new T.Scene(),camera=new T.PerspectiveCamera();camera.layers.mask=19;
 const ground=new T.MeshStandardMaterial(),air=new T.MeshStandardMaterial();
 const worldObjects=Array.from({length:35},()=>new T.Mesh(new T.BoxGeometry(),ground));
 for(const o of worldObjects)world.add(o);
 worldObjects[0].visible=false;
 const plane=new T.Mesh(new T.BoxGeometry(),air);plane.layers.set(1);world.add(plane);
 const shared=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());shared.layers.enable(1);world.add(shared);
 for(let i=0;i<2;i++)world.add(new T.PointLight());
 const airLight=new T.PointLight();airLight.layers.set(1);world.add(airLight);
 const roots=Array.from({length:3},(_,i)=>{const o=new T.Group();o.visible=i===1;o.add(new T.PointLight());world.add(o);return o;});
 const reveal=new T.Group();reveal.visible=true;reveal.add(new T.PointLight());world.add(reveal);
 const originalTarget=new T.WebGLRenderTarget(2,2);let target=originalTarget,lost=false,ready=true,fail=null,delayUniform=0,delayCompile=0;
 const calls=[],props=new Map(),programs=[],progress=[];
 const renderer={getContext:()=>({isContextLost:()=>lost}),getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getDrawingBufferSize:v=>v.set(1400,900),properties:{get:m=>props.get(m)},compile(selection,view,actualScene){
  if(delayCompile){const stop=performance.now()+delayCompile;while(performance.now()<stop){}}
  assert.ok(actualScene);assert.notEqual(selection,actualScene);
  const objects=[],sourceLights=[];selection.traverse(o=>objects.push(o));selection.traverseVisible(o=>{if(o.isLight)sourceLights.push(o);});assert.equal(sourceLights.length,0);
  assert.ok(objects.length<=16);let count=0;actualScene.traverseVisible(o=>{if(o.isPointLight&&o.layers.test(view.layers))count++;});
  const capture=actualScene!==world,materials=new Set(objects.map(o=>o.material));
  for(const o of objects)if(!capture)assert.ok(o.layers.test(view.layers));
  const call={objects,mask:view.layers.mask,count,capture,target,materials};calls.push(call);
  if(fail?.(call))throw Error('Injected compile failure');
  for(const material of materials){
   if(!props.has(material))props.set(material,{programs:new Map()});
   const cache=props.get(material).programs,key=[view.layers.mask,count,target.texture.type].join(':');
   if(!cache.has(key)){const program={uniforms:0,attributes:0,polls:0,isReady(){this.polls++;return ready;},getUniforms(){this.uniforms++;const stop=performance.now()+delayUniform;while(performance.now()<stop){}},getAttributes(){this.attributes++;}};cache.set(key,program);programs.push(program);}
  }
  return materials;
 }};
 const cinema=createCinematicPass(renderer);
 const restored=()=>{assert.equal(target,originalTarget);assert.equal(camera.layers.mask,19);assert.equal(reveal.visible,true);assert.deepEqual(roots.map(o=>o.visible),[false,true,false]);assert.equal(plane.parent,world);assert.equal(worldObjects[0].parent,world);};
 const options={reveal:[reveal],lightVariants:{roots,maxVisible:2},onProgress:p=>{try{restored();}catch(error){observerErrors.push(error.message);}progress.push(p);}};
 return {world,camera,cinema,options,calls,props,programs,progress,worldObjects,plane,shared,ground,air,roots,reveal,restored,setReady:v=>{ready=v;},setLost:v=>{lost=v;},setFailure:v=>{fail=v;},setDelay:v=>{delayUniform=v;},setCompileDelay:v=>{delayCompile=v;}};
}
await check('exact-layer-selection-preserves-hidden-materials-and-shared-layer-objects',async()=>{
 const f=fixture();assert.equal(await f.cinema.prepare(f.world,f.camera,f.options),true);
 const wc=f.calls.filter(c=>!c.capture&&c.mask===1),ac=f.calls.filter(c=>!c.capture&&c.mask===2);
 assert.ok(wc.some(c=>c.objects.includes(f.worldObjects[0])));assert.ok(wc.every(c=>!c.objects.includes(f.plane)));
 assert.ok(ac.every(c=>c.objects.every(o=>o===f.plane||o===f.shared)));
 assert.ok(wc.some(c=>c.objects.includes(f.shared)));assert.ok(ac.some(c=>c.objects.includes(f.shared)));
 assert.deepEqual([...new Set(wc.map(c=>c.count))],[2,3,4,5]);assert.deepEqual([...new Set(ac.map(c=>c.count))],[1]);
 assert.deepEqual(f.cinema.stats().preparedPointLightCounts,[2,3,4,5]);f.restored();
});
const worldJobs=f=>f.calls.filter(c=>!c.capture&&c.mask===1&&c.objects.includes(f.worldObjects[0]));
await check('bound-five-dedup-keeps-all-seven-world-counts-one-cockpit-and-capture',async()=>{
 const f=fixture();for(let i=0;i<9;i++)f.world.add(new T.PointLight());
 const extra=Array.from({length:5},()=>{const root=new T.Group();root.visible=false;root.add(new T.PointLight());f.world.add(root);return root;});
 const options={...f.options,lightVariants:{roots:[...f.roots,...extra],maxVisible:5}};
 assert.equal(await f.cinema.prepare(f.world,f.camera,options),true);
 assert.deepEqual(worldJobs(f).map(c=>c.count),[11,12,13,14,15,16,17]);
 assert.equal(f.calls.filter(c=>!c.capture&&c.mask===2).length,1);assert.equal(f.calls.filter(c=>c.capture).length,1);assert.equal(f.calls.length,23);
 assert.deepEqual(f.cinema.stats().preparedPointLightCounts,[11,12,13,14,15,16,17]);
 assert.equal(f.progress.find(p=>p.stage==='submit').total,7*36+2+1);f.restored();assert.ok(extra.every(root=>!root.visible));
});
await check('slow-compile-conserves-intermediate-light-count-jobs',async()=>{
 const f=fixture();for(let i=0;i<9;i++)f.world.add(new T.PointLight());
 const extra=Array.from({length:5},()=>{const root=new T.Group();root.visible=false;root.add(new T.PointLight());f.world.add(root);return root;});
 f.setCompileDelay(30);
 const options={...f.options,lightVariants:{roots:[...f.roots,...extra],maxVisible:5},timeoutMs:400};
 assert.equal(await f.cinema.prepare(f.world,f.camera,options),true);
 assert.deepEqual([...new Set(worldJobs(f).map(c=>c.count))],[11,17]);
 assert.equal(f.calls.filter(c=>!c.capture&&c.mask===2).length,1);assert.equal(f.calls.filter(c=>c.capture).length,1);
 assert.ok(f.calls.length<23);assert.equal(f.calls.length,8);
 assert.deepEqual(f.cinema.stats().preparedPointLightCounts,[11,17]);
 const firstSubmit=f.progress.find(p=>p.stage==='submit'),lastSubmit=f.progress.filter(p=>p.stage==='submit').at(-1);
 assert.equal(firstSubmit.total,7*36+2+1);assert.ok(lastSubmit.total<firstSubmit.total);
 assert.equal(f.progress.at(-1).stage,'ready');f.restored();assert.ok(extra.every(root=>!root.visible));
});
await check('shadow-light-reveal-never-collapses-with-equal-unshadowed-point-count',async()=>{
 const f=fixture();f.reveal.children[0].castShadow=true;await f.cinema.prepare(f.world,f.camera,f.options);
 assert.deepEqual(worldJobs(f).map(c=>c.count),[2,3,4,3,4,5]);assert.equal(f.calls.filter(c=>!c.capture&&c.mask===2).length,1);f.restored();
});
await check('different-light-type-reveal-never-collapses-with-equal-point-count',async()=>{
 const f=fixture();f.reveal.clear();f.reveal.add(new T.DirectionalLight());await f.cinema.prepare(f.world,f.camera,f.options);
 assert.deepEqual(worldJobs(f).map(c=>c.count),[2,3,4,2,3,4]);f.restored();
});
await check('different-camera-layer-light-coverage-is-retained',async()=>{
 const f=fixture();f.reveal.children[0].layers.set(1);await f.cinema.prepare(f.world,f.camera,f.options);
 assert.deepEqual(worldJobs(f).map(c=>c.count),[2,3,4]);assert.deepEqual(f.calls.filter(c=>!c.capture&&c.mask===2).map(c=>c.count),[1,2]);f.restored();
});
await check('light-with-a-map-retains-conservative-identity-bound-job',async()=>{
 const f=fixture();f.reveal.children[0].map=new T.Texture();await f.cinema.prepare(f.world,f.camera,f.options);
 assert.deepEqual(worldJobs(f).map(c=>c.count),[2,3,4,3,4,5]);f.restored();
});
await check('job-deduplication-is-local-to-one-preparation-call',async()=>{
 const f=fixture();await f.cinema.prepare(f.world,f.camera,f.options);const first=f.calls.length;
 await f.cinema.prepare(f.world,f.camera,f.options);assert.equal(f.calls.length,first*2);assert.equal(f.calls.filter(c=>c.capture).length,2);
});
await check('callers-without-variable-lights-preserve-their-existing-visibility',async()=>{
 const f=fixture();assert.equal(await f.cinema.prepare(f.world,f.camera,{reveal:f.options.reveal,onProgress:f.options.onProgress}),true);
 assert.deepEqual([...new Set(f.calls.filter(c=>!c.capture&&c.mask===1).map(c=>c.count))],[4]);
 assert.deepEqual([...new Set(f.calls.filter(c=>!c.capture&&c.mask===2).map(c=>c.count))],[1]);f.restored();
});
await check('submission-is-batched-and-state-restored-before-progress-and-every-yield',async()=>{
 const f=fixture();let ticks=0;const OriginalChannel=globalThis.MessageChannel;
 globalThis.MessageChannel=class extends OriginalChannel{constructor(){super();this.port1.addEventListener('message',()=>{f.restored();ticks++;});}};
 try{const p=f.cinema.prepare(f.world,f.camera,f.options);assert.equal(f.calls.length,0);assert.equal(await p,true);assert.ok(ticks>10);assert.ok(f.calls.every(c=>c.objects.length<=16));}finally{globalThis.MessageChannel=OriginalChannel;}
 assert.equal(f.progress.at(-1).stage,'ready');assert.equal(f.cinema.stingSnapshot().serial,0);
});
await check('world-and-capture-use-exact-target-types-with-no-quad-material-leak',async()=>{
 const f=fixture();await f.cinema.prepare(f.world,f.camera,f.options);
 assert.ok(f.calls.filter(c=>!c.capture).every(c=>c.target.texture.type===T.HalfFloatType));
 const capture=f.calls.find(c=>c.capture);assert.equal(capture.target.texture.type,T.UnsignedByteType);
 assert.ok(!capture.materials.has(capture.objects[0].material));
 assert.ok(f.programs.every(p=>p.uniforms===1&&p.attributes===1));
});
await check('same-context-callers-share-one-preparation-and-observe-completion',async()=>{
 const f=fixture(),extra=[];const a=f.cinema.prepare(f.world,f.camera,f.options),b=f.cinema.prepare(f.world,f.camera,{...f.options,onProgress:p=>extra.push(p)});assert.equal(a,b);assert.equal(await a,true);assert.equal(extra.at(-1).stage,'ready');
});
await check('different-scene-overlap-rejects-without-disturbing-owner',async()=>{
 const f=fixture(),a=f.cinema.prepare(f.world,f.camera,f.options);
 await assert.rejects(f.cinema.prepare(new T.Scene(),f.camera,f.options),e=>e.code==='PREPARATION_BUSY');assert.equal(await a,true);
});
await check('stalled-linking-times-out-explicitly-and-never-marks-ready',async()=>{
 const f=fixture();f.setReady(false);
 await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,timeoutMs:35}),e=>e.code==='PREPARATION_TIMEOUT');
 assert.equal(f.cinema.stats().preparedPrograms,0);assert.deepEqual(f.cinema.stats().preparedPointLightCounts,[]);assert.equal(f.progress.at(-1).stage,'timed-out');f.restored();
 f.setReady(true);assert.equal(await f.cinema.prepare(f.world,f.camera,f.options),true);
});
await check('context-loss-cancels-and-fresh-generation-can-run-without-stale-success',async()=>{
 const f=fixture();f.setReady(false);const old=f.cinema.prepare(f.world,f.camera,f.options);
 await new Promise(r=>setTimeout(r,15));f.cinema.contextLost();f.setLost(true);assert.equal(await f.cinema.prepare(f.world,f.camera,f.options),false);f.setLost(false);f.setReady(true);
 const fresh=f.cinema.prepare(f.world,f.camera,f.options);assert.notEqual(old,fresh);assert.equal(await old,false);assert.equal(await fresh,true);assert.equal(f.cinema.stats().preparation.stage,'ready');f.restored();
});
await check('world-compile-error-restores-state-and-surfaces-failure',async()=>{
 const f=fixture();f.setFailure(c=>!c.capture&&c.count===3);
 await assert.rejects(f.cinema.prepare(f.world,f.camera,f.options),e=>e.code==='PREPARATION_FAILED');f.restored();assert.equal(f.cinema.stats().preparedPrograms,0);assert.equal(f.progress.at(-1).stage,'failed');
});
await check('capture-compile-error-restores-quad-material-and-scene',async()=>{
 const f=fixture();f.setFailure(c=>c.capture);
 await assert.rejects(f.cinema.prepare(f.world,f.camera,f.options),/Injected compile failure/);f.restored();const capture=f.calls.at(-1);assert.ok(!capture.materials.has(capture.objects[0].material));assert.equal(f.cinema.stats().preparedPrograms,0);
});
await check('invalid-options-reject-before-submission-and-do-not-lock-retry',async()=>{
 const f=fixture();await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,timeoutMs:0}),/Invalid graphics preparation timeout/);assert.equal(f.calls.length,0);
 await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,lightVariants:{roots:[],maxVisible:1}}),/Invalid light visibility bound/);assert.equal(f.calls.length,0);assert.equal(await f.cinema.prepare(f.world,f.camera,f.options),true);
});
await check('single-blocking-driver-call-cannot-escape-final-deadline-check',async()=>{
 const f=fixture();f.setDelay(30);await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,timeoutMs:20}),e=>e.code==='PREPARATION_TIMEOUT');assert.equal(f.cinema.stats().preparedPrograms,0);f.restored();
});
await check('first-use-batches-are-bounded-and-slow-first-program-does-not-starve-others',async()=>{
 const f=fixture();for(const object of f.worldObjects)object.material=new T.MeshStandardMaterial();
 let previous=0,maximumBatch=0;const onProgress=p=>{
  try{f.restored();}catch(error){observerErrors.push(error.message);}if(f.programs.length)f.programs[0].isReady=()=>false;
  if(p.stage==='link'){const reads=f.programs.reduce((n,program)=>n+program.uniforms,0);maximumBatch=Math.max(maximumBatch,reads-previous);previous=reads;}
 };
 await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,onProgress,timeoutMs:60}),e=>e.code==='PREPARATION_TIMEOUT');
 assert.ok(previous>8);assert.ok(maximumBatch<=8);assert.equal(f.programs[0].uniforms,0);assert.ok(f.calls.every(c=>!c.capture&&c.mask===1&&c.count===2));
});
await check('empty-material-scene-still-records-light-count-coverage',async()=>{
 const f=fixture();for(const o of [...f.world.children])if(o.material)f.world.remove(o);
 const options={...f.options,onProgress:undefined};assert.equal(await f.cinema.prepare(f.world,f.camera,options),true);assert.deepEqual(f.cinema.stats().preparedPointLightCounts,[2,3,4,5]);
});
async function trackedChannels(work){
 const OriginalChannel=globalThis.MessageChannel,channels=[];
 globalThis.MessageChannel=class extends OriginalChannel{constructor(){
  super();const row={closed:[0,0],messages:0};channels.push(row);
  for(const [i,port]of [this.port1,this.port2].entries()){const close=port.close.bind(port);port.close=()=>{row.closed[i]++;close();};}
  const post=this.port2.postMessage.bind(this.port2);this.port2.postMessage=value=>{row.messages++;post(value);};
 }};
 try{await work(channels);assert.ok(channels.length>0);for(const row of channels)assert.deepEqual(row.closed,[1,1]);}
 finally{globalThis.MessageChannel=OriginalChannel;}
}
await check('message-channel-owned-ports-close-on-success-empty-failure-and-invalid-input',async()=>{
 await trackedChannels(async channels=>{
  const f=fixture();await f.cinema.prepare(f.world,f.camera,f.options);assert.ok(channels[0].messages>10);
  f.setFailure(c=>c.capture);await assert.rejects(f.cinema.prepare(f.world,f.camera,f.options));
  await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,timeoutMs:0}));
  f.setFailure(null);const empty=new T.Scene();await f.cinema.prepare(empty,f.camera);assert.equal(channels.length,4);
 });
});
await check('message-channel-owned-ports-close-on-timeout-and-context-generation-cancellation',async()=>{
 await trackedChannels(async channels=>{
  const f=fixture();f.setReady(false);await assert.rejects(f.cinema.prepare(f.world,f.camera,{...f.options,timeoutMs:10}),e=>e.code==='PREPARATION_TIMEOUT');
  const old=f.cinema.prepare(f.world,f.camera,f.options);await new Promise(r=>setTimeout(r,5));f.cinema.contextLost();f.setReady(true);
  const fresh=f.cinema.prepare(f.world,f.camera,f.options);assert.equal(await old,false);assert.equal(await fresh,true);assert.equal(channels.length,3);
 });
});
await check('missing-message-channel-falls-back-to-timer-tasks-and-cleans-up',async()=>{
 const OriginalChannel=globalThis.MessageChannel,originalTimer=globalThis.setTimeout;let timers=0;
 globalThis.MessageChannel=undefined;globalThis.setTimeout=(...args)=>{timers++;return originalTimer(...args);};
 try{const f=fixture();assert.equal(await f.cinema.prepare(f.world,f.camera,f.options),true);assert.ok(timers>10);f.restored();}
 finally{globalThis.MessageChannel=OriginalChannel;globalThis.setTimeout=originalTimer;}
});
await check('progress-observers-always-see-restored-state',()=>assert.deepEqual(observerErrors,[]));
console.log(JSON.stringify({passed:true,checks:checks.length,names:checks},null,2));
