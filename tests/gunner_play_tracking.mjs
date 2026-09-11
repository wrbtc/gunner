import assert from 'node:assert/strict';
import {createPlayTracking} from '../game/src/play-tracking.js';

// Forbidden APIs throw, so this also verifies absence of cookie/storage dependency.
for(const key of ['localStorage','sessionStorage','document'])Object.defineProperty(globalThis,key,{get(){throw Error('No browser tracking storage');}});
const requests=[],ids=['run-one','run-two'];
let score=0;
const make=enabled=>createPlayTracking({enabled,uuid:()=>ids.shift(),snapshot:()=>({score,hull:100,eggs:0,progress:0}),send:(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return Promise.resolve({ok:true});}});
const disabled=make(false);disabled.start();disabled.tick(30);disabled.finish(true);assert.equal(requests.length,0);
const tracker=make(true);tracker.start();
assert.equal(requests.length,1);assert.equal(requests[0].body.event,'start');
for(let i=0;i<30;i++)tracker.tick(1);
assert.equal(requests[1].body.activeMs,30000);assert.equal(requests[1].body.runId,'run-one');
tracker.flush();score=120;tracker.finish(true);tracker.flush();
assert.equal(requests.length,4);assert.equal(requests[3].body.event,'win');assert.equal(requests[3].body.score,120);
tracker.start();assert.equal(requests.at(-1).body.runId,'run-two');assert.equal(requests.at(-1).body.activeMs,0);
for(const r of requests){assert.equal(r.options.credentials,'omit');assert.equal(r.options.keepalive,true);assert.equal('playerId' in r.body,false);}
const broken=createPlayTracking({enabled:true,uuid:()=>{throw Error('unavailable');},snapshot:()=>({})});broken.start();broken.finish(false);
const offline=createPlayTracking({enabled:true,uuid:()=> 'offline',snapshot:()=>({}),send:()=>Promise.reject(Error('offline'))});offline.start();offline.finish(false);
await new Promise(resolve=>setTimeout(resolve,0));
console.log('PASS: start/replay/checkpoint/end, QA disabled, no persistent storage, credentials omitted, analytics failures isolated');
