import * as THREE from '../vendor/three.module.js?v=052';
import {createBankGuideModel} from './bank-demons.js?v=052';
import {createRimmerModel} from './rimmer-model.js?v=052';
import {cloneSkinnedGuide} from './skinned-solids.js?v=054-74';
import {loadGuideEggPart,loadGuideIntactEgg} from './field-guide-egg-parts.js?v=054-74';
const GUIDE_FRONT_YAW=.35,GUIDE_DRAGON_YAW=.18;
export const GUIDE_FRONT_IDS=Object.freeze(['creepers','rimmers','plasma','tanks','dancers','eggs','egg-maggot','egg-shell']);
export function guideYawFor(id){
 // Dragons used Math.PI+.4 (rear, flying away). Face the camera instead.
 return id==='dragons'?GUIDE_DRAGON_YAW:GUIDE_FRONT_IDS.includes(id)?GUIDE_FRONT_YAW:Math.PI+.4;
}
// Copy display state without touching actor transforms, uniforms or lifetimes.
export function cloneGuideMaterial(source){
 const material=source.clone();
 // Material.copy preserves flatShading for GLBs without normals, all texture
 // channels, alpha modes and color-space interpretation; callbacks need explicit copying.
 material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;return material;
}
export function cloneGuideTree(source){
 const root=cloneSkinnedGuide(source);
 root.traverse(node=>{if(node.isMesh){node.geometry=node.geometry.clone();node.material=Array.isArray(node.material)?node.material.map(cloneGuideMaterial):cloneGuideMaterial(node.material);}});
 const excluded=[];root.traverse(node=>{if(node.isLight||node.isSprite)excluded.push(node);});excluded.forEach(node=>node.removeFromParent());return root;
}

function isolateGuideMeshes(root){
 root.traverse(node=>{
  if(!node.isMesh)return;
  node.material=Array.isArray(node.material)?node.material.map(cloneGuideMaterial):cloneGuideMaterial(node.material);
  // Each animated guide owns its geometry. Cached templates survive guide closure.
  if(!root.userData.shareGuideGeometry)node.geometry=node.geometry.clone();
 });
 return root;
}
function solidGuideRoot(solid){
 if(!solid)return null;
 const root=solid.museumRoot();
 // Isolation copies keep combat actors untouched. Hollow ember_idle, tank idle, dancer ritual_idle may play.
 root.rotation.y=0;
 return isolateGuideMeshes(root);
}
function creeperGuideRoot(creeperLoco,solid){
 const fromSolid=solidGuideRoot(solid);
 if(fromSolid)return fromSolid;
 if(!creeperLoco)return createBankGuideModel(false);
 const visual=creeperLoco.attach(new THREE.Group());
 const root=visual.root;
 root.visible=true;
 // Museum facing: GLB +Z toward the guide camera. Combat attach yaw stays in loco.
 root.rotation.y=0;
 return isolateGuideMeshes(root);
}
// Small occupied boxes follow the silhouette more closely than one large box,
// while avoiding a full vertex scan on every drag or animation frame.
function guideFramingBoxes(root,bounds,center,scale){
 const size=bounds.getSize(new THREE.Vector3()),point=new THREE.Vector3(),cells=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   const x=THREE.MathUtils.clamp(Math.floor((point.x-bounds.min.x)/Math.max(size.x,.001)*8),0,7);
   const y=THREE.MathUtils.clamp(Math.floor((point.y-bounds.min.y)/Math.max(size.y,.001)*8),0,7);
   const z=THREE.MathUtils.clamp(Math.floor((point.z-bounds.min.z)/Math.max(size.z,.001)*8),0,7),key=x*64+y*8+z;
   if(!cells.has(key))cells.set(key,new THREE.Box3());
   cells.get(key).expandByPoint(point);
  }
 });
 return [...cells.values()].map(box=>new THREE.Box3(box.min.sub(center).multiplyScalar(scale),box.max.sub(center).multiplyScalar(scale)));
}
// Dragons use the Field Guide A museum solid only. Do not clone live canyon wyverns.
export async function buildGuideModel(id,{eggNests,plasmaBugs,cinderModel,creeperLoco,skinnedSolids}){
 let root;
 if(id==='egg-maggot'||id==='egg-shell')root=solidGuideRoot(await loadGuideEggPart(id));
 else if(id==='eggs')root=solidGuideRoot(skinnedSolids?.eggs||await loadGuideIntactEgg());
 else if(id==='creepers')root=creeperGuideRoot(creeperLoco,skinnedSolids?.creepers);
 else if(id==='dancers')root=solidGuideRoot(skinnedSolids?.dancers);
 else if(id==='rimmers')root=solidGuideRoot(skinnedSolids?.rimmers)||cloneGuideTree(createRimmerModel().root);
 else if(id==='tanks'){
  root=solidGuideRoot(skinnedSolids?.tanks);
  if(!root){
   const rig=cinderModel.clone();rig.resetPose();root=rig.root;
   root.traverse(n=>{if(n.isMesh)n.geometry=n.geometry.clone();});
  }
 }
 else if(id==='plasma'){
  root=solidGuideRoot(skinnedSolids?.plasma);
  if(!root){root=cloneGuideTree(plasmaBugs.actors[0].root);root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);}
 }
 else if(id==='dragons')root=solidGuideRoot(skinnedSolids?.dragons);
 if(!root)throw Error('No 3D guide model: '+id);
 root.visible=true;root.position.set(0,0,0);root.updateMatrixWorld(true);
 root.traverse(n=>{n.layers.set(0);n.frustumCulled=false;n.castShadow=false;n.receiveShadow=false;});
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3()),scale=2.4/Math.max(extent.x,extent.y,extent.z);
 const viewBoxes=guideFramingBoxes(root,bounds,center,scale);
 const frame=new THREE.Group(),pivot=new THREE.Group();frame.add(pivot);pivot.add(root);pivot.scale.setScalar(scale);root.position.sub(center);frame.name='Guide '+id;frame.rotation.y=guideYawFor(id);
 const mixers=[];
 root.traverse(n=>{if(n.userData.guideMixer&&!mixers.includes(n.userData.guideMixer))mixers.push(n.userData.guideMixer);});
 let clips=[];root.traverse(n=>{if(n.userData.guideClips)clips=n.userData.guideClips;});
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;for(const mixer of mixers){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}const geos=new Set(),mats=new Set(),skeletons=new Set();root.traverse(n=>{if(n.geometry&&!root.userData.shareGuideGeometry)geos.add(n.geometry);if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])mats.add(m);if(n.isSkinnedMesh)skeletons.add(n.skeleton);});skeletons.forEach(s=>s.dispose());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());};
 const viewBounds=new THREE.Box3(bounds.min.clone().sub(center).multiplyScalar(scale),bounds.max.clone().sub(center).multiplyScalar(scale));
 const result={root:frame,dispose,viewBounds,viewBoxes};
 if(mixers.length){
  result.clips=clips.map(c=>({name:c.name,label:c.name.replace(/^(ember|rimmer|plasma|ritual|cinder|maggot)_/,'').replaceAll('_',' ')}));
  result.activeClip=clips.find(c=>/idle|wriggle/.test(c.name))?.name||clips[0]?.name;
  result.tick=dt=>{if(!disposed)mixers.forEach(m=>m.update(dt));};
  result.playClip=name=>{const clip=clips.find(c=>c.name===name);if(!clip||disposed)return;result.activeClip=name;for(const mixer of mixers){mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.update(0);}};
 }
 return result;
}
