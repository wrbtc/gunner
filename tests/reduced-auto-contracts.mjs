// Actual Deploy-time reduced-effects auto from source. Measured HUD band only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
assert.match(main,/const REDUCED_AUTO_MS=4000/);
assert.match(main,/function armReducedAuto\(\)/);
assert.match(main,/function considerReducedAuto\(now\)/);
assert.match(main,/updateFps\(now\);considerReducedAuto\(now\);/);
assert.match(main,/armReducedAuto\(\);/);
assert.match(main,/reducedAuto\.userSet=true/);
assert.match(main,/reducedUserSet:reducedAuto\.userSet/);
assert.match(main,/saved\.reducedUserSet===true/);
assert.doesNotMatch(main,/navigator\.userAgent/);
assert.doesNotMatch(main,/userAgent\.includes/);

assert.match(main,/function applyReducedDrawCost\(reduced\)/);
assert.match(main,/renderer\.shadowMap\.autoUpdate=!reduced/);
assert.match(main,/renderer\.shadowMap\.enabled = true/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*!/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
const apply=main.match(/function applyReducedDrawCost\(reduced\)\{[\s\S]*?\n\}/)?.[0];
const arm=main.match(/function armReducedAuto\(\)\{[\s\S]*?\n\}/)?.[0];
const consider=main.match(/function considerReducedAuto\(now\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(apply&&arm&&consider,'reduced auto helpers are present');

function harness(){
  const reducedEffects={checked:false};
  const context={
    REDUCED_AUTO_MS:4000,
    reducedAuto:{armed:false,lowSince:0,applied:false,userSet:false},
    preferences:{reduced:false},
    game:{running:true,paused:false,ended:false,contextLost:false},
    document:{hidden:false},
    dom:{fps:{dataset:{band:'low'}}},
    renderer:{shadowMap:{enabled:true,autoUpdate:true}},
    mayhemFX:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    saves:0,
    events:[],
    $:(sel)=>sel==='#reducedEffects'?reducedEffects:null,
    savePreferences(){context.saves++;},
    logEvent(type){context.events.push(type);},
  };
  vm.runInNewContext(`${apply};${arm};${consider};globalThis.armReducedAuto=armReducedAuto;globalThis.considerReducedAuto=considerReducedAuto;globalThis.applyReducedDrawCost=applyReducedDrawCost`,context);
  return {context,reducedEffects};
}

const first=harness();
first.context.armReducedAuto();
assert.equal(first.context.reducedAuto.armed,true);
first.context.considerReducedAuto(1000);
assert.equal(first.context.preferences.reduced,false);
first.context.considerReducedAuto(4999);
assert.equal(first.context.preferences.reduced,false);
first.context.considerReducedAuto(5000);
assert.equal(first.context.preferences.reduced,true);
assert.equal(first.reducedEffects.checked,true);
assert.equal(first.context.mayhemFX.reduced,true);
assert.equal(first.context.renderer.shadowMap.autoUpdate,false);
assert.equal(first.context.renderer.shadowMap.enabled,true);
assert.equal(first.context.reducedAuto.applied,true);
assert.equal(first.context.reducedAuto.armed,false);
assert.equal(first.context.saves,1);
assert.deepEqual(first.context.events,['reduced-auto']);
first.context.applyReducedDrawCost(false);
assert.equal(first.context.renderer.shadowMap.autoUpdate,true);
assert.equal(first.context.renderer.shadowMap.enabled,true);

const paused=harness();
paused.context.armReducedAuto();
paused.context.game.paused=true;
paused.context.considerReducedAuto(1000);
paused.context.considerReducedAuto(6000);
assert.equal(paused.context.preferences.reduced,false);
assert.equal(paused.context.reducedAuto.lowSince,0);

const hidden=harness();
hidden.context.armReducedAuto();
hidden.context.document.hidden=true;
hidden.context.considerReducedAuto(1000);
hidden.context.considerReducedAuto(6000);
assert.equal(hidden.context.preferences.reduced,false);

const watch=harness();
watch.context.armReducedAuto();
watch.context.dom.fps.dataset.band='watch';
watch.context.considerReducedAuto(1000);
watch.context.considerReducedAuto(6000);
assert.equal(watch.context.preferences.reduced,false);

const override=harness();
override.context.reducedAuto.userSet=true;
override.context.armReducedAuto();
assert.equal(override.context.reducedAuto.armed,false);
override.context.considerReducedAuto(1000);
override.context.considerReducedAuto(6000);
assert.equal(override.context.preferences.reduced,false);

const already=harness();
already.context.preferences.reduced=true;
already.context.armReducedAuto();
assert.equal(already.context.reducedAuto.armed,false);

const interrupt=harness();
interrupt.context.armReducedAuto();
interrupt.context.considerReducedAuto(1000);
assert.equal(interrupt.context.reducedAuto.lowSince,1000);
interrupt.context.dom.fps.dataset.band='good';
interrupt.context.considerReducedAuto(2500);
assert.equal(interrupt.context.reducedAuto.lowSince,0);
interrupt.context.dom.fps.dataset.band='low';
interrupt.context.considerReducedAuto(2500);
interrupt.context.considerReducedAuto(6499);
assert.equal(interrupt.context.preferences.reduced,false);
interrupt.context.considerReducedAuto(6500);
assert.equal(interrupt.context.preferences.reduced,true);

console.log('PASS reduced-auto-contracts (measured low band, pause/hidden reset, checkbox override)');
