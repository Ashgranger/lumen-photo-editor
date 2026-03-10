export interface Adjustments {
  exposure: number; contrast: number; highlights: number; shadows: number;
  whites: number; blacks: number; temp: number; tint: number;
  saturation: number; vibrance: number; clarity: number; dehaze: number;
  sharpness: number; vignette: number;
}

export const defaultAdjustments: Adjustments = {
  exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,
  temp:0,tint:0,saturation:0,vibrance:0,clarity:0,dehaze:0,sharpness:0,vignette:0
};

const clamp = (v:number) => Math.min(255,Math.max(0,v));

function rgbToHsl(r:number,g:number,b:number):[number,number,number]{
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h=0,s=0;const l=(max+min)/2;
  if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}
  return[h,s,l];
}

function hslToRgb(h:number,s:number,l:number):[number,number,number]{
  if(s===0){const v=l*255;return[v,v,v];}
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  const h2r=(p:number,q:number,t:number)=>{
    if(t<0)t+=1;if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;
  };
  return[h2r(p,q,h+1/3)*255,h2r(p,q,h)*255,h2r(p,q,h-1/3)*255];
}

export function applyAdjustments(src:ImageData,adj:Adjustments,w:number,h:number):ImageData{
  const out=new ImageData(w,h);const d=src.data,o=out.data;
  const expF=Math.pow(2,adj.exposure/50);
  const conF=adj.contrast!==0?(259*(adj.contrast+255))/(255*(259-adj.contrast)):1;
  const satF=1+adj.saturation/100;const vibF=adj.vibrance/100;

  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    r*=expF;g*=expF;b*=expF;
    if(adj.temp!==0){r+=adj.temp*.6;b-=adj.temp*.6;}
    if(adj.tint!==0){g+=adj.tint*.4;}
    if(adj.contrast!==0){r=conF*(r-128)+128;g=conF*(g-128)+128;b=conF*(b-128)+128;}
    const lum=.299*r+.587*g+.114*b;
    if(adj.highlights!==0&&lum>128){const t=(lum-128)/127,f=(adj.highlights/200)*t;
      if(adj.highlights>0){r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}else{r+=r*f;g+=g*f;b+=b*f;}}
    if(adj.shadows!==0&&lum<128){const t=(128-lum)/128,f=(adj.shadows/200)*t;
      if(adj.shadows>0){r+=r*f;g+=g*f;b+=b*f;}else{r-=r*Math.abs(f);g-=g*Math.abs(f);b-=b*Math.abs(f);}}
    if(adj.whites!==0){const wf=adj.whites/400;r+=r*wf;g+=g*wf;b+=b*wf;}
    if(adj.blacks!==0){const bf=adj.blacks/400;r=r*(1-bf*(1-r/255));g=g*(1-bf*(1-g/255));b=b*(1-bf*(1-b/255));}
    if(adj.saturation!==0){const l2=(Math.max(r,g,b)/255+Math.min(r,g,b)/255)/2;
      r=clamp(l2*255+(r-l2*255)*satF);g=clamp(l2*255+(g-l2*255)*satF);b=clamp(l2*255+(b-l2*255)*satF);}
    if(adj.vibrance!==0){const[hh,s,ll]=rgbToHsl(clamp(r),clamp(g),clamp(b));
      const boost=vibF*(1-s)*(1-s);const ns=Math.min(1,s+boost);[r,g,b]=hslToRgb(hh,ns,ll);}
    if(adj.dehaze>0){const df=adj.dehaze/200;r=clamp(r-128*df+r*df);g=clamp(g-128*df+g*df);b=clamp(b-128*df+b*df);}
    o[i]=clamp(r);o[i+1]=clamp(g);o[i+2]=clamp(b);o[i+3]=d[i+3];
  }

  if(adj.sharpness>0)applyUnsharp(o,w,h,adj.sharpness/100*1.5);
  if(adj.vignette!==0)applyVignette(o,w,h,adj.vignette/100);
  return out;
}

function applyUnsharp(data:Uint8ClampedArray,w:number,h:number,s:number){
  const c=new Uint8ClampedArray(data);
  const k=[-s,-s,-s,-s,1+8*s,-s,-s,-s,-s];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=(y*w+x)*4;
    for(let ch=0;ch<3;ch++){let sum=0;
      for(let ky=-1;ky<=1;ky++)for(let kx=-1;kx<=1;kx++)sum+=c[((y+ky)*w+(x+kx))*4+ch]*k[(ky+1)*3+(kx+1)];
      data[i+ch]=clamp(sum);}
  }
}

function applyVignette(data:Uint8ClampedArray,w:number,h:number,s:number){
  const cx=w/2,cy=h/2,maxD=Math.sqrt(cx*cx+cy*cy);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,dist=Math.sqrt((x-cx)**2+(y-cy)**2)/maxD;
    const f=1+s*dist*dist*2;
    data[i]=clamp(data[i]*f);data[i+1]=clamp(data[i+1]*f);data[i+2]=clamp(data[i+2]*f);
  }
}

export function applyGrayscale(d:Uint8ClampedArray){
  for(let i=0;i<d.length;i+=4){const l=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=l;}
}
export function applySepia(d:Uint8ClampedArray){
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];
    d[i]=clamp(r*.393+g*.769+b*.189);d[i+1]=clamp(r*.349+g*.686+b*.168);d[i+2]=clamp(r*.272+g*.534+b*.131);}
}
export function applyInvert(d:Uint8ClampedArray){
  for(let i=0;i<d.length;i+=4){d[i]=255-d[i];d[i+1]=255-d[i+1];d[i+2]=255-d[i+2];}
}
export function applyCoolFilter(d:Uint8ClampedArray){
  for(let i=0;i<d.length;i+=4){d[i]=clamp(d[i]*.85);d[i+2]=clamp(d[i+2]*1.2);}
}
export function applyWarmFilter(d:Uint8ClampedArray){
  for(let i=0;i<d.length;i+=4){d[i]=clamp(d[i]*1.2);d[i+2]=clamp(d[i+2]*.85);}
}
export function applyCrosshatch(d:Uint8ClampedArray,w:number,h:number){
  for(let i=0;i<d.length;i+=4){
    const x=(i/4)%w,y=Math.floor(i/4/w);
    const l=.299*d[i]+.587*d[i+1]+.114*d[i+2];
    const edge=(x%20<2||y%20<2)?0.6:1;
    d[i]=clamp(l*edge);d[i+1]=clamp(l*edge);d[i+2]=clamp(l*edge);
  }
}

export function computeHistogram(data:Uint8ClampedArray){
  const r=new Array(256).fill(0),g=new Array(256).fill(0),b=new Array(256).fill(0),lum=new Array(256).fill(0);
  for(let i=0;i<data.length;i+=4){
    r[data[i]]++;g[data[i+1]]++;b[data[i+2]]++;
    lum[Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2])]++;
  }
  return{r,g,b,lum};
}

export function drawHistogram(canvas:HTMLCanvasElement,hist:{r:number[],g:number[],b:number[],lum:number[]}){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#0d0d14';ctx.fillRect(0,0,w,h);
  const maxV=Math.max(...hist.r,...hist.g,...hist.b)||1;
  [[hist.lum,'rgba(150,150,200,0.25)'],[hist.r,'rgba(255,77,109,0.5)'],[hist.g,'rgba(74,222,128,0.4)'],[hist.b,'rgba(110,231,255,0.5)']].forEach(([bins,color])=>{
    ctx.beginPath();ctx.moveTo(0,h);
    (bins as number[]).forEach((v,i)=>{ctx.lineTo((i/255)*w,h-(v/maxV)*(h-2));});
    ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=color as string;ctx.fill();
  });
}
