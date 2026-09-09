import * as T from '../vendor/three.module.js?v=052';
import {createQueenModel as createCollisionQueen,QUEEN_POSITION,QUEEN_ARM_HP} from './queen-collision-model.js?v=052';
import {QUEEN_EYE_DEPTH,queenMaterials,mantleGeometry,shieldGeometry,flexibleTube,cupGeometry,batchQueenAnatomy,fittedMantleShield,vascularGlandMaterial,cupInteriorGeometry} from './queen-surface.js?v=052';
import {createQueenFrames,transportQueenFrames,sampleQueenFrame,QueenVisualCurve} from './queen-transport.js?v=052';
export {QUEEN_POSITION,QUEEN_ARM_HP};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Z=V(0,0,1),UP=V(0,1,0),VENTRAL=V(0,-.78,.63).normalize(),TAU=Math.PI*2;

export function createQueenModel({scene,centerAt,widthAt,bankMeshes}){
 // The released model is the complete collision and encounter authority. It
 // lives off-scene: art changes can never silently enlarge a weak point, move
 // an egg, or change which invulnerable surface stops a shot.
 const collisionScene=new T.Group(),baseline=createCollisionQueen({scene:collisionScene,centerAt,widthAt,bankMeshes});
 const collisionRoot=baseline.root,arms=baseline.arms,root=new T.Group();root.name='Queen — abyssal mineral kraken';scene.add(root);
 const mats=queenMaterials(),body=new T.Group();body.name='Living mantle and recessed cephalopod head';root.add(body);
 const sphere=new T.SphereGeometry(1,28,18),unitShield=Array.from({length:4},(_,i)=>shieldGeometry(i));
 const ell=(name,material,pos,scale,parent=body)=>{const m=new T.Mesh(sphere,material);m.name=name;m.position.copy(pos);m.scale.copy(scale);parent.add(m);return m;};
 const mantle=new T.Mesh(mantleGeometry(),mats.mantle);mantle.name='Continuous folded mantle';body.add(mantle);
 const crown=ell('Lobed muscular arm crown',mats.skin,V(0,12,0),V(30.2,20,25));crown.geometry=sphere.clone();const cp=crown.geometry.attributes.position;for(let j=0;j<cp.count;j++){const x=cp.getX(j),y=cp.getY(j),z=cp.getZ(j),a=Math.atan2(x,z),lobe=1+.055*Math.cos(a*8+.3)*(1-y*y)+.018*Math.sin(a*5+y*9);cp.setXYZ(j,x*lobe,y,z*lobe);}crown.geometry.computeVertexNormals();
 // A low dorsal carapace follows the mantle and ends above the orbital
 // region. Exposed living tissue defines the head and its arm attachments.
 const armorLayout=[[0,76,7.8,10],[-10,71,6.1,9.6],[10.5,69,6.4,9.5],[-17,63,4.8,8],[17,62,4.9,7.5],[-5.4,59,5.3,5.6],[6.5,58,5.2,5.3]];
 for(const [i,[x,y,rx,ry]]of armorLayout.entries()){
  const plate=new T.Mesh(fittedMantleShield(x,y,rx,ry,i*7+4),i===2||i===7?mats.edge:mats.armor);plate.name='Low dorsal mantle carapace';body.add(plate);
 }
 // Lateral eyes emerge from the head's sides. There is no frontal cartoon
 // brow, smile, exposed tusk pair or humanoid face.
 const eyes=[];
 for(const side of [-1,1]){
  const eye=new T.Group();eye.name=(side<0?'Left':'Right')+' recessed lateral eye';eye.position.set(side*17,47,QUEEN_EYE_DEPTH);eye.quaternion.setFromUnitVectors(Z,V(side*.48,.025,.875).normalize());body.add(eye);eyes.push(eye);
  ell('Dark orbital cavity',mats.socket,V(0,-.06,.46),V(3.7,1.85,.40),eye);
  const iris=ell('Warm amber eye tissue',mats.iris,V(0,-.10,1.03),V(3.05,1.75,.42),eye);iris.geometry=new T.SphereGeometry(1,32,20);
  const ip=iris.geometry.attributes.position,iu=iris.geometry.attributes.uv;
  for(let j=0;j<ip.count;j++)iu.setXY(j,ip.getX(j)*.5+.5,ip.getY(j)*.5+.5);
  ell('Horizontal cephalopod pupil',mats.pupil,V(0,-.10,1.46),V(1.74,.27,.075),eye);
  // The orbit is sculpted into the head. Curved soft lids overlap the globe;
  // no free-standing plate, round socket bead or painted specular dot.
  for(const upper of [true,false]){
   const points=upper?[V(-3.9,-.20,.55),V(-2.6,1.05,1.15),V(-.4,1.42,1.27),V(1.9,1.30,1.17),V(3.85,-.12,.55)]:[V(-3.9,-.20,.55),V(-2.6,-1.24,1.04),V(-.2,-1.65,1.05),V(2.5,-1.22,.97),V(3.85,-.12,.55)];
   const path=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(path,24,1,8,false),p=g.attributes.position;
   for(let j=0;j<p.count;j++){const f=Math.floor(j/9)/24,c=path.getPointAt(f),r=(upper?.57:.40)*(.58+.42*Math.sin(f*Math.PI));p.setXYZ(j,c.x+(p.getX(j)-c.x)*r,c.y+(p.getY(j)-c.y)*r,c.z+(p.getZ(j)-c.z)*r*.72);}g.computeVertexNormals();
   const lid=new T.Mesh(g,mats.skin);lid.name=upper?'Integrated upper orbital tissue':'Soft lower ocular rim';eye.add(lid);
  }
  for(let k=0;k<3;k++){const fin=new T.Mesh(unitShield[k],mats.armor);fin.name='Lateral mantle flange';fin.position.set(side*(23.5-k*1.2),63+k*6.2,-8-k*2.4);fin.rotation.set(.05,side*.95,side*.12);fin.scale.set(4.3-k*.5,7.6-k,1.6);body.add(fin);}
 }
 // The compact beak sits beneath a ring of radial folds, recessed into the
 // arm crown. Hook direction points into the mouth, not out like a bill.
 const mouth=new T.Group();mouth.name='Recessed radial beak';mouth.position.set(0,33,21.0);mouth.rotation.x=-.19;body.add(mouth);
 ell('Mouth shadow',mats.socket,V(),V(5.6,5.7,.65),mouth);
 const beakShape=(upper)=>{
  let activeFrames=null;
 const curve=new T.CatmullRomCurve3(upper?[V(0,5.0,0),V(0,3.4,3),V(0,.6,4.1),V(0,-2,1.8)]:[V(0,-5.2,-.7),V(0,-3.5,2),V(0,-1,2.5),V(0,.6,1)]);
  const geometry=new T.TubeGeometry(curve,14,1,10,false),pa=geometry.attributes.position;
  for(let i=0;i<pa.count;i++){const j=Math.floor(i/11),f=j/14,p=curve.getPointAt(f),r=(upper?3.4:2.8)*(1-f)+.12;pa.setXYZ(i,p.x+(pa.getX(i)-p.x)*r,p.y+(pa.getY(i)-p.y)*r*.54,p.z+(pa.getZ(i)-p.z)*r*.65);}geometry.computeVertexNormals();
  const m=new T.Mesh(geometry,mats.beak);m.name=upper?'Recessed upper hooked beak':'Nested lower beak';m.scale.setScalar(.65);m.position.z=-.7;mouth.add(m);
 };
 beakShape(true);beakShape(false);
 // Gills and shoulder folds bridge the mantle and arm roots.
 for(const side of [-1,1])for(let k=0;k<5;k++){
  const fold=ell('Wet branchial fold',k%2?mats.skin:mats.underside,V(side*(10+k*2.35),25-k*1.9,17-k*.42),V(.85,7.7-k*.55,1.7));fold.rotation.z=side*(.40+k*.045);
 }
 // Scars are real slender ridges with irregular, authored paths, not a
 // repeating glowing pattern. Their muted tissue value survives distance.
 for(let i=0;i<4;i++){
  const pts=[V(-10+i*5,56+i*4,12-i),V(-7+i*5,52+i*4,15-i),V(-4+i*5,47+i*4,17-i)];
  const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),10,.23,5,false),mats.scar);m.name='Healed mantle scar';body.add(m);
 }
 const wake=new T.Group();wake.name='Broken lava displacement crust';root.add(wake);
 const crustGeometry=new T.IcosahedronGeometry(1,1);
 for(let i=0;i<28;i++){
  const angle=i/28*TAU,r=28+Math.sin(i*4.7)*2.2,m=new T.Mesh(crustGeometry,i%5===0?mats.heat:mats.armor);
  m.name='Lava crust at Queen waterline';m.position.set(Math.sin(angle)*r,4.7+Math.sin(i)*.55,Math.cos(angle)*r*.81);m.scale.set(2.7+Math.sin(i*3)*.7,.65,3.7);m.rotation.set(i*.03,angle,i*.02);wake.add(m);
 }
 batchQueenAnatomy(body,new Set([mantle]));batchQueenAnatomy(wake);
 const cupCountPerArm=36,cupCount=8*cupCountPerArm;
 const cups=new T.InstancedMesh(cupGeometry(),mats.cup,cupCount);cups.name='Paired ventral suction bowls';cups.frustumCulled=false;cups.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(cups);
 const cupCavities=new T.InstancedMesh(cupInteriorGeometry(),mats.cupInner,cupCount);cupCavities.name='Recessed suction cavities';cupCavities.frustumCulled=false;cupCavities.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(cupCavities);
 const ridges=new T.InstancedMesh(unitShield[3],mats.skin,8*5);ridges.name='Dorsal tendon ridges';ridges.frustumCulled=false;ridges.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(ridges);
 for(const arm of arms){
  const tube=flexibleTube(),frames=createQueenFrames(tube.length),mesh=new T.Mesh(tube.geometry,mats.arm);mesh.name='Muscular tentacle '+(arm.index+1);mesh.frustumCulled=false;root.add(mesh);
  const tip=arm.tip.clone(true);tip.name='Visible red weapon crown '+(arm.index+1);root.add(tip);
  // Exact gland/muzzle geometry and local transforms preserve a truthful
  // on-screen target. Material relief adds detail without moving its surface.
  let gland=null;
  tip.traverse(o=>{if(!o.isMesh)return;if(o.name==='Red plasma gland'){gland=o;o.material=vascularGlandMaterial(arm.glandMaterial);}else if(o.name==='Triplex dark muzzle')o.material=mats.socket;});
  const collar=arm.collar.clone();collar.name='Arm mantle cuff '+(arm.index+1);collar.material=mats.armor;root.add(collar);
   // Explicit fields let hit-feedback register the visible surfaces while
  // gameplay continues to use the untouched baseline mesh/tip/muzzle.
  Object.assign(arm,{visualMesh:mesh,visualTip:tip,visualGland:gland,visualCollar:collar,visualTube:tube,visualFrames:frames,hitMesh:arm.mesh,hitTip:arm.tip});
 }
 let activeFrames=null;
 const curve=new QueenVisualCurve(),temp=V(),tangent=V(),u=V(),v=V(),normal=V(),cupNormal=V(),binormal=V(),q=new T.Quaternion(),dummy=new T.Object3D();
 const dorsal=new T.Color(0x463e3d),ventral=new T.Color(0x8b7566),scratch=new T.Color();
 function curveFor(arm,time,attention){
  const target=arm.tip.position,base=arm.base,side=Math.tanh(target.x/24),lowArm=arm.index===7?attention:0,bend=arm.index%3;
  curve.points[0].copy(base);
  curve.points[1].copy(base).add(V(side*(17+attention*(10+bend*2)),T.MathUtils.lerp(11+attention*(18+bend*3),9,lowArm),8-attention*14));
  curve.points[2].copy(base).lerp(target,.47).add(V(side*(16+attention*(5+bend*2)),T.MathUtils.lerp(16+attention*(13+(arm.index%4)*3),-6,lowArm),-13-attention*7));
  curve.points[3].copy(target).add(V(-side*(6+attention*bend*2),T.MathUtils.lerp(14,arm.index===7?4:6+(arm.index%4)*3,attention),-19));
  curve.points[4].copy(target);
  // Advance monotonically along the root-to-tip chord. The old guide can
  // double back during the intro blend; a muscular visible limb must not.
  const chord=target.clone().sub(base),length=chord.length(),direction=chord.clone().normalize();
  for(const [j,lo,hi,reach]of [[1,.18,.33,.35],[3,.78,1.20,.50]]){
   const offset=curve.points[j].clone().sub(base),projection=offset.dot(direction),sideways=offset.addScaledVector(direction,-projection);
   if(sideways.length()>length*reach)sideways.setLength(length*reach);
   curve.points[j].copy(base).addScaledVector(chord,T.MathUtils.clamp(projection/Math.max(length,.01),lo,hi)).add(sideways);
  }
  curve.points[2].copy(curve.points[1]).lerp(curve.points[3],.5);
 }
 function frame(f){curve.getPoint(f,temp);sampleQueenFrame(activeFrames,f,tangent,u,v);}
 function cupFrame(f){frame(f);cupNormal.copy(v);binormal.copy(u);}
 function baseRadiusAt(f){return 6.8*Math.pow(1-f,.7)+1.5+Math.sin(f*Math.PI)*.7;}
 function fitMuscleRadius(frames){
  const {segments,points,tangents,radii}=frames;
  for(let j=0;j<=segments;j++){const a=Math.max(0,j-1),b=Math.min(segments,j+1),angle=Math.acos(T.MathUtils.clamp(tangents[a].dot(tangents[b]),-1,1)),distance=points[a].distanceTo(points[j])+points[j].distanceTo(points[b]),curvatureRadius=angle>1e-5?distance/angle:1e5;radii[j]=Math.min(baseRadiusAt(j/segments),Math.max(1.1,curvatureRadius*.68));}
  // Muscle thickness approaches a tight curl gradually, never as a pinched
  // single ring. This also keeps the inside surface from folding over itself.
  for(let j=1;j<=segments;j++)radii[j]=Math.min(radii[j],radii[j-1]+points[j].distanceTo(points[j-1])*.26);
  for(let j=segments-1;j>=0;j--)radii[j]=Math.min(radii[j],radii[j+1]+points[j].distanceTo(points[j+1])*.26);
 }
 function radiusAt(f){const p=T.MathUtils.clamp(f*activeFrames.segments,0,activeFrames.segments),j=Math.min(activeFrames.segments-1,Math.floor(p));return T.MathUtils.lerp(activeFrames.radii[j],activeFrames.radii[j+1],p-j);}
 function pose(time,options={}){
  baseline.pose(time,options);
  const {attention=0,collapse=0,emergence=1}=options;
  root.position.copy(collisionRoot.position);root.quaternion.copy(collisionRoot.quaternion);root.scale.copy(collisionRoot.scale);
  body.rotation.x=collapse*.18;body.scale.set(1+Math.sin(time*.65)*.004,1,1+Math.sin(time*.65)*.006);
  wake.position.y=(1-emergence)*70;wake.scale.setScalar(1+Math.sin(time*.8)*.035+collapse*.8);wake.visible=collapse<.95;
  let ci=0,ri=0;
  for(const arm of arms){
   const mesh=arm.visualMesh,tip=arm.visualTip,visible=!arm.dead&&collapse<.99;
   mesh.visible=tip.visible=arm.visualCollar.visible=visible;
   tip.position.copy(arm.tip.position);tip.quaternion.copy(arm.tip.quaternion);tip.scale.copy(arm.tip.scale);
   arm.visualCollar.position.copy(arm.collar.position);arm.visualCollar.quaternion.copy(arm.collar.quaternion);arm.visualCollar.scale.copy(arm.collar.scale);
   arm.visualGland.material.emissiveIntensity=arm.glandMaterial.emissiveIntensity;
   if(!visible)continue;
   curveFor(arm,time,attention);activeFrames=transportQueenFrames(curve,arm.visualFrames);fitMuscleRadius(activeFrames);
   const {length,radial}=arm.visualTube,pa=mesh.geometry.attributes.position,no=mesh.geometry.attributes.normal,co=mesh.geometry.attributes.color;
   for(let j=0;j<=length;j++){
    const f=j/length;frame(f);const radius=radiusAt(f),wave=Math.sin(f*Math.PI);
    // Long muscle bundles and shallow circumferential wrinkles break the
    // garden-hose profile. Both taper to zero at the protected endpoints.
    for(let k=0;k<=radial;k++){
     const angle=k/radial*TAU;normal.copy(u).multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle));
     const bundle=.051*Math.cos(angle*5+f*4.1+arm.index*.6),compression=.0035*Math.sin(f*63+Math.sin(angle*3)*1.7+arm.index),muscle=.095*Math.exp(-(((f-.20)/.15)**2))-.055*Math.exp(-(((f-.58)/.24)**2)),r=radius*(.958+(bundle+compression+muscle)*wave);
     const n=j*(radial+1)+k;pa.setXYZ(n,temp.x+normal.x*r,temp.y+normal.y*r,temp.z+normal.z*r);no.setXYZ(n,normal.x,normal.y,normal.z);
     const underside=T.MathUtils.smoothstep(normal.dot(v),-.08,.8),mottle=.96+.025*Math.sin(f*17+angle*3+arm.index)+.014*Math.sin(f*9-angle*7);scratch.copy(dorsal).lerp(ventral,underside).multiplyScalar(mottle);co.setXYZ(n,scratch.r,scratch.g,scratch.b);
    }
   }
   for(const [n,f]of [[arm.visualTube.capStart,0],[arm.visualTube.capEnd,1]]){frame(f);pa.setXYZ(n,temp.x,temp.y,temp.z);no.setXYZ(n,tangent.x*(f?1:-1),tangent.y*(f?1:-1),tangent.z*(f?1:-1));co.setXYZ(n,dorsal.r,dorsal.g,dorsal.b);}
   pa.needsUpdate=no.needsUpdate=co.needsUpdate=true;mesh.geometry.computeVertexNormals();
   for(let j=0;j<=length;j++){const a=j*(radial+1),b=a+radial;normal.set(no.getX(a)+no.getX(b),no.getY(a)+no.getY(b),no.getZ(a)+no.getZ(b)).normalize();no.setXYZ(a,normal.x,normal.y,normal.z);no.setXYZ(b,normal.x,normal.y,normal.z);}
   mesh.geometry.computeBoundingSphere();
   for(let j=0;j<18;j++){
    const f=.12+j*.0405,r=radiusAt(f),scale=Math.min(2.32-f*1.75,r*.38);cupFrame(f);
    for(const side of [-1,1]){
     const outward=cupNormal.clone().multiplyScalar(.90).addScaledVector(binormal,side*.44).normalize();
     dummy.position.copy(temp).addScaledVector(outward,r*.98+scale*.24);dummy.quaternion.setFromUnitVectors(Z,outward);dummy.scale.set(scale,scale,scale*.86);dummy.updateMatrix();cups.setMatrixAt(ci,dummy.matrix);
     dummy.scale.set(scale,scale,scale*.86);dummy.updateMatrix();cupCavities.setMatrixAt(ci++,dummy.matrix);
    }
   }
   for(let j=0;j<5;j++){
    const f=.10+j*.13,r=radiusAt(f);cupFrame(f);dummy.position.copy(temp).addScaledVector(cupNormal,-r*.97);dummy.quaternion.setFromUnitVectors(Z,cupNormal.clone().negate());dummy.scale.set(2.6-f*1.5,3.2-f*1.5,.35);dummy.updateMatrix();ridges.setMatrixAt(ri++,dummy.matrix);
   }
  }
  cups.count=cupCavities.count=ci;ridges.count=ri;cups.instanceMatrix.needsUpdate=cupCavities.instanceMatrix.needsUpdate=ridges.instanceMatrix.needsUpdate=true;
  root.updateMatrixWorld(true);collisionRoot.updateMatrixWorld(true);
 }
 function reset(){baseline.reset();root.visible=true;pose(0);}
 reset();
 return{root,collisionRoot,arms,visualFeatures:{eyes,mouth,eyeFocus:V(0,-.1,1.25)},eggSites:baseline.eggSites,pose,reset,center:root.position,stats:()=>({...baseline.stats(),presentation:{version:50,anatomy:'mineral-cephalopod',arms:8,cups:cups.count,collision:'released-v042'}})};
}
