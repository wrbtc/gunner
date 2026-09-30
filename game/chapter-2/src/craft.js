import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {BOWL_RADIUS,CEILING,colliderPush} from './world.js?v=ch2-08';
import {AIRFRAME,loadAirframe} from './airframe.js?v=ch2-08';

// The Satoshi as a hover gunship, and you fly it: W A S D push it toward and across where the
// sensor looks, Space and C climb and drop, and it drifts and settles instead of stopping dead.
// The nose swings round to follow the sensor. The sensor is ground-stabilised and turns all the
// way round, so the target stays put while you fly. O hands the plane to the pilot, who holds a
// pylon turn round the target, AC-130 style, until you touch a flight key again.
export const CRAFT=Object.freeze({
 // The sculpt is 22 long and 29.4 wide; at .5 it is an 11 m, 15 m span aircraft.
 modelScale:.5,
 accel:68,maxSpeed:72,climb:32,drag:1.2,turnRate:1.4,radius:7,
 orbitSpeed:46,orbitRadius:320,minOrbitAlt:260,bank:.42,
 // How far the pilot's orbit keeps clear of anything below it, and the sensor's pitch range,
 // from nearly straight down to a little above level. It turns freely all the way round.
 clearance:30,pitchMin:-1.5,pitchMax:.2,
 chaseBack:60,chaseUp:18,chaseFov:55,
 start:Object.freeze({pos:[0,430,1260],look:[0,0,1000]})
});

// Stand-in until the sculpt arrives, and the fallback if it never does.
function greyboxSatoshi(){
 const g=[],b=(w,h,d,x,y,z)=>g.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 b(3.2,3,15,0,0,-1);      // fuselage pod
 b(2.2,1.4,3,0,1.8,-5.2); // canopy
 b(26,.6,4.2,0,.4,0);     // wing
 for(const x of [-5.2,5.2]){b(1.8,1.8,17,x,.3,3.5);b(.4,4,3,x,2.2,11.5);} // booms and fins
 b(11,.4,2.6,0,3.8,11.5); // tailplane
 const body=new THREE.Mesh(mergeGeometries(g),new THREE.MeshLambertMaterial({color:0x6a6e55}));
 const group=new THREE.Group();group.add(body);group.scale.setScalar(.55);group.position.y=.8;group.name='Satoshi gunship (grey box)';
 return group;
}

// The refit, in the sculpt's own units: a ducted lift fan in each outer wing, the propellers,
// a swivel nozzle under each tail boom, and the three guns out of the left flank.
function refit(materials){
 const parts=new THREE.Group();parts.name='Gunship refit';
 const rotors=[],glows=[],nozzles=[],props=[];
 const bladeSet=(count,make)=>mergeGeometries(Array.from({length:count},(_,i)=>make(i)));
 for(const [x,y,z] of AIRFRAME.fans){
  const fan=new THREE.Group();fan.position.set(x,y,z);
  const duct=new THREE.Mesh(new THREE.CylinderGeometry(1.42,1.42,.9,28,1,true),materials.duct);
  const lips=new THREE.Mesh(mergeGeometries([.45,-.45].map(ly=>new THREE.TorusGeometry(1.42,.09,6,28).rotateX(Math.PI/2).translate(0,ly,0))),materials.metal);
  const rotor=new THREE.Mesh(mergeGeometries([new THREE.CylinderGeometry(.3,.3,.34,12),
   bladeSet(7,i=>new THREE.BoxGeometry(1.08,.05,.3).rotateX(.38).translate(.8,0,0).rotateY(i/7*Math.PI*2))]),materials.rotor);
  rotor.position.y=.2;
  const glow=new THREE.Mesh(new THREE.CircleGeometry(1.32,28).rotateX(Math.PI/2).translate(0,-.47,0),materials.glow.clone());
  fan.add(duct,lips,rotor,glow);parts.add(fan);rotors.push(rotor);glows.push(glow);
 }
 for(const [x,y,z] of AIRFRAME.spinners){
  const prop=new THREE.Mesh(bladeSet(3,i=>new THREE.BoxGeometry(.26,1.95,.08).translate(0,1.02,0).rotateZ(i/3*Math.PI*2)),materials.rotor);
  prop.position.set(x,y,z+.42);parts.add(prop);props.push(prop);
 }
 for(const [x,y,z] of AIRFRAME.nozzles){
  const pivot=new THREE.Group();pivot.position.set(x,y,z);
  const bell=new THREE.Mesh(new THREE.CylinderGeometry(.34,.5,1.2,14,1,true).translate(0,-.6,0),materials.duct);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.3,14).translate(0,-.05,0),materials.metal);
  pivot.add(bell,collar);parts.add(pivot);nozzles.push(pivot);
 }
 // Side guns, pointing out and a little down from the left flank: 25 mm forward, 40 mm
 // behind the wing root, the 105 aft. The sensor ball sits just ahead of them.
 const guns=new THREE.Mesh(mergeGeometries(AIRFRAME.guns.map(([x,y,z,r,len])=>
  new THREE.CylinderGeometry(r*.8,r,len,12).rotateZ(Math.PI/2).rotateZ(.12).translate(x-len/2,y,z))),materials.metal);
 const sensor=new THREE.Mesh(new THREE.SphereGeometry(.36,16,10).translate(...AIRFRAME.sensor),materials.glass);
 parts.add(guns,sensor);
 return {parts,rotors,glows,nozzles,props};
}

export function createCraft(scene,world){
 const materials={
  metal:new THREE.MeshStandardMaterial({color:0x4a4f49,metalness:.45,roughness:.5}),
  duct:new THREE.MeshStandardMaterial({color:0x2c302d,metalness:.4,roughness:.6,side:THREE.DoubleSide}),
  rotor:new THREE.MeshStandardMaterial({color:0x8d8e82,metalness:.5,roughness:.45}),
  glass:new THREE.MeshStandardMaterial({color:0x6a7b76,metalness:.15,roughness:.22,emissive:0x0b1413}),
  glow:new THREE.MeshBasicMaterial({color:0xff9a4a,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide})
 };
 const group=new THREE.Group();group.name='Satoshi';scene.add(group);
 let hull=greyboxSatoshi(),kit=null;group.add(hull);
 const model={group,get sculpted(){return !!kit;}};
 // Swap the sculpt in when it arrives; the grey box stays if it never does.
 model.ready=loadAirframe().then(airframe=>{
  const holder=new THREE.Group();holder.name='Satoshi airframe and refit';holder.scale.setScalar(CRAFT.modelScale);
  kit=refit(materials);holder.add(airframe,kit.parts);
  group.remove(hull);hull=holder;group.add(holder);
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
 // O: the pilot circles a point, starting from wherever the plane is now.
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
   push.set(0,0,0).addScaledVector(fwd,input.forward).addScaledVector(right,input.strafe);
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
  // Bank into turns and slides, nod into acceleration: the hover reads as weight.
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));right.set(-fwd.z,0,fwd.x);
  const side=state.vel.dot(right),ahead=state.vel.dot(fwd);
  state.bank+=(THREE.MathUtils.clamp(-side/CRAFT.maxSpeed,-1,1)*.42+(state.orbiting?CRAFT.bank*.5:0)-state.bank)*(1-Math.exp(-3*dt));
  state.tilt+=(THREE.MathUtils.clamp(-ahead/CRAFT.maxSpeed,-1,1)*.14-state.tilt)*(1-Math.exp(-3*dt));
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
 // The sensor ball under the nose, stabilised: it neither banks nor pitches with the airframe.
 function sensorPos(out){
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));
  return out.copy(state.pos).addScaledVector(fwd,3.5).add(tmp.set(0,-1.4,0));
 }
 const aimDir=()=>tmp.set(-Math.sin(state.aimYaw)*Math.cos(state.aimPitch),Math.sin(state.aimPitch),-Math.cos(state.aimYaw)*Math.cos(state.aimPitch));
 const camTarget=new THREE.Vector3(),camWant=new THREE.Vector3();
 function placeCamera(camera,dt,fov){
  if(state.view==='sensor'){
   sensorPos(camera.position);
   camera.fov+=(fov-camera.fov)*(dt>0?1-Math.exp(-10*dt):1);
   camTarget.copy(camera.position).add(aimDir());camera.up.set(0,1,0);camera.lookAt(camTarget);
  }else{
   // Outside: behind and above the plane, looking past it the way the sensor looks.
   const dir=aimDir().clone();dir.y=Math.max(dir.y,-.5);dir.normalize();
   camWant.copy(state.pos).addScaledVector(dir,-CRAFT.chaseBack).add(tmp.set(0,CRAFT.chaseUp,0));
   camera.position.lerp(camWant,dt>0?1-Math.exp(-6*dt):1);
   camera.fov+=(CRAFT.chaseFov-camera.fov)*(dt>0?1-Math.exp(-8*dt):1);
   camTarget.copy(state.pos).addScaledVector(dir,60);camera.up.set(0,1,0);camera.lookAt(camTarget);
  }
  camera.near=1;camera.updateProjectionMatrix();
 }
 let lastTime=0,spin=0,propSpin=0;
 function syncModel(time){
  const dt=Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
  group.position.copy(state.pos);
  group.rotation.set(state.tilt,state.heading,state.bank,'YXZ');
  // From the sensor you don't see your own aircraft, as on the gunship's feed.
  group.visible=state.view!=='sensor';
  if(!kit)return;
  const effort=THREE.MathUtils.clamp(.55+state.lift*.45,.2,1.2);
  spin+=dt*(22+effort*26);propSpin+=dt*40;
  kit.rotors.forEach((r,i)=>r.rotation.y=i?spin:-spin);
  kit.props.forEach((p,i)=>p.rotation.z=i?propSpin:-propSpin);
  const flicker=.9+.1*Math.sin(time*37);
  kit.glows.forEach(g=>g.material.opacity=(.14+effort*.26)*flicker);
  kit.nozzles.forEach(n=>n.rotation.x+=(-.3-n.rotation.x)*(1-Math.exp(-4*dt)));
 }
 // Proof shots: put the plane on a circle round a point and hand it to the pilot.
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
  // Where the gunship will be in t seconds: round the orbit if the pilot has it, straight on if not.
  predict(t,out){
   if(!state.orbiting)return out.copy(state.pos).addScaledVector(state.vel,t);
   const o=state.orbit,a=o.angle-CRAFT.orbitSpeed/o.radius*t;return out.set(o.center.x+Math.cos(a)*o.radius,o.alt,o.center.z+Math.sin(a)*o.radius);
  },
  // Mouse: turn the sensor, all the way round and from straight down to a little above level.
  slew(dx,dy){state.aimYaw-=dx;state.aimPitch=THREE.MathUtils.clamp(state.aimPitch-dy,CRAFT.pitchMin,CRAFT.pitchMax);},
  // Rounds leave the chin guns beside the sensor, so aim and fire agree.
  muzzle(out,weapon){sensorPos(out);return out.add(tmp.set(0,-.5-weapon*.2,0));},
  reset(){state.hull=100;state.view='sensor';state.zoom=false;start();}};
}
