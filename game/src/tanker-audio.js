import {noiseBands,modalBody,finishAudioBuffer} from './audio-palette.js?v=052';
// Original Tanker anatomy: pressurized belly, throat ignition, turbulent flame,
// and plated weight. A phase remains ONE source, so cancellation and seek resume
// keep using the released runtime's exact handle and elapsed-time offset.
export function tankerBuffer(ctx,kind,duration){
 const sr=ctx.sampleRate,buffer=ctx.createBuffer(1,Math.ceil(sr*duration),sr),a=buffer.getChannelData(0);
 const noise=noiseBands(sr,0x184f13+kind.length*67),plate=modalBody(sr,[[83,.11,.37],[229,.071,.21],[659,.034,.13]]);
 let phase=0,flutterPhase=0,grain=0;
 for(let i=0;i<a.length;i++){
  const t=i/sr,u=t/duration,n=noise();let v=0;
  if(kind==='charge'){
   phase+=Math.PI*2*(37+22*u+2.1*Math.sin(t*9.4))/sr;
   const diaphragm=(Math.tanh(Math.sin(phase)*2.3)*.30+Math.sin(phase*2.007)*.10+n.low*4.6)*(.66+.34*Math.sin(t*13.1)**2);
   const pressure=(n.body*.79+n.air*(.10+.62*u))*(.35+.65*u);
   const valve=n.edge*.10*Math.max(0,Math.sin(t*47+Math.sin(t*7)))**8;
   v=(diaphragm+pressure+valve)*(.40+.60*u);
  }else if(kind==='spray'){
   flutterPhase+=Math.PI*2*(23+4*Math.sin(t*6.7))/sr;
   const turbulence=.64+.24*Math.sin(flutterPhase)**2+.12*Math.sin(t*391.1)**2;
   if(n.white>.993)grain=.17;grain*=.95;
   const fire=(n.low*6.1+n.body*1.36+n.air*.38+n.edge*.07)*turbulence;
   v=fire+Math.sin(t*Math.PI*2*41)*.16+grain*n.edge;
  }else if(kind==='ignition'){
   phase+=Math.PI*2*(49+129*Math.exp(-t*32))/sr;
   v=(Math.sin(phase)*.56+n.low*6.8+n.body*.9)*Math.exp(-t*14)+n.edge*.50*Math.exp(-t*190)+n.air*.23*Math.exp(-t*35);
  }else if(kind==='impact'){
   phase+=Math.PI*2*(37+61*Math.exp(-t*10))/sr;
   const splash=(n.low*5.5+n.body*.75+Math.sin(phase)*.42)*Math.exp(-t*3.9);
   const steam=n.air*.27*Math.exp(-t*3.2)*(.65+.35*Math.sin(t*33)**2);
   v=splash+steam+n.edge*.25*Math.exp(-t*155);
  }else if(kind==='step'){
   phase+=Math.PI*2*(45+51*Math.exp(-t*32))/sr;
   const contact=i===Math.round(.002*sr)?1:i===Math.round(.047*sr)?.24:0;
   v=plate(contact)+(n.low*5.2+Math.sin(phase)*.40+n.body*.36)*Math.exp(-t*22)+n.edge*.11*Math.exp(-t*120);
  }else throw Error('Unknown Tanker sound '+kind);
  a[i]=Math.tanh(v*.93);
 }
 return finishAudioBuffer(buffer,{peak:.78,rmsCeiling:kind==='spray'?.27:.24,attack:kind==='charge'?.022:.002,release:.03});
}
