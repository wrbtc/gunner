import * as T from '../vendor/three.module.js?v=052';
const V=()=>new T.Vector3();
const preferred=new T.Vector3(0,-.35,.94).normalize();
// Parallel transport avoids the discontinuous reference-axis branch in the
// released collider's old visual tube. These frames affect new art only.
export function createQueenFrames(segments){return{segments,points:Array.from({length:segments+1},V),radii:new Float32Array(segments+1),tangents:Array.from({length:segments+1},V),u:Array.from({length:segments+1},V),v:Array.from({length:segments+1},V),turn:new T.Quaternion()};}
export function transportQueenFrames(curve,frames){
 const {segments,tangents,u,v,turn}=frames;
 for(let j=0;j<=segments;j++){curve.getTangent(j/segments,tangents[j]).normalize();curve.getPoint(j/segments,frames.points[j]);}
 v[0].copy(preferred).addScaledVector(tangents[0],-preferred.dot(tangents[0]));
 if(v[0].lengthSq()<1e-5)v[0].set(1,0,0).addScaledVector(tangents[0],-tangents[0].x);
 v[0].normalize();u[0].crossVectors(v[0],tangents[0]).normalize();
 for(let j=1;j<=segments;j++){
  turn.setFromUnitVectors(tangents[j-1],tangents[j]);u[j].copy(u[j-1]).applyQuaternion(turn);
  u[j].addScaledVector(tangents[j],-u[j].dot(tangents[j])).normalize();v[j].crossVectors(tangents[j],u[j]).normalize();
 }
 return frames;
}
export function sampleQueenFrame(frames,f,tangent,u,v){
 const p=Math.max(0,Math.min(frames.segments,f*frames.segments)),j=Math.min(frames.segments-1,Math.floor(p)),k=p-j;
 tangent.copy(frames.tangents[j]).lerp(frames.tangents[j+1],k).normalize();
 u.copy(frames.u[j]).lerp(frames.u[j+1],k);u.addScaledVector(tangent,-u.dot(tangent)).normalize();v.crossVectors(tangent,u).normalize();
}

// The same five authored guide points define a smooth quartic sweep rather
// than forcing a thick limb through each hard corner. Endpoints remain exact.
// The original interpolating spline still owns every collision calculation.
export class QueenVisualCurve extends T.Curve{
 constructor(){super();this.points=Array.from({length:5},V);}
 getPoint(t,target=V()){
  const q=1-t,w=[q*q*q*q,4*q*q*q*t,6*q*q*t*t,4*q*t*t*t,t*t*t*t];target.set(0,0,0);for(let i=0;i<5;i++)target.addScaledVector(this.points[i],w[i]);return target;
 }
 getTangent(t,target=V()){
  const q=1-t,w=[4*q*q*q,12*q*q*t,12*q*t*t,4*t*t*t];target.set(0,0,0);for(let i=0;i<4;i++){target.addScaledVector(this.points[i+1],w[i]);target.addScaledVector(this.points[i],-w[i]);}return target.normalize();
 }
}
