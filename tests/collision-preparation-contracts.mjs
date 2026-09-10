// Offline collision-slice contracts. Injectable clocks/timers prove the
// zero-progress stall class and cancel/retry hygiene. No browser, Safari,
// GPU, or gameplay claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSlicedIteratorPreparation} from '../game/src/sliced-iterator-preparation.js';
import {boundedPreparation} from '../game/src/mission-screen.js';
import * as THREE from '../game/vendor/three.module.js';
const names=[],check=async(name,fn)=>{await fn();names.push(name);};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(){
 let clock=0,nextTimer=0;
 const timers=new Map(),history=[];
 const setTimer=(fn,delay=0)=>{const id=++nextTimer,entry={id,fn,delay,at:clock+Math.max(0,Number(delay)||0)};timers.set(id,entry);history.push(entry);return id;};
 const clearTimer=id=>timers.delete(id);
 const fire=id=>{const e=timers.get(id);assert.ok(e,'timer must exist');clock=Math.max(clock,e.at);timers.delete(id);e.fn();};
 const fireNext=()=>{const e=[...timers.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];assert.ok(e,'pending timer required');fire(e.id);};
 return {now:()=>clock,advance(ms){clock+=ms;},setClock(t){clock=t;},schedule:setTimer,cancel:clearTimer,timers,history,fire,fireNext,setTimer,clearTimer};
}
function* steps(n){for(let i=0;i<n;i++)yield i;}
async function drain(h,promise,limit=200){
 for(let i=0;i<limit;i++){
  await flush();
  if(h.timers.size===0){await promise;return i;}
  h.fireNext();
 }
 throw Error('drain exceeded slice limit');
}

await check('coarse-clock-still-advances-at-least-one-step-per-slice',async()=>{
 const h=harness();const slices=[];
 // Each now() read jumps 3ms — the old `<2` budget would schedule forever with zero next().
 const p=createSlicedIteratorPreparation(steps(5),{
  now:()=>{h.advance(3);return h.now();},
  schedule:h.schedule,cancelSchedule:h.cancel,sliceBudgetMs:2,
  onSlice:s=>slices.push(s),
 });
 const fired=await drain(h,p);
 assert.ok(fired>=5);assert.equal(slices.length,fired);assert.ok(slices.every(s=>s.stepped));assert.equal(h.timers.size,0);
});

await check('fine-clock-may-batch-multiple-steps-inside-one-slice',async()=>{
 const h=harness();let slices=0;
 const p=createSlicedIteratorPreparation(steps(20),{now:h.now,schedule:h.schedule,cancelSchedule:h.cancel,sliceBudgetMs:2,onSlice:()=>slices++});
 await drain(h,p);
 assert.equal(slices,1);assert.equal(h.timers.size,0);
});

await check('cancel-stops-further-slices-and-rejects',async()=>{
 const h=harness();let slices=0;
 const p=createSlicedIteratorPreparation(steps(100),{
  now:()=>{h.advance(3);return h.now();},
  schedule:h.schedule,cancelSchedule:h.cancel,
  onSlice:()=>slices++,
 });
 const rejected=assert.rejects(p,e=>e.code==='PREPARATION_CANCELED');
 h.fireNext();await flush();assert.equal(slices,1);assert.equal(h.timers.size,1);
 p.cancel();await rejected;assert.equal(h.timers.size,0);
});

await check('bounded-preparation-cancels-task-on-timeout',async()=>{
 const h=harness();let canceled=0;
 const work=()=>{
  const task=createSlicedIteratorPreparation(steps(1000),{
   now:()=>{h.advance(3);return h.now();},
   schedule:h.schedule,cancelSchedule:h.cancel,
  });
  const cancel=task.cancel;task.cancel=()=>{canceled++;cancel();};
  return task;
 };
 const promise=boundedPreparation(work,{timeoutMs:10,setTimer:h.setTimer,clearTimer:h.clearTimer,now:h.now});
 const rejected=assert.rejects(promise,e=>e.code==='PREPARATION_TIMEOUT');
 await flush();
 const deadline=[...h.timers.values()].find(t=>t.delay===10);
 assert.ok(deadline,'deadline timer must be pending');
 h.fire(deadline.id);await rejected;assert.equal(canceled,1);assert.equal(h.timers.size,0);
});

await check('retry-after-cancel-can-start-a-fresh-preparation',async()=>{
 const h=harness();
 const first=createSlicedIteratorPreparation(steps(50),{
  now:()=>{h.advance(3);return h.now();},schedule:h.schedule,cancelSchedule:h.cancel,
 });
 const rejected=assert.rejects(first,e=>e.code==='PREPARATION_CANCELED');
 h.fireNext();first.cancel();await rejected;assert.equal(h.timers.size,0);
 const second=createSlicedIteratorPreparation(steps(3),{
  now:()=>{h.advance(3);return h.now();},schedule:h.schedule,cancelSchedule:h.cancel,
 });
 await drain(h,second);assert.equal(h.timers.size,0);
});

await check('invalid-iterator-and-budget-reject-before-scheduling',()=>{
 const h=harness();
 assert.throws(()=>createSlicedIteratorPreparation(null,{schedule:h.schedule}),/iterator/);
 assert.throws(()=>createSlicedIteratorPreparation(steps(1),{sliceBudgetMs:0,schedule:h.schedule}),/budget/);
 assert.equal(h.timers.size,0);
});

const nests=readFileSync(new URL('../game/src/egg-nests.js',import.meta.url),'utf8');
function collisionFixture(){
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(20,20,24,24),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));root.add(mesh);
 const body=nests.slice(nests.indexOf(' const collisionBins=new Map()'),nests.indexOf(' const uniforms={uReveal:'));
 assert.ok(body.startsWith(' const collisionBins=new Map()'));
 return new Function('THREE','world','V','tmpM','ray','createSlicedIteratorPreparation',body+`return {prepareCollision,rebuildCollision,traceDebris,snapshot:()=>({ready:collisionReady,builds:collisionBuilds,entries:collisionEntries.length,iterator:collisionIterator,preparation})};`)(THREE,{root,collisionMeshes:[mesh]},(...v)=>new THREE.Vector3(...v),new THREE.Matrix4(),new THREE.Raycaster(),createSlicedIteratorPreparation);
}
const hooks=h=>({now:()=>{h.advance(3);return h.now();},schedule:h.schedule,cancel:h.cancel});
await check('actual-collision-preparation-progress-and-rays-match-synchronous-build',async()=>{
 const h=harness(),asyncModel=collisionFixture(),syncModel=collisionFixture();
 syncModel.rebuildCollision();await drain(h,asyncModel.prepareCollision(hooks(h)));
 assert.equal(asyncModel.snapshot().ready,true);assert.equal(asyncModel.snapshot().builds,1);assert.equal(asyncModel.snapshot().entries,syncModel.snapshot().entries);
 for(let x=-12;x<=12;x+=2)for(let y=-12;y<=12;y+=2){const a=new THREE.Vector3(x,y,10),b=new THREE.Vector3(x,y,-10),left=syncModel.traceDebris(a,b),right=asyncModel.traceDebris(a,b);assert.equal(Boolean(right),Boolean(left));if(left)assert.ok(left.point.distanceTo(right.point)<1e-9);}
});
await check('actual-immediate-retry-keeps-its-iterator-after-old-rejection',async()=>{
 const h=harness(),model=collisionFixture(),first=model.prepareCollision(hooks(h)),rejected=assert.rejects(first,e=>e.code==='PREPARATION_CANCELED');
 h.fireNext();first.cancel();const second=model.prepareCollision(hooks(h)),iterator=model.snapshot().iterator;assert.ok(iterator);
 await rejected;await flush();assert.equal(model.snapshot().iterator,iterator);assert.equal(model.snapshot().preparation,second);
 await drain(h,second);assert.equal(model.snapshot().ready,true);assert.equal(model.snapshot().builds,1);
});
await check('actual-stale-cancel-cannot-change-a-new-attempt',async()=>{
 const h=harness(),model=collisionFixture(),first=model.prepareCollision(hooks(h)),rejected=assert.rejects(first,e=>e.code==='PREPARATION_CANCELED');first.cancel();await rejected;await flush();
 const second=model.prepareCollision(hooks(h)),iterator=model.snapshot().iterator;first.cancel();first.cancel();
 assert.equal(model.snapshot().iterator,iterator);assert.equal(model.snapshot().preparation,second);assert.equal(h.timers.size,1);
 await drain(h,second);assert.equal(model.snapshot().ready,true);
});
await check('egg-nests-prepareCollision-uses-sliced-helper-and-clears-sticky-state',()=>{
 assert.match(nests,/createSlicedIteratorPreparation/);
 assert.match(nests,/tracked\.cancel/);
 assert.match(nests,/collisionIterator=null/);
 assert.match(nests,/clearSticky/);
 assert.doesNotMatch(nests,/while\(!done&&performance\.now\(\)-begin<2\)done=collisionIterator\.next\(\)\.done/);
});

const mission=readFileSync(new URL('../game/src/mission-screen.js',import.meta.url),'utf8');
await check('boundedPreparation-invokes-task-cancel-on-deadline',()=>{
 assert.match(mission,/task\?\.cancel\?\.\(\)/);
 assert.match(mission,/task=work\(\);return task/);
});

console.log(JSON.stringify({passed:true,checks:names.length,names,scope:'Offline sliced-iterator liveness/cancel/retry contracts and source wiring. No Safari, browser, or gameplay claim.'},null,2));
