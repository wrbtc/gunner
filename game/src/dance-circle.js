import * as THREE from '../vendor/three.module.js?v=052';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js?v=052';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

// One authored rock apron, grounded below the lava and cut into its own bank.
// All edits are local to this new encounter; the route and aircraft stay exact.
export function createDanceTerrace({scene,world,centerAt,widthAt,eggNests,romanRuins}) {
  const radius=30,ringRadius=15,top=29,options=[];
  const protectedBoxes=romanRuins.sites.map(s=>s.bounds).concat(eggNests.eggs.map(e=>new THREE.Box3().setFromCenterAndSize(e.center,V(e.length*2+4,e.length*2+4,e.length*2+4))));
  for(const p of [.76625,.755,.778,.744,.790])for(const side of [-1,1]){
    const routeCenter=centerAt(p),center=routeCenter.clone();center.x+=side*Math.max(53,widthAt(p)+2);center.y=top;
    const box=new THREE.Box3(center.clone().add(V(-radius-4,-5,-radius-4)),center.clone().add(V(radius+4,42,radius+4)));
    const clearance=Math.min(...protectedBoxes.map(b=>{const dx=Math.max(0,b.min.x-box.max.x,box.min.x-b.max.x),dy=Math.max(0,b.min.y-box.max.y,box.min.y-b.max.y),dz=Math.max(0,b.min.z-box.max.z,box.min.z-b.max.z);return Math.hypot(dx,dy,dz);}));
    options.push({p,side,center,box,clearance,score:clearance-Math.abs(p-.76625)*300});
  }
  options.sort((a,b)=>b.score-a.score);const site=options.find(s=>s.clearance>3);if(!site)throw new Error('No clear dance terrace away from protected eggs and Roman ruins');
  const {center,side}=site,pocketRadius=radius+5,cleared=[],deformed=[];
  for(const mesh of world.collisionMeshes){
    if(!mesh.name.startsWith(`bank-${side}-`))continue;
    const positions=mesh.geometry.attributes.position;let count=0;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),dz=z-center.z;
      if(Math.abs(dz)>=pocketRadius||y<=top-.5||y>=95)continue;
      const boundary=center.x+side*Math.sqrt(pocketRadius*pocketRadius-dz*dz);
      const push=side*(boundary-x);if(push<=0)continue;
      const blend=1-THREE.MathUtils.smoothstep(y,66,95);positions.setX(i,x+side*push*blend);count++;
    }
    if(count){positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();deformed.push({mesh:mesh.name,vertices:count});}
  }
  // Remove only separate masses actually intersecting the new open courtyard.
  // Instanced neighbors elsewhere retain their exact matrices.
  const pocket=new THREE.Box3(center.clone().add(V(-radius-1,.15,-radius-1)),center.clone().add(V(radius+1,49,radius+1)));
  const localMatrix=new THREE.Matrix4(),worldMatrix=new THREE.Matrix4(),zero=new THREE.Matrix4().makeScale(0,0,0);
  for(const mesh of world.collisionMeshes){
    if(mesh.name.startsWith('bank-'))continue;mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();
    if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,localMatrix);worldMatrix.multiplyMatrices(mesh.matrixWorld,localMatrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(worldMatrix);if(box.intersectsBox(pocket)){mesh.setMatrixAt(i,zero);cleared.push({mesh:mesh.name,instance:i});}}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
    else {const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);if(box.intersectsBox(pocket)){mesh.visible=false;mesh.userData.dancePocketCleared=true;cleared.push({mesh:mesh.name});}}
  }
  const root=new THREE.Group();root.name='Ember revel: cooled basalt dance apron';scene.add(root);
  const geo=new THREE.CylinderGeometry(radius,radius+5,32,48,1,false),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),angle=Math.atan2(z,x),rough=1+.035*Math.sin(angle*7+.4)+.026*Math.sin(angle*11);a.setX(i,x*rough);a.setZ(i,z*rough);}
  geo.computeVertexNormals();const floor=new THREE.Mesh(geo,world.rockMaterial);floor.name='Solid cooled dance terrace';floor.position.set(center.x,top-16,center.z);floor.receiveShadow=true;floor.castShadow=true;root.add(floor);root.updateMatrixWorld(true);
  const shadowMat=new THREE.MeshBasicMaterial({color:0x140b05,transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(1,16),shadowMat,8);shadows.name='Dance contact shadows';root.add(shadows);
  const dummy=new THREE.Object3D();for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;dummy.position.set(center.x+Math.cos(angle)*ringRadius,top+.015,center.z+Math.sin(angle)*ringRadius);dummy.rotation.x=-Math.PI/2;dummy.scale.set(1.5,.95,1);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);}shadows.instanceMatrix.needsUpdate=true;
  // A carved eight-armed Queen, rising from a concentric sacrificial dais.
  const sculpture=[],solids=[floor],UP=V(0,1,0);
  const carve=g=>{if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');sculpture.push(g);};
  carve(new THREE.ConeGeometry(3.2,8,16).translate(0,4,0));
  carve(new THREE.SphereGeometry(1,24,18).scale(3.6,5.6,2.9).translate(0,11.2,0));
  carve(new THREE.SphereGeometry(1,20,14).scale(4.2,2.6,3.3).translate(0,7.3,0));
  carve(new THREE.ConeGeometry(1.2,3.8,8).rotateX(Math.PI).translate(0,8.9,3.25));
  for(const side of [-1,1])carve(new THREE.ConeGeometry(.8,4.5,7).rotateZ(-side*.35).translate(side*2.7,16.2,.1));
  for(let i=0;i<8;i++){
    const angle=i/8*Math.PI*2,r=(i%2?8.8:10.1),height=6+(i%3)*2.5;
    const points=[[2.4,7],[4.8,4.4],[r,5],[r, height],[r-1.5,height+2.2]].map(([radius,y])=>V(Math.cos(angle)*radius,y,Math.sin(angle)*radius));
    const curve=new THREE.CatmullRomCurve3(points),g=new THREE.TubeGeometry(curve,28,.82,9,false),pos=g.attributes.position;
    // Taper the sculpted tentacle from its base to a fine inward-hooked tip.
    for(let j=0;j<=28;j++){const t=j/28,c=curve.getPointAt(t),scale=THREE.MathUtils.lerp(1.25,.18,t);for(let k=0;k<=9;k++){const n=j*10+k,v=V().fromBufferAttribute(pos,n).sub(c).multiplyScalar(scale).add(c);pos.setXYZ(n,v.x,v.y,v.z);}}
    g.computeVertexNormals();carve(g);
  }
  const rockGeo=mergeGeometries(sculpture);for(const g of sculpture)g.dispose();rockGeo.computeBoundingBox();
  const basalt=new THREE.MeshStandardMaterial({color:0x24282a,roughness:.92,metalness:.16});
  for(let i=0;i<3;i++){const dais=new THREE.Mesh(new THREE.CylinderGeometry(10.8-i*1.6,11.3-i*1.6,.8,8),basalt);dais.name='Queen altar basalt step '+i;dais.position.copy(center).add(V(0,.4+i*.8,0));dais.castShadow=dais.receiveShadow=true;root.add(dais);solids.push(dais);}
  const ember=new THREE.MeshBasicMaterial({color:new THREE.Color(3.8,.20,.014),toneMapped:false});
  for(let i=0;i<8;i++){
    const angle=i/8*Math.PI*2;
    const channel=new THREE.Mesh(new THREE.BoxGeometry(.15,.035,9.5),ember);channel.name='Incised radial offering channel';channel.position.copy(center).add(V(Math.cos(angle)*22,.025,Math.sin(angle)*22));channel.rotation.y=Math.PI/2-angle;root.add(channel);
    const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.8,1.3,1.2,6),basalt);plinth.name='Ritual brazier '+i;plinth.position.copy(center).add(V(Math.cos(angle)*25,.6,Math.sin(angle)*25));root.add(plinth);solids.push(plinth);
    const coal=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),ember);coal.position.copy(plinth.position).add(V(0,.8,0));root.add(coal);solids.push(coal);
  }
  // Inert black statue, with a faint red seam glow rather than a living creature.
  const rockMat=new THREE.MeshStandardMaterial({color:0x101114,roughness:.94,metalness:.04,emissive:0x8c0710,emissiveIntensity:.17});
  rockMat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vRitualRock;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRitualRock=position;');
    shader.fragmentShader='varying vec3 vRitualRock;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\nfloat fissure=1.-smoothstep(.025,.09,abs(sin(vRitualRock.x*2.1+sin(vRitualRock.y*.7))*sin(vRitualRock.z*2.8+vRitualRock.y*.35)));totalEmissiveRadiance*=.012+fissure*.24;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=vRitualRock;
      diffuseColor.rgb*=.74+.18*sin(p.x*7.+p.z*5.)*sin(p.y*11.);`);
  };
  rockMat.customProgramCacheKey=()=> 'faint-red-basalt-queen-effigy-3';
  const rock=new THREE.Mesh(rockGeo,rockMat);rock.name='Black basalt eight-tentacled Queen effigy';
  rock.position.copy(center);rock.position.y=top+2.4;rock.castShadow=true;rock.receiveShadow=true;rock.userData.surface='rock';root.add(rock);solids.push(rock);
  const sanctuary=createSanctuary({root,center,side,romanRuins,solids,approach:centerAt(site.p-.06).sub(center).setY(0).normalize()});
  root.updateMatrixWorld(true);
  return {root,center,p:site.p,side,top,radius,ringRadius,floor,rock,collisionMeshes:solids,cleared,deformed,shadowMesh:shadows,stats:()=>({center:center.toArray(),p:site.p,normalFlightSeconds:(site.p-.065)/.935*88,radius,ringRadius,top,effigy:{tentacles:8,tiers:3,braziers:8,emissive:true,emissiveIntensity:.17},sanctuary,rock:{name:rock.name,center:rock.position.toArray(),bounds:new THREE.Box3().setFromObject(rock).min.toArray().concat(new THREE.Box3().setFromObject(rock).max.toArray()),collision:true},protectedClearance:site.clearance,deformed,cleared})};
}

// The surviving shrine uses the cliff city's actual weathered stone materials.
// All authored positions are local to the existing apron; +x faces the bank.
function createSanctuary({root,center,side,romanRuins,solids,approach}) {
  const materials=[0,1].map(i=>romanRuins.collisionMeshes.find(m=>m.name.startsWith('Roman cliff masonry ')&&m.name.endsWith('-'+i))?.material);
  if(materials.some(m=>!m))throw new Error('Sanctuary requires the existing Roman limestone and brick');
  const batches=[[],[]],parts=[],columns=[];
  const square=new THREE.Shape();square.moveTo(-.5,-.5);square.lineTo(.5,-.5);square.lineTo(.5,.5);square.lineTo(-.5,.5);square.closePath();
  const block=new THREE.ExtrudeGeometry(square,{depth:.93,bevelEnabled:true,bevelSize:.065,bevelThickness:.035,bevelSegments:1,steps:1}).translate(0,0,-.465);
  function put(source,x,y,z,sx=1,sy=1,sz=1,material=0,rotation=0,label='masonry'){
    let g=source.clone();if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}g.deleteAttribute('uv');g.deleteAttribute('color');
    g.scale(sx,sy,sz);g.rotateY(rotation);
    const a=g.attributes.position,colors=new Float32Array(a.count*3),tint=.76+.12*Math.sin(x*2.4+z*1.7+y*.3);
    for(let i=0;i<a.count;i++){
      const px=a.getX(i),py=a.getY(i),pz=a.getZ(i);
      // Small deterministic chips, never displacing the foundation's support plane.
      const chip=source===block?.985+.015*Math.sin(px*9+py*7+pz*11):1;
      a.setXYZ(i,px*chip,py,pz*chip);
      colors.set([tint,tint*.97,tint*.91],i*3);
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.translate(center.x+side*x,center.y+y,center.z+z);g.computeVertexNormals();g.computeBoundingBox();
    parts.push({label,bounds:g.boundingBox.min.toArray().concat(g.boundingBox.max.toArray())});batches[material].push(g);
  }
  function shaft(height,phase,broken){
    const g=new THREE.CylinderGeometry(.86,.91,height,32,4),a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),z=a.getZ(i),y=a.getY(i),ang=Math.atan2(z,x),flute=1-.055*(1+Math.cos(ang*16));
      const fracture=broken?THREE.MathUtils.smoothstep(y,height*.32,height*.5)*(.36*Math.sin(ang*5+phase)+.17*Math.sin(ang*9)):0;
      a.setXYZ(i,x*flute,y+fracture,z*flute);
    }g.computeVertexNormals();return g;
  }
  // Reference-led circular ruin: stepped annulus leaves the dancers' floor exact.
  function arc(inner,outer,start,end,height){
    const shape=new THREE.Shape();shape.absarc(0,0,outer,start,end,false);
    shape.absarc(0,0,inner,end,start,true);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:32,steps:1});g.rotateX(Math.PI/2);g.translate(0,height,0);return g;
  }
  for(let tier=0;tier<3;tier++){
    const g=arc(18.1,27-tier*.85,0,Math.PI*2-.0001,.6);
    put(g,0,tier*.6,0,1,1,1,0,0,'circular stepped foundation');g.dispose();
  }
  const frontAngle=Math.atan2(approach.z,approach.x*side),layout=[];
  for(let i=0;i<12;i++){
    const angle=frontAngle+i*Math.PI/6,front=Math.cos(angle-frontAngle),height=front>.45?[1.1,2.6,1.7][i%3]:front>-.1?6.2:14;
    layout.push({angle,x:23.1*Math.cos(angle),z:23.1*Math.sin(angle),height,intact:height===14});
  }
  for(const [i,{x,z,height,intact}]of layout.entries()){
    put(block,x,2.05,z,2.9,.5,2.9,1,0,'brick footing');
    put(block,x,2.46,z,2.55,.32,2.55,0,0,'limestone plinth');
    const base=new THREE.CylinderGeometry(1.15,1.27,.38,24);put(base,x,2.81,z);base.dispose();
    const g=shaft(height,i*.7,!intact);put(g,x,3+height/2,z);g.dispose();
    if(intact){const cap=new THREE.CylinderGeometry(1.23,.88,.5,24);put(cap,x,17.25,z);cap.dispose();put(block,x,17.68,z,2.65,.36,2.65,0,0,'capital abacus');}
    columns.push({local:[side*x,z],height:height+3,intact,baseRadius:2.31,ringClearance:23.1-2.31-16.5});
  }
  // Surviving curved entablature is supported at both ends; approach bays collapsed.
  for(let i=0;i<12;i++){
    const a=layout[i],next=layout[(i+1)%12];if(!a.intact||!next.intact)continue;
    for(const [inner,outer,y,h,label]of [[22,24.2,18,.7,'curved architrave'],[21.8,24.4,18.7,.65,'carved frieze'],[21.5,24.7,19.35,.35,'broken cornice']]){
      const g=arc(inner,outer,a.angle,a.angle+Math.PI/6,h);if(side<0){g.scale(-1,1,1);const idx=g.index;if(idx){for(let n=0;n<idx.count;n+=3){const a=idx.getX(n);idx.setX(n,idx.getX(n+2));idx.setX(n+2,a);}}else{const a=g.attributes.position;for(let n=0;n<a.count;n+=3){const v=V().fromBufferAttribute(a,n);a.setXYZ(n,a.getX(n+2),a.getY(n+2),a.getZ(n+2));a.setXYZ(n+2,v.x,v.y,v.z);}}g.computeVertexNormals();}put(g,0,y,0,1,1,1,0,0,label);g.dispose();
    }
    for(let j=0;j<4;j++){const angle=a.angle+(j+.5)*Math.PI/24;put(block,24.45*Math.cos(angle),19,24.45*Math.sin(angle),.42,.7,.22,0,-angle+Math.PI/2,'frieze relief');}
  }
  for(const [i,a]of layout.entries())if(!a.intact){
    const x=a.x*.90,z=a.z*.90;
    const drum=shaft(2.3,i*.4,true);drum.rotateZ(Math.PI/2);put(drum,x,2.68,z,1,1,1,0,a.angle+.3,'fallen fluted drum');drum.dispose();
    put(block,a.x*1.09,2.1,a.z*1.09,1.5,.6,1.1,0,a.angle,'broken capital rubble');
  }
  block.dispose();let triangles=0;
  for(let i=0;i<batches.length;i++){
    const g=mergeGeometries(batches[i]);for(const part of batches[i])part.dispose();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,materials[i]);mesh.name='Altar Roman sanctuary '+(i?'brick footings':'limestone colonnade');mesh.castShadow=mesh.receiveShadow=true;mesh.userData.surface='rock';root.add(mesh);solids.push(mesh);triangles+=g.attributes.position.count/3;
  }
  const bounds=new THREE.Box3();for(const p of parts)bounds.union(new THREE.Box3(V(...p.bounds.slice(0,3)),V(...p.bounds.slice(3))));
  return {columns,parts,opaqueBatches:2,triangles,lights:0,openSide:'approach',approach:approach.toArray(),reference:'circular fluted temple with collapsed approach bays',materialSource:'Roman cliff masonry',bounds:bounds.min.toArray().concat(bounds.max.toArray())};
}
