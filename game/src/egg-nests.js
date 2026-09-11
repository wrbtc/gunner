import {EGG_SITES,isNestingWidth} from './river-profile.js?v=052';
import * as THREE from '../vendor/three.module.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';
import {createSlicedIteratorPreparation} from './sliced-iterator-preparation.js?v=054-9';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),UP=V(0,1,0),Z=V(0,0,1),clamp=THREE.MathUtils.clamp;
function solid(g){const h=g.index?g.toNonIndexed():g.clone();h.deleteAttribute('uv');h.deleteAttribute('color');return h;}
function ell(p,s){return solid(new THREE.SphereGeometry(1,12,9).scale(...s).translate(...p));}
function bone(a,b,r){const d=V(...b).sub(V(...a)),g=new THREE.CylinderGeometry(r*.76,r,d.length(),9,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,d.normalize()));g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());return solid(g);}
function merge(gs){const g=mergeGeometries(gs);g.computeBoundingSphere();return g;}
function embryoGeometry(stage){
 // One merged, ribbed maggot body per maturity stage. The curled silhouette
 // occupies the existing embryo envelope and is visible through thinner wet
 // membrane patches; it has no human limbs, glowing eyes or extra material.
 const curve=new THREE.CatmullRomCurve3([V(-.6,-1.0,-.1),V(.25,-1.35,.08),V(1.02,-.85,.15),V(.94,.22,-.04),V(.38,1.12,-.13),V(-.55,1.02,.05),V(-.91,.32,.19),V(-.34,-.05,.3)]);
 const segments=40,radial=8,body=new THREE.TubeGeometry(curve,segments,.39,radial,false),position=body.attributes.position;
 const center=V(),offset=V();
 for(let j=0;j<=segments;j++){const t=j/segments;curve.getPointAt(t,center);const taper=(.47+.53*Math.sin(Math.PI*(.08+t*.83)))*(.92+.08*Math.cos(t*Math.PI*26));for(let k=0;k<=radial;k++){const index=j*(radial+1)+k;offset.fromBufferAttribute(position,index).sub(center).multiplyScalar(taper);position.setXYZ(index,center.x+offset.x,center.y+offset.y,center.z+offset.z);}}
 body.computeVertexNormals();
 const head=curve.getPointAt(1),bits=[solid(body),ell(head.toArray(),[.30,.25,.25])];
 for(const side of [-1,1]){const hook=new THREE.CatmullRomCurve3([head.clone().add(V(side*.12,-.10,.16)),head.clone().add(V(side*.19,-.31,.27)),head.clone().add(V(side*.07,-.34,.32))]);bits.push(solid(new THREE.TubeGeometry(hook,6,.035,5,false)));}
 return merge(bits).scale(1.05+stage*.14,1.05+stage*.14,1.05+stage*.14).rotateZ((stage-1)*.22);
}
function eggGeometry(segments=48,rings=36){const g=new THREE.SphereGeometry(1,segments,rings),p=g.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i),t=1+.14*z+.009*Math.sin(p.getY(i)*9+p.getX(i)*7);p.setXYZ(i,p.getX(i)*t,p.getY(i)*t,z);}g.computeVertexNormals();return g;}
let sharedEggNormalMap=null;
function eggNormalMap(){
 if(sharedEggNormalMap)return sharedEggNormalMap;
 const size=256,data=new Uint8Array(size*size*4),heights=new Float32Array(size*size);let seed=813;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=x/size*Math.PI*2,v=y/size*Math.PI*2;heights[y*size+x]=.40+.18*Math.sin(u*3+Math.sin(v*2)*1.3)+.09*Math.sin(v*7+Math.cos(u*4))+.05*(seed/4294967296);}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*2.8,dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*2.8,n=new THREE.Vector3(-dx,-dy,1).normalize();data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;}
 const normalMap=new THREE.DataTexture(data,size,size);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;normalMap.magFilter=THREE.LinearFilter;normalMap.minFilter=THREE.LinearMipmapLinearFilter;normalMap.generateMipmaps=true;normalMap.repeat.set(3,3);normalMap.needsUpdate=true;
 sharedEggNormalMap=normalMap;return normalMap;
}
function shellMaterial(uniforms){
 const normalMap=eggNormalMap();
 const m=new THREE.MeshStandardMaterial({color:0xc1bbaa,roughness:.49,normalMap,normalScale:new THREE.Vector2(.24,.24),transparent:true,depthWrite:false,side:THREE.FrontSide});
 m.onBeforeCompile=s=>{
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=vec3(.8,.4,.12)*max(uEggHit,vEggHit)*(.055+.20*pow(1.-abs(dot(normal,normalize(vViewPosition))),2.));\n#include <opaque_fragment>');
  Object.assign(s.uniforms,uniforms);s.uniforms.uEggHit={value:0};m.userData.shader=s;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEggP;varying float vEggSeed;\n#ifdef USE_INSTANCING\nattribute float eggHit;\n#endif\nvarying float vEggHit;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vEggP=position;
#ifdef USE_INSTANCING
vEggHit=eggHit;
#else
vEggHit=0.;
#endif
#ifdef USE_INSTANCING
vec3 broodOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
#else
vec3 broodOrigin=modelMatrix[3].xyz;
#endif
vEggSeed=fract(dot(broodOrigin,vec3(.131,.077,.019)));`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vEggP;varying float vEggSeed;varying float vEggHit;uniform float uEggHit;uniform float uReveal;
float eh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float en(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(eh(i),eh(i+vec3(1,0,0)),f.x),mix(eh(i+vec3(0,1,0)),eh(i+vec3(1,1,0)),f.x),f.y),mix(mix(eh(i+vec3(0,0,1)),eh(i+vec3(1,0,1)),f.x),mix(eh(i+vec3(0,1,1)),eh(i+vec3(1,1,1)),f.x),f.y),f.z);}`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 broodP=vEggP+vec3(vEggSeed*9.7,vEggSeed*3.1,0.);
float broodMottle=en(broodP*3.8);
float broodRoot=1.-smoothstep(-.82,-.08,vEggP.z);
float broodWrinkle=pow(.5+.5*sin(vEggP.z*31.+en(broodP*4.)*3.),5.);
float broodVein=1.-smoothstep(.019,.070,abs(sin(vEggP.y*13.+broodMottle*5.+vEggSeed*2.)*sin(vEggP.x*16.+vEggP.z*7.)));
vec3 membrane=mix(vec3(.47,.36,.33),vec3(.91,.95,.85),smoothstep(.13,.84,broodMottle));
membrane=mix(membrane,vec3(.22,.11,.075),broodRoot*.58+broodVein*.25);
diffuseColor.rgb*=membrane*(1.-broodWrinkle*.065)*mix(.91,1.,vEggSeed);
float broodThin=smoothstep(.24,.75,broodMottle)*(1.-broodRoot*.72);
float broodRim=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(.55,1.12,broodMottle);');
  // Reveal is driven by actual reflected scene illumination after Three's
  // lights evaluate, not a glowing slit or a scene-transmission render pass.
  s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`float broodLight=dot(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,vec3(.2126,.7152,.0722));
float broodReveal=smoothstep(.10,.62,broodLight)*broodThin*uReveal;
diffuseColor.a=mix(.92,.28,broodReveal);
diffuseColor.a=mix(diffuseColor.a,.96,broodRim*.76+broodRoot*.20);
#include <opaque_fragment>`);
 };m.customProgramCacheKey=()=> 'cliff-egg-vascular-membrane-v050';return m;
}
export function createEggNests({scene,world,centerAt,widthAt,onRupture,audio,hitFeedback,onHit}){
 const root=new THREE.Group();root.name='Cool cliff egg colonies';scene.add(root);
 const eggs=[],clusters=[],hazards=[],ray=new THREE.Raycaster(),tmpM=new THREE.Matrix4();world.root.updateMatrixWorld(true);
 for(const mesh of world.root.children)if(mesh.name.startsWith('Hot crust intrusion')||mesh.name.startsWith('Wall-seated molten cascade')||mesh===world.lava){const box=new THREE.Box3().setFromObject(mesh);hazards.push({name:mesh.name,box});}
 const rocks=world.collisionMeshes.filter(m=>m!==world.lava&&!m.name.startsWith('Hot crust intrusion'));
 // Static world broad phase: unroll rock instances once, then query only
 // intersecting 64m route bins. The same visible triangles remain the narrow phase.
 const collisionBins=new Map(),collisionEntries=[],partCache=new Map();
 // Split large static collision meshes into local 32m triangle batches. Each
 // triangle keeps its exact vertices/winding; batch bounds include its full
 // extent, even when it crosses a cell. No simplified collision surface.
 function* collisionParts(geometry,matrix){
  const worldScale=Math.pow(2,Math.ceil(Math.log2(Math.max(1,new THREE.Vector3().setFromMatrixScale(matrix).length())))),cell=32/worldScale;
  const cacheKey=geometry.uuid+':'+worldScale;
  if(partCache.has(cacheKey))return partCache.get(cacheKey);
  const position=geometry.attributes.position,index=geometry.index,count=index?index.count:position.count;
  if(count<=3072){partCache.set(cacheKey,[geometry]);return [geometry];}
  const buckets=new Map(),a=V(),b=V(),c=V();
  for(let i=0;i<count;i+=3){const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
   const key=[Math.floor((a.x+b.x+c.x)/(cell*3)),Math.floor((a.y+b.y+c.y)/(cell*3)),Math.floor((a.z+b.z+c.z)/(cell*3)),geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0].join(',');
   if(!buckets.has(key))buckets.set(key,{indices:[],box:new THREE.Box3(),materialIndex:geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0});const bucket=buckets.get(key);bucket.indices.push(ia,ib,ic);bucket.box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
   if(i%768===0)yield;
  }
  const parts=[];let partNumber=0;
  for(const {indices,box,materialIndex}of buckets.values()){
   const part=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(geometry.attributes))part.setAttribute(name,attribute);
   part.setIndex(indices);part.addGroup(0,indices.length,materialIndex);part.boundingBox=box;part.boundingSphere=box.getBoundingSphere(new THREE.Sphere());parts.push(part);
   if(++partNumber%32===0)yield;
  }
  partCache.set(cacheKey,parts);return parts;
 }
 let collisionReady=false;
 let collisionIterator=null,preparation=null,collisionBuilds=0;
 const preparationStats={slices:0,maxSliceMs:0,cpuMs:0,wallMs:0};
 function* buildCollision(){
  collisionBins.clear();collisionEntries.length=0;partCache.clear();world.root.updateMatrixWorld(true);
 for(const mesh of world.collisionMeshes){const count=mesh.isInstancedMesh?mesh.count:1;for(let i=0;i<count;i++){
  const matrix=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){mesh.getMatrixAt(i,tmpM);matrix.multiply(tmpM);}
  for(const geometry of yield* collisionParts(mesh.geometry,matrix)){if(!geometry.boundingBox)geometry.computeBoundingBox();const collider=new THREE.Mesh(geometry,mesh.material);collider.matrixAutoUpdate=false;collider.matrixWorld.copy(matrix);collider.name=mesh.name;
   const box=geometry.boundingBox.clone().applyMatrix4(matrix),entry={collider,box};collisionEntries.push(entry);for(let k=Math.floor(box.min.z/64);k<=Math.floor(box.max.z/64);k++){if(!collisionBins.has(k))collisionBins.set(k,[]);collisionBins.get(k).push(entry);}
   yield;
  }
  yield;
 }}
  collisionReady=true;collisionBuilds++;
 }
 function rebuildCollision(){
  if(collisionReady)return;
  // Synchronous fallback is idempotent; ordinary play begins only after prepareCollision.
  collisionIterator ||= buildCollision();while(!collisionIterator.next().done){}
 }
 function prepareCollision(hooks={}){
  if(collisionReady)return Promise.resolve();
  if(preparation)return preparation;
  const iterator=collisionIterator ||= buildCollision();
  const now=hooks.now||(()=>performance.now());
  const started=now();
  const tracked=createSlicedIteratorPreparation(iterator,{
   now,
   schedule:hooks.schedule||setTimeout,
   cancelSchedule:hooks.cancel||clearTimeout,
   sliceBudgetMs:2,
   isReady:()=>collisionReady,
   onSlice:({cost})=>{preparationStats.slices++;preparationStats.cpuMs+=cost;preparationStats.maxSliceMs=Math.max(preparationStats.maxSliceMs,cost);},
  });
  const clearSticky=(discard=false)=>{
   if(preparation!==tracked)return;
   if(discard&&collisionIterator===iterator)collisionIterator=null;
   preparation=null;
  };
  const abort=tracked.cancel;
  tracked.cancel=()=>{
   if(preparation!==tracked)return;
   // Drop the sticky promise and iterator so a later retry rebuilds from scratch.
   abort();
   clearSticky(true);
  };
  tracked.then(()=>{if(preparation===tracked){preparationStats.wallMs=now()-started;clearSticky();}},()=>clearSticky(true));
  preparation=tracked;
  return preparation;
 }
 function ensureCollision(){rebuildCollision();}
 const sweptBox=new THREE.Box3();
 function traceDebris(start,end,padding=.05){ensureCollision();const delta=end.clone().sub(start),length=delta.length();if(length<.0001)return null;const direction=delta.multiplyScalar(1/length),finish=end.clone().addScaledVector(direction,padding);sweptBox.setFromPoints([start,finish]).expandByScalar(.0001);ray.set(start,direction);ray.near=0;ray.far=length+padding;let nearest=null;const seen=new Set();
  for(let k=Math.floor(sweptBox.min.z/64);k<=Math.floor(sweptBox.max.z/64);k++)for(const entry of collisionBins.get(k)||[]){if(seen.has(entry)||!entry.box.intersectsBox(sweptBox))continue;seen.add(entry);const h=ray.intersectObject(entry.collider,false)[0];if(h&&(!nearest||h.distance<nearest.distance)){nearest=h;ray.far=h.distance;}}return nearest;
 }
 const uniforms={uReveal:{value:1}},shellMat=shellMaterial(uniforms),shellGeo=eggGeometry(24,18);
 const bodyGeos=[0,1,2].map(embryoGeometry),bodyMats=[0x594137,0x735345,0x514036].map(color=>new THREE.MeshStandardMaterial({color,roughness:.56,metalness:0}));
 const glueMat=new THREE.MeshStandardMaterial({color:0x554b3c,roughness:.58,transparent:false,opacity:1,side:THREE.DoubleSide});
 const slimeMat=new THREE.MeshStandardMaterial({color:0x8b9470,roughness:.22,metalness:0,transparent:true,opacity:.78});
 const flapMat=new THREE.MeshStandardMaterial({color:0xb3a382,roughness:.47,side:THREE.DoubleSide});
 const scarMat=new THREE.MeshStandardMaterial({color:0x62543b,roughness:.32,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
 const collarGeo=new THREE.TorusGeometry(1.25,.23,10,28),padGeo=new THREE.SphereGeometry(1,16,10),socketGeo=new THREE.SphereGeometry(1,24,12,0,Math.PI*2,1.97,1.17).rotateX(Math.PI/2);
 // Irregular low mucus footprint: no circular plate projecting past the sac.
 const padPosition=padGeo.attributes.position;for(let i=0;i<padPosition.count;i++){const x=padPosition.getX(i),y=padPosition.getY(i),theta=Math.atan2(y,x),edge=.72+.075*Math.sin(theta*5+.4)+.045*Math.sin(theta*9);padPosition.setXYZ(i,x*edge,y*edge,padPosition.getZ(i)*.55);}padGeo.computeVertexNormals();
 function hitNormal(hit){let matrix=hit.object.matrixWorld;if(hit.instanceId!==undefined){hit.object.getMatrixAt(hit.instanceId,tmpM);matrix=new THREE.Matrix4().multiplyMatrices(matrix,tmpM);}return hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();}
 function hitRock(side,y,z,cx){ray.set(V(cx,y,z),V(side,0,0));ray.far=500;const hit=ray.intersectObjects(rocks,false)[0];if(!hit)return null;let matrix=hit.object.matrixWorld;if(hit.instanceId!==undefined){hit.object.getMatrixAt(hit.instanceId,tmpM);matrix=new THREE.Matrix4().multiplyMatrices(matrix,tmpM);}const normal=hit.face.normal.clone().transformDirection(matrix);if(normal.x*side>0)normal.negate();return{point:hit.point.clone(),normal,mesh:hit.object.name};}
 // The gallery uses shared lighter geometry and seven draw batches, not a draw per egg.
 const nurseryShellGeo=eggGeometry(24,18),nurseryCordGeo=new THREE.CylinderGeometry(.05,.05,2,5);
 // Nursery and ordinary eggs reuse the same three low-cost curled bodies.
 const nurseryBodies=bodyGeos;
 const nursery=[],nurseryBatches=[];let gallery=null;
 function buildNurseryBatches(){
   const definitions=[['shell',nurseryShellGeo,shellMat],['collar',collarGeo,glueMat],['pad',padGeo,glueMat],['socket',socketGeo,flapMat],...nurseryBodies.map((g,i)=>['body'+i,g,bodyMats[i]])];
   for(const [name,geo,mat]of definitions){const mesh=new THREE.InstancedMesh(geo,mat,nursery.length);if(name==='shell')geo.setAttribute('eggHit',new THREE.InstancedBufferAttribute(new Float32Array(nursery.length),1));mesh.name='Egg gallery '+name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=name==='shell';mesh.renderOrder=name==='shell'?2:0;root.add(mesh);nurseryBatches.push({name,mesh});}
 }
 function presentNursery(view){
   if(!nursery.length)return;root.updateMatrixWorld(true);
   const ordered=nursery.filter(e=>e.group.visible).sort((a,b)=>b.center.distanceToSquared(view)-a.center.distanceToSquared(view));
   for(const {name,mesh}of nurseryBatches){let n=0;for(const e of ordered){const body=name.startsWith('body');if(body&&e.stage!==Number(name.slice(4)))continue;const source=body?e.embryo:e[name];if(!source.visible)continue;if(name==='shell')mesh.geometry.attributes.eggHit.setX(n,Math.min(1,(e.hitFlash||0)/.12)*(e.reducedHit?.32:1));mesh.setMatrixAt(n++,source.matrixWorld);}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(name==='shell')mesh.geometry.attributes.eggHit.needsUpdate=true;}
 }
 function addGallery({routeLength,ruins}){
   if(gallery)return gallery;
   gallery={entryMetres:1550,exitMetres:1250,denseFromMetres:1470,denseToMetres:1290,quietFromMetres:1800,guardId:'ashborn-20',guardReadyMetres:1515,targetCount:234,rejections:{missing:0,slope:0,heat:0,ruin:0,overlap:0,visibility:0,attachment:0},candidates:0};
   const sightRay=new THREE.Raycaster();
   // Preserve the original sparse slots first, then infill across the entire
   // same canyon reach. One bounded target per wall avoids a packed entrance
   // and empty exit while retaining attachment and gameplay clearances.
   const slots=[];
   for(let column=0;column<23;column++)for(let row=1;row<9;row++)slots.push({column,row,original:column%2===0&&row%2===1});
   slots.sort((a,b)=>Number(b.original)-Number(a.original)||(a.original?(a.column-b.column||a.row-b.row):((a.column*73+a.row*151)%367-(b.column*73+b.row*151)%367)));
   for(const side of [-1,1]){const cluster={id:clusters.length,eggs:[],p:1-1380/routeLength,side,nursery:true};clusters.push(cluster);
    const wallTarget=side===1?gallery.targetCount-nursery.length:gallery.targetCount/2;
    for(const {column,row}of slots){
     if(cluster.eggs.length>=wallTarget)break;
     const d=1470-column*180/22+(row%2)*2.5,p=1-d/routeLength,c=centerAt(p),y=23+row*8.8+Math.sin(column*2.4+row*.8)*.85;
     gallery.candidates++;const hit=hitRock(side,y,c.z,c.x);if(!hit){gallery.rejections.missing++;continue;}
     if(Math.abs(hit.normal.y)>.82){gallery.rejections.slope++;continue;}
     const scale=.98+((column*7+row*3+(side+1))%9)*.025,radius=2.8*scale,length=4.7*scale,center=hit.point.clone().addScaledVector(hit.normal,length-.42);
     const clearance=Math.min(...hazards.map(h=>h.box.distanceToPoint(center)-length));if(clearance<10||center.y-radius<18){gallery.rejections.heat++;continue;}
     const ruinClearance=Math.min(...ruins.sites.map(s=>s.bounds.distanceToPoint(center)-length));if(ruinClearance<9){gallery.rejections.ruin++;continue;}
     if(eggs.some(e=>e.center.distanceTo(center)<e.radius+radius+.45)){gallery.rejections.overlap++;continue;}
     // Reject targets buried behind an outcrop from the adjacent flight-path view.
     const eye=c.clone();eye.y-=3;const delta=center.clone().sub(eye),dist=delta.length();sightRay.set(eye,delta.normalize());sightRay.far=Math.max(0,dist-radius);
     if(sightRay.intersectObjects(rocks,false).length){gallery.rejections.visibility++;continue;}
     sightRay.set(center,hit.normal.clone().negate());sightRay.far=length+1;
     const contact=sightRay.intersectObjects(world.collisionMeshes,false)[0];
     if(!contact||contact.point.distanceTo(hit.point)>.01){gallery.rejections.attachment++;continue;}
     const egg=makeEgg({anchor:hit.point,normal:hit.normal,center,radius,length,scale,p,side,clearance,ruinClearance,surface:hit.mesh,slot:column*10+row,nursery:true,remainingMetres:d},cluster,13+row,true);nursery.push(egg);
    }
   }
   gallery.count=nursery.length;gallery.bySide=[-1,1].map(side=>({side,count:nursery.filter(e=>e.side===side).length,minY:Math.min(...nursery.filter(e=>e.side===side).map(e=>e.center.y)),maxY:Math.max(...nursery.filter(e=>e.side===side).map(e=>e.center.y))}));
   if(nursery.length<220||nursery.length>gallery.targetCount||gallery.bySide.some(s=>s.count<105))throw new Error('Insufficient clear egg-gallery wall coverage');
   buildNurseryBatches();root.updateMatrixWorld(true);return gallery;
 }
 const rootThreadGeometry=new THREE.CylinderGeometry(.016,.045,1,6,3);
 // Thin adhesive threads replace the old thick cone/spike silhouette. Shared
 // bowed geometry keeps the same root endpoints, instance count and draw call.
 const threadPosition=rootThreadGeometry.attributes.position;for(let i=0;i<threadPosition.count;i++){const bend=Math.sin((threadPosition.getY(i)+.5)*Math.PI);threadPosition.setX(i,threadPosition.getX(i)+bend*.035);}rootThreadGeometry.computeVertexNormals();
 const rootThreadBatch=new THREE.InstancedMesh(rootThreadGeometry,glueMat,4096);rootThreadBatch.name='Wall-seated brood root filaments';rootThreadBatch.count=0;rootThreadBatch.frustumCulled=false;rootThreadBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(rootThreadBatch);
 const rootThreadMatrix=new THREE.Matrix4();
 function makeRootFilaments(a,group,id){
   const filaments=[],inverse=group.matrixWorld.clone().invert();
   for(let branch=0;branch<4;branch++){
    const angle=branch*Math.PI*.5+id*.37,spread=a.radius*(1.5+(id%3)*.13);
    const localEnd=V(Math.cos(angle)*spread,Math.sin(angle)*spread,-a.length+.42);
    const probe=localEnd.clone().applyMatrix4(group.matrixWorld).addScaledVector(a.normal,12);
    ray.set(probe,a.normal.clone().negate());ray.far=24;const hit=ray.intersectObjects(rocks,false)[0];
    const end=(hit?hit.point.clone():a.anchor.clone()).addScaledVector(a.normal,.10).applyMatrix4(inverse);
    const start=V(Math.cos(angle)*a.radius*.42,Math.sin(angle)*a.radius*.42,-a.length+.84),middle=start.clone().lerp(end,.42);middle.z+=.2*a.radius;
    for(const [from,to]of [[start,middle],[middle,end]]){const delta=to.clone().sub(from),length=delta.length();if(length<.001)continue;const object=new THREE.Object3D();object.position.copy(from).lerp(to,.5);object.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/length));object.scale.set(a.radius,length,a.radius);object.updateMatrix();filaments.push(object.matrix.clone());}
   }return filaments;
 }
 function presentRootFilaments(){let n=0;for(const e of eggs){if(!e.group.visible||(e.queenEgg&&e.group.scale.x<.99))continue;for(const matrix of e.rootFilaments||[]){if(n>=rootThreadBatch.instanceMatrix.count)break;rootThreadMatrix.multiplyMatrices(e.group.matrixWorld,matrix);rootThreadBatch.setMatrixAt(n++,rootThreadMatrix);}}rootThreadBatch.count=n;rootThreadBatch.instanceMatrix.needsUpdate=true;}
 const lattice=[[0,0],[1,0],[.5,.866],[-.5,.866],[-1,0],[-.5,-.866],[.5,-.866],[1.5,.866],[0,1.732],[-1.5,.866]];
 for(let site=0;site<EGG_SITES.length&&clusters.length<10;site++){
  const p=EGG_SITES[site],side=site%2?1:-1,c=centerAt(p);let chosen=null;
  for(const dy of [0,15,-10,27]){if(chosen)break;
   if(!isNestingWidth(p))continue;
   const middle=hitRock(side,42+(site%3)*9+dy,c.z,c.x);if(!middle||Math.abs(middle.normal.y)>.8)continue;
   const trial=[];const want=site%3===0?10:7;
   for(let k=0;k<want;k++){
    const [u,v]=lattice[k],scale=.96+((site*11+k*7)%13)/60,y=middle.point.y+v*6.65,z=c.z+u*6.65;
    const hit=hitRock(side,y,z,c.x);if(!hit||hit.normal.dot(middle.normal)<.78||Math.abs(hit.normal.y)>.8)continue;
    const radius=2.8*scale,length=5.3*scale,center=hit.point.clone().addScaledVector(hit.normal,length-.42);
    const clearance=Math.min(...hazards.map(h=>h.box.distanceToPoint(center)-length));
    if(clearance<10||center.y-radius<25||Math.abs(center.x-c.x)<widthAt(p)-5)continue;
    if(trial.some(a=>a.center.distanceTo(center)<a.radius+radius+.04))continue;
    trial.push({anchor:hit.point,normal:hit.normal,center,radius,length,scale,p,side,clearance,surface:hit.mesh,slot:k});
   }
   if(trial.length>=6)chosen=trial;
  }
  if(!chosen)continue;
  const cluster={id:clusters.length,eggs:[],p,side};clusters.push(cluster);
  for(const a of chosen)makeEgg(a,cluster,site);
 }
 function addQueenBrood(sites){const cluster={id:clusters.length,eggs:[],p:.965,side:0,queen:true};clusters.push(cluster);return sites.map((a,i)=>{const e=makeEgg({...a,queenEgg:true,laid:false},cluster,i+20);e.group.visible=false;return e;});}
 function makeEgg(a,cluster,site,dense=false){
   const id=eggs.length,stage=(id*7+site)%3,group=new THREE.Group();group.name=`Egg ${id}`;group.position.copy(a.center);group.quaternion.setFromUnitVectors(Z,a.normal);root.add(group);
   const shell=new THREE.Mesh(dense?nurseryShellGeo:shellGeo,shellMat);shell.name='Wet pallid larval egg membrane';shell.scale.set(a.radius,a.radius,a.length);shell.receiveShadow=true;shell.castShadow=true;shell.renderOrder=2;group.add(shell);
   const embryo=new THREE.Mesh(dense?nurseryBodies[stage]:bodyGeos[stage],bodyMats[stage]);embryo.name=`Curled maggot embryo stage ${stage}`;embryo.scale.setScalar(stage===2?1.12:1.1);embryo.position.z=.15;embryo.rotation.z=(id%5-2)*.16;group.add(embryo);
   const collar=new THREE.Mesh(collarGeo,glueMat);collar.position.z=-a.length+.55;collar.scale.set(a.scale*1.22,a.scale*1.04,.42);group.add(collar);
   const pad=new THREE.Mesh(padGeo,glueMat);pad.position.z=-a.length+.34;pad.scale.set(a.radius*1.26,a.radius*1.10,.34);group.add(pad);
   const socket=new THREE.Mesh(socketGeo,flapMat);socket.scale.copy(shell.scale);socket.visible=false;group.add(socket);
   // Umbilical thread and adhering glue strands give each sac a wet fixed pole.
   const cordCurve=new THREE.CatmullRomCurve3([V(0,-.9,.1),V(.65,-1.3,-1.2),V(.55,-.3,-a.length+1.3),V(0,0,-a.length+.5)]),cord=new THREE.Mesh(dense?nurseryCordGeo:new THREE.TubeGeometry(cordCurve,18,.065,6,false),glueMat);group.add(cord);
   group.updateMatrixWorld(true);const rootFilaments=makeRootFilaments(a,group,id);const egg={...a,rootFilaments,id:`egg-${id}`,index:id,cluster:cluster.id,stage,group,shell,embryo,collar,socket,cord,hp:65,dead:false,credited:false,releaseAge:0,vel:V(),spin:V(),landed:false,bodyOrigin:embryo.position.clone(),bodyRotation:embryo.rotation.clone(),bodyWorld:V(),bodyPrev:V(),ruptureAt:null};if(!dense){const material=shellMaterial(uniforms);shell.material=material;shell.onBeforeRender=()=>{if(material.userData.shader)material.userData.shader.uniforms.uEggHit.value=Math.min(1,(egg.hitFlash||0)/.12)*(egg.reducedHit?.32:1);};}eggs.push(egg);cluster.eggs.push(egg);
   if(dense){egg.nursery=true;egg.pad=pad;group.traverse(n=>n.layers.set(31));}
   return egg;
 }

 const drops=[],flaps=[],splats=[],tethers=[];
 function pool(count,geo,mat,name){const entries=[];for(let i=0;i<count;i++){const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.visible=false;root.add(mesh);entries.push({mesh,active:false,life:0,pos:V(),prev:V(),vel:V(),scale:1,owner:null});}return entries;}
 drops.push(...pool(72,new THREE.SphereGeometry(1,8,6),slimeMat,'Viscous egg fluid'));
 flaps.push(...pool(24,new THREE.SphereGeometry(1,8,6,0,.9,.5,1.0),flapMat,'Torn ivory membrane'));
 splats.push(...pool(32,new THREE.SphereGeometry(1,12,8),scarMat,'Sticky egg residue'));
 tethers.push(...pool(12,new THREE.CylinderGeometry(.08,.15,1,6,1),slimeMat,'Elastic egg filament'));
 const effectBatches=[drops,flaps,splats,tethers].map((items,i)=>{
   const mesh=new THREE.InstancedMesh(items[0].mesh.geometry,items[0].mesh.material,items.length);mesh.name='Batched egg rupture '+i;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);
   for(const a of items)a.mesh.layers.set(31);return {items,mesh};
 });
 function presentEffects(view){
   for(const {items,mesh}of effectBatches){let n=0;const ordered=items.filter(a=>a.active&&a.mesh.visible).sort((a,b)=>b.mesh.position.distanceToSquared(view)-a.mesh.position.distanceToSquared(view));for(const a of ordered){a.mesh.updateMatrix();mesh.setMatrixAt(n++,a.mesh.matrix);}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;}
 }
 for(const geo of [socketGeo,flaps[0].mesh.geometry]){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const v=V().fromBufferAttribute(p,i),j=1+.09*Math.sin(v.x*26+v.y*18)*Math.cos(v.z*21);v.multiplyScalar(j);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();}
 let seed=0xe6611; // deterministic rupture stream
let cursor={drop:0,flap:0,splat:0,tether:0},ruptures=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function take(items,key){const item=items[cursor[key]++%items.length];item.active=true;item.mesh.visible=true;item.mesh.scale.setScalar(1);item.mesh.rotation.set(0,0,0);item.owner=null;return item;}
 function splat(point,normal,size){const x=take(splats,'splat');x.pos.copy(point).addScaledVector(normal,.065);x.mesh.position.copy(x.pos);x.mesh.quaternion.setFromUnitVectors(Z,normal);x.mesh.scale.set(size*(.8+random()*.5),size,.065);x.life=16;}
 function hit(egg,point,damage=65){if(egg.dead||egg.queenEgg&&!egg.laid)return false;egg.hp-=damage;onHit?.(egg,point);audio?.creature('egg',point,false);audio?.confirmHit();hitFeedback?.hit(egg);if(egg.hp>0){egg.shell.scale.multiplyScalar(1.008);splat(point,egg.normal,.5);return false;}
  egg.dead=true;egg.shell.visible=false;egg.socket.visible=true;egg.cord.visible=false;egg.releaseAge=0;egg.ruptureAt=point.clone();ruptures++;
  egg.embryo.getWorldPosition(egg.bodyWorld);egg.bodyPrev.copy(egg.bodyWorld);egg.vel.copy(egg.normal).multiplyScalar(1.8+egg.stage*1.0).add(V(0,-.4,0));egg.spin.set((random()-.5)*1.1,(random()-.5)*.6,(random()-.5)*.8);
  splat(egg.anchor,egg.normal,egg.radius*.9);
  for(let n=0;n<8;n++){const d=take(drops,'drop');d.pos.copy(egg.center).add(V((random()-.5)*3,(random()-.5)*3,(random()-.5)*3));d.prev.copy(d.pos);d.vel.copy(egg.normal).multiplyScalar(4+random()*13).add(V((random()-.5)*15,(random()-.15)*13,(random()-.5)*15));d.life=2.5+random()*2;d.scale=.12+random()*.42;d.mesh.position.copy(d.pos);}
  for(let n=0;n<3;n++){const f=take(flaps,'flap');f.pos.copy(egg.center).add(V((random()-.5)*4,(random()-.5)*4,(random()-.5)*4));f.prev.copy(f.pos);f.vel.copy(egg.normal).multiplyScalar(2+random()*7).add(V((random()-.5)*8,random()*7,(random()-.5)*8));f.life=4+random()*2;f.scale=.65+random()*.85;f.mesh.position.copy(f.pos);f.mesh.scale.set(f.scale,f.scale*1.4,f.scale*.7);}
  for(let n=0;n<1;n++){const t=take(tethers,'tether');t.pos.copy(egg.center).add(V((random()-.5)*2,(random()-.5)*2,(random()-.5)*2));t.prev.copy(t.pos);t.vel.copy(egg.normal).multiplyScalar(3+random()*5).add(V(0,-2-random()*4,0));t.owner=egg;t.life=.9+random()*.6;}
  onRupture?.(egg,point);return true;
 }
 function trace(origin,direction,maxDistance){root.updateMatrixWorld(true);ray.layers.enable(31);ray.set(origin,direction);ray.near=0;ray.far=maxDistance;const hits=ray.intersectObjects(eggs.filter(e=>!e.dead&&e.group.visible&&e.shell.visible).map(e=>e.shell),false),h=hits[0];if(!h)return null;const egg=eggs.find(e=>e.shell===h.object);return {kind:'egg',actor:egg,distance:h.distance,point:h.point.clone(),normal:hitNormal(h)};}

 let effectAccumulator=0;
 function update(dt,time,plane){
  const simulationOnly=dt>0;
  // Scenery physics uses a deterministic 30Hz tick with interpolated display, independent of the
  // aircraft's 60Hz combat clock. Sweeps still cover every fluid step.
  if(dt>0){effectAccumulator+=dt;const steps=Math.floor((effectAccumulator+1e-8)*30);dt=steps/30;effectAccumulator=Math.max(0,effectAccumulator-dt);}
  for(const e of eggs){if(dt>0)e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);e.group.visible=(!e.queenEgg||e.laid)&&e.center.distanceToSquared(plane)<560*560;
   if(!e.dead){e.embryo.visible=e.center.distanceToSquared(plane)<(e.nursery?150*150:240*240);e.embryo.scale.setScalar((e.stage===2?1.12:1.1)*(1+Math.sin(time*.9+e.index*1.7)*.018));continue;}
   if(dt<=0)continue;e.releaseAge+=dt;if(e.landed)e.bodyPrev.copy(e.bodyWorld);
   if(e.releaseAge>.16&&e.releaseAge<8&&!e.landed){const prev=e.bodyWorld.clone();e.bodyPrev.copy(prev);e.vel.y-=11*dt;e.vel.multiplyScalar(Math.exp(-.28*dt));e.bodyWorld.addScaledVector(e.vel,dt);const h=traceDebris(prev,e.bodyWorld,e.scale*.50);
    if(h&&e.releaseAge>.4){const normal=hitNormal(h);if(normal.dot(e.vel)>0)normal.negate();e.bodyWorld.copy(h.point).addScaledVector(normal,.65);e.landed=true;splat(h.point,normal,1+e.stage*.4);}
    e.embryo.position.copy(e.group.worldToLocal(e.bodyWorld.clone()));e.embryo.rotation.x+=e.spin.x*dt;e.embryo.rotation.y+=e.spin.y*dt;e.embryo.rotation.z+=e.spin.z*dt;
   }
   e.embryo.visible=e.releaseAge<8&&(e.stage>0||e.index%3===0);if(e.releaseAge>6)e.embryo.scale.multiplyScalar(Math.exp(-dt*.4));
  }
  if(dt<=0){if(!simulationOnly){present();presentNursery(plane);presentEffects(plane);presentRootFilaments();}return;}
  for(const [items,isFlap] of [[drops,false],[flaps,true]])for(const a of items){if(!a.active)continue;a.life-=dt;a.prev.copy(a.pos);a.vel.y-=(isFlap?8:13)*dt;a.vel.multiplyScalar(Math.exp(-dt*(isFlap?.55:.36)));a.pos.addScaledVector(a.vel,dt);const h=traceDebris(a.prev,a.pos);if(h){const n=hitNormal(h);if(n.dot(a.vel)>0)n.negate();splat(h.point,n,a.scale*(isFlap?.5:2));a.life=0;}
   if(a.life<=0){a.active=false;a.mesh.visible=false;continue;}a.mesh.position.copy(a.pos);if(isFlap){a.mesh.rotation.x+=dt*2;a.mesh.rotation.y+=dt*1.1;}else{a.mesh.quaternion.setFromUnitVectors(UP,a.vel.clone().normalize());a.mesh.scale.set(a.scale,a.scale*(1+Math.min(4,a.vel.length()*.16)),a.scale);}}
  for(const s of splats)if(s.active){s.life-=dt;if(s.life<=0){s.active=false;s.mesh.visible=false;}}
  for(const t of tethers)if(t.active){t.prev.copy(t.pos);t.life-=dt;t.vel.y-=9*dt;t.pos.addScaledVector(t.vel,dt);const start=t.owner.center.clone().addScaledVector(t.owner.normal,-1),d=t.pos.clone().sub(start);t.mesh.position.copy(start).addScaledVector(d,.5);t.mesh.quaternion.setFromUnitVectors(UP,d.clone().normalize());t.mesh.scale.set(Math.max(.1,t.life),d.length(),Math.max(.1,t.life));if(t.life<=0||d.length()>16){t.active=false;t.mesh.visible=false;}}
  // Instance uploads and interpolation run once in the render update(dt=0).
 }
 function present(){const alpha=clamp(effectAccumulator*30,0,1);for(const e of eggs)if(e.dead&&e.embryo.visible)e.embryo.position.copy(e.group.worldToLocal(e.bodyPrev.clone().lerp(e.bodyWorld,alpha)));for(const a of [...drops,...flaps])if(a.active)a.mesh.position.copy(a.prev).lerp(a.pos,alpha);for(const t of tethers)if(t.active){const start=t.owner.center.clone().addScaledVector(t.owner.normal,-1),end=t.prev.clone().lerp(t.pos,alpha),d=end.sub(start);t.mesh.position.copy(start).addScaledVector(d,.5);t.mesh.quaternion.setFromUnitVectors(UP,d.clone().normalize());t.mesh.scale.y=d.length();}
 }
 function reset(){rootThreadBatch.count=0;effectAccumulator=0;seed=0xe6611;cursor={drop:0,flap:0,splat:0,tether:0};ruptures=0;for(const e of eggs){e.hp=65;e.hitFlash=0;e.dead=false;e.credited=false;e.shell.visible=true;e.shell.scale.set(e.radius,e.radius,e.length);e.socket.visible=false;e.cord.visible=true;e.embryo.visible=true;e.embryo.position.copy(e.bodyOrigin);e.embryo.rotation.copy(e.bodyRotation);e.embryo.scale.setScalar(e.stage===2?1.12:1.1);e.landed=false;e.releaseAge=0;e.ruptureAt=null;e.vel.set(0,0,0);e.group.visible=true;}for(const a of [...drops,...flaps,...splats,...tethers]){a.active=false;a.life=0;a.mesh.visible=false;}uniforms.uReveal.value=1;for(const {mesh}of [...nurseryBatches,...effectBatches])mesh.count=0;}
 function guideModel(){
  const source=eggs.find(e=>!e.nursery&&!e.queenEgg),display=new THREE.Group();
  // Canonical intact shell/embryo, with independent shader uniforms/material.
  const shell=new THREE.Mesh(source.shell.geometry.clone(),shellMaterial({uReveal:{value:1}}));shell.scale.copy(source.shell.scale);shell.renderOrder=2;display.add(shell);
  const embryo=new THREE.Mesh(source.embryo.geometry.clone(),source.embryo.material.clone());embryo.scale.copy(source.embryo.scale);embryo.position.copy(source.bodyOrigin);embryo.rotation.copy(source.bodyRotation);display.add(embryo);
  display.rotation.x=-Math.PI/2;display.name='Intact brood egg — field guide';return display;
 }
 root.updateMatrixWorld(true);return {guideModel,root,eggs,rupturedCount:()=>ruptures,clusters,hazards,uniforms,addGallery,addQueenBrood,rebuildCollision,prepareCollision,get gallery(){return gallery;},nurseryBatches,effectBatches,trace,traceDebris,hit,update,reset,pools:{drops,flaps,splats,tethers},stats:()=>({collision:{ready:collisionReady,builds:collisionBuilds,entries:collisionEntries.length,...preparationStats},gallery,nurseryDrawBatches:nurseryBatches.length,effectDrawBatches:effectBatches.length,clusters:clusters.length,eggs:eggs.length,stages:[0,1,2].map(s=>eggs.filter(e=>e.stage===s).length),intact:eggs.filter(e=>!e.dead).length,ruptures,activeDrops:drops.filter(d=>d.active).length,activeFlaps:flaps.filter(d=>d.active).length,activeSplats:splats.filter(d=>d.active).length,activeTethers:tethers.filter(d=>d.active).length,fallingEmbryos:eggs.filter(e=>e.dead&&e.embryo.visible&&!e.landed).length,minHeatClearance:Math.min(...eggs.map(e=>e.clearance)),caps:{drops:drops.length,flaps:flaps.length,splats:splats.length,tethers:tethers.length}})};
}
