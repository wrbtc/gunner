// Execute the actual main-owned lifetime with the real singleton controller.
// Constructor geometry/ray equivalence is covered separately on authored assets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../game/vendor/three.module.js?v=052';
import {createStaticRaycast} from '../game/src/static-raycast.js';
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const source=main.slice(main.indexOf('let constructionRaycast=null;'),main.indexOf("await assembly.step('dance',()=>{"));
const execute=new (async()=>{}).constructor('assembly','createStaticRaycast','hellWorld','startupMark',source);
const expected=['support-index','tanks','blast','nests','ruins','gallery'];
const checks=[];
async function check(name,run){await run();checks.push(name);}
const native=[T.Mesh.prototype.raycast,T.InstancedMesh.prototype.raycast,T.Mesh.prototype._computeIntersections];
const restored=()=>assert.deepEqual([T.Mesh.prototype.raycast,T.InstancedMesh.prototype.raycast,T.Mesh.prototype._computeIntersections],native);
function fixture({failAt=null,afterBuild=false,wait=null}={}){
 const mesh=new T.Mesh(new T.PlaneGeometry(10,10,4,4),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
 const log=[],failure=Object.assign(Error('canceled or failed construction'),{code:'PREPARATION_CANCELED'});let controller,disposals=0;
 const create=meshes=>{assert.deepEqual(meshes,[mesh]);controller=createStaticRaycast(meshes);const dispose=controller.dispose;controller.dispose=()=>{disposals++;dispose();};return controller;};
 const assembly={async step(name,work){
  log.push(name);
  if(name===failAt&&!afterBuild)throw failure;
  if(name==='support-index')await work();
  assert.ok(controller&&!controller.stats().disposed,'controller active for '+name);
  assert.notEqual(T.Mesh.prototype.raycast,native[0]);
  if(name===failAt&&afterBuild)throw failure;
  if(wait?.name===name)await wait.promise;
 }};
 return{run:()=>execute(assembly,create,{collisionMeshes:[mesh]},()=>{}),log,failure,get controller(){return controller;},get disposals(){return disposals;}};
}
await check('actual lifetime indexes before support work and restores before dance',async()=>{
 const f=fixture();await f.run();assert.deepEqual(f.log,expected);assert.equal(f.disposals,1);assert.equal(f.controller.stats().disposed,true);restored();
 // The unchanged final controller can subsequently acquire the singleton.
 const final=createStaticRaycast([]);final.dispose();restored();
});
await check('failure or cancellation at every construction step releases the controller',async()=>{
 for(const failAt of expected.slice(1)){const f=fixture({failAt});await assert.rejects(f.run(),e=>e===f.failure);assert.deepEqual(f.log,expected.slice(0,expected.indexOf(failAt)+1));assert.equal(f.disposals,1);restored();}
});
await check('cancellation before index work creates no controller',async()=>{
 const f=fixture({failAt:'support-index'});await assert.rejects(f.run(),e=>e===f.failure);assert.equal(f.controller,undefined);assert.equal(f.disposals,0);restored();
});
await check('deadline after index build still releases its installed prototype hooks',async()=>{
 const f=fixture({failAt:'support-index',afterBuild:true});await assert.rejects(f.run(),e=>e===f.failure);assert.equal(f.disposals,1);restored();
});
await check('controller remains owned across an awaited step and releases on rejection',async()=>{
 let reject;const promise=new Promise((_,r)=>{reject=r;});const f=fixture({wait:{name:'ruins',promise}}),run=f.run();
 await new Promise(r=>setImmediate(r));assert.deepEqual(f.log,expected.slice(0,5));assert.equal(f.disposals,0);assert.equal(f.controller.stats().disposed,false);
 reject(f.failure);await assert.rejects(run,e=>e===f.failure);assert.equal(f.disposals,1);restored();
});
await check('real index construction failure restores hooks and does not enter later work',async()=>{
 const broken=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial());broken.geometry.attributes.position={itemSize:3,count:3,getX(){throw Error('invalid geometry');}};
 const log=[];await assert.rejects(execute({async step(name,work){log.push(name);await work();}},createStaticRaycast,{collisionMeshes:[broken]},()=>{}),/invalid geometry/);
 assert.deepEqual(log,['support-index']);restored();const final=createStaticRaycast([]);final.dispose();restored();
});
console.log(JSON.stringify({passed:true,count:checks.length,checks,scope:'Actual main lifetime and real static controller; no browser/Safari timing claim'},null,2));
