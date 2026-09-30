import * as THREE from '../../vendor/three.module.js?v=052';
import {ENEMY_LAYER} from './enemies.js?v=ch2-08';
import {loadCast} from './cast.js?v=ch2-08';
import {streetZs,avenueXs,GRID} from './city.js?v=ch2-08';

// The infected in the streets, in the spirit of Left 4 Dead. Runners pour out of the cross
// streets and run the grid at the team, throwing junk and tearing into whoever they reach.
// Brutes are twice the size, slow and hard to kill, and lob chunks at the gunship. Leapers
// crouch on the rooftops and launch themselves at the gunship when it circles too low.
// Bloaters waddle at the team and burst, taking everything near them with them: shoot them
// in a crowd. All five wear the Meshy cast once it loads; plain capsules stand in until then.
export const HORDE_TYPES=Object.freeze({
 runner:{hp:30,speed:6.5,radius:.8,height:1.8,reach:2.2,dps:14,pool:70},
 brute:{hp:420,speed:2.6,radius:1.8,height:4.2,reach:3.6,dps:34,pool:6,range:900,windup:1.8},
 leaper:{hp:45,speed:8,radius:.9,height:2.1,reach:2.2,dps:18,pool:10,leapReach:340,crouch:1.2},
 bloater:{hp:60,speed:1.6,radius:1.4,height:2,reach:5,pool:8,burst:14}
});
const GRAVITY=30,STREETS=streetZs(),AVENUES=avenueXs(),CORPSE=2.5;
const nearest=(lines,v)=>lines.reduce((best,s)=>Math.abs(s-v)<Math.abs(best-v)?s:best,lines[0]);
// Open ground with no buildings: the plaza round the statue and the crater's surround.
const open=p=>Math.hypot(p.x,p.z)<225||(p.x>-115&&p.x<115&&p.z>-345&&p.z<-115);

export function createHorde(scene,world,combat,survivors,craft){
 const list=[];
 for(const [type,spec] of Object.entries(HORDE_TYPES))for(let i=0;i<spec.pool;i++)
  list.push({index:list.length,type,...spec,alive:false,dying:0,hp:0,pos:new THREE.Vector3(),vel:new THREE.Vector3(),lane:(Math.random()-.5)*8,
   state:'run',timer:0,throwClock:2+Math.random()*4,hitFlash:0,roof:-1,anim:0});
 let kills=0;
 const stand=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.5,1,3,6).translate(0,.9,0),new THREE.MeshLambertMaterial({color:0x5a4a40}),list.length);
 stand.layers.set(ENEMY_LAYER);stand.frustumCulled=false;stand.name='Infected (stand-in)';scene.add(stand);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),e3=new THREE.Euler(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const tmp=new THREE.Vector3(),dir=new THREE.Vector3(),hand=new THREE.Vector3(),head=new THREE.Vector3();
 // One actor per pool slot, made when that type's model arrives.
 const actors=new Array(list.length).fill(null);
 const ready=Promise.all(Object.keys(HORDE_TYPES).map(type=>loadCast(type).then(kit=>{
  for(const e of list){
   if(e.type!==type)continue;
   const holder=new THREE.Group();holder.name=type;holder.visible=false;scene.add(holder);
   const actor=kit.make(holder);actor.play('run');holder.traverse(o=>o.layers.set(ENEMY_LAYER));
   actors[e.index]={holder,actor};
  }
 }).catch(()=>null))).then(()=>true);
 const usedRoofs=new Set();

 function spawn(type,x,z,y=0){
  const e=list.find(item=>item.type===type&&!item.alive&&item.dying<=0);if(!e)return null;
  Object.assign(e,{alive:true,dying:0,hp:HORDE_TYPES[type].hp,state:type==='leaper'?'perch':'run',timer:0,throwClock:2+Math.random()*4,hitFlash:0,anim:0,roof:-1});
  e.pos.set(x,y,z);e.vel.set(0,0,0);return e;
 }
 // A wave: runners (and a few brutes and bloaters) come out onto the cross streets around a
 // point, mostly ahead of the team, never right on top of it.
 function wave(around,runners,brutes=0,bloaters=0){
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
  for(let i=0;i<bloaters;i++)put('bloater');
 }
 // Leapers take the rooftops near a point: roofs from 25 to 90 m, one to a roof.
 function perch(around,count){
  const roofs=world.rooftops.map((r,i)=>({r,i,d:Math.hypot(r.x-around.x,r.z-around.z)})).filter(o=>o.d>80&&o.d<420&&!usedRoofs.has(o.i)).sort(()=>Math.random()-.5);
  for(const o of roofs.slice(0,count)){const e=spawn('leaper',o.r.x,o.r.z,o.r.y);if(e){e.roof=o.i;usedRoofs.add(o.i);}}
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
 // A bloater bursts: everything close is torn apart, the team too, and a cloud of hot bile
 // hangs over the spot, whiting out the thermal picture for a few seconds.
 function burst(e){
  e.alive=false;e.dying=0;kills++;
  const at=tmp.copy(e.pos).setY(1.2);
  combat.blast(at,e.burst,.9);combat.blast(head.copy(at).setY(4),e.burst*1.4,4.5);
  for(const o of list)if(o.alive&&o!==e&&o.pos.distanceTo(at)<e.burst)damage(o,220*(1-o.pos.distanceTo(at)/e.burst/2));
  for(const p of survivors.list)if(p.alive&&p.pos.distanceTo(at)<e.burst*.75)survivors.damage(p,70*(1-p.pos.distanceTo(at)/e.burst));
  api.onBurst?.(e);
 }
 function update(dt){
  const craftPos=craft.state.pos;
  for(const e of list){
   if(e.dying>0){e.dying-=dt;continue;}
   if(!e.alive)continue;
   e.hitFlash=Math.max(0,e.hitFlash-dt*5);e.anim=Math.max(0,e.anim-dt);
   if(e.type==='leaper'&&e.state!=='run'&&e.state!=='fight'){leaper(e,dt,craftPos);continue;}
   const target=nearestSurvivor(e.pos);
   if(e.state==='windup'){
    e.timer-=dt;
    if(e.timer<=0){
     // A chunk of the street, lobbed with part of the lead: holding the orbit gets you hit.
     head.copy(e.pos).setY(e.height+1);if(actors[e.index]?.actor.handWorld(hand))head.copy(hand);
     const flight=THREE.MathUtils.clamp(head.distanceTo(craftPos)/80,1.6,6);
     tmp.copy(craftPos).addScaledVector(craft.state.vel,flight*.6);dir.subVectors(tmp,head).divideScalar(flight);dir.y+=.5*GRAVITY*flight;
     combat.throwRock(head,dir,2.2);e.state='run';e.throwClock=5+Math.random()*4;
    }
    continue;
   }
   if(!target){e.state='run';continue;}
   const dist=steer(e,target.pos,dt);
   if(e.type==='bloater'){if(dist<e.reach)burst(e);continue;}
   if(dist<e.reach){e.state='fight';survivors.damage(target,e.dps*dt);}else e.state='run';
   e.throwClock-=dt;
   if(e.throwClock<=0){
    e.throwClock=3+Math.random()*5;
    head.copy(e.pos).setY(e.height);
    if(e.type==='brute'&&head.distanceTo(craftPos)<e.range&&canSee(head,craftPos)){e.state='windup';e.timer=e.windup;}
    else if(e.type==='runner'&&dist>12&&dist<55){
     // Junk thrown at the team on the run.
     const flight=THREE.MathUtils.clamp(dist/22,.8,2.2);tmp.copy(target.pos).setY(1);
     dir.subVectors(tmp,head).divideScalar(flight);dir.y+=.5*GRAVITY*flight;combat.throwRock(head,dir,.6);e.anim=.9;
    }
   }
  }
  sync(dt);
 }
 // Perched on a roof until the gunship comes low and near; a moment's crouch (the tell), then
 // a leap at where it will be. A hit claws the hull and the leaper falls away; a miss lands it
 // in the street, where it hunts the team.
 function leaper(e,dt,craftPos){
  if(e.state==='perch'){
   const flat=Math.hypot(craftPos.x-e.pos.x,craftPos.z-e.pos.z);
   if(flat<380&&craftPos.y-e.pos.y<e.leapReach){e.state='crouch';e.timer=e.crouch;api.onCrouch?.(e);}
  }else if(e.state==='crouch'){
   e.timer-=dt;
   if(e.timer<=0){
    // Aim along the orbit, where the gunship will be when the leap arrives, a little off.
    const T=THREE.MathUtils.clamp(e.pos.distanceTo(craftPos)/95,1.4,4);
    craft.predict(T,tmp).add(dir.set((Math.random()-.5)*26,(Math.random()-.5)*10,(Math.random()-.5)*26));
    e.vel.subVectors(tmp,e.pos).divideScalar(T);e.vel.y+=.5*GRAVITY*T;
    e.state='leap';usedRoofs.delete(e.roof);
   }
  }else if(e.state==='leap'){
   e.vel.y-=GRAVITY*dt;e.pos.addScaledVector(e.vel,dt);
   if(e.pos.distanceTo(craftPos)<11){craft.hurt(20,e.pos);e.state='fall';e.vel.set(e.vel.x*.2,-5,e.vel.z*.2);}
   else if(e.pos.y<=0){e.pos.y=0;e.state='run';}
  }else if(e.state==='fall'){
   e.vel.y-=GRAVITY*dt;e.pos.addScaledVector(e.vel,dt);
   if(e.pos.y<=0){e.pos.y=0;damage(e,999);}
  }
 }
 function sync(dt=0){
  const craftPos=craft.state.pos;
  for(const e of list){
   const a=actors[e.index],shown=e.alive||e.dying>0;
   if(!shown){stand.setMatrixAt(e.index,zero);if(a)a.holder.visible=false;continue;}
   const target=nearestSurvivor(e.pos),look=e.state==='windup'||e.type==='leaper'&&e.state!=='run'&&e.state!=='fight'?craftPos:target?.pos||craftPos;
   const face=Math.atan2(look.x-e.pos.x,look.z-e.pos.z);
   if(a){
    stand.setMatrixAt(e.index,zero);
    a.holder.visible=true;a.holder.position.copy(e.pos);a.holder.rotation.y=face;
    a.actor.play(...animation(e),dt);
   }else{
    e3.set(0,face,0);q.setFromEuler(e3);const k=e.height/1.8;stand.setMatrixAt(e.index,m.compose(e.pos,q,s.set(k,k,k)));
   }
  }
  stand.instanceMatrix.needsUpdate=true;
 }
 // What each creature is doing, as a clip and a speed.
 function animation(e){
  if(!e.alive)return['die',1];
  if(e.type==='leaper'){
   if(e.state==='perch'||e.state==='crouch')return['idle',e.state==='crouch'?2:1];
   if(e.state==='leap'||e.state==='fall')return['leap',1];
  }
  if(e.state==='windup')return['throw',2.4/e.windup];
  if(e.state==='fight')return[e.type==='brute'?'slam':'attack',1.2];
  if(e.anim>0)return['throw',1.8];
  if(e.type==='bloater')return['walk',.9];
  if(e.type==='brute')return['walk',1.1];
  return['run',e.type==='runner'?1.1:1.3];
 }
 function damage(e,amount){
  if(!e||!e.alive)return;e.hp-=amount;e.hitFlash=1;
  if(e.hp>0)return;
  if(e.type==='bloater'){burst(e);return;}
  e.alive=false;e.dying=CORPSE;kills++;usedRoofs.delete(e.roof);
  combat.blast(tmp.copy(e.pos).setY(e.height*.5),e.type==='brute'?6:2.5,.5);
 }
 const api={list,ready,update,sync,spawn,wave,perch,damage,onBurst:null,onCrouch:null,
  center:(e,out)=>out.copy(e.pos).setY(e.pos.y+e.height*.55),
  alive:()=>list.filter(e=>e.alive).length,kills:()=>kills,
  reset(){for(const e of list){e.alive=false;e.dying=0;}usedRoofs.clear();kills=0;sync();}};
 return api;
}
