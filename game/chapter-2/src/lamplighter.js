import * as THREE from '../../vendor/three.module.js?v=052';
import {GLTFLoader} from '../../vendor/GLTFLoader.js?v=052';

// Lamplighters wear the Field Guide's vein ascetic: a thin humanoid, 1.9 m in the file, with a
// ritual idle and walk. At 6.5 m it reads as a tall, wrong figure on the ledges, and its head
// carries the lamp that flashes before each bolt.
export const LAMPLIGHTER_SOLID=Object.freeze({
 asset:'vein-ascetic-skinned',
 sha256:'9d67a8c5fcdc4a5d8bbbdbae9f428e87a963a978682c0e572f62af28567e495e',
 bytes:1908316,
 height:1.9017,
 clips:Object.freeze({idle:'ritual_idle',walk:'ritual_walk'})
});

function hexSha256(bytes){
 return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
}
function makeLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'LamplighterImageTextures'};
 });
 return loader;
}
// Each figure needs its own skeleton, bound to its own copy of the bones.
function cloneSkinned(source){
 const root=source.clone(true),bySource=new Map();
 const pair=(a,b)=>{bySource.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);};
 pair(source,root);
 source.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  const mesh=bySource.get(node);
  mesh.skeleton=new THREE.Skeleton(node.skeleton.bones.map(bone=>bySource.get(bone)),node.skeleton.boneInverses.map(inverse=>inverse.clone()));
  mesh.bindMatrix.copy(node.bindMatrix);mesh.bindMatrixInverse.copy(node.bindMatrixInverse);
  mesh.material=node.material;mesh.frustumCulled=false;
 });
 return root;
}
async function load(){
 const spec=LAMPLIGHTER_SOLID;
 // Proof pages open as local files, where fetch is refused, so they hand the bytes in.
 const buffer=globalThis.CH2_GLB?.[spec.asset]||await fetch(new URL(`../../assets/${spec.asset}.glb`,import.meta.url).href).then(r=>{
  if(!r.ok)throw Error('Lamplighter model missing');return r.arrayBuffer();
 });
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength!==spec.bytes||await hexSha256(bytes)!==spec.sha256)throw Error('Lamplighter bytes do not match');
 const gltf=await makeLoader().parseAsync(buffer,'');
 const clip=name=>gltf.animations.find(c=>c.name===name)||gltf.animations[0];
 const clips={idle:clip(spec.clips.idle),walk:clip(spec.clips.walk)};
 gltf.scene.traverse(node=>{if(node.isMesh)node.material.side=THREE.FrontSide;});
 return {
  make(parent){
   const visual=cloneSkinned(gltf.scene);parent.add(visual);
   let head=null;visual.traverse(node=>{if(node.isBone&&node.name==='head')head=node;});
   const mixer=new THREE.AnimationMixer(visual),actions={idle:mixer.clipAction(clips.idle),walk:mixer.clipAction(clips.walk)};
   let current=null;
   return {
    play(kind,dt=0,timeScale=1){
     const action=actions[kind]||actions.idle;
     if(current!==kind){if(current)actions[current].fadeOut(.25);action.reset().fadeIn(.25).play();current=kind;}
     action.setEffectiveTimeScale(timeScale);if(dt>0)mixer.update(dt);
    },
    headWorld(out){if(!head)return null;head.getWorldPosition(out);return out;}
   };
  }
 };
}
let pending;
export function loadLamplighters(){
 if(!pending)pending=load().catch(error=>{pending=null;throw error;});
 return pending;
}
