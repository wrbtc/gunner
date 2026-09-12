import * as THREE from '../vendor/three.module.js?v=052';
import {createBankGuideModel} from './bank-demons.js?v=052';
import {createRimmerModel} from './rimmer-model.js?v=052';
// Copy display state without touching actor transforms, uniforms or lifetimes.
export function cloneGuideMaterial(source){
 const material=new source.constructor();
 for(const key of ['color','emissive','normalScale'])if(source[key]&&material[key])material[key].copy(source[key]);
 for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','roughness','metalness','emissiveIntensity','opacity','transparent','side','alphaTest','depthWrite','vertexColors','toneMapped','blending'])if(key in source)material[key]=source[key];
 material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;return material;
}
export function cloneGuideTree(source){
 const root=source.isMesh?new THREE.Mesh(source.geometry.clone(),Array.isArray(source.material)?source.material.map(cloneGuideMaterial):cloneGuideMaterial(source.material)):new THREE.Group();
 root.name=source.name;root.position.copy(source.position);root.quaternion.copy(source.quaternion);root.scale.copy(source.scale);root.visible=source.visible;root.renderOrder=source.renderOrder;
 for(const child of source.children)if(!child.isLight&&!child.isSprite)root.add(cloneGuideTree(child));return root;
}
function creeperGuideRoot(creeperLoco){
 if(!creeperLoco)return createBankGuideModel(false);
 const visual=creeperLoco.attach(new THREE.Group());
 const root=visual.root;
 root.visible=true;
 // Museum facing: GLB +Z toward the guide camera. Combat attach yaw stays in loco.
 root.rotation.y=0;
 root.traverse(node=>{
  if(!node.isMesh)return;
  node.material=Array.isArray(node.material)?node.material.map(cloneGuideMaterial):cloneGuideMaterial(node.material);
  node.geometry=node.geometry.clone();
 });
 return root;
}
export function buildGuideModel(id,{eggNests,plasmaBugs,cinderModel,creeperLoco}){
 let root;
 if(id==='eggs')root=eggNests.guideModel();
 else if(id==='creepers')root=creeperGuideRoot(creeperLoco);
 else if(id==='dancers')root=createBankGuideModel(true);
 else if(id==='rimmers'){root=cloneGuideTree(createRimmerModel().root);}
 else if(id==='tanks'){
  const rig=cinderModel.clone();rig.resetPose();root=rig.root;
  root.traverse(n=>{if(n.isMesh)n.geometry=n.geometry.clone();});
 }
 else if(id==='plasma'){
  root=cloneGuideTree(plasmaBugs.actors[0].root);root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);
 }
 if(!root)throw Error('No 3D guide model: '+id);
 root.visible=true;root.position.set(0,0,0);root.updateMatrixWorld(true);
 root.traverse(n=>{n.layers.set(0);n.frustumCulled=false;n.castShadow=false;n.receiveShadow=false;});
 const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3()),scale=2.4/Math.max(extent.x,extent.y,extent.z);
 const frame=new THREE.Group(),pivot=new THREE.Group();frame.add(pivot);pivot.add(root);pivot.scale.setScalar(scale);root.position.sub(center);frame.name='Guide '+id;frame.rotation.y=id==='creepers'?0:id==='eggs'?.25:Math.PI+.4;
 return{root:frame,dispose(){const geos=new Set(),mats=new Set();root.traverse(n=>{if(n.geometry)geos.add(n.geometry);if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])mats.add(m);if(n.isSkinnedMesh)n.skeleton.dispose();});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
