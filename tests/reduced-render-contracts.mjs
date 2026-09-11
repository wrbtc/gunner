import assert from 'node:assert/strict';
import * as T from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';
let target=null,draws=[],depthClears=0;const renderer={getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getDrawingBufferSize:v=>v.set(1400,900),render:(scene,camera)=>draws.push({scene,camera,target}),clearDepth:()=>depthClears++};
const cinema=createCinematicPass(renderer),scene=new T.Scene(),camera=new T.PerspectiveCamera(65,14/9,.05,3000);scene.background=new T.Color(0x202020);const background=scene.background;
function render(options={}){draws=[];depthClears=0;cinema.render(scene,camera,options);assert.equal(scene.background,background);assert.equal(camera.near,.05);assert.equal(camera.layers.mask,1);assert.equal(target,null);assert.equal(renderer.autoClear,true);return {calls:draws.length,world:draws.filter(x=>x.scene===scene).length,clears:depthClears};}
assert.deepEqual(render(),{calls:16,world:2,clears:1});assert.equal(cinema.stats().worldMsaaSamples,4);assert.equal(cinema.stats().bloomPasses,3);assert.equal(cinema.stats().contactOcclusionSamples,8);
const hdr=draws[0].target,depth=hdr.depthTexture,texture=hdr.texture;let disposals=0;hdr.addEventListener('dispose',()=>disposals++);
assert.deepEqual(render({reducedMotion:true}),{calls:16,world:2,clears:1});assert.equal(disposals,0,'motion preference alone keeps image quality');
assert.deepEqual(render({reducedEffects:true}),{calls:3,world:2,clears:1});assert.equal(disposals,0);assert.equal(cinema.stats().worldMsaaSamples,0);assert.equal(cinema.stats().bloomPasses,0);assert.equal(cinema.stats().contactOcclusionSamples,0);assert.equal(hdr.depthTexture,depth);assert.equal(hdr.texture,texture);assert.equal(hdr.samples,4);assert.notEqual(draws[0].target,hdr);assert.equal(draws[0].target.samples,0);
render({reducedEffects:true});assert.equal(disposals,0,'stable profile must not reallocate per frame');
assert.deepEqual(render(),{calls:16,world:2,clears:1});assert.equal(disposals,0);assert.equal(cinema.stats().worldMsaaSamples,4);assert.equal(cinema.stats().bloomPasses,3);assert.equal(cinema.stats().contactOcclusionSamples,8);assert.equal(draws[0].target,hdr);
assert.deepEqual(render({exterior:true}),{calls:11,world:2,clears:0});assert.deepEqual(render({exterior:true,reducedEffects:true}),{calls:3,world:2,clears:0});
assert.deepEqual(render({worldOnly:true,reducedEffects:true}),{calls:2,world:1,clears:0});
cinema.captureStingFrame();const frozen=cinema.stingSnapshot().target,serial=cinema.stingSnapshot().serial;cinema.contextLost();cinema.recoverContext();render({reducedEffects:true});assert.equal(cinema.stingSnapshot().target,frozen);assert.ok(cinema.stingSnapshot().serial>serial);assert.equal(cinema.stats().worldMsaaSamples,0);assert.equal(disposals,1);assert.equal(hdr.samples,4);
console.log('PASS full/reduced/exterior/world-only render paths, stable 4x target ownership, 0-sample reduced twin, profile restoration and sting context recovery. Interior reduced mode is world+cockpit+composite.');
