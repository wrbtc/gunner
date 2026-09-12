// Reduced scene/CPU budget: skip shadow receive, throttle geology, hide
// decorative / distant draws. Soft-GPU stays off. Shader first-use uniforms
// are not reopened. Quarter-res + P2 caps + parked HDR stay as shipped.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reducedGeologyDecor,reducedChunkReach,reducedCullInterval,shouldRefreshReducedCull} from '../game/src/hell-world.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const worldSource=readFileSync(new URL('../game/src/hell-world.js',import.meta.url),'utf8');
const blastSource=readFileSync(new URL('../game/src/blast-world.js',import.meta.url),'utf8');
const cinemaSource=readFileSync(new URL('../game/src/cinematic-pass.js',import.meta.url),'utf8');

assert.match(main,/version:'0\.54\.56'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.doesNotMatch(main,/navigator\.userAgent/);
assert.match(main,/renderer\.shadowMap\.enabled = true/);
assert.match(main,/renderer\.shadowMap\.autoUpdate=!reduced/);
assert.match(main,/function applyReducedShadowReceive\(reduced\)/);
assert.match(main,/applyReducedShadowReceive\(\!\!reduced\)/);
assert.match(main,/o\.receiveShadow=false/);
assert.match(main,/o\.receiveShadow=true/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
const receiveFn=main.match(/function applyReducedShadowReceive\(reduced\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(receiveFn,/castShadow\s*=/);
assert.match(main,/if\(ventPlumes\)for\(const plume of ventPlumes\)if\(plume\.sprite\)plume\.sprite\.visible=!on/);
assert.match(main,/if\(!preferences\.reduced\)for\(const plume of ventPlumes\)/);
assert.match(main,/const skipReducedPresent=!holdPresent&&!collisionHold&&!!preferences\.reduced/);

assert.match(worldSource,/export function reducedGeologyDecor\(name\)/);
assert.match(worldSource,/export function reducedChunkReach\(reduced\)\{return reduced\?380:820;\}/);
assert.match(worldSource,/export function reducedCullInterval\(reduced\)\{return reduced\?\.25:0;\}/);
assert.match(worldSource,/if\(!\(reduced\|\|reducedEffects\)\)\{for\(const \{side,light\} of hotSpill\)/);
assert.match(worldSource,/hideReducedGeologyDecor\(\)/);
assert.match(worldSource,/continuationGroup\.visible=!reducedEffects/);
assert.match(blastSource,/slabs\.visible=!reducedEffects;rebar\.visible=!reducedEffects/);
assert.match(blastSource,/if\(reduced\|\|reducedEffects\)return;/);

assert.match(cinemaSource,/function liveWorldSize\(\)\{return reducedEffectsActive\?\{x:Math\.max\(1,width>>2\),y:Math\.max\(1,height>>2\)\}:\{x:width,y:height\};\}/);
assert.match(cinemaSource,/function parkWorldTarget\(target\)\{if\(target\.width!==1\|\|target\.height!==1\)target\.setSize\(1,1\);\}/);
const renderFn=cinemaSource.slice(cinemaSource.indexOf('function render(scene,camera'),cinemaSource.indexOf('return {render,resize,prepare'));
assert.match(cinemaSource,/program\.getUniforms\(\)/);
assert.doesNotMatch(renderFn,/getUniforms|getAttributes/);

assert.equal(reducedGeologyDecor('Grounded angular talus 3'),true);
assert.equal(reducedGeologyDecor('Wall-seated molten cascade 0.12'),true);
assert.equal(reducedGeologyDecor('Hot crust intrusion 0.51 1'),true);
assert.equal(reducedGeologyDecor('Scanned embedded cliff face 2'),true);
assert.equal(reducedGeologyDecor('Cliff rock support 2'),true);
assert.equal(reducedGeologyDecor('bank-1-4-cliff'),false);
assert.equal(reducedGeologyDecor('bank--1-7'),false);
assert.equal(reducedGeologyDecor('Crusted molten river'),false);
assert.equal(reducedChunkReach(false),820);
assert.equal(reducedChunkReach(true),380);
assert.equal(reducedCullInterval(false),0);
assert.equal(reducedCullInterval(true),.25);
assert.equal(shouldRefreshReducedCull(1.0,-1,.25),true);
assert.equal(shouldRefreshReducedCull(1.0,0.9,.25),false);
assert.equal(shouldRefreshReducedCull(1.2,0.9,.25),true);
assert.equal(shouldRefreshReducedCull(1.0,0.9,0),true);

console.log('PASS reduced-scene-cpu-contracts (shadow receive skip, 4 Hz geology, decor hide, Soft-GPU off, quarter-res kept)');
