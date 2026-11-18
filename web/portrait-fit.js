// Head widths and depths measured across the front and profile reference sheets.
// The samples run from the jaw toward the crown in normalized standing height.
const sections={
  saint:[[.875,.105,.137],[.895,.126,.142],[.915,.139,.142],[.935,.134,.140],[.953,.118,.123],[.971,.090,.089]],
  prince:[[.875,.103,.125],[.895,.118,.133],[.915,.130,.136],[.935,.125,.126],[.953,.099,.113],[.971,.060,.072]],
};

export function fitPortraitGeometry(geometry, mask) {
  const points=geometry.attributes.position;
  const normals=geometry.attributes.normal;
  const bands=[[.846,1,1,0]];
  for(const [height,width,depth] of sections[mask]){
    const box=[Infinity,-Infinity,Infinity,-Infinity];
    for(let i=0;i<points.count;i++){
      if(Math.abs(points.getY(i)-height)>.006)continue;
      const x=points.getX(i),z=points.getZ(i);
      box[0]=Math.min(box[0],x);box[1]=Math.max(box[1],x);
      box[2]=Math.min(box[2],z);box[3]=Math.max(box[3],z);
    }
    if(!box.every(Number.isFinite))continue;
    bands.push([height,
      Math.min(1.06,Math.max(.94,width/(box[1]-box[0]))),
      Math.min(1.06,Math.max(.94,depth/(box[3]-box[2]))),
      (box[2]+box[3])*.5]);
  }
  bands.push([1.001,1,1,0]);
  for(let i=0;i<points.count;i++){
    const y=points.getY(i);
    if(y<=bands[0][0]||y>=bands.at(-1)[0])continue;
    const next=bands.findIndex(([height])=>height>y);
    const [lo,x1,z1,c1]=bands[next-1], [hi,x2,z2,c2]=bands[next];
    const t=(y-lo)/(hi-lo);
    const xScale=x1+(x2-x1)*t, zScale=z1+(z2-z1)*t;
    const center=c1+(c2-c1)*t;
    points.setX(i,points.getX(i)*xScale);
    points.setZ(i,center+(points.getZ(i)-center)*zScale);
    if(normals){
      const x=normals.getX(i)/xScale, ny=normals.getY(i), z=normals.getZ(i)/zScale;
      const length=Math.hypot(x,ny,z)||1;
      normals.setXYZ(i,x/length,ny/length,z/length);
    }
  }
  points.needsUpdate=true;
  if(normals)normals.needsUpdate=true;
}

// Match the registered portrait's facial relief while retaining the surrounding mesh.
export function sculptPortraitRelief(geometry, image) {
  const canvas=document.createElement('canvas');
  canvas.width=image.width;
  canvas.height=image.height;
  const context=canvas.getContext('2d');
  context.drawImage(image,0,0);
  const {width,height}=canvas;
  const {data}=context.getImageData(0,0,width,height);
  function sample(x,y,channel) {
    x=Math.max(0,Math.min(width-1.001,x));
    y=Math.max(0,Math.min(height-1.001,y));
    const left=Math.floor(x),top=Math.floor(y);
    const index=4*(top*width+left)+channel;
    const fx=x-left,fy=y-top;
    return ((1-fx)*data[index]+fx*data[index+4])*(1-fy)
      +((1-fx)*data[index+4*width]+fx*data[index+4*width+4])*fy;
  }
  const points=geometry.attributes.position;
  const normals=geometry.attributes.normal;
  for(let i=0;i<points.count;i++){
    const z=points.getZ(i);
    if(z<=.028)continue;
    const x=(.5+points.getX(i)/.192)*(width-1);
    const y=(.5-(points.getY(i)-.917)/.192)*(height-1);
    if(x<=0||x>=width-1||y<=0||y>=height-1)continue;
    const front=Math.min(1,(z-.028)/.02);
    const weight=sample(x,y,1)/255*.91*front*front*(3-2*front);
    if(weight<.001)continue;
    const target=sample(x,y,0)*.1/255;
    points.setZ(i,z+(target-z)*weight);
    if(!normals)continue;
    const dx=(sample(x+2,y,0)-sample(x-2,y,0))*.1/255*(width-1)/(.192*4);
    const dy=(sample(x,y+2,0)-sample(x,y-2,0))*.1/255*(height-1)/(.192*4);
    const slopeLength=Math.hypot(dx,dy,1);
    const nx=normals.getX(i)*(1-weight)-dx/slopeLength*weight;
    const ny=normals.getY(i)*(1-weight)+dy/slopeLength*weight;
    const nz=normals.getZ(i)*(1-weight)+weight/slopeLength;
    const length=Math.hypot(nx,ny,nz)||1;
    normals.setXYZ(i,nx/length,ny/length,nz/length);
  }
  points.needsUpdate=true;
  if(normals)normals.needsUpdate=true;
}
