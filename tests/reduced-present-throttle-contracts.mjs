// Reduced every-2nd-rAF present throttle (Iris P5 / 0.54.50).
// Sim/input stay at full rAF. GPU present skips alternate ticks when Reduced
// is on. HUD FPS counts real presents. Soft-GPU stays off. Quarter-res, P2
// caps, scene/CPU, and parked HDR stay as shipped. 0.54.49 is not this lane.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../game/index.html',import.meta.url),'utf8');
const cinema=readFileSync(new URL('../game/src/cinematic-pass.js',import.meta.url),'utf8');
const world=readFileSync(new URL('../game/src/hell-world.js',import.meta.url),'utf8');

assert.match(main,/version:'0\.54\.50'/);
assert.doesNotMatch(main,/version:'0\.54\.49'/);
assert.doesNotMatch(main,/0\.54\.49/);
assert.doesNotMatch(html,/054-49/);
assert.match(html,/styles\.css\?v=054-50/);
assert.match(html,/data-game-entry="\.\/main\.js\?v=054-50"/);

assert.match(main,/failIfMajorPerformanceCaveat: false/);
assert.doesNotMatch(main,/failIfMajorPerformanceCaveat:\s*true/);
assert.doesNotMatch(main,/powerPreference:\s*'low-power'/);
assert.doesNotMatch(main,/navigator\.userAgent/);
assert.match(main,/renderer\.shadowMap\.enabled = true/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
assert.match(cinema,/function liveWorldSize\(\)\{return reducedEffectsActive\?\{x:Math\.max\(1,width>>2\),y:Math\.max\(1,height>>2\)\}:\{x:width,y:height\};\}/);
assert.match(world,/export function reducedChunkReach\(reduced\)\{return reduced\?380:820;\}/);

assert.match(main,/function applyReducedPresentHud\(reduced\)/);
assert.match(main,/applyReducedPresentHud\(\!\!reduced\)/);
assert.match(main,/counterScope=on\?'reduced-presents':'all-frame-passes'/);
assert.match(main,/Intel Reduced present/);
assert.match(main,/if\(!preferences\.reduced\)updateFps\(now\)/);
assert.match(main,/preferences\.reduced&&frameMetrics\.presented&&typeof updateFps==='function'\)updateFps\(now\)/);
assert.match(main,/const skipReducedPresent=!holdPresent&&!collisionHold&&!!preferences\.reduced/);
assert.match(main,/frameMetrics\.reducedPresentParity=\(frameMetrics\.reducedPresentParity\|0\)\+1/);

const render=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){'));
assert.match(render,/hellWorld\.update\(presentationClock\(\),presentationView,reducedOpening\(\)\)/);
assert.match(render,/if\(!game\.opening&&game\.running&&!game\.paused&&!game\.ended&&!game\.captureFreeze&&!game\.contextLost\)\{game\.accumulator\+=dt;while\(game\.accumulator>=FIXED_STEP\)\{fixedUpdate\(FIXED_STEP\)/);
assert.ok(render.indexOf('fixedUpdate(FIXED_STEP)')<render.indexOf('skipReducedPresent'),'sim stays at full rAF before present skip');
assert.ok(render.indexOf('updateUI(now)')<render.indexOf('skipReducedPresent'),'HTML HUD updates before present skip');

const presentStart=render.indexOf("if(!game.contextLost&&!graphicsPreparation&&loadingSnapshot().status!=='failed'){");
const tail=render.slice(presentStart,render.lastIndexOf('}'));
const present=new Function('env',`const {game,graphicsPreparation,loadingSnapshot,renderer,cinematic,frameMetrics,requestAnimationFrame,render,document,preferences={reduced:false}}=env;
const scene={},camera={},visualTime=1,reducedOpening=()=>false,WORLD_ONLY=false,exteriorView=true,elapsed=.02;
${tail}`);

function run(env){
 const calls={reset:0,draw:0,raf:0};
 present({
  game:{contextLost:false,paused:false,...env.game},
  graphicsPreparation:false,
  loadingSnapshot:()=>({status:'ready',active:null,...env.loading}),
  renderer:{info:{reset(){calls.reset++;},render:{calls:7,triangles:42,points:3}}},
  cinematic:{render(){calls.draw++;}},
  frameMetrics:env.metrics,
  render:()=>{},
  document:{hidden:!!env.hidden},
  preferences:{reduced:!!env.reduced},
  requestAnimationFrame(){calls.raf++;},
 });
 return calls;
}

const onMetrics={};
const draws=[];
for(let i=0;i<6;i++)draws.push(run({reduced:true,metrics:onMetrics}).draw);
assert.deepEqual(draws,[1,0,1,0,1,0],'Reduced ON presents on rAF 1,3,5 and skips 2,4,6');
assert.equal(onMetrics.reducedPresentParity,6);
assert.equal(onMetrics.presented,false);

const offMetrics={reducedPresentParity:9};
const off=run({reduced:false,metrics:offMetrics});
assert.deepEqual(off,{reset:1,draw:1,raf:1});
assert.equal(offMetrics.reducedPresentParity,0,'Reduced OFF resets present parity');
assert.equal(offMetrics.presented,true);

const paused=run({reduced:true,metrics:{},game:{paused:true}});
assert.deepEqual(paused,{reset:0,draw:0,raf:1});

const hud=main.match(/function applyReducedPresentHud\(reduced\)\{[\s\S]*?\n\}/)[0];
const fps=main.match(/function updateFps\(now\) \{[\s\S]*?\n\}/)[0];
const context={
  fpsSample:{started:0,frames:0},
  frameMetrics:{fps:0,presented:false,reducedPresentParity:4,counterScope:'all-frame-passes'},
  dom:{fps:{textContent:'—',dataset:{},parentElement:{attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}}}},
  Math,
};
vm.runInNewContext(`${fps};${hud};globalThis.updateFps=updateFps;globalThis.applyReducedPresentHud=applyReducedPresentHud`,context);
context.applyReducedPresentHud(true);
assert.equal(context.frameMetrics.counterScope,'reduced-presents');
assert.equal(context.frameMetrics.reducedPresentParity,0);
assert.equal(context.dom.fps.parentElement.attrs['aria-label'],'Intel Reduced present');
assert.equal(context.dom.fps.parentElement.attrs.title,'Intel Reduced present');
for(let now=1000;now<=1517;now+=1000/60){
 context.frameMetrics.presented=context.frameMetrics.reducedPresentParity%2===0;
 context.frameMetrics.reducedPresentParity++;
 if(context.frameMetrics.presented)context.updateFps(now);
}
assert.ok(context.frameMetrics.fps>=29&&context.frameMetrics.fps<=31,`present-counted FPS should be ~30, got ${context.frameMetrics.fps}`);
context.applyReducedPresentHud(false);
assert.equal(context.frameMetrics.counterScope,'all-frame-passes');
assert.equal(context.dom.fps.parentElement.attrs['aria-label'],'Current frames per second');
assert.equal(context.dom.fps.parentElement.attrs.title,undefined);

console.log('PASS reduced-present-throttle-contracts (every-2nd-rAF present, full-rate sim, HUD present FPS, Soft-GPU off, 0.54.50 only)');
