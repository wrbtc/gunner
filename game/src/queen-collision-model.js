import * as T from '../vendor/three.module.js?v=052';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0),Z=V(0,0,1),clamp=T.MathUtils.clamp;
export const QUEEN_POSITION=.965,QUEEN_ARM_HP=703.125;
export function createQueenModel({scene,centerAt,widthAt,bankMeshes}){
 const root=new T.Group();root.name='Eight-armed lava Queen';const center=centerAt(QUEEN_POSITION);root.position.set(center.x,-3,center.z);scene.add(root);
 // Mineral carapace and living tissue share deterministic relief, but retain
 // separate value/roughness families. Light comes from the scene, never baked highlights.
 const size=256,pigment=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const j=(y*size+x)*4;let n=Math.imul(x+31,374761393)^Math.imul(y+7,668265263);n=Math.imul(n^(n>>>13),1274126177);const noise=((n^(n>>>16))>>>0)/4294967295,mottle=.62+.18*Math.sin(x*.14+Math.sin(y*.11)*3)*Math.sin(y*.08)+noise*.16,ridge=Math.pow(.5+.5*Math.sin(y*.59+Math.sin(x*.08)*2),5);for(let k=0;k<3;k++){pigment[j+k]=Math.round(255*mottle);height[j+k]=Math.round(55+noise*80+ridge*95);}pigment[j+3]=height[j+3]=255;}
 function texture(data){const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,4);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
 const pigmentMap=texture(pigment),skinBump=texture(height);
 const shell=new T.MeshStandardMaterial({color:0x222c2b,map:pigmentMap,bumpMap:skinBump,bumpScale:.68,roughness:.66,metalness:.09}),rib=new T.MeshStandardMaterial({color:0x41483e,map:pigmentMap,bumpMap:skinBump,bumpScale:.45,roughness:.71,metalness:.06}),skin=new T.MeshStandardMaterial({color:0x3e292b,map:pigmentMap,bumpMap:skinBump,bumpScale:.55,roughness:.61,metalness:0}),red=new T.MeshStandardMaterial({color:0x8e1820,map:pigmentMap,bumpMap:skinBump,bumpScale:.24,emissive:0xff1725,emissiveIntensity:.46,roughness:.38}),socketMat=new T.MeshStandardMaterial({color:0x0c0b0e,roughness:.7}),eyeMat=new T.MeshStandardMaterial({color:0x8f421c,emissive:0xff8a26,emissiveIntensity:.6,roughness:.4}),lavaMat=new T.MeshStandardMaterial({color:0x80300f,emissive:0xee4810,emissiveIntensity:.55,roughness:.65});
 const sphere=new T.SphereGeometry(1,32,20);function ell(name,mat,pos,scale,parent=root){const m=new T.Mesh(sphere,mat);m.name=name;m.position.copy(pos);m.scale.copy(scale);parent.add(m);return m;}
 const mantle=ell('Queen armored mantle',shell,V(0,42,-8),V(24,39,21));ell('Lower submerged body',skin,V(0,11,0),V(28,17,23));
 for(let i=-3;i<=3;i++){const x=i*5.0;const m=ell('Longitudinal mantle armor',rib,V(x*1.15,45,-1+Math.abs(i)*.3),V(2.5,30-Math.abs(i)*3,19));m.rotation.z=-i*.04;}
 ell('Forward brow',shell,V(0,51,19),V(21,13,12));ell('Recessed maw',socketMat,V(0,33,28),V(10,9,5));
 for(const side of [-1,1]){const beak=new T.Mesh(new T.ConeGeometry(4.5,16,5),rib);beak.name='Hooked chitin mandible';beak.position.set(side*6,31,32);beak.rotation.set(.35,0,side*.62);root.add(beak);for(let j=0;j<4;j++){const tooth=new T.Mesh(new T.ConeGeometry(.65,4.8,5),rib);tooth.position.set(side*(2.2+j*1.2),38,32-j*.4);tooth.rotation.z=Math.PI+side*.3;root.add(tooth);}}
 for(const s of [-1,1]){ell('Queen amber eye',eyeMat,V(s*12.5,53,29),V(3.6,1.1,1.4));ell('Heavy eye hood',shell,V(s*12.5,56.2,29.3),V(5.4,2.2,3));for(let j=0;j<3;j++){const g=new T.Mesh(new T.ConeGeometry(2.1,13-j*1.5,7),rib);g.position.set(s*(15+j*3),69-j*5,-2-j*3);g.rotation.z=-s*(.3+j*.2);root.add(g);}}
 for(let i=0;i<18;i++){const angle=i/18*Math.PI*2;ell('Lava crust at submerged waist',lavaMat,V(Math.cos(angle)*25,3+Math.sin(i*3),Math.sin(angle)*21),V(3.5,1.2,5));}
 const wake=new T.Mesh(new T.TorusGeometry(32,1.3,8,80),lavaMat);wake.name='Queen lava displacement';wake.rotation.x=-Math.PI/2;wake.position.y=4.6;root.add(wake);
 // Overlapping brow shields strengthen the head's silhouette without moving
 // its eyes, weak points, combat tips, or projectile anchors.
 for(const side of [-1,1])for(let j=0;j<3;j++){
  const plate=ell('Queen cheek carapace',j===0?shell:rib,V(side*(15+j*2.1),48-j*4.4,21-j*2.2),V(3.2,9-j*.8,6.5));
  plate.rotation.z=side*(.2+j*.13);plate.rotation.y=side*.22;
 }
 const crown=new T.Mesh(new T.ConeGeometry(5.5,17,7),shell);crown.name='Queen central crown ridge';crown.position.set(0,79,-4);crown.rotation.x=-.3;root.add(crown);
 const collarGeometry=new T.TorusGeometry(4.65,.9,8,20);
 // Dark dorsal hide and a warm softer underside give each tentacle an
 // anatomical orientation, instead of eight equally lit rubber hoses.
 const armSkin=skin.clone();armSkin.color.setHex(0xffffff);armSkin.vertexColors=true;
 const dorsalColor=new T.Color(0x442b32),ventralColor=new T.Color(0x805344);
 const combatTips=[V(-76,57,36),V(-58,84,16),V(-30,104,10),V(0,115,2),V(31,102,12),V(60,82,20),V(79,54,40),V(4,32,73)];
 const cupBatch=new T.InstancedMesh(new T.TorusGeometry(1,.34,6,12),rib,96);cupBatch.name='Queen gripping cups';cupBatch.frustumCulled=false;cupBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(cupBatch);
 const ray=new T.Raycaster(),banks=bankMeshes.filter(m=>m.name.startsWith('bank-')),eggSites=[],arms=[];
 function tube(){const length=32,radial=12,positions=new Float32Array((length+1)*(radial+1)*3),normals=new Float32Array(positions.length),uv=new Float32Array((length+1)*(radial+1)*2),indices=[];for(let j=0;j<=length;j++)for(let k=0;k<=radial;k++){const n=j*(radial+1)+k;uv[n*2]=k/radial;uv[n*2+1]=j/length;if(j<length&&k<radial){const b=n+radial+1;indices.push(n,b,n+1,n+1,b,b+1);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('normal',new T.BufferAttribute(normals,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(new Float32Array(positions.length),3).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(indices);return{geometry:g,length,radial};}
 for(let i=0;i<8;i++){
  const angle=(i/8)*Math.PI*2,base=V(Math.sin(angle)*22,16+Math.cos(angle)*4,Math.cos(angle)*18),t=tube(),mesh=new T.Mesh(t.geometry,armSkin);mesh.name='Continuous Queen tentacle '+(i+1);mesh.frustumCulled=false;root.add(mesh);
  const tip=new T.Group();tip.name='Queen arm '+(i+1)+' weapon crown';root.add(tip);
  const glandMaterial=red.clone(),gland=ell('Red plasma gland',glandMaterial,V(),V(5,4.1,7.2),tip);
  // An elongated, ribbed gland reads as living tissue; the weak point keeps
  // its original envelope and hit category. No bright three-dot face.
  gland.geometry=sphere.clone();const glandVertices=gland.geometry.attributes.position;
  for(let n=0;n<glandVertices.count;n++){const x=glandVertices.getX(n),y=glandVertices.getY(n),z=glandVertices.getZ(n),ridge=1-.055*(.5+.5*Math.cos(Math.atan2(y,x)*7+i*.4))*(1-z*z);glandVertices.setXYZ(n,x*ridge,y*ridge,z);}
  gland.geometry.computeVertexNormals();
  const mouth=ell('Triplex dark muzzle',socketMat,V(0,0,6.5),V(2.6,2.05,1.25),tip);
  for(const [j,color]of [[0,0x615b49],[1,0x836958],[2,0xc05a27]]){const mat=new T.MeshStandardMaterial({color,roughness:.58,emissive:color,emissiveIntensity:j===2?.24:.025});ell(['Mud port','Needle port','Bomb port'][j],mat,V((j-1)*1.45,(j===1?.2:-.1),7.4),V(.28,.74,.6),tip);}
  // Armor is a root shell mesh, so the existing trace keeps it invulnerable
  // rather than accidentally extending the hittable weapon crown.
  const collar=new T.Mesh(collarGeometry,shell);collar.name='Queen weapon collar '+(i+1);root.add(collar);
  const muzzle=new T.Object3D();muzzle.position.z=8.3;tip.add(muzzle);
  const suckers=[];for(let j=0;j<12;j++){const s=new T.Object3D();s.name='Tentacle gripping cup';root.add(s);suckers.push(s);}
  const side=i%2?1:-1,p=QUEEN_POSITION+(Math.floor(i/2)-1.5)*.009,c=centerAt(p),y=28+(i%4)*8;
  ray.set(V(c.x,y,c.z),V(side,0,0));ray.far=300;const hit=ray.intersectObjects(banks,false)[0];const anchor=hit?.point.clone()||V(c.x+side*(widthAt(p)+5),y,c.z);let normal=hit?.face.normal.clone().transformDirection(hit.object.matrixWorld)||V(-side,0,0);if(normal.x*side>0)normal.negate();const eggCenter=anchor.clone().addScaledVector(normal,5.3);eggSites.push({anchor,normal,center:eggCenter,p,side,radius:3.8,length:5.7,scale:1.35,clearance:20,surface:hit?.object.name||'unqualified-bank'});
  const layTip=eggCenter.clone().sub(root.position).addScaledVector(normal,9);arms.push({id:'queen-arm-'+(i+1),index:i,queenArm:true,root:tip,mouthAnchor:muzzle,tip,muzzle,mesh,collar,glandMaterial,tube:t,base,combatTip:combatTips[i],layTip,suckers,hp:QUEEN_ARM_HP,dead:false,credited:false,position:V(),commitment:false,state:'laying',shotsFired:0,deathAt:null});
 }
 const temp=V(),tangent=V(),u=V(),v=V(),normal=V(),mat=new T.Matrix4(),curve=new T.CatmullRomCurve3([V(),V(),V(),V(),V()]);let lastPose='';
 function pose(time,{attention=0,collapse=0,emergence=1,activeArm=-1,charge=0}={}){const key=[time,attention,collapse,emergence,activeArm,charge,arms.map(a=>a.dead?1:0).join('')].join('/');if(key===lastPose)return;lastPose=key;root.position.y=-3-(1-emergence)*70-collapse*83;wake.position.y=4.6+(1-emergence)*70;mantle.rotation.x=collapse*.18;wake.scale.setScalar(1+Math.sin(time*.8)*.035+collapse*.8);wake.visible=collapse<.95;
  for(const a of arms){a.mesh.visible=a.tip.visible=a.collar.visible=!a.dead&&collapse<.99;for(const s of a.suckers)s.visible=a.mesh.visible;if(!a.mesh.visible)continue;
   const wave=Math.sin(time*.8+a.index*.83),target=a.layTip.clone().lerp(a.combatTip,attention);target.y+=wave*(attention?2.2:2.9);target.z+=Math.cos(time*.63+a.index)*1.5;
   const base=a.base,side=target.x<0?-1:1,lowArm=a.index===7?attention:0;
   // Open a protected central window around the brow. Upper arms curl behind
   // the mantle, while the low arm hooks beneath the jaw. Endpoints, muzzle
   // orientation and attack timing remain the accepted gameplay anchors.
   const bend=a.index%3;
   curve.points[0].copy(base);
   curve.points[1].copy(base).add(V(side*(17+attention*(10+bend*2)),T.MathUtils.lerp(11+attention*(18+bend*3),9,lowArm),8-attention*14));
   curve.points[2].copy(base).lerp(target,.47).add(V(side*(16+attention*(5+bend*2)),T.MathUtils.lerp(16+attention*(13+(a.index%4)*3),-6,lowArm),-13-attention*7));
   curve.points[3].copy(target).add(V(-side*(6+attention*bend*2),T.MathUtils.lerp(14,a.index===7?4:6+(a.index%4)*3,attention),-19));
   curve.points[4].copy(target);
   const pa=a.mesh.geometry.attributes.position,no=a.mesh.geometry.attributes.normal,co=a.mesh.geometry.attributes.color;for(let j=0;j<=a.tube.length;j++){const f=j/a.tube.length;curve.getPoint(f,temp);curve.getTangent(f,tangent).normalize();u.crossVectors(Math.abs(tangent.y)>.91?Z:UP,tangent).normalize();v.crossVectors(tangent,u).normalize();const radius=6.8*Math.pow(1-f,.7)+1.5+Math.sin(f*Math.PI)*.7;for(let k=0;k<=a.tube.radial;k++){const angle=k/a.tube.radial*Math.PI*2;normal.copy(u).multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle));const skinRadius=radius*(1+.022*Math.cos(angle*6+f*7+a.index*.4)*Math.sin(f*Math.PI));const n=j*(a.tube.radial+1)+k;pa.setXYZ(n,temp.x+normal.x*skinRadius,temp.y+normal.y*skinRadius,temp.z+normal.z*skinRadius);no.setXYZ(n,normal.x,normal.y,normal.z);const dorsal=T.MathUtils.smoothstep(normal.y,-.45,.55);co.setXYZ(n,T.MathUtils.lerp(ventralColor.r,dorsalColor.r,dorsal),T.MathUtils.lerp(ventralColor.g,dorsalColor.g,dorsal),T.MathUtils.lerp(ventralColor.b,dorsalColor.b,dorsal));}}
   pa.needsUpdate=no.needsUpdate=co.needsUpdate=true;a.mesh.geometry.computeBoundingSphere();a.tip.position.copy(target);a.position.copy(target).add(root.position);const toward=attention?V(0,45,230).sub(target):a.layTip.clone().sub(target).add(V(-side*4,-2,-2));a.tip.quaternion.setFromUnitVectors(Z,toward.normalize());a.tip.scale.setScalar(1+(activeArm===a.index?charge*.12:0));
   const firing=activeArm===a.index;
   a.glandMaterial.emissiveIntensity=firing?.72+charge*.85:.46;
   a.collar.position.copy(target).add(V(0,0,-3.3).applyQuaternion(a.tip.quaternion));a.collar.quaternion.copy(a.tip.quaternion);a.collar.scale.set(1,.85,1.15).multiplyScalar(a.tip.scale.x);
   for(let j=0;j<a.suckers.length;j++){const f=.13+j*.063;curve.getPoint(f,temp);curve.getTangent(f,tangent);const radius=6.8*Math.pow(1-f,.7)+1.5;a.suckers[j].position.copy(temp).add(V(0,-radius*.78,1));a.suckers[j].quaternion.setFromUnitVectors(Z,V(0,-1,.2).normalize());a.suckers[j].scale.setScalar(1.45-f*.7);}
  }
  let cupCount=0;for(const a of arms)for(const c of a.suckers)if(c.visible){c.updateMatrix();cupBatch.setMatrixAt(cupCount++,c.matrix);}cupBatch.count=cupCount;cupBatch.instanceMatrix.needsUpdate=true;
  root.updateMatrixWorld(true);
 }
 function reset(){lastPose='';for(const a of arms){a.hp=QUEEN_ARM_HP;a.dead=a.credited=a.commitment=false;a.state='laying';a.shotsFired=0;a.deathAt=null;}root.visible=true;pose(0);}
 reset();return{root,arms,eggSites,pose,reset,center:root.position,stats:()=>({arms:arms.map(a=>({id:a.id,hp:a.hp,dead:a.dead,tip:a.position.toArray()})),position:root.position.toArray()})};
}
