const art = document.querySelector('#art');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)');
try {
  const svg = art.querySelector('svg');
  const paths = [...svg.querySelectorAll('path')];
  let stride = 0;
  const lines = paths.map(path => {
    const points = JSON.parse(path.dataset.points);
    const offset = stride;
    stride += points.length;
    return {path, points, offset, y: new Float64Array(points.length), segments:points.slice(0,-1).map((p1,i)=>{
      const p0=points[Math.max(0,i-1)], p2=points[i+1], p3=points[Math.min(points.length-1,i+2)];
      return [(p1[0]+(p2[0]-p0[0])/6).toFixed(2),(p2[0]-(p3[0]-p1[0])/6).toFixed(2),p2[0].toFixed(2)];
    })};
  });
  let frames, count, frameId=0, lastFrame=null, lastPaint=null, elapsed=0;
  const fps=Number(svg.dataset.loopFps);
  const staticPaths = paths.map(path => path.getAttribute('d'));
  function draw() {
    const position=(elapsed*fps)%count;
    const index=Math.floor(position), mix=position-index;
    const a=index*stride, b=((index+1)%count)*stride;
    for(const {path,points,offset,y,segments} of lines){
      for(let i=0;i<y.length;i++) y[i]=(frames[a+offset+i]*(1-mix)+frames[b+offset+i]*mix)/100;
      let d=`M ${points[0][0].toFixed(2)} ${y[0].toFixed(2)}`;
      for(let i=0;i<segments.length;i++){
        const p0=y[Math.max(0,i-1)],p1=y[i],p2=y[i+1],p3=y[Math.min(y.length-1,i+2)];
        const x=segments[i];
        d+=` C ${x[0]} ${(p1+(p2-p0)/6).toFixed(2)} ${x[1]} ${(p2-(p3-p1)/6).toFixed(2)} ${x[2]} ${p2.toFixed(2)}`;
      }
      path.setAttribute('d',d);
    }
  }
  function tick(timestamp){
    const interval=1000/(mobile.matches?30:60);
    if(lastPaint!==null && timestamp-lastPaint<interval-1){frameId=requestAnimationFrame(tick);return;}
    const delta=lastFrame===null?0:Math.min((timestamp-lastFrame)/1000,.1);
    elapsed=(elapsed+delta)%(count/fps);
    lastFrame=lastPaint=timestamp;
    draw();
    frameId=requestAnimationFrame(tick);
  }
  function updatePlayback(){
    cancelAnimationFrame(frameId);
    lastFrame=lastPaint=null;
    if (mobile.matches || reducedMotion.matches) {
      elapsed = 0;
      paths.forEach((path, index) => path.setAttribute('d', staticPaths[index]));
      return;
    }
    if(frames && !document.hidden) frameId=requestAnimationFrame(tick);
  }
  // Keep the matching inline first frame visible until the cache is ready.
  // Phones and reduced-motion visitors need no animation download.
  let loading;
  async function load(){
    if(frames || loading || reducedMotion.matches || mobile.matches)return;
    loading=(async()=>{
      const response=await fetch(new URL(svg.dataset.loopSrc,import.meta.url));
      if(!response.ok)throw new Error('Wave loop could not be loaded');
      const buffer=await response.arrayBuffer();
      if(buffer.byteLength%(stride*2)!==0 || buffer.byteLength<stride*4)throw new Error('Invalid wave loop');
      const view=new DataView(buffer);
      frames=new Int16Array(buffer.byteLength/2);
      for(let i=0;i<frames.length;i++)frames[i]=view.getInt16(i*2,true);
      count=frames.length/stride;
      updatePlayback();
    })();
    try{await loading;}catch(error){console.error(error);}finally{loading=null;}
  }
  reducedMotion.addEventListener('change',()=>{updatePlayback();load();});
  mobile.addEventListener('change',()=>{updatePlayback();load();});
  document.addEventListener('visibilitychange',updatePlayback);
  await load();
}catch(error){console.error(error);}
