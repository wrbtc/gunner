// Reduced fill caps: particle / atmosphere / excess dynamic lights when
// Reduced is on. Soft-GPU stays off. Shader first-use uniforms are not
// reopened. Prepared PointLight counts stay stable (intensity caps, no hide).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../game/vendor/three.module.js';
import {createHellSky} from '../game/src/hell-sky.js';
import {createMayhemFX} from '../game/src/mayhem-fx.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const skySource=readFileSync(new URL('../game/src/hell-sky.js',import.meta.url),'utf8');
const worldSource=readFileSync(new URL('../game/src/hell-world.js',import.meta.url),'utf8');
const blastSource=readFileSync(new URL('../game/src/blast-world.js',import.meta.url),'utf8');
const mayhemSource=readFileSync(new URL('../game/src/mayhem-fx.js',import.meta.url),'utf8');

assert.match(main,/version:'0\.54\.47'/);
assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.doesNotMatch(main,/navigator\.userAgent/);
assert.match(main,/function applyReducedFillCost\(reduced\)/);
assert.match(main,/function reducedAtmosphereKeep\(kind,count,reduced\)/);
assert.match(main,/if\(kind==='steam'\)return 0/);
assert.match(main,/return Math\.ceil\(count\*\.12\)/);
assert.match(main,/entry\.light\.intensity=on\?0:entry\.power/);
assert.match(main,/fillLight\.intensity=on\?0:rift\.userData\.fillLightPower/);
assert.match(main,/scene\.background\.setHex\(on\?0x121820:0x110a08\)/);
assert.match(main,/this\.points\.geometry\.setDrawRange\(0,this\.reduced\?160:this\.count\)/);
assert.match(main,/const n=this\.reduced\?Math\.max\(1,Math\.ceil\(count\*\.25\)\):count/);
assert.match(main,/if\(preferences\.reduced\)return;const s=smoke\[smokeCursor/);
assert.match(skySource,/sky\.visible = !value/);
assert.match(worldSource,/if\(!\(reduced\|\|reducedEffects\)\)\{for\(const \{side,light\} of hotSpill\)/);
assert.match(worldSource,/light\.intensity=\(light\.isSpotLight\?3900:2400\)/);
assert.match(blastSource,/function applyAshCap\(off\)\{ash\.material\.uniforms\.uReduced\.value=off\?1:0;ash\.visible=!off;geo\.setDrawRange\(0,off\?0:count\);\}/);
assert.match(blastSource,/slabs\.visible=!reducedEffects;rebar\.visible=!reducedEffects/);
assert.match(blastSource,/if\(reduced\|\|reducedEffects\)return;/);
assert.match(mayhemSource,/if \(dt > 0 && !quiet && !reducedEffects\)/);
assert.match(mayhemSource,/const sparkBudget = reducedEffects \? 12 : 92/);
assert.match(mayhemSource,/light\.intensity = reducedEffects \? 0 :/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);

assert.equal(eval(main.match(/function reducedAtmosphereKeep\(kind,count,reduced\)\{[\s\S]*?\n\}/)[0]+';reducedAtmosphereKeep("ember",3400,false)'),3400);
assert.equal(eval(main.match(/function reducedAtmosphereKeep\(kind,count,reduced\)\{[\s\S]*?\n\}/)[0]+';reducedAtmosphereKeep("steam",156,true)'),0);
assert.equal(eval(main.match(/function reducedAtmosphereKeep\(kind,count,reduced\)\{[\s\S]*?\n\}/)[0]+';reducedAtmosphereKeep("ember",3400,true)'),Math.ceil(3400*.12));
assert.equal(eval(main.match(/function reducedAtmosphereKeep\(kind,count,reduced\)\{[\s\S]*?\n\}/)[0]+';reducedAtmosphereKeep("ash",1600,true)'),Math.ceil(1600*.12));

const skyScene=new T.Scene();
const sky=createHellSky(skyScene);
assert.equal(sky.stats().visible,true);
assert.equal(sky.stats().volumeSteps,12);
sky.setReducedEffects(true);
assert.equal(sky.stats().visible,false);
assert.equal(sky.stats().reduced,true);
assert.equal(sky.stats().volumeSteps,0);
sky.setReducedEffects(false);
assert.equal(sky.stats().visible,true);
assert.equal(sky.stats().volumeSteps,12);
sky.dispose();

const fxScene=new T.Scene();
const fx=createMayhemFX({scene:fxScene,route:{getPointAt:t=>new T.Vector3(0,20,-3000*t)},centerAt:t=>new T.Vector3(0,20,-3000*t),widthAt:()=>100,rockMaterial:new T.MeshStandardMaterial()});
const before=fx.stats();
assert.equal(before.reducedEffects,false);
assert.equal(before.reducedExplosionSparks,92);
assert.equal(before.caps.sparks,1152);
fx.setReducedEffects(true);
const reduced=fx.stats();
assert.equal(reduced.reducedEffects,true);
assert.equal(reduced.reducedExplosionSparks,12);
assert.equal(reduced.lightEnergy,0);
assert.equal(reduced.fireOpacity,.4);
const at=new T.Vector3(0,20,-100);
fx.explosion(at,16,'rock');
const afterBlast=fx.stats();
assert.equal(afterBlast.lightEnergy,0);
assert.ok(afterBlast.sparks<=12,`reduced explosion sparks ${afterBlast.sparks}`);
fx.setReducedEffects(false);
fx.explosion(new T.Vector3(8,20,-80),16,'rock');
const restored=fx.stats();
assert.equal(restored.reducedEffects,false);
assert.equal(restored.reducedExplosionSparks,92);
assert.ok(restored.lightEnergy>0,'non-Reduced explosion still flashes a PointLight');
assert.ok(restored.sparks>12,'non-Reduced explosion keeps the full spark budget');
fx.dispose();

console.log('PASS reduced-fill-caps-contracts (atmosphere skip, particle caps, light intensity caps, Soft-GPU off, non-Reduced restore)');
