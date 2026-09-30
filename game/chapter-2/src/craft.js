import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {BOWL_RADIUS,CEILING,colliderPush} from './world.js?v=ch2-08';
import {loadHeli} from './heli.js?v=ch2-08';

// The Satoshi as an attack helicopter, and you fly it: W A S D push it toward and across where
// the sensor looks, Space and C climb and drop, and let go and it settles into a hover.
// The nose swings round to follow the sensor. The sensor is ground-stabilised and turns all the
// way round, so the target stays put while you fly. O hands the stick to the pilot, who holds a
// pylon turn round the target, AC-130 style, until you touch a flight key again.
export const CRAFT=Object.freeze({
 accel:68,maxSpeed:72,climb:32,drag:1.2,turnRate:1.8,radius:7,
 orbitSpeed:46,orbitRadius:320,minOrbitAlt:260,bank:.42,
 // How far the pilot's orbit keeps clear of anything below it, and the sensor's pitch range,
 // from nearly straight down to a little above level. It turns freely all the way round.
 clearance:30,pitchMin:-1.5,pitchMax:.2,
 // The sensor turret sits under the chin, 6.8 m ahead of the rotor mast and 1.2 m down.
 sensorAhead:6.8,sensorDrop:1.2,
 chaseBack:50,chaseUp:14,chaseFov:55,
 start:Object.freeze({pos:[0,430,1260],look:[0,0,1000]})
});

// Stand-in until the sculpt arrives, and the fallback if it never does: a 15 m tandem gunship.
function greyboxHeli(){
 const g=[],b=(w,h,d,x,y,z)=>g.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 b(1.6,2.2,8,0,0,-2.5);     // cabin and engines
 b(.6,.8,7.5,0,.3,4.5);     // tail boom
 b(.2,2.4,1.4,0,1.4,7.4);   // fin
 b(5.6,.3,1.2,0,-.2,-1.2);  // stub wings
 const body=new THREE.Mesh(mergeGeometries(g),new THREE.MeshLambertMaterial({color:0x5c6146}));
 const group=new THREE.Group();group.add(body);group.name='Satoshi (grey box)';
 return group;
}

export function createCraft(scene,world){
 const materials={
  blade:new THREE.MeshLambertMaterial({color:0x2e302b}),
  blur:new THREE.MeshBasicMaterial({color:0x3a3c36,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide})
 };
 const group=new THREE.Group();group.name='Satoshi';scene.add(group);
 let hull=greyboxHeli(),kit=null;group.add(hull);
 const model={group,get sculpted(){return !!kit;}};
 // Swap the sculpt in when it arrives; the grey box stays if it never does.
 model.ready=loadHeli(materials).then(heli=>{
  kit=heli;group.remove(hull);hull=heli.holder;group.add(hull);
  return true;
 }).catch(()=>false);

 const S=CRAFT.start;
 const state={
  pos:new THREE.Vector3(...S.pos),vel:new THREE.Vector3(),heading:0,bank:0,tilt:0,hull:100,
  view:'sensor',zoom:false,weapon:0,aimYaw:0,aimPitch:-.6,
  orbiting:false,orbit:{center:new THREE.Vector3(),radius:CRAFT.orbitRadius,alt:0,floor:0,angle:0},
  lift:0,thrust:0,track:null
 };
 const tmp=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),push=new THREE.Vector3(),normal=new THREE.Vector3();
 const orbitPoint=new THREE.Vector3(),tangent=new THREE.Vector3(),desired=new THREE.Vector3(),eye=new THREE.Vector3();

 // The highest thing under a circle: the pilot won't orbit lower than that plus clearance.
 function orbitFloor(center,radius){
  let top=0;
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;top=Math.max(top,world.topNear(center.x+Math.cos(a)*radius,center.z+Math.sin(a)*radius,CRAFT.clearance));}
  return top+CRAFT.clearance;
 }
 // Point the sensor at a world position.
 function lookAt(point){
  tmp.subVectors(point,sensorPos(eye));
  state.aimYaw=Math.atan2(-tmp.x,-tmp.z);
  state.aimPitch=THREE.MathUtils.clamp(Math.asin(tmp.y/Math.max(1e-3,tmp.length())),CRAFT.pitchMin,CRAFT.pitchMax);
 }
 // O: the pilot circles a point, starting from wherever the helicopter is now.
 function orbitAt(point){
  const o=state.orbit;o.center.set(point.x,0,point.z);
  const flat=Math.hypot(state.pos.x-point.x,state.pos.z-point.z);
  o.radius=THREE.MathUtils.clamp(flat,220,480);
  o.floor=orbitFloor(o.center,o.radius);o.alt=Math.max(state.pos.y,o.floor,CRAFT.minOrbitAlt);
  o.angle=Math.atan2(state.pos.z-point.z,state.pos.x-point.x);state.orbiting=true;
 }
 function step(dt,input){
  state.lift=input.lift;state.thrust=input.forward;
  if(input.forward||input.strafe||input.lift)state.orbiting=false;
  let wantHeading=state.aimYaw;
  const o=state.orbit;
  push.set(0,0,0);
  if(state.orbiting){
   // A left-hand pylon turn: the target stays off the left side, as on the AC-130.
   o.angle-=CRAFT.orbitSpeed/o.radius*dt;
   orbitPoint.set(o.center.x+Math.cos(o.angle)*o.radius,o.alt,o.center.z+Math.sin(o.angle)*o.radius);
   tangent.set(Math.sin(o.angle),0,-Math.cos(o.angle));
   wantHeading=Math.atan2(-tangent.x,-tangent.z);
   desired.copy(tangent).multiplyScalar(CRAFT.orbitSpeed).addScaledVector(tmp.subVectors(orbitPoint,state.pos),1.1);
   state.vel.lerp(desired,1-Math.exp(-2.2*dt));
  }else{
   // Flight is relative to the sensor: W toward where you look, A and D across it.
   fwd.set(-Math.sin(state.aimYaw),0,-Math.cos(state.aimYaw));right.set(-fwd.z,0,fwd.x);
   push.addScaledVector(fwd,input.forward).addScaledVector(right,input.strafe);
   if(push.lengthSq()>1)push.normalize();
   state.vel.addScaledVector(push,CRAFT.accel*dt);
   state.vel.y+=input.lift*CRAFT.accel*.8*dt;
   state.vel.multiplyScalar(Math.exp(-CRAFT.drag*dt));
  }
  const flat=Math.hypot(state.vel.x,state.vel.z),top=state.orbiting?CRAFT.orbitSpeed*1.6:CRAFT.maxSpeed;
  if(flat>top){state.vel.x*=top/flat;state.vel.z*=top/flat;}
  state.vel.y=THREE.MathUtils.clamp(state.vel.y,-CRAFT.climb,CRAFT.climb);
  state.pos.addScaledVector(state.vel,dt);
  collide();
  // The nose chases the sensor (or the orbit's tangent) at a big aircraft's turn rate.
  let d=wantHeading-state.heading;d=Math.atan2(Math.sin(d),Math.cos(d));
  state.heading+=THREE.MathUtils.clamp(d*(1-Math.exp(-4*dt)),-CRAFT.turnRate*dt,CRAFT.turnRate*dt);
  // A helicopter leans the way it goes: the nose dips to speed up and flares to stop, and it
  // rolls into slides and turns. The push counts as well as the speed, so it reads as weight.
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));right.set(-fwd.z,0,fwd.x);
  const side=state.vel.dot(right)+push.dot(right)*16,ahead=state.vel.dot(fwd)+push.dot(fwd)*16;
  state.bank+=(THREE.MathUtils.clamp(-side/CRAFT.maxSpeed,-1,1)*.38+(state.orbiting?CRAFT.bank*.5:0)-state.bank)*(1-Math.exp(-3*dt));
  state.tilt+=(THREE.MathUtils.clamp(-ahead/CRAFT.maxSpeed,-1,1)*.24-state.tilt)*(1-Math.exp(-3*dt));
  // Ground-stabilised: the sensor stays on the spot you aimed at while you fly.
  if(state.track)lookAt(state.track);
 }
 function collide(){
  const r=CRAFT.radius,p=state.pos,v=state.vel;
  if(p.y<r+3){p.y=r+3;v.y=Math.max(0,v.y);}
  if(p.y>CEILING){p.y=CEILING;v.y=Math.min(0,v.y);}
  const flat=Math.hypot(p.x,p.z);
  if(flat>BOWL_RADIUS){p.x*=BOWL_RADIUS/flat;p.z*=BOWL_RADIUS/flat;const n=tmp.set(p.x,0,p.z).normalize(),out=v.dot(n);if(out>0)v.addScaledVector(n,-out);}
  // Push out of buildings and stone through the nearest face, and lose the speed into it.
  for(const c of world.collidersNear(p,r+4)){
   if(!colliderPush(c,p,r,normal))continue;
   const into=v.dot(normal);if(into<0)v.addScaledVector(normal,-into);
  }
 }
 // The sensor turret under the chin, stabilised: it neither banks nor pitches with the airframe.
 function sensorPos(out){
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));
  return out.copy(state.pos).addScaledVector(fwd,CRAFT.sensorAhead).add(tmp.set(0,-CRAFT.sensorDrop,0));
 }
 const aimDir=()=>tmp.set(-Math.sin(state.aimYaw)*Math.cos(state.aimPitch),Math.sin(state.aimPitch),-Math.cos(state.aimYaw)*Math.cos(state.aimPitch));
 const camTarget=new THREE.Vector3(),camWant=new THREE.Vector3();
 function placeCamera(camera,dt,fov){
  if(state.view==='sensor'){
   sensorPos(camera.position);
   camera.fov+=(fov-camera.fov)*(dt>0?1-Math.exp(-10*dt):1);
   camTarget.copy(camera.position).add(aimDir());camera.up.set(0,1,0);camera.lookAt(camTarget);
  }else{
   // Outside: behind and above the helicopter, looking past it the way the sensor looks.
   const dir=aimDir().clone();dir.y=Math.max(dir.y,-.5);dir.normalize();
   camWant.copy(state.pos).addScaledVector(dir,-CRAFT.chaseBack).add(tmp.set(0,CRAFT.chaseUp,0));
   camera.position.lerp(camWant,dt>0?1-Math.exp(-6*dt):1);
   camera.fov+=(CRAFT.chaseFov-camera.fov)*(dt>0?1-Math.exp(-8*dt):1);
   camTarget.copy(state.pos).addScaledVector(dir,60);camera.up.set(0,1,0);camera.lookAt(camTarget);
  }
  camera.near=1;camera.updateProjectionMatrix();
 }
 let lastTime=0,spin=0,tailSpin=0;
 function syncModel(time){
  const dt=Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
  // A hover never sits quite still: a slow bob and sway on top of the flight model.
  group.position.copy(state.pos);group.position.y+=Math.sin(time*1.3)*.25;
  group.rotation.set(state.tilt+Math.sin(time*.9)*.008,state.heading,state.bank+Math.sin(time*1.1)*.012,'YXZ');
  // From the sensor you don't see your own aircraft, as on the gunship's feed.
  group.visible=state.view!=='sensor';
  if(!kit)return;
  // The blades turn slower than the real rotor so the eye can follow them; the disc carries
  // the rest, a touch darker when the pilot pulls power to climb.
  const effort=THREE.MathUtils.clamp(.6+state.lift*.4,.2,1);
  spin+=dt*(9+effort*3);tailSpin+=dt*31;
  kit.main.spinner.rotation.y=-spin;kit.tail.spinner.rotation.y=tailSpin;
  kit.main.disc.material.opacity=.08+effort*.1;kit.tail.disc.material.opacity=.12;
 }
 // Proof shots: put the helicopter on a circle round a point and hand it to the pilot.
 function setOrbit({center,radius=380,alt=560,angle=0}){
  const o=state.orbit;o.center.set(center[0],0,center[1]);o.radius=radius;
  o.floor=orbitFloor(o.center,radius);o.alt=Math.max(alt,o.floor);o.angle=angle;
  state.pos.set(o.center.x+Math.cos(angle)*radius,o.alt,o.center.z+Math.sin(angle)*radius);
  tangent.set(Math.sin(angle),0,-Math.cos(angle));state.heading=Math.atan2(-tangent.x,-tangent.z);
  state.vel.copy(tangent).multiplyScalar(CRAFT.orbitSpeed);state.orbiting=true;state.track=null;
  lookAt(o.center);
 }
 function start(){
  state.pos.set(...S.pos);state.vel.set(0,0,0);state.orbiting=false;state.track=null;state.bank=state.tilt=0;
  lookAt(tmp.set(...S.look));state.heading=state.aimYaw;
 }
 start();
 return {state,model,step,placeCamera,syncModel,setOrbit,lookAt,sensorPos,orbitAt,aimDir:()=>aimDir().clone(),
  // Where the helicopter will be in t seconds: round the orbit if the pilot has it, straight on if not.
  predict(t,out){
   if(!state.orbiting)return out.copy(state.pos).addScaledVector(state.vel,t);
   const o=state.orbit,a=o.angle-CRAFT.orbitSpeed/o.radius*t;return out.set(o.center.x+Math.cos(a)*o.radius,o.alt,o.center.z+Math.sin(a)*o.radius);
  },
  // Mouse: turn the sensor, all the way round and from straight down to a little above level.
  slew(dx,dy){state.aimYaw-=dx;state.aimPitch=THREE.MathUtils.clamp(state.aimPitch-dy,CRAFT.pitchMin,CRAFT.pitchMax);},
  // The 30 mm fires from the chin, just under the sensor, so aim and fire agree. Missiles
  // leave the outer wing pods and rockets the inner ones, left and right in turn.
  muzzle(out,weapon,side=1){
   if(weapon===2){sensorPos(out);return out.add(tmp.set(0,-.6,0));}
   fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));right.set(-fwd.z,0,fwd.x);
   return out.copy(state.pos).addScaledVector(right,side*(weapon?2.3:3.4)).addScaledVector(fwd,2.6).add(tmp.set(0,-1,0));
  },
  reset(){state.hull=100;state.view='sensor';state.zoom=false;start();}};
}
