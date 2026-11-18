const views = new WeakMap();

export function mountTableObjects(app, board) {
  const holder = app.querySelector('.table-objects');
  const button = app.querySelector('[data-table-objects]');
  if (!holder || !button) return;
  const describe = () => ({
    ludoTiles:[...app.querySelectorAll('.ludo-cell')].map(item=>({row:Number(item.style.gridRowStart)-1,column:Number(item.style.gridColumnStart)-1,
      lane:item.classList.contains('lane-0')?0:item.classList.contains('lane-1')?1:-1})),
    ludoTokens:[...app.querySelectorAll('[data-ludo-token]')].map(item=>{
      const [side,token]=item.dataset.ludoToken.split(',').map(Number);
      return {side,from:item.dataset.from.split(',').map(Number),to:item.dataset.to.split(',').map(Number),
        button:app.querySelector(`[data-token="${token}"][data-token-side="${side}"]:enabled`)};
    }),
    pits:[...app.querySelectorAll('.live-pits button')].map(button=>({count:Number(button.textContent),button:button.disabled?null:button})),
    dice:[...app.querySelectorAll('[data-die]')].map(item=>Number(item.dataset.die)),
    cards:[...app.querySelectorAll('[data-table-card]')].map(item=>({
      id:Number(item.dataset.tableCard), label:item.textContent, button:item.matches('button')?item:null,
    })),
  });
  let view=views.get(holder);
  function show(open) {
    holder.hidden=!open;
    button.textContent=open?'Hide 3D table':'Show 3D table';
    button.setAttribute('aria-pressed',String(open));
    if (open) view.update(describe(),board.serial);
  }
  if (view) show(!holder.hidden);
  button.onclick=async () => {
    if (view) {show(holder.hidden); return;}
    button.disabled=true;
    try {
      const {createTableObjects}=await import('./table-objects-3d.js');
      if (!holder.isConnected) return;
      view=createTableObjects(holder);
      views.set(holder,view);
      show(true);
    } catch {
      button.textContent='3D table unavailable';
    } finally {button.disabled=false;}
  };
}
