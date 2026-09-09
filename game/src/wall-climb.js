import * as THREE from '../vendor/three.module.js?v=052';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),CELL=4;
// Index the actual rendered triangles, including transformed rock instances.
// The YZ bins only accelerate a horizontal ray; contacts are never interpolated.
export function createWallSurface(actor,meshes){
 const bins=new Map(),m=new THREE.Matrix4(),im=new THREE.Matrix4(),verts=[V(),V(),V()];let triangles=0;
 const area=new THREE.Box3(V(actor.centerX-230,8,actor.z-44),V(actor.centerX+230,100,actor.z+44));
 for(const mesh of meshes){
  if(!mesh.visible||mesh.userData.dancePocketCleared||!mesh.geometry)continue;
  mesh.updateWorldMatrix(true,false);const g=mesh.geometry;g.computeBoundingBox();
  for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
   if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,im);m.multiplyMatrices(mesh.matrixWorld,im);}else m.copy(mesh.matrixWorld);
   if(Math.abs(m.determinant())<1e-9||!g.boundingBox.clone().applyMatrix4(m).intersectsBox(area))continue;
   const p=g.attributes.position,idx=g.index,count=idx?idx.count:p.count;
   for(let k=0;k<count;k+=3){
    for(let j=0;j<3;j++)verts[j].fromBufferAttribute(p,idx?idx.getX(k+j):k+j).applyMatrix4(m);
    const [a,b,c]=verts,lowY=Math.min(a.y,b.y,c.y),highY=Math.max(a.y,b.y,c.y),lowZ=Math.min(a.z,b.z,c.z),highZ=Math.max(a.z,b.z,c.z);
    if(highY<area.min.y||lowY>area.max.y||highZ<area.min.z||lowZ>area.max.z)continue;
    const den=(b.y-c.y)*(a.z-c.z)+(c.z-b.z)*(a.y-c.y);if(Math.abs(den)<1e-7)continue;
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(normal.x*actor.side>0)normal.negate();
    const tri={a:a.clone(),b:b.clone(),c:c.clone(),den,normal,bank:mesh.name.startsWith(`bank-${actor.side}-`),mesh:mesh.name};triangles++;
    for(let y=Math.floor(Math.max(lowY,area.min.y)/CELL);y<=Math.floor(Math.min(highY,area.max.y)/CELL);y++)for(let z=Math.floor(Math.max(lowZ,area.min.z)/CELL);z<=Math.floor(Math.min(highZ,area.max.z)/CELL);z++){const key=y+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);}
   }
  }
 }
 function sample(y,z){let best=null,distance=Infinity;for(const t of bins.get(Math.floor(y/CELL)+','+Math.floor(z/CELL))||[]){const {a,b,c,den}=t,u=((b.y-c.y)*(z-c.z)+(c.z-b.z)*(y-c.y))/den,v=((c.y-a.y)*(z-c.z)+(a.z-c.z)*(y-c.y))/den;if(u< -1e-7||v< -1e-7||u+v>1.0000001)continue;const x=u*a.x+v*b.x+(1-u-v)*c.x,d=(x-actor.centerX)*actor.side;if(d>=0&&d<distance){distance=d;best={point:V(x,y,z),normal:t.normal,bank:t.bank,mesh:t.mesh};}}return best;}
 return{sample,triangles};
}
export function planWallRoute(a,surface){
 let best=null;
 for(const dz of [0,-6,6,-12,12,-20,20,-30,30]){
  const z=a.z+dz;let run=[];
  function accept(){if(run.length<5)return;const score=run.length-Math.abs(dz)*.18-Math.abs((run[0]+run.at(-1))*.5-34)*.1;if(!best||score>best.score)best={z,min:run[0],max:run.at(-1),score};}
  for(let y=14;y<=74;y+=.75){
   const center=surface.sample(y+3.4*a.scale,z);let valid=!!center&&center.bank;
   if(valid)for(const h of [0,1.8,3.5,5.3,7.2])for(const offset of [-2.7,0,2.7]){const hit=surface.sample(y+h*a.scale,z+offset*a.scale);if(!hit||!hit.bank||Math.abs(hit.point.x-center.point.x)>2.3||Math.abs(hit.normal.x)<.35){valid=false;break;}}
   if(valid)run.push(y);else{accept();run=[];}
  }accept();
 }
 if(!best)throw Error('No obstacle-free wall route for '+a.id);
 // Keep travel bounded, with a full creature-sized clearance strip at each end.
 if(best.max-best.min>20){const mid=(best.min+best.max)/2;best.min=mid-10;best.max=mid+10;}
 return best;
}
export function poseWallRoot(a,f){
 const route=a.wallRoute,y=THREE.MathUtils.lerp(route.min,route.max,f),hit=a.wallSurface.sample(y+3.4*a.scale,route.z);
 let x=hit.point.x;for(const h of [1,3.4,5.5])for(const dz of [-1.3,0,1.3]){const wall=a.wallSurface.sample(y+h*a.scale,route.z+dz*a.scale);if(wall&&wall.point.x*a.side<x*a.side)x=wall.point.x;}a.root.position.set(x-a.side*2.1*a.scale,y,route.z);a.root.rotation.set(0,-a.side*Math.PI/2,0);
}
export function wallGrips(a,points,braced){
 if(!a.wallGrips)a.wallGrips=points.map(()=>null);
 const out=[];
 function hold(i,y,z){
  const key=i+','+y.toFixed(5)+','+z.toFixed(5);if(a.gripCache.has(key))return a.gripCache.get(key);
  const hit=a.wallSurface.sample(y,z);if(!hit||!hit.bank)throw Error('Unqualified wall grip '+a.id);
  const worldRotation=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),hit.normal);
  if(i<2)worldRotation.multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI));
  let world=hit.point.clone(),shift=-Infinity,touch=null;
  // Seat the actual hand/toe envelope against the highest intersected triangle.
  // This also handles a claw spanning two faces at a small wall crease.
  for(const p of a.gripGeometry[i]){
   const vertex=p.clone();if(i%2===0)vertex.x*=-1;vertex.multiplyScalar(a.scale).applyQuaternion(worldRotation).add(world);
   const support=a.wallSurface.sample(vertex.y,vertex.z);if(!support)continue;
   const depth=(vertex.x-support.point.x)*a.side;
   if(depth>shift){shift=depth;touch=support.point.clone();}
  }
  world.x-=a.side*(shift+.025);
  const result={point:world,surface:touch||hit.point.clone(),normal:hit.normal.clone(),rotation:a.root.quaternion.clone().invert().multiply(worldRotation)};
  a.gripCache.set(key,result);return result;
 }
 for(const [i,local]of points.entries()){
  const desired=local.clone().applyMatrix4(a.root.matrixWorld),step=1.1*a.scale,offset=i*.25-(i<2?5.65:.45)/1.1;
  const level=desired.y/step+offset,whole=Math.floor(level),fraction=level-whole,blend=THREE.MathUtils.smoothstep(fraction,.72,1);
  const from=hold(i,(whole-offset)*step,desired.z),to=blend>0?hold(i,(whole+1-offset)*step,desired.z):from;
  let grip={point:from.point.clone().lerp(to.point,blend),surface:from.surface.clone(),normal:from.normal.clone(),rotation:from.rotation.clone().slerp(to.rotation,blend),planted:blend===0};
  grip.point.x-=a.side*Math.sin(blend*Math.PI)*1.1*a.scale;
  if(braced){grip=a.wallGrips[i]?.planted?a.wallGrips[i]:{...(blend<.5?from:to),planted:true};}a.wallGrips[i]=grip;
  local.copy(a.root.worldToLocal(grip.point.clone()));out.push({...grip,point:grip.point.clone(),surface:grip.surface.clone(),normal:grip.normal.clone(),rotation:grip.rotation.clone()});
 }
 a.gripDetails=out;a.contacts=out.map(h=>h.surface.clone());
}
