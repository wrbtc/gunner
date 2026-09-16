import {LAVA_NOISE_GLSL,sampleLavaSurface} from './lava-surface.js?v=054';
import * as THREE from '../vendor/three.module.js?v=052';
import {createBasaltDetail} from './basalt-detail.js?v=052';
import {createHellSky} from './hell-sky.js?v=054-42';
import {createSkyActivity} from './sky-activity.js?v=052';
import {toCreasedNormals} from '../vendor/BufferGeometryUtils.js?v=052';
import {loadCliffGeometry,createCliffBacking} from './cliff-outcrops.js?v=052';

// Original volcanic geology. The same authored meshes are used for shot occlusion.
const noiseGLSL = `
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
float fb(vec2 p){return .53*n2(p)+.27*n2(p*2.03)+.13*n2(p*4.11)+.07*n2(p*8.19);}
`;
export function createHellWorld({scene,route,centerAt,widthAt}) {
  let seed=0x917baa; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const range=(a,b)=>a+(b-a)*random();
  const root=new THREE.Group(); root.name='Volcanic siege gorge';scene.add(root);
  const collisionMeshes=[],chunks=[],animated=[];
  let optionalAssetsClosed=false;
  function closeOptionalAssets(){optionalAssetsClosed=true;}
  const geologyStats={bankChunks:72,wallProfileColumns:39,attachedBasaltColumns:0,instancedRubble:864,contactLedges:0,angledCapMasses:0,heroClefts:0,authoredButtressRegions:5,chains:0,quarryPlatform:false};
  // Neutral local texels keep the procedural bank material valid if a remote
  // texture fails or misses the startup deadline.
  const colorFallback=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);
  const normalFallback=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  colorFallback.needsUpdate=normalFallback.needsUpdate=true;
  const loader=new THREE.TextureLoader();const mapUniforms={rockColor:{value:colorFallback},rockNormal:{value:normalFallback},rockDetail:{value:createBasaltDetail()}};
  const texturesReady=Promise.all(['diff','nor_gl'].map(async(kind)=>{const t=await loader.loadAsync(new URL(`../assets/geology/dark_rock_02_${kind}_1k.jpg`,import.meta.url).href);if(optionalAssetsClosed){t.dispose();return;}t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(kind==='diff')t.colorSpace=THREE.SRGBColorSpace;mapUniforms[kind==='diff'?'rockColor':'rockNormal'].value=t;}));
  const rockMaterial=new THREE.MeshStandardMaterial({color:0xa7adb1,roughness:.88,metalness:.045,side:THREE.DoubleSide,vertexColors:true});
  rockMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,mapUniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGeoWorld; varying vec3 vGeoNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 geoP=vec4(transformed,1.);vec3 geoN=objectNormal;
      #ifdef USE_INSTANCING
      geoP=instanceMatrix*geoP;mat3 geoM=mat3(instanceMatrix);geoN/=vec3(dot(geoM[0],geoM[0]),dot(geoM[1],geoM[1]),dot(geoM[2],geoM[2]));geoN=geoM*geoN;
      #endif
      vGeoWorld=(modelMatrix*geoP).xyz;vGeoNormal=normalize(mat3(modelMatrix)*geoN);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D rockColor,rockNormal,rockDetail;varying vec3 vGeoWorld;varying vec3 vGeoNormal;'+noiseGLSL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 wp=vGeoWorld; vec3 geoFacing=normalize(vGeoNormal)*(gl_FrontFacing?1.:-1.);vec3 bn=pow(abs(geoFacing),vec3(4.));bn/=max(.001,bn.x+bn.y+bn.z);
      // One survey scale (5.55 m) and original vesicles at 1.35 m. Close
      // mineral detail survives glancing light without adding silhouette noise.
      float deposit=n2(wp.xz*.018+vec2(wp.y*.009,0.));
      float bedding=smoothstep(.20,.77,n2(vec2(wp.z*.018+wp.y*.011,wp.y*.074+deposit*1.7)));
      float soot=smoothstep(.52,.83,n2(vec2(wp.z*.031,wp.y*.012)));
      vec3 base=texture2D(rockColor,wp.zy*.18).rgb*bn.x+texture2D(rockColor,wp.xz*.18).rgb*bn.y+texture2D(rockColor,wp.xy*.18).rgb*bn.z;
      vec4 dx=texture2D(rockDetail,wp.zy*.74),dy=texture2D(rockDetail,wp.xz*.74),dz=texture2D(rockDetail,wp.xy*.74);
      vec4 detail=dx*bn.x+dy*bn.y+dz*bn.z;
      float dryAsh=smoothstep(.12,.70,geoFacing.y)*smoothstep(14.,79.,wp.y);
      float damp=(1.-smoothstep(5.,36.,wp.y))*(1.-dryAsh)*(.4+soot*.6);
      // Graphite and cool iron silicates form the mass; sparse ferric seams
      // and pale ash on upward ledges are material identities, not orange light.
      vec3 mineral=mix(vec3(.69,.77,.83),vec3(.91,.79,.66),smoothstep(.60,.84,deposit));
      float mineralGrain=.89+detail.a*.19;
      base*=mineral*(.78+bedding*.32)*(1.-soot*.20)*mix(.72,1.,detail.b)*mineralGrain;
      base=mix(base,base*.66+vec3(.09,.10,.115),dryAsh*.37);
      diffuseColor.rgb*=base*1.82*(1.-damp*.16);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 nx=texture2D(rockNormal,wp.zy*.18).xyz*2.-1.;vec3 ny=texture2D(rockNormal,wp.xz*.18).xyz*2.-1.;vec3 nz=texture2D(rockNormal,wp.xy*.18).xyz*2.-1.;
      vec3 perturb=vec3(0.,nx.y,nx.x)*bn.x+vec3(ny.x,0.,ny.y)*bn.y+vec3(nz.x,nz.y,0.)*bn.z;
      vec3 grainNormal=vec3(0.,dx.g-.5,dx.r-.5)*bn.x+vec3(dy.r-.5,0.,dy.g-.5)*bn.y+vec3(dz.r-.5,dz.g-.5,0.)*bn.z;
      float detailFade=1.-smoothstep(100.,320.,length(cameraPosition-vGeoWorld));
      normal=normalize(normal+mat3(viewMatrix)*(perturb*.43+grainNormal*.47*detailFade));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(.76+detail.a*.18+dryAsh*.12-damp*.30,.43,.98);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      // Look-dev: lava bounce stays on the bank lip. Upper walls stay cold rock.
      float h=max(vGeoWorld.y-1.3,0.);
      float lip=1.-smoothstep(1.32,11.,wp.y);
      float spark=exp(-h*.22)*lip;
      float seam=smoothstep(.55,.92,n2(vec2(wp.z*.11+wp.y*.05,wp.y*.13)));
      vec3 lavaBounce=vec3(3.4,.55,.07)*spark*(.35+.65*max(-geoFacing.y,0.));
      lavaBounce+=vec3(4.2,1.05,.12)*pow(seam,1.35)*spark;
      totalEmissiveRadiance+=lavaBounce;
      totalEmissiveRadiance+=base*vec3(.05,.049,.052);
      float bounce=0.; // anchor for hotCrust onBeforeCompile injection
    `);
  };
  rockMaterial.customProgramCacheKey=()=> 'gunner-lookdev-cold-wall-lip-r1';
  const charMaterial=rockMaterial.clone();charMaterial.color.setHex(0x676e74);charMaterial.onBeforeCompile=rockMaterial.onBeforeCompile;charMaterial.customProgramCacheKey=rockMaterial.customProgramCacheKey;
  // Protected lower banks keep their v0.4 support coordinates and tessellation.
  // Above the ledge, successive hard flow tops and recessed fracture bands
  // form a continuous wall rather than a triangular slope with separate posts.
  const strata=(p,s)=>125+24*Math.sin(p*19+s*.8)+18*Math.sin(p*43+s*1.9)+12*Math.sin(p*73+s);
  const upperProfile=[[10,.16],[11,.19],[14,.29],[13,.32],[17,.44],[15,.48],[20,.60],[18,.63],[25,.76],[22,.80],[30,.91],[29,.95],[41,1.00],[66,.98],[100,.93],[154,.90],[213,.84],[275,.80],[340,.74]];
  // Triangular interpolation produces coherent slanted geological plates,
  // with 19–33m faces. It is not random noise independently applied to vertices.
  const plateHash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  function plateField(u,v){
    const x=Math.floor(u),y=Math.floor(v),a=u-x,b=v-y,h00=plateHash(x,y),h10=plateHash(x+1,y),h01=plateHash(x,y+1),h11=plateHash(x+1,y+1);
    return (a+b<1?h00+(h10-h00)*a+(h01-h00)*b:h11+(h01-h11)*(1-a)+(h10-h11)*(1-b))*2-1;
  }
  function bankProfile(p,side,j,frame=null){
    const w=frame?frame.width:widthAt(p),z=frame?frame.center.z:centerAt(p).z,jag=(Math.sin(z*.09+side*4)+Math.sin(z*.217)*.5);
    if(j<4){const [x,y]=[[-19,2.3],[-12,12.8],[-4,15.3],[5,19.5]][j];return [w+x+jag*.7,y+(j===2?Math.sin(z*.11)*.6:Math.sin(z*.057)*1.2)];}
    const [x,t]=upperProfile[j-4],h=strata(p,side);
    const fault=Math.sin(z*.037+side*2)*3.5+Math.sin(z*.109+side)*2.0;
    const fracture=Math.sin(z*.61+j*1.39)*.8+Math.sin(z*.29-j*.4)*1.1;
    // Two old lava flow tops are locally exposed; other bands stay within the
    // wall mass. Their depths and bedding heights drift independently.
    const exposure=.18+.82*Math.pow(.5+.5*Math.sin(z*.014+side*2+(j===9?0:2.3)),2);
    const recess=(j===9?7:j===13?8:0)*exposure;
    const beddingWarp=(Math.sin(z*.016+side*2)*.038+Math.sin(z*.083+j*.73)*.012)*Math.sin(Math.min(1,t)*Math.PI);
    const rawY=20+(h-20)*(t+beddingWarp),plate=plateField(z/27+rawY*.009+side*11,rawY/19)*7.2+plateField(z/61+side*5,rawY/33)*3.4;
    const relief=j<17?1:j<20?.65:.28;
    return [w+x-recess+fault*(.35+t)+fracture*(j<17?.45:.2)+plate*relief,rawY+Math.sin(z*.054+side)*3+fracture*.4+plate*.13];
  }
  function addSolid(geometry,material,name,{shadow=false}={}){
    geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);collisionMeshes.push(mesh);chunks.push(mesh);return mesh;
  }
  // A continuous three-scale cliff: broad geological buttresses, leaning
  // fracture planes and small eroded recesses. The independent field never
  // consumes gameplay/scenery RNG. Lower-bank triangles remain byte-exact.
  function smoothField(u,v){const x=Math.floor(u),y=Math.floor(v),a=u-x,b=v-y,aa=a*a*(3-2*a),bb=b*b*(3-2*b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(plateHash(x,y),plateHash(x+1,y),aa),THREE.MathUtils.lerp(plateHash(x,y+1),plateHash(x+1,y+1),aa),bb)*2-1;}
  function fractureGap(z,y,side){
    const u=(z+y*.17)/11+side*31,v=y/15+smoothField(z/100,side*3)*.42,x=Math.floor(u),w=Math.floor(v);let first=20,second=20;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=x+i+.2+plateHash(x+i,w+j)*.6,cy=w+j+.2+plateHash(x+i+71,w+j+23)*.6,d=Math.hypot(u-cx,v-cy);if(d<first){second=first;first=d;}else if(d<second)second=d;}
    return second-first;
  }
  function cliffPoint(p,side,fj,frame=null){
    const lo=Math.floor(fj),hi=Math.min(22,lo+1),t=fj-lo,a=bankProfile(p,side,lo,frame),b=bankProfile(p,side,hi,frame),c=frame?frame.center:centerAt(p);
    let x=THREE.MathUtils.lerp(a[0],b[0],t),y=THREE.MathUtils.lerp(a[1],b[1],t);
    // Independent asymmetrical watersheds shift over height: no repeated rows
    // of collars, pickets, identical caps or circular noise bumps.
    const blend=THREE.MathUtils.smoothstep(fj,3,6)*(1-THREE.MathUtils.smoothstep(fj,16,22));
    const domain=c.z+y*.21+smoothField(c.z/155,side*17)*26;
    let broad=smoothField(domain/69+side*91,y/110)*13;
    for(const [station,bank,width,depth] of [[.14,-1,.021,13],[.29,1,.030,10],[.47,-1,.019,16],[.65,1,.027,12],[.84,-1,.032,15]])if(side===bank){const region=Math.exp(-Math.pow((p-station)/width,2));broad-=region*depth*Math.sin(THREE.MathUtils.clamp((y-22)/145,0,1)*Math.PI);}

    const joint=plateField(domain/19+side*37,y/33+smoothField(c.z/93,side)*.7);
    const ledge=plateField(c.z/11+side*13,y/8.7+c.z*.008)*1.5;
    const erosion=smoothField(c.z/3.2+side*57,y/3.7)*.65;
    const gap=fractureGap(c.z,y,side),recess=(1-THREE.MathUtils.smoothstep(gap,.045,.28))*1.8;
    x+=(broad+joint*6.6+ledge+erosion+recess)*blend;
    y+=(smoothField(c.z/28+side*8,y/19)*2.5+joint*.45)*blend;
    return [c.x+side*x,y,c.z];
  }
  for(const side of [-1,1])for(let chunk=0;chunk<18;chunk++){
    for(const upper of [false,true]){
      const positions=[],indices=[],colors=[],rows=upper?96:32,cols=upper?39:4;
      for(let r=0;r<=rows;r++){
        const p=(chunk+r/rows)/18,c=centerAt(p);
        for(let j=0;j<cols;j++){
          if(!upper){const [x,y]=bankProfile(p,side,j);positions.push(c.x+side*x,y,c.z);}
          else if(j===0){
            // Stitch to the exact piecewise-linear predecessor ledge boundary.
            const rr=r/3,r0=Math.floor(rr),r1=Math.min(32,r0+1),p0=(chunk+r0/32)/18,p1=(chunk+r1/32)/18,a=cliffPoint(p0,side,3),b=cliffPoint(p1,side,3);
            positions.push(...a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],rr-r0)));
          }else positions.push(...cliffPoint(p,side,3+j*.5));
        }
      }
      for(let r=0;r<rows;r++)for(let j=0;j<cols-1;j++){const a=r*cols+j,b=a+cols;if(side===1)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);}
      let geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
      if(upper){
        for(let i=0;i<positions.length;i+=3){const y=positions[i+1],z=positions[i+2],gap=fractureGap(z,y,side),cavity=THREE.MathUtils.smoothstep(gap,.045,.26),mineral=.5+.5*smoothField(z/48+side*9,y/39),shade=(.76+cavity*.24)*(.89+mineral*.11);colors.push(shade*(.97+mineral*.03),shade,shade*(1.04-mineral*.03));}
        geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const original=geo,smooth=geo.toNonIndexed();geo=toCreasedNormals(geo,.95);const cn=geo.attributes.normal,sn=smooth.attributes.normal,n=new THREE.Vector3(),smoothN=new THREE.Vector3();for(let k=0;k<cn.count;k++){n.set(cn.getX(k),cn.getY(k),cn.getZ(k)).multiplyScalar(.30).addScaledVector(smoothN.set(sn.getX(k),sn.getY(k),sn.getZ(k)),.70).normalize();cn.setXYZ(k,n.x,n.y,n.z);}smooth.dispose();original.dispose();
      }
      const mesh=addSolid(geo,rockMaterial,`bank-${side}-${chunk}${upper?'-cliff':''}`,{shadow:true});mesh.userData.authoredContinuousCliff=upper;
    }
  }
  // Angular broken lava blocks have broad planes and chipped corners. They do
  // not reuse the round icosahedral silhouette that made the old walls read CG.
  function stoneGeometry(){
    const geo=new THREE.DodecahedronGeometry(1,0),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=1+.13*Math.sin(x*13+y*3)+.10*Math.sin(z*17-y*9);pos.setXYZ(i,x*n,y*(1+.14*Math.sin(x*19+z*13)),z*n);}
    geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
  }
  const stone=stoneGeometry();
  const dummy=new THREE.Object3D();
  // Preserve the predecessor talus random stream after retiring 432 repeated
  // collar prisms and 36 cap copies. New geology uses its own coordinate field.
  for(let legacyDraw=0;legacyDraw<18*182;legacyDraw++)random();
  // Fewer, thicker talus fragments preserve the ledge contact, avoiding the
  // former blanket of triangular darts and thin floating decorative shelves.
  for(let chunk=0;chunk<18;chunk++){
    const rubble=new THREE.InstancedMesh(stone,rockMaterial,48);
    rubble.name=`Grounded angular talus ${chunk}`;
    for(let i=0;i<48;i++){
      const p=(chunk+range(.01,.99))/18,side=i%2?1:-1,c=centerAt(p),x=range(-10,5),scale=i<16?range(1.1,2.3):range(.45,1.1);
      const left=x<-4?1:2,t=x<-4?(x+12)/8:(x+4)/9,a=bankProfile(p,side,left),b=bankProfile(p,side,left+1),y=THREE.MathUtils.lerp(a[1],b[1],THREE.MathUtils.clamp(t,0,1));
      dummy.position.set(c.x+side*(widthAt(p)+x),y+scale*.22,c.z);dummy.rotation.set(range(-.22,.22),range(0,6.28),range(-.22,.22));dummy.scale.set(scale*range(1.0,1.5),scale*.85,scale*range(1.0,1.45));dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);
    }
    rubble.receiveShadow=true;rubble.computeBoundingSphere();root.add(rubble);chunks.push(rubble);
  }
  // Retired five repeated extruded arch blocks. Major buttresses and recessed
  // fracture bays are part of the continuous canyon field, never pasted solids.
  const lavaUniforms={uTime:{value:0}};
  const lavaMat=new THREE.ShaderMaterial({uniforms:lavaUniforms,side:THREE.DoubleSide,extensions:{derivatives:true},
    vertexShader:`varying vec3 vP;uniform float uTime;void main(){vec3 p=position;p.y+=sin(p.x*.19+uTime*.8)*sin(p.z*.1-uTime)*.18;vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec3 vP;uniform float uTime;${LAVA_NOISE_GLSL}
      void main(){
      // The current carries coherent crust downstream. Cross-stream shear and
      // two bounded warps tear up the straight edges of the underlying domains.
      vec2 metres=vP.xz+vec2(0.,uTime*.52);
      float bend=fb(metres*vec2(.012,.006)+vec2(7.,2.));
      vec2 p=metres*vec2(.145,.071);
      p.x+=(bend-.5)*3.1;
      vec2 drift=vec2(n2(p*.61+3.),n2(p*.73+19.));
      p+=(drift-.5)*1.22;
      p+=(vec2(n2(p*2.37+7.),n2(p*2.11+31.))-.5)*.43;
      vec2 cell=floor(p),f=fract(p);float d1=9.,d2=9.,plateId=0.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec2 o=vec2(float(x),float(y)),id=cell+o;
        vec2 rnd=vec2(h2(id),h2(id+27.));
        float weight=.88+.24*h2(id+53.);
        float d=length(o+.07+.86*rnd-f)*weight;
        if(d<d1){d2=d1;d1=d;plateId=h2(id+91.);}else d2=min(d2,d);
      }
      float gap=d2-d1,aa=max(.0015,fwidth(gap)*.55);
      float fracture=n2(metres*vec2(.047,.031)+11.);
      float width=mix(.011,.059,smoothstep(.28,.76,fracture));
      float fissure=1.-smoothstep(width-aa,width+.034+aa,gap);
      float fresh=1.-smoothstep(width*.13-aa,width*.46+aa,gap);
      // Only some borders have pulled apart. The others are cool, deep joints.
      float parted=smoothstep(.30,.66,fracture);
      float molten=fissure*parted;
      float core=fresh*parted;
      // Broad sinuous molten currents cut through rafts instead of outlining
      // every polygon. Hard-edged cooling skin interrupts the exposed liquid.
      float current=fb(vec2(metres.x*.026+(bend-.5)*.54,metres.y*.010)+vec2(5.,13.));
      float currentEdge=abs(current-.535);
      float currentAA=max(.0007,fwidth(currentEdge)*.65);
      float opening=1.-smoothstep(.060-currentAA,.115+currentAA,currentEdge);
      float hotCurrent=1.-smoothstep(.022-currentAA,.058+currentAA,currentEdge);
      float skin=n2(metres*vec2(.37,.17)+vec2(0.,uTime*.012));
      float skinRafts=smoothstep(.47,.70,skin);
      opening*=1.-skinRafts*.68;
      hotCurrent*=1.-skinRafts*.82;
      molten=max(molten,opening);
      core=max(core,hotCurrent*.80);
      // Coarse buckling survives the flight angle; small rope/pit detail fades
      // by footprint instead of turning into a glowing pixel carpet at distance.
      float grain=n2(metres*.89+9.),pits=n2(metres*2.63+41.);
      float ropePhase=metres.y*2.05+metres.x*.27+skin*5.2;
      float rope=.5+.5*sin(ropePhase);
      rope=rope*rope*rope;
      float footprint=max(length(dFdx(metres)),length(dFdy(metres)));
      float detail=1.-smoothstep(.40,2.4,footprint);
      float raft=smoothstep(.018,.135,gap)*(1.-opening);
      float hair=n2(metres*vec2(.94,.42)+19.);
      float hair2=n2(metres*vec2(2.2,.9)+7.);
      float innerCrack=smoothstep(.54,.79,hair)*smoothstep(.46,.74,hair2);
      float plateKeep=smoothstep(.88,.98,plateId);
      float thickness=raft*(.20+plateKeep*.22);
      float crustHeight=thickness+raft*((grain-.5)*.10+rope*.04-pits*pits*.025)*detail;
      crustHeight+=opening*rope*.043*detail;
      crustHeight-=innerCrack*raft*plateKeep*.04*detail;
      // Recover the height gradient in world metres, then shade the crust's
      // relief against the cool sky. This changes shading only, not collision.
      vec2 dx=dFdx(metres),dy=dFdy(metres);
      float determinant=dx.x*dy.y-dx.y*dy.x;
      float safeDet=abs(determinant)>.00001?determinant:(determinant<0.?-.00001:.00001);
      float hx=dFdx(crustHeight),hy=dFdy(crustHeight);
      vec2 gradient=vec2(hx*dy.y-hy*dx.y,hy*dx.x-hx*dy.x)/safeDet;
      gradient=clamp(gradient,vec2(-2.4),vec2(2.4));
      vec3 normal=normalize(vec3(-gradient.x,1.,-gradient.y));
      float sky=max(dot(normal,normalize(vec3(-.32,.86,.37))),0.);
      float ridgeLight=.52+.48*sky;
      float cavity=mix(.82,1.,smoothstep(.012,.13,gap));
      vec3 crust=mix(vec3(.009,.008,.007),vec3(.016,.014,.012),.08+grain*.10);
      crust=mix(crust,vec3(.020,.016,.014),plateKeep*raft*.40);
      crust*=ridgeLight*cavity*(.90+.10*detail*pits);
      crust=mix(crust,crust*vec3(.05,.040,.034),innerCrack*raft*plateKeep*.90);
      float coolSkin=raft*(.78+skinRafts*.22);
      crust=mix(crust,vec3(.009,.008,.007)*ridgeLight,coolSkin*.96);
      crust+=vec3(.22,.03,.005)*pow(1.-raft,2.)*parted*.025*plateKeep;
      // Dim warm plate undersides are distinct from exposed liquid. Peak
      // blackbody color is restricted to a minority of the hottest openings.
      float lip=(1.-smoothstep(.055,.145,gap))*parted*(1.-molten);
      crust+=lip*vec3(.08,.015,.003);
      float pulse=.94+.06*sin(uTime*2.4+metres.y*.04);
      float liquidRope=mix(1.,.48,rope*detail)*(1.-skinRafts*.18);
      vec3 liquid=mix(vec3(.32,.02,.002),vec3(1.45,.32,.025),clamp(molten*.88+core*.38,0.,1.));
      liquid*=liquidRope*pulse;
      float hottest=pow(clamp(core,0.,1.),2.4)*smoothstep(.42,.76,grain);
      liquid+=hottest*vec3(1.85,.7,.12);
      float edge=smoothstep(.46,.90,molten);
      vec3 col=mix(crust,liquid,edge);
      float distanceDetail=1.-smoothstep(.35,1.30,max(length(dFdx(p)),length(dFdy(p))));
      vec3 farColor=vec3(.012,.009,.007)+opening*vec3(.22,.04,.008);
      col=mix(farColor,col,distanceDetail);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const lavaPos=[],lavaIdx=[];for(let i=0;i<=280;i++){const p=i/280,c=centerAt(p),w=widthAt(p)-11;lavaPos.push(c.x-w,1.3,c.z,c.x+w,1.3,c.z);}for(let i=0;i<280;i++){const a=i*2;lavaIdx.push(a,a+2,a+1,a+1,a+2,a+3);}
  const lavaGeo=new THREE.BufferGeometry();lavaGeo.setAttribute('position',new THREE.Float32BufferAttribute(lavaPos,3));lavaGeo.setIndex(lavaIdx);lavaGeo.computeVertexNormals();const lava=new THREE.Mesh(lavaGeo,lavaMat);lava.name='Crusted molten river';lava.userData.lavaMaterial=lavaMat;lava.userData.surface='lava';root.add(lava);collisionMeshes.push(lava);
  // Visual-only bank lip. Not a collider. Same stations as river edge (widthAt-11).
  const lipPos=[],lipUv=[],lipIdx=[];
  for(const side of [-1,1]){const start=lipPos.length/3;for(let i=0;i<=280;i++){const p=i/280,c=centerAt(p),edge=widthAt(p)-11;lipPos.push(c.x+side*edge,1.38,c.z,c.x+side*(edge+2.4),4.15,c.z);lipUv.push(0,p,1,p);}for(let i=0;i<280;i++){const a=start+i*2;if(side===1)lipIdx.push(a,a+2,a+1,a+1,a+2,a+3);else lipIdx.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const lipGeo=new THREE.BufferGeometry();lipGeo.setAttribute('position',new THREE.Float32BufferAttribute(lipPos,3));lipGeo.setAttribute('uv',new THREE.Float32BufferAttribute(lipUv,2));lipGeo.setIndex(lipIdx);lipGeo.computeBoundingSphere();
  const bankLip=new THREE.Mesh(lipGeo,lavaMat);bankLip.name='lava-bank-lip';bankLip.renderOrder=2;root.add(bankLip);chunks.push(bankLip);

  // Visual continuation only: gameplay ends remain inside a longer physical
  // canyon. Every old bank/lava vertex and collider stays in its original place.
  const continuations={length:1800,meshes:[],ends:[],maxTriangles:0};
  const continuationGroup=new THREE.Group();continuationGroup.name='Distant canyon continuations';root.add(continuationGroup);
  function continuationFrame(edge,d){
    const sign=edge===0?-1:1,p=edge+sign*d/route.getLength(),origin=centerAt(edge),tangent=route.getTangentAt(edge).multiplyScalar(sign);tangent.y=0;tangent.normalize();
    // Integrate a gently turning channel. Zero turn at the junction preserves
    // its tangent; the far reach goes behind real intervening walls.
    const center=origin.clone(),steps=Math.max(1,Math.ceil(d/12)),step=d/steps,turn=edge===0?-.96:1.08;
    for(let i=0;i<steps;i++){const u=(i+.5)*step/continuations.length,angle=turn*(1-Math.cos(Math.PI*u))*.5,cs=Math.cos(angle),sn=Math.sin(angle);center.x+=(tangent.x*cs-tangent.z*sn)*step;center.z+=(tangent.x*sn+tangent.z*cs)*step;}
    const width=widthAt(edge)+(Math.sin(d/180+edge*3)-Math.sin(edge*3))*11*(1-Math.exp(-d/100));
    return {center,width,p};
  }
  function continuationMesh(geometry,material,name){geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.visualContinuation=true;continuationGroup.add(mesh);continuations.meshes.push(mesh);continuations.maxTriangles+=(geometry.index?.count||geometry.attributes.position.count)/3;return mesh;}
  const distances=[0,320,720,1200,1800],profile=[0,1,2,3,...Array.from({length:38},(_,i)=>3+(i+1)*.5)];
  for(const edge of [0,1]){
    const label=edge===0?'upstream':'downstream',end={edge,label,seams:[],riverSeam:[],chunks:[]};continuations.ends.push(end);
    for(let chunk=0;chunk<distances.length-1;chunk++){
      const rows=chunk===0?32:16,frames=Array.from({length:rows+1},(_,r)=>continuationFrame(edge,THREE.MathUtils.lerp(distances[chunk],distances[chunk+1],r/rows)));
      for(const side of [-1,1]){
        const positions=[],colors=[],indices=[];
        for(let r=0;r<=rows;r++)for(const fj of profile){const f=frames[r];let point;
          if(fj<3){const [x,y]=bankProfile(f.p,side,fj,f);point=[f.center.x+side*x,y,f.center.z];}else point=cliffPoint(f.p,side,fj,f);
          positions.push(...point);
          if(fj<=3)colors.push(1,1,1);else{const y=point[1],z=point[2],gap=fractureGap(z,y,side),cavity=THREE.MathUtils.smoothstep(gap,.045,.26),mineral=.5+.5*smoothField(z/48+side*9,y/39),shade=(.76+cavity*.24)*(.89+mineral*.11);colors.push(shade*(.97+mineral*.03),shade,shade*(1.04-mineral*.03));}
        }
        for(let r=0;r<rows;r++)for(let j=0;j<profile.length-1;j++){const a=r*profile.length+j,b=a+profile.length;if((side===1)===(edge===1))indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
        const mesh=continuationMesh(geometry,rockMaterial,`Canyon ${label} bank ${side} ${chunk}`);end.chunks.push(mesh.name);
        if(chunk===0)end.seams.push({side,mesh:mesh.name,profile:profile.slice(),positions:Array.from(geometry.attributes.position.array.slice(0,profile.length*3))});
      }
      const positions=[],indices=[];for(const f of frames){const w=f.width-11;positions.push(f.center.x-w,1.3,f.center.z,f.center.x+w,1.3,f.center.z);}for(let r=0;r<rows;r++){const a=r*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=continuationMesh(geometry,lavaMat,`Canyon ${label} river ${chunk}`);end.chunks.push(mesh.name);if(chunk===0)end.riverSeam=Array.from(geometry.attributes.position.array.slice(0,6));
    }
  }
  // Falls carry streaked incandescent liquid from rim fractures into the river.
  const fallMat=new THREE.ShaderMaterial({uniforms:lavaUniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime;
      void main(){
        vUv=uv;vec3 p=position;float across=uv.x-.5;float stream=1.-smoothstep(.06,.4,abs(across));
        p.y+=sin(uv.y*22.-uTime*2.4)*stream*.18;
        vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader:`varying vec2 vUv;varying vec3 vW;uniform float uTime;${noiseGLSL}
      void main(){
        // vUv.y is 0..1 along the generated plane (river at 0). Crusted core,
        // braid, and ragged edges replace the old painted ribbon.
        float x=vUv.x-.5,y=vUv.y,t=uTime;
        float m1=(fb(vec2(y*1.55-t*.06,2.3))-.5)*.26;
        float m2=(n2(vec2(y*4.6-t*.17,6.2))-.5)*.1;
        float center=m1+m2;
        float fat=mix(.4,.13,smoothstep(0.,.82,y));
        fat*=.7+.5*n2(vec2(y*2.1,.8));
        fat=clamp(fat,.06,.48);
        float d=abs(x-center);
        float b2=center+(n2(vec2(y*1.25,11.4))-.5)*.2;
        float fat2=fat*.42*smoothstep(.22,.55,n2(vec2(y*1.05+3.,4.2)));
        float d2=abs(x-b2);
        float mask=1.-smoothstep(fat*.5,fat,d);
        mask=max(mask,(1.-smoothstep(fat2*.45,fat2,d2))*.88);
        float ragged=n2(vec2((x-center)*20.,y*8.2-t*.55));
        mask*=smoothstep(.1,.46,ragged+mask*.32);
        float dry=n2(vec2(y*3.1-t*.22,(x-center)*7.5));
        mask*=mix(.28,1.,smoothstep(.16,.52,dry));
        float coreD=min(d/max(fat,.001),d2/max(fat2,.001));
        float flow=fb(vec2((x-center)*8.4,y*5.2-t*1.45));
        float ropes=.5+.5*sin(y*28.-t*3.1+(x-center)*14.); ropes*=ropes;
        float molten=mask*(1.-smoothstep(0.,.58,coreD));
        molten*=.35+.65*flow; molten*=mix(.7,1.,ropes);
        float crust=mask*(1.-molten*.82);
        vec3 col=vec3(.03,.016,.01);
        col=mix(col,vec3(.1,.04,.014),crust);
        col+=molten*vec3(1.05,.14,.012);
        col+=pow(molten*flow,2.1)*vec3(1.55,.42,.05);
        col+=pow(molten,4.6)*vec3(1.35,.75,.18)*.4;
        float alpha=smoothstep(.015,.2,mask);
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const splashGeo=new THREE.PlaneGeometry(6.5,3.2);splashGeo.computeBoundingSphere();
  for(const [p,side] of [[.12,1],[.28,-1],[.43,1],[.60,-1],[.77,1],[.87,-1]]){
    const c=centerAt(p),w=widthAt(p),h=(strata(p,side)-20)*.81+17,geo=new THREE.PlaneGeometry(14,h,8,64),gp=geo.attributes.position,uv=geo.attributes.uv;
    const fallFront=(profile,y)=>{let nearest=Infinity;for(let j=0;j<profile.length-1;j++){const a=profile[j],b=profile[j+1];if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1])&&Math.abs(b[1]-a[1])>.01)nearest=Math.min(nearest,THREE.MathUtils.lerp(a[0],b[0],(y-a[1])/(b[1]-a[1])));}return Number.isFinite(nearest)?nearest:profile[0][0];};
    let baseX=c.x,baseZ=c.z;
    for(let i=0;i<gp.count;i++){
      const u=uv.getX(i),v=uv.getY(i),y=2+h*v,z=c.z+(u-.5)*14+Math.sin(v*6)*1.7;
      const localP=THREE.MathUtils.clamp(p+(c.z-z)/3050,0,1),localC=centerAt(localP);
      // A descending melt sheet falls freely across an undercut. The minimum
      // of all upper cliff lips is the gravity envelope, so it never crawls
      // backwards along the undersides of successive rock recesses.
      const profile=Array.from({length:3},(_,j)=>bankProfile(localP,side,j)).concat(Array.from({length:39},(_,j)=>{const v=cliffPoint(localP,side,3+j*.5);return [(v[0]-localC.x)*side,v[1]];}));
      let face=fallFront(profile,y);
      for(let above=y+1.5;above<=2+h;above+=1.5)face=Math.min(face,fallFront(profile,above));
      const fray=(n=>Math.sin(n*2.19)*Math.sin(n*.79))((1-v)*21+u*3)*.13;
      const bulge=Math.pow(1-Math.abs(u-.5)*2,2)*1.05;
      gp.setXYZ(i,localC.x+side*(face-.85+fray-bulge),y,z);
      if(v<.02&&Math.abs(u-.5)<.08){baseX=localC.x+side*(face-1.4);baseZ=z;}
    }
    geo.computeVertexNormals();geo.computeBoundingSphere();const m=new THREE.Mesh(geo,fallMat);m.name=`Wall-seated molten cascade ${p}`;m.renderOrder=2;root.add(m);chunks.push(m);
    const splash=new THREE.Mesh(splashGeo,fallMat);splash.name=`Fall splash ${p}`;splash.position.set(baseX,1.48,baseZ);splash.rotation.x=-1.05;splash.renderOrder=3;splash.frustumCulled=false;root.add(splash);chunks.push(splash);
    void w;
  }
  // Sparse scanned faces provide natural fracture silhouettes at the major
  // route reveals. Each open scan now has a full perimeter rock haunch and
  // deep rear closure; the visible underside joins actual shot/floor collision.
  const cliffsReady=loadCliffGeometry().then(geometry=>{
    if(optionalAssetsClosed){geometry.dispose();return;}
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const baseBacking=createCliffBacking(geometry);
    const stations=[[.075,1,7.5,33],[.172,-1,8.2,42],[.307,1,6.6,52],[.428,-1,8.7,35],[.548,1,7.1,48],[.661,-1,9.0,40],[.787,1,7.8,47],[.916,-1,6.9,38]];
    const bankRay=new THREE.Raycaster(),banks=collisionMeshes.filter(m=>m.name.startsWith('bank-'));root.updateMatrixWorld(true);
    for(const [i,[p,side,scale,baseY]]of stations.entries()){
      // Each outcrop is a coherent, continuous deformation of the original
      // scan and its closed backing together. No identical silhouette remains.
      const variant=geometry.clone(),backingGeometry=baseBacking.clone();
      const deform=g=>{const pos=g.attributes.position;for(let k=0;k<pos.count;k++){const x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k),depth=THREE.MathUtils.clamp(z,-3.5,.5);pos.setXYZ(k,x*(.76+plateHash(i,1)*.55)+Math.sin(y*1.31+i*2.7)*.25,y*(.80+plateHash(i,2)*.52)+Math.sin(x*1.1+i)*.24,z+Math.sin(x*1.8+y*.7+i*1.9)*.22+smoothField(x*1.5+i*13,y*1.3)*.11*THREE.MathUtils.smoothstep(depth,-4,-1));}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();};
      deform(variant);deform(backingGeometry);
      const c=centerAt(p),bottom=variant.boundingBox.min.y,faceY=baseY+(variant.boundingBox.max.y-bottom)*scale*.52;
      bankRay.set(new THREE.Vector3(c.x,faceY,c.z),new THREE.Vector3(side,0,0));bankRay.far=650;
      const contact=bankRay.intersectObjects(banks,false)[0];if(!contact)throw new Error('Authored scan missing bank contact');
      const mesh=addSolid(variant,rockMaterial,`Scanned embedded cliff face ${i}`,{shadow:true});
      mesh.position.set(contact.point.x-side*1.55*scale,baseY-bottom*scale,c.z);
      mesh.rotation.y=-side*Math.PI*.5+(plateHash(i,7)-.5)*.19;mesh.scale.setScalar(scale);mesh.updateMatrixWorld(true);
      const backing=addSolid(backingGeometry,rockMaterial,`Cliff rock support ${i}`,{shadow:true});
      backing.position.copy(mesh.position);backing.rotation.copy(mesh.rotation);backing.scale.copy(mesh.scale);backing.updateMatrixWorld(true);
      backing.userData={station:p,side,scanIndex:i,outerBoundaryEdges:backingGeometry.userData.outerBoundaryEdges,bankContact:contact.point.toArray(),uniqueVariant:i};
    }
    geologyStats.scannedCliffFaces=stations.length;
    geologyStats.supportedCliffFaces=stations.length;geologyStats.cliffSupportTriangles=baseBacking.index.count/3*stations.length;
    geologyStats.scannedCliffTriangles=(geometry.index?.count||geometry.attributes.position.count)/3*stations.length;
    geometry.dispose();baseBacking.dispose();
  });
  const ready=Promise.all([texturesReady,cliffsReady]);
  const hellSky=createHellSky(scene);
  const skyActivity=createSkyActivity(scene);
  // Hot intrusive basalt is mostly buried in the accepted wall. Its real
  // protruding crust casts/receives shadows; emissive fissures remain localized.
  const hotCrust=rockMaterial.clone();hotCrust.color.setHex(0x77716b);
  hotCrust.onBeforeCompile=shader=>{
    rockMaterial.onBeforeCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      vec3 hotHash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}`);
    shader.fragmentShader=shader.fragmentShader.replace('float bounce=',`
      // Volumetric fissures follow every face, without projected stripe stretch.
      vec3 hp=vGeoWorld*.32;
      hp+=vec3(n2(hp.xy*.67),n2(hp.yz*.71+9.),n2(hp.zx*.63+17.))*.55;
      hp+=vec3(n2(hp.yz*3.1),n2(hp.xz*3.3),n2(hp.xy*3.7))*.12;
      vec3 cell=floor(hp),hf=fract(hp);float hd1=8.,hd2=8.;
      for(int hz=-1;hz<=1;hz++)for(int hy=-1;hy<=1;hy++)for(int hx=-1;hx<=1;hx++){
        vec3 ho=vec3(float(hx),float(hy),float(hz));vec3 jitter=hotHash(cell+ho);
        float hd=length(ho+.15+jitter*.70-hf);if(hd<hd1){hd2=hd1;hd1=hd;}else hd2=min(hd2,hd);
      }
      float fracture=1.-smoothstep(.018,.065,hd2-hd1);
      float coreHeat=1.-smoothstep(.005,.023,hd2-hd1);
      float coldPatch=smoothstep(.26,.63,n2(vec2(vGeoWorld.z*.14,vGeoWorld.y*.23)));
      float brokenEdge=.65+.35*n2(vGeoWorld.zy*2.8);
      float breach=smoothstep(.67,.82,n2(hp.xy*.55+hp.z*.17))*(1.-coldPatch);
      totalEmissiveRadiance+=fracture*vec3(1.18,.12,.003)*(1.-coldPatch*.50)*brokenEdge+coreHeat*vec3(2.2,.62,.025)*brokenEdge+breach*vec3(2.8,.55,.018);
      float bounce=`);
  };
  hotCrust.customProgramCacheKey=()=> 'gunner-050-localized-igneous-fissures-r1';
  const hotStone=new THREE.IcosahedronGeometry(1,3),hotPositions=hotStone.attributes.position;
  for(let i=0;i<hotPositions.count;i++){
    const x=hotPositions.getX(i),y=hotPositions.getY(i),z=hotPositions.getZ(i);
    const swell=1+.18*Math.sin(x*4.1+z*3.7)*Math.cos(y*5.2-z*2.1)+.065*Math.sin(x*19+y*11+z*13);
    hotPositions.setXYZ(i,x*swell,y*swell*(.9+.08*Math.sin(z*11)),z*swell*1.13);
  }
  hotStone.computeVertexNormals();hotStone.computeBoundingSphere();
  const hotIntrusions=[];
  root.updateMatrixWorld(true);const hotSurfaceRay=new THREE.Raycaster(),bankMeshes=collisionMeshes.filter(m=>m.name.startsWith('bank-'));
  // Independent analytic variation preserves the predecessor geometry/RNG.
  for(const p of [.055,.135,.225,.32,.415,.51,.61,.71,.81,.91])for(const side of [-1,1]){
    if(plateHash(Math.round(p*1000),side+9)<.46)continue;
    const count=2+Math.floor(plateHash(p*741,side*18)*3);
    const mesh=new THREE.InstancedMesh(hotStone,hotCrust,count);mesh.name=`Hot crust intrusion ${p} ${side}`;
    const j=5+Math.floor(plateHash(p*719,side+22)*7);const placements=[];
    for(let i=0;i<count;i++){
      const pp=p+(i-(count-1)*.5)*(.0022+plateHash(p*37+i,side)*.0023),c=centerAt(pp),[x,y]=bankProfile(pp,side,j+(i%2));
      const sx=5.5+plateHash(p*191+i,side)*4.5,sy=3.2+plateHash(p*139+i,side+8)*6.1,sz=5.8+plateHash(p*511+i,side+17)*6.5;
      hotSurfaceRay.set(new THREE.Vector3(c.x,y+sy*.10,c.z),new THREE.Vector3(side,0,0));hotSurfaceRay.far=650;
      const hit=hotSurfaceRay.intersectObjects(bankMeshes,false)[0];if(!hit)throw new Error('Hot intrusion missing actual bank contact');
      dummy.position.set(hit.point.x+side*sx*.76,hit.point.y,c.z);
      placements.push({anchor:hit.point.toArray(),bank:hit.object.name,center:dummy.position.toArray(),buriedDepth:sx*.76});
      dummy.rotation.set(.14*Math.sin(i*4+p*29),side*(.27+i*.51),side*(.20+i*.11));
      dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);chunks.push(mesh);collisionMeshes.push(mesh);
    const c=centerAt(p),[x,y]=bankProfile(p,side,j);hotIntrusions.push({side,position:new THREE.Vector3(placements[1].anchor[0]-side*12,placements[1].anchor[1]+7,placements[1].anchor[2]),mesh,placements});
  }
  const hotSpill=[-1,1].map(side=>{
    const light=side===-1?new THREE.SpotLight(0xff8b3b,0,150,1.08,.68,1.65):new THREE.PointLight(0xff782c,0,105,1.7);
    light.name=`Reflected hot intrusion light ${side}`;
    if(side===-1){light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.8;light.shadow.camera.far=150;light.shadow.bias=-.00012;light.shadow.normalBias=.13;scene.add(light.target);}
    scene.add(light);return {side,light};
  });
  function collapseQuarry(){} // Compatibility hook for the parked siege actor.
  function reset(){}
  const cullCenter=new THREE.Vector3(),hotSpillTargetOffset=new THREE.Vector3();
  function refreshGeologyVisibility(planePos){
    continuationGroup.visible=true;
    for(const m of continuations.meshes){const bounds=m.geometry.boundingSphere;cullCenter.copy(bounds.center).applyMatrix4(m.matrixWorld);m.visible=cullCenter.distanceTo(planePos)<2400+bounds.radius*m.matrixWorld.getMaxScaleOnAxis();}
    for(const m of chunks){
      const bounds=m.isInstancedMesh?m.boundingSphere:m.geometry.boundingSphere;cullCenter.copy(bounds.center).applyMatrix4(m.matrixWorld);m.visible=!m.userData.dancePocketCleared&&Math.abs(cullCenter.z-planePos.z)<820+bounds.radius*m.matrixWorld.getMaxScaleOnAxis();
    }
    return true;
  }
  function update(time,planePos,reduced=false){lavaUniforms.uTime.value=time;hellSky.update(time,planePos,reduced);skyActivity.update(time,planePos,reduced);
    if(!reduced){for(const {side,light} of hotSpill){let nearest=null,distance=Infinity;for(const h of hotIntrusions){const d=Math.abs(h.position.z-planePos.z);if(h.side===side&&d<distance){nearest=h;distance=d;}}if(nearest){light.position.copy(nearest.position);if(light.isSpotLight)light.target.position.copy(nearest.position).add(hotSpillTargetOffset.set(side*20,-5,0));light.intensity=(light.isSpotLight?3900:2400)*Math.pow(Math.max(0,1-distance/240),2);}}
    }else for(const {light} of hotSpill)light.intensity=0;
    refreshGeologyVisibility(planePos);}
  // Approximate support query is for ballistic broad phase only; gun hits use triangles.
  function groundAt(x,z){const p=THREE.MathUtils.clamp((130-z)/3050,0,1),c=centerAt(p),a=Math.abs(x-c.x),w=widthAt(p);if(a<w-19)return 1.5;return a<w-12?THREE.MathUtils.lerp(2.3,12.8,(a-w+19)/7):a<w-4?15.0:a<w+5?18:strata(p,x<c.x?-1:1);}
  return {lavaAt:point=>sampleLavaSurface(point.x,point.z,lavaUniforms.uTime.value),root,rockMaterial,collisionMeshes,lava,continuations,skyActivity,hotIntrusions,hotSpill,update,groundAt,ready,closeOptionalAssets,collapseQuarry,reset,stats:()=>({...geologyStats,chunkReach:820,cullInterval:0,visibleChunks:chunks.filter(m=>m.visible).length,visibleContinuations:continuations.meshes.filter(m=>m.visible).length,hotCrustIntrusions:hotIntrusions.length,hotCrustStones:hotIntrusions.reduce((n,h)=>n+h.mesh.count,0),instancedBasaltColumns:geologyStats.attachedBasaltColumns,collisionMeshes:collisionMeshes.length,basaltDetailTexels:256*256,materialTextureReads:9,staticTriangles:root.children.reduce((n,m)=>n+(m.geometry?(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1):0),0),sky:hellSky.stats(),hotSpillEnergy:hotSpill.reduce((sum,entry)=>sum+entry.light.intensity,0)})};
}
