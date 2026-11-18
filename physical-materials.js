import * as THREE from './vendor/three.module.min.js';
import { RGBELoader } from './vendor/RGBELoader-r169.js';

const assets=new Map();
function asset(name,normal=false){
  if(!assets.has(name)){
    const pending=(name==='studio'?
      new RGBELoader().loadAsync('materials/studio.hdr'):
      new THREE.TextureLoader().loadAsync(`materials/${name}.webp`)).then(texture=>{
        if(name==='studio')texture.mapping=THREE.EquirectangularReflectionMapping;
        else if(!normal)texture.colorSpace=THREE.SRGBColorSpace;
        texture.anisotropy=4;
        return texture;
      }).catch(()=>{
        assets.delete(name);
        return null;
      });
    assets.set(name,pending);
  }
  return assets.get(name);
}

// The fetched source textures are shared. A scene owns its material settings.
export function surfaceMaps(material,name,refresh,alive,repeat){
  void Promise.all([asset(name),asset(name+'-normal',true)]).then(([map,normal])=>{
    if(!alive()||!map)return;
    const tile=texture=>{
      if(!texture||!repeat)return texture;
      const tiled=texture.clone();
      tiled.wrapS=tiled.wrapT=THREE.RepeatWrapping;
      tiled.repeat.set(...repeat);
      tiled.needsUpdate=true;
      return tiled;
    };
    material.map=tile(map);
    material.normalMap=tile(normal);
    if(repeat)material.addEventListener('dispose',()=>{
      material.map?.dispose();
      material.normalMap?.dispose();
    },{once:true});
    material.normalScale.set(.43,.43);
    material.needsUpdate=true;
    refresh();
  });
}
export function clothMap(material,refresh,alive){
  void asset('cloth-normal',true).then(normal=>{
    if(!alive()||!normal)return;
    material.normalMap=normal;
    material.normalScale.set(.30,.30);
    material.needsUpdate=true;
    refresh();
  });
}
export function studioLight(scene,refresh,alive){
  void asset('studio').then(texture=>{
    if(!alive()||!texture)return;
    scene.environment=texture;
    scene.environmentIntensity=.55;
    scene.environmentRotation.y=.48;
    refresh();
  });
}
