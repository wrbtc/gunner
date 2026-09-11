import * as THREE from '../vendor/three.module.js?v=052';
// Minimal crew paint: Satoshi on both sides, three Queen victories on port.
const NAME_SCALE = .8;
function canvasTexture(paint,width=1024,height=512){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');paint(c,width,height);
 // Small deterministic paint losses, never floating geometry or new collision.
 let seed=210921;c.globalCompositeOperation='destination-out';for(let i=0;i<900;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296*width;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/4294967296*height;c.globalAlpha=.2+i%4*.12;c.fillRect(x,y,1+i%3,1+i%2);}c.globalAlpha=1;c.globalCompositeOperation='source-over';
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function queenStamp(c,x,y){
 c.save();c.translate(x,y);c.scale(1,-1);c.fillStyle='#e4e5d6';c.beginPath();c.moveTo(-23,4);c.bezierCurveTo(-25,-30,-13,-45,0,-48);c.bezierCurveTo(18,-45,26,-28,23,4);c.closePath();c.fill();
 c.lineWidth=7;c.lineCap='round';for(const side of [-1,1])for(let i=0;i<4;i++){c.strokeStyle='#e4e5d6';c.beginPath();c.moveTo(side*(6+i*5),-3+i*2);c.bezierCurveTo(side*(13+i*11),13+i*4,side*(34+i*5),27+i*3,side*(16+i*10),38+i*2);c.stroke();}
 c.globalCompositeOperation='destination-out';c.fillRect(-13,-18,8,4);c.fillRect(5,-18,8,4);c.restore();
}
export function addSatoshiMarkings(group,skin){
 const textures=[],materials=[],geometries=[],marks=[];
 const material=texture=>{textures.push(texture);const m=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.04,depthWrite:false,roughness:.91,metalness:.02,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});materials.push(m);return m;};
 function mesh(g,m,name){geometries.push(g);const n=new THREE.Mesh(g,m);n.name=name;n.userData.aircraftPaint=true;n.layers.set(1);n.renderOrder=4;group.add(n);marks.push(n);return n;}
 function panel(side,z0,z1,centerAngle,angleSize,mat,name){
  const positions=[],uv=[],indices=[],cols=40,rows=16;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const u=x/cols,v=y/rows,z=side<0?z0+(z1-z0)*u:z1-(z1-z0)*u,a=centerAngle+side*(v-.5)*angleSize;positions.push(...skin(z,a,.013));uv.push(u,v);}
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,mat,name);
 }
 for(const side of [-1,1]){
  const nose=material(canvasTexture((c,w,h)=>{
   c.fillStyle='#e9e1c6';c.font='italic bold 118px Georgia,serif';
   const center=70+c.measureText('Satoshi').width*.5;
   c.save();c.translate(center,156);c.scale(NAME_SCALE,NAME_SCALE);c.textAlign='center';c.fillText('Satoshi',0,0);c.restore();
   if(side<0)for(let i=0;i<3;i++)queenStamp(c,210+i*155,267);
  }));
  panel(side,-6.85,-2.7,side<0?Math.PI-.03:.03,1.35,nose,side<0?'Satoshi port nose — three Queen victory stamps':'Satoshi starboard nose art');
 }
 return{stats:()=>({name:'Satoshi',nameScale:NAME_SCALE,queenKills:3,paintMeshes:marks.length,triangles:geometries.reduce((n,g)=>n+(g.index?.count||g.attributes.position.count)/3,0)}),dispose(){textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());marks.forEach(n=>n.removeFromParent());}};
}
