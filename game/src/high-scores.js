const ENDPOINT='/gunner/api/scores';
export function normalizeInitials(value){return String(value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);}
export function validRows(value){
  return (Array.isArray(value)?value:[]).filter(r=>r&&/^[A-Z0-9]{3}$/.test(r.initials)&&Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=999999999)
    .map(r=>({initials:r.initials,score:r.score})).sort((a,b)=>b.score-a.score).slice(0,10);
}
function readRows(value){
  if(!Array.isArray(value)||value.length>10||value.some((r,i)=>!r||r.rank!==i+1||!Number.isSafeInteger(r.score)||r.score<0||r.score>999999999||!/^[A-Z0-9]{3}$/.test(r.initials)||(i&&r.score>value[i-1].score)))throw new Error('invalid_response');
  return value.map(r=>({initials:r.initials,score:r.score}));
}
export function createHighScores({table,form,input,submit,status,scope,refreshButton,onQualified}){
  let rows=[],finishedScore=null,submitted=false,saving=false,epoch=0,submissionId=null,payload=null,loadController=null,saveController=null,rank=null,loadState='loading',qualificationNotified=false;
  async function request(options,controller){
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(ENDPOINT,{...options,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...options.headers}});
      if(!response.ok){const error=new Error('save_failed');error.code=response.status;const retry=Number(response.headers.get('Retry-After'));error.retry=Number.isFinite(retry)&&retry>0?Math.ceil(retry):null;throw error;}
      return await response.json();
    }finally{clearTimeout(timeout);}
  }
  function qualification(){
    if(finishedScore===null||submitted||saving||payload)return;
    const qualifies=loadState==='ready'&&(rows.length<10||finishedScore>rows[9].score);
    if(qualifies&&!qualificationNotified){qualificationNotified=true;onQualified?.({score:finishedScore});}
    form.hidden=!qualifies;
    input.disabled=!qualifies||!submissionId;
    submit.disabled=!qualifies||!submissionId||input.value.length!==3;
    if(refreshButton)refreshButton.hidden=loadState!=='unavailable';
    status.textContent=loadState==='loading'?'CHECKING THE TOP TEN…':loadState==='unavailable'?'TOP TEN UNAVAILABLE · RETRY TO CHECK YOUR PLACE.':qualifies?(submissionId?'TOP TEN FLIGHT · ENTER YOUR THREE INITIALS.':'SAVING UNAVAILABLE · A SECURE CONNECTION IS REQUIRED.'):'KEEP HUNTING · BEAT '+rows[9].score.toLocaleString('en-US')+' TO REACH THE TOP TEN.';
  }
  function paint(){
    const qualifies=finishedScore!==null&&!submitted&&(!!payload||loadState==='ready'&&(rows.length<10||finishedScore>rows[9].score));
    const view=rows.map(r=>({...r}));
    if(qualifies){let at=view.findIndex(r=>r.score<finishedScore);if(at<0)at=view.length;view.splice(at,0,{initials:'',score:finishedScore,current:true});}
    table.replaceChildren();
    for(let i=0;i<10;i++){
      const row=view[i],tr=document.createElement('tr');tr.classList.toggle('claimed',!!row?.current);tr.classList.toggle('saved',submitted&&i===rank-1);
      const place=document.createElement('td');place.textContent=String(i+1).padStart(2,'0');tr.append(place);
      const name=document.createElement('td');
      if(row?.current){name.append(form);form.hidden=false;}else name.textContent=row?.initials??'---';tr.append(name);
      const score=document.createElement('td');score.textContent=row?String(row.score).padStart(6,'0'):'------';tr.append(score);table.append(tr);
    }
    if(!qualifies)form.hidden=true;
    scope.textContent=loadState==='loading'?'SHARED · LOADING':loadState==='unavailable'?'SHARED · UNAVAILABLE':'SHARED';
    table.closest('table').setAttribute('aria-busy',String(loadState==='loading'));qualification();
  }
  async function refresh(){
    loadController?.abort();const controller=loadController=new AbortController(),current=epoch;
    loadState='loading';paint();
    try{
      const data=await request({method:'GET'},controller),next=readRows(data.rows);
      if(data.scope!=='shared'||data.verification!=='player-submitted')throw new Error('invalid_response');
      if(current!==epoch||controller!==loadController)return;
      rows=next;loadState='ready';paint();
    }catch{
      if(current!==epoch||controller!==loadController)return;
      rows=[];loadState='unavailable';paint();
    }
  }
  function reset(){
    qualificationNotified=false;epoch++;loadController?.abort();loadController=null;saveController?.abort();saveController=null;
    finishedScore=null;submissionId=null;payload=null;submitted=false;saving=false;rank=null;
    if(refreshButton)refreshButton.hidden=true;input.value='';input.disabled=false;submit.disabled=true;submit.textContent='ENTER';form.hidden=true;form.setAttribute('aria-busy','false');status.textContent='';
  }
  function offer(score){
    if(finishedScore!==null)return;
    if(!Number.isSafeInteger(score)||score<0||score>999999999)throw new Error('Invalid finished score');
    finishedScore=score;submissionId=globalThis.crypto?.randomUUID?.()??null;form.hidden=true;submit.disabled=true;
    refresh().then(()=>{if(!form.hidden&&!submitted)input.focus({preventScroll:true});});
  }
  input.addEventListener('input',()=>{input.value=normalizeInitials(input.value);submit.disabled=input.value.length!==3||submitted||saving||!submissionId;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const initials=normalizeInitials(input.value);
    if(submitted||saving||finishedScore===null||initials.length!==3||!submissionId||(!payload&&(loadState!=='ready'||(rows.length===10&&finishedScore<=rows[9].score))))return;
    // Freeze the exact payload after the first attempt. A lost response can be
    // retried with the same id even if the server already committed the save.
    payload??={submissionId,initials,score:finishedScore};
    const current=epoch,controller=saveController=new AbortController();
    loadController?.abort();loadController=null;saving=true;input.disabled=true;submit.disabled=true;submit.textContent='SAVING…';form.setAttribute('aria-busy','true');status.textContent='SAVING YOUR SCORE…';
    try{
      const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},controller),next=readRows(data.rows);
      if(data.saved!==true||data.submissionId!==submissionId||!Number.isSafeInteger(data.rank)||data.rank<1)throw new Error('invalid_response');
      if(current!==epoch||controller!==saveController)return;
      submitted=true;rank=data.rank;rows=next;loadState='ready';paint();form.hidden=true;
      status.textContent=rank<=10?`SCORE SAVED · SHARED RANK ${rank}. READY FOR ANOTHER FLIGHT?`:`SCORE SAVED · RANK ${rank}, OUTSIDE THE SHARED TOP TEN.`;
      document.querySelector('#replayButton')?.focus({preventScroll:true});
    }catch(error){
      if(current!==epoch||controller!==saveController)return;
      status.textContent=error.code===429?`SAVE NOT CONFIRMED · TOO MANY REQUESTS. ${error.retry?`WAIT ${error.retry} SECONDS, THEN RETRY.`:'PLEASE RETRY SHORTLY.'}`:error.code===409?'SAVE NOT CONFIRMED · THIS FLIGHT ID CONFLICTS. PLEASE TRY AGAIN AFTER YOUR NEXT FLIGHT.':'SAVE NOT CONFIRMED · CHECK YOUR CONNECTION AND RETRY.';
      loadState=rows.length?'ready':'unavailable';paint();
      submit.textContent='RETRY SAVE';submit.disabled=error.code===409;
      // Keep initials, score and id unchanged for a safe retry. No local-only
      // fallback or automatic upload of the former browser score table.
    }finally{
      if(current===epoch&&controller===saveController){saving=false;form.setAttribute('aria-busy','false');}
    }
  });
  refreshButton?.addEventListener('click',refresh);
  reset();refresh();
  return{offer,reset,stats:()=>({rows:rows.map(r=>({...r})),scope:'shared',verification:'player-submitted',loadState,finishedScore,submitted,saving,rank,submissionId})};
}
