import * as THREE from '../../vendor/three.module.js?v=052';
import {createWorld,WORLD_LAYER,WARDEN,LEVELS} from './world.js?v=ch2-01';
import {createCraft,CRAFT} from './craft.js?v=ch2-02';
import {createCombat,createArsenal,WEAPONS,FX_LAYER} from './combat.js?v=ch2-02';
import {createEnemies,ENEMY_LAYER} from './enemies.js?v=ch2-01';
import {createGunRig,GUN_LAYER} from './gun-rig.js?v=ch2-02';

// Gunner Chapter 02, The Warden: round 1 test flight. Grey boxes, real controls.
const $=id=>document.getElementById(id);
const dom={canvas:$('game'),start:$('start'),pause:$('pause'),down:$('down'),hud:$('hud'),hull:$('hullFill'),hullValue:$('hullValue'),
 weapons:$('weapons'),optics:$('optics'),compass:$('compassTape'),opticsMode:$('opticsMode'),opticsZoom:$('opticsZoom'),opticsRange:$('opticsRange'),opticsAngles:$('opticsAngles'),mode:$('mode'),kills:$('kills'),fps:$('fps'),reticle:$('reticle'),hit:$('hitMarker'),veil:$('veil'),thermal:$('thermalOverlay'),alt:$('altitude'),level:$('levelName')};
const shot=new URLSearchParams(location.search).get('shot')||globalThis.CH2_SHOT||'';

const renderer=new THREE.WebGLRenderer({canvas:dom.canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();
// Thermal sky is cold, so dark; hot air and distance fade the world to a mid grey.
const SKY=new THREE.Color(0xc98a4a),THERMAL_SKY=new THREE.Color(0x3a3834),THERMAL_FOG=new THREE.Color(0x85817a);
scene.background=SKY.clone();
scene.fog=new THREE.FogExp2(0x9a6a3e,.0011);
const camera=new THREE.PerspectiveCamera(CRAFT.seatFov,1,.12,4000);scene.add(camera);
const hemi=new THREE.HemisphereLight(0xffd9a0,0x2a1a10,1.35);scene.add(hemi);
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
const game={running:false,paused:false,over:false,thermal:false,firing:false,time:0,hurtFlash:0,fpsTime:0,fpsFrames:0};
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
function optics(){
 const s=craft.state,on=s.gunCam;
 dom.optics.hidden=!on;dom.hud.classList.toggle('optics',on);dom.canvas.classList.toggle('optics',on);
 if(!on)return;
 const heading=((-s.aimYaw*180/Math.PI)%360+360)%360;
 dom.compass.style.transform=`translateX(${220-(heading+360)*TAPE_PX}px)`;
 dom.opticsMode.textContent=game.thermal?'THERMAL':'TV';
 dom.opticsZoom.textContent=`ZOOM ${Math.round(CRAFT.seatFov/CRAFT.gunFovs[s.zoom])}X`;
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
 dom.mode.textContent=(s.gunCam?'GUN CAMERA':s.view==='seat'?'GUNNER SEAT':'OUTSIDE VIEW')+(game.thermal?' · THERMAL':'');
 dom.mode.classList.toggle('thermal',game.thermal);
 const k=enemies.kills(),t=enemies.totals();
 dom.kills.textContent=`HURLERS ${k.hurler}/${t.hurler} · LAMPLIGHTERS ${k.lamplighter}/${t.lamplighter}`;
 dom.alt.textContent=`ALT ${Math.round(s.pos.y)} M`;
 const level=[...LEVELS].reverse().find(l=>s.pos.y>=l.y-20&&Math.hypot(s.pos.x-WARDEN.x,s.pos.z-WARDEN.z)<420);
 dom.level.textContent=level?level.name.toUpperCase():'';
 game.hurtFlash=Math.max(0,game.hurtFlash-dt*2.5);dom.veil.style.opacity=(game.hurtFlash*.55+(1-s.hull/100)*.18).toFixed(3);
 dom.thermal.hidden=!game.thermal;dom.canvas.classList.toggle('thermal',game.thermal);
 dom.reticle.classList.toggle('gun',s.gunCam);
 optics();
}
let lastHits=0,lastShots=0;
function frame(dt){
 game.time+=dt;
 if(game.running&&!game.paused&&!game.over){
  readInput();craft.step(dt,input);
  const hit=updateAimPoint();
  arsenal.update(dt,game.firing,aimPoint);
  enemies.update(dt,craft);
  dom.reticle.classList.toggle('on-target',hit.kind==='enemy');dom.optics.classList.toggle('on-target',hit.kind==='enemy');
  lastRange=hit.t;
 }
 craft.placeCamera(camera,dt);craft.syncModel(game.time);
 // A hit shakes the seat.
 if(game.hurtFlash>0&&craft.state.view==='seat')camera.position.add(hudTmp.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(game.hurtFlash*.5));
 const a=arsenal.state;gunRig.update(dt,{firing:game.firing&&game.running&&!game.paused,gatling:a.weapon===0,overheated:a.overheated});
 if(a.shots!==lastShots){lastShots=a.shots;gunRig.shot();}
 if(!game.paused)combat.update(dt,aimPoint);
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
function restart(){craft.reset();enemies.reset();combat.reset();arsenal.reset();world.pillars.forEach(p=>{if(p.hp<=0){p.hp=260;p.collider.alive=true;}});game.over=false;begin();}
function setThermal(on){game.thermal=on;}

$('startButton').addEventListener('click',begin);
$('resumeButton').addEventListener('click',begin);
$('restartButton').addEventListener('click',()=>{location.reload();});
dom.canvas.addEventListener('click',()=>{if(game.running&&!game.over&&document.pointerLockElement!==dom.canvas)begin();});
document.addEventListener('pointerlockchange',()=>{
 if(document.pointerLockElement!==dom.canvas&&game.running&&!game.over){game.paused=true;game.firing=false;keys.clear();dom.pause.hidden=false;}
});
addEventListener('mousemove',e=>{
 if(document.pointerLockElement!==dom.canvas||game.paused)return;
 const s=craft.state,sens=.0021*(s.gunCam?CRAFT.gunFovs[s.zoom]/CRAFT.seatFov*1.4:1);
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
 if(e.code==='KeyF'&&!e.repeat)craft.state.zoom=(craft.state.zoom+1)%CRAFT.gunFovs.length;
 if(e.code==='KeyR'&&game.over)restart();
});
addEventListener('keyup',e=>keys.delete(e.code));

// Proof shots for screenshots: fixed positions, creatures stepped out, no input needed.
const SHOTS={
 city:{pos:[40,46,760],yaw:0,pitch:.05},
 seat:{pos:[70,300,-300],yaw:-.08,pitch:-.12,expose:true},
 seatfire:{pos:[60,262,-330],look:[-20,236,-620],expose:true,fire:true},
 chase:{pos:[70,300,-300],yaw:-.08,pitch:-.12,expose:true,outside:true},
 guncam:{pos:[60,262,-330],look:[-20,236,-620],gun:true,expose:true},
 thermal:{pos:[60,262,-330],look:[-20,236,-620],gun:true,thermal:true,expose:true},
 apache:{pos:[-40,420,-260],look:[-60,226,-612],gun:true,thermal:true,expose:true,zoom:0},
 thermalwide:{pos:[70,300,-300],yaw:-.08,pitch:-.12,thermal:true,expose:true},
 thermalseat:{pos:[60,262,-330],look:[-20,236,-620],thermal:true,expose:true},
 climb:{pos:[-230,470,-500],yaw:-.75,pitch:.08,expose:true}
};
function applyShot(name){
 const cfg=SHOTS[name];if(!cfg)return false;
 const s=craft.state;s.pos.set(...cfg.pos);
 if(cfg.look){const d=new THREE.Vector3(...cfg.look).sub(s.pos);cfg.yaw=Math.atan2(-d.x,-d.z);cfg.pitch=Math.asin(d.y/d.length());}
 s.aimYaw=s.heading=cfg.yaw;s.aimPitch=cfg.pitch;s.gunCam=!!cfg.gun;s.view=cfg.outside?'chase':'seat';s.zoom=cfg.zoom||0;
 setThermal(!!cfg.thermal);
 if(cfg.expose)enemies.exposeAll(s.pos,1);
 dom.start.hidden=true;dom.hud.hidden=false;
 camera.fov=s.gunCam?CRAFT.gunFovs[s.zoom]:s.view==='seat'?CRAFT.seatFov:CRAFT.chaseFov;
 craft.placeCamera(camera,0);craft.syncModel(0);lastRange=updateAimPoint().t;
 if(cfg.fire){for(let i=0;i<8;i++){arsenal.update(1/60,true,aimPoint);combat.update(1/60,aimPoint);}gunRig.update(1/60,{firing:true,gatling:true});}
 for(let i=0;i<3;i++)combat.update(0,aimPoint);
 hud(0);render();return true;
}
globalThis.__CH2__={THREE,renderer,scene,camera,world,craft,enemies,combat,arsenal,game,applyShot,
 info:()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,world:world.stats(),enemies:enemies.list.length,fx:combat.stats()})};
if(shot)applyShot(shot);
requestAnimationFrame(loop);
