// Shared by visible lava, banks, collision, eggs and creature placement.
export const NESTING_POOLS=Object.freeze([
 {id:'early-brood',from:.12,to:.23,shoulder:.025,halfWidth:68},
 {id:'quarry-brood',from:.31,to:.41,shoulder:.027,halfWidth:74},
 {id:'nursery',from:.485,to:.61,shoulder:.035,halfWidth:88},
 {id:'late-brood',from:.665,to:.765,shoulder:.025,halfWidth:72},
 {id:'queen-arena',from:.85,to:1,shoulder:.045,halfWidth:154}
]);
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const legacyWidthAt=p=>43+12*Math.sin(p*23+.7)+7*Math.sin(p*51);
export function riverWidthAt(p){let w=legacyWidthAt(p);for(const pool of NESTING_POOLS){const u=smooth(pool.from-pool.shoulder,pool.from+pool.shoulder,p)*(1-smooth(pool.to-pool.shoulder,pool.to+pool.shoulder,p));w=Math.max(w,w+(pool.halfWidth-w)*u);}return w;}
export const EGG_SITES=Object.freeze([.155,.192,.342,.375,.516,.565,.585,.704,.733,.746]);
export const isNestingWidth=p=>riverWidthAt(p)-11>=50;
