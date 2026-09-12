import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';

const checks=[];
async function check(name,run){await run();checks.push(name);}
function block(ms){const end=performance.now()+ms;while(performance.now()<end){}}
function graphicsFixture({ready=false,compileMs=0,uniformMs=0,attributeMs=0,meshes=1}={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 for(let i=0;i<meshes;i++)scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
 const originalTarget=new THREE.WebGLRenderTarget(2,2);let target=originalTarget,nextId=1;
 const properties=new Map(),programs=[],events=[];
 const renderer={
  getContext:()=>({isContextLost:()=>false,getExtension:name=>name==='KHR_parallel_shader_compile'?{}:null}),
  getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},
  getDrawingBufferSize:value=>value.set(800,500),properties:{get:material=>properties.get(material)},
  compile(selection){
   block(compileMs);
   const materials=new Set();selection.traverse(object=>{if(object.material)materials.add(object.material);});
   for(const material of materials){
    if(properties.has(material))continue;
    const program={id:nextId++,uniforms:0,attributes:0,isReady:()=>ready,
     getUniforms(){this.uniforms++;block(uniformMs);},getAttributes(){this.attributes++;block(attributeMs);}};
    properties.set(material,{programs:new Map([['only',program]])});programs.push(program);
   }
   return materials;
  }
 };
 const pass=createCinematicPass(renderer);
 const prepare=timeoutMs=>pass.prepare(scene,camera,{timeoutMs,onProgress:event=>events.push({...event,uniformReads:programs.reduce((n,program)=>n+program.uniforms,0)})});
 return {pass,prepare,programs,events,originalTarget,currentTarget:()=>target};
}

await check('stalled-linking-emits-one-final-bounded-snapshot',async()=>{
 const f=graphicsFixture();
 await assert.rejects(f.prepare(200),error=>error.code==='PREPARATION_TIMEOUT');
 const failures=f.events.filter(event=>event.stage==='timed-out');
 assert.equal(failures.length,1);assert.ok(f.events.slice(0,-1).every(event=>event.preTimeoutSnapshot===undefined));
 const snapshot=failures[0].preTimeoutSnapshot;
 assert.equal(snapshot.lastPhase,'link-ready-poll');assert.equal(snapshot.lastCompletedPhase,'link-ready-poll');
 assert.ok(snapshot.totalJobs>snapshot.jobIndex);assert.equal(snapshot.discoveredPrograms,snapshot.pendingProgramIds.length);
 assert.equal(snapshot.finishedPrograms,0);assert.ok(snapshot.pendingProgramIds.length<=24);
 assert.equal(snapshot.exceptionCode,'PREPARATION_TIMEOUT');assert.match(snapshot.exceptionMessage,/timed out/i);
 assert.equal(snapshot.contextLost,false);assert.equal(snapshot.parallelCompile,true);
 assert.equal(f.currentTarget(),f.originalTarget);
});

await check('slow-uniform-introspection-is-attributed-before-attributes',async()=>{
 const f=graphicsFixture({ready:true,uniformMs:24});
 await assert.rejects(f.prepare(18),error=>error.code==='PREPARATION_TIMEOUT');
 const snapshot=f.events.at(-1).preTimeoutSnapshot;
 assert.equal(f.events.at(-1).stage,'timed-out');assert.equal(snapshot.lastPhase,'uniforms');
 assert.equal(snapshot.lastCompletedPhase,'link-ready-poll');assert.ok(snapshot.recentUniformsMs>=20);
 assert.equal(snapshot.recentAttributesMs,0);assert.equal(f.programs[0].attributes,0);
});

await check('single-slow-compile-is-attributed-before-progress',async()=>{
 const f=graphicsFixture({ready:true,compileMs:24});
 await assert.rejects(f.prepare(18),error=>error.code==='PREPARATION_TIMEOUT');
 const snapshot=f.events.at(-1).preTimeoutSnapshot;
 assert.equal(snapshot.lastPhase,'compile');assert.equal(snapshot.lastCompletedPhase,null);
 assert.ok(snapshot.recentCompileMs>=20);assert.equal(snapshot.submittedObjects,0);
 assert.equal(f.events.filter(event=>event.stage==='timed-out').length,1);
});

await check('slow-attribute-introspection-is-attributed-to-attributes',async()=>{
 const f=graphicsFixture({ready:true,attributeMs:24});
 await assert.rejects(f.prepare(18),error=>error.code==='PREPARATION_TIMEOUT');
 const snapshot=f.events.at(-1).preTimeoutSnapshot;
 assert.equal(snapshot.lastPhase,'attributes');assert.equal(snapshot.lastCompletedPhase,'uniforms');
 assert.ok(snapshot.recentAttributesMs>=20);assert.equal(f.programs[0].attributes,1);
});

await check('near-deadline-defers-remaining-uniforms-and-still-completes',async()=>{
 const f=graphicsFixture({ready:true,uniformMs:12,meshes:10});
 assert.equal(await f.prepare(45),true);
 assert.equal(f.events.at(-1).stage,'ready');
 assert.ok(!f.events.some(event=>event.stage==='timed-out'));
 assert.ok(f.programs.some(program=>program.uniforms>=1));
 assert.ok(f.programs.some(program=>program.uniforms===0));
 assert.ok(f.programs.filter(program=>program.uniforms>=1).length<f.programs.length);
 assert.equal(f.pass.stats().preparedPrograms,f.programs.length);
 assert.equal(f.pass.stats().preparation.stage,'ready');
});

await check('heavy-uniform-slice-yields-before-another-introspect',async()=>{
 const f=graphicsFixture({ready:true,uniformMs:10,meshes:6});
 assert.equal(await f.prepare(400),true);
 let previous=0,maximum=0;
 for(const event of f.events.filter(entry=>entry.stage==='link'||entry.stage==='ready')){
  maximum=Math.max(maximum,event.uniformReads-previous);previous=event.uniformReads;
 }
 assert.ok(previous>=1);assert.ok(maximum<=1);
});

await check('unready-programs-still-timeout-after-uniforms-are-deferred',async()=>{
 const f=graphicsFixture({ready:false,uniformMs:12,meshes:8});
 await assert.rejects(f.prepare(40),error=>error.code==='PREPARATION_TIMEOUT');
 assert.equal(f.events.at(-1).stage,'timed-out');
 assert.equal(f.events.at(-1).preTimeoutSnapshot.finishedPrograms,0);
 assert.equal(f.pass.stats().preparedPrograms,0);
});

const missionSource=readFileSync(new URL('../game/src/mission-screen.js',import.meta.url),'utf8');
class Node{
 constructor(){this.hidden=true;this.disabled=false;this.dataset={};this.listeners={};this.classList={toggle(){},remove(){}};this.textContent='';this.value='';}
 set innerHTML(value){throw Error(`Unexpected HTML assignment: ${value}`);}
 setAttribute(name,value){this[name]=value;} addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 cloneNode(){return new Node();} replaceWith(){} focus(){} select(){}
}
await check('failure-report-preserves-only-bounded-typed-graphics-evidence',async()=>{
 const names=['loadStatus','loadingSystems','startButton','settingsButton','intro','hud','unsupported','pause','opening','ending','result','loadingFailureDetails','loadingFailureDetail','copyLoadingReport','loadingReportDisclosure','loadingReport','loadingReportCopyStatus'];
 const nodes=new Map(names.map(name=>[name,new Node()]));
 const saved=new Map();
 for(const [name,value] of Object.entries({document:{getElementById:id=>nodes.get(id),querySelector:()=>null,activeElement:null,visibilityState:'visible'},window:{},location:{origin:'https://gunner.satoshis.watch'},navigator:{userAgent:'Synthetic Safari'}})){
  saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,value});
 }
 try{
  const module=await import('data:text/javascript;base64,'+Buffer.from(missionSource+'\n// diagnostics-contract').toString('base64'));
  const raw={lastPhase:'u'.repeat(80),lastCompletedPhase:'uniforms',variant:'v'.repeat(100),layer:0,jobIndex:4,totalJobs:7,batchIndex:1,jobBatchCount:3,submittedObjects:42,totalObjects:99,discoveredPrograms:40,finishedPrograms:10,pendingProgramIds:Array.from({length:30},(_,i)=>`${i}-`+'p'.repeat(80)),elapsedMs:30001,maxCompileMs:123,recentCompileMs:12,maxReadyPollMs:3,recentReadyPollMs:2,maxUniformsMs:29999,recentUniformsMs:29999,maxAttributesMs:0,recentAttributesMs:0,maxIntrospectMs:30000,recentIntrospectMs:30000,contextLost:false,parallelCompile:true,compilerNote:'n'.repeat(300),exceptionCode:'PREPARATION_TIMEOUT',exceptionMessage:'m'.repeat(300),secretField:'must-not-serialize'};
  const controller=module.createLoadingController();controller.begin('scene',{stage:'timed-out',completed:10,total:40,preTimeoutSnapshot:raw});controller.fail(Object.assign(Error('Graphics preparation timed out'),{code:'PREPARATION_TIMEOUT'}));
  const report=JSON.parse(module.buildLoadingFailureReport({...controller.snapshot(),trace:{events:[],dropped:0}}));
  assert.equal(report.build,'0.54.52');const snapshot=report.loading.progress.preTimeoutSnapshot;
  assert.equal(snapshot.lastPhase.length,32);assert.equal(snapshot.variant.length,64);assert.equal(snapshot.pendingProgramIds.length,24);
  assert.ok(snapshot.pendingProgramIds.every(id=>id.length<=48));assert.equal(snapshot.contextLost,false);assert.equal(snapshot.parallelCompile,true);
  assert.equal(snapshot.compilerNote.length,160);assert.equal(snapshot.exceptionMessage.length,160);assert.equal(snapshot.secretField,undefined);
 }finally{
  for(const [name,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
});

console.log(JSON.stringify({passed:true,count:checks.length,checks},null,2));
