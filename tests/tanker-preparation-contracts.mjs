import assert from 'node:assert/strict';
import * as T from '../game/vendor/three.module.js';
import {createTankerBugs,createTankerBugsAsync} from '../game/src/tanker-bug.js';
const checks=[];
async function check(name,fn){await fn();checks.push(name);}
const V=(...args)=>new T.Vector3(...args);
function fixture(count=2){
 const bank=new T.Mesh(new T.PlaneGeometry(2000,2000,4,4),new T.MeshBasicMaterial({side:T.DoubleSide}));bank.rotation.x=-Math.PI/2;bank.updateMatrixWorld(true);
 const samples=[],nativeRaycast=bank.raycast;bank.raycast=function(ray,out){samples.push(ray.ray.origin.toArray());return nativeRaycast.call(this,ray,out);};
 const actors=Array.from({length:count},(_,i)=>({id:'tank-'+i,p:.01+i*.02,side:i%2?-1:1,root:new T.Group(),initialPhase:i*.3,dead:false,state:'idle',timer:1}));
 const sounds=[];let clones=0;
 const cinderModel={stats:{triangles:16},clone(){
  clones++;const root=new T.Group(),body=new T.Bone(),jaw=new T.Bone(),mouth=new T.Bone(),skin=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());root.add(body,skin);body.add(jaw,mouth);mouth.position.set(0,1,-2);
  const limbs=Array.from({length:4},(_,i)=>{const side=i%2?-1:1,hip=V(side,1,i<2?-1:1),palm=V(side*2,.2,i<2?-2:2),upper=new T.Bone(),lower=new T.Bone(),foot=new T.Bone();upper.position.copy(hip);lower.position.y=1;foot.position.y=1;body.add(upper);upper.add(lower);lower.add(foot);return {side,hip,knee:hip.clone().add(V(side,.3,.4)),palm,upper,lower,foot,upperLength:1,lowerLength:1};});
  root.updateMatrixWorld(true);const rest=new Map();root.traverse(n=>{if(n.isBone)rest.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),worldQuaternion:n.getWorldQuaternion(new T.Quaternion())});});
  return{root,body,jaw,mouth,skin,rest,limbs,resetPose(){for(const[n,r]of rest){n.position.copy(r.position);n.quaternion.copy(r.quaternion);}root.updateMatrixWorld(true);},bodyPoint(p,out=V()){body.updateWorldMatrix(true,false);return out.copy(p).applyMatrix4(body.matrixWorld);}};
 }};
 const options={actors,glowTexture:null,bankMeshes:[bank],centerAt:p=>V(0,0,-p*3050),widthAt:()=>30,cinderModel,planeVel:V(),audio:{tanker:(...x)=>sounds.push(x.map(v=>v?.isVector3?v.toArray():v))}};
 return{options,samples,sounds,get clones(){return clones;}};
}
function snapshot(api){return api.actors.map(e=>{
 const transforms=[];e.root.traverse(n=>transforms.push([n.type,n.position.toArray(),n.quaternion.toArray(),n.scale.toArray(),n.visible]));
 return {path:e.path.nodes,cache:[...e.path.footHeights],transforms,hp:e.hp,travel:e.travel,rear:e.rear,alert:e.alert,stats:e.tankerStats,hitSpheres:e.hitSpheres.map(h=>[h.center.toArray(),h.radius]),throat:[e.throat.scale.toArray(),e.throatGlow.material.opacity,e.cinderRig.skin.material.emissiveIntensity],contacts:e.legs.map(l=>({point:l.point.toArray(),surface:l.surface.toArray(),hold:l.hold?.toArray(),ik:l.ik,planted:l.planted}))};
});}
await check('async-and-sync-preserve-all-ordered-rays-model-pose-and-gameplay-state',async()=>{
 const a=fixture(),b=fixture(),sync=createTankerBugs(a.options),progress=[];
 const asyncApi=await createTankerBugsAsync(b.options,{checkpoint:async p=>{progress.push({...p,samples:b.samples.length});await Promise.resolve();}});
 assert.deepEqual(b.samples,a.samples);assert.deepEqual(snapshot(asyncApi),snapshot(sync));assert.deepEqual(b.sounds,a.sounds);
 for(const state of ['idle','windup','spraying'])for(let step=1;step<=3;step++){
  for(const api of [sync,asyncApi]){api.actors.forEach(e=>{e.state=state;});api.update(step*.05,V(0,45,130));}
  assert.deepEqual(snapshot(asyncApi),snapshot(sync));assert.deepEqual(b.sounds,a.sounds);
 }
 sync.reset();asyncApi.reset();assert.deepEqual(snapshot(asyncApi),snapshot(sync));
 assert.equal(progress.filter(p=>p.stage==='path').length,76);assert.equal(progress.filter(p=>p.stage==='setup').length,2);assert.equal(progress.filter(p=>p.stage==='reset').length,2);
 assert.equal(progress[0].stage,'begin');assert.equal(progress[0].samples,0);
 let prior=0;
 for(const p of progress){if(p.stage==='path'){assert.ok(p.samples-prior<=132);assert.ok(p.samples-prior>0);}prior=p.samples;}
 // Independent authored loop oracle:151x33 samples per actor, in exact order.
 let offset=0;
 for(const e of a.options.actors){
  assert.equal(e.path.nodes.length,151);
  for(let i=0;i<=150;i++)for(let j=0;j<=32;j++){
   const point=[e.side*(30-5.7)+(j-16)*.5,180,-(e.p+(-70+i*.6)/3050)*3050];
   assert.deepEqual(a.samples[offset++],point);assert.ok(Math.abs(e.path.nodes[i].heights[j])<1e-10);
  }
 }
 assert.equal(offset,9966);
});
await check('pending-checkpoint-does-not-build-next-slice',async()=>{
 const f=fixture();let release;const gate=new Promise(r=>{release=r;}),seen=[];
 const pending=createTankerBugsAsync(f.options,{checkpoint:async p=>{seen.push(p);if(p.stage==='path'&&p.completed===4)await gate;}});
 await new Promise(r=>setImmediate(r));assert.equal(f.samples.length,132);assert.equal(f.clones,0);assert.equal(f.options.actors[1].tanker,undefined);
 release();await pending;assert.equal(f.clones,2);
});
await check('rejected-begin-performs-no-actor-or-ray-work',async()=>{
 const f=fixture(),error=Error('context canceled');await assert.rejects(createTankerBugsAsync(f.options,{checkpoint:()=>{throw error;}}),e=>e===error);
 assert.equal(f.samples.length,0);assert.equal(f.clones,0);assert.ok(f.options.actors.every(e=>!e.tanker));
});
await check('rejected-path-stops-before-later-samples-setup-and-actors',async()=>{
 const f=fixture(),error=Error('deadline');await assert.rejects(createTankerBugsAsync(f.options,{checkpoint:p=>{if(p.stage==='path')throw error;}}),e=>e===error);
 await new Promise(r=>setImmediate(r));assert.equal(f.samples.length,132);assert.equal(f.clones,0);assert.equal(f.options.actors[1].tanker,undefined);assert.equal(f.options.actors[0].path,undefined);
});
await check('rejected-setup-stops-next-actor-and-initial-reset',async()=>{
 const f=fixture();await assert.rejects(createTankerBugsAsync(f.options,{checkpoint:p=>{if(p.stage==='setup')throw Error('stop');}}),/stop/);
 assert.equal(f.samples.length,4983);assert.equal(f.clones,1);assert.equal(f.options.actors[1].tanker,undefined);assert.equal(f.options.actors[0].tankerStats,undefined);
});
await check('rejected-reset-stops-later-actor-reset',async()=>{
 const f=fixture();await assert.rejects(createTankerBugsAsync(f.options,{checkpoint:p=>{if(p.stage==='reset')throw Error('stop');}}),/stop/);
 assert.equal(f.clones,2);assert.ok(f.options.actors[0].tankerStats);assert.equal(f.options.actors[1].tankerStats,undefined);
});
await check('missing-support-error-preserves-sample-location-and-stops-later-work',async()=>{
 for(const async of [false,true]){const f=fixture();f.options.bankMeshes=[];const run=()=>async?createTankerBugsAsync(f.options,{checkpoint:()=>{}}):createTankerBugs(f.options);
 if(async)await assert.rejects(run,/Tanker support missing tank-0\/0\/0/);else assert.throws(run,/Tanker support missing tank-0\/0\/0/);
 assert.equal(f.clones,0);assert.equal(f.options.actors[1].tanker,undefined);}
});
await check('empty-input-and-invalid-checkpoint-have-explicit-results',async()=>{
 const f=fixture(0),events=[];const api=await createTankerBugsAsync(f.options,{checkpoint:p=>events.push(p)});assert.deepEqual(api.actors,[]);assert.equal(events.length,1);assert.deepEqual(events[0],{stage:'begin',completed:0,total:0});
 await assert.rejects(createTankerBugsAsync(f.options,{checkpoint:null}),/requires a checkpoint/);
});
console.log(JSON.stringify({passed:true,count:checks.length,checks},null,2));
