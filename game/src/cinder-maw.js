import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Y=V(0,1,0),clamp=THREE.MathUtils.clamp;
export const CINDER_GAMEPLAY_SOLID=Object.freeze({
 asset:'field-notes-v02/cinder-maw-fieldnotes-v02',
 sha256:'2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52',
 bytes:1483396,
 armature:'TankArmature',
 clips:Object.freeze(['cinder_idle','cinder_jaw_inspect','cinder_weight_shift']),
 bones:Object.freeze(['root','body','neck','head','jaw','cinder_mouth','tail_base','tail_mid','tail_tip','front_L_upper','front_L_lower','front_L_foot','front_R_upper','front_R_lower','front_R_foot','hind_L_upper','hind_L_lower','hind_L_foot','hind_R_upper','hind_R_lower','hind_R_foot'])
});
const LIMBS=[
 {key:'front_L',side:-1,fore:true},{key:'front_R',side:1,fore:true},
 {key:'hind_L',side:-1,fore:false},{key:'hind_R',side:1,fore:false}
];
let pending;

function hexSha256(bytes){
 return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
}
function isLfsPointer(bytes){return new TextDecoder().decode(bytes.subarray(0,80)).includes('git-lfs.github.com');}
function makeLoader(){
 const loader=new GLTFLoader();
 // Embedded GLB images are img-src blob resources. Avoid ImageBitmapLoader's
 // fetch(blob:) path, which is intentionally excluded by connect-src self.
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'CinderMawImageTextures'};
 });
 return loader;
}
function cloneSkinnedTree(source){
 const root=source.clone(true),bySource=new Map();
 function pair(a,b){bySource.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}
 pair(source,root);
 source.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  const mesh=bySource.get(node);
  mesh.skeleton=new THREE.Skeleton(node.skeleton.bones.map(bone=>bySource.get(bone)),node.skeleton.boneInverses.map(inverse=>inverse.clone()));
  mesh.bindMatrix.copy(node.bindMatrix);mesh.bindMatrixInverse.copy(node.bindMatrixInverse);
  mesh.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
  mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
 });
 return root;
}
export function loadCinderMaw(){
 if(!pending){
  const spec=CINDER_GAMEPLAY_SOLID,url=new URL(`../assets/${spec.asset}.glb`,import.meta.url).href;
  pending=fetch(url).then(async response=>{
   if(!response.ok)throw Error('Cinder Maw gameplay solid missing');
   const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
   if(isLfsPointer(bytes))throw Error('Cinder Maw gameplay solid is an LFS pointer');
   if(bytes.byteLength!==spec.bytes)throw Error('Cinder Maw gameplay solid size mismatch');
   if(await hexSha256(bytes)!==spec.sha256)throw Error('Cinder Maw gameplay solid hash mismatch');
   return makeLoader().parseAsync(buffer,'');
  }).then(({scene,animations})=>{
   scene.updateMatrixWorld(true);
   if(!scene.getObjectByName(spec.armature))throw Error('Cinder Maw armature missing');
   for(const name of spec.bones)if(!scene.getObjectByName(name)?.isBone)throw Error('Cinder Maw bone missing: '+name);
   const clips=new Set(animations.map(clip=>clip.name));for(const name of spec.clips)if(!clips.has(name))throw Error('Cinder Maw clip missing: '+name);
   let vertices=0,triangles=0,draws=0,bones=0;
   scene.traverse(node=>{if(node.isBone)bones++;if(node.isMesh){vertices+=node.geometry.attributes.position.count;triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;draws++;}});
   if(draws!==1||triangles>20000||bones!==21)throw Error('Unexpected Cinder Maw gameplay export');
   return {stats:{model:'cinder-maw-fieldnotes-v02',sha256:spec.sha256,vertices,triangles,draws,bones,clips:[...clips]},clone(){
    const root=cloneSkinnedTree(scene);root.name='Cinder_Maw_gameplay';root.updateMatrixWorld(true);
    const body=root.getObjectByName('body'),neck=root.getObjectByName('neck'),head=root.getObjectByName('head'),jaw=root.getObjectByName('jaw'),mouth=root.getObjectByName('cinder_mouth');
    let skin=null;root.traverse(node=>{if(!skin&&node.isSkinnedMesh)skin=node;});
    const rest=new Map();root.traverse(node=>{if(node.isBone)rest.set(node,{position:node.position.clone(),quaternion:node.quaternion.clone(),worldQuaternion:node.getWorldQuaternion(new THREE.Quaternion())});});
    const inverseBody=body.matrixWorld.clone().invert(),localPoint=node=>root.worldToLocal(node.getWorldPosition(V()));
    const limbs=LIMBS.map(source=>{
     const upper=root.getObjectByName(source.key+'_upper'),lower=root.getObjectByName(source.key+'_lower'),foot=root.getObjectByName(source.key+'_foot');
     const hip=localPoint(upper),knee=localPoint(lower),palm=localPoint(foot);
     return {...source,hip,knee,palm,upper,lower,foot,upperAxis:lower.position.clone().normalize(),lowerAxis:foot.position.clone().normalize(),upperLength:lower.position.length(),lowerLength:foot.position.length()};
    });
    const motionBones={neck,head,tailBase:root.getObjectByName('tail_base'),tailMid:root.getObjectByName('tail_mid'),tailTip:root.getObjectByName('tail_tip')};
    return {root,body,neck,head,jaw,mouth,skin,rest,limbs,motionBones,forwardLocal:V(0,0,1),headingOffset:Math.PI,
     resetPose(){for(const [bone,r]of rest){bone.position.copy(r.position);bone.quaternion.copy(r.quaternion);}root.updateMatrixWorld(true);},
     bodyPoint(point,out=V()){body.updateWorldMatrix(true,false);return out.copy(point).applyMatrix4(inverseBody).applyMatrix4(body.matrixWorld);}
    };
   }};
  }).catch(error=>{pending=null;throw error;});
 }
 return pending;
}

// Generic two-bone IK follows each authored child axis, rather than assuming
// that every DCC export points its bones down local +Y.
export function poseCinderLeg(rig,leg,goal,heading,normal=Y){
 const hip=leg.upper.getWorldPosition(V()),scale=rig.root.getWorldScale(V()).x,L1=leg.upperLength*scale,L2=leg.lowerLength*scale;
 const axis=goal.clone().sub(hip),requested=axis.length();axis.normalize();
 const distance=clamp(requested,Math.abs(L1-L2)+.0001,L1+L2-.0001);
 const restHip=rig.root.localToWorld(leg.hip.clone()),restKnee=rig.root.localToWorld(leg.knee.clone());
 const bend=restKnee.sub(restHip);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-8)bend.set(leg.side,1,0);bend.normalize();
 const along=(L1*L1-L2*L2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=hip.clone().addScaledVector(axis,distance);
 function pointBone(bone,target,localAxis){
  bone.updateWorldMatrix(true,false);const q=bone.getWorldQuaternion(new THREE.Quaternion()),current=(localAxis||Y).clone().applyQuaternion(q),wanted=target.clone().sub(bone.getWorldPosition(V())).normalize();
  q.premultiply(new THREE.Quaternion().setFromUnitVectors(current,wanted));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);
 }
 pointBone(leg.upper,knee,leg.upperAxis);pointBone(leg.lower,end,leg.lowerAxis);
 const visualHeading=heading+(rig.headingOffset||0),flat=new THREE.Quaternion().setFromAxisAngle(Y,visualHeading).multiply(rig.rest.get(leg.foot).worldQuaternion);
 flat.premultiply(new THREE.Quaternion().setFromUnitVectors(Y,normal));leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(flat));leg.foot.updateWorldMatrix(false,true);
 return {requested,reach:L1+L2,error:leg.foot.getWorldPosition(V()).distanceTo(goal),knee:knee.toArray()};
}
