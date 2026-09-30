import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {createCity} from './city.js?v=ch2-08';
import {loadWarden} from './warden.js?v=ch2-08';
import {WARDEN_BOXES,WARDEN_SPOTS,WARDEN_EYES} from './warden-shape.js?v=ch2-08';

// Chapter 2: downtown New York after the Warden, a stone king 530 m tall kneeling on one knee
// over his sword, came up through it. The city is in city.js; the statue is the Meshy sculpt
// (warden.js) on a plinth built here, standing free on the rock it rose with, and the crater it
// climbed out of opens behind it. The creatures' own works (bridges, towers, balconies) are timber brown so
// they read apart from the carving. Units are metres at real scale: columns 11 m, creatures 2 to
// 6.5 m, the Satoshi a 15 m helicopter. North is -Z, and the Warden faces south down the avenue.
export const BOWL_RADIUS=1100,CEILING=900,WARDEN=Object.freeze({x:0,z:0});
export const LEVELS=Object.freeze([
 {name:'Feet galleries',y:80},{name:'Knee bridges',y:308},{name:'Sword arms',y:420},
 {name:'Shoulder towers',y:530},{name:'The crown',y:577}
]);
// Where the creatures built on the sculpt, local to the statue: a tower on each shoulder (x, the
// stone's height under it, z) and the deck inside the crown.
const SHOULDERS=Object.freeze([[-142,480,12],[62,480,12]]),CROWN=Object.freeze({x:-60,y:577,z:82});
const COLUMN=new THREE.Color(0x8a7d64),POST=new THREE.Color(0x6a4a34);
// The crater behind the statue, in world metres: its opening in the street and its floor.
export const PIT=Object.freeze({x0:-70,x1:70,z0:-300,z1:-160,floor:-130});
export const WORLD_LAYER=0;

export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function box(w,h,d,x,y,z,ry=0,rz=0){
 const g=new THREE.BoxGeometry(w,h,d);
 if(rz)g.rotateZ(rz);if(ry)g.rotateY(ry);
 g.translate(x,y,z);return g;
}

// Colliders are boxes. An oriented one keeps its rigid local frame (m) and inverse, so rays
// and points are tested in box space and distances still hold.
const localPoint=new THREE.Vector3(),localOrigin=new THREE.Vector3(),localDir=new THREE.Vector3();
export function colliderRay(c,origin,dir,far=Infinity){
 if(!c.inv)return rayBox(origin,dir,c.min,c.max,far);
 localOrigin.copy(origin).applyMatrix4(c.inv);localDir.copy(dir).transformDirection(c.inv);
 return rayBox(localOrigin,localDir,c.min,c.max,far);
}
export function colliderHas(c,pt,pad=0){
 if(c.bound&&pt.distanceToSquared(c.bound.center)>(c.bound.radius+pad)**2)return false;
 return pointInBox(c.inv?localPoint.copy(pt).applyMatrix4(c.inv):pt,c.min,c.max,pad);
}
// Pushes a sphere out through the nearest face; returns that face's world normal, or null
// when the sphere is clear of the box.
export function colliderPush(c,p,r,normal){
 if(!colliderHas(c,p,r))return null;
 const q=c.inv?localPoint.copy(p).applyMatrix4(c.inv):localPoint.copy(p);
 let axis='x',depth=Infinity,sign=1;
 for(const k of ['x','y','z']){
  const up=c.max[k]+r-q[k],down=q[k]-(c.min[k]-r);
  if(up<depth){depth=up;axis=k;sign=1;}
  if(down<depth){depth=down;axis=k;sign=-1;}
 }
 q[axis]+=depth*sign;normal.set(0,0,0);normal[axis]=sign;
 if(c.inv){p.copy(q.applyMatrix4(c.m));normal.transformDirection(c.m);}else p.copy(q);
 return normal;
}

export function createWorld(scene){
 const random=rng(2026);
 const colliders=[];// boxes that block the craft, shots and thrown rocks
 const addCollider=(min,max,kind)=>{const c={min:new THREE.Vector3(...min),max:new THREE.Vector3(...max),kind,alive:true};colliders.push(c);return c;};
 const materials={
  ground:new THREE.MeshLambertMaterial({color:0x5d5a55}),
  stone:new THREE.MeshLambertMaterial({vertexColors:true}),
  built:new THREE.MeshLambertMaterial({vertexColors:true}),
  pillar:new THREE.MeshLambertMaterial({color:0xffffff}),
  ember:new THREE.MeshBasicMaterial({color:0x2e2823}),
  seal:new THREE.MeshLambertMaterial({color:0x5e554a}),
  pit:new THREE.MeshBasicMaterial({color:0xffa040}),
  eyes:new THREE.MeshBasicMaterial({color:0xffc070}),
  glow:new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false})
 };
 const root=new THREE.Group();root.name='Chapter 2 world';scene.add(root);

 // The street surface, with the crater's opening cut out of it.
 const groundShape=new THREE.Shape().absarc(0,0,4200,0,Math.PI*2);
 // Shape y becomes world -z once the ground is laid flat.
 groundShape.holes.push(new THREE.Path().moveTo(PIT.x0,-PIT.z1).lineTo(PIT.x1,-PIT.z1).lineTo(PIT.x1,-PIT.z0).lineTo(PIT.x0,-PIT.z0).lineTo(PIT.x0,-PIT.z1));
 const ground=new THREE.Mesh(new THREE.ShapeGeometry(groundShape,48).rotateX(-Math.PI/2),materials.ground);
 ground.name='Streets';ground.receiveShadow=true;root.add(ground);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
 // Nothing is built on the plaza round the statue or its plinth, over the crater, or on the grand avenue south.
 const cleared=(x,z)=>Math.hypot(x-WARDEN.x,z-WARDEN.z)<230||(Math.abs(x-WARDEN.x)<255&&z>WARDEN.z-170&&z<WARDEN.z+235)||(x>PIT.x0-45&&x<PIT.x1+45&&z>PIT.z0-45&&z<PIT.z1+45)||(Math.abs(x)<34&&z>0);
 const city=createCity(root,{addCollider,random,exclude:cleared});
 const {rooftops}=city,towers=city.meshes;

 // ---- The Warden: the sculpt on its plinth, and what the creatures have built on it.
 const W=WARDEN,at=(x,y,z)=>new THREE.Vector3(W.x+x,y,W.z+z);
 const pieces={stone:[],built:[],seal:[],stand:[]},ember=[],eyes=[];
 const STONE=new THREE.Color(0xa99c86),CLIFF=new THREE.Color(0x6b6155),BUILT=new THREE.Color(0x6a4a34);
 const X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1),colour=new THREE.Color();
 // A block from a to b: w0 and w1 are its [across, depth] at each end; sides 4 is a slab,
 // 8 a chamfered limb. Corners and joints are jittered by up to `rough` metres so it reads hewn.
 function hewn(a,b,w0,w1=w0,{sides=4,segments=3,rough=2.5,group='stone',tint=STONE,kind='warden',collide=2}={}){
  const axisY=new THREE.Vector3().subVectors(b,a),len=axisY.length();axisY.divideScalar(len);
  const ref=Math.abs(axisY.x)>.9?Z:X,axisX=ref.clone().addScaledVector(axisY,-ref.dot(axisY)).normalize();
  const axisZ=new THREE.Vector3().crossVectors(axisX,axisY),frame=new THREE.Matrix4().makeBasis(axisX,axisY,axisZ).setPosition(a);
  const rings=[],corner=[];
  for(let k=0;k<sides;k++){
   const t=(k+.5)/sides*Math.PI*2+(sides===4?Math.PI:0),c=Math.cos(t),sn=Math.sin(t);
   corner.push(sides===4?[Math.sign(c),Math.sign(sn)]:[Math.sign(c)*Math.min(1,Math.abs(c)*1.41),Math.sign(sn)*Math.min(1,Math.abs(sn)*1.41)]);
  }
  for(let i=0;i<=segments;i++){
   const t=i/segments,wx=THREE.MathUtils.lerp(w0[0],w1[0],t)/2,wz=THREE.MathUtils.lerp(w0[1],w1[1],t)/2,end=i===0||i===segments;
   const y=len*t+(end?0:(random()-.5)*len*.08);
   rings.push(corner.map(([cx,cz])=>new THREE.Vector3(cx*wx+(random()-.5)*2*rough,y,cz*wz+(random()-.5)*2*rough)));
  }
  const pos=[],tri=(u,v,w)=>pos.push(u,v,w);
  for(let i=0;i<segments;i++)for(let k=0;k<sides;k++){
   const A=rings[i][k],B=rings[i][(k+1)%sides],C=rings[i+1][(k+1)%sides],D=rings[i+1][k];
   tri(A,C,B);tri(A,D,C);
  }
  const bottom=new THREE.Vector3(0,0,0),top=new THREE.Vector3(0,len,0);
  for(let k=0;k<sides;k++){tri(bottom,rings[0][k],rings[0][(k+1)%sides]);tri(top,rings[segments][(k+1)%sides],rings[segments][k]);}
  const g=new THREE.BufferGeometry(),arr=new Float32Array(pos.length*3),col=new Float32Array(pos.length*3);
  const shade=.92+random()*.12,world=new THREE.Vector3();
  pos.forEach((v,i)=>{
   world.copy(v).applyMatrix4(frame);arr.set([world.x,world.y,world.z],i*3);
   // Lighter toward the sky, darker at the joints and the foot of each block: cheap carving depth.
   const joint=(v.y<len*.06||v.y>len*.94)?.84:1;
   colour.copy(tint).multiplyScalar(shade*joint*(.72+.34*THREE.MathUtils.clamp(world.y/640,0,1)));
   col.set([colour.r,colour.g,colour.b],i*3);
  });
  g.setAttribute('position',new THREE.BufferAttribute(arr,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeVertexNormals();pieces[group].push(g);
  const made=[];
  const upright=Math.abs(axisY.y)>.9999&&Math.abs(axisX.x)>.9999;
  for(let i=0;i<collide;i++){
   const t0=i/collide,t1=(i+1)/collide,wx=Math.max(THREE.MathUtils.lerp(w0[0],w1[0],t0),THREE.MathUtils.lerp(w0[0],w1[0],t1))/2,wz=Math.max(THREE.MathUtils.lerp(w0[1],w1[1],t0),THREE.MathUtils.lerp(w0[1],w1[1],t1))/2;
   if(upright){
    const lo=Math.min(a.y+len*t0*axisY.y,a.y+len*t1*axisY.y),hi=Math.max(a.y+len*t0*axisY.y,a.y+len*t1*axisY.y);
    made.push(addCollider([a.x-wx,lo,a.z-wz],[a.x+wx,hi,a.z+wz],kind));
   }else{
    const c=addCollider([-wx,len*t0,-wz],[wx,len*t1,wz],kind);
    c.m=frame;c.inv=frame.clone().invert();
    c.bound={center:new THREE.Vector3(0,len*(t0+t1)/2,0).applyMatrix4(frame),radius:Math.hypot(wx,wz,len*(t1-t0)/2)};
    made.push(c);
   }
  }
  return made;
 }
 // An axis-aligned block by its corners, local to the Warden.
 const block=(min,max,opts={})=>hewn(at((min[0]+max[0])/2,min[1],(min[2]+max[2])/2),at((min[0]+max[0])/2,max[1],(min[2]+max[2])/2),
  [max[0]-min[0],max[2]-min[2]],[max[0]-min[0],max[2]-min[2]],{segments:1,collide:1,...opts});
 const glowSlit=(w,h,x,y,z,ry=0)=>ember.push(box(w,h,1.4,W.x+x,y,W.z+z,ry));

 // The crater it climbed out of: a shaft behind the plinth, walled in rock down to its floor,
 // plugged with rubble until the climb is done.
 const rock={tint:CLIFF,rough:4,kind:'crater'};
 block([PIT.x0-40,PIT.floor-20,PIT.z0-40],[PIT.x1+40,PIT.floor,PIT.z1+10],rock);
 block([PIT.x0-40,PIT.floor,PIT.z0-40],[PIT.x0,0,PIT.z1+10],rock);block([PIT.x1,PIT.floor,PIT.z0-40],[PIT.x1+40,0,PIT.z1+10],rock);
 block([PIT.x0,PIT.floor,PIT.z0-40],[PIT.x1,0,PIT.z0],rock);block([PIT.x0,PIT.floor,PIT.z1],[PIT.x1,0,PIT.z1+10],rock);
 // Plinth; its top is the feet galleries, and dark arches run along its face.
 block([-235,0,-150],[235,80,215],{rough:3});
 for(let x=-200;x<=200;x+=40)glowSlit(9,20,x,34,215.8);
 for(const side of [-1,1])for(let z=-110;z<=170;z+=56)glowSlit(9,20,side*235.8,34,z,Math.PI/2);

 // The statue's solid volume, as boxes worked out from the sculpt. The craft, rocks and
 // creatures bump into these; until the sculpt loads they also stand in for it on screen.
 const wardenBoxes=WARDEN_BOXES.map(([x0,y0,z0,x1,y1,z1])=>{
  pieces.stand.push(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0).translate(W.x+(x0+x1)/2,(y0+y1)/2,W.z+(z0+z1)/2));
  return addCollider([W.x+x0,y0,W.z+z0],[W.x+x1,y1,W.z+z1],'warden');
 });
 // The eyes burn, so the thermal sensor finds the face from anywhere.
 for(const [x,y,z] of WARDEN_EYES)eyes.push(box(8.5,2.2,1.6,W.x+x,y,W.z+z));

 // Their works: a bridge across the front of the knees, in front of the blade and under the
 // cross guard, on posts down to the plinth, with a plank out to the raised knee; a tower on
 // each shoulder with a balcony round it; and a deck inside the crown on top of the head.
 const builtOpts={group:'built',tint:BUILT,rough:1};
 block([-172,304,166],[108,308,194],builtOpts);
 for(const x of [-160,-100,-30,40,96])block([x-1.2,80,190],[x+1.2,304,192.4],builtOpts);
 block([-152,304,146],[-136,306.5,168],builtOpts);
 for(const [x,base,z] of SHOULDERS){
  // An open timber tower: four leaning legs, a ring beam and cross braces each storey, a
  // lookout cabin with a spire on top, and the balcony round it at 530.
  const TOP=588,storeys=[base+6,527,557,TOP];
  const leg=(i,y)=>{const k=(y-base)/(TOP-base),half=11-2.4*k,a=i*Math.PI/2+Math.PI/4;return at(x+Math.sign(Math.cos(a))*half,y,z+Math.sign(Math.sin(a))*half);};
  for(let i=0;i<4;i++)hewn(leg(i,base),leg(i,TOP),[2.6,2.6],[2.2,2.2],{...builtOpts,rough:.3,segments:1,collide:2});
  for(let k=1;k<storeys.length;k++)for(let i=0;i<4;i++){
   const lo=storeys[k-1],hi=storeys[k],j=(i+1)%4;
   const thin={...builtOpts,rough:.15,segments:1,collide:1};
   hewn(leg(i,hi),leg(j,hi),[1.4,1.4],[1.4,1.4],thin);hewn(leg(i,lo),leg(j,hi),[1,1],[1,1],thin);hewn(leg(j,lo),leg(i,hi),[1,1],[1,1],thin);
  }
  block([x-10,TOP,z-10],[x+10,TOP+15,z+10],builtOpts);
  hewn(at(x,TOP+15,z),at(x,TOP+40,z),[25,25],[3,3],{...builtOpts,segments:1,collide:1});
  for(const [dx,dz,ry] of [[0,10.2,0],[0,-10.2,Math.PI],[10.2,0,Math.PI/2],[-10.2,0,-Math.PI/2]])glowSlit(3,4,x+dx,TOP+8,z+dz,ry);
  block([x-44,527,z-44],[x+44,530,z+44],builtOpts);
 }
 hewn(at(CROWN.x,CROWN.y-3,CROWN.z),at(CROWN.x,CROWN.y,CROWN.z),[44,44],[44,44],{...builtOpts,sides:8,segments:1,collide:1});

 // Ledges: where creatures stand. A post or column at each spot gives them cover; `normal`
 // points out of the ledge, and creatures stay within `inward` metres behind it and 6 in front.
 // Stone columns on the plinth, the creatures' timber posts on the statue and their works.
 const pillars=[];
 const pillar=(x,y,z,nx,nz,level,inward=10,timber=false)=>{
  const pos=at(x,y,z);
  pillars.push({pos,level,inward,timber,normal:new THREE.Vector3(nx,0,nz).normalize(),hp:260,collider:addCollider([pos.x-1.9,y,pos.z-1.9],[pos.x+1.9,y+11,pos.z+1.9],'pillar')});
 };
 // Colonnades round the plinth: 11 m columns about 20 m apart, the scale that makes the statue read huge.
 for(let x=-215;x<=215;x+=20)pillar(x,80,206,0,1,0);
 for(const side of [-1,1])for(let z=-120;z<=180;z+=24)pillar(side*226,80,z,side,0,0);
 // The knee, the forearms and the hands, from the sculpt's own flat tops; then the bridge.
 for(const [x,y,z,nx,nz,level] of WARDEN_SPOTS)pillar(x,y,z,nx,nz,level,4,true);
 for(let x=-164;x<=100;x+=18)pillar(x,308,186,0,1,1,4,true);
 const ring=[[-36,-36],[-12,-36],[12,-36],[36,-36],[36,-12],[36,12],[36,36],[12,36],[-12,36],[-36,36],[-36,12],[-36,-12]];
 for(const [x,,z] of SHOULDERS)for(const [dx,dz] of ring){
  const corner=Math.abs(dx)===36&&Math.abs(dz)===36;
  pillar(x+dx,530,z+dz,corner||Math.abs(dx)===36?Math.sign(dx):0,corner||Math.abs(dz)===36?Math.sign(dz):0,3,10,true);
 }
 for(let i=0;i<8;i++){const t=i/8*Math.PI*2;pillar(CROWN.x+Math.sin(t)*15,CROWN.y,CROWN.z+Math.cos(t)*15,Math.sin(t),Math.cos(t),4,3,true);}
 const pillarMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6,1.9,11,10).translate(0,5.5,0),materials.pillar,pillars.length);
 const pillarMatrix=i=>{const pl=pillars[i];p.copy(pl.pos);q.identity();s.setScalar(pl.hp>0?1:0);return m.compose(p,q,s);};
 pillars.forEach((pl,i)=>{pillarMesh.setMatrixAt(i,pillarMatrix(i));pillarMesh.setColorAt(i,pl.timber?POST:COLUMN);});
 pillarMesh.name='Cover columns and posts';

 // The rubble plugging the crater, and what shows when it breaks: a burning floor 130 m down
 // and a column of heat standing out of the street.
 const sealColliders=block([PIT.x0,-14,PIT.z0],[PIT.x1,3,PIT.z1],{group:'seal',tint:new THREE.Color(0x6a6052),rough:5,kind:'seal'});
 const pitFloor=new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1-PIT.x0,PIT.z1-PIT.z0).rotateX(-Math.PI/2).translate((PIT.x0+PIT.x1)/2,PIT.floor+.5,(PIT.z0+PIT.z1)/2),materials.pit);
 pitFloor.name='Pit floor';pitFloor.visible=false;
 const column=new THREE.Mesh(new THREE.CylinderGeometry(55,68,520,24,1,true).translate((PIT.x0+PIT.x1)/2,PIT.floor+260,(PIT.z0+PIT.z1)/2),materials.glow);
 column.name='Pit heat column';column.visible=false;column.renderOrder=2;

 const stand=new THREE.Mesh(mergeGeometries(pieces.stand),new THREE.MeshLambertMaterial({color:STONE}));stand.name='The Warden (until the sculpt loads)';
 const works=new THREE.Mesh(mergeGeometries(pieces.built),materials.built);works.name='Creature works';
 const plinth=new THREE.Mesh(mergeGeometries(pieces.stone),materials.stone);plinth.name='Plinth and crater walls';
 const seal=new THREE.Mesh(mergeGeometries(pieces.seal),materials.seal);seal.name='Crater plug';
 const lamps=new THREE.Mesh(mergeGeometries(ember),materials.ember);lamps.name='Doorways';
 const eyeMesh=new THREE.Mesh(mergeGeometries(eyes),materials.eyes);eyeMesh.name='The Warden\'s eyes';
 for(const mesh of [stand,works,plinth,seal,pillarMesh]){mesh.castShadow=true;mesh.receiveShadow=true;}
 root.add(stand,works,plinth,seal,lamps,eyeMesh,pillarMesh,pitFloor,column);
 // The sculpt swaps in when it arrives; shots then test its triangles instead of the boxes.
 let sculpt=null;
 const sculptReady=loadWarden(W).then(found=>{
  found.holder.traverse(o=>o.layers.set(WORLD_LAYER));root.add(found.holder);stand.visible=false;
  for(const c of wardenBoxes)c.noRay=true;sculpt=found;api.onSculpt?.();return true;
 }).catch(()=>false);

 const overPit=(x,z)=>x>PIT.x0&&x<PIT.x1&&z>PIT.z0&&z<PIT.z1;
 const pit={open:false,meshes:[pitFloor,column],
  // The finish: a shell bursting anywhere down the open shaft.
  region:{min:new THREE.Vector3(PIT.x0,PIT.floor-5,PIT.z0),max:new THREE.Vector3(PIT.x1,5,PIT.z1)},
  setOpen(on){
   pit.open=on;seal.visible=!on;pitFloor.visible=on;column.visible=on;
   sealColliders.forEach(c=>c.alive=!on);
  },
  // A shell that bursts on the shaft's rim still counts.
  contains(pt){return pit.open&&pointInBox(pt,pit.region.min,pit.region.max,12);},
  update(time){if(column.visible)materials.glow.opacity=.16+.07*Math.sin(time*2.4);}
 };

 // A flat grid over the colliders, so a ray or a point only tests the boxes near it: the city
 // alone has thousands.
 const CELL=64,ORIGIN=-1600,SPAN=Math.ceil(3200/CELL),cells=Array.from({length:SPAN*SPAN},()=>[]);
 const cellOf=v=>Math.max(0,Math.min(SPAN-1,Math.floor((v-ORIGIN)/CELL)));
 const footprint=c=>c.inv?[c.bound.center.x-c.bound.radius,c.bound.center.x+c.bound.radius,c.bound.center.z-c.bound.radius,c.bound.center.z+c.bound.radius]:[c.min.x,c.max.x,c.min.z,c.max.z];
 colliders.forEach((c,i)=>{
  const [x0,x1,z0,z1]=footprint(c);
  for(let cz=cellOf(z0);cz<=cellOf(z1);cz++)for(let cx=cellOf(x0);cx<=cellOf(x1);cx++)cells[cz*SPAN+cx].push(i);
 });
 const seen=new Uint32Array(colliders.length);let stamp=0;
 function eachNear(x0,x1,z0,z1,fn){
  stamp++;
  for(let cz=cellOf(z0);cz<=cellOf(z1);cz++)for(let cx=cellOf(x0);cx<=cellOf(x1);cx++)for(const i of cells[cz*SPAN+cx]){
   if(seen[i]===stamp)continue;seen[i]=stamp;const c=colliders[i];if(c.alive&&fn(c,i))return c;
  }
  return null;
 }
 // Nearest box along a ray, walking the grid cells the ray crosses in order.
 function rayHit(origin,dir,far){
  stamp++;let best=far,index=-1;
  let cx=cellOf(origin.x),cz=cellOf(origin.z);
  const sx=dir.x>0?1:-1,sz=dir.z>0?1:-1;
  const dX=dir.x?CELL/Math.abs(dir.x):Infinity,dZ=dir.z?CELL/Math.abs(dir.z):Infinity;
  let tX=dir.x?((ORIGIN+(cx+(dir.x>0?1:0))*CELL)-origin.x)/dir.x:Infinity,tZ=dir.z?((ORIGIN+(cz+(dir.z>0?1:0))*CELL)-origin.z)/dir.z:Infinity;
  let t=0;
  while(t<=best){
   for(const i of cells[cz*SPAN+cx]){
    if(seen[i]===stamp)continue;seen[i]=stamp;const c=colliders[i];if(!c.alive||c.noRay)continue;
    const hit=colliderRay(c,origin,dir,best);if(hit<best){best=hit;index=i;}
   }
   if(tX<tZ){t=tX;tX+=dX;cx+=sx;}else{t=tZ;tZ+=dZ;cz+=sz;}
   if(!Number.isFinite(t)||cx<0||cx>=SPAN||cz<0||cz>=SPAN)break;
  }
  // The sculpt's own triangles, once it has loaded.
  if(sculpt){const t=sculpt.ray(origin,dir,best);if(t<best){best=t;index=wardenIndex;}}
  return {t:best,index};
 }
 const wardenIndex=colliders.indexOf(wardenBoxes[0]);

 root.traverse(o=>o.layers.set(WORLD_LAYER));
 const api={
  root,colliders,sculptReady,pillars,rooftops,towers,materials,pit,overPit,rayHit,
  pointHit:(pt,pad=0)=>eachNear(pt.x-pad,pt.x+pad,pt.z-pad,pt.z+pad,c=>colliderHas(c,pt,pad)),
  // Every live box whose footprint comes within pad metres of a point.
  collidersNear(pt,pad){const out=[];eachNear(pt.x-pad,pt.x+pad,pt.z-pad,pt.z+pad,c=>{out.push(c);return false;});return out;},
  // The highest roof or stone within pad metres of a spot: the pilot's floor for an orbit.
  topNear(x,z,pad){let top=0;eachNear(x-pad,x+pad,z-pad,z+pad,c=>{
   const [x0,x1,z0,z1]=footprint(c);if(x>x0-pad&&x<x1+pad&&z>z0-pad&&z<z1+pad)top=Math.max(top,c.inv?c.bound.center.y+c.bound.radius:c.max.y);return false;});return top;},
  // Things that give off light: the thermal sensor shows them burning white, not as stone.
  glowing:[pitFloor,column,eyeMesh],
  damagePillar(index,amount){
   const pl=pillars[index];if(!pl||pl.hp<=0)return false;
   pl.hp-=amount;if(pl.hp>0)return false;
   pl.collider.alive=false;pillarMesh.setMatrixAt(index,pillarMatrix(index));pillarMesh.instanceMatrix.needsUpdate=true;return true;
  },
  restorePillars(){pillars.forEach((pl,i)=>{if(pl.hp<=0){pl.hp=260;pl.collider.alive=true;pillarMesh.setMatrixAt(i,pillarMatrix(i));}});pillarMesh.instanceMatrix.needsUpdate=true;},
  stats(){return {...city.stats,colliders:colliders.length,pillars:pillars.length,pillarsStanding:pillars.filter(p=>p.hp>0).length,
   wardenTriangles:sculpt?sculpt.triangles:stand.geometry.index.count/3,wardenBoxes:wardenBoxes.length,worksTriangles:works.geometry.getAttribute('position').count/3};}
 };
 return api;
}

// Ray against an axis-aligned box; returns the entry distance or Infinity. A ray parallel to
// a face is tested on its own (0 times infinity is NaN), and a graze along an edge is a miss.
export function rayBox(origin,dir,min,max,far=Infinity){
 let t0=0,t1=far;
 for(const k of ['x','y','z']){
  if(dir[k]===0){if(origin[k]<=min[k]||origin[k]>=max[k])return Infinity;continue;}
  const inv=1/dir[k];let a=(min[k]-origin[k])*inv,b=(max[k]-origin[k])*inv;
  if(a>b)[a,b]=[b,a];
  t0=Math.max(t0,a);t1=Math.min(t1,b);if(t1<=t0)return Infinity;
 }
 return t0;
}
export function pointInBox(pt,min,max,pad=0){
 return pt.x>min.x-pad&&pt.x<max.x+pad&&pt.y>min.y-pad&&pt.y<max.y+pad&&pt.z>min.z-pad&&pt.z<max.z+pad;
}
