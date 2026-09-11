// Offline task-scheduler contracts. Fake ports/timers expose ownership and
// delivery order; one real Node MessageChannel test verifies the native API.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreparationSequence} from '../game/src/mission-screen.js';
const names=[],check=async(name,fn)=>{await fn();names.push(name);};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness({mode='normal',timeoutMs=30000,fallbackMs=100}={}){
 let clock=0,nextTimer=0,constructed=0,peakTimers=0,postCount=0;
 const timers=new Map(),timerHistory=[],channels=[],messages=[];
 const setTimer=(fn,delay)=>{const id=++nextTimer,entry={id,fn,delay,at:clock+delay};timers.set(id,entry);timerHistory.push(entry);peakTimers=Math.max(peakTimers,timers.size);return id;};
 const clearTimer=id=>timers.delete(id);
 class Channel{
  constructor(){
   constructed++;if(mode==='construction-fails')throw Error('Channel unavailable');
   this.closed=[0,0];this.port1={onmessage:null,close:()=>this.closed[0]++};this.port2={close:()=>this.closed[1]++,postMessage:data=>{postCount++;if(mode==='post-fails')throw Error('post failed');messages.push({owner:this,handler:this.port1.onmessage,data});}};channels.push(this);
  }
 }
 const options={Channel:mode==='missing'?null:Channel,now:()=>clock,setTimer,clearTimer,timeoutMs,fallbackMs,paint:async()=>{}};
 const fire=id=>{const e=timers.get(id);assert.ok(e,'Requested timer must be pending');clock=Math.max(clock,e.at);timers.delete(id);e.fn();};
 const fireNext=()=>{const e=[...timers.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];assert.ok(e);fire(e.id);};
 const deliver=()=>{const m=messages.shift();assert.ok(m,'One message must be posted');if(!m.owner.closed[0])m.owner.port1.onmessage?.({data:m.data});return m;};
 return {options,timers,timerHistory,channels,messages,fire,fireNext,deliver,setClock:t=>{clock=t;},get constructed(){return constructed;},get postCount(){return postCount;},get peakTimers(){return peakTimers;}};
}
function assertClosed(h){assert.equal(h.timers.size,0);for(const c of h.channels){assert.deepEqual(c.closed,[1,1]);assert.equal(c.port1.onmessage,null);}}
await check('one-channel-is-reused-with-only-one-pending-message-and-two-timers',async()=>{
 const h=harness(),s=createPreparationSequence(h.options);assert.equal(h.constructed,0);assert.equal(h.timers.size,0);
 for(let i=0;i<25;i++){
  let resumed=false;const p=s.checkpoint().then(()=>{resumed=true;});assert.equal(h.messages.length,1);assert.equal(h.timers.size,2);
  await flush();assert.equal(resumed,false,'Microtasks must not replace the message task');h.deliver();await p;assert.equal(h.timers.size,1);
 }
 assert.equal(h.constructed,1);assert.equal(h.postCount,25);assert.equal(h.peakTimers,2);s.dispose();s.dispose();assertClosed(h);
});
await check('named-steps-retain-explicit-paint-and-construction-order',async()=>{
 const h=harness(),log=[],s=createPreparationSequence({...h.options,paint:async()=>log.push('paint'),onStep:(n,state)=>log.push(n+':'+state)});
 const a=s.step('a',async()=>{log.push('a1');await s.checkpoint();log.push('a2');return 7;});await flush();assert.deepEqual(log,['a:begin','paint','a1']);h.deliver();await flush();assert.deepEqual(log,['a:begin','paint','a1','a2','a:end']);h.deliver();assert.equal(await a,7);
 const b=s.step('b',()=>log.push('b'));await flush();h.deliver();await b;
 assert.deepEqual(log,['a:begin','paint','a1','a2','a:end','b:begin','paint','b','b:end']);assert.equal(h.constructed,1);s.dispose();assertClosed(h);
});
await check('cancel-before-first-task-does-not-create-channel-or-timers',async()=>{
 const h=harness(),s=createPreparationSequence({...h.options,canceled:()=>true});await assert.rejects(s.checkpoint(),e=>e.code==='PREPARATION_CANCELED');assert.equal(h.constructed,0);assertClosed(h);
});
await check('cancel-while-message-pending-rejects-before-next-construction-work',async()=>{
 const h=harness();let canceled=false,work=0;const s=createPreparationSequence({...h.options,canceled:()=>canceled});
 const p=s.step('a',async()=>{work++;await s.checkpoint();work++;}),rejected=assert.rejects(p,e=>e.code==='PREPARATION_CANCELED');await flush();canceled=true;h.deliver();await rejected;assert.equal(work,1);assertClosed(h);await assert.rejects(s.step('b',()=>work++),e=>e.code==='PREPARATION_CANCELED');assert.equal(work,1);
});
await check('cancel-with-stalled-message-is-observed-at-bounded-fallback',async()=>{
 const h=harness({fallbackMs:40});let canceled=false;const s=createPreparationSequence({...h.options,canceled:()=>canceled}),p=s.checkpoint(),rejected=assert.rejects(p,e=>e.code==='PREPARATION_CANCELED');canceled=true;h.fireNext();await rejected;assertClosed(h);assert.equal(h.timerHistory[1].delay,40);
});
await check('remaining-deadline-bounds-pending-message-and-preserves-timeout-failure',async()=>{
 const h=harness({timeoutMs:30}),s=createPreparationSequence(h.options);h.setClock(27);const p=s.checkpoint(),rejected=assert.rejects(p,e=>e.code==='PREPARATION_TIMEOUT');assert.deepEqual(h.timerHistory.map(t=>t.delay),[3,3]);h.fireNext();await rejected;assertClosed(h);assert.equal(s.remainingMs(),0);await assert.rejects(s.checkpoint(),e=>e.code==='PREPARATION_TIMEOUT');
});
await check('late-message-cannot-beat-elapsed-deadline-even-before-timer-callback',async()=>{
 const h=harness({timeoutMs:20}),s=createPreparationSequence(h.options),p=s.checkpoint(),rejected=assert.rejects(p,e=>e.code==='PREPARATION_TIMEOUT');h.setClock(21);h.deliver();await rejected;assertClosed(h);
});
await check('overall-deadline-is-not-reset-between-checkpoints-or-idle-steps',async()=>{
 const h=harness({timeoutMs:30}),s=createPreparationSequence(h.options),a=s.checkpoint();h.deliver();await a;const deadline=h.timerHistory[0];h.setClock(20);const b=s.checkpoint();h.deliver();await b;assert.equal(h.timers.size,1);assert.equal(h.timers.get(deadline.id),deadline);assert.equal(deadline.at,30);h.fire(deadline.id);assertClosed(h);await assert.rejects(s.checkpoint(),e=>e.code==='PREPARATION_TIMEOUT');
});
await check('missing-channel-uses-real-timer-tasks-and-cleans-up',async()=>{
 const h=harness({mode:'missing'}),s=createPreparationSequence(h.options);for(let i=0;i<2;i++){let done=false;const p=s.checkpoint().then(()=>{done=true;});await flush();assert.equal(done,false);assert.equal(h.timerHistory.at(-1).delay,0);h.fireNext();await p;}
 assert.equal(h.constructed,0);assert.equal(h.postCount,0);s.dispose();assertClosed(h);
});
await check('channel-construction-failure-is-attempted-once-and-falls-back-to-tasks',async()=>{
 const h=harness({mode:'construction-fails'}),s=createPreparationSequence(h.options);for(let i=0;i<2;i++){const p=s.checkpoint();assert.equal(h.timerHistory.at(-1).delay,0);h.fireNext();await p;}assert.equal(h.constructed,1);s.dispose();assertClosed(h);
});
await check('posting-failure-closes-both-ports-and-replaces-watchdog-with-timer-task',async()=>{
 const h=harness({mode:'post-fails'}),s=createPreparationSequence(h.options),p=s.checkpoint();assert.deepEqual(h.channels[0].closed,[1,1]);assert.equal(h.timers.size,2);assert.equal(h.timerHistory.at(-1).delay,0);h.fireNext();await p;
 const second=s.checkpoint();h.fireNext();await second;assert.equal(h.postCount,1);assert.equal(h.constructed,1);s.dispose();assertClosed(h);
});
await check('stalled-message-retires-channel-and-stale-delivery-cannot-release-later-task',async()=>{
 const h=harness({fallbackMs:40}),s=createPreparationSequence(h.options),a=s.checkpoint(),stale=h.messages[0];h.fireNext();await a;assert.deepEqual(h.channels[0].closed,[1,1]);let resumed=false;const b=s.checkpoint().then(()=>{resumed=true;});stale.handler({data:stale.data});await flush();assert.equal(resumed,false);assert.equal(h.timerHistory.at(-1).delay,0);h.fireNext();await b;assert.equal(h.postCount,1);s.dispose();assertClosed(h);
});
await check('message-identity-rejects-duplicate-delivery-from-earlier-checkpoint',async()=>{
 const h=harness(),s=createPreparationSequence(h.options),a=s.checkpoint(),first=h.deliver();await a;let resumed=false;const b=s.checkpoint().then(()=>{resumed=true;});first.handler({data:first.data});await flush();assert.equal(resumed,false);h.deliver();await b;s.dispose();assertClosed(h);
});
await check('dispose-rejects-pending-task-and-clears-all-owned-resources-once',async()=>{
 const h=harness(),s=createPreparationSequence(h.options),p=s.checkpoint(),rejected=assert.rejects(p,e=>e.code==='PREPARATION_CANCELED'),old=h.messages[0],fallback=h.timerHistory.at(-1);s.dispose();s.dispose();await rejected;assertClosed(h);old.handler({data:old.data});fallback.fn();assertClosed(h);await assert.rejects(s.checkpoint(),e=>e.code==='PREPARATION_CANCELED');assert.equal(h.postCount,1);
});
await check('constructor-failure-disposes-already-created-channel-without-later-work',async()=>{
 const h=harness(),error=Error('bad construction'),s=createPreparationSequence(h.options),first=s.checkpoint();h.deliver();await first;await assert.rejects(s.step('bad',()=>{throw error;}),e=>e===error);assertClosed(h);await assert.rejects(s.step('later',()=>assert.fail()),e=>e===error);
});
await check('overlapping-checkpoint-rejects-without-canceling-its-current-owner',async()=>{
 const h=harness(),s=createPreparationSequence(h.options),first=s.checkpoint();await assert.rejects(s.checkpoint(),/sequential/);assert.equal(h.postCount,1);h.deliver();await first;const next=s.checkpoint();h.deliver();await next;s.dispose();assertClosed(h);
});
await check('remaining-time-uses-the-original-clock-without-mutating-sequence',()=>{
 const h=harness({timeoutMs:30}),s=createPreparationSequence(h.options);assert.ok(Object.isFrozen(s));assert.equal(s.remainingMs(),30);h.setClock(12);assert.equal(s.remainingMs(),18);assert.equal(s.remainingMs(),18);h.setClock(35);assert.equal(s.remainingMs(),0);assert.equal(h.constructed,0);assert.equal(h.timers.size,0);s.dispose();assertClosed(h);
});
await check('injected-task-contract-retains-order-without-allocating-default-scheduler',async()=>{
 const h=harness(),log=[],s=createPreparationSequence({...h.options,task:async()=>log.push('task'),paint:async()=>log.push('paint')});await s.step('a',async()=>{log.push('first');await s.checkpoint();log.push('last');});assert.deepEqual(log,['paint','first','task','last','task']);assert.equal(h.constructed,0);assert.equal(h.timers.size,0);s.dispose();assertClosed(h);
});
await check('invalid-task-and-fallback-options-fail-before-allocating-resources',()=>{
 const h=harness();for(const fallbackMs of [0,-1,Infinity,NaN])assert.throws(()=>createPreparationSequence({...h.options,fallbackMs}),/fallback/);assert.throws(()=>createPreparationSequence({...h.options,task:0}),/must be a function/);assert.equal(h.constructed,0);assert.equal(h.timers.size,0);
});
await check('real-message-channel-yields-tasks-and-closes-without-pending-handles',async()=>{
 assert.equal(typeof globalThis.MessageChannel,'function');let made=0,closed=0;
 class ObservedChannel extends MessageChannel{constructor(){super();made++;for(const port of [this.port1,this.port2]){const close=port.close.bind(port);port.close=()=>{closed++;close();};}}}
 const s=createPreparationSequence({Channel:ObservedChannel,paint:async()=>{},timeoutMs:1000});try{await s.step('a',async()=>{await s.checkpoint();return 7;});await s.checkpoint();}finally{s.dispose();}assert.equal(made,1);assert.equal(closed,2);
});
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
await check('actual-main-retains-the-construction-owner-for-failure-cleanup',()=>{
 const assignment=main.split('\n').find(line=>line.startsWith('const assembly=startupAssembly=createPreparationSequence('));assert.ok(assignment);
 let options;const owner={},game={contextLost:false};const result=new Function('createPreparationSequence','game','loadingSnapshot','startupMark','loadingProgress','assemblyLabels',`let startupAssembly=null;${assignment}return {assembly,startupAssembly};`)(value=>{options=value;return owner;},game,()=>({status:'preparing'}),()=>{},()=>{},{});
 assert.equal(result.assembly,owner);assert.equal(result.startupAssembly,owner);assert.equal(options.canceled(),false);game.contextLost=true;assert.equal(options.canceled(),true);
});
await check('actual-main-disposes-after-final-atmosphere-step-completes',async()=>{
 const finalStep=main.split('\n').find(line=>line.startsWith("await assembly.step('atmosphere',")),disposal=main.split('\n').find(line=>line==='assembly.dispose();');assert.ok(finalStep);assert.ok(disposal);assert.ok(main.indexOf(disposal)>main.indexOf(finalStep));assert.ok(main.indexOf(disposal)<main.indexOf('pilot=createPilotRadio('));
 const h=harness(),s=createPreparationSequence(h.options),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;let constructed=0;
 const pending=new AsyncFunction('assembly','createAtmosphere',finalStep+'\n'+disposal)(s,()=>constructed++);await flush();assert.equal(constructed,1);assert.equal(h.timers.size,2);h.deliver();await pending;assertClosed(h);
});
await check('actual-main-failure-disposes-pending-construction-and-allows-pre-assembly-failure',async()=>{
 const start=main.indexOf('function failFlightPreparation(error){'),stop=main.indexOf('\nfunction prepareFlightGraphics()',start),code=main.slice(start,stop);assert.ok(start>=0&&stop>start);
 const reported=[],dom={pause:{},opening:{},result:{},unsupported:{},hud:{classList:{remove(){}}}},game={};
 const make=owner=>new Function('startupAssembly','clearTimeout','recoveryTimer','game','dom','loadingFailure','audio',`let graphicsReady=true;${code};return failFlightPreparation;`)(owner,()=>{},null,game,dom,error=>reported.push(error),{cancelPreparation(){}});
 const early=Error('early failure');make(null)(early);assert.equal(reported.at(-1),early);
 const h=harness(),s=createPreparationSequence(h.options),pending=s.checkpoint(),rejected=assert.rejects(pending,e=>e.code==='PREPARATION_CANCELED'),failure=Error('loading failure');make(s)(failure);await rejected;assertClosed(h);assert.equal(reported.at(-1),failure);assert.equal(game.running,false);assert.equal(game.gunHeld,false);
});
console.log(JSON.stringify({passed:true,checks:names.length,names,scope:'Offline scheduling/order/cancel/deadline/resource contracts; one real Node MessageChannel. No browser, native timing, or Safari performance claim.'},null,2));
