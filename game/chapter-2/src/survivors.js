import * as THREE from '../../vendor/three.module.js?v=052';
import {ENEMY_LAYER} from './enemies.js?v=ch2-08';
import {FX_LAYER} from './combat.js?v=ch2-08';
import {loadCast} from './cast.js?v=ch2-08';

// The ground team: four survivors crossing downtown up the grand avenue to the Warden, and
// on round the plinth to the crater once its seal breaks. Each wears an infrared strobe the
// sensor sees as a blinking point, as the friendlies do on the gunship's feed. They fight
// back, they stop to hold when the infected close in, and your own rounds can kill them.
export const TEAM=Object.freeze(['Vega','Okafor','Brandt','Sato']);
// Up the avenue from the south to the plaza at the statue's feet.
export const APPROACH=Object.freeze([[0,1000],[0,880],[0,760],[0,640],[0,520],[0,400],[0,268]]);
// From the plaza round the east side of the plinth to the crater's rim, at a sprint.
export const TO_CRATER=Object.freeze([[120,262],[252,240],[252,-156],[80,-156]]);
const SPEED=4,HOLD_RANGE=45,FIRE_RANGE=75,HP=100;
const FORMATION=[[-3,-3],[3,-3],[-3,3],[3,3]];

export function createSurvivors(scene,combat){
 const list=TEAM.map((name,i)=>({index:i,name,hp:HP,alive:true,pos:new THREE.Vector3(APPROACH[0][0]+FORMATION[i][0],0,APPROACH[0][1]+FORMATION[i][1]),
  radius:.7,height:1.8,fireClock:Math.random()*.5,hitFlash:0,friendly:true}));
 const team={route:APPROACH,leg:1,holding:false,calm:0,arrived:false,moving:true};
 const body=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.4,1,3,8).translate(0,.9,0),new THREE.MeshLambertMaterial({color:0x55604a}),list.length);
 body.layers.set(ENEMY_LAYER);body.frustumCulled=false;body.name='Survivors (stand-in)';scene.add(body);
 const strobe=new THREE.InstancedMesh(new THREE.SphereGeometry(.9,8,6),new THREE.MeshBasicMaterial({color:0xffffff,fog:false}),list.length);
 strobe.layers.set(FX_LAYER);strobe.frustumCulled=false;strobe.name='Infrared strobes';scene.add(strobe);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),zero=new THREE.Matrix4().makeScale(0,0,0);
 // The survivor model from the cast replaces the capsules once it loads.
 let actors=null;
 const ready=loadCast('survivor').then(kit=>{
  actors=list.map(()=>{const holder=new THREE.Group();holder.name='Survivor';scene.add(holder);const actor=kit.make(holder);actor.play('idle');
   holder.traverse(o=>o.layers.set(ENEMY_LAYER));return {holder,actor,last:new THREE.Vector3(),face:0};});
  sync(0);return true;
 }).catch(()=>false);
 const center=new THREE.Vector3(),goal=new THREE.Vector3(),step=new THREE.Vector3(),muzzle=new THREE.Vector3(),aim=new THREE.Vector3();
 let clock=0,hostiles=null;

 function teamCenter(out){
  out.set(0,0,0);let n=0;for(const p of list)if(p.alive){out.add(p.pos);n++;}
  return n?out.divideScalar(n):out;
 }
 // Nearest living infected to a point, from whatever the horde and the statue put in the street.
 function nearestHostile(pt,range){
  let best=null,bestD=range;
  for(const e of hostiles?.()||[]){if(!e.alive)continue;const d=e.pos.distanceTo(pt);if(d<bestD){bestD=d;best=e;}}
  return best;
 }
 function update(dt,horde){
  clock+=dt;hostiles=()=>horde.list;
  const alive=list.filter(p=>p.alive);if(!alive.length)return;
  teamCenter(center);
  // Hold and fight while anything is close; move on after two quiet seconds.
  const threat=nearestHostile(center,HOLD_RANGE);
  if(threat){team.holding=true;team.calm=0;}else{team.calm+=dt;if(team.calm>2)team.holding=false;}
  team.moving=!team.holding&&!team.arrived;
  if(team.moving){
   const [gx,gz]=team.route[team.leg];goal.set(gx,0,gz);
   if(center.distanceTo(goal)<3){if(team.leg<team.route.length-1)team.leg++;else team.arrived=true;}
  }
  for(const p of alive){
   p.hitFlash=Math.max(0,p.hitFlash-dt*4);
   if(team.moving){
    const [gx,gz]=team.route[team.leg],[fx,fz]=FORMATION[p.index];
    step.set(gx+fx,0,gz+fz).sub(p.pos);const d=step.length();
    if(d>.05)p.pos.addScaledVector(step,Math.min(d,(team.route===TO_CRATER?5.5:SPEED)*dt)/d);
   }
   // Aimed single shots at the nearest infected in range.
   p.fireClock-=dt;
   const target=nearestHostile(p.pos,FIRE_RANGE);p.aim=target?target.pos:null;
   if(target&&p.fireClock<=0){
    // Short, frightened bursts: they slow the horde down, they can't stop it.
    p.fireClock=.75+Math.random()*.45;
    muzzle.copy(p.pos).setY(1.4);horde.center(target,aim);
    combat.tracer(muzzle,aim);
    if(Math.random()<.35)horde.damage(target,12);
   }
  }
  sync(dt);
 }
 function sync(dt=0){
  list.forEach((p,i)=>{
   const a=actors?.[i];
   if(a){
    // Run while moving, stand and face the fight while holding; the fallen stay where they fell.
    body.setMatrixAt(i,zero);a.holder.position.copy(p.pos);
    const speed=dt>0?a.last.distanceTo(p.pos)/dt:0;
    if(speed>.5)a.face=Math.atan2(p.pos.x-a.last.x,p.pos.z-a.last.z);else if(p.aim)a.face=Math.atan2(p.aim.x-p.pos.x,p.aim.z-p.pos.z);
    a.last.copy(p.pos);a.holder.rotation.y=a.face;
    a.actor.play(!p.alive?'die':speed>.5?'run':p.aim?'shoot':'idle',dt,!p.alive?1:speed>.5?speed/4.5:p.aim?.35:1);
   }
   if(!p.alive){if(!a)body.setMatrixAt(i,zero);strobe.setMatrixAt(i,zero);return;}
   if(!a){q.identity();body.setMatrixAt(i,m.compose(p.pos,q,s.setScalar(1)));}
   // One flash a second, each strobe on its own beat.
   const on=((clock+i*.23)%1)<.12;
   strobe.setMatrixAt(i,on?m.compose(step.copy(p.pos).setY(2.1),q,s.setScalar(1)):zero);
  });
  body.instanceMatrix.needsUpdate=true;strobe.instanceMatrix.needsUpdate=true;
 }
 function damage(p,amount){
  if(!p||!p.alive)return;p.hp-=amount;p.hitFlash=1;
  if(p.hp<=0){p.hp=0;p.alive=false;api.onDown?.(p);}
 }
 const api={list,team,ready,update,damage,sync,onDown:null,
  center:(p,out)=>out.copy(p.pos).setY(1),
  alive:()=>list.filter(p=>p.alive).length,
  centerOf:out=>teamCenter(out),
  // Stage two: the leg round the plinth to the crater.
  headForCrater(){team.route=TO_CRATER;team.leg=0;team.arrived=false;},
  // Proof shots: stand the team at a spot in formation.
  placeAt(x,z){list.forEach((p,i)=>p.pos.set(x+FORMATION[i][0],0,z+FORMATION[i][1]));sync();},
  reset(){
   list.forEach((p,i)=>{p.hp=HP;p.alive=true;p.hitFlash=0;p.pos.set(APPROACH[0][0]+FORMATION[i][0],0,APPROACH[0][1]+FORMATION[i][1]);});
   Object.assign(team,{route:APPROACH,leg:1,holding:false,calm:0,arrived:false,moving:true});clock=0;sync();
  }};
 sync();
 return api;
}
