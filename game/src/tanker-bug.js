import * as THREE from '../vendor/three.module.js?v=052';
import {poseCinderLeg} from './cinder-maw.js?v=053-1';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),up=V(0,1,0),down=V(0,-1,0),clamp=THREE.MathUtils.clamp,smooth=THREE.MathUtils.smoothstep;
const SCALE=2;
// Both entry points drain the same ordered construction work. The async caller
// owns deadline/context checks at each checkpoint; rejection stops later work.
export function createTankerBugs(options){
 const work=buildTankerBugs(options);let next;do{next=work.next();}while(!next.done);return next.value;
}
export async function createTankerBugsAsync(options,{checkpoint=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(typeof checkpoint!=='function')throw TypeError('Tanker preparation requires a checkpoint');
 const work=buildTankerBugs(options);
 try{
  await checkpoint({stage:'begin',completed:0,total:options.actors.length});
  for(let next=work.next();;next=work.next()){
   if(next.done)return next.value;
   await checkpoint(next.value);
  }
 }finally{work.return();}
}
function* buildTankerBugs({actors,scene,centerAt,widthAt,bankMeshes,glowTexture,audio,planeVel,aimTarget,cinderModel}){
 if(!cinderModel)throw Error('Required Cinder Maw model absent');
 const surfaces=bankMeshes.map(m=>({mesh:m,bounds:new THREE.Box3().setFromObject(m)})),ray=new THREE.Raycaster();
 let clock=0;
 let pathNodes=0,actorsBuilt=0;
 function* makePath(e){
  const origin=centerAt(e.p),w=widthAt(e.p),near=surfaces.filter(({bounds:b})=>b.min.z<origin.z+95&&b.max.z>origin.z-30&&b.min.x<origin.x+w+35&&b.max.x>origin.x-w-35).map(s=>s.mesh),nodes=[];
  for(let i=0;i<=150;i++){
   const s=-70+i*.6,p=e.p+s/3050,c=centerAt(p),x=c.x+e.side*(widthAt(p)-5.7),heights=[];
   for(let j=0;j<=32;j++){
    ray.set(V(x+(j-16)*.5,180,c.z),down);ray.far=182;const hit=ray.intersectObjects(near,false)[0];
    if(!hit)throw Error(`Tanker support missing ${e.id}/${i}/${j}`);heights.push(hit.point.y);
   }nodes.push({x,z:c.z,heights});pathNodes++;
   // Four complete nodes bound each slice to132 ray samples. The final partial
   // slice keeps all151 x33 samples and their original order.
   if((i+1)%4===0||i===150)yield{stage:'path',completed:pathNodes,total:actors.length*151,actorId:e.id};
  }e.path={nodes,near,footHeights:new Map()};
 }
 function ground(e,s,lateral=0){
  const u=clamp((s+70)/.6,0,149.99999),i=Math.floor(u),f=u-i,a=e.path.nodes[i],b=e.path.nodes[i+1],v=clamp(lateral*2+16,0,31.9999),j=Math.floor(v),k=v-j;
  const h=n=>THREE.MathUtils.lerp(n.heights[j],n.heights[j+1],k);
  return V(THREE.MathUtils.lerp(a.x,b.x,f)+lateral,THREE.MathUtils.lerp(h(a),h(b),f),THREE.MathUtils.lerp(a.z,b.z,f));
 }
 for(const e of actors){
  for(const child of [...e.root.children])e.root.remove(child);
  e.root.scale.setScalar(1);e.root.rotation.set(0,0,0);
  e.tanker=true;e.archetype='tanker-bug';e.windupSeconds=2.2;e.radius=4.5;e.travel=0;e.rear=0;e.alert=0;e.releaseTime=null;e.soundPhase='idle';yield* makePath(e);e.hp=2340;
  const rig=cinderModel.clone();rig.root.scale.setScalar(SCALE);e.root.add(rig.root);e.cinderRig=rig;e.body=rig.body;e.head=rig.body;e.front=rig.body;e.jaw=rig.jaw;e.jawBase=rig.jaw.rotation.x;e.mouthAnchor=rig.mouth;
  const hot=new THREE.MeshBasicMaterial({color:0xff6810,transparent:true,opacity:.75});e.throat=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),hot);e.throat.position.set(0,0,.15);rig.mouth.add(e.throat);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xff951d,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));glow.position.z=-.025;rig.mouth.add(glow);e.throatGlow=glow;
  e.legs=rig.limbs.map((l,i)=>({...l,i,point:V(),surface:V(),planted:true,cycle:0,hold:null}));e.contacts=e.legs;
  const volumes=[[V(0,1.15,.7),1.7],[V(0,1.2,1.6),1.4],[V(0,1.3,-1.2),1.6],[V(0,1.15,-2.15),1.05]];
  e.hitSpheres=Array.from({length:5},()=>({center:V(),radius:0}));
  e.sampleHitSpheres=()=>{e.root.updateWorldMatrix(true,true);volumes.forEach(([v,r],i)=>{rig.bodyPoint(v,e.hitSpheres[i].center);e.hitSpheres[i].radius=r*SCALE;});rig.mouth.getWorldPosition(e.hitSpheres[4].center);e.hitSpheres[4].radius=.85*SCALE;return e.hitSpheres;};
  e.poseTanker=(time,target)=>pose(e,time,target,0);e.root.position.copy(ground(e,0));e.baseY=e.root.position.y;
  yield{stage:'setup',completed:++actorsBuilt,total:actors.length,actorId:e.id};
 }
 function surfaceAt(e,x,z){
  // Bilinear body support can bridge a sharp bank triangle at a planted toe.
  // Cache exact visible-surface intersections for the repeating stance points.
  const cache=e.path.footHeights,key=x.toFixed(6)+','+z.toFixed(6);let y=cache.get(key);
  if(y===undefined){ray.set(V(x,180,z),down);ray.far=182;const hit=ray.intersectObjects(e.path.near,false)[0];if(!hit)throw Error('Tanker foot support missing '+e.id);y=hit.point.y;if(cache.size>=4096)cache.clear();cache.set(key,y);}
  return V(x,y,z);
 }
 function pose(e,time,target,dt){
  if(e.dead)return;
  const rig=e.cinderRig,wind=e.state==='windup',f=wind?clamp(1-e.timer/e.windupSeconds,0,1):0,spraying=e.state==='spraying',engaged=wind||spraying;
  if(dt>0){const aware=e.root.position.distanceTo(target)<390;e.alert=THREE.MathUtils.damp(e.alert,aware?1:0,3,dt);e.rear=THREE.MathUtils.damp(e.rear,wind?smooth(f,0,.45):spraying?1:e.alert*.12,wind?6:3,dt);e.travel=Math.min(51,e.travel+dt*.58*(engaged||e.state==='suppressed'?0:1));}
  const p=ground(e,-e.travel),direction=ground(e,-e.travel-1).sub(p);direction.y=0;direction.normalize();
  const patrolHeading=Math.atan2(-direction.x,-direction.z),desiredHeading=engaged?Math.atan2(p.x-target.x,p.z-target.z):patrolHeading;
  if(e.aimHeading===undefined)e.aimHeading=patrolHeading;
  if(dt>0){const delta=Math.atan2(Math.sin(desiredHeading-e.aimHeading),Math.cos(desiredHeading-e.aimHeading));e.aimHeading+=clamp(delta,-dt*1.5,dt*1.5);}
  const heading=e.aimHeading;e.root.position.copy(p);e.root.rotation.set(0,0,0);e.baseY=p.y;rig.root.rotation.set(0,heading,0);rig.resetPose();
  // Ground-facing roll follows the bank. Aim lifts the whole furnace-bearing
  // front, preserving the actual mouth/nozzle direction instead of an invisible head.
  const sideA=V(-2,0,0).applyAxisAngle(up,heading).add(p),sideB=V(2,0,0).applyAxisAngle(up,heading).add(p);
  const slope=(surfaceAt(e,sideB.x,sideB.z).y-surfaceAt(e,sideA.x,sideA.z).y)/4;
  const glass=aimTarget?aimTarget():target,predicted=glass.clone(),mouth=rig.mouth.getWorldPosition(V());let flightTime=mouth.distanceTo(glass)/150;
  for(let i=0;i<5;i++){predicted.copy(glass).addScaledVector(planeVel||V(),flightTime);predicted.y+=flightTime*flightTime;flightTime=clamp(mouth.distanceTo(predicted)/150,0,3);}
  const aim=predicted.sub(mouth).normalize(),pitch=clamp(Math.asin(clamp(aim.y,-1,1)),-.25,.62)*(engaged?1:e.alert*.12);
  const recoil=e.releaseTime!==null?Math.max(0,1-(time-e.releaseTime)/.35):0;
  rig.body.position.y+=Math.sin(time*1.1+e.initialPhase)*.015+e.rear*.035;
  rig.body.position.z+=recoil*.07;
  rig.body.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch-recoil*.018,0,Math.atan(slope)))).multiply(rig.rest.get(rig.body).quaternion);
  if(engaged){
   // Rotate the actual furnace-bearing body to the led glass target. Recompute
   // from its moving mouth so projectile direction is never an invisible aim fix.
   const restQ=rig.rest.get(rig.body).quaternion,bankQ=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.atan(slope));
   for(let i=0;i<5;i++){
    e.root.updateWorldMatrix(true,true);const origin=rig.mouth.getWorldPosition(V()),goal=glass.clone();let t=origin.distanceTo(glass)/150;
    for(let j=0;j<5;j++){goal.copy(glass).addScaledVector(planeVel||V(),t);goal.y+=t*t;t=clamp(origin.distanceTo(goal)/150,0,3);}
    const localAim=goal.sub(origin).normalize().applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()).invert());
    const look=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(V(),localAim,V(-slope,1,0).normalize()));
    rig.body.quaternion.copy(bankQ).slerp(look,spraying?1:e.rear).multiply(restQ);
   }
  }
  const pressure=wind?smooth(f,.25,1):spraying?1:0;
  rig.jaw.quaternion.copy(rig.rest.get(rig.jaw).quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),-(.035+pressure*.23+recoil*.045)));
  rig.skin.material.emissiveIntensity=4*(.42+pressure*.58);e.throat.scale.setScalar(.01+pressure*.92);e.throatGlow.scale.setScalar(pressure*1.7);e.throatGlow.material.opacity=pressure*.6;
  e.root.updateWorldMatrix(true,true);
  const mouthDirection=V(0,0,-1).applyQuaternion(rig.mouth.getWorldQuaternion(new THREE.Quaternion())),stanceHeading=Math.atan2(-mouthDirection.x,-mouthDirection.z);
  for(const l of e.legs){
   const walking=!engaged&&e.state!=='suppressed',hip=l.upper.getWorldPosition(V()),reach=(l.upperLength+l.lowerLength)*SCALE*.94,sole=.31*SCALE;
   const desired=rig.bodyPoint(l.palm);if(walking)desired.add(V(0,0,-.35).applyAxisAngle(up,stanceHeading));
   // Search the actual bank for a reachable palm position. The fixed anatomical
   // lengths remain intact; sloped banks may need a narrower planted stance.
   let best=null,bestDistance=Infinity;
   for(let i=0;i<=12;i++){
    const trial=desired.clone().lerp(hip,i/12),surface=surfaceAt(e,trial.x,trial.z),goal=surface.clone().add(V(0,sole,0)),distance=hip.distanceTo(goal);
    if(distance<bestDistance){bestDistance=distance;best=surface;}
    if(distance<=reach){best=surface;break;}
   }
   if(!l.hold)l.hold=best.clone();
   const stale=l.hold.distanceTo(best),holdReach=hip.distanceTo(l.hold.clone().add(V(0,sole,0))),phase=((time/1.0+l.i*.25)%1+1)%1;
   // Keep an already reachable planted foot through small breathing/aim changes.
   // Use a larger release radius than the landing search to avoid repeated
   // zero-distance steps at the edge of a steep-bank stance.
   const mustStep=holdReach>(l.upperLength+l.lowerLength)*SCALE*.985||stale>1.8;
   if(dt>0&&!l.step&&stale>.08&&(mustStep||(stale>.65&&phase>.55))){l.step={from:l.hold.clone(),to:best.clone(),age:0};}
   let foot=l.hold.clone(),planted=true;
   if(l.step){
    // This recovery clock advances even after suppression stops route travel.
    l.step.age+=dt;const t=clamp(l.step.age/.28,0,1);foot.lerpVectors(l.step.from,l.step.to,smooth(t,0,1));foot.y=surfaceAt(e,foot.x,foot.z).y+Math.sin(t*Math.PI)*.46;planted=false;
    if(t>=1){l.hold.copy(l.step.to);l.step=null;foot.copy(l.hold);planted=true;if(dt>0&&e.root.position.distanceTo(target)<140)audio?.tanker?.('step',foot);}
   }
   const surface=surfaceAt(e,foot.x,foot.z),normalA=surfaceAt(e,foot.x+.2,foot.z).sub(surface),normalB=surfaceAt(e,foot.x,foot.z+.2).sub(surface),normal=normalB.cross(normalA).normalize();
   const goal=foot.clone().add(V(0,sole,0));
   const ik=poseCinderLeg(rig,l,goal,stanceHeading,normal);l.point.copy(l.foot.getWorldPosition(V())).add(V(0,-sole,0));l.surface.copy(surface);l.planted=planted&&ik.error<.04;l.cycle=phase;l.ik=ik;
  }
  e.root.updateMatrixWorld(true);e.sampleHitSpheres();
  e.tankerStats={model:'Cinder Maw v04 / game v02',length:11,legCount:4,travel:e.travel,rear:e.rear,pressure,alert:e.alert,mouth:e.hitSpheres[4].center.toArray(),planted:e.legs.filter(l=>l.planted).length,maxFootError:Math.max(...e.legs.map(l=>l.ik.error)),drawParts:1,triangles:cinderModel.stats.triangles};
 }
 function update(time,target){if(time<clock||time-clock>.12){for(const e of actors){e.travel=Math.min(51,time*.58);e.rear=0;e.alert=0;for(const l of e.legs){l.hold=null;l.step=null;}}clock=time;}const dt=clamp(time-clock,0,.1);for(const e of actors)pose(e,time,target,dt);clock=time;}
 function resetActor(e){e.aimHeading=undefined;e.travel=0;e.rear=0;e.alert=0;e.releaseTime=null;for(const l of e.legs){l.previousSwing=false;l.hold=null;l.step=null;}pose(e,0,V(0,45,130),0);}
 function reset(){clock=0;for(const e of actors)resetActor(e);}
 clock=0;let actorsReset=0;for(const e of actors){resetActor(e);yield{stage:'reset',completed:++actorsReset,total:actors.length,actorId:e.id};}
 return{actors,update,reset,ground,stats:()=>actors.map(e=>({id:e.id,...e.tankerStats}))};
}
