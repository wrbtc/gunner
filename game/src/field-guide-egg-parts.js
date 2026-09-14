import * as THREE from '../vendor/three.module.js?v=052';
import {loadGuideSolid} from './skinned-solids.js?v=054-67';
import {adaptEggShellMaterial} from './egg-solids.js?v=054-67';
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
function nestMaggotInShell(shell,maggot){
 // Maggot longest axis is +X; the shell sac and filaments are longest on +Z.
 maggot.rotation.y=Math.PI/2;
 shell.updateMatrixWorld(true);maggot.updateMatrixWorld(true);
 const shellBox=new THREE.Box3().setFromObject(shell),maggotBox=new THREE.Box3().setFromObject(maggot);
 const shellSize=shellBox.getSize(new THREE.Vector3()),maggotSize=maggotBox.getSize(new THREE.Vector3());
 const shellCenter=shellBox.getCenter(new THREE.Vector3()),maggotCenter=maggotBox.getCenter(new THREE.Vector3());
 // Keep the larva inside the sac, not the filament span.
 const bodyZ=Math.min(shellSize.z,Math.max(shellSize.x,shellSize.y)*1.25);
 const fit=Math.min((shellSize.x*.88)/Math.max(maggotSize.x,1e-6),(shellSize.y*.88)/Math.max(maggotSize.y,1e-6),(bodyZ*.88)/Math.max(maggotSize.z,1e-6));
 maggot.scale.setScalar(fit);
 maggot.position.copy(shellCenter).sub(maggotCenter.multiplyScalar(fit));
}
export function assembleIntactEgg(shellSolid,maggotSolid){
 const root=new THREE.Group();root.name='Museum eggs';
 const shell=shellSolid.museumRoot(),maggot=maggotSolid.museumRoot();
 shell.traverse(node=>{
  if(!node.isMesh)return;
  const leather=Array.isArray(node.material)?node.material.map(adaptEggShellMaterial):[adaptEggShellMaterial(node.material)];
  for(const material of leather)material.opacity=Math.min(material.opacity,.32);
  node.material=Array.isArray(node.material)?leather:leather[0];
  node.renderOrder=2;
 });
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
