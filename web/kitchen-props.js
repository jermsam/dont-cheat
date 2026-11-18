import * as THREE from './vendor/three.module.min.js';

export async function placeKitchenProps(loadProp,scene,render,alive,tableFallback) {
  const layout={
    dining_table:[[0,0,-.66,0,1]],
    electric_stove:[[-2.94,0,-5.42,0,1.32]],
    vintage_electric_kettle:[[-2.33,1.128,-5.28,-.52,1.14]],
    brass_pan_01:[[-3.07,1.15,-5.46,.46,1.12],[.08,2.12,-5.51,0,1.3]],
    pot_enamel_01:[[-2.78,1.15,-5.49,.31,1.16]],
    wooden_cutting_board:[[-.88,1.129,-5.23,.14,1.3]],
    food_apple_01:[[-.98,1.18,-5.23,.04,1.15],[-.84,1.18,-5.26,.62,1.05],[-.77,1.135,-5.03,0,1]],
    vintage_cabinet_01:[[-4.42,0,-3.61,Math.PI/2,1.18]],
    lantern_chandelier_01:[[0,3.76,-.78,0,1.32]],
  };
  let table;
  await Promise.allSettled(Object.entries(layout).map(async ([name,placements])=>{
    const asset=await loadProp(`props/kitchen/${name}/model.gltf`);
    if(!asset||!alive())return;
    if(name==='dining_table'){
      asset.getObjectByName('dining_table_cloth')?.removeFromParent();
      asset.traverse(part=>{
        if(!part.isMesh)return;
        part.material.color.set(0xa98b70);
        part.material.roughness=.87;
      });
      table=asset;
    }
    for(const [x,y,z,angle,size] of placements){
      const prop=placements.length===1?asset:asset.clone();
      const anchor=new THREE.Group();
      anchor.name=name;
      anchor.position.set(x,y,z);
      anchor.rotation.y=angle;
      if(name==='dining_table'){
        anchor.scale.set(.76,1.12,1.34);
        tableFallback.visible=false;
      }else if(name==='electric_stove'){
        anchor.scale.set(1.52,size,1.38);
      }else{
        anchor.scale.setScalar(size);
      }
      if(name==='brass_pan_01'&&y>2)prop.rotation.x=-Math.PI/2;
      anchor.add(prop);
      scene.add(anchor);
    }
    render();
  }));
  return Boolean(table);
}
