import * as THREE from '../../vendor/three.module.js?v=052';
import {GLTFLoader} from '../../vendor/GLTFLoader.js?v=052';
import {WARDEN_SCULPT} from './warden-shape.js?v=ch2-08';

// The Warden's sculpt: a kneeling stone king made in Meshy from our own concept art, 62,000
// triangles, textures cut to 1024 px. It is placed by the numbers the build script worked out.
// Shots and sight lines test its real triangles through a grid of 8 m cells, so a round lands
// on the stone you see, not on the rougher boxes the craft bumps into.
const CELL=8;

function hexSha256(bytes){
 return crypto.subtle.digest('SHA-256',bytes).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''));
}
function makeLoader(){
 const loader=new GLTFLoader();
 loader.register(parser=>{
  parser.textureLoader=new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  parser.textureLoader.setRequestHeader(parser.options.requestHeader);
  return {name:'WardenImageTextures'};
 });
 return loader;
}

// Every triangle listed in each cell its bounds touch, as one flat array with a start per cell.
function triangleGrid(pos,index){
 const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
 for(let i=0;i<pos.length;i+=3){min.x=Math.min(min.x,pos[i]);min.y=Math.min(min.y,pos[i+1]);min.z=Math.min(min.z,pos[i+2]);max.x=Math.max(max.x,pos[i]);max.y=Math.max(max.y,pos[i+1]);max.z=Math.max(max.z,pos[i+2]);}
 min.subScalar(.5);max.addScalar(.5);
 const nx=Math.ceil((max.x-min.x)/CELL),ny=Math.ceil((max.y-min.y)/CELL),nz=Math.ceil((max.z-min.z)/CELL),cells=nx*ny*nz,tris=index.length/3;
 const range=new Int32Array(tris*6),count=new Uint32Array(cells+1);
 const at=(v,lo,n)=>Math.max(0,Math.min(n-1,Math.floor((v-lo)/CELL)));
 for(let t=0;t<tris;t++){
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for(let k=0;k<3;k++){const v=index[t*3+k]*3;x0=Math.min(x0,pos[v]);x1=Math.max(x1,pos[v]);y0=Math.min(y0,pos[v+1]);y1=Math.max(y1,pos[v+1]);z0=Math.min(z0,pos[v+2]);z1=Math.max(z1,pos[v+2]);}
  const r=[at(x0,min.x,nx),at(x1,min.x,nx),at(y0,min.y,ny),at(y1,min.y,ny),at(z0,min.z,nz),at(z1,min.z,nz)];range.set(r,t*6);
  for(let z=r[4];z<=r[5];z++)for(let y=r[2];y<=r[3];y++)for(let x=r[0];x<=r[1];x++)count[(z*ny+y)*nx+x+1]++;
 }
 for(let c=0;c<cells;c++)count[c+1]+=count[c];
 const list=new Uint32Array(count[cells]),fill=count.slice(0,cells);
 for(let t=0;t<tris;t++){const r=range.subarray(t*6,t*6+6);for(let z=r[4];z<=r[5];z++)for(let y=r[2];y<=r[3];y++)for(let x=r[0];x<=r[1];x++)list[fill[(z*ny+y)*nx+x]++]=t;}
 return {min,max,nx,ny,nz,start:count,list,pos,index,seen:new Uint32Array(tris),stamp:0};
}

// Nearest triangle along a ray, walking the cells it crosses in order (a 3D grid walk).
function rayGrid(g,o,d,far){
 // Clip the ray to the grid's box first.
 let t0=0,t1=far;
 for(const k of ['x','y','z']){
  if(d[k]===0){if(o[k]<g.min[k]||o[k]>g.max[k])return Infinity;continue;}
  let a=(g.min[k]-o[k])/d[k],b=(g.max[k]-o[k])/d[k];if(a>b)[a,b]=[b,a];
  t0=Math.max(t0,a);t1=Math.min(t1,b);if(t1<t0)return Infinity;
 }
 const {pos,index,list,start,nx,ny,nz}=g,seen=g.seen,stamp=++g.stamp;
 const px=o.x+d.x*t0,py=o.y+d.y*t0,pz=o.z+d.z*t0;
 let ix=Math.min(nx-1,Math.max(0,Math.floor((px-g.min.x)/CELL))),iy=Math.min(ny-1,Math.max(0,Math.floor((py-g.min.y)/CELL))),iz=Math.min(nz-1,Math.max(0,Math.floor((pz-g.min.z)/CELL)));
 const sx=d.x>0?1:-1,sy=d.y>0?1:-1,sz=d.z>0?1:-1;
 const next=(i,s,lo,dk,ok)=>dk?(lo+(i+(s>0?1:0))*CELL-ok)/dk:Infinity;
 let tx=next(ix,sx,g.min.x,d.x,o.x),ty=next(iy,sy,g.min.y,d.y,o.y),tz=next(iz,sz,g.min.z,d.z,o.z);
 const ddx=d.x?CELL/Math.abs(d.x):Infinity,ddy=d.y?CELL/Math.abs(d.y):Infinity,ddz=d.z?CELL/Math.abs(d.z):Infinity;
 let best=t1,found=false;
 for(;;){
  const c=(iz*ny+iy)*nx+ix;
  for(let n=start[c];n<start[c+1];n++){
   const t=list[n];if(seen[t]===stamp)continue;seen[t]=stamp;
   const a=index[t*3]*3,b=index[t*3+1]*3,cc=index[t*3+2]*3;
   const e1x=pos[b]-pos[a],e1y=pos[b+1]-pos[a+1],e1z=pos[b+2]-pos[a+2],e2x=pos[cc]-pos[a],e2y=pos[cc+1]-pos[a+1],e2z=pos[cc+2]-pos[a+2];
   const qx=d.y*e2z-d.z*e2y,qy=d.z*e2x-d.x*e2z,qz=d.x*e2y-d.y*e2x,det=e1x*qx+e1y*qy+e1z*qz;
   if(Math.abs(det)<1e-9)continue;
   const inv=1/det,sxv=o.x-pos[a],syv=o.y-pos[a+1],szv=o.z-pos[a+2],u=(sxv*qx+syv*qy+szv*qz)*inv;
   if(u<0||u>1)continue;
   const rx=syv*e1z-szv*e1y,ry=szv*e1x-sxv*e1z,rz=sxv*e1y-syv*e1x,v=(d.x*rx+d.y*ry+d.z*rz)*inv;
   if(v<0||u+v>1)continue;
   const hit=(e2x*rx+e2y*ry+e2z*rz)*inv;if(hit>1e-3&&hit<best){best=hit;found=true;}
  }
  const exit=Math.min(tx,ty,tz);
  if(best<=exit||exit>t1)break;
  if(tx<=ty&&tx<=tz){ix+=sx;tx+=ddx;if(ix<0||ix>=nx)break;}
  else if(ty<=tz){iy+=sy;ty+=ddy;if(iy<0||iy>=ny)break;}
  else{iz+=sz;tz+=ddz;if(iz<0||iz>=nz)break;}
 }
 return found?best:Infinity;
}

// The shot test on its own, for anything holding the sculpt's world-space triangles.
export function sculptRay(pos,index){const grid=triangleGrid(pos,index);return (origin,dir,far=Infinity)=>rayGrid(grid,origin,dir,far);}

async function load(at){
 // Proof pages open as local files, where fetch is refused, so they hand the bytes in.
 const buffer=globalThis.CH2_GLB?.[WARDEN_SCULPT.asset]||await fetch(new URL(`../../assets/${WARDEN_SCULPT.asset}.glb`,import.meta.url).href).then(r=>{
  if(!r.ok)throw Error('Warden sculpt missing');return r.arrayBuffer();
 });
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength!==WARDEN_SCULPT.bytes||await hexSha256(bytes)!==WARDEN_SCULPT.sha256)throw Error('Warden sculpt bytes do not match');
 const gltf=await makeLoader().parseAsync(buffer,'');
 const holder=new THREE.Group();holder.name='The Warden';
 holder.scale.setScalar(WARDEN_SCULPT.scale);holder.position.set(at.x+WARDEN_SCULPT.offset[0],WARDEN_SCULPT.offset[1],at.z+WARDEN_SCULPT.offset[2]);
 holder.add(gltf.scene);holder.updateMatrixWorld(true);
 let mesh=null;
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;mesh=node;
  // Sunlit sandstone grey, satin rather than the bake's gloss; the carving stays in the normal map.
  const old=node.material;
  node.material=new THREE.MeshLambertMaterial({map:old.map,normalMap:old.normalMap,color:0xeadfca});
  old.metalnessMap?.dispose();if(old.roughnessMap!==old.metalnessMap)old.roughnessMap?.dispose();old.dispose();
  node.castShadow=node.receiveShadow=true;
 });
 // The triangles in world space, for the shot grid.
 const geometry=mesh.geometry,src=geometry.getAttribute('position'),pos=new Float32Array(src.count*3),v=new THREE.Vector3();
 for(let i=0;i<src.count;i++){v.fromBufferAttribute(src,i).applyMatrix4(mesh.matrixWorld);pos[i*3]=v.x;pos[i*3+1]=v.y;pos[i*3+2]=v.z;}
 const index=geometry.index?geometry.index.array:Uint32Array.from({length:src.count},(_,i)=>i);
 return {holder,triangles:index.length/3,ray:sculptRay(pos,index)};
}
let pending;
export function loadWarden(at){
 if(!pending)pending=load(at).catch(error=>{pending=null;throw error;});
 return pending;
}
