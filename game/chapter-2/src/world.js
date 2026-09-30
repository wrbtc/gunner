import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';

// Chapter 2 grey box: one cliff-ringed bowl, a ruined city, and the Warden, a 620 m
// kneeling colossus carved out of the north cliff. Everything is boxes on purpose; round 1
// only asks whether flying and fighting here feel good. Units are metres, north is -Z.
export const BOWL_RADIUS=1000,CEILING=900,WARDEN=Object.freeze({x:0,z:-700});
export const LEVELS=Object.freeze([
 {name:'Feet galleries',y:80},{name:'Knee bridges',y:225},{name:'Chest halls',y:385},
 {name:'Shoulder towers',y:520},{name:'The crown',y:600}
]);
export const WORLD_LAYER=0;

export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function box(w,h,d,x,y,z,ry=0,rz=0){
 const g=new THREE.BoxGeometry(w,h,d);
 if(rz)g.rotateZ(rz);if(ry)g.rotateY(ry);
 g.translate(x,y,z);return g;
}

export function createWorld(scene){
 const random=rng(2026);
 const colliders=[];// axis-aligned boxes that block the craft, shots and thrown rocks
 const addCollider=(min,max,kind)=>{const c={min:new THREE.Vector3(...min),max:new THREE.Vector3(...max),kind,alive:true};colliders.push(c);return c;};
 const materials={
  ground:new THREE.MeshLambertMaterial({color:0x2b241d}),
  city:new THREE.MeshLambertMaterial({color:0x4a4338}),
  stone:new THREE.MeshLambertMaterial({color:0x6e6453}),
  cliff:new THREE.MeshLambertMaterial({color:0x3a3128}),
  pillar:new THREE.MeshLambertMaterial({color:0x8a7d64}),
  ember:new THREE.MeshBasicMaterial({color:0xff7a2a})
 };
 const root=new THREE.Group();root.name='Chapter 2 world';scene.add(root);

 const ground=new THREE.Mesh(new THREE.CircleGeometry(1300,64).rotateX(-Math.PI/2),materials.ground);
 ground.name='Ash plain';root.add(ground);
 // Glowing fissures on the plain give the ground heat and a sense of speed.
 const cracks=[];
 for(let i=0;i<70;i++){
  const a=random()*Math.PI*2,r=120+random()*820,len=30+random()*90;
  cracks.push(box(len,.4,1.2+random()*2.5,Math.cos(a)*r,.25,Math.sin(a)*r,random()*Math.PI));
 }
 const crackMesh=new THREE.Mesh(mergeGeometries(cracks),materials.ember);crackMesh.name='Ember fissures';root.add(crackMesh);

 // Cliff ring: the edge of the world, and the reason we never draw past about 1.2 km.
 const cliffCount=72,cliffs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials.cliff,cliffCount);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 for(let i=0;i<cliffCount;i++){
  const a=i/cliffCount*Math.PI*2,r=1120+random()*60,h=260+random()*260;
  p.set(Math.cos(a)*r,h/2-10,Math.sin(a)*r);q.setFromAxisAngle(up,-a+(random()-.5)*.3);s.set(150,h,110+random()*80);
  cliffs.setMatrixAt(i,m.compose(p,q,s));
 }
 cliffs.name='Cliff ring';root.add(cliffs);

 // Ruined city: one instanced draw. A clear avenue runs from the south gate to the Warden.
 const towers=[],rooftops=[];
 for(let x=-760;x<=760;x+=58)for(let z=-380;z<=900;z+=58){
  const jx=x+(random()-.5)*20,jz=z+(random()-.5)*20;
  if(Math.hypot(jx,jz)>930||Math.abs(jx)<46||Math.hypot(jx-WARDEN.x,jz-WARDEN.z)<330||random()<.18)continue;
  const w=18+random()*24,d=18+random()*24,far=Math.min(1,Math.hypot(jx,jz)/900);
  const h=14+random()*(50+far*90)*(random()<.12?2:1);
  towers.push({x:jx,z:jz,w,d,h,tilt:random()<.2?(random()-.5)*.18:0});
 }
 const city=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials.city,towers.length);
 towers.forEach((t,i)=>{
  p.set(t.x,t.h/2,t.z);q.setFromEuler(new THREE.Euler(0,0,t.tilt));s.set(t.w,t.h,t.d);
  city.setMatrixAt(i,m.compose(p,q,s));
  addCollider([t.x-t.w/2,0,t.z-t.d/2],[t.x+t.w/2,t.h,t.z+t.d/2],'tower');
  if(t.h>30&&!t.tilt)rooftops.push(new THREE.Vector3(t.x,t.h,t.z));
 });
 city.name='Ruined city';root.add(city);

 // The Warden blockout, local to its base, facing south toward the city.
 const W=WARDEN,parts=[];
 const part=(w,h,d,x,y,z)=>{parts.push(box(w,h,d,W.x+x,y,W.z+z));addCollider([W.x+x-w/2,y-h/2,W.z+z-d/2],[W.x+x+w/2,y+h/2,W.z+z+d/2],'warden');};
 part(380,80,300,0,40,0);                 // plinth; its top is the feet galleries
 for(const side of [-1,1])part(100,145,120,side*95,152.5,40); // shins up to the knees
 part(300,10,34,0,220,72);                 // knee bridge
 part(200,260,140,0,350,-20);              // torso
 part(290,10,64,0,380,82);                 // chest hall gallery
 part(330,40,150,0,500,-20);               // shoulders
 for(const side of [-1,1])part(40,70,40,side*150,555,-20); // shoulder towers
 part(90,80,90,0,560,-10);                 // head
 for(let i=-2;i<=2;i++)part(10,40+(2-Math.abs(i))*18,10,i*20,620+(2-Math.abs(i))*9,-10); // crown spikes
 part(14,700,14,200,350,50);               // spear shaft
 part(40,30,130,178,470,15);               // raised arm to the spear
 part(1100,720,200,0,360,-230);            // the cliff it is carved from
 const warden=new THREE.Mesh(mergeGeometries(parts),materials.stone);warden.name='The Warden (blockout)';root.add(warden);

 // Ledges: where creatures stand. Each has pillars along its front edge for cover.
 const ledges=[
  {level:0,y:80,z:W.z+140,x0:-170,x1:170},
  {level:1,y:225,z:W.z+80,x0:-140,x1:140},
  {level:2,y:385,z:W.z+104,x0:-135,x1:135},
  {level:3,y:520,z:W.z+45,x0:-155,x1:155},
  {level:4,y:600,z:W.z+30,x0:-40,x1:40}
 ];
 const pillars=[];
 for(const ledge of ledges){
  const n=Math.max(2,Math.round((ledge.x1-ledge.x0)/34));
  for(let i=0;i<=n;i++){
   const x=W.x+ledge.x0+(ledge.x1-ledge.x0)*i/n;
   pillars.push({pos:new THREE.Vector3(x,ledge.y,ledge.z),ledge,hp:260,collider:addCollider([x-4,ledge.y,ledge.z-4],[x+4,ledge.y+22,ledge.z+4],'pillar')});
  }
 }
 const pillarMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(4,4.6,22,10).translate(0,11,0),materials.pillar,pillars.length);
 const pillarMatrix=i=>{const pl=pillars[i];p.copy(pl.pos);q.identity();s.setScalar(pl.hp>0?1:0);return m.compose(p,q,s);};
 pillars.forEach((_,i)=>pillarMesh.setMatrixAt(i,pillarMatrix(i)));
 pillarMesh.name='Cover pillars';root.add(pillarMesh);

 root.traverse(o=>o.layers.set(WORLD_LAYER));
 return {
  root,colliders,ledges,pillars,rooftops,towers,materials,
  damagePillar(index,amount){
   const pl=pillars[index];if(!pl||pl.hp<=0)return false;
   pl.hp-=amount;if(pl.hp>0)return false;
   pl.collider.alive=false;pillarMesh.setMatrixAt(index,pillarMatrix(index));pillarMesh.instanceMatrix.needsUpdate=true;return true;
  },
  stats(){return {towers:towers.length,colliders:colliders.length,pillars:pillars.length,pillarsStanding:pillars.filter(p=>p.hp>0).length};}
 };
}

// Ray against an axis-aligned box; returns the entry distance or Infinity.
export function rayBox(origin,dir,min,max,far=Infinity){
 let t0=0,t1=far;
 for(const k of ['x','y','z']){
  const inv=1/dir[k];let a=(min[k]-origin[k])*inv,b=(max[k]-origin[k])*inv;
  if(a>b)[a,b]=[b,a];
  t0=Math.max(t0,a);t1=Math.min(t1,b);if(t1<t0)return Infinity;
 }
 return t0;
}
export function pointInBox(pt,min,max,pad=0){
 return pt.x>min.x-pad&&pt.x<max.x+pad&&pt.y>min.y-pad&&pt.y<max.y+pad&&pt.z>min.z-pad&&pt.z<max.z+pad;
}
