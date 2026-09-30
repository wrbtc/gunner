import * as THREE from '../../vendor/three.module.js?v=052';
import {GLTFLoader} from '../../vendor/GLTFLoader.js?v=052';

// The Satoshi's sculpted airframe (the Meshy model, cleaned in Blender): fuselage, booms,
// wings, tails, nacelles and canopy in one textured mesh. Frame: +Y up, nose to -Z, belly on
// y 0, turret mount at the origin, 22 long and 29.4 wide. The refit parts are the game's own.
export const AIRFRAME=Object.freeze({
 asset:'satoshi-airframe-001',
 sha256:'08faa1cf839ff2380c3786ae74600fcb4964124c86c102845afd28434ef0e3df',
 bytes:1471996,
 spinners:Object.freeze([[-4.804,3.068,-6.087],[4.826,3.034,-6.089]]),
 // Mid-plane of each outer wing, where the lift fans are cut in, and the tail boom ends.
 fans:Object.freeze([[-9.6,3.44,-1.12],[9.6,3.44,-1.12]]),
 nozzles:Object.freeze([[-4.8,2.3,9.1],[4.8,2.3,9.1]]),
 // Gunship fit on the left flank: [x at the skin, y, z, bore radius, barrel length] for the
 // 25 mm, 40 mm and 105 mm, and the sensor ball ahead of them.
 guns:Object.freeze([[-1.7,1.4,-7.2,.12,2.2],[-2.1,1.3,-3.4,.17,2.6],[-2.2,1.1,1.4,.26,3.2]]),
 sensor:Object.freeze([-1.9,1.0,-8.8])
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
  return {name:'AirframeImageTextures'};
 });
 return loader;
}
async function load(){
 // Proof pages open as local files, where fetch is refused, so they hand the bytes in.
 const buffer=globalThis.CH2_AIRFRAME||await fetch(new URL(`../../assets/${AIRFRAME.asset}.glb`,import.meta.url).href).then(r=>{
  if(!r.ok)throw Error('Airframe missing');return r.arrayBuffer();
 });
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength!==AIRFRAME.bytes||await hexSha256(bytes)!==AIRFRAME.sha256)throw Error('Airframe bytes do not match');
 const gltf=await makeLoader().parseAsync(buffer,'');
 const root=gltf.scene;root.name='Satoshi sculpted airframe';
 root.traverse(node=>{
  if(!node.isMesh)return;
  // Lambert like the rest of the bowl, and cheaper than the bake's PBR: the rivets and panel
  // lines stay in the normal map, the paint goes satin olive (the glossy bake mirrors the sky
  // as chrome), and a little glow keeps the belly from reading as a hole seen from the seat.
  const old=node.material;
  node.material=new THREE.MeshLambertMaterial({map:old.map,normalMap:old.normalMap,normalScale:old.normalScale,color:0xc4bf94,emissive:0x1c1a12});
  old.metalnessMap?.dispose();if(old.roughnessMap!==old.metalnessMap)old.roughnessMap?.dispose();old.dispose();
 });
 return root;
}
let pending;
export function loadAirframe(){
 if(!pending)pending=load().catch(error=>{pending=null;throw error;});
 return pending;
}
