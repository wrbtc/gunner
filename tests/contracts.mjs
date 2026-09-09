import assert from 'node:assert/strict';
import * as T from '../game/vendor/three.module.js';
import {maximumSphereOverlapBound} from '../game/src/sphere-overlap-bound.js';
import {createPlasmaBursts} from '../game/src/plasma-burst.js';
import {createMayhemFX} from '../game/src/mayhem-fx.js';
const checks=[];
function check(name,fn){fn();checks.push(name);}
check('sphere-bound-keeps-all-eight-when-no-geometric-reduction-is-safe',()=>assert.equal(maximumSphereOverlapBound(Array.from({length:8},()=>new T.Vector3()),510),8));
check('sphere-bound-empty-and-separated-layouts',()=>{assert.equal(maximumSphereOverlapBound([],510),0);assert.equal(maximumSphereOverlapBound([new T.Vector3(),new T.Vector3(1021,0,0)],510),1);});
check('sphere-bound-includes-tangent-pairs-conservatively',()=>assert.equal(maximumSphereOverlapBound([new T.Vector3(),new T.Vector3(1020,0,0)],510),2));
check('sphere-bound-uses-complete-pairwise-cliques',()=>assert.equal(maximumSphereOverlapBound([0,700,1400,2100].map(x=>new T.Vector3(x,0,0)),510),2));
check('sphere-bound-may-overestimate-common-intersection',()=>assert.equal(maximumSphereOverlapBound([new T.Vector3(),new T.Vector3(1.9,0,0),new T.Vector3(.95,1.9*Math.sqrt(3)/2,0)],1),3));
check('sphere-bound-rejects-invalid-or-unbounded-layout',()=>{assert.throws(()=>maximumSphereOverlapBound([new T.Vector3(NaN,0,0)],510));assert.throws(()=>maximumSphereOverlapBound([],0));assert.throws(()=>maximumSphereOverlapBound(Array(17).fill(new T.Vector3()),510));});
check('sphere-bound-covers-arbitrary-three-dimensional-eyes',()=>{
 let seed=123;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let layout=0;layout<20;layout++){
  const centers=Array.from({length:8},()=>new T.Vector3(random()*1600,random()*700,random()*2000)),bound=maximumSphereOverlapBound(centers,510);
  for(let i=0;i<1000;i++){const eye=new T.Vector3(random()*2200-300,random()*1300-300,random()*2600-300);assert.ok(centers.filter(c=>c.distanceTo(eye)<510).length<=bound);}
 }
});
const nativeScene=new T.Scene(),parent=new T.Group(),actor=new T.Group();nativeScene.add(parent);parent.add(actor);parent.rotation.set(.2,.3,-.1);parent.position.set(8,4,-9);actor.scale.setScalar(.2);actor.position.set(3,2,7);
const authoredLight=new T.PointLight(0xff2335,4,10,2);authoredLight.position.set(0,5,5.3);actor.add(authoredLight);
const pointCount=()=>{let count=0;nativeScene.traverseVisible(o=>{if(o.isPointLight)count++;});return count;};
check('original-child-light-transform-and-photometry',()=>{const expected=actor.localToWorld(new T.Vector3(0,5,5.3));assert.ok(authoredLight.getWorldPosition(new T.Vector3()).distanceTo(expected)<1e-12);assert.equal(authoredLight.distance,10);assert.equal(authoredLight.decay,2);assert.equal(authoredLight.intensity,4);});
check('original-child-light-disappears-with-actor-or-ancestor',()=>{assert.equal(pointCount(),1);actor.visible=false;assert.equal(pointCount(),0);actor.visible=true;parent.visible=false;assert.equal(pointCount(),0);parent.visible=true;assert.equal(pointCount(),1);});
const fxScene=new T.Scene(),fx=createMayhemFX({scene:fxScene,route:{getPointAt:t=>new T.Vector3(0,20,-3000*t)},centerAt:t=>new T.Vector3(0,20,-3000*t),widthAt:()=>100,rockMaterial:new T.MeshStandardMaterial()});
let fragments;fxScene.traverse(o=>{if(o.isInstancedMesh&&o.instanceMatrix.count===240)fragments=o;});
check('fragment-shader-color-layout-exists-before-first-splash',()=>{assert.ok(fragments?.instanceColor);assert.equal(fragments.instanceColor.count,240);assert.ok(fragments.instanceColor.array.every(v=>v===1));});
check('eager-colors-preserve-three-setColorAt-usage',()=>{const original=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),1);original.setColorAt(0,new T.Color());assert.equal(fragments.instanceColor.usage,original.instanceColor.usage);assert.equal(fragments.instanceColor.usage,T.StaticDrawUsage);});
const fragmentColors=fragments.instanceColor;
for(let i=1;i<=24;i++)fx.update(1/60,i/60,new T.Vector3(0,20,-100));
check('first-splash-updates-existing-color-layout',()=>assert.equal(fragments.instanceColor,fragmentColors));

const burstScene=new T.Scene(),bursts=createPlasmaBursts({scene:burstScene});const burstMeshes=[];burstScene.traverse(o=>{if(o.isInstancedMesh)burstMeshes.push(o);});
check('all-detonation-batches-have-color-layout-before-first-burst',()=>{assert.equal(burstMeshes.length,3);for(const mesh of burstMeshes){assert.equal(mesh.count,0);assert.equal(mesh.instanceColor.usage,T.StaticDrawUsage);assert.equal(mesh.instanceColor.count,mesh.instanceMatrix.count);assert.ok(mesh.instanceColor.array.every(v=>v===1));}});

// Preparation now uses layer-filtered, yielded batches and a shared in-flight
// promise. Its asynchronous state, coverage, failure, and channel ownership
// contracts live separately; run both files explicitly:
//   node tests/contracts.mjs
//   node tests/preparation-contracts.mjs
// Do not restore the old fake compiler, which assumed synchronous full-scene
// compilation and could not model compile(selection, camera, actualScene).
fx.dispose();
console.log(JSON.stringify({passed:true,checks:checks.length,names:checks,additionalRequiredSuite:'node tests/preparation-contracts.mjs'},null,2));
