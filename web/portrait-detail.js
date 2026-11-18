import * as THREE from './vendor/three.module.min.js';

export function addPortraitDetail(material,portrait,profiles,height) {
  portrait.colorSpace=THREE.SRGBColorSpace;
  portrait.anisotropy=4;
  profiles.forEach(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.facePortrait={value:portrait};
    shader.uniforms.faceLeft={value:profiles[0]};
    shader.uniforms.faceRight={value:profiles[1]};
    shader.uniforms.profileStrength={value:profiles[0]===portrait?0:1};
    shader.uniforms.characterHeight={value:height};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 faceRest;\nvarying vec3 faceNormal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nfaceRest=position; faceNormal=normal;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform sampler2D facePortrait;\nuniform sampler2D faceLeft;\nuniform sampler2D faceRight;\nuniform float profileStrength;\nuniform float characterHeight;\nvarying vec3 faceRest;\nvarying vec3 faceNormal;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(.78,roughnessFactor);')
      .replace('#include <map_fragment>',`#include <map_fragment>
        vec3 face=faceRest/characterHeight;
        vec3 n=normalize(faceNormal);
        vec2 faceUV=vec2(.5)+vec2(face.x,face.y-.917)/.192;
        vec4 reference=texture2D(facePortrait,faceUV);
        float forward=smoothstep(.008,.039,face.z);
        float frontMix=reference.a*forward;
        diffuseColor.rgb=mix(diffuseColor.rgb,reference.rgb,frontMix);
        float across=smoothstep(.40,.86,abs(n.x));
        float head=smoothstep(.845,.873,face.y)*(1.0-smoothstep(.98,1.0,face.y));
        float profileY=.61+(face.y-.91)*5.5;
        vec4 leftProfile=texture2D(faceLeft,vec2(.50-face.z*4.9,profileY));
        vec4 rightProfile=texture2D(faceRight,vec2(.50+face.z*4.9,profileY));
        vec4 profile=mix(rightProfile,leftProfile,step(0.0,n.x));
        diffuseColor.rgb=mix(diffuseColor.rgb,profile.rgb,profile.a*across*head*profileStrength*.84*(1.0-frontMix*.92));
      `);
  };
}
