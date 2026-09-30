import * as THREE from '../../vendor/three.module.js?v=052';
import {createWorld,WORLD_LAYER,WARDEN,LEVELS} from './world.js?v=ch2-08';
import {createCraft,CRAFT} from './craft.js?v=ch2-08';
import {createCombat,createArsenal,WEAPONS,FX_LAYER} from './combat.js?v=ch2-08';
import {createEnemies,ENEMY_LAYER} from './enemies.js?v=ch2-08';
import {createSurvivors} from './survivors.js?v=ch2-08';
import {createHorde} from './horde.js?v=ch2-08';

// Gunner Chapter 02, The Warden: downtown, on a clear afternoon. It plays like the AC-130
// mission: the pilot circles, you work the sensor and three guns, and a team on the ground
// depends on you. Cover four survivors up the grand avenue to the statue, hold the plaza while
// you clear its five levels, then get them round the plinth to the crater it came out of.
const $=id=>document.getElementById(id);
const dom={canvas:$('game'),start:$('start'),pause:$('pause'),down:$('down'),hud:$('hud'),hull:$('hullFill'),hullValue:$('hullValue'),
 weapons:$('weapons'),optics:$('optics'),compass:$('compassTape'),opticsMode:$('opticsMode'),opticsZoom:$('opticsZoom'),opticsRange:$('opticsRange'),opticsAngles:$('opticsAngles'),opticsData:$('opticsData'),
 mode:$('mode'),kills:$('kills'),fps:$('fps'),hit:$('hitMarker'),veil:$('veil'),thermal:$('thermalOverlay'),alt:$('altitude'),
 speaker:$('speaker'),line:$('line'),climb:$('climbLevels'),marker:$('climbMarker'),pitState:$('pitState'),done:$('done'),doneStats:$('doneStats'),
 team:$('team'),downTitle:$('downTitle'),downText:$('downText'),orbitMark:$('orbitMark'),helpStrip:$('helpStrip')};
const shot=new URLSearchParams(location.search).get('shot')||globalThis.CH2_SHOT||'';

const renderer=new THREE.WebGLRenderer({canvas:dom.canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();
// A clear afternoon: blue sky, a light haze only far out, and a low sun from the south-west
// throwing long shadows down the avenues. The city never moves, so its shadows are drawn once.
const SKY=new THREE.Color(0xa9cdef),THERMAL_SKY=new THREE.Color(0x1d1d1c),THERMAL_FOG=new THREE.Color(0x6e6c67);
scene.background=SKY.clone();
scene.fog=new THREE.FogExp2(0xc4d7e8,.00034);
const SKY_LAYER=5;
(function skyDome(){
 const geometry=new THREE.SphereGeometry(3600,32,16),colors=[],top=new THREE.Color(0x4f8fd6),rim=new THREE.Color(0xd3e4f2),c=new THREE.Color();
 const position=geometry.getAttribute('position');
 for(let i=0;i<position.count;i++){c.copy(rim).lerp(top,Math.pow(Math.max(0,position.getY(i)/3600),.55));colors.push(c.r,c.g,c.b);}
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const dome=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
 dome.name='Sky';dome.renderOrder=-1;dome.layers.set(SKY_LAYER);scene.add(dome);
})();
const camera=new THREE.PerspectiveCamera(WEAPONS[0].fov,1,1,5000);scene.add(camera);
scene.add(new THREE.HemisphereLight(0xc6ddff,0x8c806c,1.05));
const sun=new THREE.DirectionalLight(0xfff0d4,2.3);sun.position.set(-1150,1300,1000);scene.add(sun,sun.target);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-.0004;sun.shadow.normalBias=.6;
Object.assign(sun.shadow.camera,{left:-1550,right:1550,top:1550,bottom:-1550,near:100,far:4200});sun.shadow.camera.updateProjectionMatrix();

const world=createWorld(scene),combat=createCombat(scene,world),craft=createCraft(scene,world);
const enemies=createEnemies(scene,world,combat),arsenal=createArsenal(combat,craft,enemies);
combat.bind(enemies,craft);
const survivors=createSurvivors(scene,combat),horde=createHorde(scene,world,combat,survivors,craft);
survivors.friendly=true;combat.addTargets(horde);combat.addTargets(survivors);
// The statue's garrison sleeps until the team reaches the plaza.
enemies.dormant=true;
for(const mesh of world.glowing)mesh.layers.set(FX_LAYER);
// The sun's shadows are drawn once; draw them again when the Warden's sculpt arrives.
world.onSculpt=()=>{renderer.shadowMap.needsUpdate=true;};
// Radio for the special infected: a jumper crouching while we circle low, a bloater bursting by the team.
let lastJumperCall=-99;
horde.onCrouch=()=>{
 if(shot||game.time-lastJumperCall<20||craft.state.pos.y>450)return;lastJumperCall=game.time;
 say('Pilot','Jumpers on the rooftops! Get some height.',3);if(craft.state.orbiting)craft.state.orbit.alt=Math.max(craft.state.orbit.alt,520);
};
horde.onBurst=e=>{if(shot)return;survivors.centerOf(teamPos);if(e.pos.distanceTo(teamPos)<30)say('Vega','Bloater! Get back!',2.5);};
survivors.onDown=p=>{if(!shot)say(survivors.alive()?'Vega':'Pilot',survivors.alive()?`${p.name} is down!`:'We lost the team.',3);};
craft.hurt=(amount)=>{
 if(game.over||shot)return;craft.state.hull=Math.max(0,craft.state.hull-amount);game.hurtFlash=1;
 if(craft.state.hull<50&&!game.warned){game.warned=true;say('Pilot',"We're taking fire. Move the orbit.");}
 if(craft.state.hull<=0)crash();
};

// Thermal, as on the gunship: warm bodies burn white on a grey city; sunlit stone runs warmer
// than shade, so the shadows still show. Black hot is the same picture inverted on the canvas.
const hotMat=new THREE.MeshLambertMaterial({color:0x76746e,emissive:0x232220});
const coldMat=new THREE.MeshBasicMaterial({color:0xf4f2ec,fog:false});
// Heat bloom: a soft glow round every warm body, drawn only through thermal, so a 2 m figure
// at 700 m still reads as a point of heat. Buildings in front hide it, as they hide the body.
const HALO_LAYER=6,HALO_MAX=220;
const halos=(()=>{
 const size=64,canvas=globalThis.document?.createElement('canvas');
 let map=null;
 if(canvas){
  canvas.width=canvas.height=size;const g=canvas.getContext('2d'),grad=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  grad.addColorStop(0,'rgba(255,255,255,.9)');grad.addColorStop(.35,'rgba(255,255,255,.35)');grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grad;g.fillRect(0,0,size,size);map=new THREE.CanvasTexture(canvas);
 }
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map,color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}),HALO_MAX);
 mesh.layers.set(HALO_LAYER);mesh.frustumCulled=false;mesh.name='Heat bloom';scene.add(mesh);
 const m=new THREE.Matrix4(),p=new THREE.Vector3(),sc=new THREE.Vector3();
 return {update(){
  let n=0;
  const add=(group,e,size)=>{if(n>=HALO_MAX||!e.alive)return;group.center(e,p);m.compose(p,camera.quaternion,sc.set(size,size,size));mesh.setMatrixAt(n++,m);};
  for(const e of horde.list)add(horde,e,e.height*2.2);
  for(const e of enemies.list)add(enemies,e,e.height*1.6);
  for(const e of survivors.list)add(survivors,e,e.height*2.2);
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
 }};
})();
const SENSOR_MODES=['wht','blk','tv'],SENSOR_LABEL={wht:'THERMAL · WHT',blk:'THERMAL · BLK',tv:'TV'};
const game={running:false,paused:false,over:false,sensor:'wht',firing:false,time:0,clock:0,hurtFlash:0,kick:0,fpsTime:0,fpsFrames:0,
 speaker:'',callout:'',calloutTime:0,warned:false,started:false,stage:'escort',waveLeg:1,trickle:8,holding:false};
const keys=new Set(),input={forward:0,strafe:0,lift:0};
const aimPoint=new THREE.Vector3(),aimOrigin=new THREE.Vector3(),aimDir=new THREE.Vector3(),shake=new THREE.Vector3(),trackPoint=new THREE.Vector3();

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
  camera.layers.set(WORLD_LAYER);camera.layers.enable(ENEMY_LAYER);camera.layers.enable(FX_LAYER);camera.layers.enable(SKY_LAYER);
  renderer.render(scene,camera);return;
 }
 // Three passes that share one depth buffer, so cover still hides a creature. A colour
 // background makes three.js clear on every pass, so only the first pass has one.
 const fog=scene.fog.color.clone(),bg=scene.background;
 scene.background=THERMAL_SKY;scene.fog.color.copy(THERMAL_FOG);
 scene.overrideMaterial=hotMat;camera.layers.set(WORLD_LAYER);renderer.render(scene,camera);
 renderer.autoClear=false;scene.background=null;
 scene.overrideMaterial=coldMat;camera.layers.set(ENEMY_LAYER);renderer.render(scene,camera);
 scene.overrideMaterial=null;halos.update();camera.layers.set(HALO_LAYER);renderer.render(scene,camera);
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
 if(game.hintAt&&game.time>game.hintAt){game.hintAt=0;say('Pilot','You have control. W A S D fly where you look, Space and C for height, let go to hover. Press O and I will circle your target.',8);}
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
 if(!world.pit.open&&levels.every(l=>!l.alive))world.pit.setOpen(true);
 dom.pitState.textContent=world.pit.open?'OPEN':'SEALED';dom.pitState.classList.toggle('open',world.pit.open);
 game.calloutTime=Math.max(0,game.calloutTime-dt);
 const talking=game.calloutTime>0;
 dom.speaker.textContent=talking?`${game.speaker}:`:'';
 dom.line.textContent=talking?game.callout:ORDERS[game.stage];
 dom.line.parentElement.classList.toggle('callout',talking);
}
// The standing order for each stage, shown whenever nobody is talking.
const ORDERS={escort:'Cover the team up the avenue. Keep the cross streets clear.',warden:'Clear the Warden, feet to crown, while the team holds the plaza.',
 crater:'Cover the team round the plinth to the crater.'};
// The team panel: a name and a health bar for each survivor.
const teamRows=survivors.list.map(p=>{
 const li=document.createElement('li');li.append(document.createElement('span'),document.createElement('i'));
 li.firstChild.textContent=p.name.toUpperCase();li.lastChild.append(document.createElement('b'));dom.team.append(li);return li;
});
const teamPos=new THREE.Vector3(),pick=lines=>lines[Math.floor(Math.random()*lines.length)];
// The mission: a wave as the team reaches each stretch of the avenue and a trickle between, the
// garrison awake once they hold the plaza, the crater leg when the seal breaks, and the end
// when they get there or all four are down.
function mission(dt){
 const team=survivors.team;survivors.centerOf(teamPos);
 if(!survivors.alive()){teamLost();return;}
 if(game.stage==='escort'){
  if(team.leg>game.waveLeg){
   game.waveLeg=team.leg;horde.wave(teamPos,6+team.leg*2,team.leg>=3&&team.leg%2?1:0,team.leg>=3?1:0);
   if(team.leg>=2)horde.perch(teamPos,2);
   if(team.leg%2===0)say('Pilot','Movement in the cross streets ahead of them.',3);
  }
  if(team.arrived){game.stage='warden';enemies.dormant=false;horde.perch(teamPos,3);say('Vega',"We're at the statue. Clear those ledges, we'll hold the plaza.",6);}
 }else if(game.stage==='warden'){
  if(world.pit.open){game.stage='crater';survivors.headForCrater();horde.wave(teamPos,14,2,2);say('Vega',"Seal's broken. Moving round to the crater, cover us.",6);}
 }else if(game.stage==='crater'&&team.arrived){finish();return;}
 game.trickle-=dt;
 if(game.trickle<=0){game.trickle=game.stage==='escort'?11:8;horde.wave(teamPos,game.stage==='escort'?3:4,0,Math.random()<.25?1:0);}
 if(team.holding&&!game.holding)say('Vega',pick(['Contact! Holding.',"They're on us!",'Holding here. Clear them out!']),2.5);
 game.holding=team.holding;
}
// Corner readouts, the dense block of numbers on a real sensor feed: time, target grid, orbit.
function opticsData(s){
 const t=new Date(),hh=String(t.getHours()).padStart(2,'0'),mm=String(t.getMinutes()).padStart(2,'0'),ss=String(t.getSeconds()).padStart(2,'0');
 const grid=`${String(Math.round(aimPoint.x+5000)).padStart(5,'0')} ${String(Math.round(aimPoint.z+5000)).padStart(5,'0')}`;
 return `${hh}${mm}${ss}Z\nTGT ${grid}\nALT ${String(Math.round(s.pos.y)).padStart(4,'0')}\n${s.orbiting?`ORBIT R${Math.round(s.orbit.radius)}`:`SPD ${String(Math.round(Math.hypot(s.vel.x,s.vel.z))).padStart(3,'0')}`}${combat.guiding()?'\nMSL GUIDING':''}`;
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
 // While a missile flies, the brackets blink: keep the spot under the cross until it lands.
 dom.optics.classList.toggle('guiding',combat.guiding()>0);
 dom.opticsData.textContent=opticsData(s);
 dom.opticsRange.textContent=Number.isFinite(lastRange)&&lastRange<2600?`RNG ${String(Math.round(lastRange)).padStart(4,'0')} M`:'RNG ---- M';
 const el=Math.round(s.aimPitch*180/Math.PI);
 dom.opticsAngles.textContent=`AZ ${String(Math.round(heading)%360).padStart(3,'0')} · EL ${el>=0?'+':'-'}${String(Math.abs(el)).padStart(2,'0')}`;
}
// The ORBIT diamond: while the pilot has the stick, the point it circles, on the ground.
const orbitMark=new THREE.Vector3();
function orbitMarker(){
 const o=craft.state.orbit;orbitMark.copy(o.center).project(camera);
 const on=craft.state.orbiting&&sensorView()&&orbitMark.z<1&&Math.abs(orbitMark.x)<.96&&Math.abs(orbitMark.y)<.92;
 dom.orbitMark.hidden=!on;
 if(on)dom.orbitMark.style.transform=`translate(${(orbitMark.x*.5+.5)*innerWidth}px,${(-orbitMark.y*.5+.5)*innerHeight}px)`;
}
function hud(dt){
 const s=craft.state,a=arsenal.state;orbitMarker();
 dom.helpStrip.hidden=!(game.running&&game.clock<30);
 dom.hull.style.transform=`scaleX(${s.hull/100})`;dom.hullValue.textContent=Math.ceil(s.hull);
 const rows=dom.weapons.children;
 WEAPONS.forEach((_,i)=>{
  const row=rows[i];row.classList.toggle('active',a.weapon===i);
  const meter=row.querySelector('.meter i'),note=row.querySelector('.note'),st=arsenal.status(i);
  meter.style.transform=`scaleX(${st.fill})`;row.classList.toggle('hot',st.hot);note.textContent=st.note;
 });
 dom.mode.textContent=sensorView()?'SENSOR':'OUTSIDE VIEW';
 const k=enemies.kills(),t=enemies.totals(),warden=k.hurler+k.lamplighter;
 dom.kills.textContent=`INFECTED ${horde.kills()} · WARDEN ${warden}/${t.hurler+t.lamplighter}`;
 survivors.list.forEach((p,i)=>{teamRows[i].classList.toggle('down',!p.alive);teamRows[i].classList.toggle('hurt',p.hitFlash>0);teamRows[i].lastChild.firstChild.style.transform=`scaleX(${p.hp/100})`;});
 dom.alt.textContent=`ALT ${Math.round(s.pos.y)} M · ${s.orbiting?'PILOT ORBIT':'MANUAL'}`;
 climb(dt);
 game.hurtFlash=Math.max(0,game.hurtFlash-dt*2.5);dom.veil.style.opacity=(game.hurtFlash*.55+(1-s.hull/100)*.18).toFixed(3);
 optics();
}
let lastHits=0,lastShots=0;
function pulseHit(){dom.hit.classList.remove('show');void dom.hit.offsetWidth;dom.hit.classList.add('show');}
combat.viewer=camera;
combat.onImpact=(pos,weapon,struck)=>{
 if(struck)pulseHit();
 // Rounds landing close send the creatures running: wide for a missile, a few metres for the 30 mm.
 enemies.scare(pos,(weapon.radius||4)*2.5+8);
};
function frame(dt){
 game.time+=dt;
 if(game.running&&!game.paused&&!game.over){
  readInput();craft.step(dt,input);
  const slewed=!!(slew.x||slew.y);
  if(slewed){craft.slew(slew.x,slew.y);slew.x=slew.y=0;}
  const hit=updateAimPoint();
  // The lock moves only with the mouse: a building passing in front doesn't steal it, the
  // sensor keeps pointing at your spot until the helicopter comes round and it clears.
  if(slewed||!craft.state.track)craft.state.track=hit.t<2600?trackPoint.copy(aimPoint):null;
  arsenal.update(dt,game.firing&&sensorView(),aimPoint);
  enemies.update(dt,craft);survivors.update(dt,horde);horde.update(dt);mission(dt);
  game.clock+=dt;
  dom.optics.classList.toggle('on-target',hit.kind==='enemy');
  lastRange=hit.t;
 }
 craft.placeCamera(camera,dt,sensorFov());if(shotCam)shotCam();craft.syncModel(game.time);
 const a=arsenal.state;
 if(a.shots!==lastShots){lastShots=a.shots;game.kick=a.weapon===0?1:a.weapon===1?.6:.35;}
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
 if(!game.started){game.started=true;game.hintAt=game.time+6.2;say('Vega','Gunship, this is Vega. Four of us, moving up the avenue to the statue. Watch the side streets.',6);}
 dom.canvas.requestPointerLock?.()?.catch?.(()=>{});
}
function stop(){game.over=true;game.firing=false;craft.state.zoom=false;document.exitPointerLock?.();}
function crash(){stop();dom.downTitle.textContent='Going down';dom.downText.textContent='The Satoshi took too much. Press R or start again.';dom.down.hidden=false;}
function teamLost(){stop();dom.downTitle.textContent='The team is down';dom.downText.textContent='Nobody made it to the crater. Press R or start again.';dom.down.hidden=false;}
// The team at the crater's rim: the end of the round.
function finish(){
 stop();
 const t=Math.round(game.clock);
 dom.doneStats.textContent=`TIME ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} · TEAM ${survivors.alive()}/4 · INFECTED ${horde.kills()} · HULL ${Math.ceil(craft.state.hull)}`;
 dom.done.hidden=false;
}
function restart(){
 craft.reset();enemies.reset();combat.reset();arsenal.reset();survivors.reset();horde.reset();world.restorePillars();world.pit.setOpen(false);rungs.forEach(r=>r.last=-1);
 enemies.dormant=true;
 Object.assign(game,{over:false,clock:0,calloutTime:0,warned:false,started:false,stage:'escort',waveLeg:1,trickle:8,holding:false});dom.done.hidden=true;begin();
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
// Mouse moves are gathered and applied once a frame, after the helicopter has moved and the sensor
// has re-locked on its spot, so the hand always has the last word.
const slew={x:0,y:0};
addEventListener('mousemove',e=>{
 if(document.pointerLockElement!==dom.canvas||game.paused)return;
 const sens=.0021*sensorFov()/45;slew.x+=e.movementX*sens;slew.y+=e.movementY*sens;
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
 if(e.code==='KeyO'&&!e.repeat&&game.running&&!game.over){
  if(craft.state.orbiting){craft.state.orbiting=false;say('Pilot','You have control.',2);}
  else{craft.orbitAt(aimPoint);say('Pilot','Circling your target. Touch the controls and she is yours.',3);}
 }
 if(e.code==='KeyR'&&game.over)restart();
});
addEventListener('keyup',e=>keys.delete(e.code));

// Proof shots for screenshots: a fixed orbit and sensor aim, creatures stepped out, no input.
const SOUTH=[0,440],OVER=[0,140];
const SHOTS={
 sensor:{center:SOUTH,angle:.3,look:[-60,445,150],weapon:0,expose:true},
 bridges:{center:SOUTH,angle:.1,look:[-60,312,186],weapon:1,expose:true},
 hall:{center:SOUTH,angle:.2,look:[-60,445,150],weapon:2,zoom:true,expose:true},
 blackhot:{center:SOUTH,angle:.5,look:[0,84,192],weapon:1,mode:'blk',expose:true},
 tv:{center:SOUTH,angle:.3,look:[0,330,60],weapon:0,mode:'tv',expose:true},
 towers:{center:OVER,angle:2.4,look:[62,535,12],weapon:1,expose:true},
 crown:{center:OVER,angle:1.9,look:[-60,580,82],weapon:2,expose:true},
 pit:{center:[0,40],angle:-1.3,look:[0,-130,-230],weapon:0,pit:true},
 outside:{center:SOUTH,angle:1.25,outside:true},
 avenue:{center:[0,640],angle:1.35,outside:true},
 street:{center:[0,640],angle:.25,look:[0,0,560],weapon:0,mode:'tv',expose:true},
 overhead:{center:OVER,angle:1.55,outside:true},
 // The escort: a wave pouring out of the cross streets toward the team at the south end.
 escort:{center:[0,700],angle:.25,look:[0,1,985],weapon:1,wave:22,run:4},
 escortzoom:{center:[0,700],angle:.25,look:[0,1,985],weapon:2,zoom:true,wave:22,run:4},
 escortwide:{center:[0,700],angle:.25,look:[0,1,960],weapon:0,wave:26,run:5},
 escorttv:{center:[0,700],angle:.25,look:[0,1,975],weapon:1,mode:'tv',wave:22,run:4},
 plaza:{center:[0,440],angle:.35,look:[0,1,268],weapon:1,team:[0,268],wave:20,run:5},
 cast:{center:[0,700],angle:.25,look:[0,1,960],weapon:2,zoom:true,mode:'tv',wave:26,run:5},
 plazatv:{center:[0,440],angle:.35,look:[0,1,292],weapon:2,zoom:true,mode:'tv',team:[0,268],wave:30,run:7},
 plazawht:{center:[0,440],angle:.35,look:[0,1,292],weapon:2,mode:'wht',team:[0,268],wave:30,run:7},
 // One of each, standing on the open plaza, for checking the models.
 lineup:{center:[0,560],angle:1.35,alt:260,look:[0,2,262],weapon:2,zoom:true,mode:'tv',team:[-12,256],lineup:true},
 // The helicopter itself, hovering low over the avenue: a camera off its nose, off its side,
 // and the ordinary outside view over the team. cam is [right, up, ahead] of the aircraft.
 heli:{center:[0,900],angle:1.35,alt:150,outside:true,tilt:-.1,cam:[14,4,18]},
 heliside:{center:[0,900],angle:1.35,alt:150,outside:true,cam:[26,3,-2]},
 // The Warden from the avenue, from the east, and its face, with a camera of its own.
 warden:{center:[0,900],angle:1.35,alt:150,outside:true,view:{from:[40,180,880],to:[-30,330,0],fov:50}},
 wardenside:{center:[0,900],angle:1.35,alt:150,outside:true,view:{from:[760,260,180],to:[-20,320,0],fov:50}},
 wardenface:{center:[0,900],angle:1.35,alt:150,outside:true,view:{from:[-20,470,460],to:[-48,525,110],fov:30}},
 wardentv:{center:SOUTH,angle:.3,look:[-60,520,60],weapon:0,mode:'tv',expose:true},
 helichase:{center:[0,1180],angle:1.45,alt:140,outside:true,tilt:-.12,look:[0,1,985],team:[0,985],wave:22,run:4},
 // Weapons in flight: fire, then step the world a moment so the smoke has drawn out.
 missile:{center:[0,1180],angle:1.45,alt:140,look:[0,1,905],weapon:0,team:[0,985],wave:22,run:4,fire:[.05,1.1]},
 rockets:{center:[0,1180],angle:1.45,alt:140,look:[0,1,905],weapon:1,team:[0,985],wave:22,run:4,fire:[.9,.35]},
 rocketsout:{center:[0,1180],angle:1.45,alt:140,outside:true,look:[0,1,905],weapon:1,team:[0,985],wave:22,run:4,fire:[.9,.35]},
 gun:{center:[0,1180],angle:1.45,alt:140,look:[0,1,905],weapon:2,zoom:true,team:[0,985],wave:22,run:4,fire:[.6,.05]}
};
let shotCam=null;
function applyShot(name){
 const cfg=SHOTS[name];if(!cfg)return false;
 craft.setOrbit({center:cfg.center,angle:cfg.angle,alt:cfg.alt});
 const s=craft.state;s.view=cfg.outside?'chase':'sensor';s.zoom=!!cfg.zoom;
 s.tilt=cfg.tilt||0;
 if(cfg.view){
  const {from,to,fov}=cfg.view;
  shotCam=()=>{camera.position.set(...from);camera.fov=fov;camera.updateProjectionMatrix();camera.lookAt(...to);};
 }
 if(cfg.cam){
  const [r,u,f]=cfg.cam;
  shotCam=()=>{const h=s.heading,sin=Math.sin(h),cos=Math.cos(h);
   camera.position.set(s.pos.x+cos*r-sin*f,s.pos.y+u,s.pos.z-sin*r-cos*f);camera.lookAt(s.pos);};
 }
 if(cfg.look)craft.lookAt(new THREE.Vector3(...cfg.look));
 arsenal.select(cfg.weapon||0);game.sensor=cfg.mode||'wht';
 if(cfg.pit)world.pit.setOpen(true);
 if(cfg.expose)enemies.exposeAll(s.pos,1);
 if(cfg.team)survivors.placeAt(...cfg.team);
 if(cfg.lineup){
  [['runner',-4],['leaper',0],['bloater',4.5],['brute',10]].forEach(([type,x])=>horde.spawn(type,x,262));
  const pose=()=>{horde.sync(.4);survivors.sync(.4);render();};horde.ready.then(pose);survivors.ready.then(pose);
 }
 if(cfg.wave){
  survivors.centerOf(teamPos);horde.wave(teamPos,cfg.wave,1);
  const loop=()=>{for(let i=0;i<cfg.run*30;i++)horde.update(1/30);survivors.sync();render();};
  horde.ready.then(loop);loop();
 }
 dom.start.hidden=true;dom.hud.hidden=false;
 camera.fov=cfg.outside?CRAFT.chaseFov:sensorFov();
 craft.placeCamera(camera,0,sensorFov());craft.syncModel(0);lastRange=updateAimPoint().t;
 if(cfg.fire){
  // Hold the trigger for the first span, then let the rounds fly for the second.
  const [hold,fly]=cfg.fire;
  for(let t=0;t<hold+fly;t+=1/60){arsenal.update(1/60,t<hold,aimPoint);combat.update(1/60);}
 }
 for(let i=0;i<3;i++)combat.update(0);
 hud(0);render();return true;
}
globalThis.__CH2__={THREE,renderer,scene,camera,world,craft,enemies,survivors,horde,combat,arsenal,game,applyShot,render,
 info:()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,world:world.stats(),enemies:enemies.list.length,fx:combat.stats()})};
if(shot)applyShot(shot);
requestAnimationFrame(loop);
