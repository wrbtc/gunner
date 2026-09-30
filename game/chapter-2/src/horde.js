import * as THREE from '../../vendor/three.module.js?v=052';
import {ENEMY_LAYER} from './enemies.js?v=ch2-07';
import {loadCreeperLoco} from '../../src/creeper-loco.js?v=054-84';
import {streetZs,avenueXs,GRID} from './city.js?v=ch2-07';

// The infected in the streets. Runners pour out of the cross streets, run the grid toward the
// team (along the street, then up the avenue, then straight in) and tear into whoever they
// reach, throwing junk on the way. Brutes are twice the size: slow, hard to kill, and they lob
// chunks at the gunship. Until their own models arrive both wear the creeper, at their size.
export const HORDE_TYPES=Object.freeze({
 runner:{hp:30,speed:6.5,radius:.8,height:1.8,reach:2.2,dps:14,pool:70},
 brute:{hp:420,speed:2.6,radius:1.8,height:4.2,reach:3.6,dps:34,pool:6,range:900,windup:1.8}
});
const CREEPER_HEIGHT=6.15,THROW_RELEASE=2.9,STREETS=streetZs(),AVENUES=avenueXs();
const nearest=(lines,v)=>lines.reduce((best,s)=>Math.abs(s-v)<Math.abs(best-v)?s:best,lines[0]);
// Open ground with no buildings: the plaza round the statue and the crater's surround.
const open=p=>Math.hypot(p.x,p.z)<225||(p.x>-115&&p.x<115&&p.z>-345&&p.z<-115);

export function createHorde(scene,world,combat,survivors,craft){
 const list=[];
 for(const [type,spec] of Object.entries(HORDE_TYPES))for(let i=0;i<spec.pool;i++)
  list.push({index:list.length,type,...spec,alive:false,hp:0,pos:new THREE.Vector3(),lane:(Math.random()-.5)*8,state:'run',timer:0,throwClock:2+Math.random()*4,hitFlash:0,anim:null});
 let kills=0;
 const stand=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.5,1,3,6).translate(0,.9,0),new THREE.MeshLambertMaterial({color:0x5a4a40}),list.length);
 stand.layers.set(ENEMY_LAYER);stand.frustumCulled=false;stand.name='Infected (stand-in)';scene.add(stand);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),e3=new THREE.Euler(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),hand=new THREE.Vector3(),head=new THREE.Vector3();
 let actors=null;
 const ready=loadCreeperLoco().then(kit=>{
  actors=list.map(e=>{
   const holder=new THREE.Group();holder.name=e.type==='brute'?'Brute':'Runner';holder.scale.setScalar(e.height/CREEPER_HEIGHT);holder.visible=false;scene.add(holder);
   const actor=kit.attach(holder);if(e.type==='brute')actor.play('throw');actor.play('run');
   holder.traverse(o=>o.layers.set(ENEMY_LAYER));
   return {holder,actor};
  });
  return true;
 }).catch(()=>false);

 function spawn(type,x,z){
  const e=list.find(item=>item.type===type&&!item.alive);if(!e)return null;
  Object.assign(e,{alive:true,hp:HORDE_TYPES[type].hp,state:'run',timer:0,throwClock:2+Math.random()*4,hitFlash:0});
  e.pos.set(x,0,z);return e;
 }
 // A wave: runners (and a few brutes) come out onto the cross streets around a point, mostly
 // ahead of the team, never right on top of it.
 function wave(around,runners,brutes=0){
  const put=type=>{
   for(let tries=0;tries<20;tries++){
    const z=nearest(STREETS,around.z-260+Math.random()*380),side=Math.random()<.5?-1:1,x=around.x+side*(60+Math.random()*340);
    if(Math.hypot(x-around.x,z-around.z)<60||Math.hypot(x,z)>GRID.extent-40)continue;
    return spawn(type,x,z);
   }
   return null;
  };
  for(let i=0;i<runners;i++)put('runner');
  for(let i=0;i<brutes;i++)put('brute');
 }
 function nearestSurvivor(pt){
  let best=null,d=Infinity;for(const p of survivors.list){if(!p.alive)continue;const dd=p.pos.distanceTo(pt);if(dd<d){d=dd;best=p;}}
  return best;
 }
 function canSee(from,to){dir.subVectors(to,from);const len=dir.length();dir.divideScalar(len);return world.rayHit(from,dir,len-8).index<0;}
 // The street grid: along a cross street to the avenue nearest the target, up the avenue, and
 // straight in only close by or across open ground, so nothing runs through a building.
 const moveTo=(e,x,z,speed)=>{tmp.set(x-e.pos.x,0,z-e.pos.z);const d=tmp.length();if(d>1e-3)e.pos.addScaledVector(tmp,Math.min(1,speed/d));};
 function steer(e,target,dt){
  const dist=Math.hypot(target.x-e.pos.x,target.z-e.pos.z),speed=e.speed*dt;
  if(dist<30||(open(e.pos)&&open(target))){if(dist>e.reach*.8)moveTo(e,target.x+e.lane*.2,target.z,speed);return dist;}
  const avenue=nearest(AVENUES,target.x)+e.lane*.5;
  if(Math.abs(e.pos.x-avenue)>2){
   const street=nearest(STREETS,e.pos.z)+e.lane*.25;
   if(Math.abs(e.pos.z-street)>1.5)moveTo(e,e.pos.x,street,speed);else moveTo(e,avenue,e.pos.z,speed);
  }else moveTo(e,avenue,target.z,speed);
  return dist;
 }
 function update(dt){
  const craftPos=craft.state.pos;
  for(const e of list){
   if(!e.alive)continue;
   e.hitFlash=Math.max(0,e.hitFlash-dt*5);
   const target=nearestSurvivor(e.pos);
   if(e.state==='windup'){
    e.timer-=dt;
    if(e.timer<=0){
     // A chunk of the street, lobbed with part of the lead: holding the orbit gets you hit.
     head.copy(e.pos).setY(e.height+1);if(actors?.[e.index]?.actor.throwingHandWorld(hand))head.copy(hand);
     const flight=THREE.MathUtils.clamp(head.distanceTo(craftPos)/80,1.6,6);
     tmp.copy(craftPos).addScaledVector(craft.state.vel,flight*.6);dir.subVectors(tmp,head).divideScalar(flight);dir.y+=.5*30*flight;
     combat.throwRock(head,dir,2.2);e.state='run';e.throwClock=5+Math.random()*4;
    }
    continue;
   }
   if(!target){e.state='run';continue;}
   const dist=steer(e,target.pos,dt);
   if(dist<e.reach){e.state='fight';survivors.damage(target,e.dps*dt);}else e.state='run';
   e.throwClock-=dt;
   if(e.throwClock<=0){
    e.throwClock=3+Math.random()*5;
    head.copy(e.pos).setY(e.height);
    if(e.type==='brute'&&head.distanceTo(craftPos)<e.range&&canSee(head,craftPos)){e.state='windup';e.timer=e.windup;}
    else if(e.type==='runner'&&dist>12&&dist<55){
     // Junk thrown at the team on the run.
     const flight=THREE.MathUtils.clamp(dist/22,.8,2.2);tmp.copy(target.pos).setY(1);
     dir.subVectors(tmp,head).divideScalar(flight);dir.y+=.5*30*flight;combat.throwRock(head,dir,.6);
    }
   }
  }
  sync(dt);
 }
 function sync(dt=0){
  const craftPos=craft.state.pos;
  for(const e of list){
   const a=actors?.[e.index];
   if(!e.alive){stand.setMatrixAt(e.index,zero);if(a)a.holder.visible=false;continue;}
   const target=nearestSurvivor(e.pos),look=e.state==='windup'?craftPos:target?.pos||craftPos;
   const face=Math.atan2(look.x-e.pos.x,look.z-e.pos.z);
   if(a){
    stand.setMatrixAt(e.index,zero);
    a.holder.visible=true;a.holder.position.copy(e.pos);a.holder.rotation.y=face+Math.PI;
    if(e.state==='windup')a.actor.play('throw',dt,THROW_RELEASE/e.windup);
    else if(e.state==='fight')a.actor.play('walk',dt,2.2);
    else a.actor.play('run',dt,e.type==='brute'?.7:1.3);
   }else{
    e3.set(0,face,0);q.setFromEuler(e3);stand.setMatrixAt(e.index,m.compose(e.pos,q,s.set(e.height/1.8,e.height/1.8,e.height/1.8)));
   }
  }
  stand.instanceMatrix.needsUpdate=true;
 }
 function damage(e,amount){
  if(!e||!e.alive)return;e.hp-=amount;e.hitFlash=1;
  if(e.hp<=0){e.alive=false;kills++;combat.blast(tmp.copy(e.pos).setY(e.height*.5),e.type==='brute'?6:2.5,.5);}
 }
 return {list,ready,update,sync,spawn,wave,damage,
  center:(e,out)=>out.copy(e.pos).setY(e.height*.55),
  alive:()=>list.filter(e=>e.alive).length,kills:()=>kills,
  reset(){for(const e of list)e.alive=false;kills=0;sync();}};
}
