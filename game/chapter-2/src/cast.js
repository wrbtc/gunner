import * as THREE from '../../vendor/three.module.js?v=052';
import {GLTFLoader} from '../../vendor/GLTFLoader.js?v=052';

// The downtown cast, made in Meshy from our own concept art, rigged and animated there from its
// motion library, with the textures cut to 512 px for the web. Each file carries one mesh, its
// skin and its clips; the clips are found by what they are (run, walk, throw...) not by number.
export const CAST=Object.freeze({
 runner:{asset:'ch2-runner',height:1.8},
 leaper:{asset:'ch2-leaper',height:2.1},
 bloater:{asset:'ch2-bloater',height:2.0},
 brute:{asset:'ch2-brute',height:4.2},
 survivor:{asset:'ch2-survivor',height:1.8}
});
const KINDS=[
 ['leap',/leap/i],['slam',/slam/i],['shoot',/shoot/i],['scream',/scream/i],['throw',/throw/i],
 ['attack',/punch|attack/i],['die',/fall|dying|dead/i],['run',/run/i],['walk',/walk/i],['idle',/idle|crouch|look/i]
];
// These play once and hold their last frame; the rest loop.
const ONCE=new Set(['leap','slam','scream','throw','die']);

function makeLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'CastImageTextures'};
 });
 return loader;
}
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
async function load(name){
 const spec=CAST[name];
 // Proof pages open as local files, where fetch is refused, so they hand the bytes in.
 const buffer=globalThis.CH2_GLB?.[spec.asset]||await fetch(new URL(`../../assets/${spec.asset}.glb`,import.meta.url).href).then(r=>{
  if(!r.ok)throw Error('Cast model missing: '+spec.asset);return r.arrayBuffer();
 });
 const gltf=await makeLoader().parseAsync(buffer,'');
 const clips={};
 for(const clip of gltf.animations){const kind=KINDS.find(([,re])=>re.test(clip.name))?.[0];if(kind&&!clips[kind])clips[kind]=clip;}
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;
  // Satin paint rather than the bake's gloss, which reads as wet plastic in the sun.
  const old=node.material;node.material=new THREE.MeshLambertMaterial({map:old.map,color:0xffffff});old.dispose();
 });
 // Stand every figure on its feet at its real height, facing +Z as Meshy rigs it.
 gltf.scene.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(gltf.scene),scale=spec.height/Math.max(.01,box.max.y-box.min.y);
 return {
  name,height:spec.height,clips,
  make(parent){
   const holder=new THREE.Group(),visual=cloneSkinned(gltf.scene);
   visual.scale.setScalar(scale);visual.position.y=-box.min.y*scale;holder.add(visual);parent.add(holder);
   const mixer=new THREE.AnimationMixer(visual),actions={};
   let current=null,hand=null;
   visual.traverse(node=>{if(node.isBone&&/righthand/i.test(node.name))hand=node;});
   return {
    root:holder,
    has:kind=>!!clips[kind],
    play(kind,dt=0,timeScale=1){
     if(!clips[kind])kind=clips.run?'run':Object.keys(clips)[0];
     let action=actions[kind];
     if(!action){
      action=actions[kind]=mixer.clipAction(clips[kind]);
      if(ONCE.has(kind)){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}
     }
     if(current!==kind){if(current)actions[current].fadeOut(.2);action.reset().fadeIn(.2).play();current=kind;}
     action.setEffectiveTimeScale(timeScale);if(dt>0)mixer.update(dt);
    },
    handWorld(out){if(!hand)return null;hand.getWorldPosition(out);return out;}
   };
  }
 };
}
const pending={};
export function loadCast(name){
 if(!pending[name])pending[name]=load(name).catch(error=>{delete pending[name];throw error;});
 return pending[name];
}
