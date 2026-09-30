import * as THREE from '../../vendor/three.module.js?v=052';
import {rng,colliderRay,LEVELS} from './world.js?v=ch2-05';
import {FX_LAYER} from './combat.js?v=ch2-05';

export const ENEMY_LAYER=2;
// Only a few attack at once, and never on the same beat, so the fire coming up stays readable.
const MAX_ATTACKERS=3,ATTACK_GAP=.45;
// Creatures per Warden level, feet to crown, and on city rooftops.
const PER_LEVEL=[10,7,7,8,5],ROOFTOPS=8;
// Stand-ins. Hurlers (5 m) hide behind a column, step out, wind up and lob rubble at the
// gunship; Lamplighters (6.5 m) glow for a second, then fire a fast bolt at it. Both heads
// glow before an attack, and through thermal that glow flashes white: that is the tell.
const TYPES={
 hurler:{hp:55,radius:2.2,height:5,range:700,windup:1.1,cover:[2.4,4.6]},
 lamplighter:{hp:40,radius:1.9,height:6.5,range:1000,windup:1.0,cover:[2.2,3.8]}
};
const HEAD_IDLE={hurler:new THREE.Color(0x8a2f14),lamplighter:new THREE.Color(0xc9b46a)};
const HEAD_HOT={hurler:new THREE.Color(0xff6a1a),lamplighter:new THREE.Color(0xfffbe8)};

export function createEnemies(scene,world,combat){
 const random=rng(77),list=[];
 const add=(type,home,anchor,level)=>list.push({index:list.length,type,...TYPES[type],home:home.clone(),pos:home.clone(),anchor,level,
  hp:TYPES[type].hp,alive:true,state:'cover',timer:.5+random()*3,glow:0,lean:0,out:new THREE.Vector3(),hide:new THREE.Vector3(),hitFlash:0});
 // A fixed number of pillars on each level get a creature: Hurlers mostly low, Lamplighters higher up.
 PER_LEVEL.forEach((count,level)=>{
  const spots=world.pillars.map((pl,i)=>({pl,i,order:random()})).filter(o=>o.pl.level===level).sort((a,b)=>a.order-b.order).slice(0,count);
  for(const {pl,i} of spots.sort((a,b)=>a.i-b.i))add(level>=2&&random()<.45||random()<.22?'lamplighter':'hurler',pl.pos,i,level);
 });
 // A few on city rooftops: no pillar, they duck behind the parapet instead.
 world.rooftops.filter(r=>r.z<420&&Math.abs(r.x)<520).sort(()=>random()-.5).slice(0,ROOFTOPS).forEach((r,i)=>add(i%3?'hurler':'lamplighter',r,-1,-1));

 const count=list.length,geo={
  hurler:new THREE.CylinderGeometry(.8,1.25,5,8).translate(0,2.5,0),
  lamplighter:new THREE.CylinderGeometry(.28,.75,6.5,6).translate(0,3.25,0),
  head:new THREE.SphereGeometry(1,12,8)
 };
 const bodyMat=new THREE.MeshLambertMaterial({color:0x3d2a24}),headMat=new THREE.MeshBasicMaterial({color:0xffffff});
 const bodies={hurler:new THREE.InstancedMesh(geo.hurler,bodyMat,count),lamplighter:new THREE.InstancedMesh(geo.lamplighter,bodyMat,count)};
 const heads=new THREE.InstancedMesh(geo.head,headMat,count);
 for(const m of [bodies.hurler,bodies.lamplighter,heads]){m.layers.set(ENEMY_LAYER);m.frustumCulled=false;scene.add(m);}
 // Heads draw in the effects pass, which thermal leaves in colour, so a winding-up head shows hot.
 heads.layers.set(FX_LAYER);
 bodies.hurler.name='Hurlers (stand-in)';bodies.lamplighter.name='Lamplighters (stand-in)';heads.name='Creature heads';
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e3=new THREE.Euler(),s3=new THREE.Vector3(),zero=new THREE.Matrix4().makeScale(0,0,0),color=new THREE.Color();
 const tmp=new THREE.Vector3(),away=new THREE.Vector3(),dir=new THREE.Vector3(),head=new THREE.Vector3();
 // Keep a point within a step of the pillar along the ledge's facing.
 const onLedge=(pt,e)=>{const pl=world.pillars[e.anchor],d=tmp.subVectors(pt,e.home).dot(pl.normal);pt.addScaledVector(pl.normal,THREE.MathUtils.clamp(d,-pl.inward,6)-d);};
 let kills={hurler:0,lamplighter:0},attackGap=0;

 function center(e,out){return out.copy(e.pos).setY(e.pos.y+e.height*.6);}
 function headPos(e,out){return out.copy(e.pos).setY(e.pos.y+e.height+.7);}
 // Cover is the far side of the pillar from the craft; out is a step to the side of it.
 function plan(e,craftPos){
  if(e.anchor<0||world.pillars[e.anchor].hp<=0){
   e.hide.copy(e.home).setY(e.home.y-(e.anchor<0?e.height*.8:0));e.out.copy(e.home);return;
  }
  away.subVectors(e.home,craftPos).setY(0);if(away.lengthSq()<1)away.set(0,0,-1);away.normalize();
  e.hide.copy(e.home).addScaledVector(away,3.5);onLedge(e.hide,e);
  const side=(e.index%2?1:-1);
  e.out.copy(e.home).add(tmp.set(-away.z*side,0,away.x*side).multiplyScalar(4.5));onLedge(e.out,e);
 }
 function canSee(e,craftPos){
  headPos(e,head);dir.subVectors(craftPos,head);const len=dir.length();dir.divideScalar(len);
  for(const c of world.colliders){if(c.alive&&colliderRay(c,head,dir,len-10)<len-10)return false;}
  return true;
 }
 function attack(e,craft){
  headPos(e,head);const target=craft.state.pos;
  if(e.type==='hurler'){
   // Ballistic lob with only part of the lead, so a sideways move still clears it.
   const flight=THREE.MathUtils.clamp(head.distanceTo(target)/70,1.4,5);
   tmp.copy(target).addScaledVector(craft.state.vel,flight*.55);
   dir.subVectors(tmp,head).divideScalar(flight);dir.y+=.5*30*flight;
   combat.throwRock(head,dir);
  }else{
   // Half the lead: a gunship holding its orbit gets grazed, one that moves gets missed.
   tmp.copy(target).addScaledVector(craft.state.vel,head.distanceTo(target)/320*.5);
   dir.subVectors(tmp,head).normalize().multiplyScalar(320);
   combat.fireBolt(head,dir);
  }
 }
 function update(dt,craft){
  const craftPos=craft.state.pos;
  attackGap=Math.max(0,attackGap-dt);
  let active=0;for(const e of list)if(e.alive&&e.state!=='cover')active++;
  for(const e of list){
   if(!e.alive)continue;
   e.timer-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt*5);
   const inRange=e.home.distanceTo(craftPos)<e.range;
   if(e.state==='cover'){
    plan(e,craftPos);e.pos.lerp(e.hide,1-Math.exp(-5*dt));e.glow=Math.max(0,e.glow-dt*3);
    if(e.timer<=0){
     if(inRange&&active<MAX_ATTACKERS&&attackGap<=0){e.state='out';e.timer=.7;active++;attackGap=ATTACK_GAP;}
     else e.timer=inRange?.4+random()*1.2:1+random()*2;
    }
   }else if(e.state==='out'){
    e.pos.lerp(e.out,1-Math.exp(-6*dt));
    if(e.timer<=0){if(canSee(e,craftPos)){e.state='windup';e.timer=e.windup;}else{e.state='cover';e.timer=1.5+random()*2;}}
   }else if(e.state==='windup'){
    e.glow=Math.min(1,e.glow+dt/e.windup);e.lean=e.type==='hurler'?e.glow:0;
    if(e.timer<=0){attack(e,craft);e.state='recover';e.timer=.6;e.glow=.3;}
   }else if(e.state==='recover'){
    e.lean=Math.max(0,e.lean-dt*4);e.glow=Math.max(0,e.glow-dt*2);
    if(e.timer<=0){e.state='cover';const [a,b]=e.cover;const exposed=e.anchor<0||world.pillars[e.anchor].hp<=0;e.timer=(a+random()*(b-a))*(exposed?.55:1);}
   }
  }
  sync(craftPos);
 }
 function sync(craftPos){
  for(const e of list){
   const body=bodies[e.type],other=bodies[e.type==='hurler'?'lamplighter':'hurler'];
   other.setMatrixAt(e.index,zero);
   if(!e.alive){body.setMatrixAt(e.index,zero);heads.setMatrixAt(e.index,zero);continue;}
   const face=craftPos?Math.atan2(craftPos.x-e.pos.x,craftPos.z-e.pos.z):0;
   e3.set(-e.lean*.35,face,0);q.setFromEuler(e3);
   body.setMatrixAt(e.index,m4.compose(e.pos,q,s3.setScalar(1)));
   headPos(e,head);heads.setMatrixAt(e.index,m4.compose(head,q,s3.setScalar(e.type==='hurler'?.8:1+e.glow*.5)));
   color.copy(HEAD_IDLE[e.type]).lerp(HEAD_HOT[e.type],e.glow);if(e.hitFlash)color.lerp(new THREE.Color(1,1,1),e.hitFlash);
   heads.setColorAt(e.index,color);
  }
  for(const m of [bodies.hurler,bodies.lamplighter,heads])m.instanceMatrix.needsUpdate=true;
  if(heads.instanceColor)heads.instanceColor.needsUpdate=true;
 }
 function damage(e,amount){
  if(!e||!e.alive)return;e.hp-=amount;e.hitFlash=1;
  if(e.hp<=0){e.alive=false;kills[e.type]++;combat.blast(center(e,tmp),5,.55);}
 }
 sync(null);
 return {list,center,update,damage,
  kills:()=>({...kills}),totals:()=>({hurler:list.filter(e=>e.type==='hurler').length,lamplighter:list.filter(e=>e.type==='lamplighter').length}),
  // Alive and total per Warden level, feet to crown.
  levels:()=>LEVELS.map((_,level)=>{const on=list.filter(e=>e.level===level);return {alive:on.filter(e=>e.alive).length,total:on.length};}),
  exposeAll(craftPos,glow=0){for(const e of list){plan(e,craftPos);e.pos.copy(e.out);e.state='windup';e.timer=9;e.glow=glow*(e.type==='lamplighter'?1:.6);}sync(craftPos);},
  reset(){list.forEach(e=>Object.assign(e,{alive:true,hp:TYPES[e.type].hp,state:'cover',timer:.5+random()*3,glow:0,lean:0,hitFlash:0,pos:e.home.clone()}));kills={hurler:0,lamplighter:0};sync(null);}};
}
