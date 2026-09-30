import * as THREE from '../vendor/three.module.js?v=052';
import {loadGuideSolid} from './skinned-solids.js?v=054-86';
import {infestShell,smoothShell} from './egg-nests.js?v=054-74';
// Independent specimen views only; the live nest and its source assets are untouched.
const SPECS={
 'egg-maggot':{id:'egg-maggot',asset:'field-notes-v02/egg-maggot-fieldnotes-v02',sha256:'dce9f57242857ebcf84a567a25932278ea1e6454cb3e6aeb2c26bc83a1402d7d',bytes:240068,armature:'MaggotArmature',clips:{idle:'maggot_wriggle'}},
 'egg-shell':{id:'egg-shell',asset:'egg-shell-a',sha256:'516613a95b3eba0fff77e2e78197cab6becebec7bcb91124517bb963ad6f994c',bytes:323500,static:true}
};
const pending=new Map();
export function loadGuideEggPart(id){
 if(!SPECS[id])throw Error('Unknown Field Notes egg specimen');
 if(!pending.has(id))pending.set(id,loadGuideSolid(SPECS[id]).catch(error=>{pending.delete(id);throw error;}));
 return pending.get(id);
}
function sacBodyBox(shellBox){
 const size=shellBox.getSize(new THREE.Vector3());
 const bodyZ=Math.min(size.z,Math.max(size.x,size.y)*1.25);
 const box=shellBox.clone();
 if(size.z>bodyZ+1e-4){
  const earliest=shellBox.min.z,latest=shellBox.max.z-bodyZ;
  const bodyMinZ=THREE.MathUtils.clamp(-bodyZ/2,earliest,latest);
  box.min=box.min.clone();box.max=box.max.clone();
  box.min.z=bodyMinZ;box.max.z=bodyMinZ+bodyZ;
 }
 return box;
}
function nestMaggotInShell(shell,maggot){
 // Maggot longest axis is +X; the shell sac and filaments are longest on +Z.
 maggot.rotation.y=Math.PI/2;
 shell.updateMatrixWorld(true);maggot.updateMatrixWorld(true);
 const shellBox=new THREE.Box3().setFromObject(shell),maggotBox=new THREE.Box3().setFromObject(maggot);
 const bodyBox=sacBodyBox(shellBox);
 const bodySize=bodyBox.getSize(new THREE.Vector3()),maggotSize=maggotBox.getSize(new THREE.Vector3());
 const nestCenter=bodyBox.getCenter(new THREE.Vector3()),maggotCenter=maggotBox.getCenter(new THREE.Vector3());
 // Inscribe the wriggle envelope in the sac body, not the filament AABB.
 const fit=Math.min((bodySize.x*.62)/Math.max(maggotSize.x,1e-6),(bodySize.y*.62)/Math.max(maggotSize.y,1e-6),(bodySize.z*.62)/Math.max(maggotSize.z,1e-6));
 maggot.scale.setScalar(fit);
 maggot.position.copy(nestCenter).sub(maggotCenter.multiplyScalar(fit));
}
function intactSurfaceShader(membrane,rootStart,fadeStart){
 return shader=>{
  shader.uniforms.uIntactRootStart={value:rootStart};
  shader.uniforms.uIntactFadeStart={value:fadeStart};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vIntactLocalZ;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvIntactLocalZ=transformed.z;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vIntactLocalZ;\nuniform float uIntactRootStart;\nuniform float uIntactFadeStart;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+(membrane?'if(vIntactLocalZ>=uIntactRootStart)discard;':'if(vIntactLocalZ<uIntactRootStart)discard;'));
  if(membrane)shader.fragmentShader=shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','float rootJoin=smoothstep(uIntactFadeStart,uIntactRootStart,vIntactLocalZ);\nvec4 diffuseColor = vec4( diffuse, mix(opacity,1.,rootJoin) );');
 };
}
// The live brood's look on the museum GLB: the nests turn the shell half around and
// fatten it (EGG_GIRTH 2.35/1.85), so the pattern reads the raw shell in that frame.
const SHELL_SPACE=[-2.35,1.85,-1],SHELL_LUMP=.06;
export function infestSpecimenShell(mesh,material){
 mesh.geometry=smoothShell(mesh.geometry.clone());
 // Welding drops the atlas UVs, so the roots take the live nests' root colour.
 material.map=null;material.color?.setHex(0x4a3a2a);
 return infestShell(material,{space:SHELL_SPACE,lump:SHELL_LUMP,key:'fn-infested-shell'});
}
function makeIntactSurfaceMaterial(source,membrane,rootStart,fadeStart){
 const material=source.clone();
 if(material.emissive)material.emissive.setHex(0);
 if('emissiveIntensity' in material)material.emissiveIntensity=0;
 material.side=THREE.FrontSide;
 material.roughness=Math.max(membrane?.82:.7,material.roughness??.5);
 if('metalness' in material)material.metalness=membrane?0:Math.min(.06,material.metalness??0);
 material.transparent=membrane;
 material.opacity=membrane?.42:1;
 material.depthWrite=!membrane;
 const intact=intactSurfaceShader(membrane,rootStart,fadeStart);
 if(!membrane){
  material.onBeforeCompile=intact;
  material.customProgramCacheKey=()=>'fn-intact-opaque-roots-05474';
  return material;
 }
 // The sac wears the brood's pitted, veined skin; the larva still shows between clusters.
 material.map=null;
 infestShell(material,{space:SHELL_SPACE,lump:SHELL_LUMP,key:'fn-intact-infested-sac'});
 const infest=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{intact(shader);infest(shader);};
 return material;
}
export function assembleIntactEgg(shellSolid,maggotSolid){
 const root=new THREE.Group();root.name='Museum eggs';
 const shell=shellSolid.museumRoot(),maggot=maggotSolid.museumRoot();
 const membranes=[];
 shell.traverse(node=>{
  if(!node.isMesh)return;
  const geometry=node.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
  const box=geometry.boundingBox,span=box.max.z-box.min.z;
  // This authored shell tapers into its root crown along +Z, not across its upper half.
  const rootStart=box.min.z+span*.7,fadeStart=rootStart-span*.12;
  const sources=Array.isArray(node.material)?node.material:[node.material];
  const skin=node.clone();skin.name='Intact egg membrane';skin.geometry=smoothShell(geometry.clone());
  const dress=membrane=>sources.map(source=>makeIntactSurfaceMaterial(source,membrane,rootStart,fadeStart));
  const rootMaterials=dress(false),skinMaterials=dress(true);
  node.name='Intact egg roots';node.material=Array.isArray(node.material)?rootMaterials:rootMaterials[0];
  skin.material=Array.isArray(skin.material)?skinMaterials:skinMaterials[0];
  membranes.push([node,skin]);
 });
 for(const [node,skin] of membranes)node.parent.add(skin);
 nestMaggotInShell(shell,maggot);
 root.add(shell);root.add(maggot);
 if(maggot.userData.guideMixer){root.userData.guideMixer=maggot.userData.guideMixer;root.userData.guideClips=maggot.userData.guideClips;}
 return root;
}
let intactPending;
export function loadGuideIntactEgg(){
 if(!intactPending){
  intactPending=Promise.all([loadGuideEggPart('egg-shell'),loadGuideEggPart('egg-maggot')])
   .then(([shell,maggot])=>({spec:{id:'eggs',clips:maggot.spec.clips},museumRoot(){return assembleIntactEgg(shell,maggot);}}))
   .catch(error=>{intactPending=null;throw error;});
 }
 return intactPending;
}
