import * as THREE from '../vendor/three.module.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

// Original Roman architectural fragments exposed by the canyon, never a
// replacement for its accepted geology. Static, opaque, spatially batched.
// Both APIs drain the same deterministic construction. The async caller owns
// deadline/context checks; a rejected checkpoint prevents all later work.
export function createRomanRuins(options){
 const work=buildRomanRuins(options);let next;do{next=work.next();}while(!next.done);return next.value;
}
export async function createRomanRuinsAsync(options,{checkpoint=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(typeof checkpoint!=='function')throw TypeError('Roman ruins preparation requires a checkpoint');
 const work=buildRomanRuins(options);
 try{
  await checkpoint({stage:'begin',siteId:-1,raySamples:0,pieces:0});
  for(let next=work.next();;next=work.next()){
   if(next.done)return next.value;
   await checkpoint(next.value);
  }
 }finally{work.return();}
}
function* buildRomanRuins({scene,world,eggNests,centerAt,widthAt}) {
 const root=new THREE.Group();root.name='Buried Roman cliff city';scene.add(root);
 const sites=[],caves=[],collisionMeshes=[],ray=new THREE.Raycaster();
 let siteId=-1,raySamples=0,builtPieces=0;
 const progress=stage=>({stage,siteId,raySamples,pieces:builtPieces});
 const banks=world.collisionMeshes.filter(m=>m.name.startsWith('bank-'));
 world.root.updateMatrixWorld(true);
 const scannedFaces=world.collisionMeshes.filter(m=>m.name.startsWith('Scanned embedded cliff face')).map(m=>new THREE.Box3().setFromObject(m));
 const hazards=[];for(const m of world.root.children)if(m.name.startsWith('Hot crust intrusion')||m.name.startsWith('Wall-seated molten cascade')||m===world.lava)hazards.push(new THREE.Box3().setFromObject(m));
 let seed=12037;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const limestone=new THREE.MeshStandardMaterial({color:0x4c3b2c,roughness:.94,vertexColors:true});
 const brick=new THREE.MeshStandardMaterial({color:0x3b2c22,roughness:1,vertexColors:true});
 const inner=new THREE.MeshStandardMaterial({color:0x211a15,roughness:1,vertexColors:true});
 const caveDark=new THREE.MeshBasicMaterial({color:0x000000,fog:false,toneMapped:false,side:THREE.DoubleSide});
 for(const mat of [limestone,brick,inner]){
  mat.onBeforeCompile=s=>{
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoman;');
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoman=position;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vRoman;
float rh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float rn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(rh(i),rh(i+vec3(1,0,0)),f.x),mix(rh(i+vec3(0,1,0)),rh(i+vec3(1,1,0)),f.x),f.y),mix(mix(rh(i+vec3(0,0,1)),rh(i+vec3(1,0,1)),f.x),mix(rh(i+vec3(0,1,1)),rh(i+vec3(1,1,1)),f.x),f.y),f.z);}`);
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float pores=rh(floor(vRoman*24.));float weather=rn(vRoman*.42);
float seam=abs(sin(vRoman.x*1.8+vRoman.y*.7+rn(vRoman*1.1)*3.8));
float scar=(1.-smoothstep(.009,.032,seam))*smoothstep(.54,.78,weather);
float streak=rn(vec3(vRoman.x*1.5,vRoman.y*.095,vRoman.z*.43));
diffuseColor.rgb*=mix(.34,.89,weather)*(.84+.16*pores)*(1.-scar*.72)*mix(.48,.92,smoothstep(.25,.7,streak));`);
  };mat.customProgramCacheKey=()=> 'eroded-roman-ochre-2';
 }
 const square=new THREE.Shape();square.moveTo(-.5,-.5);square.lineTo(.5,-.5);square.lineTo(.5,.5);square.lineTo(-.5,.5);square.closePath();
 const cube=new THREE.ExtrudeGeometry(square,{depth:.93,bevelEnabled:true,bevelSize:.065,bevelThickness:.035,bevelSegments:1,steps:1}).translate(0,0,-.465);
 function archStone(innerR,outerR,a,b,depth){
  const shape=new THREE.Shape(),steps=4;shape.moveTo(Math.cos(a)*innerR,Math.sin(a)*innerR);
  for(let j=1;j<=steps;j++){const t=a+(b-a)*j/steps;shape.lineTo(Math.cos(t)*innerR,Math.sin(t)*innerR);}
  for(let j=steps;j>=0;j--){const t=a+(b-a)*j/steps;shape.lineTo(Math.cos(t)*outerR,Math.sin(t)*outerR);}shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:depth-.1,bevelEnabled:true,bevelSize:.045,bevelThickness:.05,bevelSegments:1,curveSegments:4,steps:1}).translate(0,0,-depth+.05);
 }
 function shaft(height,phase,broken){
  const g=new THREE.CylinderGeometry(.86,.87,height,48,6),a=g.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),y=a.getY(i),ang=Math.atan2(z,x),r=Math.hypot(x,z);if(r>.1){const flute=1-.055*(1+Math.cos(ang*16));const top=broken?THREE.MathUtils.smoothstep(y,height*.32,height*.5):0;a.setXYZ(i,x*flute,y+top*(.44*Math.sin(ang*5+phase)+.21*Math.sin(ang*9)),z*flute);}}
  g.computeVertexNormals();return g;
 }
 // Searches may reject every site: checkpoint ray work itself, not only sites.
 function* rock(side,y,z,cx){
  ray.set(V(cx,y,z),V(side,0,0));ray.far=480;const hit=ray.intersectObjects(banks,false)[0]||null;
  if(++raySamples%16===0)yield progress('support');return hit;
 }
 const proposals=[{p:.065,side:-1,kind:0},{p:.205,side:1,kind:1},{p:.345,side:-1,kind:2},{p:.485,side:1,kind:0},{p:.625,side:-1,kind:1},{p:.775,side:1,kind:2},{p:.91,side:-1,kind:0},{p:.125,side:1,kind:3},{p:.303,side:-1,kind:3},{p:.415,side:1,kind:3},{p:.555,side:-1,kind:3},{p:.705,side:1,kind:3},{p:.855,side:-1,kind:3}];
 for(const [id,proposal] of proposals.entries()){
  siteId=id;
  const {side,kind}=proposal,width=kind===0?29:kind===1?23:kind===3?9:21,height=kind===1?22:kind===3?15:18;let p=proposal.p,c=centerAt(p);
  let chosen=null;
  for(const offset of [0,.018,-.018,.035,-.035,.05]){
  if(chosen)break;p=THREE.MathUtils.clamp(proposal.p+offset,.035,.955);c=centerAt(p);
  for(const y of [43+(id%3)*10,78,95,58,112]){
   const xs=kind===3?Array.from({length:13},(_,i)=>-width/2+i*width/12):[-width/2,0,width/2],ys=kind===3?Array.from({length:16},(_,i)=>i*height/15):[0,height/2,height];
   const hits=[];for(const dx of xs)for(const dy of ys){const h=yield* rock(side,y+dy,c.z+side*dx,c.x);if(h)hits.push(h);}
   if(hits.length!==xs.length*ys.length)continue;
   const near=Math.min(...hits.map(h=>side*(h.point.x-c.x))),far=Math.max(...hits.map(h=>side*(h.point.x-c.x)));
   if(far-near>27||near<widthAt(p)+8)continue;
   const origin=V(c.x+side*(near-3.0),y,c.z),quat=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),-side*Math.PI/2);
   if(kind===3){
    // Bank support alone can sit behind a separate basalt outcrop. Require
    // an exposed column face against the complete accepted solid world.
    const h=[4.4,7.2,10.3,5.8,3.1,8.5][id-7],x=id%2?-.65:.55;
    let exposed=true;for(const yy of [.9,h*.45,h*.85]){
     ray.set(V(origin.x-side*12,origin.y+yy,origin.z+side*x),V(side,0,0));ray.far=14;
     const obstruction=ray.intersectObjects(world.collisionMeshes,false)[0];
     if(++raySamples%16===0)yield progress('support');
     if(obstruction&&obstruction.distance<11){exposed=false;break;}
    }if(!exposed)continue;
   }
   const box=new THREE.Box3(V(-width/2-5,-9,-(far-near+12)),V(width/2+5,height+4,4)).applyMatrix4(new THREE.Matrix4().compose(origin,quat,V(1,1,1)));
   if(kind===3&&scannedFaces.some(b=>b.intersectsBox(box.clone().expandByScalar(4))))continue;
   const eggClearance=Math.min(...eggNests.eggs.map(e=>box.distanceToPoint(e.center)-e.length));
   const heatClearance=Math.min(...hazards.map(b=>{const dx=Math.max(0,b.min.x-box.max.x,box.min.x-b.max.x),dy=Math.max(0,b.min.y-box.max.y,box.min.y-b.max.y),dz=Math.max(0,b.min.z-box.max.z,box.min.z-b.max.z);return Math.hypot(dx,dy,dz);}));
   if(eggClearance<9||heatClearance<5||sites.some(s=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,s.bounds.min[k]-box.max[k],box.min[k]-s.bounds.max[k])))<12))continue;
   chosen={origin,quat,box,eggClearance,heatClearance,near,far};break;
  }}
  if(!chosen){yield progress('site');continue;}
  const {origin,quat}=chosen,group=new THREE.Group();group.name=`Roman ruin ${id}: ${['buried arcade','broken sanctuary','aqueduct remnant','isolated column fragment'][kind]}`;group.position.copy(origin);group.quaternion.copy(quat);root.add(group);
  const batches=[[],[],[],[],[]],anchors=[];let pieces=0;
  function* put(geometry,pos,scale=[1,1,1],rotation=[0,0,0],material=0){
   let g=geometry.index?geometry.toNonIndexed():geometry.clone();g.deleteAttribute('uv');g.deleteAttribute('color');
   g.scale(...scale);if(geometry===cube){const a=g.attributes.position,k=pieces*.37;for(let j=0;j<a.count;j++){const x=a.getX(j),y=a.getY(j),z=a.getZ(j),chip=.16*Math.sin(x*2.1+y*3.7+z*.85+k);a.setXYZ(j,x+chip,y+chip*.8,z+chip*.5);}g.computeVertexNormals();}g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));g.translate(...pos);
   const tint=.55+random()*.44,col=new THREE.Color().setRGB(tint,tint*(.97+random()*.04),tint*(.93+random()*.07)),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<g.attributes.position.count;i++)col.toArray(colors,i*3);g.setAttribute('color',new THREE.BufferAttribute(colors,3));batches[material].push(g);pieces++;
   // Preserve every piece and random draw while bounding geometry work per gap.
   if(++builtPieces%8===0)yield progress('masonry');
  }
  function* block(x,y,z,w,h,d,material=0,rot=[0,0,0]){yield* put(cube,[x,y,z],[w,h,d],rot,material);}
  function* depthAt(x,y){const hit=yield* rock(side,origin.y+y,origin.z+side*x,c.x);if(!hit)return 5;const local=hit.point.clone().sub(origin).applyQuaternion(quat.clone().invert());anchors.push({point:hit.point.toArray(),surface:hit.object.name});return Math.max(2,-local.z+.65);}
  // Back ends of foundation/pier courses overlap the actual rock face.
  for(let row=0;row<3;row++)for(let x=-width/2+1.25;x<width/2;x+=2.5){const yy=-2.1+row*.8,d=yield* depthAt(x,yy);yield* block(x,yy,-d/2+.45,2.44,.74,d+.9,row===0?2:0);}
  function* pier(x,h){for(let y=.7;y<h;y+=1.25){const d=yield* depthAt(x,y);yield* block(x+(random()-.5)*.065,y,-d/2,2.15,1.19,d,0);}yield* block(x,h-.25,.12,2.7,.50,2.9);}
  function* arch(x,spring,r,broken=false){
   for(let j=0;j<13;j++){
    // A missing run at the haunch exposes brick vault rings behind it.
    if(broken&&j<=6)continue;
    const a=j*Math.PI/13+.012,b=(j+1)*Math.PI/13-.012;
    const g=archStone(r,r+1.05,a,b,2.7);yield* put(g,[x,spring,.55]);g.dispose();
   }
   // Cut each spandrel course against the arch extrados. Its weight now
   // bears on the arch and piers; no floating rectangular upper wall.
   const outer=r+1.07;
   for(let row=0;row<4;row++)for(let k=0;k<4;k++){
    if(broken&&k>=2)continue;
    const left=-outer+k*outer/2+.025,right=left+outer/2-.05,low=row*1.12,high=low+1.06;
    const pts=[];for(let j=0;j<=16;j++){const xx=left+(right-left)*j/16,yy=Math.max(low,Math.sqrt(Math.max(0,outer*outer-xx*xx))+.025);pts.push([xx,Math.min(high,yy)]);}
    if(pts.every(a=>a[1]>=high-.02))continue;
    const sh=new THREE.Shape();sh.moveTo(left,high);sh.lineTo(right,high);for(const a of pts.slice().reverse())sh.lineTo(...a);sh.closePath();
    const d=yield* depthAt(x+(left+right)/2,spring+high),g=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false,steps:1}).translate(0,0,-d);
    yield* put(g,[x,spring,.02],[1,1,1],[0,0,0],row%3===0?1:0);g.dispose();
   }
   for(let band=0;band<4;band++)for(let j=0;j<17;j++){
    if(broken&&j<9)continue;
    const g=archStone(r+.05,r+.54,j*Math.PI/17+.009,(j+1)*Math.PI/17-.009,.58);yield* put(g,[x,spring,-2.2-band*.61],[1,1,1],[0,0,0],1);g.dispose();
   }
   // The opaque black chamber sits ahead of the uncut bank, recessed behind
   // the stone mouth. It remains dark under lava fill, fog and exposure.
   const mouth=new THREE.Shape();mouth.moveTo(-r,-.35);mouth.lineTo(r,-.35);mouth.lineTo(r,spring);
   for(let j=1;j<=24;j++){const a=j*Math.PI/24;mouth.lineTo(Math.cos(a)*r,spring+Math.sin(a)*r);}mouth.closePath();
   const darkGeo=new THREE.ShapeGeometry(mouth);yield* put(darkGeo,[x,0,-1.55],[1,1,1],[0,0,0],4);darkGeo.dispose();
   for(const side of [-1,1])yield* block(x+side*(r+.10),spring*.5,-.48,.30,spring,2.0,2);
   caves.push({site:id,center:V(x,spring*.62,-1.55).applyQuaternion(quat).add(origin),radius:r,spring,material:caveDark});
   for(let j=0;j<9;j++){const xx=x+(random()-.5)*r*1.6;yield* block(xx,.1+random()*.5,-1-random()*2.7,.6+random(),.5+random()*.5,.65+random(),j%3===0?1:0,[random()*.3,random(),random()*.3]);}
  }
  function* crown(start,base,columns,rows,step=2.5){
   for(let k=0;k<columns;k++){
    const count=Math.max(1,Math.floor(rows*(.28+.72*random())-k*.13));
    for(let row=0;row<count;row++){
     const x=start+k*step,y=base+row*1.14,d=yield* depthAt(x,y);
     yield* block(x,y,-d/2-.12,step-.12,.96+random()*.14,d,k%4===0?1:0,[0,0,row===count-1?(random()-.5)*.09:0]);
    }
   }
  }
  if(kind===0){
   for(const x of [-12,-4,4,12])yield* pier(x,7.15+(x===12?-2:0));
   for(const [j,x] of [-8,0,8].entries())yield* arch(x,6.7,2.95,j===2);
   yield* crown(-12,11.08,8,3);
   // Only the short, supported end of the old entablature survives.

  }else if(kind===1){
   yield* pier(-4.6,8.4);yield* pier(4.6,8.4);yield* arch(0,8,3.5,false);
   for(const [i,x] of [-9,-6.4,6.4,9].entries()){
    yield* block(x,.25,.2,2.5,.65,2.5);yield* put(new THREE.CylinderGeometry(1.08,1.2,.35,24),[x,.76,.2]);
    const h=[8.7,3.6,6.4,2.4][i];let base=.93;
    for(let d=0;d<Math.ceil(h/2.35);d++){const dh=Math.min(2.30,h-d*2.35);if(dh<=0)break;const g=shaft(dh,i+d,d===Math.ceil(h/2.35)-1);yield* put(g,[x,base+dh/2,.2],[1,1,1],[0,i*.19,i===3?.04:0]);g.dispose();base+=dh+.055;}
    if(i===3)yield* block(x+.8,.40,1.2,1.9,.45,1.7,0,[.2,.6,.22]);
   }
   yield* crown(-7.5,12.86,6,3);
  }else if(kind===2){
   for(const x of [-8,0,8])yield* pier(x,x===8?4.8:7.2);
   yield* arch(-4,6.7,2.95,false);yield* arch(4,6.7,2.95,true);
   yield* crown(-8.4,10.98,5,3);
  }else{
   // A lone sheared column, sometimes accompanied by a pier stump. These
   // little finds share the same ray-seated footing as the larger ruins.
   const x=(id%2?-.65:.55),height=[4.4,7.2,10.3,5.8,3.1,8.5][id-7];
   yield* block(x,.08,.1,2.45,.65,2.45);let base=.44;
   const rings=Math.ceil(height/2.1);
   for(let j=0;j<rings;j++){const h=height/rings-.05,g=shaft(h,id+j,j===rings-1);yield* put(g,[x+Math.sin(j*.7)*.06,base+h*.5,.2],[1,1,1],[0,id*.31,j===rings-1?.035:0]);g.dispose();base+=h+.06;}
   if(id%2===0){for(let row=0;row<2;row++){const d=yield* depthAt(-2.6,row*1.15+.4);yield* block(-2.6,row*1.15+.4,-d/2,1.9,1.05,d,1);}yield* block(-2.3,2.55,-.2,1.8,.6,1.7,0,[0,.15,-.13]);}
   const fallen=shaft(2.1,id,true);yield* put(fallen,[2.45,.60,-.7],[1,1,1],[.25,.2,Math.PI/2+.12]);fallen.dispose();
  }
  // Fractured masonry embedded along the support toe, not scattered in flight.
  for(let j=0;j<14;j++){const x=(random()-.5)*width,y=-1.8+random()*.6,d=yield* depthAt(x,y);yield* block(x,y,-random()*Math.min(d,3),.6+random()*1.35,.5+random()*.6,.7+random(),j%4===0?1:0,[random()*.5,random()*2,random()*.5]);}
  // Rock shoulders engulf the toe and broken ends of the old city. New
  // chunks reuse the canyon material and overlap actual bank intersections.
  const rockGeo=new THREE.DodecahedronGeometry(1,0);
  for(let j=0;j<(kind===3?9:13);j++){
   const x=j<7?-width/2+j*width/6:(j%2?-1:1)*(width/2-1.0),y=j<7?-3.8+(j%3)*.6:2+(j-7)*2.15;
   const hit=yield* rock(side,origin.y+y,origin.z+side*x,c.x);if(!hit)continue;
   const local=hit.point.clone().sub(origin).applyQuaternion(quat.clone().invert());
   // Front reaches the architectural toe; its larger rear half stays buried.
   const deep=Math.max(3.5,-local.z*.58+2.2);
   yield* put(rockGeo,[x,y,local.z*.5-.8],[j<7?3.4:2.8,j<7?4.2:3.7,deep],[0,0,.14*j],3);
  }
  rockGeo.dispose();
  for(let i=0;i<batches.length;i++)if(batches[i].length){const g=mergeGeometries(batches[i]);g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,[limestone,brick,inner,banks[0].material,caveDark][i]);mesh.name=`Roman cliff masonry ${id}-${i}`;mesh.castShadow=i!==4;mesh.receiveShadow=i!==4;group.add(mesh);collisionMeshes.push(mesh);for(const b of batches[i])b.dispose();yield progress('batch');}
  group.updateMatrixWorld(true);const actualBox=new THREE.Box3().setFromObject(group);
  sites.push({id,p,side,kind,group,center:actualBox.getCenter(V()),bounds:actualBox,anchors,pieces,eggClearance:Math.min(...eggNests.eggs.map(e=>actualBox.distanceToPoint(e.center)-e.length)),heatClearance:Math.min(...hazards.map(b=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,b.min[k]-actualBox.max[k],actualBox.min[k]-b.max[k]))))),front:V(-side,0,0)});
  yield progress('site');
 }
 cube.dispose();root.updateMatrixWorld(true);
 return {root,sites,caves,collisionMeshes,stats:()=>({sites:sites.length,majorSites:sites.filter(s=>s.kind!==3).length,columnFragments:sites.filter(s=>s.kind===3).length,caveMouths:caves.length,pieces:sites.reduce((n,s)=>n+s.pieces,0),drawBatches:collisionMeshes.length,triangles:collisionMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0),minEggClearance:Math.min(...sites.map(s=>s.eggClearance)),minHeatClearance:Math.min(...sites.map(s=>s.heatClearance))})};
}
