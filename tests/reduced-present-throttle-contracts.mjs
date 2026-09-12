import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const render=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){'));

assert.match(main,/version:'0\.54\.58'/);
assert.match(main,/function applyReducedPresentHud\(reduced\)/);
assert.match(main,/counterScope=on\?'reduced-presents':'all-frame-passes'/);
assert.match(main,/Intel Reduced present/);
assert.match(main,/if\(!preferences\.reduced\)updateFps\(now\)/);
assert.match(main,/preferences\.reduced&&frameMetrics\.presented&&typeof updateFps==='function'\)updateFps\(now\)/);
assert.match(render,/const skipReducedPresent=!holdPresent&&!collisionHold&&!!preferences\.reduced/);
assert.ok(render.indexOf('fixedUpdate(FIXED_STEP)')<render.indexOf('skipReducedPresent'),'simulation stays ahead of the presentation throttle');
assert.ok(render.indexOf('updateUI(now)')<render.indexOf('skipReducedPresent'),'HTML HUD stays ahead of the presentation throttle');

const start=render.indexOf("if(!game.contextLost&&!graphicsPreparation&&loadingSnapshot().status!=='failed'){");
const tail=render.slice(start,render.lastIndexOf('}'));
const present=new Function('env',`const {game,graphicsPreparation,loadingSnapshot,renderer,cinematic,frameMetrics,requestAnimationFrame,render,document,preferences}=env;
const scene={},camera={},visualTime=1,reducedOpening=()=>false,WORLD_ONLY=false,exteriorView=true,elapsed=.02;
${tail}`);
const metrics={};let draws=0;
for(let i=0;i<6;i++)present({game:{contextLost:false,paused:false},graphicsPreparation:false,loadingSnapshot:()=>({status:'ready',active:null}),renderer:{info:{reset(){},render:{calls:7,triangles:42,points:3}}},cinematic:{render(){draws++;}},frameMetrics:metrics,render:()=>{},document:{hidden:false},preferences:{reduced:true},requestAnimationFrame(){}});
assert.equal(draws,3,'Reduced presents on every other rAF');
assert.equal(metrics.reducedPresentParity,6);

console.log('PASS reduced-present-throttle-contracts');
