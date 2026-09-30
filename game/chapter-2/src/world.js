import * as THREE from '../../vendor/three.module.js?v=052';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js?v=052';
import {createCity} from './city.js?v=ch2-08';

// Chapter 2: downtown New York after the Warden, a swordsman about 620 m tall kneeling on one
// knee, came up through it. The city is in city.js; the statue is built here from rough-cut
// stone at full size, standing free on the rock it rose with, and the crater it climbed out of
// opens behind it. The creatures' own works (bridges, towers, balconies) are timber brown so
// they read apart from the carving. Units are metres at real scale: columns 11 m, creatures 2 to
// 6.5 m, the Satoshi a 15 m span. North is -Z, and the Warden faces south down the avenue.
export const BOWL_RADIUS=1100,CEILING=900,WARDEN=Object.freeze({x:0,z:0});
export const LEVELS=Object.freeze([
 {name:'Feet galleries',y:80},{name:'Knee bridges',y:308},{name:'Chest halls',y:400},
 {name:'Shoulder towers',y:540},{name:'The crown',y:612}
]);
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
  pillar:new THREE.MeshLambertMaterial({color:0x8a7d64}),
  ember:new THREE.MeshBasicMaterial({color:0x2e2823}),
  seal:new THREE.MeshLambertMaterial({color:0x5e554a}),
  pit:new THREE.MeshBasicMaterial({color:0xffa040}),
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
 // Nothing is built on the plaza round the statue, over the crater, or on the grand avenue south.
 const cleared=(x,z)=>Math.hypot(x-WARDEN.x,z-WARDEN.z)<230||(x>PIT.x0-45&&x<PIT.x1+45&&z>PIT.z0-45&&z<PIT.z1+45)||(Math.abs(x)<34&&z>0);
 const city=createCity(root,{addCollider,random,exclude:cleared});
 const {rooftops}=city,towers=city.meshes;

 // ---- The Warden. Every piece is a rough-cut block from a to b whose collider follows it.
 const W=WARDEN,at=(x,y,z)=>new THREE.Vector3(W.x+x,y,W.z+z);
 const pieces={stone:[],built:[],seal:[]},ember=[];
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
 // Plinth; its top is the feet galleries, and lit arches run along its face.
 block([-215,0,-150],[215,80,205],{rough:3});
 for(let x=-180;x<=180;x+=40)glowSlit(9,20,x,34,205.8);
 for(const side of [-1,1])for(let z=-100;z<=160;z+=52)glowSlit(9,20,side*215.8,34,z,Math.PI/2);

 // Legs. Left leg raised with the foot planted forward; the right knee down on the plinth.
 block([45,80,70],[125,112,190]);                                       // left foot
 hewn(at(85,108,120),at(85,285,112),[56,60],[64,66],{sides:8});          // left shin
 block([48,278,78],[122,304,160]);                                      // left knee: the bridge rests on it
 hewn(at(85,280,105),at(78,262,-40),[70,70],[88,84],{sides:8});          // left thigh
 block([-122,80,40],[-48,128,110]);                                     // right knee on the ground
 block([-110,80,-150],[-60,140,-112]);                                  // right foot, toes dug into the rock
 hewn(at(-85,104,55),at(-85,100,-120),[54,46],[44,40],{sides:8});        // right shin, lying back
 hewn(at(-85,118,78),at(-78,262,-35),[72,72],[88,86],{sides:8});         // right thigh
 hewn(at(0,238,-35),at(0,305,-35),[235,110],[225,110]);                 // pelvis
 hewn(at(0,300,-35),at(0,392,-30),[205,112],[240,122]);                 // belly
 // Chest, with the halls cut across its front between a floor at 400 and a roof at 440.
 block([-135,390,-95],[135,500,0]);block([-135,390,0],[135,400,42]);block([-135,440,0],[135,500,42]);
 block([-135,400,0],[-125,440,42]);block([125,400,0],[135,440,42]);
 for(let x=-105;x<=105;x+=15)glowSlit(2,3,x,420,.9);
 block([-172,478,-92],[172,512,10]);                                    // shoulders
 for(const side of [-1,1]){
  hewn(at(side*158,492,-35),at(side*182,398,70),[62,62],[52,52],{sides:8});// upper arm
  hewn(at(side*182,400,72),at(side*32,352,176),[50,50],[42,42],{sides:8}); // forearm
  block(side<0?[-50,332,156]:[12,332,156],side<0?[-12,380,198]:[50,380,198]);// fist on the pommel
 }
 block([-42,505,-78],[42,545,-5]);                                      // neck
 hewn(at(0,538,-32),at(0,612,-32),[76,86],[70,80],{collide:1,rough:1.5});// head
 block([-30,560,6],[30,586,16],{rough:1});                              // brow and face plate
 for(const side of [-1,1])glowSlit(15,3.5,side*16,575,16.8);             // the eyes
 // The sword, point down in front of the knees, both hands on the pommel.
 hewn(at(0,80,178),at(0,300,178),[30,8],[42,11],{rough:.8});            // blade
 block([-78,300,168],[78,316,188],{rough:1});                           // cross guard
 block([-7,316,171],[7,346,185],{rough:.5});block([-14,346,164],[14,372,192],{rough:1});// grip, pommel
 // The crown: a band of eight stones round the head, each carrying a spike.
 const crownAt=(i,r)=>{const t=i/8*Math.PI*2+Math.PI/8;return at(Math.sin(t)*r,0,-32+Math.cos(t)*r);};
 for(let i=0;i<8;i++){
  const a=crownAt(i,46).setY(606),b=crownAt(i+1,46).setY(606);
  hewn(a,b,[10,14],[10,14],{segments:1,collide:1,rough:1});
  const tall=40+(Math.cos(i/8*Math.PI*2+Math.PI/8)+1)*18;// tallest over the brow
  hewn(crownAt(i,46).setY(600),crownAt(i,53).setY(612+tall),[12,12],[3,3],{segments:2,rough:1});
 }

 // Their works: a bridge across the knees on posts and a scaffold, balconies round two towers.
 const builtOpts={group:'built',tint:BUILT,rough:1};
 block([-182,304,142],[128,308,204],builtOpts);                        // knee bridge deck
 block([-180,80,150],[-160,304,172],builtOpts);                        // scaffold under its west end
 for(const x of [-110,-40,36])block([x-1,80,152],[x+1,304,154],builtOpts);
 for(const side of [-1,1]){
  const x=side*150;
  hewn(at(x,512,-40),at(x,600,-40),[34,34],[28,28],{...builtOpts,segments:2});// shoulder tower
  hewn(at(x,600,-40),at(x,634,-40),[30,30],[4,4],{...builtOpts,segments:1,collide:1});
  block([x-44,537,-84],[x+44,540,4],builtOpts);                          // balcony
  for(const y of [552,568,584]){const r=17.6-3*(y-512)/88;for(const [dx,dz,ry] of [[0,r,0],[0,-r,Math.PI],[r,0,Math.PI/2],[-r,0,-Math.PI/2]])glowSlit(2.2,3.6,x+dx,y,-40+dz,ry);}
 }

 // Ledges: where creatures stand. Pillars along each front edge give them cover; `normal`
 // points out of the ledge, and creatures stay within `inward` metres behind their pillar
 // and 6 in front of it.
 const pillars=[];
 const pillar=(x,y,z,nx,nz,level,inward=10)=>{
  const pos=at(x,y,z);
  pillars.push({pos,level,inward,normal:new THREE.Vector3(nx,0,nz).normalize(),hp:260,collider:addCollider([pos.x-1.9,y,pos.z-1.9],[pos.x+1.9,y+11,pos.z+1.9],'pillar')});
 };
 // Colonnades: 11 m columns about 16 to 22 m apart, the scale that makes the statue read as huge.
 for(let x=-195;x<=195;x+=20)if(x<42||x>128)pillar(x,80,196,0,1,0);// none in front of the planted foot
 for(const side of [-1,1])for(let z=-110;z<=110;z+=22)pillar(side*200,80,z,side,0,0);
 for(let x=-172;x<=118;x+=16)pillar(x,308,194,0,1,1,4);// the cross guard stands just behind
 for(let i=0;i<=14;i++)pillar(-110+i*220/14,400,30,0,1,2);
 const ring=[[-36,-36],[-12,-36],[12,-36],[36,-36],[36,-12],[36,12],[36,36],[12,36],[-12,36],[-36,36],[-36,12],[-36,-12]];
 for(const side of [-1,1])for(const [dx,dz] of ring){
  const corner=Math.abs(dx)===36&&Math.abs(dz)===36;
  pillar(side*150+dx,540,-40+dz,corner||Math.abs(dx)===36?Math.sign(dx):0,corner||Math.abs(dz)===36?Math.sign(dz):0,3);
 }
 for(let i=0;i<8;i++){const t=i/8*Math.PI*2;pillar(Math.sin(t)*24,612,-32+Math.cos(t)*24,Math.sin(t),Math.cos(t),4);}
 const pillarMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6,1.9,11,10).translate(0,5.5,0),materials.pillar,pillars.length);
 const pillarMatrix=i=>{const pl=pillars[i];p.copy(pl.pos);q.identity();s.setScalar(pl.hp>0?1:0);return m.compose(p,q,s);};
 pillars.forEach((_,i)=>pillarMesh.setMatrixAt(i,pillarMatrix(i)));
 pillarMesh.name='Cover pillars';

 // The rubble plugging the crater, and what shows when it breaks: a burning floor 130 m down
 // and a column of heat standing out of the street.
 const sealColliders=block([PIT.x0,-14,PIT.z0],[PIT.x1,3,PIT.z1],{group:'seal',tint:new THREE.Color(0x6a6052),rough:5,kind:'seal'});
 const pitFloor=new THREE.Mesh(new THREE.PlaneGeometry(PIT.x1-PIT.x0,PIT.z1-PIT.z0).rotateX(-Math.PI/2).translate((PIT.x0+PIT.x1)/2,PIT.floor+.5,(PIT.z0+PIT.z1)/2),materials.pit);
 pitFloor.name='Pit floor';pitFloor.visible=false;
 const column=new THREE.Mesh(new THREE.CylinderGeometry(55,68,520,24,1,true).translate((PIT.x0+PIT.x1)/2,PIT.floor+260,(PIT.z0+PIT.z1)/2),materials.glow);
 column.name='Pit heat column';column.visible=false;column.renderOrder=2;

 const warden=new THREE.Mesh(mergeGeometries(pieces.stone),materials.stone);warden.name='The Warden (blockout)';
 const works=new THREE.Mesh(mergeGeometries(pieces.built),materials.built);works.name='Creature works';
 const seal=new THREE.Mesh(mergeGeometries(pieces.seal),materials.seal);seal.name='Crater plug';
 const lamps=new THREE.Mesh(mergeGeometries(ember),materials.ember);lamps.name='Doorways';
 for(const mesh of [warden,works,seal,pillarMesh]){mesh.castShadow=true;mesh.receiveShadow=true;}
 root.add(warden,works,seal,lamps,pillarMesh,pitFloor,column);

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
    if(seen[i]===stamp)continue;seen[i]=stamp;const c=colliders[i];if(!c.alive)continue;
    const hit=colliderRay(c,origin,dir,best);if(hit<best){best=hit;index=i;}
   }
   if(tX<tZ){t=tX;tX+=dX;cx+=sx;}else{t=tZ;tZ+=dZ;cz+=sz;}
   if(!Number.isFinite(t)||cx<0||cx>=SPAN||cz<0||cz>=SPAN)break;
  }
  return {t:best,index};
 }

 root.traverse(o=>o.layers.set(WORLD_LAYER));
 return {
  root,colliders,pillars,rooftops,towers,materials,pit,overPit,rayHit,
  pointHit:(pt,pad=0)=>eachNear(pt.x-pad,pt.x+pad,pt.z-pad,pt.z+pad,c=>colliderHas(c,pt,pad)),
  // Every live box whose footprint comes within pad metres of a point.
  collidersNear(pt,pad){const out=[];eachNear(pt.x-pad,pt.x+pad,pt.z-pad,pt.z+pad,c=>{out.push(c);return false;});return out;},
  // The highest roof or stone within pad metres of a spot: the pilot's floor for an orbit.
  topNear(x,z,pad){let top=0;eachNear(x-pad,x+pad,z-pad,z+pad,c=>{
   const [x0,x1,z0,z1]=footprint(c);if(x>x0-pad&&x<x1+pad&&z>z0-pad&&z<z1+pad)top=Math.max(top,c.inv?c.bound.center.y+c.bound.radius:c.max.y);return false;});return top;},
  // Things that give off light: the thermal sensor shows them burning white, not as stone.
  glowing:[pitFloor,column],
  damagePillar(index,amount){
   const pl=pillars[index];if(!pl||pl.hp<=0)return false;
   pl.hp-=amount;if(pl.hp>0)return false;
   pl.collider.alive=false;pillarMesh.setMatrixAt(index,pillarMatrix(index));pillarMesh.instanceMatrix.needsUpdate=true;return true;
  },
  restorePillars(){pillars.forEach((pl,i)=>{if(pl.hp<=0){pl.hp=260;pl.collider.alive=true;pillarMesh.setMatrixAt(i,pillarMatrix(i));}});pillarMesh.instanceMatrix.needsUpdate=true;},
  stats(){return {...city.stats,colliders:colliders.length,pillars:pillars.length,pillarsStanding:pillars.filter(p=>p.hp>0).length,
   wardenTriangles:warden.geometry.getAttribute('position').count/3,worksTriangles:works.geometry.getAttribute('position').count/3};}
 };
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
