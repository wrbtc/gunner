import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Y=V(0,1,0),clamp=THREE.MathUtils.clamp;
const LIMBS=[
 {key:'fl',side:1,fore:true,hip:[1.25,1.26,-.82],knee:[2.12,.92,-1.10],palm:[2.36,.24,-1.97]},
 {key:'fr',side:-1,fore:true,hip:[-1.25,1.26,-.82],knee:[-2.12,.92,-1.10],palm:[-2.36,.24,-1.97]},
 {key:'rl',side:1,fore:false,hip:[1.14,1.05,1.23],knee:[1.88,.65,1.95],palm:[2.18,.21,1.08]},
 {key:'rr',side:-1,fore:false,hip:[-1.14,1.05,1.23],knee:[-1.88,.65,1.95],palm:[-2.18,.21,1.08]},
];
let pending;
export function loadCinderMaw(){
 if(!pending){
  const loader=new GLTFLoader();
  // Embedded GLB images are img-src blob resources. Avoid ImageBitmapLoader's
  // fetch(blob:) path, which is intentionally excluded by connect-src self.
  loader.register(parser=>{
   parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
   parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
   parser.textureLoader.setRequestHeader(parser.options.requestHeader);
   return {name:'CinderMawImageTextures'};
  });
  pending=loader.loadAsync(new URL('../assets/cinder-maw-v02.glb',import.meta.url).href).then(({scene})=>{
  scene.updateMatrixWorld(true);const sourceBody=scene.getObjectByName('body');if(!sourceBody?.isBone)throw Error('Cinder Maw body rig missing');
  const inverseBody=sourceBody.matrixWorld.clone().invert();let vertices=0,triangles=0,draws=0;
  scene.traverse(n=>{if(n.isMesh){vertices+=n.geometry.attributes.position.count;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;draws++;}});
  if(draws!==1||triangles>40000)throw Error('Unexpected Cinder Maw export');
  scene.traverse(n=>{if(n.isMesh)for(const slot of ['map','normalMap','emissiveMap']){
   const image=n.material[slot]?.image;
   if(!image||image.width!==1024||image.height!==1024)throw Error('Cinder Maw texture missing: '+slot);
  }});
  return {stats:{model:'cinder-maw-v02',vertices,triangles,draws,bones:14},clone(){
   const root=scene.clone(true),bySource=new Map();
   function pair(a,b){bySource.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}pair(scene,root);
   scene.traverse(source=>{if(!source.isSkinnedMesh)return;const mesh=bySource.get(source);mesh.skeleton=new THREE.Skeleton(source.skeleton.bones.map(b=>bySource.get(b)),source.skeleton.boneInverses.map(m=>m.clone()));mesh.bindMatrix.copy(source.bindMatrix);mesh.bindMatrixInverse.copy(source.bindMatrixInverse);mesh.material=source.material.clone();mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;});
   root.name='Cinder_Maw_gameplay';root.updateMatrixWorld(true);
   const body=root.getObjectByName('body'),jaw=root.getObjectByName('jaw'),mouth=root.getObjectByName('cinder_mouth'),skin=root.getObjectByName('Cinder_Maw_skin');
   const rest=new Map();root.traverse(n=>{if(n.isBone)rest.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),worldQuaternion:n.getWorldQuaternion(new THREE.Quaternion())});});
   const limbs=LIMBS.map(l=>({...l,hip:V(...l.hip),knee:V(...l.knee),palm:V(...l.palm),upper:root.getObjectByName(l.key+'_upper'),lower:root.getObjectByName(l.key+'_lower'),foot:root.getObjectByName(l.key+'_foot')}));
   for(const l of limbs){l.upperLength=l.hip.distanceTo(l.knee);l.lowerLength=l.knee.distanceTo(l.palm);}
   const rig={root,body,jaw,mouth,skin,rest,limbs,resetPose(){for(const [bone,r]of rest){bone.position.copy(r.position);bone.quaternion.copy(r.quaternion);}root.updateMatrixWorld(true);},bodyPoint(point,out=V()){body.updateWorldMatrix(true,false);return out.copy(point).applyMatrix4(inverseBody).applyMatrix4(body.matrixWorld);}};
   return rig;
  }};
 });
 }
 return pending;
}
// Two-bone IK retains authored lengths; foot orientation stays grounded while
// the continuous weighted skin and all rigid rock/claw parts follow the rig.
export function poseCinderLeg(rig,leg,goal,heading,normal=Y){
 const hip=leg.upper.getWorldPosition(V()),scale=rig.root.getWorldScale(V()).x,L1=leg.upperLength*scale,L2=leg.lowerLength*scale;
 const axis=goal.clone().sub(hip),requested=axis.length();axis.normalize();
 const distance=clamp(requested,Math.abs(L1-L2)+.0001,L1+L2-.0001);
 const restHip=rig.root.localToWorld(leg.hip.clone()),restKnee=rig.root.localToWorld(leg.knee.clone());
 const bend=restKnee.sub(restHip);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-8)bend.set(leg.side,1,0);bend.normalize();
 const along=(L1*L1-L2*L2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=hip.clone().addScaledVector(axis,distance);
 function pointBone(bone,target){
  bone.updateWorldMatrix(true,false);const q=bone.getWorldQuaternion(new THREE.Quaternion()),current=Y.clone().applyQuaternion(q),wanted=target.clone().sub(bone.getWorldPosition(V())).normalize();
  q.premultiply(new THREE.Quaternion().setFromUnitVectors(current,wanted));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);
 }
 pointBone(leg.upper,knee);pointBone(leg.lower,end);
 const flat=new THREE.Quaternion().setFromAxisAngle(Y,heading).multiply(rig.rest.get(leg.foot).worldQuaternion);
 flat.premultiply(new THREE.Quaternion().setFromUnitVectors(Y,normal));leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(flat));leg.foot.updateWorldMatrix(false,true);
 return {requested,reach:L1+L2,error:leg.foot.getWorldPosition(V()).distanceTo(goal),knee:knee.toArray()};
}
