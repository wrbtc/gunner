// Reduced low-draw path: 0-sample HDR twin at quarter canvas, unused 4x parked at
// 1x1, bloom skip. Soft-GPU stays off. Shader first-use uniforms are not
// reopened here. Particle/atmosphere/light caps live in reduced-fill-caps.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const cinemaSource=readFileSync(new URL('../game/src/cinematic-pass.js',import.meta.url),'utf8');

assert.match(main,/antialias: true/);
assert.match(main,/powerPreference: 'high-performance'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.match(main,/renderer\.setPixelRatio\(Math\.min\(devicePixelRatio, 1\)\)/);
assert.match(main,/renderer\.shadowMap\.type = THREE\.PCFSoftShadowMap/);
assert.match(main,/function applyReducedDrawCost\(reduced\)/);
assert.match(main,/renderer\.shadowMap\.autoUpdate=!reduced/);
assert.match(main,/applyReducedDrawCost\(true\)/);
assert.match(main,/applyReducedDrawCost\(preferences\.reduced\)/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
const renderFn=cinemaSource.slice(cinemaSource.indexOf('function render(scene,camera'),cinemaSource.indexOf('return {render,resize,prepare'));
assert.match(cinemaSource,/program\.getUniforms\(\)/);
assert.doesNotMatch(renderFn,/getUniforms|getAttributes/);
assert.match(cinemaSource,/hdrLite=new THREE\.WebGLRenderTarget\(1,1,\{\.\.\.options,depthBuffer:true,samples:0\}\)/);
assert.match(cinemaSource,/function parkWorldTarget\(target\)\{if\(target\.width!==1\|\|target\.height!==1\)target\.setSize\(1,1\);\}/);
assert.match(cinemaSource,/function liveWorldSize\(\)\{return reducedEffectsActive\?\{x:Math\.max\(1,width>>2\),y:Math\.max\(1,height>>2\)\}:\{x:width,y:height\};\}/);
assert.match(cinemaSource,/const msaaEnabled=quality\.msaa&&!reducedEffectsActive/);
assert.match(cinemaSource,/const bloomEnabled=quality\.bloom&&!reducedEffectsActive/);
assert.match(cinemaSource,/composite\.uniforms\.tBloom\.value=bloomBlack/);
assert.match(cinemaSource,/The composite still presents at canvas size so HTML HUD\/UI stays crisp/);
assert.match(cinemaSource,/Restoring Reduced OFF reallocates 4x MSAA and can hitch once/);

let target=null,draws=[];
const renderer={getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getDrawingBufferSize:v=>v.set(1280,800),render:(scene,camera)=>draws.push({scene,camera,target}),clearDepth(){}};
const cinema=createCinematicPass(renderer),scene=new T.Scene(),camera=new T.PerspectiveCamera(65,16/10,.05,3000);
scene.background=new T.Color(0x101010);
assert.equal(cinema.quality.msaa,true);assert.equal(cinema.quality.bloom,true);assert.equal(cinema.quality.contact,true);

draws=[];cinema.render(scene,camera,{});
const fullTarget=draws[0].target;
assert.equal(fullTarget.samples,4);
assert.equal(fullTarget.width,1280);
assert.equal(fullTarget.height,800);
assert.equal(cinema.stats().worldMsaaSamples,4);
assert.equal(cinema.stats().bloomPasses,3);
assert.equal(cinema.stats().liveWorldHdrWidth,1280);
assert.equal(cinema.stats().liveWorldScale,1);
assert.equal(cinema.stats().unusedWorldHdrWidth,1);
assert.equal(cinema.stats().unusedWorldHdrHeight,1);

draws=[];cinema.render(scene,camera,{reducedEffects:true});
const liteTarget=draws[0].target;
assert.notEqual(liteTarget,fullTarget);
assert.equal(liteTarget.samples,0);
assert.equal(liteTarget.width,320);
assert.equal(liteTarget.height,200);
assert.ok(liteTarget.width/1280<=.5);
assert.equal(fullTarget.samples,4);
assert.equal(fullTarget.width,1);
assert.equal(fullTarget.height,1);
assert.equal(cinema.stats().worldMsaaSamples,0);
assert.equal(cinema.stats().bloomPasses,0);
assert.equal(cinema.stats().contactOcclusionSamples,0);
assert.equal(cinema.stats().liveWorldHdrWidth,320);
assert.equal(cinema.stats().liveWorldHdrHeight,200);
assert.equal(cinema.stats().liveWorldScale,.25);
assert.equal(cinema.stats().unusedWorldHdrWidth,1);
assert.equal(cinema.stats().unusedWorldHdrHeight,1);
assert.equal(draws.length,3);
assert.equal(draws.filter(x=>x.scene===scene).length,2);

cinema.quality.msaa=false;cinema.quality.bloom=false;
draws=[];cinema.render(scene,camera,{});
assert.equal(cinema.stats().worldMsaaSamples,0);
assert.equal(cinema.stats().bloomPasses,0);
assert.equal(draws[0].target.samples,0);
assert.equal(cinema.stats().unusedWorldHdrWidth,1);
cinema.quality.msaa=true;cinema.quality.bloom=true;

console.log('PASS reduced-low-draw-contracts (quarter-res live HDR, unused 4x parked, bloom skip, Soft-GPU off)');
