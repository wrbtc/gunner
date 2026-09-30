import * as THREE from '../../vendor/three.module.js?v=052';
import {GLTFLoader} from '../../vendor/GLTFLoader.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';

// The gunship: a tandem attack helicopter made in Meshy from our own concept art, textures cut
// to 1024 px. The sculpt has bare hubs; the rotors are the game's own so they can spin.
// The sculpt lies along X with the nose at -X; the game turns it nose to -Z, centres it on
// its bounding box and scales it to a 15 m fuselage.
export const HELI=Object.freeze({
 asset:'ch2-heli',
 sha256:'b645d5997d1a1d63af380206adf5fa0c8732db93b9c9b652816ca66a1048091b',
 bytes:1563052,
 length:15,
 // In the sculpt's own units: the main rotor mast top, and the tail rotor hub on the fin.
 mast:Object.freeze([-.09,.298,0]),
 tailHub:Object.freeze([.87,.06,.06]),
 rotor:6.6,tailRotor:1.3
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
  return {name:'HeliImageTextures'};
 });
 return loader;
}

// Long blades with a little droop, a hub, and a faint disc that stands in for the blades once
// they spin faster than the frame rate can show. Built in metres, spinning about +Y.
function rotorSet(radius,chord,count,materials){
 const blades=mergeGeometries(Array.from({length:count},(_,i)=>
  new THREE.BoxGeometry(radius-.3,.1,chord).rotateZ(-.03).translate(radius/2+.15,0,0).rotateY(i/count*Math.PI*2)));
 const hub=new THREE.CylinderGeometry(radius*.05,radius*.06,radius*.06,12);
 const spinner=new THREE.Mesh(mergeGeometries([blades,hub]),materials.blade);
 const disc=new THREE.Mesh(new THREE.CircleGeometry(radius,48).rotateX(-Math.PI/2),materials.blur.clone());
 const set=new THREE.Group();set.add(spinner,disc);
 return {set,spinner,disc};
}

async function load(materials){
 // Proof pages open as local files, where fetch is refused, so they hand the bytes in.
 const buffer=globalThis.CH2_GLB?.[HELI.asset]||await fetch(new URL(`../../assets/${HELI.asset}.glb`,import.meta.url).href).then(r=>{
  if(!r.ok)throw Error('Helicopter missing');return r.arrayBuffer();
 });
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength!==HELI.bytes||await hexSha256(bytes)!==HELI.sha256)throw Error('Helicopter bytes do not match');
 const gltf=await makeLoader().parseAsync(buffer,'');
 const sculpt=gltf.scene;sculpt.name='Attack helicopter sculpt';
 sculpt.traverse(node=>{
  if(!node.isMesh)return;
  // Satin paint in the sun, as for the cast; the panel lines stay in the normal map.
  const old=node.material;
  node.material=new THREE.MeshLambertMaterial({map:old.map,normalMap:old.normalMap,color:0xffffff,side:THREE.DoubleSide});
  old.metalnessMap?.dispose();if(old.roughnessMap!==old.metalnessMap)old.roughnessMap?.dispose();old.dispose();
 });
 sculpt.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(sculpt),centre=box.getCenter(new THREE.Vector3());
 const scale=HELI.length/(box.max.x-box.min.x),up=new THREE.Vector3(0,1,0);
 // Sculpt units to the craft's frame: centred, scaled, nose turned from -X to -Z.
 const place=p=>new THREE.Vector3(...p).sub(centre).multiplyScalar(scale).applyAxisAngle(up,-Math.PI/2);
 const body=new THREE.Group();body.rotation.y=-Math.PI/2;body.scale.setScalar(scale);
 sculpt.position.copy(centre).negate();body.add(sculpt);
 const holder=new THREE.Group();holder.name='Attack helicopter';holder.add(body);
 const main=rotorSet(HELI.rotor,.62,4,materials);main.set.position.copy(place(HELI.mast));
 // The tail rotor turns on the fin's side, its disc upright and facing across the boom.
 const tail=rotorSet(HELI.tailRotor,.26,4,materials);tail.set.position.copy(place(HELI.tailHub));tail.set.rotation.z=Math.PI/2;
 holder.add(main.set,tail.set);
 return {holder,main,tail};
}
let pending;
export function loadHeli(materials){
 if(!pending)pending=load(materials).catch(error=>{pending=null;throw error;});
 return pending;
}
