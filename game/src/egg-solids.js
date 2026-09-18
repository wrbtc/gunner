import * as THREE from '../vendor/three.module.js?v=052';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';

// Live nest meshes use the accepted rigid shell and the bind geometry from the
// accepted rigged larva. Field Notes owns clip playback; live nests retain the
// established lightweight instancing and rupture path.
export const EGG_SOLIDS=Object.freeze({
 shell:Object.freeze({
  id:'shell',
  asset:'egg-shell-a',
  sha256:'368d9e85c7a710b2edc02d2d5b212d590e4910e2b9cfec50d313a2b6ac85acc2',
  bytes:817236
 }),
 maggot:Object.freeze({
  id:'maggot',
  asset:'field-notes-v02/egg-maggot-fieldnotes-v02',
  sha256:'344d213134c8fbea68ee9e2f0b24c3031a7bf30c1aee5cde7ee4ca38317bae96',
  bytes:1075680
 })
});

let pending;

function hexSha256(bytes){
 return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
}
function isLfsPointer(bytes){
 return new TextDecoder().decode(bytes.subarray(0,80)).includes('git-lfs.github.com');
}
function firstMaterial(scene){
 let material=null;
 scene.traverse(node=>{if(!material&&node.isMesh)material=Array.isArray(node.material)?node.material[0]:node.material;});
 return material;
}
function collectGeometry(scene){
 const parts=[];
 scene.updateMatrixWorld(true);
 scene.traverse(node=>{
  if(!node.isMesh||!node.geometry)return;
  const geo=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
  geo.applyMatrix4(node.matrixWorld);
  parts.push(geo);
 });
 if(!parts.length)throw Error('Egg solid mesh missing');
 const merged=parts.length===1?parts[0]:mergeGeometries(parts,false);
 if(!merged)throw Error('Egg solid merge failed');
 return merged;
}
function normalizeGeometry(geo,target){
 geo.computeBoundingBox();
 const box=geo.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 geo.translate(-center.x,-center.y,-center.z);
 const max=Math.max(size.x,size.y,size.z)||1;
 const scale=target/max;
 geo.scale(scale,scale,scale);
 geo.computeBoundingSphere();
 geo.computeVertexNormals();
 return geo;
}
export function adaptEggShellMaterial(source){
 const material=source.clone();
 if(material.emissive)material.emissive.setHex(0);
 if('emissiveIntensity' in material)material.emissiveIntensity=0;
 material.side=THREE.FrontSide;
 material.roughness=Math.max(.48,material.roughness??.5);
 if('metalness' in material)material.metalness=Math.min(.08,material.metalness??0);
 // Opaque bakes hide the inner maggot. Keep a leathery window only.
 if(!material.transparent||material.opacity>=.88){
  material.transparent=true;
  material.opacity=.46;
 }
 material.depthWrite=false;
 return material;
}
function makeLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'EggSolidImageTextures'};
 });
 return loader;
}
async function loadOne(spec){
 const url=new URL(`../assets/${spec.asset}.glb`,import.meta.url).href;
 const response=await fetch(url);
 if(!response.ok)throw Error('Egg solid missing: '+spec.asset);
 const buffer=await response.arrayBuffer();
 const bytes=new Uint8Array(buffer);
 if(isLfsPointer(bytes))throw Error('Egg solid is an LFS pointer: '+spec.asset);
 const sha256=await hexSha256(bytes);
 if(sha256!==spec.sha256)throw Error('Egg solid hash mismatch: '+spec.asset);
 if(bytes.byteLength!==spec.bytes)throw Error('Egg solid size mismatch: '+spec.asset);
 const gltf=await makeLoader().parseAsync(buffer,'');
 const scene=gltf.scene;
 scene.updateMatrixWorld(true);
 const geometry=normalizeGeometry(collectGeometry(scene),spec.id==='shell'?2:1.65);
 const sourceMaterial=firstMaterial(scene);
 if(!sourceMaterial)throw Error('Egg solid material missing: '+spec.asset);
 const material=spec.id==='shell'?adaptEggShellMaterial(sourceMaterial):sourceMaterial.clone();
 if(spec.id!=='shell'){
  material.emissive?.setHex?.(0);
  if('emissiveIntensity' in material)material.emissiveIntensity=0;
 }
 return {spec,geometry,material};
}

export function loadEggSolids(){
 if(!pending){
  pending=Promise.all([loadOne(EGG_SOLIDS.shell),loadOne(EGG_SOLIDS.maggot)])
   .then(([shell,maggot])=>({shell,maggot}))
   .catch(error=>{pending=null;throw error;});
 }
 return pending;
}
