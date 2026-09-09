import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreparationSequence,createLoadingController} from '../game/src/mission-screen.js';
const names=[];const check=async(name,work)=>{await work();names.push(name);};
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
await check('construction-label-survives-controller-with-bounded-immutable-copy',()=>{const c=createLoadingController(),detail={label:'Mapping tank routes'};c.begin('scene',detail);detail.label='changed';assert.equal(c.snapshot().progress.label,'Mapping tank routes');assert.ok(Object.isFrozen(c.snapshot().progress));c.begin('scene',{label:'x'.repeat(100)});assert.equal(c.snapshot().progress.label.length,80);});
await check('construction-paints-before-work-and-keeps-ordered-checkpoints',async()=>{
 const log=[],s=createPreparationSequence({paint:async()=>log.push('paint'),task:async()=>log.push('task'),onStep:(n,v)=>log.push(n+':'+v)});
 const a=await s.step('a',async()=>{log.push('a1');await s.checkpoint();log.push('a2');return 7;});await s.step('b',()=>log.push('b'));
 assert.equal(a,7);assert.deepEqual(log,['a:begin','paint','a1','task','a2','a:end','task','b:begin','paint','b','b:end','task']);
});
await check('cancel-during-initial-paint-prevents-any-construction',async()=>{let canceled=false,work=0;const s=createPreparationSequence({canceled:()=>canceled,paint:async()=>{canceled=true;}});await assert.rejects(s.step('a',()=>work++),e=>e.code==='PREPARATION_CANCELED');assert.equal(work,0);});
await check('cancel-during-internal-batch-stops-later-work-and-steps',async()=>{let canceled=false,work=0;const s=createPreparationSequence({canceled:()=>canceled,paint:async()=>{},task:async()=>{canceled=true;}});await assert.rejects(s.step('a',async()=>{work++;await s.checkpoint();work++;}),e=>e.code==='PREPARATION_CANCELED');await assert.rejects(s.step('b',()=>work++));assert.equal(work,1);});
await check('constructor-failure-latches-without-completing-or-later-construction',async()=>{const log=[],failure=Error('bad terrain'),s=createPreparationSequence({paint:async()=>{},onStep:(n,v)=>log.push(v)});await assert.rejects(s.step('a',()=>{throw failure;}),e=>e===failure);await assert.rejects(s.step('b',()=>assert.fail()));assert.deepEqual(log,['begin']);});
await check('overlapping-construction-is-rejected-without-canceling-owner',async()=>{const wait=pending();let work=0;const s=createPreparationSequence({paint:()=>wait.promise,task:async()=>{}}),a=s.step('a',()=>work++);await assert.rejects(s.step('b',()=>work++),/sequential/);wait.resolve();await a;assert.equal(work,1);});
await check('elapsed-deadline-after-blocking-constructor-cannot-report-complete',async()=>{let now=0;const events=[],s=createPreparationSequence({now:()=>now,timeoutMs:10,paint:async()=>{},onStep:(n,v)=>events.push(v)});await assert.rejects(s.step('a',()=>{now=11;}),e=>e.code==='PREPARATION_TIMEOUT');assert.deepEqual(events,['begin']);});
await check('cancel-at-final-task-rejects-ownership-before-next-step',async()=>{let canceled=false;const s=createPreparationSequence({canceled:()=>canceled,paint:async()=>{},task:async()=>{canceled=true;}});await assert.rejects(s.step('a',()=>7),e=>e.code==='PREPARATION_CANCELED');});
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
await check('actual-render-function-does-not-touch-half-built-scene',()=>{
 const source=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){'));const run=new Function('loadingSnapshot','sceneAssemblyComplete',`${source};return render;`)(()=>({status:'preparing'}),false);run(0);
});
await check('actual-settings-handler-rejects-uninitialized-failed-or-lost-state',()=>{
 const start=main.indexOf("$('#settingsButton').addEventListener('click',"),end=main.indexOf('\nfunction closeSettings()',start);let fn;
 const make=new Function('$','settingsReady','game','loadingSnapshot',`${main.slice(start,end)};`);
 for(const [ready,lost,status]of [[false,false,'preparing'],[true,false,'failed'],[true,true,'ready']]){make(()=>({addEventListener:(n,f)=>fn=f}),ready,{contextLost:lost},()=>({status}));fn();}
});
await check('actual-resize-handler-does-no-GPU-work-after-loss-or-failure',()=>{
 const start=main.indexOf("addEventListener('resize',"),end=main.indexOf('\n',start);let fn;
 const make=new Function('addEventListener','game','loadingSnapshot',main.slice(start,end));for(const [lost,status]of [[true,'preparing'],[false,'failed']]){make((n,f)=>fn=f,{contextLost:lost},()=>({status}));fn();}
});
await check('first-start-timing-preserves-synchronous-audio-call-and-only-observes-once',()=>{
 const source=main.slice(main.indexOf('function start('),main.indexOf('function pause()'));const calls=[],marks=[];
 const body=`let firstStartMeasured=false;const bootCompleted=true,graphicsReady=true,QA_MODE=true,loadingSnapshot=()=>({status:'ready'}),dom={start:{disabled:false},intro:{},hud:{classList:{add(){}}}},game={contextLost:false},APPROACH_END=.065,pilot={prime(){calls.push('prime');}},reset=()=>calls.push('reset'),playTracking={start(){calls.push('track');}},audio={start(){calls.push('audio');},setScene(){}},updatePlane=()=>{},logEvent=()=>{},startupMark=(...v)=>marks.push(v);${source};return start;`;
 const start=new Function('calls','marks',body)(calls,marks);start({skipOpening:true});assert.deepEqual(calls,['reset','track','audio','prime']);start({skipOpening:true});assert.deepEqual(marks,[['first-start-reset','begin'],['first-start-reset','end'],['first-start-audio','begin'],['first-start-audio','end']]);assert.equal(calls.filter(x=>x==='audio').length,2);
});
console.log(JSON.stringify({passed:true,checks:names.length,names},null,2));
