import * as THREE from './vendor/three.module.min.js';

export function addPortraitDetail(material,portrait,mask,height) {
  portrait.colorSpace=THREE.SRGBColorSpace;
  portrait.anisotropy=4;
  material.onBeforeCompile=shader=>{
    shader.uniforms.facePortrait={value:portrait};
    shader.uniforms.portraitFraming={value:new THREE.Vector3(mask==='saint'?.53:.49,mask==='saint'?.55:.58,height)};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 faceRest;\nvarying vec3 faceNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nfaceRest=position; faceNormal=normal;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform sampler2D facePortrait;\nuniform vec3 portraitFraming;\nvarying vec3 faceRest;\nvarying vec3 faceNormal;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        vec3 face=faceRest/portraitFraming.z;
        vec2 faceUV=portraitFraming.xy+vec2(face.x*5.0,(face.y-.918)*5.7);
        float oval=1.0-smoothstep(.66,1.0,length(vec2(face.x/.060,(face.y-.917)/.064)));
        float forward=smoothstep(.16,.77,normalize(faceNormal).z)*smoothstep(.020,.046,face.z);
        vec3 referenceColor=texture2D(facePortrait,faceUV).rgb;
        diffuseColor.rgb=mix(diffuseColor.rgb,referenceColor,oval*forward*.62);
      `);
  };
}
