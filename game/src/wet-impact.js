import {noiseBands,finishAudioBuffer} from './audio-palette.js?v=052';
// A damped glass contact under a dense, wet slap; synthesized original audio.
export function mudImpactBuffer(ctx){
 const sr=ctx.sampleRate,buffer=ctx.createBuffer(1,Math.ceil(.72*sr),sr),a=buffer.getChannelData(0),noise=noiseBands(sr,0x52a71);
 let phase=0,dropPhase=0;
 for(let i=0;i<a.length;i++){
  const t=i/sr,n=noise();phase+=2*Math.PI*(61+148*Math.exp(-t*35))/sr;dropPhase+=2*Math.PI*(180+260*Math.exp(-t*13))/sr;
  const contact=(n.body*1.8+n.low*6.4+Math.sin(phase)*.52)*Math.exp(-t*18);
  const spread=n.body*(.5+.5*Math.sin(t*71)**2)*Math.exp(-t*8)*.68;
  const drops=[.09,.17,.28,.41].reduce((sum,at)=>{const u=t-at;return sum+(u>=0?(n.body*.75+Math.sin(dropPhase)*.22)*Math.exp(-u*55):0);},0);
  const pane=(Math.sin(t*2*Math.PI*413)*.06+Math.sin(t*2*Math.PI*997)*.025)*Math.exp(-t*45);
  a[i]=Math.tanh(contact+spread+drops+pane);
 }
 return finishAudioBuffer(buffer,{peak:.78,rmsCeiling:.23,attack:.0015,release:.04});
}
