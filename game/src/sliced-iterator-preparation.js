// Yielded iterator work in timer slices. Guarantees at least one iterator
// advance per scheduled slice so a coarse or injected clock cannot reschedule
// forever without progress. Cancellation stops further slices.
// Default yields use MessageChannel task posts (same class as graphics prep)
// so Safari's nested setTimeout(0) clamp cannot dominate a 30s wall deadline.
export function createSlicedIteratorPreparation(iterator,{
 now=()=>performance.now(),
 schedule=null,
 cancelSchedule=null,
 sliceBudgetMs=2,
 isReady=()=>false,
 onSlice=null,
}={}){
 if(iterator==null||typeof iterator.next!=='function')throw TypeError('Preparation requires an iterator');
 if(!Number.isFinite(sliceBudgetMs)||sliceBudgetMs<=0)throw TypeError('Invalid preparation slice budget');
 let timerId=null,settled=false,resolvePending=null,rejectPending=null,ownedChannel=null,pendingPosts=null;
 if(typeof schedule!=='function'){
  if(typeof MessageChannel==='function'){
   pendingPosts=new Map();let serial=0;
   ownedChannel=new MessageChannel();
   ownedChannel.port1.onmessage=event=>{
    const fn=pendingPosts.get(event.data);
    if(!fn)return;
    pendingPosts.delete(event.data);
    fn();
   };
   schedule=fn=>{const id=++serial;pendingPosts.set(id,fn);ownedChannel.port2.postMessage(id);return id;};
   cancelSchedule=id=>{pendingPosts.delete(id);};
  }else{
   schedule=setTimeout;
   cancelSchedule=clearTimeout;
  }
 }
 if(typeof cancelSchedule!=='function')cancelSchedule=clearTimeout;
 const releaseChannel=()=>{
  if(!ownedChannel)return;
  ownedChannel.port1.onmessage=null;
  ownedChannel.port1.close();
  ownedChannel.port2.close();
  pendingPosts?.clear();
  ownedChannel=null;pendingPosts=null;
 };
 const clearTimer=()=>{if(timerId!==null){cancelSchedule(timerId);timerId=null;}};
 const settle=fn=>{if(settled)return;settled=true;clearTimer();releaseChannel();fn();};
 const promise=new Promise((resolve,reject)=>{
  resolvePending=resolve;rejectPending=reject;
  function slice(){
   timerId=null;
   if(settled)return;
   try{
    const begin=now();
    let done=isReady();
    let stepped=false;
    // Always advance once per slice before applying the time budget.
    while(!done&&(!stepped||now()-begin<sliceBudgetMs)){
     done=iterator.next().done||isReady();
     stepped=true;
    }
    const cost=now()-begin;
    onSlice?.({cost,done:done||isReady(),stepped});
    if(done||isReady())settle(()=>resolvePending());
    else timerId=schedule(slice,0);
   }catch(error){settle(()=>rejectPending(error));}
  }
  timerId=schedule(slice,0);
 });
 promise.cancel=()=>{
  if(settled)return;
  settle(()=>rejectPending(Object.assign(Error('Flight preparation was canceled'),{code:'PREPARATION_CANCELED'})));
 };
 return promise;
}
