import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

// Field Guide solids; the approved Meshy Rimmer is also independently cloned
// for gameplay. Other species retain their existing combat/world paths.
export const FORBIDDEN_MORPH_PREFIXES=Object.freeze([
 '75ddc18f','a2ac5ebb','1c10edf7','45123f4c','9cd194e6','a9dcb2b6'
]);
export const REJECTED_EMBER_SOLID=Object.freeze({
 sha256:'085943e9185cc17ad314d26d900a7a970a54aeb8ecba76b495743baf1fa2c46f',
 bytes:4803580
});
export const SKINNED_SOLIDS=Object.freeze({
 rimmers:Object.freeze({
  id:'rimmers',
  asset:'rimmer-meshy-v2-rigged',
  sha256:'e39e0226358fad716a20d9ac744c47fe8b7f00cfe958e07fc510ecbe24c97927',
  bytes:18054908,
  clips:Object.freeze({idle:'rimmer_idle',walk:'rimmer_walk',warning:'rimmer_warning'}),
  bones:Object.freeze(['rimmer_body','rimmer_head','rimmer_mouth','front_L_upper','hind_R_foot'])
 }),
 plasma:Object.freeze({
  id:'plasma',
  asset:'plasma-bug-skinned-solid',
  sha256:'127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f',
  bytes:1135104,
  clips:Object.freeze({idle:'plasma_idle',walk:'plasma_crawl'})
 }),
 creepers:Object.freeze({
  id:'creepers',
  asset:'creeper-ember-hollow',
  sha256:'25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe',
  bytes:1091768,
  armature:'EmberArmature',
  clips:Object.freeze({idle:'ember_idle',walk:'ember_walk'})
 }),
 dragons:Object.freeze({
  id:'dragons',
  asset:'dragon-fg-a',
  sha256:'38fdb98e6c774ced70feb26041d3d142db292c1a45b160132bc4d0c356b28a27',
  bytes:64020728,
  static:true
 }),
 tanks:Object.freeze({
  id:'tanks',
  asset:'field-notes-v02/cinder-maw-fieldnotes-v02',
  sha256:'2a829abf1fbb8419c8f0081ecedeeeddc7a3d6adc922f6a21108148ba4f53c52',
  bytes:1483396,
  armature:'TankArmature',
  clips:Object.freeze({idle:'cinder_idle',jaw:'cinder_jaw_inspect',shift:'cinder_weight_shift'}),
  bones:Object.freeze(['body','jaw','cinder_mouth'])
 }),
 dancers:Object.freeze({
  id:'dancers',
  asset:'field-notes-v02/ember-priest-v01',
  sha256:'644687ad31207e5031baf1094fb795698c14624ad02374d2a61af2c451bcf6ea',
  bytes:8339884,
  armature:'EmberPriestArmature',
  clips:Object.freeze({idle:'priest_idle',walk:'priest_walk',run:'priest_run',dance:'priest_dance',throw:'priest_throw'}),
  bones:Object.freeze(['Hips','RightHand','LeftHand','RightFoot','LeftFoot'])
 })
});
const BOOT_SOLIDS=Object.freeze(['rimmers','plasma','creepers','tanks','dancers']);

let pending;

function hexSha256(bytes){
 return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
}
function isLfsPointer(bytes){
 return new TextDecoder().decode(bytes.subarray(0,80)).includes('git-lfs.github.com');
}
function namedNode(root,name){
 let found=null;
 root.traverse(node=>{if(!found&&node.name===name)found=node;});
 return found;
}
export function cloneSkinnedGuide(source){
 const root=source.clone(true);
 const bySource=new Map();
 function pair(a,b){
  bySource.set(a,b);
  for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);
 }
 pair(source,root);
 source.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  const mesh=bySource.get(node);
  mesh.skeleton=new THREE.Skeleton(
   node.skeleton.bones.map(bone=>{const copy=bySource.get(bone);if(!copy)throw Error('Field-guide skeleton escapes cloned root');return copy;}),
   node.skeleton.boneInverses.map(inverse=>inverse.clone())
  );
  mesh.bindMatrix.copy(node.bindMatrix);
  mesh.bindMatrixInverse.copy(node.bindMatrixInverse);
  mesh.frustumCulled=false;
 });
 return root;
}
function makeLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'GuideSolidImageTextures'};
 });
 return loader;
}
export async function loadGuideSolid(spec){
 const url=new URL(`../assets/${spec.asset}.glb`,import.meta.url).href;
 const response=await fetch(url);
 if(!response.ok)throw Error('Field-guide solid missing: '+spec.asset);
 const buffer=await response.arrayBuffer();
 const bytes=new Uint8Array(buffer);
 if(isLfsPointer(bytes))throw Error('Field-guide solid is an LFS pointer: '+spec.asset);
 const sha256=await hexSha256(bytes);
 if(FORBIDDEN_MORPH_PREFIXES.some(prefix=>sha256.startsWith(prefix)))throw Error('Forbidden morph creeper hash');
 if(spec.id==='creepers'&&(sha256===REJECTED_EMBER_SOLID.sha256||bytes.byteLength===REJECTED_EMBER_SOLID.bytes)){
  throw Error('Rejected SOLID Ember Hollow pack');
 }
 if(sha256!==spec.sha256)throw Error('Field-guide solid hash mismatch: '+spec.asset);
 if(bytes.byteLength!==spec.bytes)throw Error('Field-guide solid size mismatch: '+spec.asset);
 const gltf=await makeLoader().parseAsync(buffer,'');
 const scene=gltf.scene;
 scene.name='Guide_solid_'+spec.id;
 scene.traverse(node=>{if(!node.isMesh)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){
  const index=gltf.parser.associations.get(material)?.materials,definition=gltf.parser.json.materials?.[index]||{},pbr=definition.pbrMetallicRoughness||{};
  for(const [key,required] of [['map',pbr.baseColorTexture],['normalMap',definition.normalTexture],['emissiveMap',definition.emissiveTexture],['roughnessMap',pbr.metallicRoughnessTexture],['metalnessMap',pbr.metallicRoughnessTexture]]){
   if(required&&(!material[key]||!material[key].image))throw Error('Field-guide texture did not decode: '+spec.asset+' '+key);
  }
 }});
 scene.updateMatrixWorld(true);
 let skinned=0,meshes=0;
 scene.traverse(node=>{if(node.isMesh)meshes++;if(node.isSkinnedMesh)skinned++;});
 if(!meshes)throw Error('Field-guide solid mesh missing: '+spec.asset);
 if(!spec.static&&!skinned)throw Error('Field-guide solid skinned mesh missing: '+spec.asset);
 if(spec.armature&&!namedNode(scene,spec.armature))throw Error('Field-guide solid armature missing: '+spec.armature);
 if(spec.bones){
  for(const name of spec.bones){
   if(!namedNode(scene,name))throw Error('Field-guide solid bone missing: '+name);
  }
 }
 const animations=gltf.animations||[];
 if(spec.clips){
  const names=new Set(animations.map(clip=>clip.name));
  for(const name of Object.values(spec.clips)){
   if(!names.has(name))throw Error('Field-guide solid clip missing: '+name);
  }
 }
 return {
  spec,
  scene,
  animations,
  museumRoot(){
   const root=skinned?cloneSkinnedGuide(scene):scene.clone(true);
   root.name='Museum '+spec.id;
   root.visible=true;
   root.position.set(0,0,0);
   root.rotation.set(0,0,0);
   root.scale.setScalar(1);
   if(spec.static)root.userData.shareGuideGeometry=true;
   // Museum idle only. Do not start combat mixers or mutate live actors.
   if(!spec.static&&spec.clips?.idle){
    const clip=animations.find(item=>item.name===spec.clips.idle);
    const mixer=new THREE.AnimationMixer(root);
    mixer.clipAction(clip).reset().play();
    mixer.update(0);
    root.userData.guideMixer=mixer;
    root.userData.guideClips=animations;
   }
   return root;
  }
 };
}

export function loadSkinnedSolids(){
 if(!pending){
  pending=Promise.all(BOOT_SOLIDS.map(id=>loadGuideSolid(SKINNED_SOLIDS[id]).then(value=>[id,value],()=>[id,null])))
   .then(entries=>{
    const kit=Object.fromEntries(entries);
    if(!kit.rimmers&&!kit.plasma&&!kit.creepers&&!kit.tanks&&!kit.dancers)throw Error('No field-guide skinned solids');
    return kit;
   })
   .catch(error=>{pending=null;throw error;});
 }
 return pending;
}

let dragonPending;
export function loadGuideDragonSolid(){
 if(!dragonPending){
  dragonPending=loadGuideSolid(SKINNED_SOLIDS.dragons).catch(()=>{dragonPending=null;return null;});
 }
 return dragonPending;
}
