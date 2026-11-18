import * as THREE from './vendor/three.module.min.js';
import { surfaceMaps } from './physical-materials.js?v=2';

const palettes={
  stone:[0x645e68,0x876e57,0x252331], wood:[0x594030,0x98684b,0x252428],
  city:[0x515c65,0x737e86,0x151b2b], green:[0x3c4731,0x6b5337,0x172920],
  ice:[0x6396ae,0xb0d8dc,0x152c45], sea:[0x367688,0x78969e,0x0d2739],
  space:[0x494b69,0x8a95b5,0x101226], stage:[0x57343f,0x866b65,0x211724],
  desert:[0x966b4b,0xc6a57c,0x32292c],
};

export const destinationSets={
  'front-door':['stone','manor'], 'flooded-archive':['sea','archive'], 'velvet-casino':['stage','casino'],
  village:['wood','cottages'], mountains:['ice','mountains'], underwater:['sea','ruins'], palace:['stone','palace'],
  forest:['green','forest'], home:['wood','living'], 'attic-bedroom':['wood','attic'],
  'dining-room':['wood','dining'], 'conference-room':['city','conference'],
  vault:['city','vault'], 'black-chapel':['stone','chapel'], 'glass-market':['ice','glassMarket'],
  'snow-caves':['ice','iceCave'], shrine:['green','shrine'], rooftops:['city','roofs'], 'game-park':['green','waterhole'],
  station:['space','station'], planet:['space','planet'], 'street-market':['wood','market'],
  'looping-street':['city','street'], 'boxing-ring':['stage','boxing'], 'sports-field':['green','pitch'],
  escape:['city','garage'], 'bell-bridge':['stone','bridge'], 'last-train':['wood','train'],
  yacht:['sea','yacht'], airstrip:['city','runway'], wilderness:['green','camp'], portal:['space','portal'],
  observatory:['desert','observatory'], cathedral:['stone','cathedral'], 'lantern-farm':['green','barn'],
  auditorium:['stage','auditorium'], greenhouse:['green','greenhouse'], backstage:['stage','dressing'],
};

export function buildDestination(id, {scene,block,mesh,round,ball,material,wood,bronze,warm,geometries,render,alive}) {
  const definition=destinationSets[id];
  if(!definition)return false;
  const [palette,layout]=definition;
  const [primary,accent,background]=palettes[palette];
  const walls=material(primary,{roughness:.9});
  const trim=material(accent,{roughness:.57});
  const ground=material(primary,{roughness:.88});
  const black=material(0x171920);
  const fabric=material(palette==='stage'?0x6d2437:0x35394d);
  const paper=material(0xb6a995);
  const glow=material(0x88aacc,{emissive:0x7189aa,emissiveIntensity:.35});
  const glass=material(0x95bad3,{transparent:true,opacity:.21,roughness:.19,depthWrite:false});
  const cone=new THREE.ConeGeometry(1,1,12);
  const torus=new THREE.TorusGeometry(1,.06,12,48);
  geometries.add(cone);geometries.add(torus);
  surfaceMaps(ground,palette==='wood'?'kitchen-floor':'stone',render,alive,[7,6]);
  surfaceMaps(walls,'kitchen-plaster',render,alive,[4,3]);
  scene.background.setHex(background);
  scene.fog.color.setHex(background);
  const groundMesh=block(ground,0,-.13,-4,26,.25,24);
  groundMesh.receiveShadow=true;
  const base=(mat,x,y,z,w,h,d)=>{const m=block(mat,x,y,z,w,h,d);m.castShadow=true;m.receiveShadow=true;return m;};
  const orb=(mat,x,y,z,r)=>mesh(ball,mat,x,y,z,r,r,r);
  const column=(x,z,h=4)=>{mesh(round,trim,x,h/2,z,.23,h,.23);base(walls,x,.15,z,.62,.30,.62);base(trim,x,h-.12,z,.65,.24,.65);};
  const lamp=(x,y,z)=>{orb(warm,x,y,z,.083);base(black,x,y-.11,z,.26,.06,.19);};
  const panels=(z=-6.8)=>{base(walls,0,2.72,z,13,5.45,.25);for(const side of [-1,1])base(walls,side*6.45,2.72,-2.85,.25,5.45,8);};
  const window=(x,y,z,w,h)=>{
    base(glow,x,y,z,w,h,.08);base(glass,x,y,z+.07,w,h,.025);
    for(const s of [-1,1]){base(wood,x+s*w/2,y,z+.11,.075,h,.06);base(wood,x,y+s*h/2,z+.11,w,.075,.06);}
    base(wood,x,y,z+.12,.046,h,.06);
  };
  const ring=(mat,x,y,z,s)=>mesh(torus,mat,x,y,z,s,s,s);
  const door=(x,z)=>{base(black,x,1.53,z,1.78,3.06,.15);for(const side of [-1,1])base(wood,x+side*.91,1.54,z,.13,3.15,.23);base(wood,x,3.10,z,1.94,.19,.23);orb(bronze,x+.55,1.27,z+.12,.065);};
  const bench=(x,z,w)=>{base(wood,x,.48,z,w,.12,.47);base(wood,x,.78,z-.22,w,.48,.085);for(const s of [-1,1])base(black,x+s*w*.39,.23,z,.14,.46,.36);};
  const table=(x,z,w,d)=>{base(wood,x,.90,z,w,.12,d);for(const a of [-1,1])for(const b of [-1,1])base(wood,x+a*w*.42,.43,z+b*d*.40,.12,.86,.12);};
  const shelf=(x,z,w)=>{
    base(wood,x,1.65,z,w,3.3,.27);
    for(let row=0;row<4;row++){
      const y=.48+row*.74;
      base(trim,x,y,z+.24,w,.10,.5);
      for(let i=0;i<7;i++)base(i%3?fabric:paper,x+(i-3)*w*.12,y+.27,z+.26,w*.087,.39+(i%3)*.055,.25);
    }
  };
  const roof=(x,z,w,y)=>{
    for(const s of [-1,1])base(black,x+s*w*.25,y,z,w*.57,.14,1.95).rotation.z=s*-.55;
  };
  const building=(x,z,w,h)=>{base(walls,x,h/2,z,w,h,1.74);roof(x,z,w,h+.14);window(x,h*.68,z+.91,w*.31,h*.34);doorLight(x,h*.32,z+.94);};
  const doorLight=(x,y,z)=>base(wood,x,y,z,.43,.63,.07);
  const boulder=(x,y,z,sx,sy,sz,mat=walls)=>{const rock=mesh(ball,mat,x,y,z,sx,sy,sz);rock.rotation.set(.19,x*.61,z*.34);return rock;};
  const peaks=(count,mat=walls)=>{
    for(let i=0;i<count;i++){
      const cliff=boulder((i-(count-1)/2)*2.3,2.0,-10-(i%3)*1.2,2.5,3.6+(i%3)*1.25,2.8,mat);
      cliff.name='Cliff placeholder';
    }
  };
  const tree=(x,z,h,pine=false)=>{
    mesh(round,wood,x,h*.40,z,.14,h*.80,.13);
    for(let i=0;i<4;i++){
      const s=h*(.26-i*.039),y=h*(.51+i*.14);
      if(pine)mesh(cone,walls,x,y,z,s,h*.57,s);
      else boulder(x+Math.sin(i*8)*s*.51,y,z+Math.cos(i*8)*s*.52,s*1.26,s*.69,s,walls);
    }
  };
  const grove=(pine=false)=>{for(let i=0;i<16;i++)tree((i%8-3.5)*1.83,-7.3-Math.floor(i/8)*3.6-(i%3)*.84,3.4+(i%5)*.48,pine);};
  const skyline=(offset=0)=>{for(let i=0;i<14;i++){
    const x=(i-6.5)*1.1,z=-10-(i%3)*1.7,h=2.2+(i*7%9)*.52+offset;
    base(black,x,h/2-offset,z,.98,h,1.19);
    for(let j=0;j<5;j++)if((i+j)%3)base(glow,x,h*.19+j*.41-offset,z+.61,.21,.13,.02);
  }};
  const lake=(y=-.04)=>{const water=base(material(0x244f65,{metalness:.19,roughness:.24}),0,y,-9,25,.08,10);surfaceMaps(water.material,'stone',render,alive,[6,3]);};
  const arch=(x,z,w,h)=>{
    const opening=ring(trim,x,h-.92,z,w*.52);
    opening.scale.y*=.58;
    for(const s of [-1,1])base(trim,x+s*w*.52,(h-.92)/2,z,.18,h-.92,.25);
  };
  const stage=(z=-5.8)=>{base(wood,0,.32,z,9,.64,2.3);for(let i=0;i<18;i++)base(fabric,(i-8.5)*.49,2.9,z-1.1,.50,4.6,.18+(i%2)*.13);};
  const rails=(z=-5.2)=>{for(const y of [.62,1.08])base(trim,0,y,z,10.8,.05,.08);for(let i=-5;i<=5;i++)base(black,i,.53,z,.07,1.06,.08);};
  const stall=(x,z,transparent)=>{table(x,z,2.1,.78);for(const side of [-1,1])base(wood,x+side*.97,1.48,z,.09,2.96,.11);
    base(transparent?glass:fabric,x,2.42,z,2.28,.13,1.36).rotation.x=.23;
    for(let i=0;i<5;i++)base(i%2?trim:wood,x+(i-2)*.38,1.04,z,.33,.17,.46);
    lamp(x,2.18,z+.28);
  };
  const moon=(x,y,z,r)=>orb(glow,x,y,z,r);
  const roomLamps=()=>{for(const x of [-4.2,4.2])lamp(x,2.85,-6.52);};
  const cases={
    manor(){panels();door(0,-6.55);arch(0,-6.32,2.06,3.9);window(-3.7,2.7,-6.55,1.45,2.55);window(3.7,2.7,-6.55,1.45,2.55);roomLamps();},
    archive(){panels();lake(.025);for(const x of [-3.8,-1.75,1.75,3.8])shelf(x,-5.95,1.64);door(0,-6.48);},
    casino(){panels();stage();for(const x of [-4.1,4.1]){table(x,-4.3,1.3,.85);ring(bronze,x,1.04,-4.3,.42).rotation.x=Math.PI/2;lamp(x,2.52,-5.5);}},
    cottages(){for(let i=-2;i<=2;i++)building(i*2.5,-7-Math.abs(i)*.65,1.86,2.3+(i%2)*.3);grove();},
    mountains(){peaks(8,trim);for(let i=-6;i<=6;i++)boulder(i*1.2,.46,-6.2-(i%3),.92,.7,.76);rails(-5.25);},
    ruins(){lake();for(let i=-4;i<=4;i++)column(i*1.52,-6.85,i%3===0?2.6:4.3);arch(0,-6.05,2.9,3.5);scene.fog.density=.085;},
    palace(){panels();for(let i=-3;i<=3;i++)column(i*1.8,-6.15,4.76);for(const x of [-3.3,0,3.3])arch(x,-5.99,2.6,4.5);roomLamps();},
    forest(){grove(true);for(let i=-4;i<=4;i++)boulder(i*1.3,.21,-5.8,.67,.40,.64);},
    living(){panels();window(-3.2,2.72,-6.56,1.5,2.02);base(fabric,1.8,.55,-5.6,3,.66,.93);base(fabric,1.8,.93,-6,3,.95,.24);table(-1.4,-4.9,1.2,.62);lamp(3.68,1.9,-5.56);},
    attic(){panels();for(const side of [-1,1])base(wood,side*2.95,4.88,-3.6,6.62,.17,7).rotation.z=side*-.46;
      base(wood,2.9,.4,-5.05,2.15,.68,2.95);base(paper,2.9,.76,-5.05,2.04,.24,2.66);base(fabric,2.9,.87,-4.59,2.06,.10,1.7);base(paper,2.9,.92,-5.91,1.7,.21,.45);window(-1.6,2.58,-6.54,1.04,1.37);},
    dining(){panels();table(0,-5.52,8.3,1.1);for(let i=-5;i<=5;i++){bench(i*.69,-6.38,.49);lamp(i*.69,1.19,-5.52);}roomLamps();},
    conference(){panels();base(paper,0,2.98,-6.58,5.4,2.18,.06);base(black,0,4.13,-6.52,5.5,.12,.12);table(0,-5.22,4.9,.78);for(let i=-3;i<=3;i++)base(black,i*.61,1.03,-5.15,.18,.18,.07).rotation.x=-.3;},
    vault(){panels();mesh(round,trim,0,2.22,-6.43,1.91,.29,1.91).rotation.x=Math.PI/2;ring(black,0,2.22,-6.21,1.56);for(let i=0;i<8;i++)orb(bronze,Math.cos(i*.785)*1.28,2.22+Math.sin(i*.785)*1.28,-6.15,.085);ring(bronze,0,2.2,-6.09,.50);roomLamps();},
    chapel(){panels();arch(0,-6.44,2.5,4.4);table(0,-5.59,2,.72);lamp(-.57,1.25,-5.6);lamp(.57,1.25,-5.6);for(const x of [-3.1,3.1])bench(x,-4.6,2.05);},
    glassMarket(){panels();for(const x of [-2.85,0,2.85])stall(x,-5.5,true);},
    iceCave(){for(let i=0;i<15;i++){const x=(i-7)*.85;boulder(x,1.35,-7.2,1.22,2.3+(i%3)*.46,1.22);mesh(cone,trim,x,3.87,-6.28,.42,1.73,.36).rotation.x=Math.PI;}lake(-.028);},
    shrine(){grove();for(const x of [-1.69,1.69])base(trim,x,1.55,-5.69,.20,3.1,.24);base(wood,0,3.12,-5.69,4.15,.18,.33);base(black,0,3.48,-5.69,4.56,.17,.39);table(0,-6.8,1.6,.49);for(const x of [-2.4,2.4])lamp(x,1.78,-5.36);},
    roofs(){skyline(2.2);rails();base(black,-2.8,.89,-4.9,1.3,1.78,.77);base(trim,2.8,.54,-4.83,2.1,1.08,.68);},
    waterhole(){grove();lake();for(const x of [-4.9,-3.8,3.8,4.9])boulder(x,.63,-5.48,1.02,.56,.72);},
    station(){panels();for(let i=-3;i<=3;i++){base(trim,i*1.65,2.7,-6.51,.29,5,.44);base(glow,i*1.65,4.37,-6.27,.18,.51,.03);}ring(trim,0,2.52,-6.1,1.62);orb(black,0,2.52,-6.28,1.47);moon(.6,3,-6.08,.41);},
    planet(){peaks(7);moon(-3.7,4.3,-12,1.18);moon(2.3,5.6,-15,.73);for(const x of [-5,-3.9,4.1,4.8])mesh(cone,trim,x,.76,-5.64,.35,1.52,.35).rotation.z=.28;},
    market(){for(const x of [-3.65,0,3.65])stall(x,-5.57,false);skyline();},
    street(){for(let i=-3;i<=3;i++)building(i*2.0,-7.1+Math.abs(i)*.11,1.91,2.6+(i%3)*.29);for(const x of [-4.3,4.3]){base(black,x,1.45,-5.55,.08,2.9,.08);lamp(x,2.95,-5.55);}},
    boxing(){panels();for(const x of [-3.25,3.25])base(trim,x,.95,-3.55,.18,1.9,.18);for(const y of [.69,1.04,1.4])base(fabric,0,y,-3.55,6.48,.056,.065);for(let i=0;i<4;i++)bench(0,-4.6-i*.47,10.7);},
    pitch(){for(const x of [-3.2,3.2]){base(paper,x,1.48,-6.2,.10,2.96,.10);base(black,x*1.55,2.5,-7.2,.10,5,.10);for(let i=0;i<3;i++)lamp(x*1.55+(i-1)*.21,5.05,-7.2);}base(paper,0,2.98,-6.2,6.48,.10,.10);for(let i=-6;i<=6;i++)base(trim,i*.47,1.5,-6.42,.018,2.9,.016);},
    garage(){panels();for(let i=0;i<13;i++)base(black,0,.45+i*.27,-6.48,8.8,.22,.08);for(const x of [-4.5,4.5])lamp(x,2.8,-5.6);base(trim,-2.9,.51,-4.78,1.8,.69,.86);},
    bridge(){lake();rails();base(wood,0,-.026,-5.4,4.1,.13,4.3);for(let i=0;i<14;i++)base(wood,0,.043,-3.69-i*.25,4.08,.04,.223);arch(0,-6.43,2.67,3.81);mesh(round,bronze,0,2.66,-6.02,.43,.45,.43);},
    train(){panels();for(let i=-2;i<=2;i++){window(i*2.13,2.62,-6.5,1.71,1.55);bench(i*2.13,-5.81,1.6);}base(trim,0,3.65,-6.12,11,.09,.33);},
    yacht(){lake();skyline();base(wood,0,-.047,-3.23,10,.14,5.6);rails(-5.79);base(paper,2.86,1.2,-5.26,3.22,2.35,1.6);window(2.86,1.75,-4.42,2.2,.82);ring(bronze,-3.4,1.06,-5.68,.39);},
    runway(){for(let i=-5;i<=5;i++){lamp(i*1.03,.16,-6.25);base(paper,i*1.1,.012,-5.64,.58,.02,.09);}base(walls,-3.1,1.8,-8,4.4,3.6,2.4);window(-3.1,2.45,-6.77,3.5,.61);base(black,3.5,.62,-8,4.2,.31,1.4);},
    camp(){grove(true);for(let i=0;i<10;i++)boulder(Math.sin(i*.628)*.7,.15,-5.51+Math.cos(i*.628)*.7,.23,.15,.24);for(let i=0;i<4;i++)mesh(cone,warm,Math.sin(i*2.2)*.22,.36,-5.48,.16,.65-(i%2)*.14,.15);bench(-2.28,-5.5,1.53);},
    portal(){peaks(5);for(let i=-3;i<=3;i++)boulder(i*1.78,1.55+(i%3)*.41,-8.37,1.09,.43,1.01);ring(glow,0,2.42,-5.92,1.57);ring(trim,0,2.42,-5.97,1.74);},
    observatory(){panels();const dome=boulder(0,3.05,-6.67,4.25,2.3,1.5);dome.material=trim;const barrel=mesh(round,black,0,2.4,-5.8,.28,2.25,.28);barrel.rotation.z=-.89;mesh(round,bronze,-.6,1.48,-5.64,.16,1.48,.16);moon(4.3,4.97,-8.4,.52);},
    cathedral(){panels();for(const x of [-4.5,-2.25,0,2.25,4.5]){window(x,3.48,-6.53,1.08,2.89);arch(x,-6.26,1.36,4.49);}for(const x of [-3.8,3.8])bench(x,-4.95,2.08);},
    barn(){building(0,-7.52,6.45,3.86);door(0,-6.51);for(const x of [-3.85,3.85]){boulder(x,.51,-5.1,.62,.57,.62,trim);base(wood,x,.19,-5.93,1.4,.38,.91);}lamp(0,2.78,-6.32);},
    auditorium(){panels();stage();for(let i=0;i<6;i++)for(const x of [-3.3,3.3])bench(x,-3.9-i*.34,1.75);for(const x of [-4.25,4.25])lamp(x,3.66,-5.4);},
    greenhouse(){for(const x of [-4.5,-2.25,0,2.25,4.5]){base(glass,x,2.29,-6.62,2.13,4.58,.05);base(trim,x+1.09,2.29,-6.54,.08,4.58,.09);table(x,-5.52,1.66,.65);for(let i=0;i<3;i++){mesh(round,wood,x+(i-1)*.45,1.04,-5.56,.16,.24,.16);tree(x+(i-1)*.45,-5.56,1.63);}}},
    dressing(){panels();for(const x of [-4,4])door(x,-6.48);table(0,-5.61,3.3,.64);base(glass,0,2.51,-6.47,3.55,2.45,.06);for(let i=-3;i<=3;i++){lamp(i*.52,1.38,-6.33);orb(warm,i*.52,3.68,-6.33,.068);}},
  };
  cases[layout]();
  return true;
}
