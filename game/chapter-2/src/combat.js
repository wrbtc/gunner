import * as THREE from '../../vendor/three.module.js?v=052';
import {rayBox} from './world.js?v=ch2-01';

export const FX_LAYER=3;
const GRAVITY=30;

// Fixed pools, one draw each: rocks, bolts, shells, lances, blasts, tracers.
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

export function createCombat(scene,world){
 const rocks=pool(scene,new THREE.DodecahedronGeometry(2.4),new THREE.MeshLambertMaterial({color:0x7a6a55,emissive:0x3a1a08}),40,'Thrown rubble');
 const bolts=pool(scene,new THREE.CapsuleGeometry(.7,7,2,6).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff2b0}),60,'Lamplighter bolts');
 const shells=pool(scene,new THREE.SphereGeometry(1.1,8,6),new THREE.MeshBasicMaterial({color:0xffb45a}),10,'Cannon shells');
 const lances=pool(scene,new THREE.ConeGeometry(.9,5,8).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff6e0}),6,'Lance missiles');
 const blasts=pool(scene,new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}),28,'Blasts');
 const TRACERS=48,tracerPos=new Float32Array(TRACERS*6),tracerAge=new Float32Array(TRACERS).fill(9);let tracerNext=0;
 const tracerGeo=new THREE.BufferGeometry();tracerGeo.setAttribute('position',new THREE.BufferAttribute(tracerPos,3));
 const tracers=new THREE.LineSegments(tracerGeo,new THREE.LineBasicMaterial({color:0xffd27a,transparent:true,opacity:.9}));
 tracers.frustumCulled=false;tracers.layers.set(FX_LAYER);tracers.name='Gatling tracers';scene.add(tracers);
 let enemies=null,craft=null;
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),rayCenter=new THREE.Vector3(),rayOffset=new THREE.Vector3();

 // First thing a ray meets: an enemy, a pillar or wall, or the ground.
 function raycast(origin,direction,far,{hitEnemies=true}={}){
  let best={t:far,kind:'none',index:-1};
  for(let i=0;i<world.colliders.length;i++){
   const c=world.colliders[i];if(!c.alive)continue;
   const t=rayBox(origin,direction,c.min,c.max,best.t);if(t<best.t)best={t,kind:c.kind,index:i};
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
 function splash(pos,radius,damage,pillarDamage){
  blast(pos,radius*1.1,.6);
  if(enemies)for(const e of enemies.list){if(!e.alive)continue;const d=enemies.center(e,tmp).distanceTo(pos);if(d<radius+e.radius)enemies.damage(e,damage*(1-.6*Math.min(1,d/radius)));}
  world.pillars.forEach((pl,i)=>{if(pl.hp>0&&tmp.copy(pl.pos).setY(pl.pos.y+11).distanceTo(pos)<radius+6)world.damagePillar(i,pillarDamage);});
 }
 function tracer(a,b){const i=tracerNext++%TRACERS;tracerPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);tracerAge[i]=0;}
 function hitsWorld(p){
  if(p.y<=0)return true;
  for(const c of world.colliders)if(c.alive&&p.x>c.min.x&&p.x<c.max.x&&p.y>c.min.y&&p.y<c.max.y&&p.z>c.min.z&&p.z<c.max.z)return true;
  return false;
 }
 function update(dt,aimPoint){
  const craftPos=craft.state.pos;
  for(const r of rocks.items){
   if(!r.live)continue;r.age+=dt;r.vel.y-=GRAVITY*dt;r.pos.addScaledVector(r.vel,dt);
   if(r.pos.distanceTo(craftPos)<8.5){r.live=false;craft.hurt(14,r.pos);blast(r.pos,6);continue;}
   if(r.age>8||hitsWorld(r.pos)){r.live=false;blast(r.pos,5,.35);}
  }
  for(const b of bolts.items){
   if(!b.live)continue;b.age+=dt;b.pos.addScaledVector(b.vel,dt);
   if(b.pos.distanceTo(craftPos)<7.5){b.live=false;craft.hurt(7,b.pos);blast(b.pos,4,.3);continue;}
   if(b.age>4||hitsWorld(b.pos))b.live=false;
  }
  for(const s of shells.items){
   if(!s.live)continue;s.age+=dt;s.vel.y-=9.8*dt;
   const step=s.vel.length()*dt;dir.copy(s.vel).normalize();
   const hit=raycast(s.pos,dir,step);
   if(hit.kind!=='none'){s.pos.addScaledVector(dir,hit.t);s.live=false;splash(s.pos,18,140,200);continue;}
   s.pos.addScaledVector(s.vel,dt);if(s.age>6)s.live=false;
  }
  for(const l of lances.items){
   if(!l.live)continue;l.age+=dt;
   // Steers toward wherever the gunner is aiming now, with a limited turn rate.
   dir.subVectors(aimPoint,l.pos).normalize();
   const speed=Math.min(190,l.vel.length()+120*dt);
   const cur=tmp.copy(l.vel).normalize(),angle=cur.angleTo(dir),maxTurn=2.4*dt;
   if(angle>1e-4)cur.lerp(dir,Math.min(1,maxTurn/angle)).normalize();
   l.vel.copy(cur).multiplyScalar(speed);
   const step=l.vel.length()*dt,hit=raycast(l.pos,cur,step);
   if(hit.kind!=='none'){l.pos.addScaledVector(cur,hit.t);l.live=false;splash(l.pos,26,320,400);continue;}
   l.pos.addScaledVector(l.vel,dt);if(l.age>8){l.live=false;blast(l.pos,10);}
  }
  for(const b of blasts.items){
   if(!b.live)continue;b.age+=dt;const k=b.age/b.life;
   b.scale=b.extra.radius*(.35+.65*Math.sqrt(k));if(k>=1)b.live=false;
  }
  for(let i=0;i<TRACERS;i++){tracerAge[i]+=dt;if(tracerAge[i]>.06)tracerPos.fill(0,i*6,i*6+6);}
  tracerGeo.attributes.position.needsUpdate=true;
  rocks.sync();bolts.sync(true);shells.sync();lances.sync(true);blasts.sync();
 }
 return {raycast,blast,splash,tracer,update,
  bind(e,c){enemies=e;craft=c;},
  throwRock(origin,vel){const r=rocks.spawn();if(r){r.pos.copy(origin);r.vel.copy(vel);}},
  fireBolt(origin,vel){const b=bolts.spawn();if(b){b.pos.copy(origin);b.vel.copy(vel);}},
  fireShell(origin,vel){const s=shells.spawn();if(s){s.pos.copy(origin);s.vel.copy(vel);return true;}return false;},
  fireLance(origin,vel){const l=lances.spawn();if(l){l.pos.copy(origin);l.vel.copy(vel);return true;}return false;},
  reset(){for(const p of [rocks,bolts,shells,lances,blasts])p.items.forEach(i=>i.live=false);},
  stats(){return {rocks:rocks.items.filter(i=>i.live).length,bolts:bolts.items.filter(i=>i.live).length,lances:lances.items.filter(i=>i.live).length};}};
}

// The gunner's three weapons. 1 gatling (heat), 2 heavy cannon (cooldown, breaks cover),
// 3 Lance (a few guided missiles that follow your aim).
export const WEAPONS=Object.freeze([
 {id:'gatling',label:'Gatling',key:'1'},
 {id:'cannon',label:'Heavy cannon',key:'2'},
 {id:'lance',label:'Lance',key:'3'}
]);
export function createArsenal(combat,craft,enemies){
 const s={weapon:0,heat:0,overheated:false,gatlingClock:0,cannonCooldown:0,lances:4,lanceReload:0,hits:0,shots:0};
 const muzzle=new THREE.Vector3(),dir=new THREE.Vector3(),end=new THREE.Vector3();
 function update(dt,firing,aimPoint){
  s.gatlingClock-=dt;s.cannonCooldown=Math.max(0,s.cannonCooldown-dt);
  s.heat=Math.max(0,s.heat-dt*(s.overheated?.55:.42));if(s.overheated&&s.heat<.3)s.overheated=false;
  if(s.lances<4){s.lanceReload+=dt;if(s.lanceReload>=7){s.lances++;s.lanceReload=0;}}else s.lanceReload=0;
  if(!firing)return;
  craft.muzzle(muzzle);
  if(s.weapon===0){
   while(s.gatlingClock<=0&&!s.overheated){
    s.gatlingClock+=.05;s.heat+=.017;if(s.heat>=1){s.heat=1;s.overheated=true;}
    dir.subVectors(aimPoint,muzzle).normalize();
    dir.x+=(Math.random()-.5)*.008;dir.y+=(Math.random()-.5)*.008;dir.z+=(Math.random()-.5)*.008;dir.normalize();
    const hit=combat.raycast(muzzle,dir,1400);
    end.copy(muzzle).addScaledVector(dir,Math.min(hit.t,1400));
    combat.tracer(muzzle,end);
    if(hit.kind==='enemy'){enemies.damage(enemies.list[hit.index],9);s.hits++;combat.blast(end,1.6,.12);}
    else if(hit.kind!=='none')combat.blast(end,1.1,.1);
   }
   if(s.gatlingClock<0)s.gatlingClock=0;
  }else if(s.weapon===1&&s.cannonCooldown<=0){
   dir.subVectors(aimPoint,muzzle).normalize();
   // A little loft so the shell lands where the reticle points at mid range.
   const dist=muzzle.distanceTo(aimPoint),t=dist/420;dir.multiplyScalar(420);dir.y+=.5*9.8*t;
   if(combat.fireShell(muzzle,dir)){s.cannonCooldown=2.2;s.shots++;}
  }else if(s.weapon===2&&s.lances>0&&s.cannonCooldown<=0){
   dir.subVectors(aimPoint,muzzle).normalize().multiplyScalar(90);
   if(combat.fireLance(muzzle,dir)){s.lances--;s.cannonCooldown=.6;s.shots++;}
  }
 }
 return {state:s,update,select(i){s.weapon=(i+WEAPONS.length)%WEAPONS.length;},reset(){Object.assign(s,{weapon:0,heat:0,overheated:false,gatlingClock:0,cannonCooldown:0,lances:4,lanceReload:0,hits:0});}};
}
