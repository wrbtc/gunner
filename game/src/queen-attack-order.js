// Shuffle bags vary arm and ammunition order while preventing long type droughts.
// Inject randomness for reproducible offline checks; ordinary play uses Math.random.
export function createQueenAttackOrder(random=Math.random){
 let arms=[],ammo=[],lastArm=null,lastType=null;
 function shuffled(values,last){
  const out=[...values];
  for(let i=out.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[out[i],out[j]]=[out[j],out[i]];}
  if(out.length>1&&out[0]===last){const j=1+Math.min(out.length-2,Math.max(0,Math.floor(random()*(out.length-1))));[out[0],out[j]]=[out[j],out[0]];}
  return out;
 }
 return{
  beginRound(living){arms=shuffled(living,lastArm);},
  next(living){const allowed=new Set(living);let arm;while(arms.length){const candidate=arms.shift();if(allowed.has(candidate)){arm=candidate;break;}}if(arm===undefined)return null;
   if(!ammo.length)ammo=shuffled(['mud','spike','bomb'],lastType);const type=ammo.shift();lastArm=arm;lastType=type;return{arm,type};},
  reset(){arms=[];ammo=[];lastArm=lastType=null;},
  stats:()=>({remainingArms:[...arms],remainingAmmo:[...ammo],lastArm,lastType})
 };
}
