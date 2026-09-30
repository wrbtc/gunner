import * as THREE from '../../vendor/three.module.js?v=052';
import {colliderHas,colliderRay} from './world.js?v=ch2-06';

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
  sync(orient=false){
   items.forEach((it,i)=>{
    if(!it.live){mesh.setMatrixAt(i,zero);return;}
    if(orient&&it.vel.lengthSq()>1e-6)q.setFromUnitVectors(fwd,look.copy(it.vel).normalize());else q.identity();
    mesh.setMatrixAt(i,m.compose(it.pos,q,s.setScalar(it.scale)));
   });
   mesh.instanceMatrix.needsUpdate=true;
  }};
}

// The gunship's three guns, as on the AC-130: each has its own sensor zoom, and the shells
// take real time to fall from the orbit, so you learn to fire a beat early.
export const WEAPONS=Object.freeze([
 {id:'105',label:'105 mm',key:'1',speed:360,radius:28,damage:420,pillar:999,cooldown:4.5,fov:40},
 {id:'40',label:'40 mm',key:'2',speed:520,radius:8,damage:110,pillar:140,cooldown:.55,fov:20},
 {id:'25',label:'25 mm',key:'3',rate:.05,damage:10,fov:10}
]);

export function createCombat(scene,world){
 const rocks=pool(scene,new THREE.DodecahedronGeometry(1.2),new THREE.MeshLambertMaterial({color:0x7a6a55,emissive:0x3a1a08}),40,'Thrown rubble');
 const bolts=pool(scene,new THREE.CapsuleGeometry(.35,4,2,6).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff2b0}),60,'Lamplighter bolts');
 const shells=pool(scene,new THREE.CapsuleGeometry(.4,2.2,2,6).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffe0a0}),16,'Shells');
 const blasts=pool(scene,new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}),40,'Blasts');
 const TRACERS=48,tracerPos=new Float32Array(TRACERS*6),tracerAge=new Float32Array(TRACERS).fill(9);let tracerNext=0;
 const tracerGeo=new THREE.BufferGeometry();tracerGeo.setAttribute('position',new THREE.BufferAttribute(tracerPos,3));
 const tracers=new THREE.LineSegments(tracerGeo,new THREE.LineBasicMaterial({color:0xffd27a,transparent:true,opacity:.9}));
 tracers.frustumCulled=false;tracers.layers.set(FX_LAYER);tracers.name='Gatling tracers';scene.add(tracers);
 let enemies=null,craft=null;
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),rayCenter=new THREE.Vector3(),rayOffset=new THREE.Vector3();
 const api={onImpact:null};

 // First thing a ray meets: an enemy, a pillar or wall, or the ground.
 function raycast(origin,direction,far,{hitEnemies=true}={}){
  let best={t:far,kind:'none',index:-1};
  for(let i=0;i<world.colliders.length;i++){
   const c=world.colliders[i];if(!c.alive)continue;
   const t=colliderRay(c,origin,direction,best.t);if(t<best.t)best={t,kind:c.kind,index:i};
  }
  if(direction.y<0){const t=-origin.y/direction.y;if(t>0&&t<best.t)best={t,kind:'ground',index:-1};}
  if(hitEnemies&&enemies)for(const e of enemies.list){
   if(!e.alive)continue;
   // Own scratch vectors: callers pass the shared tmp/dir vectors in as origin and direction.
   const c=enemies.center(e,rayCenter),oc=rayOffset.subVectors(origin,c),b=oc.dot(direction),cc=oc.lengthSq()-e.radius*e.radius,h=b*b-cc;
   if(h<0)continue;const t=-b-Math.sqrt(h);if(t>0&&t<best.t)best={t,kind:'enemy',index:e.index};
  }
  return best;
 }
 function blast(pos,radius,life=.45){const b=blasts.spawn();if(!b)return;b.pos.copy(pos);b.extra={radius};b.life=life;b.scale=.1;}
 // Damages everything in reach and returns how many creatures it struck.
 function splash(pos,radius,damage,pillarDamage){
  let struck=0;
  if(enemies)for(const e of enemies.list){if(!e.alive)continue;const d=enemies.center(e,tmp).distanceTo(pos);if(d<radius+e.radius){enemies.damage(e,damage*(1-.6*Math.min(1,d/radius)));struck++;}}
  world.pillars.forEach((pl,i)=>{if(pl.hp>0&&tmp.copy(pl.pos).setY(pl.pos.y+5.5).distanceTo(pos)<radius+2)world.damagePillar(i,pillarDamage);});
  return struck;
 }
 function tracer(a,b){const i=tracerNext++%TRACERS;tracerPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);tracerAge[i]=0;}
 function hitsWorld(p){
  if(p.y<=0)return true;
  for(const c of world.colliders)if(c.alive&&colliderHas(c,p))return true;
  return false;
 }
 function update(dt){
  const craftPos=craft.state.pos;
  for(const r of rocks.items){
   if(!r.live)continue;r.age+=dt;r.vel.y-=GRAVITY*dt;r.pos.addScaledVector(r.vel,dt);
   if(r.pos.distanceTo(craftPos)<7){r.live=false;craft.hurt(14,r.pos);blast(r.pos,4);continue;}
   if(r.age>9||hitsWorld(r.pos)){r.live=false;blast(r.pos,3,.35);}
  }
  for(const b of bolts.items){
   if(!b.live)continue;b.age+=dt;b.pos.addScaledVector(b.vel,dt);
   if(b.pos.distanceTo(craftPos)<6){b.live=false;craft.hurt(7,b.pos);blast(b.pos,3,.3);continue;}
   if(b.age>5||hitsWorld(b.pos))b.live=false;
  }
  // Shells fly straight at their muzzle speed; the fall from the orbit is the delay you lead.
  for(const s of shells.items){
   if(!s.live)continue;s.age+=dt;
   const w=s.extra,step=w.speed*dt;dir.copy(s.vel).normalize();
   const hit=raycast(s.pos,dir,step);
   if(hit.kind!=='none'){
    s.pos.addScaledVector(dir,hit.t);s.live=false;
    const struck=splash(s.pos,w.radius,w.damage,w.pillar);blast(s.pos,w.radius*1.1,w.id==='105'?1.1:.55);
    if(w.id==='105')blast(tmp.copy(s.pos).setY(s.pos.y+w.radius*.4),w.radius*.7,1.6);
    api.onImpact?.(s.pos,w,struck);continue;
   }
   s.pos.addScaledVector(dir,step);if(s.age>8)s.live=false;
  }
  for(const b of blasts.items){
   if(!b.live)continue;b.age+=dt;const k=b.age/b.life;
   b.scale=b.extra.radius*(.35+.65*Math.sqrt(k));if(k>=1)b.live=false;
  }
  for(let i=0;i<TRACERS;i++){tracerAge[i]+=dt;if(tracerAge[i]>.06)tracerPos.fill(0,i*6,i*6+6);}
  tracerGeo.attributes.position.needsUpdate=true;
  rocks.sync();bolts.sync(true);shells.sync(true);blasts.sync();
 }
 return Object.assign(api,{raycast,blast,splash,tracer,update,
  bind(e,c){enemies=e;craft=c;},
  throwRock(origin,vel){const r=rocks.spawn();if(r){r.pos.copy(origin);r.vel.copy(vel);}},
  fireBolt(origin,vel){const b=bolts.spawn();if(b){b.pos.copy(origin);b.vel.copy(vel);}},
  fireShell(origin,direction,weapon){const s=shells.spawn();if(!s)return false;s.pos.copy(origin);s.vel.copy(direction).setLength(weapon.speed);s.extra=weapon;s.scale=weapon.id==='105'?1.8:1;return true;},
  reset(){for(const p of [rocks,bolts,shells,blasts])p.items.forEach(i=>i.live=false);},
  stats(){return {rocks:rocks.items.filter(i=>i.live).length,bolts:bolts.items.filter(i=>i.live).length,shells:shells.items.filter(i=>i.live).length};}});
}

// 1 is the 105 (one round, long reload), 2 the 40 (steady single shots), 3 the 25 (a rotary
// gun that heats up), as in the gunship's fire control.
export function createArsenal(combat,craft,enemies){
 const s={weapon:0,heat:0,overheated:false,gunClock:0,cooldown:[0,0],hits:0,shots:0};
 const muzzle=new THREE.Vector3(),dir=new THREE.Vector3(),end=new THREE.Vector3();
 function update(dt,firing,aimPoint){
  s.gunClock-=dt;s.cooldown[0]=Math.max(0,s.cooldown[0]-dt);s.cooldown[1]=Math.max(0,s.cooldown[1]-dt);
  s.heat=Math.max(0,s.heat-dt*(s.overheated?.5:.4));if(s.overheated&&s.heat<.3)s.overheated=false;
  if(!firing)return;
  const w=WEAPONS[s.weapon];
  craft.muzzle(muzzle,s.weapon);
  if(w.id==='25'){
   while(s.gunClock<=0&&!s.overheated){
    s.gunClock+=w.rate;s.heat+=.014;if(s.heat>=1){s.heat=1;s.overheated=true;}
    dir.subVectors(aimPoint,muzzle).normalize();
    dir.x+=(Math.random()-.5)*.004;dir.y+=(Math.random()-.5)*.004;dir.z+=(Math.random()-.5)*.004;dir.normalize();
    const hit=combat.raycast(muzzle,dir,2600);
    end.copy(muzzle).addScaledVector(dir,Math.min(hit.t,2600));
    combat.tracer(muzzle,end);
    if(hit.kind==='enemy'){enemies.damage(enemies.list[hit.index],w.damage);s.hits++;combat.blast(end,1.6,.12);}
    else if(hit.kind!=='none')combat.blast(end,1.4,.12);
    if(hit.kind!=='none')combat.onImpact?.(end,w,0);
   }
   if(s.gunClock<0)s.gunClock=0;
  }else if(s.cooldown[s.weapon]<=0){
   dir.subVectors(aimPoint,muzzle).normalize();
   if(combat.fireShell(muzzle,dir,w)){s.cooldown[s.weapon]=w.cooldown;s.shots++;}
  }
 }
 return {state:s,update,select(i){s.weapon=(i+WEAPONS.length)%WEAPONS.length;},
  reset(){Object.assign(s,{weapon:0,heat:0,overheated:false,gunClock:0,cooldown:[0,0],hits:0,shots:0});}};
}
