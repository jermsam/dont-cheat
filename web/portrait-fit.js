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
