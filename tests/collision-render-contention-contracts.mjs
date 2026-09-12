// Execute the actual presentation branch with instrumented renderer and rAF.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const render=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){'));
const start=render.indexOf("if(!game.contextLost&&!graphicsPreparation&&loadingSnapshot().status!=='failed'){");
assert.ok(start>0);
const tail=render.slice(start,render.lastIndexOf('}'));
const present=new Function('env',`const {game,graphicsPreparation,loadingSnapshot,renderer,cinematic,frameMetrics,requestAnimationFrame,render,document}=env;
const scene={},camera={},visualTime=1,reducedOpening=()=>false,WORLD_ONLY=false,exteriorView=true,elapsed=.02;
${tail}`);
let checks=0;
for(const [status,active,lost,preparing,paused,hidden,expected] of [
 ['preparing','collision',false,false,false,false,0],
 ['preparing','shaders',false,false,false,false,1],
 ['ready',null,false,false,false,false,1],
 ['failed','collision',false,false,false,false,0],
 ['preparing','collision',true,false,false,false,0],
 ['ready',null,true,false,false,false,0],
 ['ready',null,false,true,false,false,0],
 ['ready',null,false,false,true,false,0],
 ['ready',null,false,false,false,true,0],
 ['ready',null,false,false,true,true,0],
 ['preparing','shaders',false,false,true,false,0],
]){
 const calls={reset:0,draw:0,raf:0},metrics={};const continuation=()=>{};
 present({game:{contextLost:lost,paused},graphicsPreparation:preparing,loadingSnapshot:()=>({status,active}),
 renderer:{info:{reset(){calls.reset++;},render:{calls:7,triangles:42,points:3}}},
 cinematic:{render(){calls.draw++;}},frameMetrics:metrics,render:continuation,document:{hidden},
 requestAnimationFrame(fn){assert.equal(fn,continuation);calls.raf++;}});
 assert.deepEqual(calls,{reset:expected,draw:expected,raf:1},JSON.stringify({status,active,lost,preparing,paused,hidden}));
 if(expected){assert.equal(metrics.calls,7);assert.equal(metrics.triangles,42);}
 if(!lost&&!preparing&&status!=='failed')assert.equal(metrics.frameMs,20);
 checks++;
}
assert.match(main,/await boundedPreparation\(\(\)=>eggNests\.prepareCollision\(\)\);/);
assert.doesNotMatch(main,/boundedPreparation\(\(\)=>eggNests\.prepareCollision\(\),\s*\{[^}]*timeoutMs\s*:/);
checks++;
assert.match(main,/const holdPresent=game\.paused\|\|document\.hidden/);
assert.match(main,/const collisionHold=loading\.status==='preparing'&&loading\.active==='collision'/);
assert.doesNotMatch(main,/skipReducedPresent/);
assert.doesNotMatch(main,/navigator\.userAgent/);
checks++;
const everyCalls={reset:0,draw:0,raf:0},everyMetrics={};
for(let i=0;i<4;i++){
 present({game:{contextLost:false,paused:false},graphicsPreparation:false,loadingSnapshot:()=>({status:'ready',active:null}),
 renderer:{info:{reset(){everyCalls.reset++;},render:{calls:7,triangles:42,points:3}}},
 cinematic:{render(){everyCalls.draw++;}},frameMetrics:everyMetrics,render:()=>{},document:{hidden:false},
 requestAnimationFrame(){everyCalls.raf++;}});
}
assert.deepEqual(everyCalls,{reset:4,draw:4,raf:4},'every rAF presents');
assert.equal(everyMetrics.presented,true);
checks++;
console.log(JSON.stringify({passed:true,checks,scope:'Actual presentation branch: collision, pause, and hidden defer draw; later stages resume draw; rAF continues; original deadlines retained. No performance or Safari claim.'}));
