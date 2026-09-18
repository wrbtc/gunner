import * as T from '../vendor/three.module.js?v=052';
import {createRimmerModel} from './rimmer-model.js?v=052';
import {cloneSkinnedGuide} from './skinned-solids.js?v=054-85';
const V=a=>new T.Vector3().fromArray(a),Y=new T.Vector3(0,1,0);

// Collision groups and encounter state retain their authored positions. The
// supplied skin has its own anatomy and a real mouth socket for all emissions.
export function createRimmerSkinnedModel(solid){
 const model=createRimmerModel();
 if(!solid)return model;
 const source=solid.scene,rig=source.userData.rimmerRig;
 if(!rig||!Array.isArray(rig.legs)||rig.legs.length!==4)throw Error('Rimmer rig metadata missing');
 const visual=new T.Group();visual.name='Rimmer skinned visual';
 visual.scale.setScalar(rig.scale);visual.rotation.y=Math.PI;visual.position.y=-rig.floorY*rig.scale;
 const skin=cloneSkinnedGuide(source);visual.add(skin);
 const bone=name=>{const b=skin.getObjectByName(name);if(!b?.isBone)throw Error('Rimmer bone missing: '+name);return b;};
 const bodyBone=bone('rimmer_body'),headBone=bone('rimmer_head'),mouth=bone('rimmer_mouth');
 const bodyRest=bodyBone.position.clone(),headRest=headBone.quaternion.clone();
 // Remove visual primitives, retaining the collision/aim groups and reset API.
 const oldMeshes=[];model.root.traverse(n=>{if(n.isMesh)oldMeshes.push(n);});
 oldMeshes.forEach(n=>n.removeFromParent());model.root.add(visual);
 const glow=model.throat,glowFrame=new T.Group();glow.name='Rimmer throat glow';glowFrame.scale.setScalar(1/rig.scale);glowFrame.add(glow);mouth.add(glowFrame);
 const mandibles=['mandible_L','mandible_R'].map((name,i)=>({bone:bone(name),proxy:model.jaws[i],base:model.jaws[i].rotation.y,rest:bone(name).quaternion.clone()}));
 const scythes=rig.scythes.map(s=>({bone:bone(s.name+'_upper'),proxy:model.arms[s.side<0?0:1],rest:bone(s.name+'_upper').quaternion.clone()}));
 const legs=rig.legs.map(spec=>{
  const old=model.legs.find(l=>l.side===spec.side&&l.i===spec.i);
  if(!old)throw Error('Rimmer leg mapping missing: '+spec.name);
  const hip=V(spec.hip),knee=V(spec.knee),ankle=V(spec.ankle),toe=V(spec.toe);
  visual.updateMatrix();
  // Meshy rest toes are fully splayed. Reserve joint reach for anchored stance
  // by bringing each neutral footprint inward .12 source units (2.88 world).
  const stance=toe.clone(),inward=hip.clone().sub(toe);inward.y=0;stance.addScaledVector(inward.normalize(),.12);
  return {...old,rig:spec,restHip:hip,restKnee:knee,restAnkle:ankle,restToe:toe,
   restFoot:stance.applyMatrix4(visual.matrix),upperBone:bone(spec.name+'_upper'),lowerBone:bone(spec.name+'_lower'),footBone:bone(spec.name+'_foot'),
   upperLength:hip.distanceTo(knee),lowerLength:knee.distanceTo(ankle),footLength:ankle.distanceTo(toe),reachError:0,contactError:0};
 });
 // Freeze a rigid contact patch, not one arbitrary toe tip. All weighted low
 // foot vertices participate in final support height; a sparse footprint is
 // used only while searching candidate positions and orientations.
 model.root.updateMatrixWorld(true);
 for(const l of legs){
  l.sole=[];l.soleVertices=[];skin.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const index=mesh.skeleton.bones.indexOf(l.footBone),p=mesh.geometry.attributes.position,w=mesh.geometry.attributes.skinWeight,j=mesh.geometry.attributes.skinIndex;mesh.skeleton.update();
   for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++)if(j.array[i*4+k]===index)weight+=w.array[i*4+k];if(weight<=.95)continue;const point=visual.worldToLocal(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));if(point.y<l.restAnkle.y-.02){l.sole.push(point.sub(l.restToe));l.soleVertices.push({mesh,index:i});}}
  });
  if(!l.sole.length)l.sole.push(new T.Vector3());
  const cells=new Map();for(const point of l.sole){const key=Math.floor(point.x*20)+','+Math.floor(point.z*20),old=cells.get(key);if(!old||point.y<old.y)cells.set(key,point);}l.searchSole=[...cells.values()];
 }
 function orient(b,restDirection,direction){
  // Desired rotations are expressed in the imported source coordinate system.
  const rotation=new T.Quaternion().setFromUnitVectors(restDirection.clone().normalize(),direction.clone().normalize());
  const visualWorld=visual.getWorldQuaternion(new T.Quaternion());
  const parentInverse=b.parent.getWorldQuaternion(new T.Quaternion()).invert();
  b.quaternion.copy(parentInverse.multiply(visualWorld).multiply(rotation));b.updateWorldMatrix(false,true);
 }
 function syncPose(){
  bodyBone.position.copy(bodyRest);// A real raised thorax restores clear sight over the authored canyon lip.
  // The same pose precedes acquisition and persists through its full warning.
  bodyBone.position.y+=.1875+(model.body.position.y-5.2)/rig.scale;
  bodyBone.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),-model.body.rotation.z);
  headBone.quaternion.copy(headRest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-model.head.rotation.x));
  for(const j of mandibles)j.bone.quaternion.copy(j.rest).multiply(new T.Quaternion().setFromAxisAngle(Y,-(j.proxy.rotation.y-j.base)));
  for(const s of scythes)s.bone.quaternion.copy(s.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-s.proxy.rotation.x));
  model.root.updateWorldMatrix(true,true);
 }
 function poseLeg(l,_hip,_knee,foot){
  model.root.updateWorldMatrix(true,true);
  const target=visual.worldToLocal(model.root.localToWorld(foot.clone()));
  const hip=visual.worldToLocal(l.upperBone.getWorldPosition(new T.Vector3()));
  if(l.poseFootQuaternion){
   const footRotation=visual.getWorldQuaternion(new T.Quaternion()).invert().multiply(l.poseFootQuaternion);
   const ankle=target.clone().sub(l.restToe.clone().sub(l.restAnkle).applyQuaternion(footRotation)),delta=ankle.clone().sub(hip),distance=delta.length(),direction=delta.clone().normalize();
   const low=Math.abs(l.upperLength-l.lowerLength)+1e-7,high=l.upperLength+l.lowerLength-1e-7,d=T.MathUtils.clamp(distance,low,high),along=(l.upperLength*l.upperLength-l.lowerLength*l.lowerLength+d*d)/(2*d),height=Math.sqrt(Math.max(0,l.upperLength*l.upperLength-along*along));
   const bend=l.restKnee.clone().sub(l.restHip);bend.addScaledVector(direction,-bend.dot(direction));if(bend.lengthSq()<1e-10)bend.copy(Y).addScaledVector(direction,-Y.dot(direction));bend.normalize();
   const knee=hip.clone().addScaledVector(direction,along).addScaledVector(bend,height),reached=hip.clone().addScaledVector(direction,d);
   orient(l.upperBone,l.restKnee.clone().sub(l.restHip),knee.clone().sub(hip));orient(l.lowerBone,l.restAnkle.clone().sub(l.restKnee),reached.clone().sub(knee));
   l.footBone.quaternion.copy(l.footBone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(l.poseFootQuaternion));
   model.root.updateWorldMatrix(true,true);model.root.updateMatrixWorld(true);l.foot.copy(foot);l.reachError=Math.abs(distance-d)*rig.scale;
   const actual=l.footBone.localToWorld(l.restToe.clone().sub(l.restAnkle));l.contactError=actual.distanceTo(model.root.localToWorld(foot.clone()));return;
  }
  // Three rigid links let the armored foot articulate at the ankle. A fixed
  // ankle-to-toe vector cannot reach the legacy stride without shell stretching.
  const lengths=[l.upperLength,l.lowerLength,l.footLength],total=lengths.reduce((a,b)=>a+b,0);
  const points=[hip.clone(),hip.clone().add(l.restKnee.clone().sub(l.restHip)),hip.clone().add(l.restAnkle.clone().sub(l.restHip)),hip.clone().add(l.restToe.clone().sub(l.restHip))];
  const distance=hip.distanceTo(target);
  if(distance>=total){
   const direction=target.clone().sub(hip).normalize();
   for(let i=0;i<3;i++)points[i+1].copy(points[i]).addScaledVector(direction,lengths[i]);
  }else{
   // Start from the anatomical rest bend every time: deterministic after reset,
   // with no solver-history drift when callers sample a pose more than once.
   for(let iteration=0;iteration<192;iteration++){
    points[3].copy(target);
    for(let i=2;i>=0;i--){const direction=points[i].clone().sub(points[i+1]);if(direction.lengthSq()<1e-16)direction.copy(Y);points[i].copy(points[i+1]).addScaledVector(direction.normalize(),lengths[i]);}
    points[0].copy(hip);
    for(let i=0;i<3;i++){const direction=points[i+1].clone().sub(points[i]);if(direction.lengthSq()<1e-16)direction.copy(Y);points[i+1].copy(points[i]).addScaledVector(direction.normalize(),lengths[i]);}
    if(points[3].distanceToSquared(target)<1e-18)break;
   }
  }
  orient(l.upperBone,l.restKnee.clone().sub(l.restHip),points[1].clone().sub(points[0]));
  orient(l.lowerBone,l.restAnkle.clone().sub(l.restKnee),points[2].clone().sub(points[1]));
  orient(l.footBone,l.restToe.clone().sub(l.restAnkle),points[3].clone().sub(points[2]));
  model.root.updateWorldMatrix(true,true);
  model.root.updateMatrixWorld(true);
  l.foot.copy(foot);l.reachError=Math.max(0,distance-total)*rig.scale;
  const actual=l.footBone.localToWorld(l.restToe.clone().sub(l.restAnkle));
  l.contactError=actual.distanceTo(model.root.localToWorld(foot.clone()));
 }
 function supportedPlacement(l,desired,ground){
  const hip=l.upperBone.getWorldPosition(new T.Vector3()),scale=visual.getWorldScale(new T.Vector3()).x,reach=(l.upperLength+l.lowerLength)*scale*.80,minReach=Math.abs(l.upperLength-l.lowerLength)*scale+1,yaw=visual.getWorldQuaternion(new T.Quaternion());
  let best=null,bestScore=Infinity;
  function support(position,quaternion,points){let y=-Infinity;for(const point of points){const offset=point.clone().multiplyScalar(scale).applyQuaternion(quaternion);y=Math.max(y,ground.at(position.x+offset.x,position.z+offset.z)+.12-offset.y);}position.y=y;return position;}
  for(const pitch of [0,-.25,.25,-.5,.5])for(const roll of [0,-.25,.25]){
   const quaternion=yaw.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(pitch,0,roll))),ankleOffset=l.restAnkle.clone().sub(l.restToe).multiplyScalar(scale).applyQuaternion(quaternion);
   for(let step=0;step<=8;step++){
    const position=support(desired.clone().lerp(hip,step/8),quaternion,l.searchSole),ankle=position.clone().add(ankleOffset),distance=ankle.distanceTo(hip);
    const score=(position.x-desired.x)**2+(position.z-desired.z)**2+(Math.max(0,distance-reach)**2+Math.max(0,minReach-distance)**2)*2000+pitch*pitch+roll*roll;
    if(score<bestScore){best={position,quaternion};bestScore=score;}
   }
  }
  support(best.position,best.quaternion,l.sole);
  return best;
 }
 function stepFeet({gait,ground,dt,reset=false}){
  const scale=visual.getWorldScale(new T.Vector3()).x;
  for(const l of legs){
   if(reset){l.anchor=null;l.step=null;l.previousSwing=false;}
   const cycle=((gait+l.i*.5+(l.side>0?.5:0))%1+1)%1,normalSwing=cycle>.66,desired=model.root.localToWorld(l.restFoot.clone()),hip=l.upperBone.getWorldPosition(new T.Vector3());
   if(!l.anchor){const support=supportedPlacement(l,desired,ground);l.anchor=support.position;l.supportQuaternion=support.quaternion;l.previousSwing=normalSwing;}
   const ankle=l.anchor.clone().add(l.restAnkle.clone().sub(l.restToe).multiplyScalar(scale).applyQuaternion(l.supportQuaternion)),maxReach=(l.upperLength+l.lowerLength)*scale;
   const distance=ankle.distanceTo(hip),endangered=distance>maxReach*.86||distance<Math.abs(l.upperLength-l.lowerLength)*scale+1;
   if(!l.step&&(endangered||(normalSwing&&!l.previousSwing))){
    const target=supportedPlacement(l,desired,ground);l.step={start:l.anchor.clone(),target:target.position,startQuaternion:l.supportQuaternion.clone(),quaternion:target.quaternion,elapsed:0,duration:.14,lift:3.6};
    for(let sample=1;sample<16;sample++){const f=sample/16,ease=T.MathUtils.smoothstep(f,0,1),p=l.step.start.clone().lerp(l.step.target,ease),q=l.step.startQuaternion.clone().slerp(l.step.quaternion,ease);for(const point of l.searchSole){const offset=point.clone().multiplyScalar(scale).applyQuaternion(q);l.step.lift=Math.max(l.step.lift,(ground.at(p.x+offset.x,p.z+offset.z)+.16-p.y-offset.y)/Math.sin(Math.PI*f));}}
   }
   let world=l.anchor.clone();l.poseFootQuaternion=l.supportQuaternion.clone();
   if(l.step){
    l.step.elapsed+=dt;const fraction=Math.min(1,l.step.elapsed/l.step.duration),ease=T.MathUtils.smoothstep(fraction,0,1);
    world.lerpVectors(l.step.start,l.step.target,ease);world.y+=Math.sin(Math.PI*fraction)*l.step.lift;l.poseFootQuaternion.copy(l.step.startQuaternion).slerp(l.step.quaternion,ease);
    if(fraction>=1){l.anchor.copy(l.step.target);l.supportQuaternion.copy(l.step.quaternion);world.copy(l.anchor);l.step=null;}
   }
   l.swingAdjustment=0;
   if(l.step){
    // A lifted rigid foot can approach the hip closer than the two unequal
    // upper links can fold. Bend the AIR path around that inner reach sphere;
    // stance anchors and contact transforms are never corrected or slid.
    const offset=l.restAnkle.clone().sub(l.restToe).multiplyScalar(scale).applyQuaternion(l.poseFootQuaternion),delta=world.clone().add(offset).sub(hip),distance=delta.length(),low=Math.abs(l.upperLength-l.lowerLength)*scale+.08,high=(l.upperLength+l.lowerLength)*scale-.08;
    const softMax=(x,y)=>{const d=x-y,k=.25;return d>=k?x:d<=-k?y:y+(d+k)*(d+k)/(4*k);};
    const safeDistance=-softMax(-softMax(distance,low),-high);
    if(distance>1e-8){const correction=delta.multiplyScalar((safeDistance-distance)/distance);world.add(correction);l.swingAdjustment=correction.length();}
   }
   l.previousSwing=normalSwing;l.planted=!l.step;l.surface.copy(world);l.surface.y=ground.at(world.x,world.z);
   poseLeg(l,null,null,model.root.worldToLocal(world));
  }
 }
 function supportStats(ground){
  model.root.updateMatrixWorld(true);
  return legs.map(l=>{let minClearance=Infinity;for(const {mesh,index}of l.soleVertices){mesh.skeleton.update();const point=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);minClearance=Math.min(minClearance,point.y-ground.at(point.x,point.z));}return {name:l.rig.name,planted:l.planted,minClearance,vertices:l.soleVertices.length,footMatrix:l.footBone.matrixWorld.elements.slice()};});
 }
 function resetPose(){
  bodyBone.position.copy(bodyRest);bodyBone.quaternion.identity();headBone.quaternion.copy(headRest);
  scythes.forEach(s=>s.bone.quaternion.copy(s.rest));mandibles.forEach(j=>j.bone.quaternion.copy(j.rest));
  for(const l of legs){l.upperBone.quaternion.identity();l.lowerBone.quaternion.identity();l.footBone.quaternion.identity();l.reachError=l.contactError=0;l.step=null;l.poseFootQuaternion=null;l.supportQuaternion=null;}
  glow.scale.setScalar(.01);model.root.updateWorldMatrix(true,true);
 }
 resetPose();
 // This shorter anatomy takes two visual strides per legacy 17.4-world-unit
 // cycle. Root route, speed, collision proxies and attack timing stay unchanged.
 return {...model,legs,mouth,visual,skin,gaitDistance:8.7,poseLeg,stepFeet,supportStats,syncPose,resetPose,stats:()=>({stage:'mesh-rigged',legs:4,scythes:2,maxContactError:Math.max(...legs.map(l=>l.contactError)),maxReachError:Math.max(...legs.map(l=>l.reachError)),maxSwingAdjustment:Math.max(...legs.map(l=>l.swingAdjustment||0))})};
}
