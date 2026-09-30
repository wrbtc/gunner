import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {BOWL_RADIUS,CEILING} from './world.js?v=ch2-08';
import {AIRFRAME,loadAirframe} from './airframe.js?v=ch2-08';

// The Satoshi as a gunship, flown the way the AC-130 is: the pilot holds a left-hand pylon
// turn round a point and the guns look out of the left side at it. You don't fly the plane;
// you tell the pilot where to circle (W A S D slide the orbit, Space and C raise and lower
// it, O circles where you aim) and work the sensor and the guns.
export const CRAFT=Object.freeze({
 // The sculpt is 22 long and 29.4 wide; at .5 it is an 11 m, 15 m span aircraft.
 modelScale:.5,
 orbitSpeed:46,radius:380,minAlt:260,maxAlt:CEILING-20,startAlt:560,
 slideSpeed:120,climbRate:45,bank:.42,
 // How far the orbit keeps clear of anything below it, and the sensor's gimbal limits:
 // yaw either side of the left beam, and pitch from nearly straight down to just above level.
 clearance:30,gimbalYaw:1.3,pitchMin:-1.5,pitchMax:.12,
 chaseBack:70,chaseUp:20,chaseFov:50,
 start:Object.freeze({center:[0,640],angle:.9})
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
  pos:new THREE.Vector3(),vel:new THREE.Vector3(),heading:0,bank:CRAFT.bank,tilt:0,hull:100,
  view:'sensor',zoom:false,weapon:0,
  // look: the sensor's yaw off the left beam and its pitch; aimYaw/aimPitch: the same in the world.
  look:{yaw:0,pitch:-.9},aimYaw:0,aimPitch:-.9,
  orbit:{center:new THREE.Vector3(S.center[0],0,S.center[1]),want:new THREE.Vector3(S.center[0],0,S.center[1]),
   radius:CRAFT.radius,alt:CRAFT.startAlt,wantAlt:CRAFT.startAlt,floor:0,angle:S.angle},
  lift:0,thrust:0,track:null
 };
 const tmp=new THREE.Vector3(),fwd=new THREE.Vector3(),left=new THREE.Vector3(),prev=new THREE.Vector3(),slide=new THREE.Vector3();

 // The highest thing under the circle, sampled round it: towers, the statue, the cliff.
 // The pilot won't go lower than that plus clearance.
 function orbitFloor(center,radius){
  let top=0;
  for(let i=0;i<48;i++){const a=i/48*Math.PI*2;top=Math.max(top,world.topNear(center.x+Math.cos(a)*radius,center.z+Math.sin(a)*radius,CRAFT.clearance));}
  return top+CRAFT.clearance;
 }
 let floorClock=0;
 function place(o){
  state.pos.set(o.center.x+Math.cos(o.angle)*o.radius,o.alt,o.center.z+Math.sin(o.angle)*o.radius);
 }
 function updateAim(){
  // The left beam points at the centre of a perfect circle, so yaw 0 looks at the orbit point.
  state.aimYaw=state.heading+Math.PI/2+state.look.yaw;state.aimPitch=state.look.pitch;
 }
 // Point the sensor at a world position, within the gimbal.
 function lookAt(point){
  tmp.subVectors(point,sensorPos(prev));
  const yaw=Math.atan2(-tmp.x,-tmp.z)-state.heading-Math.PI/2;
  state.look.yaw=THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw),Math.cos(yaw)),-CRAFT.gimbalYaw,CRAFT.gimbalYaw);
  state.look.pitch=THREE.MathUtils.clamp(Math.asin(tmp.y/tmp.length()),CRAFT.pitchMin,CRAFT.pitchMax);
  updateAim();
 }
 function headingFromAngle(o){const t=tmp.set(Math.sin(o.angle),0,-Math.cos(o.angle));return Math.atan2(-t.x,-t.z);}
 function step(dt,input){
  const o=state.orbit;
  state.lift=input.lift;state.thrust=input.forward;
  // W A S D slide the orbit over the ground, relative to where the sensor looks.
  fwd.set(-Math.sin(state.aimYaw),0,-Math.cos(state.aimYaw));left.set(fwd.z,0,-fwd.x);
  slide.set(0,0,0).addScaledVector(fwd,input.forward).addScaledVector(left,-input.strafe);
  if(slide.lengthSq()>0){o.want.addScaledVector(slide.normalize(),CRAFT.slideSpeed*dt);floorClock=0;}
  const reach=BOWL_RADIUS-o.radius-20,flat=Math.hypot(o.want.x,o.want.z);
  if(flat>reach)o.want.multiplyScalar(reach/flat);
  o.wantAlt=THREE.MathUtils.clamp(o.wantAlt+input.lift*CRAFT.climbRate*dt,CRAFT.minAlt,CRAFT.maxAlt);
  floorClock-=dt;if(floorClock<=0){o.floor=orbitFloor(o.want,o.radius);floorClock=.25;}
  o.center.lerp(o.want,1-Math.exp(-1.8*dt));
  const alt=Math.min(CRAFT.maxAlt,Math.max(o.wantAlt,o.floor));
  // Climb out of trouble quickly, settle down gently.
  o.alt+=(alt-o.alt)*(1-Math.exp(-(alt>o.alt?1.6:.6)*dt));
  o.angle-=CRAFT.orbitSpeed/o.radius*dt;
  prev.copy(state.pos);place(o);
  state.vel.subVectors(state.pos,prev).divideScalar(Math.max(dt,1e-4));
  const h=headingFromAngle(o);let d=h-state.heading;d=Math.atan2(Math.sin(d),Math.cos(d));state.heading+=d;
  state.tilt+=((state.pos.y-prev.y)/Math.max(dt,1e-4)/120-state.tilt)*(1-Math.exp(-3*dt));
  // Ground-stabilised, as a gunship's sensor is: it stays on the spot you aimed at while the
  // plane circles, and only the mouse moves it (inside the gimbal).
  if(state.track)lookAt(state.track);else updateAim();
 }
 // The sensor ball on the left flank, stabilised: it neither banks nor pitches with the airframe.
 function sensorPos(out){
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));left.set(fwd.z,0,-fwd.x);
  return out.copy(state.pos).addScaledVector(left,1.6).addScaledVector(fwd,1.4).add(tmp.set(0,-.4,0));
 }
 const aimDir=()=>tmp.set(-Math.sin(state.aimYaw)*Math.cos(state.aimPitch),Math.sin(state.aimPitch),-Math.cos(state.aimYaw)*Math.cos(state.aimPitch));
 const camTarget=new THREE.Vector3(),camWant=new THREE.Vector3();
 function placeCamera(camera,dt,fov){
  const sensor=state.view==='sensor';
  camera.near=sensor?1:1;
  if(sensor){
   sensorPos(camera.position);
   camera.fov+=(fov-camera.fov)*(dt>0?1-Math.exp(-10*dt):1);
   camTarget.copy(camera.position).add(aimDir());camera.up.set(0,1,0);camera.lookAt(camTarget);
  }else{
   // Outside: behind and above, off the outer wing, looking along the turn into the orbit.
   fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));left.set(fwd.z,0,-fwd.x);
   camWant.copy(state.pos).addScaledVector(fwd,-CRAFT.chaseBack).addScaledVector(left,-22).add(tmp.set(0,CRAFT.chaseUp,0));
   camera.position.lerp(camWant,dt>0?1-Math.exp(-6*dt):1);
   camera.fov+=(CRAFT.chaseFov-camera.fov)*(dt>0?1-Math.exp(-8*dt):1);
   camTarget.copy(state.pos).addScaledVector(fwd,40).addScaledVector(left,70).add(tmp.set(0,-45,0));
   camera.up.set(0,1,0);camera.lookAt(camTarget);
  }
  camera.updateProjectionMatrix();
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
 function setOrbit({center,radius=CRAFT.radius,alt=CRAFT.startAlt,angle=0}){
  const o=state.orbit;o.center.set(center[0],0,center[1]);o.want.copy(o.center);o.radius=radius;
  o.floor=orbitFloor(o.center,radius);o.alt=o.wantAlt=Math.max(alt,o.floor);o.angle=angle;
  place(o);state.heading=headingFromAngle(o);state.vel.set(0,0,0);
  state.track=null;state.look.yaw=0;state.look.pitch=-Math.atan2(o.alt,o.radius);updateAim();
 }
 setOrbit({center:S.center,angle:S.angle});
 return {state,model,step,placeCamera,syncModel,setOrbit,lookAt,sensorPos,aimDir:()=>aimDir().clone(),
  // Where the gunship will be in t seconds if the pilot holds the orbit.
  predict(t,out){const o=state.orbit,a=o.angle-CRAFT.orbitSpeed/o.radius*t;return out.set(o.center.x+Math.cos(a)*o.radius,o.alt,o.center.z+Math.sin(a)*o.radius);},
  // O: circle the point under the reticle.
  orbitAt(point){state.orbit.want.set(point.x,0,point.z);floorClock=0;},
  // Mouse: slew the sensor, held inside the gimbal.
  slew(dx,dy){
   state.look.yaw=THREE.MathUtils.clamp(state.look.yaw-dx,-CRAFT.gimbalYaw,CRAFT.gimbalYaw);
   state.look.pitch=THREE.MathUtils.clamp(state.look.pitch-dy,CRAFT.pitchMin,CRAFT.pitchMax);updateAim();
  },
  // Rounds leave the side guns; the sensor ball is close enough that aim and fire agree.
  muzzle(out,weapon){
   sensorPos(out);fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));
   return out.addScaledVector(fwd,[-2.2,-1,1.6][weapon]??0).add(tmp.set(0,-.6,0));
  },
  reset(){state.hull=100;state.view='sensor';state.zoom=false;setOrbit({center:S.center,angle:S.angle});}};
}
