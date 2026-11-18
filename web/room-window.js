import { maskId } from './masks.js?v=2';

const windows = new WeakMap();
export const roomMarkup = '<div class="room-window" role="group" aria-label="A rendered game room with a dealer and player seats"></div>';

function themeFor(place) {
  const id=place?.id ?? '';
  if (/orbit|moon|space|planet|astro|star|mars/.test(id)) return 'sky';
  if (/vault|lab|station|train|airport|ship|sub|metro|lift/.test(id)) return 'vault';
  return 'hall';
}

export function mountRoomWindow(app, players, place, openButton) {
  const holder=app.querySelector('.room-window');
  if (!holder || !window.WebGL2RenderingContext) return;
  const state={players:players.map(player=>({online:player?.online===true,mask:maskId(player?.mask)})),theme:themeFor(place)};
  let entry=windows.get(holder);
  if(!entry){entry={state};windows.set(holder,entry);}
  else entry.state=state;

  async function show() {
    if(entry.scene){entry.scene.update(entry.state.players);entry.scene.adjust();return;}
    if(entry.loading)return;
    entry.loading=true;
    try{
      const {createArenaRoom}=await import('./arena-room.js');
      if(!holder.isConnected)return;
      entry.scene=createArenaRoom(holder,entry.state.theme);
      holder.dataset.rendered='true';
      entry.scene.update(entry.state.players);
      const control=document.createElement('button');
      control.type='button';
      control.className='room-orbit quiet';
      control.textContent='Look around';
      control.onclick=()=>entry.scene.orbit();
      holder.append(control);
    }catch{
      holder.dataset.rendered='false';
    }finally{entry.loading=false;}
  }
  if(openButton){
    openButton.addEventListener('click',show);
    if(holder.closest('dialog')?.open)void show();
  }else void show();
}
