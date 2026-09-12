// Actual Deploy-time reduced-effects auto from source. Measured HUD band only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
assert.match(main,/const REDUCED_AUTO_MS=4000/);
assert.match(main,/function armReducedAuto\(\)/);
assert.match(main,/function considerReducedAuto\(now\)/);
assert.match(main,/if\(!preferences\.reduced\)updateFps\(now\);considerReducedAuto\(now\);/);
assert.match(main,/armReducedAuto\(\);/);
assert.match(main,/reducedAuto\.userSet=true/);
assert.match(main,/reducedUserSet:reducedAuto\.userSet/);
assert.match(main,/saved\.reducedUserSet===true/);
assert.doesNotMatch(main,/navigator\.userAgent/);
assert.doesNotMatch(main,/userAgent\.includes/);

assert.match(main,/function applyReducedDrawCost\(reduced\)/);
assert.match(main,/function applyReducedFillCost\(reduced\)/);
assert.match(main,/function applyReducedPresentHud\(reduced\)/);
assert.match(main,/function applyReducedShadowReceive\(reduced\)/);
assert.match(main,/function reducedAtmosphereKeep\(kind,count,reduced\)/);
assert.match(main,/renderer\.shadowMap\.autoUpdate=!reduced/);
assert.match(main,/applyReducedShadowReceive\(\!\!reduced\)/);
assert.match(main,/renderer\.shadowMap\.enabled = true/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*!/);
assert.doesNotMatch(main,/shadowMap\.enabled\s*=\s*false/);
const apply=main.match(/function applyReducedDrawCost\(reduced\)\{[\s\S]*?\n\}/)?.[0];
const fill=main.match(/function applyReducedFillCost\(reduced\)\{[\s\S]*?\n\}/)?.[0];
const receive=main.match(/function applyReducedShadowReceive\(reduced\)\{[\s\S]*?\n\}/)?.[0];
const keep=main.match(/function reducedAtmosphereKeep\(kind,count,reduced\)\{[\s\S]*?\n\}/)?.[0];
const arm=main.match(/function armReducedAuto\(\)\{[\s\S]*?\n\}/)?.[0];
const consider=main.match(/function considerReducedAuto\(now\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(apply&&fill&&receive&&keep&&arm&&consider,'reduced auto helpers are present');

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
    hellWorld:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    blastWorld:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    tankerSpray:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    plasmaBugs:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    particles:{reduced:false,setReducedEffects(value){this.reduced=!!value;}},
    atmosphereBatches:[
      {kind:'ember',count:3400,points:{visible:true,geometry:{range:3400,setDrawRange(start,count){this.range=count;}}}},
      {kind:'ash',count:1600,points:{visible:true,geometry:{range:1600,setDrawRange(start,count){this.range=count;}}}},
      {kind:'steam',count:156,points:{visible:true,geometry:{range:156,setDrawRange(start,count){this.range=count;}}}},
    ],
    atmosphereMaterials:[{uniforms:{uReduced:{value:0}}}],
    riverLights:[{power:2400,light:{intensity:2400}},{power:3300,light:{intensity:3300}}],
    rift:{userData:{fillLight:{intensity:220},fillLightPower:220}},
    ventPlumes:[{sprite:{visible:true}}],
    shadowReceivers:[],
    scene:{
      background:{hex:0x110a08,setHex(value){this.hex=value;}},
      objects:[
        {isMesh:true,receiveShadow:true},
        {isMesh:true,receiveShadow:false},
        {isInstancedMesh:true,receiveShadow:true},
      ],
      traverse(fn){for(const o of this.objects)fn(o);},
    },
    saves:0,
    events:[],
    $:(sel)=>sel==='#reducedEffects'?reducedEffects:null,
    savePreferences(){context.saves++;},
    logEvent(type){context.events.push(type);},
  };
  vm.runInNewContext(`${keep};${fill};${receive};${apply};${arm};${consider};globalThis.armReducedAuto=armReducedAuto;globalThis.considerReducedAuto=considerReducedAuto;globalThis.applyReducedDrawCost=applyReducedDrawCost;globalThis.applyReducedFillCost=applyReducedFillCost;globalThis.applyReducedShadowReceive=applyReducedShadowReceive;globalThis.reducedAtmosphereKeep=reducedAtmosphereKeep`,context);
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
assert.equal(first.context.hellWorld.reduced,true);
assert.equal(first.context.blastWorld.reduced,true);
assert.equal(first.context.tankerSpray.reduced,true);
assert.equal(first.context.plasmaBugs.reduced,true);
assert.equal(first.context.particles.reduced,true);
assert.equal(first.context.atmosphereBatches[0].points.geometry.range,Math.ceil(3400*.12));
assert.equal(first.context.atmosphereBatches[1].points.geometry.range,Math.ceil(1600*.12));
assert.equal(first.context.atmosphereBatches[2].points.geometry.range,0);
assert.equal(first.context.atmosphereBatches[2].points.visible,false);
assert.equal(first.context.atmosphereMaterials[0].uniforms.uReduced.value,1);
assert.equal(first.context.riverLights[0].light.intensity,0);
assert.equal(first.context.rift.userData.fillLight.intensity,0);
assert.equal(first.context.scene.background.hex,0x121820);
assert.equal(first.context.ventPlumes[0].sprite.visible,false);
assert.equal(first.context.scene.objects[0].receiveShadow,false);
assert.equal(first.context.scene.objects[1].receiveShadow,false);
assert.equal(first.context.scene.objects[2].receiveShadow,false);
assert.equal(first.context.shadowReceivers.length,2);
first.context.applyReducedDrawCost(false);
assert.equal(first.context.renderer.shadowMap.autoUpdate,true);
assert.equal(first.context.renderer.shadowMap.enabled,true);
assert.equal(first.context.scene.objects[0].receiveShadow,true);
assert.equal(first.context.scene.objects[1].receiveShadow,false);
assert.equal(first.context.scene.objects[2].receiveShadow,true);
assert.equal(first.context.shadowReceivers.length,0);
assert.equal(first.context.ventPlumes[0].sprite.visible,true);
assert.equal(first.context.hellWorld.reduced,false);
assert.equal(first.context.atmosphereBatches[0].points.geometry.range,3400);
assert.equal(first.context.atmosphereBatches[2].points.visible,true);
assert.equal(first.context.riverLights[0].light.intensity,2400);
assert.equal(first.context.rift.userData.fillLight.intensity,220);
assert.equal(first.context.scene.background.hex,0x110a08);
assert.equal(first.context.atmosphereMaterials[0].uniforms.uReduced.value,0);

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
