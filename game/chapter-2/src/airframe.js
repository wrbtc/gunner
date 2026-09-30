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
 guns:Object.freeze([[-1.6,1.5,-7.2,.1,1.1],[-2.0,1.4,-3.4,.14,1.4],[-1.9,1.2,1.4,.22,1.8]]),
 sensor:Object.freeze([-1.45,1.15,-8.6])
});

// The sculpt still carries the mount ring left where its fused turret was cut off (about
// 4,900 triangles hanging under the belly). The gunship has no belly turret, so the ring goes
// and a smooth panel in the belly's own paint closes the opening it leaves.
const RING=Object.freeze({x:1.75,zMin:-4.2,zMax:.3,y:.78});
function dropMountRing(geometry){
 const pos=geometry.getAttribute('position'),index=geometry.getIndex(),keep=[];
 const ring=i=>Math.abs(pos.getX(i))<RING.x&&pos.getZ(i)>RING.zMin&&pos.getZ(i)<RING.zMax&&pos.getY(i)<RING.y;
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
  if(!ring(a)&&!ring(b)&&!ring(c))keep.push(a,b,c);
 }
 geometry.setIndex(keep);
}
function bellyPanel(){
 // The lower half of a flattened ellipsoid: its keel sits at the ring's old seam and its
 // sides meet the fuselage at about 1.7. Colour: the texture's mean belly paint, tinted.
 const geometry=new THREE.SphereGeometry(1,28,10,0,Math.PI*2,Math.PI/2,Math.PI/2).scale(RING.x,.95,2.35).translate(0,1.7,-1.95);
 const panel=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:0x353423,emissive:0x1c1a12}));
 panel.name='Belly panel over the old turret ring';return panel;
}

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
 const meshes=[];root.traverse(node=>{if(node.isMesh)meshes.push(node);});
 meshes.forEach(node=>{
  dropMountRing(node.geometry);
  // Lambert like the rest of the bowl, and cheaper than the bake's PBR: the rivets and panel
  // lines stay in the normal map, the paint goes satin olive (the glossy bake mirrors the sky
  // as chrome), and a little glow keeps the belly from reading as a hole seen from the seat.
  const old=node.material;
  node.material=new THREE.MeshLambertMaterial({map:old.map,normalMap:old.normalMap,normalScale:old.normalScale,color:0xc4bf94,emissive:0x1c1a12});
  old.metalnessMap?.dispose();if(old.roughnessMap!==old.metalnessMap)old.roughnessMap?.dispose();old.dispose();
 });
 root.add(bellyPanel());
 return root;
}
let pending;
export function loadAirframe(){
 if(!pending)pending=load().catch(error=>{pending=null;throw error;});
 return pending;
}
