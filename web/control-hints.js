import { icon } from './icons.js?v=3';

const toggle=document.querySelector('#hints');
const tip=document.createElement('span');
const key='dont-cheat-control-hints';
let enabled=true;
let target;
let dismissed;
let hideTimer;
try { enabled=localStorage.getItem(key)!=='off'; } catch {}
tip.className='control-hint';
tip.setAttribute('aria-hidden','true');
tip.hidden=true;
document.body.append(tip);

function hide() {
  clearTimeout(hideTimer);
  target=null;
  tip.hidden=true;
}

function show(control) {
  if(control)clearTimeout(hideTimer);
  if (!enabled || !control || dismissed===control || control===target || control.disabled) return;
  const label=control.dataset.hint || control.getAttribute('aria-label');
  if (!label) return;
  target=control;
  tip.textContent=label;
  tip.hidden=false;
  const rect=control.getBoundingClientRect();
  const x=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,rect.left+(rect.width-tip.offsetWidth)/2));
  tip.style.left=`${x}px`;
  tip.style.top=`${rect.bottom+tip.offsetHeight+8 < innerHeight ? rect.bottom+8 : rect.top-tip.offsetHeight-8}px`;
}

function reflect() {
  toggle.innerHTML=`${icon('circle-help')}<span aria-hidden="true">Hints</span>`;
  toggle.setAttribute('aria-pressed',String(enabled));
  toggle.dataset.hint=enabled?'Hide control hints':'Show control hints';
}

toggle.onclick=()=>{
  enabled=!enabled;
  try { localStorage.setItem(key,enabled?'on':'off'); } catch {}
  hide();
  reflect();
};
reflect();

function leave() {
  clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{
    if (!tip.matches(':hover') && !target?.matches(':hover, :focus-visible')) hide();
  },150);
}

const controlFrom=event=>event.target.closest?.('[data-hint]');
tip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
tip.addEventListener('pointerleave',leave);
document.addEventListener('click',event=>{
  if(controlFrom(event)===target)hide();
});

document.addEventListener('pointerover',event=>{
  if (event.pointerType!=='touch') show(controlFrom(event));
});
document.addEventListener('pointerout',event=>{
  const control=controlFrom(event);
  if (!control || control.contains(event.relatedTarget)) return;
  if(dismissed===control)dismissed=null;
  if(target===control)leave();
});
document.addEventListener('focusin',event=>{
  const control=controlFrom(event);
  if(control?.matches(':focus-visible'))show(control);
});
document.addEventListener('focusout',event=>{
  const control=controlFrom(event);
  if(dismissed===control)dismissed=null;
  if(target===control)leave();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && !tip.hidden){dismissed=target;hide();}
});
window.addEventListener('scroll',hide,{capture:true,passive:true});
window.addEventListener('resize',hide);
new MutationObserver(()=>{if(target&&!target.isConnected)hide();}).observe(document.querySelector('#app'),{childList:true,subtree:true});
