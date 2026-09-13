import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';

// Field Guide museum solids only. Combat / world meshes stay on the live
// procedural and lava-loco paths until a later PASS of these 3D views.
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
  asset:'rimmer-skinned-solid',
  sha256:'1cc99c3e0c0c0a4116f11bf82b1550b212c6cac1b0582edcff1950f7e115b456',
  bytes:1153368
 }),
 plasma:Object.freeze({
  id:'plasma',
  asset:'plasma-bug-skinned-solid',
  sha256:'127e6fdc95d775413b4831544a780118033559abc4b8f8a1e357ab25108fc67f',
  bytes:1135104
 }),
 creepers:Object.freeze({
  id:'creepers',
  asset:'creeper-ember-hollow',
  sha256:'25a1be82fe3b2ec6784547682e78fe4f64e619df9d91c7e8d8cd128bf7ffdebe',
  bytes:1091768,
  armature:'EmberArmature',
  clips:Object.freeze({idle:'ember_idle',walk:'ember_walk'})
 })
});

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
function cloneSkinnedGuide(source){
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
   node.skeleton.bones.map(bone=>bySource.get(bone)),
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
async function loadOne(spec){
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
 scene.updateMatrixWorld(true);
 let skinned=0;
 scene.traverse(node=>{if(node.isSkinnedMesh)skinned++;});
 if(!skinned)throw Error('Field-guide solid skinned mesh missing: '+spec.asset);
 if(spec.armature&&!namedNode(scene,spec.armature))throw Error('Field-guide solid armature missing: '+spec.armature);
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
   const root=cloneSkinnedGuide(scene);
   root.name='Museum '+spec.id;
   root.visible=true;
   root.position.set(0,0,0);
   root.rotation.set(0,0,0);
   root.scale.setScalar(1);
   // Museum idle only. Do not start combat mixers or mutate live actors.
   if(spec.clips?.idle){
    const clip=animations.find(item=>item.name===spec.clips.idle);
    const mixer=new THREE.AnimationMixer(root);
    mixer.clipAction(clip).reset().play();
    root.userData.guideMixer=mixer;
   }
   return root;
  }
 };
}

export function loadSkinnedSolids(){
 if(!pending){
  pending=Promise.all(Object.values(SKINNED_SOLIDS).map(spec=>loadOne(spec).then(value=>[spec.id,value],()=>[spec.id,null])))
   .then(entries=>{
    const kit=Object.fromEntries(entries);
    if(!kit.rimmers&&!kit.plasma&&!kit.creepers)throw Error('No field-guide skinned solids');
    return kit;
   })
   .catch(error=>{pending=null;throw error;});
 }
 return pending;
}
