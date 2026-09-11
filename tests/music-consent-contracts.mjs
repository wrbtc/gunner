import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMenuMusic} from '../game/src/menu-music.js';

class Element {
  constructor(){this.listeners={};this.value=65;this.paused=true;this.currentTime=0;this.loop=false;this.calls=0;this.textContent='';}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}
  setAttribute(name,value){this[name]=value;}
  play(){this.calls++;this.paused=false;return this.nextPlay?.()??Promise.resolve();}
  pause(){this.paused=true;}
  load(){this.error=null;}
}

function fixture(){
  const menu=new Element(),win=new Element(),lose=new Element(),buttons=[new Element(),new Element()],volume=new Element(),music=new Element(),doc=new Element(),events=new Element();
  const markup=readFileSync(new URL('../game/index.html',import.meta.url),'utf8');
  for(const [id,media] of [['menu',menu],['win',win],['lose',lose]]){
    const tag=markup.match(new RegExp('<audio id="'+id+'MusicTrack"[^>]+>'))?.[0];
    assert.ok(tag);media.loop=/\bloop\b/.test(tag);assert.equal(media.loop,true,id+' must loop');
  }
  const control=createMenuMusic({track:menu,outcomes:{win,lose},buttons,volume,music,doc,events,storage:{getItem:()=>JSON.stringify({volume:.8,music:.5})}});
  return {menu,win,lose,buttons,volume,music,doc,events,control};
}

const f=fixture();
assert.equal(f.menu.calls,0,'initial menu must stay silent');
assert.equal(f.menu.paused,true);
assert.equal(f.buttons[0].textContent,'PLAY MUSIC');
assert.equal(f.buttons[0]['aria-pressed'],'false');
f.doc.emit('click');f.doc.emit('keydown');
assert.equal(f.menu.calls,0,'generic gestures must not opt into music');
f.control.setOutcome(true,{restart:true});
assert.equal(f.win.calls,0,'outcome music must also respect the opt-in');

f.buttons[0].emit('click');
assert.equal(f.win.calls,1);assert.equal(f.win.paused,false);assert.equal(f.win.volume,.4);
assert.equal(f.buttons[1].textContent,'PAUSE MUSIC');
f.control.setActive(true);
assert.equal(f.win.paused,true);assert.equal(f.menu.calls,1);assert.equal(f.menu.paused,false);
f.doc.hidden=true;f.doc.emit('visibilitychange');assert.equal(f.menu.paused,true);
f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.menu.calls,2);assert.equal(f.menu.paused,false);
f.buttons[1].emit('click');assert.equal(f.menu.paused,true);
f.control.setOutcome(false,{restart:true});assert.equal(f.lose.calls,0,'explicit pause persists into later menus');

const r=fixture();
r.menu.nextPlay=()=>Promise.reject(new Error('NotAllowedError'));
r.buttons[0].emit('click');await Promise.resolve();
assert.equal(r.menu.paused,true);assert.equal(r.buttons[0].textContent,'PLAY MUSIC');
r.menu.nextPlay=()=>Promise.resolve();r.buttons[0].emit('click');
assert.equal(r.menu.calls,2,'one explicit retry click must be enough');
assert.equal(r.menu.paused,false);

console.log('PASS music is silent by default and only an explicit music-button request enables it');
