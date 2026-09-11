// Write-only internal counts. No cookies, browser storage, or persistent client ID.
export function createPlayTracking({enabled, snapshot, send=globalThis.fetch?.bind(globalThis), uuid=()=>crypto.randomUUID()}){
  let run=null,activeMs=0,sinceSend=0;
  function emit(event){
    if(!run)return;
    try{
      const body=JSON.stringify({runId:run,event,build:'042t',activeMs:Math.round(activeMs),...snapshot()});
      // Analytics must never block the game; a later snapshot can recover a lost start.
      void send('/gunner/api/play-events',{method:'POST',headers:{'Content-Type':'application/json'},body,credentials:'omit',cache:'no-store',keepalive:true,signal:AbortSignal.timeout(5000)}).catch(()=>{});
    }catch{}
  }
  return {
    start(){if(!enabled)return;try{run=uuid();activeMs=sinceSend=0;emit('start');}catch{run=null;}},
    tick(seconds){if(!run)return;const ms=Math.max(0,Math.min(seconds,1))*1000;activeMs+=ms;sinceSend+=ms;if(sinceSend>=30000){sinceSend=0;emit('progress');}},
    flush(){emit('progress');},
    finish(won){emit(won?'win':'loss');run=null;}
  };
}
