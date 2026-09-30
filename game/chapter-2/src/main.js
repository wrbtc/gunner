import * as THREE from '../../vendor/three.module.js?v=052';
import {createWorld,WORLD_LAYER,WARDEN,LEVELS} from './world.js?v=ch2-04';
import {createCraft,CRAFT} from './craft.js?v=ch2-04';
import {createCombat,createArsenal,WEAPONS,FX_LAYER} from './combat.js?v=ch2-04';
import {createEnemies,ENEMY_LAYER} from './enemies.js?v=ch2-04';
import {createGunRig,GUN_LAYER} from './gun-rig.js?v=ch2-04';

// Gunner Chapter 02, The Warden: round 2 test flight. The Warden roughed out at full size,
// the Satoshi on lift fans, and the climb: clear its five levels and the pit opens.
const $=id=>document.getElementById(id);
const dom={canvas:$('game'),start:$('start'),pause:$('pause'),down:$('down'),hud:$('hud'),hull:$('hullFill'),hullValue:$('hullValue'),
 weapons:$('weapons'),optics:$('optics'),compass:$('compassTape'),opticsMode:$('opticsMode'),opticsZoom:$('opticsZoom'),opticsRange:$('opticsRange'),opticsAngles:$('opticsAngles'),opticsData:$('opticsData'),mode:$('mode'),kills:$('kills'),fps:$('fps'),reticle:$('reticle'),hit:$('hitMarker'),veil:$('veil'),thermal:$('thermalOverlay'),alt:$('altitude'),
 objective:$('objective'),climb:$('climbLevels'),marker:$('climbMarker'),pitState:$('pitState'),done:$('done'),doneStats:$('doneStats')};
const shot=new URLSearchParams(location.search).get('shot')||globalThis.CH2_SHOT||'';

const renderer=new THREE.WebGLRenderer({canvas:dom.canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();
// Thermal sky is cold, so dark; hot air and distance fade the world to a mid grey.
const SKY=new THREE.Color(0xc98a4a),THERMAL_SKY=new THREE.Color(0x3a3834),THERMAL_FOG=new THREE.Color(0x85817a);
scene.background=SKY.clone();
scene.fog=new THREE.FogExp2(0x9a6a3e,.0011);
const camera=new THREE.PerspectiveCamera(CRAFT.seatFov,1,.12,4000);scene.add(camera);
// The ground burns, so faces turned down catch a warm glow instead of going black.
const hemi=new THREE.HemisphereLight(0xffd9a0,0x5a3419,1.35);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffc27a,1.6);sun.position.set(-600,900,500);scene.add(sun);
// Lights are culled by camera layers too: they must also light the seat guns' pass.
for(const light of [hemi,sun])light.layers.enable(GUN_LAYER);
const gunRig=createGunRig(camera);

const world=createWorld(scene),combat=createCombat(scene,world),craft=createCraft(scene,world);
const enemies=createEnemies(scene,world,combat),arsenal=createArsenal(combat,craft,enemies);
combat.bind(enemies,craft);
craft.hurt=(amount)=>{if(game.over||shot)return;craft.state.hull=Math.max(0,craft.state.hull-amount);game.hurtFlash=1;if(craft.state.hull<=0)crash();};

// Thermal: the world is hot, so it glows white; the creatures are cold, so they are black.
// Mid greys, not white: the lights and fog still carve shape and depth into the heat.
const hotMat=new THREE.MeshLambertMaterial({color:0xa9a59d,emissive:0x4a4843});
const coldMat=new THREE.MeshBasicMaterial({color:0x050505,fog:false});
const game={running:false,paused:false,over:false,thermal:false,firing:false,time:0,clock:0,hurtFlash:0,fpsTime:0,fpsFrames:0,callout:'',calloutTime:0};
const keys=new Set(),input={forward:0,strafe:0,lift:0};
const aimPoint=new THREE.Vector3(),centerRay=new THREE.Vector3(),hudTmp=new THREE.Vector3();

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

function readInput(){
 input.forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
 input.strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 input.lift=(keys.has('Space')?1:0)-(keys.has('KeyC')?1:0);
}
function updateAimPoint(){
 camera.getWorldDirection(centerRay);
 const hit=combat.raycast(camera.position,centerRay,1500);
 aimPoint.copy(camera.position).addScaledVector(centerRay,Math.max(20,hit.t));
 return hit;
}
function renderGuns(){
 if(!gunRig.rig.visible)return;
 const bg=scene.background;scene.background=null;
 renderer.autoClear=false;renderer.clearDepth();camera.layers.set(GUN_LAYER);renderer.render(scene,camera);
 renderer.autoClear=true;scene.background=bg;
}
function render(){
 gunRig.setVisible(craft.state.view==='seat'&&!craft.state.gunCam);
 if(!game.thermal){
  camera.layers.set(WORLD_LAYER);camera.layers.enable(ENEMY_LAYER);camera.layers.enable(FX_LAYER);
  renderer.render(scene,camera);renderGuns();return;
 }
 // Three passes that share one depth buffer, so cover still hides a creature. A colour
 // background makes three.js clear on every pass, so only the first pass has one.
 const fog=scene.fog.color.clone(),bg=scene.background;
 scene.background=THERMAL_SKY;scene.fog.color.copy(THERMAL_FOG);
 scene.overrideMaterial=hotMat;camera.layers.set(WORLD_LAYER);renderer.render(scene,camera);
 renderer.autoClear=false;scene.background=null;
 scene.overrideMaterial=coldMat;camera.layers.set(ENEMY_LAYER);renderer.render(scene,camera);
 scene.overrideMaterial=null;camera.layers.set(FX_LAYER);renderer.render(scene,camera);
 renderer.autoClear=true;scene.background=bg;scene.fog.color.copy(fog);
 renderGuns();
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
// The climb ladder: the Warden's five levels up a rail, how many are left on each, where you
// are, and the pit at the top.
const LADDER_TOP=680,rungs=LEVELS.map(l=>{
 const li=document.createElement('li');li.style.bottom=`${l.y/LADDER_TOP*100}%`;
 li.append(document.createElement('span'),document.createElement('b'));li.firstChild.textContent=l.name;
 dom.climb.append(li);return {li,count:li.lastChild,last:-1};
});
function callout(text){game.callout=text.toUpperCase();game.calloutTime=3;}
function climb(dt){
 const s=craft.state,levels=enemies.levels(),near=Math.hypot(s.pos.x-WARDEN.x,s.pos.z-WARDEN.z)<480;
 let current=-1,best=120;
 LEVELS.forEach((l,i)=>{const d=Math.abs(s.pos.y-l.y);if(near&&d<best){best=d;current=i;}});
 levels.forEach((l,i)=>{
  const r=rungs[i];
  if(l.alive!==r.last){
   if(r.last>0&&!l.alive)callout(`${LEVELS[i].name} clear`);
   r.last=l.alive;r.count.textContent=l.alive?String(l.alive):'CLEAR';r.li.classList.toggle('clear',!l.alive);
  }
  r.li.classList.toggle('current',i===current);
 });
 dom.marker.style.bottom=`${THREE.MathUtils.clamp(s.pos.y/LADDER_TOP,0,1)*100}%`;
 if(!world.pit.open&&levels.every(l=>!l.alive)){world.pit.setOpen(true);callout('The pit is open');}
 dom.pitState.textContent=world.pit.open?'OPEN':'SEALED';dom.pitState.classList.toggle('open',world.pit.open);
 game.calloutTime=Math.max(0,game.calloutTime-dt);
 dom.objective.textContent=game.calloutTime>0?game.callout:world.pit.open?'THE PIT IS OPEN · OVER THE CROWN AND DOWN BEHIND THE HEAD':'CLIMB THE WARDEN · CLEAR ALL FIVE LEVELS';
 dom.objective.classList.toggle('callout',game.calloutTime>0);
}
// Corner readouts, the dense block of numbers on a real sensor feed: time, target grid, orbit.
function opticsData(s){
 const t=new Date(),hh=String(t.getHours()).padStart(2,'0'),mm=String(t.getMinutes()).padStart(2,'0'),ss=String(t.getSeconds()).padStart(2,'0');
 const grid=`${String(Math.round(aimPoint.x+5000)).padStart(5,'0')} ${String(Math.round(aimPoint.z+5000)).padStart(5,'0')}`;
 return `${hh}${mm}${ss}Z\nTGT ${grid}\nALT ${String(Math.round(s.pos.y)).padStart(4,'0')}\n${s.orbit?`ORBIT R${Math.round(s.orbit.radius)}`:'MANUAL'}`;
}
function optics(){
 const s=craft.state,on=s.gunCam;
 dom.optics.hidden=!on;dom.hud.classList.toggle('optics',on);dom.canvas.classList.toggle('optics',on);
 if(!on)return;
 const heading=((-s.aimYaw*180/Math.PI)%360+360)%360;
 dom.compass.style.transform=`translateX(${220-(heading+360)*TAPE_PX}px)`;
 // White hot: the burning world glows white and the cold creatures read black.
 dom.opticsMode.textContent=game.thermal?'WHT':'TV';
 dom.opticsZoom.textContent=`${WEAPONS[s.weapon].label.toUpperCase()} · ${Math.round(CRAFT.seatFov/CRAFT.optics[s.weapon][s.zoom])}X`;
 dom.optics.dataset.weapon=WEAPONS[s.weapon].id;
 dom.opticsData.textContent=opticsData(s);
 dom.opticsRange.textContent=Number.isFinite(lastRange)&&lastRange<1500?`RNG ${String(Math.round(lastRange)).padStart(4,'0')} M`:'RNG ---- M';
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
  if(i===0){meter.style.transform=`scaleX(${a.heat})`;row.classList.toggle('hot',a.overheated);note.textContent=a.overheated?'OVERHEAT':'READY';}
  if(i===1){const k=1-a.cannonCooldown/2.2;meter.style.transform=`scaleX(${a.weapon===1?k:1})`;note.textContent=a.cannonCooldown>0&&a.weapon===1?a.cannonCooldown.toFixed(1)+' s':'READY';}
  if(i===2){meter.style.transform=`scaleX(${a.lances/4})`;note.textContent=`${a.lances} / 4`;}
 });
 dom.mode.textContent=(s.gunCam?'GUN CAMERA':s.view==='seat'?'GUNNER SEAT':'OUTSIDE VIEW')+(game.thermal?' · THERMAL':'')+(s.orbit?' · PILOT ORBITING':'');
 dom.mode.classList.toggle('thermal',game.thermal);
 const k=enemies.kills(),t=enemies.totals();
 dom.kills.textContent=`HURLERS ${k.hurler}/${t.hurler} · LAMPLIGHTERS ${k.lamplighter}/${t.lamplighter}`;
 dom.alt.textContent=`ALT ${Math.round(s.pos.y)} M`;
 climb(dt);
 game.hurtFlash=Math.max(0,game.hurtFlash-dt*2.5);dom.veil.style.opacity=(game.hurtFlash*.55+(1-s.hull/100)*.18).toFixed(3);
 dom.thermal.hidden=!game.thermal||s.gunCam;dom.canvas.classList.toggle('thermal',game.thermal);
 dom.reticle.classList.toggle('gun',s.gunCam);
 optics();
}
let lastHits=0,lastShots=0;
function frame(dt){
 game.time+=dt;
 if(game.running&&!game.paused&&!game.over){
  readInput();craft.state.weapon=arsenal.state.weapon;craft.step(dt,input);
  const hit=updateAimPoint();
  arsenal.update(dt,game.firing,aimPoint);
  enemies.update(dt,craft);
  game.clock+=dt;if(world.pit.contains(craft.state.pos))finish();
  dom.reticle.classList.toggle('on-target',hit.kind==='enemy');dom.optics.classList.toggle('on-target',hit.kind==='enemy');
  lastRange=hit.t;
 }
 craft.placeCamera(camera,dt);craft.syncModel(game.time);
 // A hit shakes the seat.
 if(game.hurtFlash>0&&craft.state.view==='seat')camera.position.add(hudTmp.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(game.hurtFlash*.5));
 const a=arsenal.state;gunRig.update(dt,{firing:game.firing&&game.running&&!game.paused,gatling:a.weapon===0,overheated:a.overheated});
 if(a.shots!==lastShots){lastShots=a.shots;gunRig.shot();}
 if(!game.paused)combat.update(dt,aimPoint);
 world.pit.update(game.time);
 if(arsenal.state.hits!==lastHits){lastHits=arsenal.state.hits;dom.hit.classList.remove('show');void dom.hit.offsetWidth;dom.hit.classList.add('show');}
 hud(dt);render();
 game.fpsFrames++;game.fpsTime+=dt;if(game.fpsTime>.5){dom.fps.textContent=`${Math.round(game.fpsFrames/game.fpsTime)} FPS`;game.fpsFrames=0;game.fpsTime=0;}
}
let last=performance.now();
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;frame(dt);requestAnimationFrame(loop);}

function begin(){
 dom.start.hidden=true;dom.down.hidden=true;dom.pause.hidden=true;dom.hud.hidden=false;
 game.running=true;game.paused=false;
 dom.canvas.requestPointerLock?.()?.catch?.(()=>{});
}
function crash(){game.over=true;game.firing=false;craft.state.gunCam=false;document.exitPointerLock?.();dom.down.hidden=false;}
// Down into the pit: the end of the round.
function finish(){
 game.over=true;game.firing=false;craft.state.gunCam=false;document.exitPointerLock?.();
 const t=Math.round(game.clock),levels=enemies.levels(),city=enemies.list.filter(e=>e.level<0);
 const warden=levels.reduce((n,l)=>n+l.total,0);
 dom.doneStats.textContent=`TIME ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} · HULL ${Math.ceil(craft.state.hull)} · WARDEN ${warden}/${warden} · CITY ${city.filter(e=>!e.alive).length}/${city.length}`;
 dom.done.hidden=false;
}
function restart(){
 craft.reset();enemies.reset();combat.reset();arsenal.reset();world.restorePillars();world.pit.setOpen(false);rungs.forEach(r=>r.last=-1);
 Object.assign(game,{over:false,clock:0,calloutTime:0});dom.done.hidden=true;begin();
}
function setThermal(on){game.thermal=on;}

$('startButton').addEventListener('click',begin);
$('resumeButton').addEventListener('click',begin);
$('restartButton').addEventListener('click',()=>{location.reload();});
$('againButton').addEventListener('click',restart);
dom.canvas.addEventListener('click',()=>{if(game.running&&!game.over&&document.pointerLockElement!==dom.canvas)begin();});
document.addEventListener('pointerlockchange',()=>{
 if(document.pointerLockElement!==dom.canvas&&game.running&&!game.over){game.paused=true;game.firing=false;keys.clear();dom.pause.hidden=false;}
});
addEventListener('mousemove',e=>{
 if(document.pointerLockElement!==dom.canvas||game.paused)return;
 const s=craft.state,sens=.0021*(s.gunCam?CRAFT.optics[s.weapon][s.zoom]/CRAFT.seatFov*1.4:1);
 s.aimYaw-=e.movementX*sens;s.aimPitch=THREE.MathUtils.clamp(s.aimPitch-e.movementY*sens,CRAFT.pitchMin,CRAFT.pitchMax);
});
addEventListener('mousedown',e=>{
 if(document.pointerLockElement!==dom.canvas)return;
 if(e.button===0)game.firing=true;
 if(e.button===2)craft.state.gunCam=true;
});
addEventListener('mouseup',e=>{if(e.button===0)game.firing=false;if(e.button===2)craft.state.gunCam=false;});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{if(document.pointerLockElement===dom.canvas)arsenal.select(arsenal.state.weapon+(e.deltaY>0?1:-1));},{passive:true});
addEventListener('keydown',e=>{
 if(e.code==='Space')e.preventDefault();
 keys.add(e.code);
 if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3')arsenal.select(Number(e.code.slice(-1))-1);
 if(e.code==='KeyT'&&!e.repeat)setThermal(!game.thermal);
 if(e.code==='KeyV'&&!e.repeat)craft.state.view=craft.state.view==='seat'?'chase':'seat';
 if(e.code==='KeyF'&&!e.repeat)craft.state.zoom=(craft.state.zoom+1)%2;
 if(e.code==='KeyO'&&!e.repeat&&game.running){if(craft.state.orbit)craft.state.orbit=null;else craft.startOrbit(aimPoint);}
 if(e.code==='KeyR'&&game.over)restart();
});
addEventListener('keyup',e=>keys.delete(e.code));

// Proof shots for screenshots: fixed positions, creatures stepped out, no input needed.
const SHOTS={
 city:{pos:[40,46,760],yaw:0,pitch:.05},
 warden:{pos:[30,250,100],yaw:-.04,pitch:.1,outside:true,lift:1},
 satoshi:{pos:[-40,330,-260],yaw:0,pitch:-.04,heading:-.75,outside:true,expose:true,lift:1},
 seat:{pos:[60,300,-240],yaw:-.05,pitch:.14,expose:true},
 bridges:{pos:[150,330,-400],look:[-40,318,-506],expose:true},
 hall:{pos:[70,428,-560],look:[0,412,-672],expose:true},
 towers:{pos:[270,565,-660],look:[150,548,-740],expose:true,outside:true},
 crown:{pos:[70,690,-610],look:[0,622,-732],expose:true,outside:true},
 pit:{pos:[0,790,-700],look:[0,380,-930],outside:true,pit:true},
 guncam:{pos:[70,428,-540],look:[0,412,-672],gun:true,expose:true},
 thermal:{pos:[70,428,-540],look:[0,412,-672],gun:true,thermal:true,expose:true},
 thermalwide:{pos:[60,330,-300],yaw:-.05,pitch:.1,thermal:true,expose:true},
 lance:{pos:[-40,520,-420],look:[-150,548,-740],gun:true,thermal:true,expose:true,weapon:2}
};
function applyShot(name){
 const cfg=SHOTS[name];if(!cfg)return false;
 const s=craft.state;s.pos.set(...cfg.pos);
 if(cfg.look){const d=new THREE.Vector3(...cfg.look).sub(s.pos);cfg.yaw=Math.atan2(-d.x,-d.z);cfg.pitch=Math.asin(d.y/d.length());}
 s.aimYaw=s.heading=cfg.yaw;s.aimPitch=cfg.pitch;s.gunCam=!!cfg.gun;s.view=cfg.outside?'chase':'seat';s.zoom=cfg.zoom||0;
 if(cfg.heading!==undefined)s.heading=cfg.heading;s.lift=cfg.lift||0;if(cfg.pit)world.pit.setOpen(true);
 if(cfg.weapon)arsenal.select(cfg.weapon);s.weapon=arsenal.state.weapon;
 setThermal(!!cfg.thermal);
 if(cfg.expose)enemies.exposeAll(s.pos,1);
 dom.start.hidden=true;dom.hud.hidden=false;
 camera.fov=s.gunCam?CRAFT.optics[s.weapon][s.zoom]:s.view==='seat'?CRAFT.seatFov:CRAFT.chaseFov;
 craft.placeCamera(camera,0);craft.syncModel(0);lastRange=updateAimPoint().t;
 if(cfg.fire){for(let i=0;i<8;i++){arsenal.update(1/60,true,aimPoint);combat.update(1/60,aimPoint);}gunRig.update(1/60,{firing:true,gatling:true});}
 for(let i=0;i<3;i++)combat.update(0,aimPoint);
 hud(0);render();return true;
}
globalThis.__CH2__={THREE,renderer,scene,camera,world,craft,enemies,combat,arsenal,game,applyShot,
 info:()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,world:world.stats(),enemies:enemies.list.length,fx:combat.stats()})};
if(shot)applyShot(shot);
requestAnimationFrame(loop);
