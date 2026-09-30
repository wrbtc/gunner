import * as THREE from '../../vendor/three.module.js?v=052';
import {createWorld,WORLD_LAYER,WARDEN,LEVELS} from './world.js?v=ch2-06';
import {createCraft,CRAFT} from './craft.js?v=ch2-06';
import {createCombat,createArsenal,WEAPONS,FX_LAYER} from './combat.js?v=ch2-06';
import {createEnemies,ENEMY_LAYER} from './enemies.js?v=ch2-06';

// Gunner Chapter 02, The Warden: the gunship round. It plays like the AC-130 mission: the
// pilot circles, you work the sensor and three guns. Clear the Warden's five levels and the
// seal behind its head breaks; put a 105 round into the pit to finish.
const $=id=>document.getElementById(id);
const dom={canvas:$('game'),start:$('start'),pause:$('pause'),down:$('down'),hud:$('hud'),hull:$('hullFill'),hullValue:$('hullValue'),
 weapons:$('weapons'),optics:$('optics'),compass:$('compassTape'),opticsMode:$('opticsMode'),opticsZoom:$('opticsZoom'),opticsRange:$('opticsRange'),opticsAngles:$('opticsAngles'),opticsData:$('opticsData'),
 mode:$('mode'),kills:$('kills'),fps:$('fps'),hit:$('hitMarker'),veil:$('veil'),thermal:$('thermalOverlay'),alt:$('altitude'),
 speaker:$('speaker'),line:$('line'),climb:$('climbLevels'),marker:$('climbMarker'),pitState:$('pitState'),done:$('done'),doneStats:$('doneStats')};
const shot=new URLSearchParams(location.search).get('shot')||globalThis.CH2_SHOT||'';

const renderer=new THREE.WebGLRenderer({canvas:dom.canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();
const SKY=new THREE.Color(0xc98a4a),THERMAL_SKY=new THREE.Color(0x2e2c29),THERMAL_FOG=new THREE.Color(0xb3afa7);
scene.background=SKY.clone();
// Light haze: from the orbit the sensor looks 600 to 1,000 m, and the far side must still read.
scene.fog=new THREE.FogExp2(0x9a6a3e,.0006);
const camera=new THREE.PerspectiveCamera(WEAPONS[0].fov,1,1,4000);scene.add(camera);
// The ground burns, so faces turned down catch a warm glow instead of going black.
scene.add(new THREE.HemisphereLight(0xffd9a0,0x5a3419,1.35));
const sun=new THREE.DirectionalLight(0xffc27a,1.6);sun.position.set(-600,900,500);scene.add(sun);

const world=createWorld(scene),combat=createCombat(scene,world),craft=createCraft(scene,world);
const enemies=createEnemies(scene,world,combat),arsenal=createArsenal(combat,craft,enemies);
combat.bind(enemies,craft);
for(const mesh of world.glowing)mesh.layers.set(FX_LAYER);
craft.hurt=(amount)=>{
 if(game.over||shot)return;craft.state.hull=Math.max(0,craft.state.hull-amount);game.hurtFlash=1;
 if(craft.state.hull<50&&!game.warned){game.warned=true;say('Pilot',"We're taking fire. Move the orbit.");}
 if(craft.state.hull<=0)crash();
};

// Thermal: the burning world is hot and glows white; the creatures are cold and read black.
// Black hot is the same picture inverted on the canvas. Mid greys, not white: the lights and
// fog still carve shape and depth into the heat.
const hotMat=new THREE.MeshLambertMaterial({color:0xc6c2ba,emissive:0x5c5a55});
const coldMat=new THREE.MeshBasicMaterial({color:0x050505,fog:false});
const SENSOR_MODES=['wht','blk','tv'],SENSOR_LABEL={wht:'THERMAL · WHT',blk:'THERMAL · BLK',tv:'TV'};
const game={running:false,paused:false,over:false,sensor:'wht',firing:false,time:0,clock:0,hurtFlash:0,kick:0,fpsTime:0,fpsFrames:0,
 speaker:'',callout:'',calloutTime:0,warned:false,started:false};
const keys=new Set(),input={forward:0,strafe:0,lift:0};
const aimPoint=new THREE.Vector3(),aimOrigin=new THREE.Vector3(),aimDir=new THREE.Vector3(),shake=new THREE.Vector3();

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

function readInput(){
 input.forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
 input.strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 input.lift=(keys.has('Space')?1:0)-(keys.has('KeyC')?1:0);
}
const sensorView=()=>craft.state.view==='sensor';
const sensorFov=()=>WEAPONS[arsenal.state.weapon].fov*(craft.state.zoom?.5:1);
// The guns follow the sensor, in either view: this is what the reticle is on.
function updateAimPoint(){
 craft.sensorPos(aimOrigin);aimDir.copy(craft.aimDir());
 const hit=combat.raycast(aimOrigin,aimDir,2600);
 aimPoint.copy(aimOrigin).addScaledVector(aimDir,Math.max(20,Math.min(hit.t,2600)));
 return hit;
}
function render(){
 if(!sensorView()||game.sensor==='tv'){
  camera.layers.set(WORLD_LAYER);camera.layers.enable(ENEMY_LAYER);camera.layers.enable(FX_LAYER);
  renderer.render(scene,camera);return;
 }
 // Three passes that share one depth buffer, so cover still hides a creature. A colour
 // background makes three.js clear on every pass, so only the first pass has one.
 const fog=scene.fog.color.clone(),bg=scene.background;
 scene.background=THERMAL_SKY;scene.fog.color.copy(THERMAL_FOG);
 scene.overrideMaterial=hotMat;camera.layers.set(WORLD_LAYER);renderer.render(scene,camera);
 renderer.autoClear=false;scene.background=null;
 scene.overrideMaterial=coldMat;camera.layers.set(ENEMY_LAYER);renderer.render(scene,camera);
 // Blasts, tracers and the creatures' heads keep their own colour: they burn white.
 scene.overrideMaterial=null;camera.layers.set(FX_LAYER);renderer.render(scene,camera);
 renderer.autoClear=true;scene.background=bg;scene.fog.color.copy(fog);
}
// Compass tape: two turns of ticks so the heading can wrap without a jump.
const TAPE_PX=6;
(function buildCompass(){
 const names={0:'N',90:'E',180:'S',270:'W'};let html='';
 for(let d=0;d<=720;d+=5){
  const h=d%360,x=d*TAPE_PX;html+=`<b class="${h%15?'':'major'}" style="left:${x}px"></b>`;
  if(h%30===0)html+=`<span style="left:${x}px">${names[h]??String(h/10)}</span>`;
 }
 dom.compass.innerHTML=html;
})();
let lastRange=Infinity;
// The climb ladder: the Warden's five levels up a rail, how many are left on each, the
// gunship's altitude, and the pit at the top.
const LADDER_TOP=900,rungs=LEVELS.map(l=>{
 const li=document.createElement('li');li.style.bottom=`${l.y/LADDER_TOP*100}%`;
 li.append(document.createElement('span'),document.createElement('b'));li.firstChild.textContent=l.name;
 dom.climb.append(li);return {li,count:li.lastChild,last:-1};
});
// Subtitles, as on the gunship's radio: the pilot's calls, then the standing order.
function say(speaker,text,time=4){game.speaker=speaker;game.callout=text;game.calloutTime=time;}
function climb(dt){
 const levels=enemies.levels();
 levels.forEach((l,i)=>{
  const r=rungs[i];
  if(l.alive!==r.last){
   if(r.last>0&&!l.alive)say('Pilot',`${LEVELS[i].name} clear.`);
   r.last=l.alive;r.count.textContent=l.alive?String(l.alive):'CLEAR';r.li.classList.toggle('clear',!l.alive);
  }
 });
 // The rung the sensor is looking at lights up.
 const look=LEVELS.reduce((best,l,i)=>Math.abs(aimPoint.y-l.y)<Math.abs(aimPoint.y-LEVELS[best].y)?i:best,0);
 const onWarden=Math.hypot(aimPoint.x-WARDEN.x,aimPoint.z-WARDEN.z)<300&&Math.abs(aimPoint.y-LEVELS[look].y)<60;
 rungs.forEach((r,i)=>r.li.classList.toggle('current',onWarden&&i===look));
 dom.marker.style.bottom=`${THREE.MathUtils.clamp(craft.state.pos.y/LADDER_TOP,0,1)*100}%`;
 if(!world.pit.open&&levels.every(l=>!l.alive)){world.pit.setOpen(true);say('Pilot',"The seal's broken. Take us over the cliff and drop a 105 down the pit.",6);}
 dom.pitState.textContent=world.pit.open?'OPEN':'SEALED';dom.pitState.classList.toggle('open',world.pit.open);
 game.calloutTime=Math.max(0,game.calloutTime-dt);
 const talking=game.calloutTime>0;
 dom.speaker.textContent=talking?`${game.speaker}:`:'';
 dom.line.textContent=talking?game.callout:world.pit.open?'Put a 105 round down the pit behind the head. Circle over the cliff to see into it.':'Clear the Warden, feet to crown. W A S D moves the orbit.';
 dom.line.parentElement.classList.toggle('callout',talking);
}
// Corner readouts, the dense block of numbers on a real sensor feed: time, target grid, orbit.
function opticsData(s){
 const t=new Date(),hh=String(t.getHours()).padStart(2,'0'),mm=String(t.getMinutes()).padStart(2,'0'),ss=String(t.getSeconds()).padStart(2,'0');
 const grid=`${String(Math.round(aimPoint.x+5000)).padStart(5,'0')} ${String(Math.round(aimPoint.z+5000)).padStart(5,'0')}`;
 return `${hh}${mm}${ss}Z\nTGT ${grid}\nALT ${String(Math.round(s.pos.y)).padStart(4,'0')}\nORBIT R${Math.round(s.orbit.radius)}`;
}
function optics(){
 const s=craft.state,on=sensorView(),w=WEAPONS[arsenal.state.weapon];
 dom.optics.hidden=!on;dom.hud.classList.toggle('optics',on);
 dom.canvas.classList.toggle('sensor',on);
 dom.canvas.classList.toggle('thermal',on&&game.sensor!=='tv');dom.canvas.classList.toggle('blk',on&&game.sensor==='blk');
 dom.thermal.hidden=!on||game.sensor==='tv';
 if(!on)return;
 const heading=((-s.aimYaw*180/Math.PI)%360+360)%360;
 dom.compass.style.transform=`translateX(${220-(heading+360)*TAPE_PX}px)`;
 dom.opticsMode.textContent=SENSOR_LABEL[game.sensor];
 dom.opticsZoom.textContent=`${w.label.toUpperCase()} · ${Math.round(WEAPONS[0].fov/sensorFov())}X`;
 dom.optics.dataset.weapon='w'+w.id;
 dom.opticsData.textContent=opticsData(s);
 dom.opticsRange.textContent=Number.isFinite(lastRange)&&lastRange<2600?`RNG ${String(Math.round(lastRange)).padStart(4,'0')} M`:'RNG ---- M';
 const el=Math.round(s.aimPitch*180/Math.PI);
 dom.opticsAngles.textContent=`AZ ${String(Math.round(heading)%360).padStart(3,'0')} · EL ${el>=0?'+':'-'}${String(Math.abs(el)).padStart(2,'0')}`;
}
function hud(dt){
 const s=craft.state,a=arsenal.state;
 dom.hull.style.transform=`scaleX(${s.hull/100})`;dom.hullValue.textContent=Math.ceil(s.hull);
 const rows=dom.weapons.children;
 WEAPONS.forEach((w,i)=>{
  const row=rows[i];row.classList.toggle('active',a.weapon===i);
  const meter=row.querySelector('.meter i'),note=row.querySelector('.note');
  if(w.id==='25'){meter.style.transform=`scaleX(${a.heat})`;row.classList.toggle('hot',a.overheated);note.textContent=a.overheated?'OVERHEAT':'READY';}
  else{const left=a.cooldown[i];meter.style.transform=`scaleX(${1-left/w.cooldown})`;note.textContent=left>0?`${left.toFixed(1)} s`:'READY';}
 });
 dom.mode.textContent=sensorView()?'SENSOR':'OUTSIDE VIEW';
 const k=enemies.kills(),t=enemies.totals();
 dom.kills.textContent=`HURLERS ${k.hurler}/${t.hurler} · LAMPLIGHTERS ${k.lamplighter}/${t.lamplighter}`;
 dom.alt.textContent=`ALT ${Math.round(s.pos.y)} M · ORBIT ${Math.round(s.orbit.radius)} M`;
 climb(dt);
 game.hurtFlash=Math.max(0,game.hurtFlash-dt*2.5);dom.veil.style.opacity=(game.hurtFlash*.55+(1-s.hull/100)*.18).toFixed(3);
 optics();
}
let lastHits=0,lastShots=0;
function pulseHit(){dom.hit.classList.remove('show');void dom.hit.offsetWidth;dom.hit.classList.add('show');}
combat.onImpact=(pos,weapon,struck)=>{
 if(struck)pulseHit();
 // Rounds landing close send the creatures running: wide for the 105, a few metres for the 25.
 enemies.scare(pos,(weapon.radius||4)*2.5+8);
 if(weapon.id==='105'&&world.pit.contains(pos)&&game.running&&!game.over)finish();
};
function frame(dt){
 game.time+=dt;
 if(game.running&&!game.paused&&!game.over){
  readInput();craft.step(dt,input);
  const hit=updateAimPoint();
  arsenal.update(dt,game.firing&&sensorView(),aimPoint);
  enemies.update(dt,craft);
  game.clock+=dt;
  dom.optics.classList.toggle('on-target',hit.kind==='enemy');
  lastRange=hit.t;
 }
 craft.placeCamera(camera,dt,sensorFov());craft.syncModel(game.time);
 const a=arsenal.state;
 if(a.shots!==lastShots){lastShots=a.shots;game.kick=a.weapon===0?1:.4;}
 // The guns shake the sensor: a thump for each shell, a buzz while the 25 runs, a jolt when hit.
 if(sensorView()){
  const buzz=game.firing&&a.weapon===2&&!a.overheated&&game.running&&!game.paused?.0009:0;
  const jolt=game.kick*.006+game.hurtFlash*.004+buzz;
  if(jolt>0){camera.rotateX((Math.random()-.35)*jolt);camera.rotateY((Math.random()-.5)*jolt);}
 }else if(game.hurtFlash>0)camera.position.add(shake.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(game.hurtFlash*.8));
 game.kick=Math.max(0,game.kick-dt*4);
 if(!game.paused)combat.update(dt);
 world.pit.update(game.time);
 if(a.hits!==lastHits){lastHits=a.hits;pulseHit();}
 hud(dt);render();
 game.fpsFrames++;game.fpsTime+=dt;if(game.fpsTime>.5){dom.fps.textContent=`${Math.round(game.fpsFrames/game.fpsTime)} FPS`;game.fpsFrames=0;game.fpsTime=0;}
}
let last=performance.now();
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;frame(dt);requestAnimationFrame(loop);}

function begin(){
 dom.start.hidden=true;dom.down.hidden=true;dom.pause.hidden=true;dom.hud.hidden=false;
 game.running=true;game.paused=false;
 if(!game.started){game.started=true;say('Pilot',"Orbit's set south of the Warden. Clear it, feet to crown.",5);}
 dom.canvas.requestPointerLock?.()?.catch?.(()=>{});
}
function stop(){game.over=true;game.firing=false;craft.state.zoom=false;document.exitPointerLock?.();}
function crash(){stop();dom.down.hidden=false;}
// A 105 into the pit: the end of the round.
function finish(){
 stop();
 const t=Math.round(game.clock),levels=enemies.levels(),city=enemies.list.filter(e=>e.level<0);
 const warden=levels.reduce((n,l)=>n+l.total,0);
 dom.doneStats.textContent=`TIME ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} · HULL ${Math.ceil(craft.state.hull)} · WARDEN ${warden}/${warden} · CITY ${city.filter(e=>!e.alive).length}/${city.length}`;
 dom.done.hidden=false;
}
function restart(){
 craft.reset();enemies.reset();combat.reset();arsenal.reset();world.restorePillars();world.pit.setOpen(false);rungs.forEach(r=>r.last=-1);
 Object.assign(game,{over:false,clock:0,calloutTime:0,warned:false,started:false});dom.done.hidden=true;begin();
}

$('startButton').addEventListener('click',begin);
$('resumeButton').addEventListener('click',begin);
$('restartButton').addEventListener('click',()=>{location.reload();});
$('againButton').addEventListener('click',restart);
dom.canvas.addEventListener('click',()=>{if(game.running&&!game.over&&document.pointerLockElement!==dom.canvas)begin();});
document.addEventListener('pointerlockchange',()=>{
 if(document.pointerLockElement!==dom.canvas&&game.running&&!game.over){game.paused=true;game.firing=false;keys.clear();dom.pause.hidden=false;}
});
// The sensor slews slower the tighter the zoom, so a small hand move is a small move on screen.
addEventListener('mousemove',e=>{
 if(document.pointerLockElement!==dom.canvas||game.paused)return;
 const sens=.0021*sensorFov()/45;craft.slew(e.movementX*sens,e.movementY*sens);
});
addEventListener('mousedown',e=>{
 if(document.pointerLockElement!==dom.canvas)return;
 if(e.button===0)game.firing=true;
 if(e.button===2)craft.state.zoom=true;
});
addEventListener('mouseup',e=>{if(e.button===0)game.firing=false;if(e.button===2)craft.state.zoom=false;});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{if(document.pointerLockElement===dom.canvas)arsenal.select(arsenal.state.weapon+(e.deltaY>0?1:-1));},{passive:true});
addEventListener('keydown',e=>{
 if(e.code==='Space')e.preventDefault();
 keys.add(e.code);
 if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3')arsenal.select(Number(e.code.slice(-1))-1);
 if(e.code==='KeyT'&&!e.repeat)game.sensor=SENSOR_MODES[(SENSOR_MODES.indexOf(game.sensor)+1)%SENSOR_MODES.length];
 if(e.code==='KeyV'&&!e.repeat)craft.state.view=sensorView()?'chase':'sensor';
 if(e.code==='KeyO'&&!e.repeat&&game.running&&!game.over){craft.orbitAt(aimPoint);say('Pilot','Moving the orbit.',2);}
 if(e.code==='KeyR'&&game.over)restart();
});
addEventListener('keyup',e=>keys.delete(e.code));

// Proof shots for screenshots: a fixed orbit and sensor aim, creatures stepped out, no input.
const SOUTH=[0,-260],OVER=[0,-560];
const SHOTS={
 sensor:{center:SOUTH,angle:.3,look:[0,405,-690],weapon:0,expose:true},
 bridges:{center:SOUTH,angle:.1,look:[-40,312,-504],weapon:1,expose:true},
 hall:{center:SOUTH,angle:.2,look:[0,407,-676],weapon:2,zoom:true,expose:true},
 blackhot:{center:SOUTH,angle:.5,look:[0,84,-508],weapon:1,mode:'blk',expose:true},
 tv:{center:SOUTH,angle:.3,look:[0,330,-640],weapon:0,mode:'tv',expose:true},
 towers:{center:OVER,angle:2.4,look:[150,546,-740],weapon:1,expose:true},
 crown:{center:OVER,angle:1.9,look:[0,618,-732],weapon:2,expose:true},
 pit:{center:[0,-600],angle:-1.45,look:[0,300,-925],weapon:0,pit:true},
 outside:{center:SOUTH,angle:1.25,outside:true},
 overhead:{center:OVER,angle:1.55,outside:true}
};
function applyShot(name){
 const cfg=SHOTS[name];if(!cfg)return false;
 craft.setOrbit({center:cfg.center,angle:cfg.angle});
 const s=craft.state;s.view=cfg.outside?'chase':'sensor';s.zoom=!!cfg.zoom;
 if(cfg.look)craft.lookAt(new THREE.Vector3(...cfg.look));
 arsenal.select(cfg.weapon||0);game.sensor=cfg.mode||'wht';
 if(cfg.pit)world.pit.setOpen(true);
 if(cfg.expose)enemies.exposeAll(s.pos,1);
 dom.start.hidden=true;dom.hud.hidden=false;
 camera.fov=cfg.outside?CRAFT.chaseFov:sensorFov();
 craft.placeCamera(camera,0,sensorFov());craft.syncModel(0);lastRange=updateAimPoint().t;
 for(let i=0;i<3;i++)combat.update(0);
 hud(0);render();return true;
}
globalThis.__CH2__={THREE,renderer,scene,camera,world,craft,enemies,combat,arsenal,game,applyShot,render,
 info:()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,world:world.stats(),enemies:enemies.list.length,fx:combat.stats()})};
if(shot)applyShot(shot);
requestAnimationFrame(loop);
