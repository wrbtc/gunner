import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {BOWL_RADIUS,CEILING,colliderHas,colliderPush,colliderRay} from './world.js?v=ch2-04';
import {AIRFRAME,loadAirframe} from './airframe.js?v=ch2-04';

// The Satoshi refitted to hover. Keys push it around; it drifts and settles instead of
// stopping dead. The mouse aims, and the nose swings round to follow the aim with a lag,
// so you go where the guns point but can still slide sideways out of incoming fire.
// As in Chapter 1 you sit in the ball turret under the belly: the seat view is the default,
// right click is the zoomed gun camera, and V swaps to an outside view.
export const CRAFT=Object.freeze({
 radius:8,accel:46,maxSpeed:64,climb:30,drag:1.35,turnRate:2.2,
 pitchMin:-1.35,pitchMax:.6,chaseBack:44,chaseUp:13,// Gun camera zoom per weapon, wide then close: tight for the gatling, wide for the Lance,
 // like the AC-130's 25, 40 and 105 mm cameras.
 optics:[[14,5],[22,9],[36,15]],orbitSpeed:34,chaseFov:62,seatFov:70,seatY:-3.1,
 // The sculpt is 29.4 wide; at .68 it spans 20 m, big enough to read and small enough to
 // keep the reticle clear in the outside view.
 modelScale:.68
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
 const group=new THREE.Group();group.add(body);group.scale.setScalar(.7);group.position.y=1.2;group.name='Satoshi hover refit (grey box)';
 return group;
}

// The refit, in the sculpt's own units: a ducted lift fan cut into each outer wing, the old
// propellers kept for forward thrust, and a swivel nozzle under each tail boom.
function refit(materials){
 const parts=new THREE.Group();parts.name='Hover refit';
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
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.44,16).rotateX(Math.PI/2).translate(0,-1.18,0),materials.glow.clone());
  pivot.add(bell,collar,glow);parts.add(pivot);nozzles.push(pivot);glows.push(glow);
 }
 return {parts,rotors,glows,nozzles,props};
}

// The ball turret under the belly, in metres. Its guns follow your aim in the outside view;
// from the seat you are inside it, so it all hides and the seat guns show instead.
function ballTurret(materials){
 const turret=new THREE.Group();turret.name='Ball turret';
 const r=1.15,top=CRAFT.seatY+r;
 const cradle=new THREE.Mesh(new THREE.CylinderGeometry(.62,.9,-top,14).translate(0,top/2,0),materials.metal);
 const ball=new THREE.Group();ball.position.y=CRAFT.seatY;
 const glass=new THREE.Mesh(new THREE.SphereGeometry(r,22,14),materials.glass);
 const frame=new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(r+.03,.08,6,26).rotateX(Math.PI/2),new THREE.TorusGeometry(r+.03,.07,6,26)]),materials.metal);
 const yaw=new THREE.Group(),pitch=new THREE.Group();
 const guns=new THREE.Mesh(mergeGeometries([
  ...[-.46,.46].map(x=>new THREE.CylinderGeometry(.12,.14,2,10).rotateX(Math.PI/2).translate(x,-.05,-1.9)),
  new THREE.CylinderGeometry(.19,.24,2.6,12).rotateX(Math.PI/2).translate(0,-.46,-2),
  new THREE.BoxGeometry(1.3,.4,.7).translate(0,-.22,-1.05)
 ]),materials.metal);
 pitch.add(guns);yaw.add(pitch);ball.add(glass,yaw);
 frame.position.y=CRAFT.seatY;
 turret.add(cradle,ball,frame);
 return {turret,yaw,pitch};
}

export function createCraft(scene,world){
 const materials={
  metal:new THREE.MeshStandardMaterial({color:0x4a4f49,metalness:.45,roughness:.5}),
  duct:new THREE.MeshStandardMaterial({color:0x2c302d,metalness:.4,roughness:.6,side:THREE.DoubleSide}),
  rotor:new THREE.MeshStandardMaterial({color:0x8d8e82,metalness:.5,roughness:.45}),
  // Smoked glass that still catches the light; true dark glass renders as a black ball.
  glass:new THREE.MeshStandardMaterial({color:0x6a7b76,metalness:.15,roughness:.22,emissive:0x0b1413}),
  glow:new THREE.MeshBasicMaterial({color:0xff9a4a,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide})
 };
 const group=new THREE.Group();group.name='Satoshi';scene.add(group);
 let hull=greyboxSatoshi(),kit=null;group.add(hull);
 const turret=ballTurret(materials);group.add(turret.turret);
 const model={group,get sculpted(){return !!kit;}};
 // Swap the sculpt in when it arrives; the grey box stays if it never does.
 model.ready=loadAirframe().then(airframe=>{
  const holder=new THREE.Group();holder.name='Satoshi airframe and refit';holder.scale.setScalar(CRAFT.modelScale);
  kit=refit(materials);holder.add(airframe,kit.parts);
  group.remove(hull);hull=holder;group.add(holder);
  return true;
 }).catch(()=>false);

 const state={
  pos:new THREE.Vector3(0,70,560),vel:new THREE.Vector3(),heading:0,
  aimYaw:0,aimPitch:-.02,bank:0,tilt:0,hull:100,gunCam:false,view:'seat',barrel:0,zoom:0,weapon:0,orbit:null,lift:0,thrust:0
 };
 const tmp=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),push=new THREE.Vector3(),normal=new THREE.Vector3();
 const orbitPoint=new THREE.Vector3(),tangent=new THREE.Vector3(),desired=new THREE.Vector3();
 const aimDir=()=>tmp.set(-Math.sin(state.aimYaw)*Math.cos(state.aimPitch),Math.sin(state.aimPitch),-Math.cos(state.aimYaw)*Math.cos(state.aimPitch));

 // Orbit: the pilot circles the point you marked, AC-130 style, and you only gun.
 // Any flying key hands the controls straight back.
 function startOrbit(center){
  const c=center.clone(),flat=Math.hypot(state.pos.x-c.x,state.pos.z-c.z);let alt=Math.max(state.pos.y,c.y+110);
  // Shrink the circle until none of it runs through the statue, the cliff or the bowl wall.
  const probe=new THREE.Vector3(),clear=r=>{
   for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2;probe.set(c.x+Math.cos(a)*r,alt,c.z+Math.sin(a)*r);
    if(Math.hypot(probe.x,probe.z)>BOWL_RADIUS-20)return false;
    for(const box of world.colliders)if(box.alive&&colliderHas(box,probe,CRAFT.radius+12))return false;
   }
   return true;
  };
  // If no circle around the target itself is clear (up against the statue), circle a point
  // pulled out toward the craft, climbing if needed; the gunner keeps aiming at the target.
  const toward=new THREE.Vector3(state.pos.x-c.x,0,state.pos.z-c.z);if(toward.lengthSq()<1)toward.set(0,0,1);toward.normalize();
  const base=c.clone();let found=null;
  search:for(const lift of [0,90,180])for(let shift=0;shift<=480;shift+=60){
   c.copy(base).addScaledVector(toward,shift);alt=Math.max(state.pos.y,base.y+110)+lift;
   for(let radius=THREE.MathUtils.clamp(flat<60?220:flat-shift,160,480);radius>=140;radius-=20)if(clear(radius)){found=radius;break search;}
  }
  if(!found){c.copy(base);found=220;alt=Math.max(state.pos.y,base.y+110);}
  state.orbit={center:c,radius:found,alt,angle:Math.atan2(state.pos.z-c.z,state.pos.x-c.x),speed:CRAFT.orbitSpeed};
 }
 function step(dt,input){
  if(input.forward||input.strafe||input.lift)state.orbit=null;
  state.lift=input.lift;state.thrust=input.forward;
  let wantHeading=state.aimYaw;
  const o=state.orbit;
  if(o){
   o.angle+=o.speed/o.radius*dt;
   orbitPoint.set(o.center.x+Math.cos(o.angle)*o.radius,o.alt,o.center.z+Math.sin(o.angle)*o.radius);
   tangent.set(-Math.sin(o.angle),0,Math.cos(o.angle));
   wantHeading=Math.atan2(-tangent.x,-tangent.z);
  }
  // The nose chases the aim yaw (or the orbit's tangent) at a limited turn rate.
  let d=wantHeading-state.heading;d=Math.atan2(Math.sin(d),Math.cos(d));
  const maxTurn=CRAFT.turnRate*dt;
  state.heading+=THREE.MathUtils.clamp(d*(1-Math.exp(-5*dt)),-maxTurn,maxTurn);
  fwd.set(-Math.sin(state.heading),0,-Math.cos(state.heading));right.set(-fwd.z,0,fwd.x);
  push.set(0,0,0).addScaledVector(fwd,input.forward).addScaledVector(right,input.strafe);
  if(push.lengthSq()>1)push.normalize();
  if(o){
   desired.copy(tangent).multiplyScalar(o.speed).addScaledVector(tmp.subVectors(orbitPoint,state.pos),1.1);
   state.vel.lerp(desired,1-Math.exp(-2.2*dt));
  }else{
   state.vel.addScaledVector(push,CRAFT.accel*dt);
   state.vel.y+=input.lift*CRAFT.accel*.8*dt;
   state.vel.multiplyScalar(Math.exp(-CRAFT.drag*dt));
  }
  const flat=Math.hypot(state.vel.x,state.vel.z);
  if(flat>CRAFT.maxSpeed){state.vel.x*=CRAFT.maxSpeed/flat;state.vel.z*=CRAFT.maxSpeed/flat;}
  state.vel.y=THREE.MathUtils.clamp(state.vel.y,-CRAFT.climb,CRAFT.climb);
  state.pos.addScaledVector(state.vel,dt);
  collide();
  // Bank into strafes and nod into acceleration: the hover reads as weight, not a cursor.
  const side=state.vel.dot(right),ahead=state.vel.dot(fwd);
  state.bank+=(THREE.MathUtils.clamp(-side/CRAFT.maxSpeed,-1,1)*.42-state.bank)*(1-Math.exp(-4*dt));
  state.tilt+=(THREE.MathUtils.clamp(-ahead/CRAFT.maxSpeed,-1,1)*.16+input.forward*-.08-state.tilt)*(1-Math.exp(-3*dt));
 }
 function collide(){
  const r=CRAFT.radius,p=state.pos,v=state.vel;
  if(p.y<r+2){p.y=r+2;v.y=Math.max(0,v.y);}
  if(p.y>CEILING){p.y=CEILING;v.y=Math.min(0,v.y);}
  const flat=Math.hypot(p.x,p.z);
  if(flat>BOWL_RADIUS){p.x*=BOWL_RADIUS/flat;p.z*=BOWL_RADIUS/flat;const n=tmp.set(p.x,0,p.z).normalize(),out=v.dot(n);if(out>0)v.addScaledVector(n,-out);}
  // Push out through the nearest face and kill velocity into the wall.
  for(const c of world.colliders){
   if(!c.alive||!colliderPush(c,p,r,normal))continue;
   const into=v.dot(normal);if(into<0)v.addScaledVector(normal,-into);
  }
 }
 const camTarget=new THREE.Vector3(),camWant=new THREE.Vector3(),camDir=new THREE.Vector3();
 function placeCamera(camera,dt){
  const dir=aimDir().clone(),seat=state.gunCam||state.view==='seat';
  camera.near=seat?.12:1;
  if(seat){
   // The turret hangs on a short pylon under the belly, so the fuselage only shows when you
   // look up. The view turns with the guns, and the airframe's
   // bank rocks it a little so the hover is felt from inside.
   camera.position.copy(state.pos).add(tmp.set(0,CRAFT.seatY,0));
   const fov=state.gunCam?CRAFT.optics[state.weapon][state.zoom]:CRAFT.seatFov;
   camera.fov+=(fov-camera.fov)*(dt>0?1-Math.exp(-14*dt):1);
  }else{
   camWant.copy(state.pos).addScaledVector(dir,-CRAFT.chaseBack).add(tmp.set(0,CRAFT.chaseUp,0));
   // Keep the chase camera out of towers: pull it in along the line to the craft.
   camDir.subVectors(camWant,state.pos);const len=camDir.length();camDir.divideScalar(len);
   let hit=len;
   for(const c of world.colliders)if(c.alive){const t=colliderRay(c,state.pos,camDir,len);if(t<hit)hit=t;}
   camWant.copy(state.pos).addScaledVector(camDir,Math.max(6,hit-2));
   if(camWant.y<3)camWant.y=3;
   camera.position.lerp(camWant,dt>0?1-Math.exp(-10*dt):1);
   camera.fov+=(CRAFT.chaseFov-camera.fov)*(dt>0?1-Math.exp(-10*dt):1);
  }
  camera.updateProjectionMatrix();
  camTarget.copy(camera.position).addScaledVector(dir,100);
  camera.lookAt(camTarget);
  if(seat&&!state.gunCam)camera.rotateZ(state.bank*.35);
 }
 let lastTime=0,spin=0,propSpin=0;
 function syncModel(time){
  const dt=Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
  group.position.copy(state.pos);
  group.rotation.set(state.tilt,state.heading,state.bank,'YXZ');
  // From the seat the belly, wings and fans hang overhead; the optics hide them.
  group.visible=!state.gunCam;
  turret.turret.visible=state.view!=='seat';
  turret.yaw.rotation.y=state.aimYaw-state.heading;turret.pitch.rotation.x=state.aimPitch;
  if(!kit)return;
  // The fans work harder climbing and ease off dropping; the nozzles swing to push you along.
  const speed=Math.hypot(state.vel.x,state.vel.z)/CRAFT.maxSpeed,effort=THREE.MathUtils.clamp(.55+state.lift*.45+speed*.2,.2,1.2);
  spin+=dt*(22+effort*26);propSpin+=dt*(18+speed*30);
  kit.rotors.forEach((r,i)=>r.rotation.y=i?spin:-spin);
  kit.props.forEach((p,i)=>p.rotation.z=i?propSpin:-propSpin);
  const flicker=.9+.1*Math.sin(time*37);
  kit.glows.forEach(g=>g.material.opacity=(.14+effort*.26)*flicker);
  const swing=-.62*state.thrust;
  kit.nozzles.forEach(n=>n.rotation.x+=(swing-n.rotation.x)*(1-Math.exp(-6*dt)));
 }
 return {state,model,step,placeCamera,syncModel,startOrbit,aimDir:()=>aimDir().clone(),
  // Gun tips in the turret, left and right in turn, so tracers leave the barrels you see.
  muzzle(out){
   const dir=aimDir(),side=(state.barrel=1-state.barrel)?1:-1;
   right.set(-dir.z,0,dir.x).normalize();
   return out.copy(state.pos).add(push.set(0,CRAFT.seatY-.38,0)).addScaledVector(dir,1.7).addScaledVector(right,side*.5);
  },
  reset(){state.pos.set(0,70,560);state.vel.set(0,0,0);state.heading=state.aimYaw=0;state.aimPitch=-.02;state.hull=100;state.gunCam=false;state.orbit=null;}};
}
