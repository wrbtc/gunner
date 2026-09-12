// Reduced Effects is gone. Soft-GPU stays off. prefers-reduced-motion remains.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../game/vendor/three.module.js';
import {createCinematicPass} from '../game/src/cinematic-pass.js';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const main=read('game/main.js');
const html=read('game/index.html');
const cinemaSource=read('game/src/cinematic-pass.js');
const worldSource=read('game/src/hell-world.js');
const blastSource=read('game/src/blast-world.js');
const mayhemSource=read('game/src/mayhem-fx.js');
const packageJson=JSON.parse(read('package.json'));

assert.equal(packageJson.version,'0.54.60');
assert.match(main,/version:'0\.54\.60'/);
assert.doesNotMatch(main,/0\.54\.52/);
assert.doesNotMatch(main,/0\.54\.53/);
assert.doesNotMatch(main,/0\.54\.57/);
assert.doesNotMatch(main,/0\.54\.58/);
assert.doesNotMatch(main,/0\.54\.59/);
assert.doesNotMatch(html,/0\.54\.52/);
assert.doesNotMatch(html,/0\.54\.53/);

assert.doesNotMatch(html,/id="reducedEffects"/);
assert.doesNotMatch(html,/REDUCED EFFECTS/);
assert.match(html,/id="masterMode"/);

assert.doesNotMatch(main,/preferences\.reduced/);
assert.doesNotMatch(main,/reducedAuto/);
assert.doesNotMatch(main,/reduced-auto/);
assert.doesNotMatch(main,/reducedUserSet:reducedAuto/);
assert.doesNotMatch(main,/function applyReducedDrawCost/);
assert.doesNotMatch(main,/function applyReducedFillCost/);
assert.doesNotMatch(main,/function applyReducedPresentHud/);
assert.doesNotMatch(main,/function applyReducedShadowReceive/);
assert.doesNotMatch(main,/function reducedAtmosphereKeep/);
assert.doesNotMatch(main,/function armReducedAuto/);
assert.doesNotMatch(main,/function considerReducedAuto/);
assert.doesNotMatch(main,/skipReducedPresent/);
assert.doesNotMatch(main,/reducedPresentParity/);
assert.doesNotMatch(main,/Intel Reduced present/);
assert.doesNotMatch(main,/reduced-presents/);
assert.doesNotMatch(main,/setReducedEffects/);
assert.match(main,/counterScope: 'all-frame-passes'/);
assert.match(main,/function reducedOpening\(\)\{return reducedMotion\.matches;\}/);
assert.match(main,/if\('reduced' in saved\|\|'reducedUserSet' in saved\)savePreferences\(\)/);
assert.match(main,/delete payload\.reduced/);

assert.match(main,/powerPreference: 'high-performance'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
assert.doesNotMatch(main,/navigator\.userAgent/);

assert.doesNotMatch(cinemaSource,/reducedEffectsActive/);
assert.doesNotMatch(cinemaSource,/reducedEffects/);
assert.match(cinemaSource,/function liveWorldSize\(\)\{return \{x:width,y:height\};\}/);
assert.doesNotMatch(cinemaSource,/liveWorldSize\(\)\{return reducedEffectsActive/);
assert.match(cinemaSource,/const contactEnabled=quality\.contact;/);
assert.match(cinemaSource,/const msaaEnabled=quality\.msaa;/);
assert.match(cinemaSource,/const bloomEnabled=quality\.bloom;/);

assert.doesNotMatch(worldSource,/setReducedEffects/);
assert.doesNotMatch(worldSource,/reducedEffects/);
assert.doesNotMatch(worldSource,/reducedGeologyDecor/);
assert.doesNotMatch(worldSource,/reducedChunkReach/);
assert.doesNotMatch(blastSource,/setReducedEffects/);
assert.doesNotMatch(blastSource,/reducedEffects/);
assert.doesNotMatch(mayhemSource,/setReducedEffects/);
assert.doesNotMatch(mayhemSource,/reducedEffects/);

let target=null,draws=[];
const renderer={getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getDrawingBufferSize:v=>v.set(1280,800),render:(scene,camera)=>draws.push({scene,camera,target}),clearDepth(){}};
const cinema=createCinematicPass(renderer),scene=new T.Scene(),camera=new T.PerspectiveCamera(65,16/10,.05,3000);
scene.background=new T.Color(0x101010);
draws=[];cinema.render(scene,camera,{});
assert.equal(draws[0].target.samples,4);
assert.equal(draws[0].target.width,1280);
assert.equal(draws[0].target.height,800);
assert.equal(cinema.stats().worldMsaaSamples,4);
assert.equal(cinema.stats().bloomPasses,3);
assert.equal(cinema.stats().contactOcclusionSamples,8);
assert.equal(cinema.stats().liveWorldScale,1);
assert.equal(cinema.stats().unusedWorldHdrWidth,1);
draws=[];cinema.render(scene,camera,{reducedEffects:true});
assert.equal(draws[0].target.samples,4);
assert.equal(draws[0].target.width,1280);
assert.equal(cinema.stats().liveWorldScale,1);
assert.equal(cinema.stats().worldMsaaSamples,4);

console.log('PASS reduced-removed-contracts (Reduced gone, Soft-GPU off, full-res path only)');
