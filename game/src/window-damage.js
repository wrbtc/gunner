import * as THREE from '../vendor/three.module.js?v=052';

// Trajectory-registered mud. Every splash clears after four elapsed seconds,
// independent of flight speed, pause, and newer hits. Repaint at most 20Hz.
export function createWindowDamage(parent) {
  const W=2048,H=1024,R=2.72,LIFETIME_SECONDS=4,FADE_START=2.9;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.9,side:THREE.BackSide,depthWrite:false,depthTest:true,toneMapped:false,fog:false});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(R,80,48),material);
  mesh.name='Trajectory-registered four-second mud and fire splashes';mesh.layers.set(1);mesh.renderOrder=24;mesh.visible=false;parent.add(mesh);
  const impacts=[],active=[];let seed=0x6d756421,pixels=null,lastPaint=0,clock=performance.now()/1000;
  const age=record=>Math.max(0,clock-record.bornAt);
  const remaining=record=>1-THREE.MathUtils.smoothstep(age(record),FADE_START,LIFETIME_SECONDS);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // SphereGeometry: x=-cos(phi)*sin(theta), z=sin(phi)*sin(theta).
  function uv(n){return {u:((Math.atan2(n.z,-n.x)/(2*Math.PI))%1+1)%1,v:Math.acos(THREE.MathUtils.clamp(n.y,-1,1))/Math.PI};}
  function strike(worldPoint,velocity,{source=null,time=0,distanceMeters=0,kind='mud'}={}) {
    parent.updateWorldMatrix(true,false);
    const normal=parent.worldToLocal(worldPoint.clone()).normalize();
    if(!Number.isFinite(normal.x)||normal.lengthSq()<.5)return null;
    clock=performance.now()/1000;
    const {u,v}=uv(normal),x=u*W,y=v*H;
    const fire=kind==='fire',radius=fire?.38+random()*.08:.24+random()*.10;
    const rx=radius*W/(2*Math.PI*Math.max(.3,Math.sqrt(1-normal.y*normal.y))),ry=radius*H/Math.PI;
    const patch=document.createElement('canvas');patch.width=Math.ceil(rx*4.8);patch.height=Math.ceil(ry*5.1);
    const c=patch.getContext('2d');c.translate(patch.width/2,patch.height*.43);c.scale(rx,ry);
    const angle=random()*Math.PI*2,arms=5+Math.floor(random()*3),points=[];
    const fingers=Array.from({length:arms},(_,i)=>({a:angle+i*Math.PI*2/arms+(random()-.5)*.48,w:.065+random()*.12,length:.2+random()*.72}));
    // Broad ragged impact body with unequal liquid fingers and soft torn edges.
    for(let i=0;i<160;i++){
      const a=i*Math.PI*2/160;let radius=.52+.08*Math.sin(a*3+angle)+.07*Math.sin(a*7+1)+.025*Math.sin(a*19);
      for(const f of fingers){const delta=Math.atan2(Math.sin(a-f.a),Math.cos(a-f.a));radius+=f.length*Math.exp(-delta*delta/(f.w*f.w));}
      points.push([Math.cos(a)*radius,Math.sin(a)*radius*1.12]);
    }
    const fill=c.createLinearGradient(-.5,-.8,.6,1.3);
    fill.addColorStop(0,fire?'rgba(45,20,10,.95)':'rgba(86,56,28,.99)');
    fill.addColorStop(.48,fire?'rgba(70,29,9,.96)':'rgba(68,42,20,.99)');
    fill.addColorStop(1,fire?'rgba(29,19,14,.94)':'rgba(40,28,18,.96)');
    c.fillStyle=fill;c.beginPath();c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();c.fill();
    c.save();c.clip();
    for(let i=0;i<1600;i++){
      c.fillStyle=random()>.55?'rgba(12,8,4,.11)':'rgba(184,128,61,.12)';
      c.fillRect((random()-.5)*3,(random()-.5)*3,.005+random()*.025,.005+random()*.02);
    }c.restore();
    // Narrow impact streaks and tapered detached flecks, never circular blobs.
    for(let i=0;i<26;i++){
      const a=random()*Math.PI*2,d=.65+random()*1.10,len=.10+random()*.38,w=.012+random()*.047;
      c.save();c.translate(Math.cos(a)*d,Math.sin(a)*d);c.rotate(a);
      c.fillStyle=fire?'rgba(64,28,12,.9)':'rgba(66,43,24,.94)';c.beginPath();c.moveTo(-len*.35,-w);c.quadraticCurveTo(len*.2,-w*1.4,len,.0);c.quadraticCurveTo(len*.1,w,-len*.35,w*.6);c.closePath();c.fill();c.restore();
    }
    for(let i=0;i<4;i++){
      const x=(random()-.5)*.95,y=.05+random()*.30,end=.7+random()*.95,w=.025+random()*.045;
      c.fillStyle=fire?'rgba(53,24,12,.88)':'rgba(58,38,22,.94)';c.beginPath();c.moveTo(x-w,y);c.bezierCurveTo(x-w*.7,end*.6,x+.09,end*.9,x+.025,end);c.quadraticCurveTo(x+.11,end+.02,x+w,end-.1);c.bezierCurveTo(x+w*.4,end*.6,x+w*1.2,.35,x+w,y);c.closePath();c.fill();
    }
    for(let i=0;i<65;i++){
      const x=(random()-.5)*1.15,y=(random()-.5)*.85;
      c.fillStyle=random()>.5?'rgba(18,15,11,.32)':'rgba(170,121,57,.20)';c.fillRect(x,y,.01+random()*.035,.008+random()*.018);
    }
    // Fire deposits retain a broad soot silhouette after the hot rivulets cool.
    let hotPatch=null;
    if(fire){
      hotPatch=document.createElement('canvas');hotPatch.width=patch.width;hotPatch.height=patch.height;
      const h=hotPatch.getContext('2d');h.translate(patch.width/2,patch.height*.43);h.scale(rx,ry);
      h.beginPath();h.moveTo(...points[0]);for(let i=1;i<points.length;i++)h.lineTo(...points[i]);h.closePath();h.clip();
      const ember=h.createRadialGradient(-.12,.05,.03,0,0,.9);ember.addColorStop(0,'rgba(255,127,18,.78)');ember.addColorStop(.5,'rgba(190,48,5,.50)');ember.addColorStop(1,'rgba(94,18,2,0)');h.fillStyle=ember;h.fillRect(-2,-2,4,4);
      for(let i=0;i<38;i++){
        const x=(random()-.5)*1.4,y=(random()-.5)*1.4;
        h.strokeStyle=i%3?'rgba(255,118,14,.75)':'rgba(255,204,64,.90)';h.lineWidth=.006+random()*.017;
        h.beginPath();h.moveTo(x,y);h.bezierCurveTo(x+.05,y+.03,x-.025,y+.07,x+.02,y+.10+random()*.12);h.stroke();
      }

    }
    const record={index:impacts.length,kind,source,time,distanceMeters,bornAt:clock,local:normal.clone().multiplyScalar(R).toArray(),world:worldPoint.toArray(),velocity:velocity.toArray(),radius};
    impacts.push(record);active.push({record,patch,hotPatch,x,y});repaint();return record;
  }
  function repaint(){
    ctx.clearRect(0,0,W,H);
    for(let i=active.length-1;i>=0;i--)if(age(active[i].record)>=LIFETIME_SECONDS)active.splice(i,1);
    for(const {record,patch,hotPatch,x,y} of active){
      ctx.globalAlpha=remaining(record);
      for(const wrap of [-W,0,W])ctx.drawImage(patch,x+wrap-patch.width/2,y-patch.height*.43);
      if(hotPatch){ctx.globalAlpha=remaining(record)*Math.max(0,1-age(record)/1.4);for(const wrap of [-W,0,W])ctx.drawImage(hotPatch,x+wrap-patch.width/2,y-patch.height*.43);}
    }
    ctx.globalAlpha=1;texture.needsUpdate=true;pixels=null;mesh.visible=active.length>0;lastPaint=clock;
  }
  function advanceTime(){
    clock=performance.now()/1000;
    // Expiry is checked every frame, even when gameplay is paused. A hidden tab
    // discards expired patches before its first resumed render; no timer backlog.
    if(active.some(a=>age(a.record)>=LIFETIME_SECONDS)||(clock-lastPaint>=.05&&active.some(a=>age(a.record)>=FADE_START||(a.record.kind==='fire'&&age(a.record)<1.5))))repaint();
  }
  function coverage({fov=66,aspect=16/9,threshold=.12}={}){
    pixels??=ctx.getImageData(0,0,W,H).data;
    let affected=0,opacity=0,total=0;const tangent=Math.tan(fov*Math.PI/360);
    for(let j=0;j<90;j++)for(let i=0;i<160;i++){
      const n=new THREE.Vector3(((i+.5)/160*2-1)*tangent*aspect,(1-(j+.5)/90*2)*tangent,-1).normalize(),p=uv(n);
      const alpha=pixels[(Math.min(H-1,Math.floor(p.v*H))*W+Math.min(W-1,Math.floor(p.u*W)))*4+3]/255*material.opacity;
      if(alpha>=threshold)affected++;opacity+=alpha;total++;
    }
    return {affectedFraction:affected/total,meanOpacity:opacity/total,threshold,fov,aspect,samples:total};
  }
  function reset(){ctx.clearRect(0,0,W,H);texture.needsUpdate=true;mesh.visible=false;impacts.length=0;active.length=0;clock=performance.now()/1000;lastPaint=clock;seed=0x6d756421;pixels=null;}
  return {mesh,strike,advanceTime,reset,coverage,stats:()=>({kind:'glass-splashes',mudHits:impacts.filter(i=>i.kind==='mud').length,fireHits:impacts.filter(i=>i.kind==='fire').length,hits:impacts.length,activeHits:active.length,lifetimeSeconds:LIFETIME_SECONDS,fadeStartSeconds:FADE_START,clock:'elapsed-real-time-including-pause',impacts:impacts.map(x=>({...x,ageSeconds:age(x),remaining:remaining(x)})),atlas:[W,H],radius:R}),dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();texture.dispose();}};
}
