import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {BOWL_RADIUS,CEILING,pointInBox,rayBox} from './world.js?v=ch2-01';

// The Satoshi refitted to hover. Keys push it around; it drifts and settles instead of
// stopping dead. The mouse aims, and the nose swings round to follow the aim with a lag,
// so you go where the guns point but can still slide sideways out of incoming fire.
// As in Chapter 1 you sit in the ball turret under the belly: the seat view is the default,
// right click is the zoomed gun camera, and V swaps to an outside view.
export const CRAFT=Object.freeze({
 radius:8,accel:46,maxSpeed:64,climb:30,drag:1.35,turnRate:2.2,
 pitchMin:-1.35,pitchMax:.6,chaseBack:44,chaseUp:13,// Gun camera zoom per weapon, wide then close: tight for the gatling, wide for the Lance,
 // like the AC-130's 25, 40 and 105 mm cameras.
 optics:[[14,5],[22,9],[36,15]],orbitSpeed:34,chaseFov:62,seatFov:70,seatY:-3.1
});

function greyboxSatoshi(){
 const g=[],b=(w,h,d,x,y,z)=>g.push(new THREE.BoxGeometry(w,h,d).translate(x,y,z));
 b(3.2,3,15,0,0,-1);      // fuselage pod
 b(2.2,1.4,3,0,1.8,-5.2); // canopy
 b(26,.6,4.2,0,.4,0);     // wing
 for(const x of [-5.2,5.2]){b(1.8,1.8,17,x,.3,3.5);b(.4,4,3,x,2.2,11.5);} // booms and fins
 b(11,.4,2.6,0,3.8,11.5); // tailplane
 const body=new THREE.Mesh(mergeGeometries(g),new THREE.MeshLambertMaterial({color:0x6a6e55}));
 const turret=new THREE.Mesh(new THREE.SphereGeometry(1.9,16,10),new THREE.MeshLambertMaterial({color:0x2d3a3a}));turret.position.set(0,-2.6,0);
 const fans=[];
 for(const x of [-9,9]){
  const fan=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,.3,20),new THREE.MeshBasicMaterial({color:0x9a9a88,transparent:true,opacity:.35,depthWrite:false}));
  fan.position.set(x,.8,0);fans.push(fan);
 }
 // 18 m across: big enough to read, small enough to keep the reticle clear in the chase view.
 const group=new THREE.Group();group.add(body,turret,...fans);group.scale.setScalar(.7);group.name='Satoshi hover refit (grey box)';
 return {group,fans,turret};
}

export function createCraft(scene,world){
 const model=greyboxSatoshi();scene.add(model.group);
 const state={
  pos:new THREE.Vector3(0,70,560),vel:new THREE.Vector3(),heading:0,
  aimYaw:0,aimPitch:-.02,bank:0,tilt:0,hull:100,gunCam:false,view:'seat',barrel:0,zoom:0,weapon:0,orbit:null
 };
 const tmp=new THREE.Vector3(),fwd=new THREE.Vector3(),right=new THREE.Vector3(),push=new THREE.Vector3();
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
    for(const box of world.colliders)if(box.alive&&pointInBox(probe,box.min,box.max,CRAFT.radius+12))return false;
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
  for(const c of world.colliders){
   if(!c.alive||!pointInBox(p,c.min,c.max,r))continue;
   // Push out along the shallowest axis and kill velocity into the wall.
   const pen=[['x',c.max.x+r-p.x,1],['x',p.x-(c.min.x-r),-1],['y',c.max.y+r-p.y,1],['y',p.y-(c.min.y-r),-1],['z',c.max.z+r-p.z,1],['z',p.z-(c.min.z-r),-1]];
   let best=pen[0];for(const e of pen)if(e[1]<best[1])best=e;
   p[best[0]]+=best[1]*best[2];if(v[best[0]]*best[2]<0)v[best[0]]=0;
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
   for(const c of world.colliders)if(c.alive){const t=rayBox(state.pos,camDir,c.min,c.max,len);if(t<hit)hit=t;}
   camWant.copy(state.pos).addScaledVector(camDir,Math.max(6,hit-2));
   if(camWant.y<3)camWant.y=3;
   camera.position.lerp(camWant,dt>0?1-Math.exp(-10*dt):1);
   camera.fov+=(CRAFT.chaseFov-camera.fov)*(1-Math.exp(-10*dt));
  }
  camera.updateProjectionMatrix();
  camTarget.copy(camera.position).addScaledVector(dir,100);
  camera.lookAt(camTarget);
  if(seat&&!state.gunCam)camera.rotateZ(state.bank*.35);
 }
 function syncModel(time){
  model.group.position.copy(state.pos);
  model.group.rotation.set(state.tilt,state.heading,state.bank,'YXZ');
  model.fans.forEach((f,i)=>f.rotation.y=time*(i?31:-29));
  // From the seat the belly, wings and fans hang overhead; the optics hide them.
  model.group.visible=!state.gunCam;
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
