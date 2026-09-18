import * as THREE from '../vendor/three.module.js?v=052';
import {cloneSkinnedGuide} from './skinned-solids.js?v=054-88';

export const EMBER_PRIEST_TARGET_HEIGHT=6.15;
export const EMBER_PRIEST_THROW_RELEASE=2.9;
export const EMBER_PRIEST_PHASES=3;
const ASH=new THREE.Color(0x999999),EMBER=new THREE.Color(0xf28a32),GLOW=new THREE.Color(0xff5a10),WHITE=new THREE.Color(0xffffff);

export function inPlacePriestClip(clip,restPosition){
 const copy=clip.clone(),track=copy.tracks.find(item=>item.name==='Hips.position');
 if(!track||track.getValueSize()!==3||!restPosition)throw Error('Ember Priest root track missing: '+clip.name);
 const values=track.values,times=track.times,last=times.length-1,span=times[last]-times[0],anchor=restPosition.toArray();
 const first=Array.from(values.subarray(0,3)),travel=first.map((value,axis)=>values[last*3+axis]-value);
 for(let key=0;key<=last;key++){
  const phase=span>0?(times[key]-times[0])/span:0;
  for(let axis=0;axis<3;axis++)values[key*3+axis]+=anchor[axis]-first[axis]-travel[axis]*phase;
 }
 return copy;
}

export function emberPriestVisualBounds(scene){
 scene.updateMatrixWorld(true);const box=new THREE.Box3(),point=new THREE.Vector3();let skinned=0;
 scene.traverse(node=>{
  if(!node.isMesh)return;
  const position=node.geometry?.attributes?.position;
  if(node.isSkinnedMesh&&node.skeleton&&position){
   skinned++;node.skeleton.update();
   for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);node.applyBoneTransform(i,point);node.localToWorld(point);box.expandByPoint(point);}
  }else{
   if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
   if(node.geometry.boundingBox)box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  }
 });
 return{box,skinned};
}

function priestMaterials(root,clone=false){
 const materials=[];
 root.traverse(node=>{
  if(!node.isMesh)return;
  const source=Array.isArray(node.material)?node.material:[node.material];
  const owned=source.map(material=>{
   const next=clone?material.clone():material;
   next.side=THREE.FrontSide;next.emissiveMap=null;
   if('metalness'in next)next.metalness=Math.min(next.metalness??0,.12);
   if('roughness'in next)next.roughness=Math.max(next.roughness??.8,.76);
   materials.push(next);return next;
  });
  if(clone)node.material=Array.isArray(node.material)?owned:owned[0];
 });
 return materials;
}

export function styleEmberPriest(root,warmth=1,hit=0,clone=false){
 const materials=clone?priestMaterials(root,true):(root.userData.emberPriestMaterials||priestMaterials(root,false));
 root.userData.emberPriestMaterials=materials;
 const glow=Math.max(0,Math.min(1,warmth)),flash=Math.max(0,Math.min(1,hit));
 for(const material of materials){
  if(material.color)material.color.copy(ASH).lerp(EMBER,glow).lerp(WHITE,flash*.42);
  if(material.emissive)material.emissive.set(0x000000).lerp(GLOW,glow).lerp(WHITE,flash*.18);
  if('emissiveIntensity'in material)material.emissiveIntensity=.16*glow+.12*flash;
  material.needsUpdate=true;
 }
 return materials;
}

function clipByName(solid,key){
 const name=solid.spec.clips[key],clip=solid.animations.find(item=>item.name===name);
 if(!clip)throw Error('Ember Priest clip missing: '+name);return clip;
}

export function createEmberPriestKit(solid){
 if(!solid)return null;
 const {box,skinned}=emberPriestVisualBounds(solid.scene);
 if(!skinned)throw Error('Ember Priest skinned mesh missing');
 const size=box.getSize(new THREE.Vector3()),height=Math.max(size.y,.001),uniform=EMBER_PRIEST_TARGET_HEIGHT/height;
 const rest=solid.scene.getObjectByName('Hips')?.position;
 if(!rest)throw Error('Ember Priest Hips missing');
 const clips={idle:clipByName(solid,'idle')};
 for(const key of ['walk','run','dance','throw'])clips[key]=inPlacePriestClip(clipByName(solid,key),rest);
 let triangles=0,draws=0;solid.scene.traverse(node=>{if(node.isMesh){draws++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
 const stats={asset:solid.spec.asset,draws,triangles:Math.round(triangles),skinned,height,uniform,phaseFamilies:EMBER_PRIEST_PHASES};
 return{
  stats,
  attach(parent,index=0){
   const holder=new THREE.Group(),visual=cloneSkinnedGuide(solid.scene),mixer=new THREE.AnimationMixer(visual),actions=new Map();
   holder.name=`Ember Priest visual ${index}`;holder.userData.phaseFamily=index%EMBER_PRIEST_PHASES;parent.add(holder);
   visual.name=`Ember Priest rig ${index}`;visual.scale.setScalar(uniform);visual.rotation.y=Math.PI;visual.position.y=-box.min.y*uniform;holder.add(visual);
   styleEmberPriest(visual,1,0,true);
   visual.traverse(node=>{if(node.isMesh){node.frustumCulled=false;node.castShadow=true;node.receiveShadow=true;}});
   let current=null,currentAction=null;
   const phase=(index%EMBER_PRIEST_PHASES)/EMBER_PRIEST_PHASES;
   function select(kind){
    const next=clips[kind]||clips.idle;if(current===kind&&currentAction)return currentAction;
    mixer.stopAllAction();let action=actions.get(kind);
    if(!action){action=mixer.clipAction(next);actions.set(kind,action);}
    const once=kind==='throw';action.reset().setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);action.clampWhenFinished=once;action.play();
    if(kind==='dance')action.time=next.duration*phase;
    mixer.update(0);current=kind;currentAction=action;return action;
   }
   function play(kind,dt=0,timeScale=1){const action=select(kind);action.setEffectiveTimeScale(timeScale);if(dt>0)mixer.update(dt);holder.visible=true;}
   function syncThrow(seconds){const action=select('throw');action.paused=false;action.time=THREE.MathUtils.clamp(seconds,0,clips.throw.duration);mixer.update(0);holder.visible=true;}
   function throwingHandWorld(target){
    if(current!=='throw'||!holder.visible)return null;const hand=visual.getObjectByName('RightHand');if(!hand)return null;
    holder.updateMatrixWorld(true);return hand.getWorldPosition(target||new THREE.Vector3());
   }
   function setWarmth(warmth,hit=0){styleEmberPriest(visual,warmth,hit);}
   function reset(){current=null;currentAction=null;mixer.stopAllAction();setWarmth(1,0);select('dance');holder.visible=true;}
   function stop(){holder.visible=false;mixer.stopAllAction();current=null;currentAction=null;}
   reset();
   return{root:holder,visual,mixer,play,syncThrow,throwingHandWorld,setWarmth,reset,stop,get current(){return current;},phaseFamily:index%EMBER_PRIEST_PHASES};
  }
 };
}
