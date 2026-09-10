// Yielded iterator work in timer slices. Guarantees at least one iterator
// advance per scheduled slice so a coarse or injected clock cannot reschedule
// forever without progress. Cancellation stops further slices.
export function createSlicedIteratorPreparation(iterator,{
 now=()=>performance.now(),
 schedule=setTimeout,
 cancelSchedule=clearTimeout,
 sliceBudgetMs=2,
 isReady=()=>false,
 onSlice=null,
}={}){
 if(iterator==null||typeof iterator.next!=='function')throw TypeError('Preparation requires an iterator');
 if(!Number.isFinite(sliceBudgetMs)||sliceBudgetMs<=0)throw TypeError('Invalid preparation slice budget');
 let timerId=null,settled=false,resolvePending=null,rejectPending=null;
 const clearTimer=()=>{if(timerId!==null){cancelSchedule(timerId);timerId=null;}};
 const settle=fn=>{if(settled)return;settled=true;clearTimer();fn();};
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
