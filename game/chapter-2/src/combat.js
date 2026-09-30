import * as THREE from '../../vendor/three.module.js?v=052';

export const FX_LAYER=3;
const GRAVITY=30;

// Fixed pools, one draw each: rocks, bolts, shells, blasts, tracers.
function pool(scene,geometry,material,size,name){
 const mesh=new THREE.InstancedMesh(geometry,material,size);mesh.name=name;mesh.frustumCulled=false;
 mesh.layers.set(FX_LAYER);scene.add(mesh);
 const items=Array.from({length:size},()=>({live:false,pos:new THREE.Vector3(),vel:new THREE.Vector3(),age:0,life:0,scale:1,extra:null}));
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),zero=new THREE.Matrix4().makeScale(0,0,0),look=new THREE.Vector3(),fwd=new THREE.Vector3(0,0,1);
 return {mesh,items,
  spawn(){const it=items.find(i=>!i.live);if(!it)return null;it.live=true;it.age=0;it.scale=1;it.extra=null;return it;},
  sync(orient=false,face=null){
   items.forEach((it,i)=>{
    if(!it.live){mesh.setMatrixAt(i,zero);return;}
    if(face)q.copy(face);else if(orient&&it.vel.lengthSq()>1e-6)q.setFromUnitVectors(fwd,look.copy(it.vel).normalize());else q.identity();
    mesh.setMatrixAt(i,m.compose(it.pos,q,s.setScalar(it.scale)));
   });
   mesh.instanceMatrix.needsUpdate=true;
  }};
}

// The helicopter's three weapons, as on the Apache: each has its own sensor zoom.
// The missile leaves the outer pod and flies where the sensor points for as long as you hold
// it there, so you steer it in. Rockets ripple from the inner pods, 14 to a load, unguided.
// The 30 mm chin gun fires small bursting rounds and heats up.
export const WEAPONS=Object.freeze([
 {id:'missile',label:'Missile',key:'1',launch:60,speed:240,turn:2.6,radius:26,damage:420,pillar:999,cooldown:4,fov:40,scale:1.4,smoke:1.5},
 {id:'rockets',label:'Rockets',key:'2',launch:160,speed:340,radius:7,damage:90,pillar:120,rate:.15,load:14,reload:5,spread:.01,fov:20,scale:.75,smoke:.7},
 {id:'gun',label:'30 mm',key:'3',rate:.1,damage:14,radius:3,splash:8,heat:.065,fov:10}
]);

// A soft round dot, built in code so it needs no image: white, its alpha falling to the edge.
function softDot(){
 const n=32,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const r=Math.min(1,Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1)),i=(y*n+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.pow(1-r,1.7)*255);
 }
 const texture=new THREE.DataTexture(data,n,n);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 return texture;
}

export function createCombat(scene,world){
 const rocks=pool(scene,new THREE.DodecahedronGeometry(1.2),new THREE.MeshLambertMaterial({color:0x7a6a55,emissive:0x3a1a08}),40,'Thrown rubble');
 const bolts=pool(scene,new THREE.CapsuleGeometry(.35,4,2,6).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff2b0}),60,'Lamplighter bolts');
 const shells=pool(scene,new THREE.CapsuleGeometry(.4,2.2,2,6).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffe0a0}),40,'Missiles and rockets');
 // Motor smoke: a soft puff every couple of metres behind each missile and rocket, turned to
 // face the camera, swelling, then gone.
 const smoke=pool(scene,new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:softDot(),color:0xd2cdc1,transparent:true,opacity:.42,depthWrite:false}),520,'Motor smoke');
 const blasts=pool(scene,new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}),40,'Blasts');
 const TRACERS=48,tracerPos=new Float32Array(TRACERS*6),tracerAge=new Float32Array(TRACERS).fill(9);let tracerNext=0;
 const tracerGeo=new THREE.BufferGeometry();tracerGeo.setAttribute('position',new THREE.BufferAttribute(tracerPos,3));
 const tracers=new THREE.LineSegments(tracerGeo,new THREE.LineBasicMaterial({color:0xffd27a,transparent:true,opacity:.9}));
 tracers.frustumCulled=false;tracers.layers.set(FX_LAYER);tracers.name='Gatling tracers';scene.add(tracers);
 let enemies=null,craft=null;
 // Everything shots can strike: the statue's garrison, the street horde, and the survivors,
 // who take your rounds as hard as anything else.
 const groups=[];
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),rayCenter=new THREE.Vector3(),rayOffset=new THREE.Vector3();
 const laser=new THREE.Vector3(),want=new THREE.Vector3(),turn=new THREE.Quaternion(),still=new THREE.Quaternion();
 // The camera the smoke turns to face; main hands it in.
 const api={onImpact:null,viewer:null};

 // First thing a ray meets: an enemy, a pillar or wall, or the ground.
 function raycast(origin,direction,far,{hitEnemies=true}={}){
  const box=world.rayHit(origin,direction,far);
  let best=box.index<0?{t:far,kind:'none',index:-1}:{t:box.t,kind:world.colliders[box.index].kind,index:box.index};
  // The street, except where the crater opens in it.
  if(direction.y<0){const t=-origin.y/direction.y;if(t>0&&t<best.t&&!world.overPit(origin.x+direction.x*t,origin.z+direction.z*t))best={t,kind:'ground',index:-1};}
  if(hitEnemies)for(const group of groups)for(const e of group.list){
   if(!e.alive)continue;
   // Own scratch vectors: callers pass the shared tmp/dir vectors in as origin and direction.
   const c=group.center(e,rayCenter),oc=rayOffset.subVectors(origin,c),b=oc.dot(direction),cc=oc.lengthSq()-e.radius*e.radius,h=b*b-cc;
   if(h<0)continue;const t=-b-Math.sqrt(h);if(t>0&&t<best.t)best={t,kind:group.friendly?'friendly':'enemy',index:e.index,group};
  }
  return best;
 }
 function blast(pos,radius,life=.45){const b=blasts.spawn();if(!b)return;b.pos.copy(pos);b.extra={radius};b.life=life;b.scale=.1;}
 // Damages everything in reach and returns how many creatures it struck.
 function splash(pos,radius,damage,pillarDamage){
  let struck=0;
  for(const group of groups)for(const e of group.list){
   if(!e.alive)continue;const d=group.center(e,tmp).distanceTo(pos);
   if(d<radius+e.radius){group.damage(e,damage*(1-.6*Math.min(1,d/radius)));if(!group.friendly)struck++;}
  }
  world.pillars.forEach((pl,i)=>{if(pl.hp>0&&tmp.copy(pl.pos).setY(pl.pos.y+5.5).distanceTo(pos)<radius+2)world.damagePillar(i,pillarDamage);});
  return struck;
 }
 function tracer(a,b){const i=tracerNext++%TRACERS;tracerPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);tracerAge[i]=0;}
 function hitsWorld(p){
  if(p.y<=0&&!world.overPit(p.x,p.z))return true;
  return !!world.pointHit(p);
 }
 function update(dt){
  const craftPos=craft.state.pos;
  for(const r of rocks.items){
   if(!r.live)continue;r.age+=dt;r.vel.y-=GRAVITY*dt;r.pos.addScaledVector(r.vel,dt);
   if(r.pos.distanceTo(craftPos)<7){r.live=false;craft.hurt(14,r.pos);blast(r.pos,4);continue;}
   const team=groups.find(g=>g.friendly);let struckTeam=false;
   if(team)for(const p of team.list)if(p.alive&&team.center(p,tmp).distanceTo(r.pos)<1.6+r.scale){team.damage(p,10*r.scale);struckTeam=true;}
   if(struckTeam){r.live=false;blast(r.pos,2*r.scale,.3);continue;}
   if(r.age>9||hitsWorld(r.pos)){r.live=false;blast(r.pos,3,.35);}
  }
  for(const b of bolts.items){
   if(!b.live)continue;b.age+=dt;b.pos.addScaledVector(b.vel,dt);
   if(b.pos.distanceTo(craftPos)<6){b.live=false;craft.hurt(7,b.pos);blast(b.pos,3,.3);continue;}
   if(b.age>5||hitsWorld(b.pos))b.live=false;
  }
  // Motors burn up from the launch speed to full speed in under a second. The missile drops
  // clear of its rail for a moment, then turns toward the spot the sensor marks.
  for(const s of shells.items){
   if(!s.live)continue;s.age+=dt;
   const w=s.extra,speed=Math.min(w.speed,w.launch+(w.speed-w.launch)*s.age/.8);dir.copy(s.vel).normalize();
   if(w.turn&&s.age>.25){
    want.subVectors(laser,s.pos).normalize();turn.setFromUnitVectors(dir,want);
    const angle=dir.angleTo(want),most=w.turn*dt;if(angle>most)turn.copy(still.slerp(turn,most/angle));still.identity();
    dir.applyQuaternion(turn);
   }
   s.vel.copy(dir).multiplyScalar(speed);
   const step=speed*dt,hit=raycast(s.pos,dir,step);
   if(hit.kind!=='none'){
    s.pos.addScaledVector(dir,hit.t);s.live=false;
    const struck=splash(s.pos,w.radius,w.damage,w.pillar);blast(s.pos,w.radius*1.1,w.turn?1.1:.55);
    if(w.turn)blast(tmp.copy(s.pos).setY(s.pos.y+w.radius*.4),w.radius*.7,1.6);
    api.onImpact?.(s.pos,w,struck);continue;
   }
   s.pos.addScaledVector(dir,step);
   s.puff=(s.puff||0)+step;
   while(s.puff>2){s.puff-=2;const p=smoke.spawn();if(!p)break;p.pos.copy(s.pos).addScaledVector(dir,-1.6-s.puff);p.life=w.smoke*(.8+Math.random()*.4);p.extra=w.smoke;p.scale=.01;}
   if(s.age>12)s.live=false;
  }
  for(const p of smoke.items){
   if(!p.live)continue;p.age+=dt;const k=p.age/p.life;
   if(k>=1){p.live=false;continue;}
   p.pos.y+=dt*.8;p.scale=p.extra*(.5+1.6*Math.sqrt(k))*(1-k*k*k);
  }
  for(const b of blasts.items){
   if(!b.live)continue;b.age+=dt;const k=b.age/b.life;
   b.scale=b.extra.radius*(.35+.65*Math.sqrt(k));if(k>=1)b.live=false;
  }
  for(let i=0;i<TRACERS;i++){tracerAge[i]+=dt;if(tracerAge[i]>.06)tracerPos.fill(0,i*6,i*6+6);}
  tracerGeo.attributes.position.needsUpdate=true;
  rocks.sync();bolts.sync(true);shells.sync(true);blasts.sync();smoke.sync(false,api.viewer?.quaternion);
 }
 return Object.assign(api,{raycast,blast,splash,tracer,update,
  bind(e,c){enemies=e;craft=c;groups.push(e);},
  addTargets(group){groups.push(group);},
  throwRock(origin,vel,scale=1){const r=rocks.spawn();if(r){r.pos.copy(origin);r.vel.copy(vel);r.scale=scale;}},
  fireBolt(origin,vel){const b=bolts.spawn();if(b){b.pos.copy(origin);b.vel.copy(vel);}},
  fireShell(origin,direction,weapon){const s=shells.spawn();if(!s)return false;s.pos.copy(origin);s.vel.copy(direction).setLength(weapon.launch);s.extra=weapon;s.scale=weapon.scale;s.puff=0;return true;},
  // The spot the sensor marks this frame: the missiles in the air fly to it.
  designate(point){laser.copy(point);},
  guiding(){return shells.items.filter(s=>s.live&&s.extra.turn).length;},
  reset(){for(const p of [rocks,bolts,shells,blasts,smoke])p.items.forEach(i=>i.live=false);},
  stats(){return {rocks:rocks.items.filter(i=>i.live).length,bolts:bolts.items.filter(i=>i.live).length,shells:shells.items.filter(i=>i.live).length,smoke:smoke.items.filter(i=>i.live).length};}});
}

// 1 is the missile (one at a time, a long reload), 2 the rockets (hold to ripple them, then
// the pods reload), 3 the 30 mm (hold to fire, it heats up).
export function createArsenal(combat,craft,enemies){
 const [MISSILE,ROCKETS,GUN]=WEAPONS;
 const fresh=()=>({weapon:0,heat:0,overheated:false,gunClock:0,rocketClock:0,cooldown:0,rockets:ROCKETS.load,reload:0,side:1,hits:0,shots:0});
 const s=fresh();
 const muzzle=new THREE.Vector3(),dir=new THREE.Vector3(),end=new THREE.Vector3();
 const aimFrom=(point,spread)=>{
  dir.subVectors(point,muzzle).normalize();
  if(spread){dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();}
  return dir;
 };
 function update(dt,firing,aimPoint){
  combat.designate(aimPoint);
  s.cooldown=Math.max(0,s.cooldown-dt);
  if(s.reload>0){s.reload=Math.max(0,s.reload-dt);if(!s.reload)s.rockets=ROCKETS.load;}
  s.heat=Math.max(0,s.heat-dt*(s.overheated?.5:.4));if(s.overheated&&s.heat<.3)s.overheated=false;
  // The clocks only run while the trigger is held, so a pause never banks a burst.
  const w=WEAPONS[s.weapon];
  if(!firing||w!==GUN)s.gunClock=0;
  if(!firing||w!==ROCKETS)s.rocketClock=0;
  if(!firing)return;
  if(w===GUN){
   s.gunClock-=dt;craft.muzzle(muzzle,2,0);
   while(s.gunClock<=0&&!s.overheated){
    s.gunClock+=w.rate;s.heat+=w.heat;if(s.heat>=1){s.heat=1;s.overheated=true;}
    aimFrom(aimPoint,.004);
    const hit=combat.raycast(muzzle,dir,2600);
    end.copy(muzzle).addScaledVector(dir,Math.min(hit.t,2600));
    combat.tracer(muzzle,end);s.shots++;
    if(hit.kind==='enemy'||hit.kind==='friendly'){hit.group.damage(hit.group.list[hit.index],w.damage);if(hit.kind==='enemy')s.hits++;}
    if(hit.kind!=='none'){combat.splash(end,w.radius,w.splash,3);combat.blast(end,2.6,.18);combat.onImpact?.(end,w,0);}
   }
  }else if(w===ROCKETS){
   s.rocketClock-=dt;
   while(s.rocketClock<=0&&s.rockets>0){
    s.rocketClock+=w.rate;s.side=-s.side;craft.muzzle(muzzle,1,s.side);
    if(!combat.fireShell(muzzle,aimFrom(aimPoint,w.spread),w))break;
    s.shots++;if(--s.rockets===0)s.reload=w.reload;
   }
  }else if(s.cooldown<=0){
   s.side=-s.side;craft.muzzle(muzzle,0,s.side);
   if(combat.fireShell(muzzle,aimFrom(aimPoint,0),w)){s.cooldown=w.cooldown;s.shots++;}
  }
 }
 // What each weapon's row on the HUD shows: a bar from 0 to 1, a note, and whether it is hot.
 function status(i){
  if(i===2)return {fill:s.heat,note:s.overheated?'OVERHEAT':'READY',hot:s.overheated};
  if(i===1)return s.reload>0?{fill:1-s.reload/ROCKETS.reload,note:`RELOAD ${s.reload.toFixed(1)} s`,hot:false}:{fill:s.rockets/ROCKETS.load,note:`${s.rockets} LEFT`,hot:false};
  return {fill:1-s.cooldown/MISSILE.cooldown,note:s.cooldown>0?`${s.cooldown.toFixed(1)} s`:'READY',hot:false};
 }
 return {state:s,update,status,select(i){s.weapon=(i+WEAPONS.length)%WEAPONS.length;},
  reset(){Object.assign(s,fresh());}};
}
