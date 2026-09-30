import * as THREE from '../../vendor/three.module.js?v=052';

// Downtown, after the Warden came up through it. A Manhattan grid: avenues run north and
// south 250 m apart, cross streets every 75 m, long blocks between them split into lots.
// Destruction spreads out from the statue: almost nothing stands near it, a wall of towers
// still stands at the edge, and about 60% of the buildings are down overall. Every part is
// an instanced unit shape, so the whole city is a handful of draws.
export const GRID=Object.freeze({
 extent:1300,avenueSpacing:250,avenueWidth:26,streetSpacing:75,streetWidth:16,
 // The survivors' avenue runs up the middle to the plaza at the statue's feet.
 plaza:300
});
export const avenueXs=()=>{const out=[];for(let x=-GRID.extent;x<=GRID.extent;x+=GRID.avenueSpacing)out.push(x);return out;};
export const streetZs=()=>{const out=[];for(let z=-GRID.extent+GRID.streetSpacing/2;z<=GRID.extent;z+=GRID.streetSpacing)out.push(z);return out;};

// Share of buildings down at a distance from the statue.
function downChance(d){
 if(d<GRID.plaza)return 1;
 if(d<600)return .88;
 if(d<900)return .72;
 if(d<1150)return .56;
 return .26;
}
const PALETTE=[0x9a6a52,0x8a5a46,0xb7a58a,0xc8bea8,0x8d9296,0x7f8a92,0xa39a8c,0x6f6a64].map(c=>new THREE.Color(c));

// Windows drawn in the shader from world position: 3.6 m floors, 3.2 m bays, a darker shopfront
// band at street level, and a few dark (broken) panes. No texture, no extra geometry.
function windowed(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
 #ifdef USE_INSTANCING
  mat4 cityModel=modelMatrix*instanceMatrix;
 #else
  mat4 cityModel=modelMatrix;
 #endif
  vCityPos=(cityModel*vec4(position,1.0)).xyz;vCityNormal=normalize(mat3(cityModel)*normal);`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;\nfloat cityHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}')
   .replace('#include <color_fragment>',`#include <color_fragment>
  if(abs(vCityNormal.y)<.5){
   float u=abs(vCityNormal.x)>.5?vCityPos.z:vCityPos.x;
   vec2 cell=vec2(u/3.2,vCityPos.y/3.6),f=fract(cell);
   float pane=step(.16,f.x)*step(f.x,.84)*step(.22,f.y)*step(f.y,.78);
   // Far away, the rows blur into an even tone instead of shimmering.
   float fw=max(fwidth(cell.x),fwidth(cell.y));pane=mix(pane,.42,smoothstep(.2,.6,fw));
   float broken=step(.86,cityHash(floor(cell)+floor(vCityPos.xz*.01)));
   float street=1.0-step(5.5,vCityPos.y);
   diffuseColor.rgb*=mix(1.0,mix(.52,.2,broken),pane*(1.0-street));
   diffuseColor.rgb*=mix(1.0,.55,street*step(.3,f.x));
  }`);
 };
 return material;
}

export function createCity(root,{addCollider,random,exclude}){
 const mat=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new THREE.Vector3(),scl=new THREE.Vector3(),eul=new THREE.Euler();
 const unit=new THREE.BoxGeometry(1,1,1).translate(0,.5,0);
 const buildings=[],piles=[],chunks=[],tops=[],slabs=[],cars=[],tanks=[],rooftops=[];
 const A=avenueXs(),S=streetZs();
 const halfAve=GRID.avenueWidth/2,halfSt=GRID.streetWidth/2;
 const concrete=new THREE.Color(0x8f8a82),shade=new THREE.Color();
 const tint=(c,k)=>shade.copy(c).lerp(concrete,.35+random()*.35).multiplyScalar(k).clone();
 let standing=0,down=0;
 for(let a=0;a<A.length-1;a++)for(let s=0;s<S.length-1;s++){
  const x0=A[a]+halfAve,x1=A[a+1]-halfAve,z0=S[s]+halfSt,z1=S[s+1]-halfSt;
  const cx=(x0+x1)/2,cz=(z0+z1)/2;
  if(Math.hypot(cx,cz)>GRID.extent+60)continue;
  slabs.push([cx,cz,x1-x0,z1-z0]);
  // Two rows of lots, each cut along the block into buildings 18 to 45 m wide.
  for(const [r0,r1] of [[z0,cz],[cz,z1]]){
   let x=x0;
   while(x<x1-8){
    const w=Math.min(x1-x,18+random()*27),lx=x+w/2,lz=(r0+r1)/2,d=r1-r0;x+=w;
    if(exclude(lx,lz))continue;
    const dist=Math.hypot(lx,lz),tall=random();
    const h=tall<.4?15+random()*25:tall<.85?40+random()*70:110+random()*130;
    const color=PALETTE[Math.floor(random()*PALETTE.length)],bw=w-1.5,bd=d-1.5;
    if(random()<downChance(dist)){
     down++;
     // Down: a heap of its own floors, spilling into the street on one side, and on about
     // half of them a stump still standing with broken slabs hanging off the top.
     const heap=Math.min(14,4+h*.06),spill=(random()<.5?-1:1)*(d*.35+random()*8);
     if(random()<.5){
      const sh=h*(.12+random()*.38);
      buildings.push({x:lx,z:lz,w:bw,d:bd,h:sh,color});
      for(let k=0;k<2+Math.floor(random()*3);k++)tops.push({x:lx+(random()-.5)*bw*.5,y:sh-random()*2,z:lz+(random()-.5)*bd*.5,
       w:bw*(.3+random()*.45),t:1+random()*2.5,d:bd*(.3+random()*.45),rx:(random()-.5)*.9,ry:random()*Math.PI,rz:(random()-.5)*.9,color:tint(color,.9)});
     }
     const parts=3+Math.floor(random()*3);
     for(let k=0;k<parts;k++)piles.push({x:lx+(random()-.5)*bw*.8,z:lz+(random()-.3)*spill,w:bw*(.35+random()*.4),d:bd*(.4+random()*.5),h:heap*(.5+random()*.6),
      rx:(random()-.5)*.6,ry:random()*Math.PI,color:tint(color,.75+random()*.2)});
     piles.push({collider:[lx-bw*.45,lz-bd*.45+Math.min(0,spill*.5),lx+bw*.45,lz+bd*.45+Math.max(0,spill*.5),heap*.8]});
     for(let k=0;k<4+Math.floor(random()*6);k++)chunks.push({x:lx+(random()-.5)*w*1.5,z:lz+spill*random()+(random()-.5)*d,s:1.2+random()*3.5,rot:random()*Math.PI,tilt:random(),color:tint(color,.8)});
    }else{
     standing++;
     const lean=h>110&&random()<.06?(random()<.5?-1:1)*(.05+random()*.08):0;
     // New York setbacks: tall buildings step in above a base, the wedding-cake skyline.
     if(h>70&&!lean){
      const base=h*(.3+random()*.3),k=.6+random()*.2;
      buildings.push({x:lx,z:lz,w:bw,d:bd,h:base,color});
      buildings.push({x:lx+(random()-.5)*bw*(1-k)*.8,z:lz,w:bw*k,d:bd*k,h,y0:base,color});
     }else buildings.push({x:lx,z:lz,w:bw,d:bd,h,color,lean});
     if(h>22&&h<130&&random()<.35)tanks.push({x:lx+(random()-.5)*w*.3,z:lz+(random()-.5)*d*.3,y:h});
     if(h>25&&h<90&&!lean)rooftops.push(new THREE.Vector3(lx,h,lz));
    }
   }
  }
 }
 // The rest of Manhattan out to the haze: plain standing blocks with no rubble or colliders,
 // since nothing is ever fought out there. Enough to put a skyline on every horizon.
 const outer=[];
 for(let x=-2600;x<=2600;x+=GRID.avenueSpacing/2)for(let z=-2600;z<=2600;z+=GRID.streetSpacing){
  const r=Math.hypot(x,z);if(r<GRID.extent+40||r>2600||random()<.35)continue;
  const w=40+random()*60,h=random()<.25?90+random()*150:18+random()*70;
  outer.push({x:x+(random()-.5)*30,z:z+(random()-.5)*10,w,d:GRID.streetSpacing-GRID.streetWidth-4,h,color:PALETTE[Math.floor(random()*PALETTE.length)],far:true});
 }
 // Cars left where they stopped: two lanes each way on the avenues, one on the streets.
 for(const x of A)for(let z=-GRID.extent;z<GRID.extent;z+=9+random()*26){
  if(Math.hypot(x,z)<GRID.plaza||random()<.35||exclude(x,z))continue;
  const lane=(random()<.5?-1:1)*(3+Math.floor(random()*2)*4.5);
  cars.push({x:x+lane,z,rot:(random()-.5)*.5,flip:random()<.06});
 }
 for(const z of S)for(let x=-GRID.extent;x<GRID.extent;x+=12+random()*40){
  if(Math.hypot(x,z)<GRID.plaza||random()<.5||exclude(x,z))continue;
  cars.push({x,z:z+(random()<.5?-2.5:2.5),rot:Math.PI/2+(random()-.5)*.5,flip:random()<.06});
 }

 const materials={
  building:windowed(new THREE.MeshLambertMaterial({color:0xffffff})),
  rubble:new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),
  slab:new THREE.MeshLambertMaterial({color:0xa8a39a}),
  car:new THREE.MeshLambertMaterial({color:0xffffff}),
  tank:new THREE.MeshLambertMaterial({color:0x6e5440})
 };
 const instanced=(geometry,material,count,name,shadow=true)=>{
  const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,count));mesh.count=count;mesh.name=name;
  mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);return mesh;
 };
 // Buildings, setbacks and stumps share one draw. A leaning tower gets an oriented collider.
 const towers=instanced(unit,materials.building,buildings.length+outer.length,'Downtown buildings');
 [...buildings,...outer].forEach((b,i)=>{
  const y0=b.y0||0,tall=b.h-y0;
  eul.set(0,0,b.lean||0);quat.setFromEuler(eul);pos.set(b.x,y0,b.z);scl.set(b.w,tall,b.d);
  towers.setMatrixAt(i,mat.compose(pos,quat,scl));towers.setColorAt(i,b.color);
  if(b.lean){
   const c=addCollider([-b.w/2,0,-b.d/2],[b.w/2,b.h,b.d/2],'tower');c.m=new THREE.Matrix4().compose(pos,quat,new THREE.Vector3(1,1,1));c.inv=c.m.clone().invert();
   c.bound={center:new THREE.Vector3(0,b.h/2,0).applyMatrix4(c.m),radius:Math.hypot(b.w/2,b.h/2,b.d/2)};
  }else if(!b.far)addCollider([b.x-b.w/2,y0,b.z-b.d/2],[b.x+b.w/2,b.h,b.z+b.d/2],'tower');
 });
 // Rubble: faceted lumps tinted from the building that fell, broken slabs on the stumps, and
 // loose debris out into the street.
 const lumps=piles.filter(p=>!p.collider),pileMesh=instanced(new THREE.IcosahedronGeometry(1,0).translate(0,.35,0),materials.rubble,lumps.length,'Rubble heaps');
 lumps.forEach((p,i)=>{
  eul.set(p.rx,p.ry,0);quat.setFromEuler(eul);pos.set(p.x,0,p.z);scl.set(p.w*.55,p.h,p.d*.55);
  pileMesh.setMatrixAt(i,mat.compose(pos,quat,scl));pileMesh.setColorAt(i,p.color);
 });
 for(const p of piles)if(p.collider&&p.collider[4]>5)addCollider([p.collider[0],0,p.collider[1]],[p.collider[2],p.collider[4],p.collider[3]],'rubble');
 const topMesh=instanced(unit,materials.rubble,tops.length,'Broken floors');
 tops.forEach((t,i)=>{
  eul.set(t.rx,t.ry,t.rz);quat.setFromEuler(eul);pos.set(t.x,t.y,t.z);scl.set(t.w,t.t,t.d);
  topMesh.setMatrixAt(i,mat.compose(pos,quat,scl));topMesh.setColorAt(i,t.color);
 });
 const chunkMesh=instanced(unit,materials.rubble,chunks.length,'Debris');
 chunks.forEach((c,i)=>{
  eul.set(c.tilt*.6,c.rot,c.tilt*.4);quat.setFromEuler(eul);pos.set(c.x,0,c.z);scl.set(c.s*1.6,c.s*.7,c.s);
  chunkMesh.setMatrixAt(i,mat.compose(pos,quat,scl));chunkMesh.setColorAt(i,c.color);
 });
 const slabMesh=instanced(unit,materials.slab,slabs.length,'Sidewalks',false);
 slabs.forEach(([x,z,w,d],i)=>{quat.identity();pos.set(x,0,z);scl.set(w,.25,d);slabMesh.setMatrixAt(i,mat.compose(pos,quat,scl));});
 // Yellow cabs among grey, dark and burnt-out cars.
 const carColors=[0xd8b21e,0xd8b21e,0x3c3d40,0x6f7478,0x9c9fa3,0x2a2522,0x7a2a22,0x1c1c1c].map(c=>new THREE.Color(c));
 const carMesh=instanced(new THREE.BoxGeometry(1.9,1.45,4.6).translate(0,.72,0),materials.car,cars.length,'Abandoned cars',false);
 cars.forEach((c,i)=>{
  eul.set(0,c.rot,c.flip?Math.PI:0);quat.setFromEuler(eul);pos.set(c.x,c.flip?1.45:0,c.z);scl.set(1,1,1);
  carMesh.setMatrixAt(i,mat.compose(pos,quat,scl));carMesh.setColorAt(i,carColors[Math.floor(random()*carColors.length)]);
 });
 // Water towers on the mid-rise roofs: the New York skyline tell.
 const tankGeo=new THREE.CylinderGeometry(2.8,2.8,5.5,12).translate(0,5.2,0);
 const roofGeo=new THREE.ConeGeometry(3.1,2.4,12).translate(0,9.1,0);
 const legGeo=new THREE.CylinderGeometry(3.3,3.3,2.4,6,1,true).translate(0,1.2,0);
 const tankBody=instanced(tankGeo,materials.tank,tanks.length,'Water towers'),tankRoof=instanced(roofGeo,materials.tank,tanks.length,'Water tower roofs'),tankLegs=instanced(legGeo,materials.tank,tanks.length,'Water tower stands');
 tanks.forEach((t,i)=>{quat.identity();pos.set(t.x,t.y,t.z);scl.set(1,1,1);mat.compose(pos,quat,scl);for(const m of [tankBody,tankRoof,tankLegs])m.setMatrixAt(i,mat);});
 return {rooftops,materials,stats:{standing,down,lumps:lumps.length,cars:cars.length,waterTowers:tanks.length,share:+(down/(down+standing)).toFixed(2)},
  meshes:[towers,pileMesh,topMesh,chunkMesh,slabMesh,carMesh,tankBody,tankRoof,tankLegs]};
}
