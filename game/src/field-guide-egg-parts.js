import * as THREE from '../vendor/three.module.js?v=052';
import {loadGuideSolid} from './skinned-solids.js?v=054-68';
import {adaptEggShellMaterial} from './egg-solids.js?v=054-68';
// Independent specimen views only; the live nest and its source assets are untouched.
const SPECS={
 'egg-maggot':{id:'egg-maggot',asset:'field-notes-v02/egg-maggot-fieldnotes-v02',sha256:'344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96',bytes:1075680,armature:'MaggotArmature',clips:{idle:'maggot_wriggle'}},
 'egg-shell':{id:'egg-shell',asset:'egg-shell-a',sha256:'368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2',bytes:817236,static:true}
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
function intactLocalYShader(kind,baseTop,windowStart){
 return function(shader){
  shader.uniforms.uIntactBaseTop={value:baseTop};
  shader.uniforms.uIntactWindowStart={value:windowStart};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vIntactLocalY;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvIntactLocalY=transformed.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vIntactLocalY;\nuniform float uIntactBaseTop;\nuniform float uIntactWindowStart;');
  if(kind==='base'){
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vIntactLocalY>uIntactWindowStart)discard;');
  }else{
   shader.fragmentShader=shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','float intactLift=smoothstep(uIntactBaseTop,uIntactWindowStart,vIntactLocalY);\nvec4 diffuseColor = vec4( diffuse, mix(1.,opacity,intactLift) );');
  }
 };
}
function leatherBand(geometry){
 if(!geometry.boundingBox)geometry.computeBoundingBox();
 const box=geometry.boundingBox,span=Math.max(box.max.y-box.min.y,1e-6);
 return {baseTop:box.min.y+span*.42,windowStart:box.min.y+span*.58};
}
function dressIntactLeather(source,band){
 const leather=adaptEggShellMaterial(source);
 // Keep the shared leathery window. Do not force-cap the whole sac to glass.
 leather.roughness=Math.max(.66,leather.roughness??.5);
 leather.onBeforeCompile=intactLocalYShader('window',band.baseTop,band.windowStart);
 leather.customProgramCacheKey=()=> 'fn-intact-leather-window-05468';
 return leather;
}
function makeIntactBaseMaterial(source,band){
 const base=source.clone();
 if(base.emissive)base.emissive.setHex(0);
 if('emissiveIntensity' in base)base.emissiveIntensity=0;
 base.side=THREE.FrontSide;
 base.roughness=Math.max(.7,base.roughness??.5);
 if('metalness' in base)base.metalness=Math.min(.06,base.metalness??0);
 base.transparent=false;
 base.opacity=1;
 base.depthWrite=true;
 base.onBeforeCompile=intactLocalYShader('base',band.baseTop,band.windowStart);
 base.customProgramCacheKey=()=> 'fn-intact-opaque-base-05468';
 return base;
}
export function assembleIntactEgg(shellSolid,maggotSolid){
 const root=new THREE.Group();root.name='Museum eggs';
 const shell=shellSolid.museumRoot(),maggot=maggotSolid.museumRoot();
 const bases=[];
 shell.traverse(node=>{
  if(!node.isMesh)return;
  const sources=Array.isArray(node.material)?node.material:[node.material];
  const band=leatherBand(node.geometry);
  const leather=sources.map(material=>dressIntactLeather(material,band));
  node.material=Array.isArray(node.material)?leather:leather[0];
  node.renderOrder=2;
  const floor=node.clone();
  floor.name='Intact egg base';
  floor.material=Array.isArray(node.material)?sources.map(material=>makeIntactBaseMaterial(material,band)):makeIntactBaseMaterial(sources[0],band);
  floor.renderOrder=1;
  bases.push([node,floor]);
 });
 for(const [node,floor] of bases)node.parent.add(floor);
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
