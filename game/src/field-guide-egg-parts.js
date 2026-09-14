import * as THREE from '../vendor/three.module.js?v=052';
import {loadGuideSolid} from './skinned-solids.js?v=054-70';
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
function intactVec3(value){
 return value&&value.isVector3?value.clone():new THREE.Vector3(value?.x||0,value?.y||0,value?.z||0);
}
function intactMembraneShader(shader){
 const center=intactVec3(this.userData.intactMaggotCenter);
 const radii=intactVec3(this.userData.intactMaggotRadii);
 const tuft=Number.isFinite(this.userData.intactTuftStartZ)?this.userData.intactTuftStartZ:1e6;
 shader.uniforms.uIntactMaggotCenter={value:center};
 shader.uniforms.uIntactMaggotRadii={value:radii};
 shader.uniforms.uIntactTuftStartZ={value:tuft};
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vIntactLocalPos;varying vec3 vIntactLocalCam;');
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvIntactLocalPos=transformed;\nvIntactLocalCam=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vIntactLocalPos;varying vec3 vIntactLocalCam;
uniform vec3 uIntactMaggotCenter;uniform vec3 uIntactMaggotRadii;uniform float uIntactTuftStartZ;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a=1.;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float intactTuft=step(uIntactTuftStartZ,vIntactLocalPos.z);
float intactNdv=abs(dot(normalize(normal),normalize(vViewPosition)));
float intactThin=pow(clamp(intactNdv,0.,1.),1.45)*(1.-intactTuft);
vec3 intactInvR=1./max(uIntactMaggotRadii,vec3(1e-4));
vec3 intactRay=normalize(vIntactLocalPos-vIntactLocalCam);
float intactShellT=length(vIntactLocalPos-vIntactLocalCam);
vec3 intactToMaggot=(uIntactMaggotCenter-vIntactLocalCam)*intactInvR;
vec3 intactD=intactRay*intactInvR;
float intactTClose=dot(intactToMaggot,intactD)/max(dot(intactD,intactD),1e-6);
vec3 intactClosest=(vIntactLocalCam+intactRay*intactTClose-uIntactMaggotCenter)*intactInvR;
float intactOcc=1.-smoothstep(.12,1.05,length(intactClosest));
intactOcc*=(1.-intactTuft)*step(intactShellT,intactTClose);
outgoingLight*=mix(vec3(1.),vec3(.74,.61,.48),intactThin*.26);
outgoingLight*=mix(1.,.36,intactOcc*mix(.52,1.,intactThin));
diffuseColor.a=1.;
#include <opaque_fragment>`);
}
function dressIntactLeather(source){
 const leather=source.clone();
 if(leather.emissive)leather.emissive.setHex(0);
 if('emissiveIntensity' in leather)leather.emissiveIntensity=0;
 leather.side=THREE.FrontSide;
 leather.roughness=Math.max(.7,leather.roughness??.5);
 if('metalness' in leather)leather.metalness=Math.min(.06,leather.metalness??0);
 leather.transparent=false;
 leather.opacity=1;
 leather.depthWrite=true;
 leather.depthTest=true;
 leather.alphaTest=0;
 leather.alphaMap=null;
 if('alphaHash' in leather)leather.alphaHash=false;
 if('transmission' in leather)leather.transmission=0;
 if('thickness' in leather)leather.thickness=.04;
 leather.premultipliedAlpha=false;
 leather.blending=THREE.NormalBlending;
 leather.onBeforeCompile=intactMembraneShader;
 leather.customProgramCacheKey=()=> 'fn-intact-opaque-membrane-05470';
 return leather;
}
function bindIntactMaggotShadow(shell,maggot){
 shell.updateMatrixWorld(true);maggot.updateMatrixWorld(true);
 const shellBox=new THREE.Box3().setFromObject(shell),bodyBox=sacBodyBox(shellBox);
 const maggotBox=new THREE.Box3().setFromObject(maggot);
 const worldCenter=maggotBox.getCenter(new THREE.Vector3());
 const worldRadii=maggotBox.getSize(new THREE.Vector3()).multiplyScalar(.52);
 const hasTuft=Math.abs(bodyBox.max.z-shellBox.max.z)>1e-4||Math.abs(bodyBox.min.z-shellBox.min.z)>1e-4;
 const tuftWorld=new THREE.Vector3().copy(bodyBox.getCenter(new THREE.Vector3()));
 tuftWorld.z=bodyBox.max.z;
 shell.traverse(node=>{
  if(!node.isMesh)return;
  node.updateMatrixWorld(true);
  const inv=node.matrixWorld.clone().invert();
  const scale=new THREE.Vector3();
  node.matrixWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);
  const localCenter=worldCenter.clone().applyMatrix4(inv);
  const localRadii=new THREE.Vector3(
   worldRadii.x/Math.max(Math.abs(scale.x),1e-6),
   worldRadii.y/Math.max(Math.abs(scale.y),1e-6),
   worldRadii.z/Math.max(Math.abs(scale.z),1e-6)
  );
  const tuftStartZ=hasTuft?tuftWorld.clone().applyMatrix4(inv).z:1e6;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const material of materials){
   material.userData.intactMaggotCenter=localCenter;
   material.userData.intactMaggotRadii=localRadii;
   material.userData.intactTuftStartZ=tuftStartZ;
  }
 });
}
export function assembleIntactEgg(shellSolid,maggotSolid){
 const root=new THREE.Group();root.name='Museum eggs';
 const shell=shellSolid.museumRoot(),maggot=maggotSolid.museumRoot();
 shell.traverse(node=>{
  if(!node.isMesh)return;
  const leather=Array.isArray(node.material)?node.material.map(dressIntactLeather):[dressIntactLeather(node.material)];
  node.material=Array.isArray(node.material)?leather:leather[0];
 });
 nestMaggotInShell(shell,maggot);
 bindIntactMaggotShadow(shell,maggot);
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
