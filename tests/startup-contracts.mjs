import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoadingController,createStartupTrace,boundedPreparation,yieldLoadingPaint,loadingFailure,loadingSnapshot,loadingProgress} from '../game/src/mission-screen.js';
import {createRankReveal} from '../game/src/mission-rating.js';
import {enterGame} from '../game/mobile-entry.js';
const checks=[];
async function check(name,run){await run();checks.push(name);}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function timers(){let id=0;const tasks=new Map();return{tasks,setTimer(fn){tasks.set(++id,fn);return id;},clearTimer(key){tasks.delete(key);},fire(){const [key,fn]=tasks.entries().next().value;tasks.delete(key);fn();}};}
function events(){const listeners=new Map();return{listeners,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},dispatch(name,event){for(const fn of listeners.get(name)||[])fn(event);},count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}};}

await check('stage-count-is-idempotent-and-order-independent',()=>{const state=createLoadingController();state.complete('models');state.complete('world');state.complete('world');assert.deepEqual(state.snapshot().completed,['models','world']);assert.equal(state.snapshot().status,'preparing');state.complete('collision');state.complete('shaders');assert.equal(state.snapshot().status,'ready');});
await check('incomplete-state-cannot-be-promoted-to-ready',()=>{const state=createLoadingController();state.complete('world');assert.throws(()=>state.ready(),/incomplete/);});
await check('failure-latches-against-late-progress-and-completion',()=>{const state=createLoadingController();state.fail(Object.assign(Error('collision failed'),{code:'COLLISION_FAILED'}));assert.equal(state.begin('shaders',{completed:3,total:3}),false);assert.equal(state.complete('shaders'),false);assert.equal(state.ready(),false);assert.equal(state.snapshot().error.code,'COLLISION_FAILED');});
await check('startup-snapshot-is-deeply-read-only',()=>{const state=createLoadingController();state.begin('shaders',{stage:'submit',completed:2,total:8});const view=state.snapshot();assert.throws(()=>view.completed.push('world'));assert.throws(()=>view.progress.completed=8);assert.throws(()=>view.status='ready');});
await check('bounded-task-propagates-rejection-and-clears-timer',async()=>{const t=timers(),error=Error('collision failure');await assert.rejects(boundedPreparation(()=>Promise.reject(error),t),error);assert.equal(t.tasks.size,0);});
await check('bounded-task-times-out-and-does-not-accept-late-success',async()=>{const t=timers(),work=deferred(),promise=boundedPreparation(()=>work.promise,t);const rejected=assert.rejects(promise,e=>e.code==='PREPARATION_TIMEOUT');await tick();t.fire();await rejected;work.resolve('late');await tick();assert.equal(t.tasks.size,0);});
await check('bounded-task-success-clears-timeout',async()=>{const t=timers();assert.equal(await boundedPreparation(()=>42,t),42);assert.equal(t.tasks.size,0);});
await check('blocked-task-cannot-win-after-its-wall-deadline',async()=>{const t=timers();let now=0;await assert.rejects(boundedPreparation(()=>{now=50;return true;},{...t,now:()=>now,timeoutMs:10}),e=>e.code==='PREPARATION_TIMEOUT');assert.equal(t.tasks.size,0);});
await check('invalid-task-and-deadline-reject-before-scheduling',()=>{assert.throws(()=>boundedPreparation(null));assert.throws(()=>boundedPreparation(()=>true,{timeoutMs:0}));});
await check('loading-paint-yield-waits-for-frame-and-following-task',async()=>{let frame,task,done=false;const wait=yieldLoadingPaint({frame:fn=>frame=fn,schedule:fn=>task=fn}).then(()=>done=true);await tick();assert.equal(done,false);frame();await tick();assert.equal(done,false);task();await wait;assert.equal(done,true);});
await check('suspended-animation-frame-yield-has-a-cleaned-up-fallback',async()=>{const t=timers(),canceled=[];let delivered;const wait=yieldLoadingPaint({frame:fn=>{delivered=fn;return 19;},cancelFrame:id=>canceled.push(id),schedule:t.setTimer,cancel:t.clearTimer});t.fire();await wait;assert.deepEqual(canceled,[19]);assert.equal(t.tasks.size,0);delivered();assert.equal(t.tasks.size,0);});
await check('foreground-paint-yield-cancels-unused-fallback-timer',async()=>{const tasks=new Map(),canceled=[];let id=0,frame;const wait=yieldLoadingPaint({frame:fn=>{frame=fn;return 3;},cancelFrame:()=>assert.fail('delivered RAF must not be canceled'),schedule:(fn,ms)=>{tasks.set(++id,{fn,ms});return id;},cancel:key=>{canceled.push(key);tasks.delete(key);}});frame();const [key,task]=[...tasks].find(([,task])=>task.ms===0);tasks.delete(key);task.fn();await wait;assert.equal(tasks.size,0);assert.ok(canceled.includes(1));});

function entryOptions(extra={}){const t=timers(),ev=events();return{nav:{userAgent:'Mozilla/5.0 Macintosh',platform:'MacIntel',maxTouchPoints:0},media:()=>({matches:false}),root:{dataset:{}},notice:{hidden:true},heading:{focus(){}},source:'./main.js',load:async()=>{},...t,events:ev,clock:t,...extra};}
await check('module-import-failure-surfaces-and-removes-bootstrap-handlers',async()=>{const errors=[],options=entryOptions({load:async()=>{throw Error('module fetch failed');},onError:e=>errors.push(e)});assert.equal(await enterGame(options),'failed');assert.equal(errors.length,1);assert.equal(options.events.count(),0);assert.equal(options.clock.tasks.size,0);});
await check('pending-module-import-times-out-and-cleans-up',async()=>{const work=deferred(),errors=[],options=entryOptions({load:()=>work.promise,onError:e=>errors.push(e)}),promise=enterGame(options);await tick();options.clock.fire();assert.equal(await promise,'failed');assert.equal(errors[0].code,'STARTUP_TIMEOUT');assert.equal(errors[0].message,'Flight startup timed out');work.resolve();await tick();assert.equal(errors.length,1);assert.equal(options.events.count(),0);});
await check('uncaught-loading-callback-fails-once-even-if-module-later-resolves',async()=>{const work=deferred(),errors=[],options=entryOptions({load:()=>work.promise,onError:e=>errors.push(e)}),promise=enterGame(options);await tick();options.events.dispatch('error',{error:Error('first title draw failed')});options.events.dispatch('unhandledrejection',{reason:Error('later error')});work.resolve();assert.equal(await promise,'failed');assert.equal(errors.length,1);assert.equal(options.events.count(),0);});
await check('successful-desktop-bootstrap-cleans-up-its-error-handlers',async()=>{const options=entryOptions();assert.equal(await enterGame(options),'desktop');assert.equal(options.events.count(),0);assert.equal(options.clock.tasks.size,0);});
await check('blocked-module-cannot-win-after-stall-deadline',async()=>{let now=0;const errors=[],options=entryOptions({load:async()=>{now=100;},now:()=>now,timeoutMs:10,onError:e=>errors.push(e)});assert.equal(await enterGame(options),'failed');assert.equal(errors[0].code,'STARTUP_TIMEOUT');assert.equal(errors[0].message,'Flight startup timed out');assert.equal(options.clock.tasks.size,0);});
await check('progress-heartbeat-allows-boot-past-original-wall',async()=>{let now=0;const errors=[],options=entryOptions({timeoutMs:10,now:()=>now,load:async(source,hooks)=>{now=8;hooks.heartbeat();now=17;},onError:e=>errors.push(e)});assert.equal(await enterGame(options),'desktop');assert.equal(errors.length,0);assert.equal(options.clock.tasks.size,0);});
await check('progressing-long-boot-is-not-killed-at-60s-page-time',async()=>{let now=0;const errors=[],options=entryOptions({timeoutMs:60000,now:()=>now,load:async(source,hooks)=>{now=56799;hooks.heartbeat();now=56800;hooks.heartbeat();now=61327;hooks.heartbeat();now=70000;hooks.heartbeat();},onError:e=>errors.push(e)});assert.equal(await enterGame(options),'desktop');assert.equal(errors.length,0);assert.equal(options.clock.tasks.size,0);});
await check('stalled-boot-after-progress-still-times-out',async()=>{let now=0;const errors=[],options=entryOptions({timeoutMs:60000,now:()=>now,load:async(source,hooks)=>{now=56799;hooks.heartbeat();now=116799;},onError:e=>errors.push(e)});assert.equal(await enterGame(options),'failed');assert.equal(errors[0].code,'STARTUP_TIMEOUT');assert.equal(errors[0].message,'Flight startup timed out');assert.equal(options.clock.tasks.size,0);});
await check('late-heartbeat-cannot-revive-expired-watchdog',async()=>{let now=0;const errors=[],options=entryOptions({timeoutMs:10,now:()=>now,load:async(source,hooks)=>{now=11;hooks.heartbeat();},onError:e=>errors.push(e)});assert.equal(await enterGame(options),'failed');assert.equal(errors[0].code,'STARTUP_TIMEOUT');assert.equal(options.clock.tasks.size,0);});
await check('heartbeat-replaces-stall-timer-so-old-deadline-cannot-fire',async()=>{const work=deferred(),errors=[];let beat=null;const options=entryOptions({load:(source,hooks)=>{beat=hooks.heartbeat;return work.promise;},onError:e=>errors.push(e)});const promise=enterGame(options);await tick();assert.equal(options.clock.tasks.size,1);const first=[...options.clock.tasks.keys()][0];beat();assert.equal(options.clock.tasks.has(first),false);assert.equal(options.clock.tasks.size,1);work.resolve();assert.equal(await promise,'desktop');assert.equal(errors.length,0);assert.equal(options.clock.tasks.size,0);});
await check('mobile-gate-does-not-start-load-timer-or-error-handlers',async()=>{let calls=0;const options=entryOptions({nav:{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5},load:async()=>calls++});assert.equal(await enterGame(options),'mobile');assert.equal(calls,0);assert.equal(options.events.count(),0);assert.equal(options.clock.tasks.size,0);});

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const entrySource=readFileSync(new URL('../game/mobile-entry.js',import.meta.url),'utf8');
const missionSource=readFileSync(new URL('../game/src/mission-screen.js',import.meta.url),'utf8');
const cinemaSource=readFileSync(new URL('../game/src/cinematic-pass.js',import.meta.url),'utf8');
await check('timeout-messages-are-distinct-per-layer',()=>{
 assert.match(entrySource,/Flight startup timed out/);
 assert.match(missionSource,/Flight preparation timed out/);
 assert.match(missionSource,/Flight construction timed out/);
 assert.match(cinemaSource,/Graphics preparation timed out/);
 assert.match(main,/Graphics recovery timed out/);
 assert.match(main,/Flight construction timed out/);
 assert.doesNotMatch(entrySource,/Flight preparation timed out/);
 assert.doesNotMatch(main,/throw preparationError\('Flight preparation timed out'/);
});
await check('startup-trace-retains-immutable-bounded-history-on-page-clock',()=>{
 let now=100;const trace=createStartupTrace({now:()=>now++,limit:2});trace.mark('world-assets','begin');const before=trace.snapshot();trace.mark('world-assets','end','timeout');trace.mark('late','end');const after=trace.snapshot();
 assert.deepEqual(after.events.map(e=>e.at),[100,101]);assert.equal(after.dropped,1);assert.equal(before.events.length,1);assert.equal(before.dropped,0);assert.throws(()=>after.events.push({}));assert.throws(()=>after.events[0].at=0);assert.throws(()=>after.dropped=0);assert.equal(trace.snapshot(),after);assert.ok(Object.isFrozen(loadingSnapshot().trace.events));
});
function rankFixture(report=()=>{}){
 const images=[],previous=globalThis.Image;
 globalThis.Image=class{constructor(){this.work=deferred();this.naturalWidth=this.naturalHeight=1254;this.calls=0;images.push(this);}decode(){this.calls++;return this.work.promise;}};
 try{return {images,reveal:createRankReveal({button:{addEventListener(){}},onStartup:report})};}finally{if(previous===undefined)delete globalThis.Image;else globalThis.Image=previous;}
}
await check('rank-observation-keeps-one-decode-per-image-and-all-five-readiness',async()=>{
 const marks=[],f=rankFixture((...mark)=>marks.push(mark));let ready=false;f.reveal.ready.then(()=>{ready=true;});assert.deepEqual(f.images.map(image=>image.calls),[1,1,1,1,1]);
 for(const image of f.images.slice(0,4))image.work.resolve();await tick();assert.equal(ready,false);assert.equal(marks.filter(([name,state])=>name.startsWith('rank-decode:')&&state==='end').length,4);
 f.images[4].work.resolve();await f.reveal.ready;assert.equal(ready,true);assert.deepEqual(marks.at(-1),['rank-assets','end','ready']);
});
await check('rank-decode-rejection-is-preserved-and-observer-errors-are-isolated',async()=>{
 const marks=[],f=rankFixture((...mark)=>{marks.push(mark);throw Error('observer');}),error=Error('decode failure');const rejected=assert.rejects(f.reveal.ready,e=>e===error&&e.rankArt===true);
 f.images[0].work.reject(error);for(const image of f.images.slice(1))image.work.resolve();await rejected;assert.deepEqual(f.images.map(image=>image.calls),[1,1,1,1,1]);assert.ok(marks.some(([name,state,outcome])=>name==='rank-assets'&&state==='end'&&outcome==='rejected'));
});
const optionalSource=main.slice(main.indexOf('const OPTIONAL_ASSET_DEADLINE_MS='),main.indexOf('\nconst $ ='));
function optionalFixture(){const t=timers(),marks=[];return{t,marks,settle:new Function('setTimeout','clearTimeout','startupMark',`${optionalSource};return settleOptionalAsset;`)(t.setTimer,t.clearTimer,(...mark)=>marks.push(mark))};}
await check('actual-optional-branches-distinguish-ready-rejected-and-timeout-once',async()=>{
 const f=optionalFixture(),value={asset:true};assert.equal((await f.settle(Promise.resolve(value),'world-assets')).value,value);assert.equal((await f.settle(Promise.reject(Error('network')),'kit-assets')).degraded,true);
 const late=deferred(),result=f.settle(late.promise,'world-assets');f.t.fire();assert.equal((await result).value,null);late.resolve(value);await tick();assert.deepEqual(f.marks,[['world-assets','end','ready'],['kit-assets','end','rejected'],['world-assets','end','timeout']]);assert.equal(f.t.tasks.size,0);
});
await check('actual-required-model-gate-still-waits-for-rank-after-cinder-readiness',async()=>{
 const source=main.slice(main.indexOf('let cinderLoadFailed=false;'),main.indexOf("startupMark('initial-actors-effects','end');")),cinder=deferred(),rank=deferred(),marks=[];
 const run=new Function('boundedPreparation','loadCinderMaw','rankReveal','startupMark','failFlightPreparation',`${source};return requiredCinder;`)(boundedPreparation,()=>cinder.promise,{ready:rank.promise},(...mark)=>marks.push(mark),()=>assert.fail('unexpected failure'));
 let ready=false;const result=run().then(value=>{ready=true;return value;});await tick();const model={model:true};cinder.resolve(model);await tick();assert.equal(ready,false);assert.deepEqual(marks,[['cinder-assets','begin'],['cinder-assets','end','ready']]);rank.resolve();assert.equal(await result,model);
});
await check('failed-preparation-stops-the-actual-render-loop-before-updates',()=>{
 const source=main.slice(main.indexOf('function render(now){'),main.indexOf('\nfunction reset(){',main.indexOf('function render(now){')));
 let updates=0;
 const factory=new Function('loadingSnapshot','windowDamage',`${source};return render;`);
 factory(()=>({status:'failed'}),{advanceTime(){updates++;}})(0);assert.equal(updates,0);
});
await check('actual-gl-draw-gate-blocks-failure-after-preparation-owner-clears',()=>{
 const begin=main.indexOf('  if(!game.contextLost&&!graphicsPreparation'),end=main.indexOf('  requestAnimationFrame(render);',begin),source=main.slice(begin,end);
 let draws=0,resets=0;const renderer={info:{reset(){resets++;},render:{calls:1,triangles:2,points:3}}},cinematic={render(){draws++;}};
 const execute=new Function('game','graphicsPreparation','loadingSnapshot','renderer','cinematic',`const preferences={reduced:false},scene={},camera={},visualTime=0,reducedOpening=()=>false,WORLD_ONLY=false,exteriorView=true,frameMetrics={},elapsed=0;${source}`);
 execute({contextLost:false},null,()=>({status:'failed'}),renderer,cinematic);assert.equal(draws,0);assert.equal(resets,0);
 execute({contextLost:false},{},()=>({status:'preparing'}),renderer,cinematic);assert.equal(draws,0);
 execute({contextLost:false},null,()=>({status:'ready'}),renderer,cinematic);assert.equal(draws,1);assert.equal(resets,1);
});
await check('actual-start-handler-rejects-partial-or-failed-preparation',()=>{
 const source=main.slice(main.indexOf('function start('),main.indexOf('function pause()',main.indexOf('function start(')));
 const marker=Error('ready start reached reset');
 const factory=new Function('bootCompleted','graphicsReady','status','reset',`const menuMusic=null,firstStartMeasured=true,loadingSnapshot=()=>({status}),dom={start:{disabled:false}},game={contextLost:false};${source};return start;`);
 for(const [boot,graphics,status]of [[false,false,'preparing'],[true,false,'preparing'],[true,true,'failed']])factory(boot,graphics,status,()=>{throw marker;})();
 assert.throws(()=>factory(true,true,'ready',()=>{throw marker;})(),error=>error===marker);
});
const recoverySource=main.slice(main.indexOf('let graphicsContextGeneration='),main.indexOf("addEventListener('resize',()=>",main.indexOf('let graphicsContextGeneration=')));
function recoveryFixture({bootCompleted=true}={}){
 const state=createLoadingController();if(bootCompleted)for(const id of ['world','models','collision','shaders'])state.complete(id);
 const t=timers(),canvas=events(),game={running:bootCompleted,paused:false,contextLost:false,gunHeld:false},pending=[];
 const dom={canvas,start:{disabled:false},pause:{},opening:{},result:{},unsupported:{querySelector:()=>({})},hud:{classList:{remove(){}}}};
 let rebuilt=0,recovered=0,sequenceDisposals=0;
 const deps={dom,game,bootCompleted,startupAssembly:{dispose(){sequenceDisposals++;}},audio:{cancelPreparation(){}},scene:{},camera:{},rift:{},plasmaBugs:{lightVariants:{}},calderaEnvironment:{contextLost(){},rebuild(){rebuilt++;}},cinematic:{contextLost(){},recoverContext(){recovered++;},prepare(){const work=deferred();pending.push(work);return work.promise;}},pause:()=>{game.paused=true;},loadingProgress:state.begin,loadingReady:state.ready,loadingFailure:state.fail,loadingSnapshot:state.snapshot,yieldLoadingPaint:async()=>{},setTimeout:t.setTimer,clearTimeout:t.clearTimer,performance:{now:()=>1000}};
 const factory=new Function('deps',`const {dom,game,scene,camera,rift,plasmaBugs,calderaEnvironment,cinematic,pause,loadingProgress,loadingReady,loadingFailure,loadingSnapshot,yieldLoadingPaint,setTimeout,clearTimeout,performance,startupAssembly,audio}=deps;let bootCompleted=deps.bootCompleted,graphicsReady=bootCompleted;${recoverySource};return {prepareFlightGraphics,state:()=>({graphicsReady,generation:graphicsContextGeneration,recovery:recoveryAttempt?.promise,preparation:graphicsPreparation?.promise})};`);
 const api=factory(deps);return{api,game,dom,state,t,pending,counts:()=>({rebuilt,recovered}),sequenceDisposals:()=>sequenceDisposals,lost:()=>canvas.dispatch('webglcontextlost',{preventDefault(){}}),restored:()=>canvas.dispatch('webglcontextrestored',{})};
}
await check('context-loss-during-initial-boot-fails-without-retry-loop',async()=>{const f=recoveryFixture({bootCompleted:false});f.lost();f.restored();await tick();assert.equal(f.state.snapshot().status,'failed');assert.equal(f.pending.length,0);assert.equal(f.api.state().graphicsReady,false);assert.equal(f.sequenceDisposals(),1);});
await check('same-generation-preparation-callers-share-one-promise',async()=>{const f=recoveryFixture(),a=f.api.prepareFlightGraphics(),b=f.api.prepareFlightGraphics();assert.equal(a,b);await tick();assert.equal(f.pending.length,1);f.pending[0].resolve(true);await a;});
await check('duplicate-context-restored-events-have-one-owner-and-remain-frozen',async()=>{const f=recoveryFixture();f.lost();f.restored();f.restored();const task=f.api.state().recovery;await tick();assert.equal(f.pending.length,1);assert.equal(f.game.contextLost,true);assert.equal(f.game.paused,true);assert.deepEqual(f.counts(),{rebuilt:1,recovered:1});f.pending[0].resolve(true);await task;assert.equal(f.game.contextLost,false);assert.equal(f.api.state().graphicsReady,true);assert.equal(f.game.paused,true);assert.equal(f.state.snapshot().status,'ready');assert.equal(f.t.tasks.size,0);});
await check('context-recovery-rejection-surfaces-failure-without-unhandled-rejection',async()=>{const f=recoveryFixture();f.lost();f.restored();const task=f.api.state().recovery;await tick();f.pending[0].reject(Error('shader failed'));await task;assert.equal(f.state.snapshot().status,'failed');assert.equal(f.api.state().graphicsReady,false);assert.equal(f.game.running,false);assert.equal(f.t.tasks.size,0);});
await check('canceled-context-preparation-cannot-enable-gameplay',async()=>{const f=recoveryFixture();f.lost();f.restored();const task=f.api.state().recovery;await tick();f.pending[0].resolve(false);await task;assert.equal(f.state.snapshot().status,'failed');assert.equal(f.api.state().graphicsReady,false);});
await check('missing-context-restoration-times-out-and-ignores-late-event',async()=>{const f=recoveryFixture();f.lost();f.t.fire();f.restored();await tick();assert.equal(f.state.snapshot().status,'failed');assert.equal(f.pending.length,0);});
await check('new-context-waits-for-stale-preparation-before-rebuilding',async()=>{const f=recoveryFixture();f.lost();f.restored();const first=f.api.state().recovery;await tick();f.lost();f.restored();const second=f.api.state().recovery;await tick();assert.equal(f.pending.length,1);f.pending[0].resolve(false);await first;await tick();assert.equal(f.pending.length,2);assert.equal(f.api.state().graphicsReady,false);f.pending[1].resolve(true);await second;assert.equal(f.state.snapshot().status,'ready');assert.equal(f.game.contextLost,false);});

await check('player-copy-does-not-conflate-changing-preparation-counter-units',()=>{
 const status={textContent:'',classList:{toggle(){}}};globalThis.document={getElementById:id=>id==='loadStatus'?status:null};
 try{
  loadingProgress('shaders',{stage:'submit',completed:100,total:100});assert.match(status.textContent,/preparation items complete/);assert.ok(!status.textContent.includes('%'));assert.equal(loadingSnapshot().progress.completed,100);
  loadingProgress('shaders',{stage:'link',completed:1,total:20});assert.match(status.textContent,/preparation items complete/);assert.ok(!status.textContent.includes('%'));assert.deepEqual(loadingSnapshot().progress,{stage:'link',completed:1,total:20});
  const trace=loadingSnapshot().trace;for(let i=0;i<100;i++)loadingProgress('shaders',{stage:'link',completed:i,total:100});assert.equal(loadingSnapshot().trace,trace);
 }finally{delete globalThis.document;}
});
await check('failed-loading-retry-replaces-old-start-handlers-and-is-accessible',()=>{
 const nodes=new Map();let oldStarts=0,reloads=0,focused=0;
 const makeButton=()=>({id:'startButton',disabled:true,textContent:'PREPARING FLIGHT…',listeners:new Map(),cloneNode:makeButton,addEventListener(name,fn,options){this.listeners.set(name,{fn,options});},replaceWith(next){nodes.set(this.id,next);},focus(){focused++;},click(){const item=this.listeners.get('click');if(!item||this.disabled)return;if(item.options?.once)this.listeners.delete('click');item.fn();}});
 const old=makeButton();old.addEventListener('click',()=>oldStarts++);nodes.set('startButton',old);nodes.set('loadStatus',{classList:{toggle(){}},textContent:''});nodes.set('loadingSystems',{setAttribute(k,v){this[k]=v;}});nodes.set('intro',{hidden:true});
 globalThis.document={getElementById:id=>nodes.get(id),activeElement:old};
 try{loadingFailure(Error('bootstrap failure'),{reload:()=>reloads++});const retry=nodes.get('startButton');assert.notEqual(retry,old);assert.equal(retry.id,'startButton');assert.equal(retry.disabled,false);assert.equal(retry.textContent,'RETRY LOADING');assert.equal(nodes.get('loadingSystems')['aria-busy'],'false');assert.equal(nodes.get('intro').hidden,false);assert.equal(focused,1);retry.click();retry.click();assert.equal(reloads,1);assert.equal(oldStarts,0);assert.equal(loadingSnapshot().status,'failed');}finally{delete globalThis.document;}
});
console.log(JSON.stringify({passed:true,checks:checks.length,names:checks,scope:'Offline state/deadline/import/recovery orchestration tests with injected timers and renderer outcomes. No browser, GPU timing or Safari performance proof.'},null,2));
