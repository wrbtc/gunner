import {creatureKeratinMaterial} from './creature-keratin.js?v=052';
import {HP,POINTS} from './combat-balance.js?v=052';
import {createWallSurface} from './wall-climb.js?v=052';
import {maximumSphereOverlapBound} from './sphere-overlap-bound.js?v=054-5';
import * as T from '../vendor/three.module.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);
export const PLASMA_SITES=Object.freeze([.11,.18,.25,.33,.41,.49,.57,.647].map((p,i)=>Object.freeze({p,side:i%2?1:-1})));
export const PLASMA_POINTS=POINTS.plasma,PLASMA_SCALE=.2;
export function createPlasmaBugs({scene,centerAt,widthAt,bankMeshes,aimTarget,progress,burst,award,logEvent,audio,hitFeedback}){
 const root=new T.Group();root.name='Eight wall-climbing Plasma scarabs';scene.add(root);
 const actors=[],colliders=[],ray=new T.Raycaster();
 const shell=creatureKeratinMaterial(0x3b3c35,.88,{scale:3.2,relief:.055,wear:.38,name:'Plasma scarab chipped coal armour'}),joint=creatureKeratinMaterial(0x29251e,.85,{scale:2.4,relief:.025});
 const rim=creatureKeratinMaterial(0x8d7960,.83,{relief:.02,wear:.15}),eyeMat=new T.MeshStandardMaterial({color:0x260e08,emissive:0xa2250d,emissiveIntensity:.5,roughness:.38});
 const lantern=creatureKeratinMaterial(0x4c0910,.48,{wet:true,scale:2.1,relief:.022});lantern.emissive.setHex(0xb61913);lantern.emissiveIntensity=.72;
 const skinCompile=lantern.onBeforeCompile,skinKey=lantern.customProgramCacheKey;
 lantern.onBeforeCompile=function(shader){skinCompile.call(this,shader);shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  float vein=abs(sin(vKeratinPosition.z*18.+sin(vKeratinPosition.x*9.)*.9));
  float fineVein=abs(sin(vKeratinPosition.x*27.+vKeratinPosition.y*11.+sin(vKeratinPosition.z*15.)));
  totalEmissiveRadiance*=mix(.16,.82,smoothstep(.055,.30,vein))*mix(.45,1.,smoothstep(.015,.10,fineVein));
 `);};lantern.customProgramCacheKey=()=>skinKey()+'-plasma-veined-sac-v054';
 const sphere=new T.SphereGeometry(1,20,12),plateGeo=new T.IcosahedronGeometry(1,1),limbGeo=new T.CylinderGeometry(.25,.48,1,8),toeGeo=new T.ConeGeometry(.2,1,5);
 // Small deterministic fractures break regular armour facets without changing rigs.
 const platePositions=plateGeo.attributes.position;for(let i=0;i<platePositions.count;i++){const p=V().fromBufferAttribute(platePositions,i),n=1+.08*Math.sin(p.x*23+p.y*17)*Math.sin(p.z*29-p.y*11);p.multiplyScalar(n);platePositions.setXYZ(i,p.x,p.y,p.z);}plateGeo.computeVertexNormals();
 function ell(parent,name,material,pos,scale,geometry=sphere){const m=new T.Mesh(geometry,material);m.name=name;m.position.copy(pos);m.scale.copy(scale);parent.add(m);return m;}
 function link(parent,a,b,r){const m=new T.Mesh(limbGeo,joint);parent.add(m);setLink(m,a,b,r);return m;}
 function setLink(m,a,b,r){m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());m.scale.set(r,a.distanceTo(b),r);}
 function poseRoot(a,y){
  const hit=a.surface.sample(y,a.z),normal=hit.normal.clone(),up=UP.clone().addScaledVector(normal,-normal.y).normalize(),back=up.negate(),right=normal.clone().cross(back).normalize();
  a.root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,normal,back));a.root.position.copy(hit.point).addScaledVector(normal,.10);a.root.updateMatrixWorld(true);
 }
 function plan(a,preferred){
  // Require a continuous strip of actual bank triangles for body and six feet.
  let best=null;
  for(const dz of [0,-4,4,-8,8])for(let y=23;y<=61;y+=2){
   let valid=true;const z=a.z+dz;
   for(let h=-2;h<=8;h+=.5){const center=a.surface.sample(y+h,z);if(!center?.bank||Math.abs(center.normal.x)<.55){valid=false;break;}
    for(const off of [-1.35,0,1.35]){const p=a.surface.sample(y+h,z+off);if(!p?.bank||Math.abs(p.point.x-center.point.x)>.65){valid=false;break;}}
    if(!valid)break;
   }
   const cost=Math.abs(y-preferred)+Math.abs(dz)*.6;
   if(valid&&(!best||cost<best.cost))best={min:y,max:y+5,z,cost};
  }
  if(!best)throw Error('No qualified Plasma wall strip: '+a.id);return best;
 }
 for(const [i,site] of PLASMA_SITES.entries()){
  const body=new T.Group();body.name='Plasma wall scarab '+(i+1);body.scale.setScalar(PLASMA_SCALE);root.add(body);
  const c=centerAt(site.p),a={id:'plasma-'+(i+1),root:body,site,side:site.side,z:c.z,centerX:c.x,legs:[],hp:HP.plasma,dead:false,credited:false,state:'climbing',lanternPosition:V(),time:0};
  a.surface=createWallSurface(a,bankMeshes);a.route=plan(a,27+(i%3)*6);a.z=a.route.z;
  ell(body,'Basalt keratin thorax',shell,V(0,4.3,-1.1),V(2.55,2,3.1));
  ell(body,'Armoured scarab head',shell,V(0,4.1,-4.7),V(1.8,1.3,1.7));
  for(const s of [-1,1]){ell(body,'Ruby sensor',eyeMat,V(s*1.25,4.55,-5.65),V(.27,.22,.32));link(body,V(s*.65,4.6,-5.5),V(s*1.5,5.1,-7.6),.32);}
  a.abdomen=ell(body,'Volatile red abdominal sac',lantern,V(0,4.8,4.5),V(3.9,3.25,4.4));
  a.covers=[];for(const side of [-1,1])for(let j=0;j<4;j++){
   const z=1.7+j*1.8,y=4.8+3.25*Math.sqrt(Math.max(.1,1-(2/3.9)**2-((z-4.5)/4.4)**2));
   const plate=ell(body,'Overlapping broken elytron',shell,V(side*2,y+.2,z),V(2,.68,1.3),plateGeo);plate.rotation.z=-side*.40;plate.rotation.y=side*.10;a.covers.push(plate);
  }
  for(let j=0;j<3;j++)ell(body,'Thorax shield plate',shell,V(0,5.95,-3+j*1.6),V(2.45,.52,1.2),plateGeo);
  for(const side of [-1,1]){const jaw=new T.Mesh(new T.TorusGeometry(.85,.24,7,12,Math.PI*.85),rim);jaw.position.set(side*.8,3.9,-6.0);jaw.rotation.set(Math.PI/2,0,side*.4);body.add(jaw);}
  for(const side of [-1,1])for(let leg=0;leg<3;leg++){
   const hip=V(side*1.5,3.7,-3+leg*2.1),knee=V(side*(3.6+leg*.3),2.5,hip.z-.8),foot=V(side*(4.7+leg*.3),.25,hip.z+1.2);
   const upper=link(body,hip,knee,1),lower=link(body,knee,foot,.62),toe=new T.Mesh(toeGeo,rim);body.add(toe);const kneeCap=ell(body,'Armoured leg joint',shell,knee,V(.46,.46,.60));
   a.legs.push({side,leg,hip,foot,upper,lower,toe,kneeCap,upperLength:hip.distanceTo(knee)*1.18,lowerLength:knee.distanceTo(foot)*1.18,contact:null,planted:true,reachError:0});
  }
  a.glow=new T.PointLight(0xff2335,0,10,2);a.glow.position.set(0,5,5.3);body.add(a.glow);
  poseRoot(a,a.route.min);a.spawn=body.position.clone();actors.push(a);
 }
 const lightVariants={roots:actors.map(a=>a.root),maxVisible:maximumSphereOverlapBound(actors.map(a=>a.spawn),510)};
 function poseFeet(a,time,moving){
  const toeRotation=new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2),positions=toeGeo.attributes.position;
  const envelope=Array.from({length:positions.count},(_,i)=>V().fromBufferAttribute(positions,i).applyQuaternion(toeRotation).multiplyScalar(PLASMA_SCALE).applyQuaternion(a.root.quaternion));
  for(const l of a.legs){
   const desired=l.foot.clone().applyMatrix4(a.root.matrixWorld),step=.36,offset=(l.leg+(l.side>0?1:0))%2*.5;
   const level=desired.y/step+offset,base=Math.floor(level),phase=level-base,blend=moving?T.MathUtils.smoothstep(phase,.65,1):0;
   const y0=(base-offset)*step,y1=y0+step,h0=a.surface.sample(y0,desired.z),h1=a.surface.sample(y1,desired.z);
   if(!h0||!h1)throw Error('Missing Plasma paw support '+a.id);
   const world=h0.point.clone().lerp(h1.point,blend);let penetration=-Infinity;
   for(const offset of envelope){const v=world.clone().add(offset),support=a.surface.sample(v.y,v.z);if(!support?.bank)throw Error('Missing Plasma claw envelope support '+a.id);penetration=Math.max(penetration,(v.x-support.point.x)*a.side);}
   // Seat the visible claw envelope, not merely its pivot, on the jagged wall.
   world.x-=a.side*(penetration+.006+Math.sin(blend*Math.PI)*.18);
   const foot=a.root.worldToLocal(world.clone()),delta=foot.clone().sub(l.hip),distance=delta.length(),reach=Math.min(distance,l.upperLength+l.lowerLength-.001),along=delta.normalize();
   const d=Math.max(.001,reach),x=(l.upperLength*l.upperLength-l.lowerLength*l.lowerLength+d*d)/(2*d),height=Math.sqrt(Math.max(0,l.upperLength*l.upperLength-x*x));
   const pole=UP.clone().addScaledVector(along,-UP.dot(along)).normalize(),knee=l.hip.clone().addScaledVector(along,x).addScaledVector(pole,height),end=l.hip.clone().addScaledVector(along,reach);
   setLink(l.upper,l.hip,knee,1);setLink(l.lower,knee,end,.62);l.kneeCap.position.copy(knee);l.toe.position.copy(end);l.toe.rotation.set(-Math.PI/2,0,0);
   l.contact=world;l.planted=blend===0;l.reachError=Math.max(0,distance-reach)*PLASMA_SCALE;
  }
 }
 function hit(a,point,damage){if(a.dead)return false;a.hp-=damage;hitFeedback?.hit(a);audio?.creature('plasma',point,false);audio?.confirmHit();logEvent?.('plasma-hit',{source:a.id,damage,hp:Math.max(0,a.hp)});if(a.hp>0)return false;audio?.creature('plasma',point,true);a.dead=true;a.state='detonated';a.root.visible=false;a.glow.intensity=0;if(!a.credited){a.credited=true;award?.(PLASMA_POINTS,a);}a.abdomen.getWorldPosition(a.lanternPosition);burst?.(a.lanternPosition,{scale:.9,source:a.id});return true;}
 function trace(origin,direction,maxDistance){root.updateMatrixWorld(true);ray.set(origin,direction);ray.far=maxDistance;const candidates=[];for(const a of actors)if(!a.dead&&a.root.visible)a.root.traverse(n=>{if(n.isMesh)candidates.push(n);});const h=ray.intersectObjects(candidates,false)[0];if(!h)return null;const a=actors.find(a=>{let p=h.object;while(p){if(p===a.root)return true;p=p.parent;}return false;});return{kind:'plasma',actor:a,distance:h.distance,point:h.point.clone(),normal:h.face.normal.clone().transformDirection(h.object.matrixWorld)};}
 function update(dt,time){const eye=aimTarget(),p=progress();for(const a of actors){a.time=time;if(a.dead){a.root.visible=false;continue;}const distance=a.spawn.distanceTo(eye);a.root.visible=distance<510&&p<a.site.p+.12;if(!a.root.visible){a.glow.intensity=0;continue;}
  // A slow endless five-metre climb, smoothly reversing at the strip ends.
  const phase=(time*.085+a.site.p*5)%(Math.PI*2),f=(1-Math.cos(phase))*.5;
  poseRoot(a,T.MathUtils.lerp(a.route.min,a.route.max,f));poseFeet(a,time,true);a.abdomen.getWorldPosition(a.lanternPosition);
  a.glow.intensity=distance<130?4+Math.sin(time*2.3)*.5:0;a.abdomen.scale.y=3.25*(1+Math.sin(time*2.3)*.025);
 }}
 function reset(){for(const a of actors){a.hp=HP.plasma;a.dead=a.credited=false;a.state='climbing';a.time=0;poseRoot(a,a.route.min);poseFeet(a,0,false);a.root.visible=false;a.glow.intensity=0;}}
 reset();return{root,actors,colliders,lightVariants,hit,trace,update,reset,stats:()=>actors.map(a=>({id:a.id,hp:a.hp,dead:a.dead,state:a.state,visible:a.root.visible,position:a.root.position.toArray(),lantern:a.lanternPosition.toArray(),route:a.route,points:PLASMA_POINTS,bodyScale:a.root.scale.x,blastScale:.9,attacks:0,contacts:a.legs.map(l=>({point:l.contact?.toArray(),planted:l.planted,reachError:l.reachError}))}))};
}
