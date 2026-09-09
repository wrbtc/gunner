import * as THREE from '../vendor/three.module.js?v=052';
import { GLTFLoader } from '../vendor/GLTFLoader.js?v=052';

// Original CC0 scan by Dario Barresi / Poly Haven. The runtime package retains
// the exact native vertex/normal/index bytes and includes no images/materials.
// It is a partial cliff surface: face +Z toward the canyon and bury its -Z back.
export const CLIFF_SCAN_BOUNDS = Object.freeze({
  min: Object.freeze([-2.133601427078247, -0.03435921296477318, -3.466048240661621]),
  max: Object.freeze([2.8199098110198975, 3.5296897888183594, 0.36125504970550537]),
  size: Object.freeze([4.9535112380981445, 3.5640490017831326, 3.8273032903671265]),
  triangles: 20174,
  vertices: 11106,
});

export async function loadCliffGeometry() {
  const url = new URL('../assets/geology/rock_face_01_geometry.glb', import.meta.url);
  const gltf = await new GLTFLoader().loadAsync(url.href);
  const meshes = [];
  gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
  if (meshes.length !== 1) throw new Error('Cliff scan must contain exactly one mesh.');
  const source = meshes[0];
  gltf.scene.updateMatrixWorld(true);
  const geometry = source.geometry;
  // This pinned scan has identity node transforms. Bake any authored transform
  // before returning a stand-alone geometry so placement stays in world units.
  if (!source.matrixWorld.equals(new THREE.Matrix4())) geometry.applyMatrix4(source.matrixWorld);
  if (geometry.getAttribute('position')?.count !== CLIFF_SCAN_BOUNDS.vertices ||
      geometry.index?.count !== CLIFF_SCAN_BOUNDS.triangles * 3 ||
      !geometry.getAttribute('normal')) {
    throw new Error('Cliff scan geometry differs from the accepted native scan.');
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'rock_face_01_original_scan_geometry';
  geometry.userData = { ...geometry.userData, source: 'https://polyhaven.com/a/rock_face_01', license: 'CC0-1.0', nativeFaceDirection: '+Z' };
  // GLTFLoader supplies a default material for a material-free primitive. The
  // caller supplies the shared canyon material; dispose that unused default.
  for (const material of Array.isArray(source.material) ? source.material : [source.material]) material.dispose();
  source.removeFromParent();
  return geometry;
}

// The reference scan is a cut-out surface, not a solid cliff. Close its entire
// outer perimeter with a fractured haunch that descends into the canyon massif.
// Native face triangles/placement remain unchanged; this is additional rock.
export function createCliffBacking(source){
  const position=source.attributes.position,index=source.index.array,vertices=[],weld=new Map(),remap=[];
  for(let i=0;i<position.count;i++){
    const p=[position.getX(i),position.getY(i),position.getZ(i)],key=p.map(v=>v.toFixed(6)).join(',');
    if(!weld.has(key)){weld.set(key,vertices.length);vertices.push(p);}remap.push(weld.get(key));
  }
  const edges=new Map();
  for(let i=0;i<index.length;i+=3){const tri=Array.from(index.slice(i,i+3),v=>remap[v]);for(let j=0;j<3;j++){
    const a=tri[j],b=tri[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
    if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
  }}
  const boundary=[...edges.values()].filter(e=>e.count===1),next=new Map(boundary.map(e=>[e.a,e.b])),unused=new Set(boundary.map(e=>e.a)),loops=[];
  while(unused.size){const start=unused.values().next().value,loop=[];let current=start;
    while(unused.has(current)){unused.delete(current);loop.push(current);current=next.get(current);}
    if(current===start)loops.push(loop);
  }
  const outline=loops.sort((a,b)=>b.length-a.length)[0];
  if(outline?.length!==882)throw new Error('Pinned cliff outer boundary changed');
  const positions=[],indices=[],n=outline.length,centerX=.343154;
  for(let ring=0;ring<3;ring++)for(const id of outline){
    const [x,y,z]=vertices[id],lower=1-THREE.MathUtils.clamp((y-CLIFF_SCAN_BOUNDS.min[1])/CLIFF_SCAN_BOUNDS.size[1],0,1);
    const step=ring===1?.70:1.6,spread=ring===1?.07:.18;
    positions.push(ring?centerX+(x-centerX)*(1+spread):x,ring?y-step*lower:y,ring===1?z-1.4:ring===2?-10:z);
  }
  // Opposite direction to each scan boundary edge gives an outward underside.
  for(let ring=0;ring<2;ring++)for(let j=0;j<n;j++){
    const a=ring*n+j,b=ring*n+(j+1)%n,c=a+n,d=b+n;
    indices.push(b,a,c,b,c,d);
  }
  const cap=positions.length/3;positions.push(centerX,1.3,-10);
  for(let j=0;j<n;j++)indices.push(2*n+(j+1)%n,2*n+j,cap);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  // The scan boundary has sub-centimetre chips. Average support normals over
  // a short physical arc so those chips do not become metre-long light streaks
  // along an otherwise broad rock plane. Surface positions remain exact.
  const normal=geometry.attributes.normal,original=normal.array.slice();
  for(let ring=0;ring<3;ring++)for(let j=0;j<n;j++){
    const sum=new THREE.Vector3().fromArray(original,(ring*n+j)*3),origin=new THREE.Vector3(...vertices[outline[j]]);
    for(const direction of [-1,1])for(let step=1;step<=32;step++){
      const k=(j+direction*step+n)%n,point=new THREE.Vector3(...vertices[outline[k]]);
      if(point.distanceTo(origin)>.32)break;
      sum.add(new THREE.Vector3().fromArray(original,(ring*n+k)*3));
    }
    sum.normalize();normal.setXYZ(ring*n+j,sum.x,sum.y,sum.z);
  }
  geometry.name='Scan perimeter rock haunch and buried rear closure';
  geometry.userData={outerBoundaryEdges:n,addedTriangles:indices.length/3,rearDepth:10,nativeResidualBoundaryEdges:boundary.length-n,scope:'Closes full outer scan perimeter. Four tiny native scan flap edges remain unchanged; not a repaired-manifold claim.'};
  return geometry;
}
