import * as T from '../vendor/three.module.js?v=052';
const TAU=Math.PI*2;
export const QUEEN_EYE_DEPTH=16.5;
const hash=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+7,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};

// Original, deterministic tissue maps. Color is pigment only: specular response
// and shadowing remain the work of the scene lights and physical materials.
export function queenMaterials(){
 const size=256,pigment=new Uint8Array(size*size*4),normals=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
 const smooth=t=>t*t*(3-2*t);
 const noise=(u,v,nx,ny)=>{const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy),h=(a,b)=>hash((a+nx)%nx,(b+ny)%ny);return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iy),h(ix+1,iy),fx),T.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),fx),fy);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n=hash(x,y),broad=noise(u,v,4,7),medium=noise(u,v,13,23),fine=noise(u,v,43,59);
  const fissure=Math.max(0,1-Math.abs(noise(u+Math.sin(v*TAU)*.04,v,9,13)-.49)/.045),patch=noise(u,v,7,5);
  // Uneven folds and pores, without a woven checker or evenly spaced rings.
  heights[y*size+x]=broad*.038+medium*.020+fine*.006-fissure*.008;
  const j=(y*size+x)*4,l=Math.round(255*(.69+broad*.19+medium*.075-fissure*.022));
  pigment.set([l,Math.round(l*(.95+patch*.035)),Math.round(l*(.91+patch*.05)),255],j);
  const r=Math.round(255*(.59+.32*patch+.085*fine));roughness.set([r,r,r,255],j);
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=(xx,yy)=>heights[((yy+size)%size)*size+(xx+size)%size];
  const n=new T.Vector3((h(x-1,y)-h(x+1,y))*64,(h(x,y-1)-h(x,y+1))*64,1).normalize();
  normals.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],(y*size+x)*4);
 }
 const tex=(bytes,color=false)=>{const t=new T.DataTexture(bytes,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,5);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.needsUpdate=true;return t;};
 const map=tex(pigment,true),normalMap=tex(normals),roughnessMap=tex(roughness);
 const common={map,normalMap,roughnessMap,normalScale:new T.Vector2(.68,.68)};
 const skin=new T.MeshPhysicalMaterial({...common,color:0x574340,roughness:.85,metalness:0,clearcoat:.035,clearcoatRoughness:.60});
 const mantle=skin.clone();mantle.color.setHex(0x4d514b);mantle.vertexColors=true;mantle.roughness=.87;
 const arm=skin.clone();arm.color.setHex(0xffffff);arm.vertexColors=true;
 const armor=new T.MeshStandardMaterial({...common,color:0x454740,roughness:.76,metalness:.11,normalScale:new T.Vector2(1.2,1.2)});
 const edge=armor.clone();edge.color.setHex(0x605d50);edge.roughness=.79;
 const underside=skin.clone();underside.color.setHex(0x8c7560);underside.roughness=.49;underside.clearcoat=.13;
 const socket=new T.MeshPhysicalMaterial({color:0x090c0b,roughness:.4,metalness:0,clearcoat:.3,clearcoatRoughness:.3});
 const cup=skin.clone();cup.color.setHex(0x927966);cup.roughness=.57;cup.clearcoat=.10;
 const cupInner=skin.clone();cupInner.color.setHex(0x78594b);cupInner.roughness=.78;cupInner.clearcoat=0;
 const scar=skin.clone();scar.color.setHex(0x715b4d);scar.roughness=.69;scar.clearcoat=.08;
 const iris=amberIrisMaterial();
 const pupil=new T.MeshPhysicalMaterial({color:0x040909,roughness:.14,clearcoat:1,clearcoatRoughness:.11});
 const beak=new T.MeshPhysicalMaterial({...common,color:0x2a2923,roughness:.43,metalness:.05,clearcoat:.36,clearcoatRoughness:.22});
 const heat=new T.MeshStandardMaterial({color:0x481d15,emissive:0xcb3e10,emissiveIntensity:.48,roughness:.83});
 return{skin,mantle,arm,armor,edge,underside,socket,cup,cupInner,scar,iris,pupil,beak,heat};
}

// Facial muscles are sculpted into the same continuous mantle surface.
// A second fitted patch could cross the coarse mantle and its breathing pose;
// one tessellated surface keeps both the tissue and its normals continuous.
function facialRelief(x,y){
 const width=mantleRadius(y)*.985,u=(x/width+1)*.5,v=(y-21)/43;
 if(u<=0||u>=1||v<=0||v>=1)return {height:0,blend:0};
 const edge=Math.pow(Math.sin(u*Math.PI),1.3)*Math.pow(Math.sin(v*Math.PI),1.5);
 const swelling=3.8*Math.exp(-(((y-39)/14)**2))*(1-(x/width)**2);
 let orbit=0;
 for(const side of [-1,1]){
  const dx=(x-side*17)/5.2,dy=(y-47)/3.6,q=Math.sqrt(dx*dx+dy*dy);
  orbit+=5.3*Math.exp(-q*q*.40)+3.4*Math.exp(-(((q-1.10)/.25)**2))-3.25*Math.exp(-q*q*2.8);
 }
 const feedingR=Math.sqrt((x/6.7)**2+((y-33)/6.9)**2),a=Math.atan2((y-33)/6.9,x/6.7);
 const feeding=3.2*Math.exp(-(((feedingR-1.12)/.32)**2))-2.7*Math.exp(-feedingR*feedingR*1.7)+.80*Math.cos(a*11+Math.sin(a*3)*.55)*Math.exp(-(((feedingR-1.3)/.45)**2));
 const forehead=(.70*Math.cos(x*.56+Math.sin(y*.24)*.75)+.28*Math.cos(x*1.17-y*.18))*Math.exp(-(((y-52)/8.5)**2))*Math.exp(-((x/15)**2));
 const crease=-.62*Math.exp(-((Math.sin((x+Math.sin(y*.22)*1.6)*.29)/.13)**2))*Math.exp(-(((y-48)/11)**2));
 return {height:edge*(swelling+orbit+feeding+forehead+crease),blend:edge};
}

// Original radial iris pigment: a dark limbal boundary and irregular amber,
// umber and olive fibres. A physical clearcoat supplies the corneal reflection.
function amberIrisMaterial(){
 const size=256,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1,r=Math.sqrt(dx*dx+dy*dy),a=Math.atan2(dy,dx);
  const fibre=.5+.23*Math.sin(a*87+Math.sin(r*17+a*5)*1.8)+.17*Math.sin(a*143-r*10)+.10*Math.sin(a*37+r*15),cloud=.5+.5*Math.sin(a*8+r*9)*Math.sin(a*3-r*14),limbus=1-.73*T.MathUtils.smoothstep(r,.69,.99),inner=1-.30*Math.exp(-(((r-.25)/.09)**2)),pigment=limbus*inner;
  data.set([Math.round((81+fibre*63+cloud*17)*pigment),Math.round((54+fibre*44+cloud*16)*pigment),Math.round((30+fibre*22+cloud*12)*pigment),255],(y*size+x)*4);
 }
 const map=new T.DataTexture(data,size,size);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return new T.MeshPhysicalMaterial({map,color:0xd4cab5,roughness:.34,metalness:0,clearcoat:.85,clearcoatRoughness:.09,emissive:0xffa12c,emissiveMap:map,emissiveIntensity:2.6});
}

// Pear-shaped mantle, built as one continuous anatomical surface. Longitudinal
// relief catches light at game distance; fine striation lives in the normal map.
export function mantleGeometry(){
 const radial=128,length=112,p=[],uv=[],colors=[],idx=[];
 const radius=mantleRadius;
 for(let j=0;j<=length;j++){
  const f=j/length,y=5+f*82,r=radius(y);
  for(let k=0;k<=radial;k++){
   const a=k/radial*TAU,front=Math.cos(a),groove=1+.055*Math.cos(a*8+f*2.4)+.022*Math.sin(a*15-f*5),shoulder=Math.sin(f*Math.PI);
   const x=Math.sin(a)*r*groove,actualY=y+.32*Math.sin(a*5+f*6)*shoulder;
   const face=facialRelief(x,actualY),frontWeight=T.MathUtils.smoothstep(front,.08,.55);
   let z=-8+front*r*(.80+.06*shoulder)*groove+Math.sin(f*Math.PI)*2+face.height*frontWeight;
   // Broad orbital muscle seats the complete socket on this same skin mesh.
   // Its central plane follows the authored eye axis; the outer muscle blends
   // smoothly back into the mantle instead of adding an intersecting patch.
   for(const side of [-1,1]){
    const dx=x-side*17,dy=actualY-47,q=Math.sqrt((dx/5.8)**2+(dy/3.5)**2);
    const seat=frontWeight*(1-T.MathUtils.smoothstep(q,.85,1.65));
    const plane=QUEEN_EYE_DEPTH+(.12-side*.48*dx-.025*dy)/.875;
    z=T.MathUtils.lerp(z,Math.max(z,plane),seat);
   }
   p.push(x,actualY,z);uv.push(k/radial,f);
   const shade=T.MathUtils.smoothstep(front,-.45,.9),patch=.92+.08*Math.sin(a*9+f*7),tissue=face.blend*frontWeight;
   colors.push((.63+.29*shade)*patch*(1+tissue*.22),(.66+.25*shade)*patch*(1-tissue*.12),(.65+.21*shade)*patch*(1-tissue*.07));
   if(j<length&&k<radial){const n=j*(radial+1)+k,b=n+radial+1;idx.push(n,n+1,b,n+1,b+1,b);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();
 const n=g.attributes.normal,average=new T.Vector3();
 for(let j=0;j<=length;j++){const a=j*(radial+1),b=a+radial;average.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,average.x,average.y,average.z);n.setXYZ(b,average.x,average.y,average.z);}
 return g;
}

const mantleProfile=[[5,12],[11,24],[22,28],[36,28.5],[49,26],[61,23.5],[72,17],[81,9],[87,.25]];
function mantleRadius(y){let i=0;while(i<mantleProfile.length-2&&y>mantleProfile[i+1][0])i++;const a=mantleProfile[i],b=mantleProfile[i+1],f=T.MathUtils.smoothstep(y,a[0],b[0]);return T.MathUtils.lerp(a[1],b[1],f);}
function mantleFront(x,y){const f=T.MathUtils.clamp((y-5)/82,0,1),r=mantleRadius(y),a=Math.asin(T.MathUtils.clamp(x/r,-.96,.96)),relief=1+.055*Math.cos(a*8+f*2.4)+.022*Math.sin(a*15-f*5);return -8+Math.sqrt(Math.max(.2,r*r-x*x))*(.80+.06*Math.sin(f*Math.PI))*relief+Math.sin(f*Math.PI)*2;}
// Fitted mineral plates follow the actual mantle surface in all three axes.
// Their bevels sit proud by less than a unit; roots sink into the adjacent hide.
export function fittedMantleShield(cx,cy,rx,ry,seed){
 const ring=24,bands=7,p=[cx,cy,mantleFront(cx,cy)+1.75],uv=[.5,.5],idx=[];
 for(let band=1;band<=bands;band++)for(let i=0;i<ring;i++){
  const a=i/ring*TAU,r=band/bands,variation=.90+.055*Math.sin(a*5+seed)+.035*Math.cos(a*9-seed*.7),x=cx+Math.cos(a)*rx*r*variation,y=cy+Math.sin(a)*ry*r*(.96+.04*Math.sin(a*3+seed));
  const dome=.10+1.65*Math.pow(Math.max(0,1-r*r),.72),ridge=.18*Math.sin(a*3+seed*.41)*Math.sin(r*Math.PI),erosion=.15*Math.sin(x*1.4+y*.7)*Math.sin(y*.92-x*.51)*r;
  p.push(x,y,mantleFront(x,y)+dome+ridge+erosion);uv.push(.5+Math.cos(a)*r*.5,.5+Math.sin(a)*r*.5);
 }
 for(let i=0;i<ring;i++)idx.push(0,1+i,1+(i+1)%ring);
 for(let band=1;band<bands;band++)for(let i=0;i<ring;i++){const a=1+(band-1)*ring+i,b=1+(band-1)*ring+(i+1)%ring,c=a+ring,d=b+ring;idx.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

// A bevelled, irregular mineral shield. Vertex rings create true edge thickness
// instead of flat decals or a stack of identical stretched spheres.
export function shieldGeometry(seed=0){
 const ring=9,p=[0,0,.30],uv=[.5,.5],idx=[];
 for(let band=0;band<2;band++)for(let i=0;i<ring;i++){
  const a=i/ring*TAU,variation=.87+hash(i,seed)*.16,scale=band?1:.80;
  p.push(Math.cos(a)*scale*variation,Math.sin(a)*scale*(1+.10*Math.sin(i*2+seed)),band?-.14:.14);uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);
 }
 for(let i=0;i<ring;i++){const a=1+i,b=1+(i+1)%ring,c=a+ring,d=b+ring;idx.push(0,a,b,a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function flexibleTube(length=64,radial=20){
 const rings=(length+1)*(radial+1),p=new Float32Array((rings+2)*3),uv=new Float32Array((rings+2)*2),idx=[];
 for(let j=0;j<=length;j++)for(let k=0;k<=radial;k++){const n=j*(radial+1)+k;uv[n*2]=k/radial;uv[n*2+1]=j/length*1.8;if(j<length&&k<radial){const b=n+radial+1;idx.push(n,n+1,b,n+1,b+1,b);}}
 // Explicit end caps prevent an exposed cut section at either attachment.
 for(let k=0;k<radial;k++){idx.push(rings,k+1,k);const a=length*(radial+1)+k;idx.push(rings+1,a,a+1);}
 const geometry=new T.BufferGeometry();for(const name of ['position','normal','color'])geometry.setAttribute(name,new T.BufferAttribute(p.slice(),3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(idx);return{geometry,length,radial,capStart:rings,capEnd:rings+1};
}

// Bowl axis is local +Z. A soft flared rim surrounds a concave cavity, giving
// cups an attachment direction and depth even from the Queen's side.
export function cupGeometry(){
 const points=[[.05,-.24],[.30,-.23],[.54,-.11],[.66,.05],[.74,.18],[.86,.22],[1,.12],[.96,-.07],[.72,-.27],[.50,-.35]];
 const g=new T.LatheGeometry(points.map(([r,h])=>new T.Vector2(r,h)),12);g.rotateX(Math.PI/2);return g;
}

// Static anatomy is batched by physical material after assembly. This keeps
// authored plates/folds inspectable in source without paying one draw per fold.
export function batchQueenAnatomy(parent,exclude=new Set()){
 parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),remove=[];
 parent.traverse(o=>{if(!o.isMesh||exclude.has(o)||o.isInstancedMesh)return;const g=o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const group=groups.get(o.material)||[];group.push({geometry:g,name:o.name});groups.set(o.material,group);remove.push(o);});
 for(const o of remove)o.removeFromParent();
 for(const [material,parts]of groups){
  let count=0,indexCount=0;for(const {geometry:g}of parts){count+=g.attributes.position.count;indexCount+=g.index?.count||g.attributes.position.count;}
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2),indices=new Uint32Array(indexCount);let base=0,ix=0;
  for(const {geometry:g}of parts){positions.set(g.attributes.position.array,base*3);normals.set(g.attributes.normal.array,base*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,base*2);const n=g.index?.count||g.attributes.position.count;for(let j=0;j<n;j++)indices[ix++]=base+(g.index?g.index.array[j]:j);base+=g.attributes.position.count;g.dispose();}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(new T.BufferAttribute(indices,1));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,material);mesh.name='Batched Queen '+parts[0].name;mesh.userData.anatomy=parts.map(p=>p.name);parent.add(mesh);
 }
}

// Vascular gland maps keep the target's exact silhouette but replace its candy
// gloss with irregular blood-rich lobes, dry seams and a localized inner glow.
let glandMaps=null;
function glandFromMaps(source){const m=source.clone();Object.assign(m,glandMaps);m.normalScale=new T.Vector2(1.5,1.5);m.bumpMap=null;m.roughness=.72;m.color.setHex(0xb02a39);return m;}
export function vascularGlandMaterial(source){
 if(glandMaps)return glandFromMaps(source);
 const size=256,pigment=new Uint8Array(size*size*4),emission=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n=hash(x,y),blotch=.5+.5*Math.sin(u*TAU*3+Math.sin(v*TAU*4)*.8)*Math.sin(v*TAU*2+Math.sin(u*TAU*2));
  let vein=0;
  for(let branch=0;branch<3;branch++){
   const main=(branch+.5)/3+.050*Math.sin(v*TAU*2+branch*1.7)+.021*Math.sin(v*TAU*5+branch),dist=Math.min(Math.abs(u-main),Math.abs(u-main-1),Math.abs(u-main+1));
   vein=Math.max(vein,Math.exp(-((dist/.0055)**2)));
   const origin=.18+branch*.23,length=.20,along=v-origin;
   if(along>0&&along<length){const off=main+(branch%2?1:-1)*along*.31,du=Math.min(Math.abs(u-off),Math.abs(u-off-1),Math.abs(u-off+1));vein=Math.max(vein,Math.exp(-((du/.0033)**2))*(1-along/length)*.75);}
  }
  const j=(y*size+x)*4,l=.65+blotch*.29-vein*.12;
  pigment.set([Math.round(l*255),Math.round(l*224),Math.round(l*229),255],j);const e=Math.round(255*(.24+blotch*.34-vein*.055));emission.set([e,e,e,255],j);const r=Math.round(255*(.69+vein*.17+n*.045));rough.set([r,r,r,255],j);height[y*size+x]=vein*.075+n*.007+blotch*.055;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(a,b)=>height[((b+size)%size)*size+(a+size)%size],n=new T.Vector3((at(x-1,y)-at(x+1,y))*3,(at(x,y-1)-at(x,y+1))*3,1).normalize();normal.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],(y*size+x)*4);}
 const tex=(data,color=false)=>{const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 glandMaps={map:tex(pigment,true),normalMap:tex(normal),emissiveMap:tex(emission,true),roughnessMap:tex(rough)};return glandFromMaps(source);
}


export function cupInteriorGeometry(){
 const p=[0,0,-.18],uv=[.5,.5],idx=[],profile=[[.28,-.18],[.53,-.11],[.69,.035],[.76,.13]],radial=16;
 for(const [r,z]of profile)for(let k=0;k<radial;k++){const a=k/radial*TAU;p.push(Math.cos(a)*r,Math.sin(a)*r,z);uv.push(.5+Math.cos(a)*r*.5,.5+Math.sin(a)*r*.5);}
 for(let k=0;k<radial;k++)idx.push(0,1+k,1+(k+1)%radial);
 for(let row=0;row<profile.length-1;row++)for(let k=0;k<radial;k++){const a=1+row*radial+k,b=1+row*radial+(k+1)%radial,c=a+radial,d=b+radial;idx.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
