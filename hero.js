// PALIMPSEST hero — external on purpose: an annotator/extension that re-serializes the DOM
// silently kills inline scripts (re-inserted <script> never executes). External files survive.
//
// The sequence, in order:
//   1. the wordmark cycles fonts in BATCHES OF TWO letters, each batch on its own clock,
//      all batches aligning to one font every 10 seconds. Materials: Monochrome (half/fully
//      shaded squares), Squareish, Dots. (Boxes removed — uniform small squares as strokes.)
//   2. scroll (or click) flips the t over its own ink; it lands as f, s+f go blue, and EVERY
//      letter locks to the sf's material — Monochrome, the half/fully-shaded squares. The
//      cycling stops the moment the blue appears. The rest gray out; sf flashes — click it.
//   3. click sf → "version histories of the city, / parcel by parcel" types out LEFT-ALIGNED
//      directly beneath the s character, then "peel to explore" — and next to it an UNEVEN
//      HOLE already torn in the paper, showing the basemap underneath. No squares, no grid
//      transition: the tear is the whole mechanism now.
//   4. the first mouse movement starts the brush-to-tear: the wordmark and title fade off,
//      the parcel outlines bloom, and every sweep of the cursor rips more paper away from
//      the gray city basemap. The tear edges run through the SAME #tornpaper displacement
//      filter the old sticker used — one vocabulary of ripped paper.
//      No sticker top-left; instead the basemap's description sits in small caps in the
//      whitespace at the top of the map border (#mapcap). Photographs hover-surface over
//      the parcels (geotagged cards → the map).
(function(){
if(window.__heroBooted)return; window.__heroBooted=true;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ez=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const smooth=(p,a,b)=>ez(clamp((p-a)/(b-a),0,1));
const BLUE='#2456d6';

// ---------------- the wordmark ---------------------------------------------------------------
const FONTS=['A000-Monochrome','A000-Squareish','A000-Dots'];   // Monochrome stays [0] — the lock target
const word=document.getElementById('word');
word.innerHTML='';
const FADERS='palimpse'.split('');
const faderEls=FADERS.map(ch=>{ const s=document.createElement('span'); s.textContent=ch; word.appendChild(s); return s; });
const sfs=document.createElement('span'); sfs.id='sfs'; sfs.textContent='s'; word.appendChild(sfs);
const tf=document.createElement('span'); tf.id='tf'; word.appendChild(tf);
const tg=document.createElement('span'); tg.id='tglyph'; tg.textContent='t'; tg.style.display='inline-block'; tf.appendChild(tg);
tg.style.transformOrigin='50% 49%';

// batches of two, left to right; the sf pair is the last batch
const BATCHES=[[faderEls[0],faderEls[1]],[faderEls[2],faderEls[3]],
               [faderEls[4],faderEls[5]],[faderEls[6],faderEls[7]],[sfs,tf]];
const bstate=BATCHES.map((_,i)=>({f:i%FONTS.length, next:0}));
let sfLocked=false, syncFont=0;
function setBatch(i,fi){
  bstate[i].f=fi;
  BATCHES[i].forEach(el=>el.style.fontFamily="'"+FONTS[fi]+"'");
}
function fontTick(ts){
  if(sfLocked)return;                         // the blue appeared — the material is settled
  const t=ts/1000;
  const inSync=(t%10)<1.1;                    // the once-per-10s alignment window
  if(inSync){
    const F=Math.floor(t/10)%FONTS.length;
    if(F!==syncFont||bstate.some(b=>b.f!==F)){
      syncFont=F;
      BATCHES.forEach((_,i)=>{ setBatch(i,F); bstate[i].next=t+1.1+Math.random()*1.2; });
    }
  }else{
    bstate.forEach((b,i)=>{
      if(t>=b.next){
        let nf; do{nf=Math.floor(Math.random()*FONTS.length)}while(nf===b.f);
        setBatch(i,nf);
        b.next=t+0.9+Math.random()*1.7;       // varying times, per batch
      }
    });
  }
}
// lock every letter to its widest advance across the fonts — no reflow while cycling
function lockWidths(){
  const fs=parseFloat(getComputedStyle(word).fontSize);
  const mc=document.createElement('canvas').getContext('2d');
  const widest=ch=>Math.max(...FONTS.map(f=>{ mc.font=fs+"px '"+f+"'"; return mc.measureText(ch).width; }));
  faderEls.forEach(el=>{ el.style.width=widest(el.textContent)+'px'; el.style.textAlign='center'; });
  sfs.style.width=widest('s')+'px'; sfs.style.textAlign='center';
  tf.style.width=widest('t')+'px'; tf.style.textAlign='center'; tf.style.display='inline-block';
}

// ---------------- refs + scroll ---------------------------------------------------------------
const stage=document.getElementById('stage'),
      tl1=document.getElementById('tl1'), hint=document.getElementById('hint'),
      mapcap=document.getElementById('mapcap'),
      pin=document.getElementById('pin');
let P=0, PLAY=null, PHASE='word';   // word → prompt → typing → peel → final
function progress(){ const r=stage.getBoundingClientRect(); return clamp(-r.top/Math.max(1,r.height-innerHeight),0,1); }

// ---------------- the flip --------------------------------------------------------------------
let lit=false;
function drive(pv){
  P=(pv!=null)?pv:progress();
  const fl=ez(smooth(P,.12,.44));
  tg.style.transform='perspective(650px) rotateX('+(fl*180)+'deg) scaleY('+(1+0.10*Math.sin(fl*Math.PI))+')';
  const on=fl>=.999;
  if(on!==lit){
    lit=on;
    sfs.style.color=on?BLUE:''; tf.style.color=on?BLUE:''; tg.style.color=on?BLUE:'';
    sfLocked=on;
    if(on)BATCHES.forEach((_,i)=>setBatch(i,0));   // EVERY letter joins the sf's material
    if(on&&PHASE==='word')enterPrompt();
  }
  tl1.style.opacity=1-smooth(P,.5,.62);
  hint.style.opacity=1-smooth(P,0,.06);
}

// ---------------- phase: prompt — sf flashes, the rest recedes --------------------------------
function enterPrompt(){
  PHASE='prompt';
  faderEls.forEach(el=>el.classList.add('dim'));      // lighter shade — they step back
  sfs.classList.add('pulse'); tf.classList.add('pulse');
  sfs.style.cursor='pointer'; tf.style.cursor='pointer';
  hint.textContent='click sf'; hint.style.opacity=.7;
}

// ---------------- phase: typing — left-aligned, directly under the s --------------------------
const VH_LINES=[
  'version histories of the city,',
  'parcel by parcel'
];
let vhEl=null;
function startTyping(){
  PHASE='typing';
  sfs.classList.remove('pulse'); tf.classList.remove('pulse');
  hint.style.opacity=0;
  const sR=sfs.getBoundingClientRect(), wR=word.getBoundingClientRect();
  vhEl=document.createElement('div');
  vhEl.id='vh';
  vhEl.style.left=sR.left+'px';
  vhEl.style.top=(wR.bottom+22)+'px';
  const txt=document.createElement('div'); txt.id='vhtext'; vhEl.appendChild(txt);
  pin.appendChild(vhEl);
  let li=0, ci=0;
  const tick=setInterval(()=>{
    if(li>=VH_LINES.length){ clearInterval(tick); showPeel(); return; }
    ci++;
    if(ci>=VH_LINES[li].length){ ci=0; li++; }
    txt.textContent=VH_LINES.slice(0,li).join('\n')+(li<VH_LINES.length?'\n'+VH_LINES[li].slice(0,ci):'');
  },30);
}
function showPeel(){
  PHASE='peel';
  const ex=document.createElement('div');
  ex.id='explore';
  ex.textContent='peel to explore';
  vhEl.appendChild(ex);
  // the invitation is not an arrow — it is an uneven hole already torn in the paper,
  // RIGHT UNDER the words, the basemap showing through it. The first mouse movement
  // takes it from there.
  requestAnimationFrame(()=>holeUnder(ex));
  setTimeout(()=>{ if(!holeDone)holeUnder(ex); },400);   // rAF may be suppressed — belt and braces
}
let holeDone=false;
function holeUnder(ex){
  const r=ex.getBoundingClientRect();
  if(r.width<2)return;
  holeAt(r.left+85, r.bottom+95);
}
function holeAt(cx,cy){
  if(holeDone||!maskX)return;
  holeDone=true;
  stampAt(cx*DPR,cy*DPR,1.15);
  stampAt((cx+26)*DPR,(cy+14)*DPR,.8);           // two overlapped tears — an uneven circle
}

// ---------------- phase: final — the tear takes over; the city stands underneath --------------
function tearStart(){
  PHASE='final';
  startCity();                                   // parcels bloom as the paper comes away
  const center=document.getElementById('center');
  center.style.transition='opacity .8s';
  center.style.opacity=0;
  const axes=document.getElementById('axes'); if(axes)axes.style.display='none';
  // the blue lines and their peel invitation stay readable while the first tears land,
  // then take their time leaving
  if(vhEl){ const v=vhEl; setTimeout(()=>{ v.style.transition='opacity 1.8s'; v.style.opacity=0; },2600); }
  setTimeout(()=>{ center.style.display='none'; },900);
  setTimeout(()=>{ if(vhEl){vhEl.remove();vhEl=null;} },4600);
  if(mapcap)mapcap.style.opacity=.8;             // the sources line, under the map
  document.querySelectorAll('.mvpui').forEach(el=>el.classList.add('on'));
}

// ---------------- the parcels (canvas) — real DataSF footprints, blklot-keyed ----------------
// mvp-parcels.js: blklot -> polygon ring (lng,lat). mvp-index.js: blklot -> [[year,recid,caption]].
// landmarks-data.js: full landmark records. A parcel renders ONLY inside the torn areas
// (destination-in the tear mask): scrape the paper away and the lots remain, printed on the
// imagery — wordmark blue when they hold photographs, light pastel blue when the lot is a
// designated landmark. The year sliders condition visibility: a parcel stays lit only while
// it holds a photograph dated inside the range (undated photographs keep it lit at any range).
const cv=document.getElementById('city'), ctx=cv.getContext('2d');
let PARCS=null, mapBox={x:0,y:0,w:1,h:1}, cityT0=null, DPR=1, YLO=1848, YHI=2026;
const LM_FILL='#b7d0f2', LOT_FILL='#2456d6';
function buildParcelData(){
  const lmBy={};
  (window.LANDMARKS||[]).forEach(l=>{ if(l.blklot&&!lmBy[l.blklot])lmBy[l.blklot]=l; });
  const P=window.MVP_PARCELS||{}, IX=window.MVP_INDEX||{};
  PARCS=[];
  for(const b in P){
    const rec=P[b], newFmt=Array.isArray(rec[0][0]);
    const ring=newFmt?rec[0]:rec, street=newFmt?(rec[1]||''):'', hood=newFmt?(rec[2]||''):'';
    const lm=lmBy[b]||null, ph=IX[b]||[];
    const p={b,ring,street,hood,lm,ph,r:Math.random()};
    p.entries=photoEntries(p);
    if(p.entries.length)PARCS.push(p);
  }
  verifyPlanningPhotos();
}
function projectParcels(){
  if(!PARCS)buildParcelData();
  PARCS.forEach(p=>{
    if(p.un)return;                               // unit coords over the city box — computed once
    let u0=1e9,v0=1e9,u1=-1e9,v1=-1e9;
    p.un=p.ring.map(c=>{
      const u=(c[0]-W_)/(E_-W_), v=(N_-c[1])/(N_-S_);
      if(u<u0)u0=u; if(v<v0)v0=v; if(u>u1)u1=u; if(v>v1)v1=v; return [u,v];
    });
    p.ucx=(u0+u1)/2; p.ucy=(v0+v1)/2; p.uw=u1-u0; p.uh=v1-v0;
  });
}
// Drawing, hit testing and the stack all consult the same available photographs.
const inRange=p=>p.entries.some(photoInRange);

// ---------------- the view: esri-style pan/zoom inside the map's bounding box -----------------
// wheel zooms about the cursor, drag pans, +/− step, ⌂ resets. Parcels and basemap ride the
// SAME transform, so what you zoom is always the synced pair. Higher-z tiles stream in for
// the zoomed sub-box (refineNow) so the imagery sharpens instead of just blowing up.
let VIEW={k:1,tx:0,ty:0};
const sxOf=u=>mapBox.x+(u*VIEW.k+VIEW.tx)*mapBox.w;
const syOf=v=>mapBox.y+(v*VIEW.k+VIEW.ty)*mapBox.h;
const inMap=(x,y)=>x>=mapBox.x&&x<=mapBox.x+mapBox.w&&y>=mapBox.y&&y<=mapBox.y+mapBox.h;
function clampView(){
  VIEW.k=clamp(VIEW.k,1,24);
  VIEW.tx=clamp(VIEW.tx,1-VIEW.k,0);
  VIEW.ty=clamp(VIEW.ty,1-VIEW.k,0);
}
function resetView(){ VIEW={k:1,tx:0,ty:0}; REF=null; refineSoon(); }
function zoomAt(mx,my,f){
  const cu=((mx-mapBox.x)/mapBox.w-VIEW.tx)/VIEW.k;
  const cw=((my-mapBox.y)/mapBox.h-VIEW.ty)/VIEW.k;
  VIEW.k=clamp(VIEW.k*f,1,24);
  VIEW.tx=(mx-mapBox.x)/mapBox.w-cu*VIEW.k;
  VIEW.ty=(my-mapBox.y)/mapBox.h-cw*VIEW.k;
  clampView(); refineSoon();
}
addEventListener('wheel',e=>{
  if(PHASE!=='final')return;
  if(panel.classList.contains('open')&&PST&&e.target.closest('#pnlstage')){
    e.preventDefault();
    pnlring.__acc=(pnlring.__acc||0)+e.deltaY;
    if(pnlring.__acc>60){ pnlring.__acc=0; rotateRing(PST.focus-1); }        // down → older
    else if(pnlring.__acc<-60){ pnlring.__acc=0; rotateRing(PST.focus+1); }  // up → newer
    return;
  }
  if(!inMap(e.clientX,e.clientY))return;
  e.preventDefault();
  zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0016));
},{passive:false});
let galleryBox={x:0,y:0,w:360,h:700};
let dragV=null, dragEnded=0;
addEventListener('pointerdown',e=>{
  if(PHASE!=='final'||!inMap(e.clientX,e.clientY))return;
  if(e.target.closest&&e.target.closest('#panel,#yearbar,#zoomctl,#legend'))return;
  dragV={x:e.clientX,y:e.clientY,tx:VIEW.tx,ty:VIEW.ty,moved:false};
});
addEventListener('pointermove',e=>{
  if(!dragV)return;
  const dx=e.clientX-dragV.x, dy=e.clientY-dragV.y;
  if(Math.abs(dx)+Math.abs(dy)>9)dragV.moved=true;   // real pans only — click jitter stays a click
  if(dragV.moved){ VIEW.tx=dragV.tx+dx/mapBox.w; VIEW.ty=dragV.ty+dy/mapBox.h; clampView(); }
},{passive:true});
addEventListener('pointerup',()=>{
  if(dragV&&dragV.moved){ dragEnded=performance.now(); refineSoon(); }
  dragV=null;
});
// the refinement layer: tiles at z14+log2(k), cropped to the visible sub-box, gray-lifted
let REF=null, refT=null;
function refineSoon(){ clearTimeout(refT); refT=setTimeout(refineNow,420); }
function refineNow(){
  if(VIEW.k<1.5){ REF=null; return; }
  const z=clamp(14+Math.round(Math.log2(VIEW.k)),15,18), T=256, N2=Math.pow(2,z);
  const u0=clamp(-VIEW.tx/VIEW.k,0,1), u1=clamp((1-VIEW.tx)/VIEW.k,0,1);
  const v0=clamp(-VIEW.ty/VIEW.k,0,1), v1=clamp((1-VIEW.ty)/VIEW.k,0,1);
  const lo=W_+u0*(E_-W_), hi=W_+u1*(E_-W_);
  const laN=N_-v0*(N_-S_), laS=N_-v1*(N_-S_);
  const lon2x=l=>(l+180)/360*N2;
  const lat2y=l=>{const q=Math.sin(l*Math.PI/180);return (0.5-Math.log((1+q)/(1-q))/(4*Math.PI))*N2;};
  const tx0=Math.floor(lon2x(lo)), tx1=Math.floor(lon2x(hi));
  const ty0=Math.floor(lat2y(laN)), ty1=Math.floor(lat2y(laS));
  if((tx1-tx0+1)*(ty1-ty0+1)>36)return;               // stay light on the tile CDN
  const key=z+':'+tx0+':'+ty0+':'+tx1+':'+ty1;
  if(REF&&REF.key===key)return;
  const mos=document.createElement('canvas');
  mos.width=(tx1-tx0+1)*T; mos.height=(ty1-ty0+1)*T;
  const mxx=mos.getContext('2d');
  let done=0,got=0; const total=(tx1-tx0+1)*(ty1-ty0+1);
  const fin=()=>{
    if(++done<total||!got)return;
    const sx=(lon2x(lo)-tx0)*T, sw=(lon2x(hi)-lon2x(lo))*T;
    const sy=(lat2y(laN)-ty0)*T, sh=(lat2y(laS)-lat2y(laN))*T;
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(sw)); c.height=Math.max(1,Math.round(sh));
    const x2=c.getContext('2d'); x2.filter=GRAYLIFT;
    x2.drawImage(mos,sx,sy,sw,sh,0,0,c.width,c.height);
    REF={key,u0,v0,u1,v1,c};
  };
  for(let a=tx0;a<=tx1;a++)for(let b=ty0;b<=ty1;b++){
    const im=new Image(); im.crossOrigin='anonymous';
    im.onload=()=>{ try{ mxx.drawImage(im,(a-tx0)*T,(b-ty0)*T); got++; }catch(e){} fin(); };
    im.onerror=()=>fin();
    im.src='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+b+'/'+a;
  }
}
function buildScene(){
  DPR=Math.min(devicePixelRatio||1,2);
  cv.width=innerWidth*DPR; cv.height=innerHeight*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  // Independent description, map and photograph regions. Reserve the gallery even
  // before a parcel is selected, so opening a wheel never covers or shrinks the map.
  const narrow=innerWidth<720, tablet=innerWidth<1100;
  const mx=narrow?16:clamp(innerWidth*.025,22,48), gap=narrow?16:24;
  const colW=clamp(innerWidth*.17,180,270);
  let area, why;
  if(narrow){
    why={x:mx,y:62,w:innerWidth-2*mx,h:84};
    const mh=Math.min((innerWidth-2*mx)/1.083,innerHeight*.24);
    area={x:mx,y:210,w:innerWidth-2*mx,h:mh};
    galleryBox={x:mx,y:210+mh+68,w:innerWidth-2*mx,h:Math.max(180,innerHeight-(210+mh+68)-12)};
  }else if(tablet){
    why={x:mx,y:64,w:innerWidth-2*mx,h:100};
    const gw=clamp(innerWidth*.43,300,430);
    galleryBox={x:innerWidth-mx-gw,y:190,w:gw,h:innerHeight-206};
    area={x:mx,y:234,w:innerWidth-2*mx-gw-gap,h:Math.max(160,innerHeight-316)};
  }else{
    why={x:mx,y:76,w:colW,h:innerHeight-108};
    const gw=clamp(innerWidth*.29,340,480);
    galleryBox={x:innerWidth-mx-gw,y:16,w:gw,h:innerHeight-32};
    area={x:mx+colW+gap,y:110,w:galleryBox.x-gap-(mx+colW+gap),h:innerHeight-208};
  }
  const mw=Math.min(area.w,area.h*1.083), mh=mw/1.083;
  mapBox={x:area.x+(area.w-mw)/2,y:area.y+(area.h-mh)/2,w:mw,h:mh,why};
  pin.classList.toggle('compact',narrow);

  projectParcels();
  layoutUI();
  sizeReveal();
  if(PST)layoutRing();
}
// ---------------- the MVP chrome: positioned off the map box ----------------------------------
const whymod=document.getElementById('whymod'), yearbar=document.getElementById('yearbar'),
      legend=document.getElementById('legend'),
      logoEl=document.getElementById('logo'), zoomctl=document.getElementById('zoomctl');
function layoutUI(){
  if(!whymod)return;
  const why=mapBox.why;
  logoEl.style.left=why.x+'px'; logoEl.style.top='20px'; logoEl.style.transform='none';
  whymod.style.left=why.x+'px'; whymod.style.width=why.w+'px'; whymod.style.top=why.y+'px';
  whymod.style.maxHeight=why.h+'px'; whymod.style.overflowY='auto';
  Object.assign(panel.style,{left:galleryBox.x+'px',top:galleryBox.y+'px',width:galleryBox.w+'px',height:galleryBox.h+'px'});
  const hint=document.getElementById('galleryhint');
  Object.assign(hint.style,{left:galleryBox.x+'px',top:(galleryBox.y+galleryBox.h/2)+'px',width:galleryBox.w+'px'});

  yearbar.style.left=mapBox.x+'px'; yearbar.style.width=mapBox.w+'px';
  yearbar.style.top=(mapBox.y-52)+'px';
  if(innerWidth<720){yearbar.style.left=why.x+'px';yearbar.style.width=why.w+'px';yearbar.style.top=(mapBox.y-56)+'px';}
  zoomctl.style.left=(mapBox.x+mapBox.w-34)+'px'; zoomctl.style.top=(mapBox.y+10)+'px';
  legend.style.left=mapBox.x+'px'; legend.style.width=mapBox.w+'px'; legend.style.top=(mapBox.y+mapBox.h+9)+'px';
  if(mapcap){ mapcap.style.left=mapBox.x+'px'; mapcap.style.top=(mapBox.y+mapBox.h+(mapBox.w<400?43:27))+'px';
    mapcap.style.width=mapBox.w+'px'; mapcap.style.textAlign='left'; }   // sources under the legend
}
document.getElementById('zin').addEventListener('click',()=>zoomAt(mapBox.x+mapBox.w/2,mapBox.y+mapBox.h/2,1.6));
document.getElementById('zout').addEventListener('click',()=>zoomAt(mapBox.x+mapBox.w/2,mapBox.y+mapBox.h/2,1/1.6));
document.getElementById('zrst').addEventListener('click',resetView);
function zoomTo(lat,lng,k){
  const u=(lng-W_)/(E_-W_), v=(N_-lat)/(N_-S_);
  VIEW.k=clamp(k,1,24);
  VIEW.tx=.5-u*VIEW.k; VIEW.ty=.5-v*VIEW.k;
  clampView(); refineSoon();
}
document.getElementById('zloc').addEventListener('click',()=>{
  if(!navigator.geolocation)return;
  const btn=document.getElementById('zloc');
  btn.textContent='…';
  navigator.geolocation.getCurrentPosition(pos=>{
    btn.textContent='◎';
    zoomTo(pos.coords.latitude,pos.coords.longitude,20);   // ~600m across — the surrounding parcels
  },()=>{ btn.textContent='◎'; },{enableHighAccuracy:true,timeout:12000});
});
// the passage is itself a palimpsest: hovering a word scrapes the Whois surface off —
// the 0xA000-Dots underlayer shows through in blue, and stays revealed
(function(){
  const why=whymod&&whymod.querySelector('.why');
  if(!why)return;
  const words=why.textContent.replace(/\s+/g,' ').trim().split(' ');
  why.textContent='';
  words.forEach((w,i)=>{
    const sp=document.createElement('span'); sp.className='wv'; sp.textContent=w;
    why.appendChild(sp);
    if(i<words.length-1)why.appendChild(document.createTextNode(' '));
  });
  why.addEventListener('pointerover',e=>{
    const sp=e.target.closest('.wv'); if(sp)sp.classList.add('rv');
  });
})();
// the year range: two thumbs on one track, low may never cross high
const rlo=document.getElementById('rlo'), rhi=document.getElementById('rhi'),
      yloEl=document.getElementById('ylo'), yhiEl=document.getElementById('yhi'),
      drfill=document.getElementById('drfill');
function syncYears(ev){
  let a=+rlo.value, b=+rhi.value;
  if(a>b){ if(ev&&ev.target===rlo)b=a; else a=b; rlo.value=a; rhi.value=b; }
  YLO=a; YHI=b; yloEl.textContent=a; yhiEl.textContent=b;
  if(window.__stackRefilter)window.__stackRefilter();   // late-bound: syncYears runs at boot, the stack exists later
  const f=v=>(v-1848)/(2026-1848)*100;
  drfill.style.left=f(a)+'%'; drfill.style.width=Math.max(0,f(b)-f(a))+'%';
}
if(rlo){ rlo.addEventListener('input',syncYears); rhi.addEventListener('input',syncYears); syncYears(); }
function startCity(){ if(cityT0==null)cityT0=performance.now(); }
function drawCity(ts){
  if(PHASE!=='peel'&&PHASE!=='final'){ ctx.clearRect(0,0,innerWidth,innerHeight); return; }
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawReveal();                                  // peel: just the invitation hole; final: the tear
  if(PHASE!=='final'||!PARCS)return;
  const bloom=cityT0==null?0:clamp((performance.now()-cityT0)/1600,0,1);
  const pad=20;
  const onScreen=(x,y)=>x>=mapBox.x-pad&&x<=mapBox.x+mapBox.w+pad&&y>=mapBox.y-pad&&y<=mapBox.y+mapBox.h+pad;
  // layer 1 — the parcels live UNDER the paper (destination-in the tear mask): scrape and
  // they remain, colored, on the imagery. Both layers ride the VIEW transform with the map.
  parcelX.setTransform(1,0,0,1,0,0);
  parcelX.globalCompositeOperation='source-over';
  parcelX.clearRect(0,0,parcelCv.width,parcelCv.height);
  parcelX.setTransform(DPR,0,0,DPR,0,0);
  // layer 2 — the black lot lines are printed ON the paper (destination-out the mask):
  // the overlay you tear through to reach the color underneath
  inkX.setTransform(1,0,0,1,0,0);
  inkX.globalCompositeOperation='source-over';
  inkX.clearRect(0,0,inkCv.width,inkCv.height);
  inkX.setTransform(DPR,0,0,DPR,0,0);
  parcelX.save(); parcelX.beginPath(); parcelX.rect(mapBox.x,mapBox.y,mapBox.w,mapBox.h); parcelX.clip();
  inkX.save(); inkX.beginPath(); inkX.rect(mapBox.x,mapBox.y,mapBox.w,mapBox.h); inkX.clip();
  inkX.strokeStyle='#0e0e10'; inkX.lineWidth=.85; inkX.globalAlpha=.78;
  PARCS.forEach(p=>{
    if(p.r>bloom||!inRange(p))return;
    const cx=sxOf(p.ucx), cy=syOf(p.ucy);
    if(!onScreen(cx,cy))return;
    const pw=p.uw*VIEW.k*mapBox.w, ph=p.uh*VIEW.k*mapBox.h;
    const big=(pw>3||ph>3);
    if(p.lm){ parcelX.fillStyle=LM_FILL; parcelX.globalAlpha=.92; }
    else{ parcelX.fillStyle=LOT_FILL; parcelX.globalAlpha=.8; }
    if(!big){
      parcelX.fillRect(cx-1.8,cy-1.8,3.6,3.6);
      if(pw>1.6)inkX.strokeRect(cx-pw/2,cy-ph/2,pw,ph);
    }else{
      parcelX.beginPath();
      p.un.forEach((q,i)=>{ const X=sxOf(q[0]),Y=syOf(q[1]); i?parcelX.lineTo(X,Y):parcelX.moveTo(X,Y); });
      parcelX.closePath(); parcelX.fill();
      if(p.lm){ parcelX.strokeStyle=LOT_FILL; parcelX.lineWidth=.9; parcelX.stroke(); }
      inkX.beginPath();
      p.un.forEach((q,i)=>{ const X=sxOf(q[0]),Y=syOf(q[1]); i?inkX.lineTo(X,Y):inkX.moveTo(X,Y); });
      inkX.closePath(); inkX.stroke();
    }
  });
  if(SEL&&inRange(SEL)){                          // the open parcel wears an ink ring
    const cx=sxOf(SEL.ucx), cy=syOf(SEL.ucy);
    const rr=Math.max(SEL.uw*VIEW.k*mapBox.w,SEL.uh*VIEW.k*mapBox.h)/2+5;
    parcelX.globalAlpha=1; parcelX.strokeStyle='#0e0e10'; parcelX.lineWidth=1.6;
    parcelX.beginPath(); parcelX.arc(cx,cy,Math.max(rr,8),0,6.284); parcelX.stroke();
  }
  inkX.restore(); parcelX.restore();
  parcelX.globalAlpha=1;
  parcelX.setTransform(1,0,0,1,0,0);
  parcelX.globalCompositeOperation='destination-in';
  parcelX.drawImage(maskCv,0,0);
  parcelX.globalCompositeOperation='source-over';
  inkX.globalAlpha=1;
  inkX.setTransform(1,0,0,1,0,0);
  inkX.globalCompositeOperation='destination-out';
  inkX.drawImage(maskCv,0,0);
  inkX.globalCompositeOperation='source-over';
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(parcelCv,0,0);
  ctx.drawImage(inkCv,0,0);
  ctx.restore();
  if(panel.classList.contains('open')&&SEL&&PST)drawThreads();
}
// the stitching: blue threads from the parcel's needle-hole to the floating photographs —
// drawn with a slight sag so they read as thread, not leader lines. One bright thread to
// the card facing you; faint ones gather to the neighbors, capped at 20 threads total.
function drawThreads(){
  if(galleryBox.y>mapBox.y+mapBox.h)return;
  const stage=document.getElementById('pnlstage').getBoundingClientRect();
  const cy=stage.top+stage.height/2, ex=stage.left+stage.width/2-PST.cardW/2;
  const ax=sxOf(SEL.ucx), ay=syOf(SEL.ucy);
  if(!inMap(ax,ay))return;
  ctx.save(); ctx.strokeStyle=BLUE; ctx.fillStyle=BLUE;
  ctx.beginPath(); ctx.arc(ax,ay,2.6,0,6.284); ctx.fill();
  for(let d=-1;d<=1;d++){
    if(PST.focus+d<0||PST.focus+d>=PST.es.length)continue;
    const rad=d*PST.step*Math.PI/180;
    const pf=1200/(1200+PST.R*(1-Math.cos(rad)));
    const ey=cy-Math.sin(rad)*PST.R*pf;
    if(ey<stage.top||ey>stage.bottom)continue;
    ctx.globalAlpha=d===0?.7:.13;ctx.lineWidth=d===0?1.2:.7;
    ctx.beginPath();ctx.moveTo(ax,ay);
    ctx.bezierCurveTo(mapBox.x+mapBox.w,ay,ex-24,ey,ex,ey);ctx.stroke();
  }
  ctx.restore();
}

// ---------------- the atlas: the gray city basemap under the paper ----------------------------
// TILE MOSAIC, not the /export endpoint: the export API stalled 8–10s and dropped requests
// all day (the tear showed only the flat placeholder — "a blue screen"). The XYZ tile CDN
// the map page uses answers in tens of ms and caches. ~50 z14 tiles composite into one
// atlas, cropped to the same lon/lat box every consumer assumes (mercator error across
// 0.1° of latitude ≈ subpixel), then the gray-lift is applied ONCE into atlasG.
// The fetch starts AFTER window load — it never blocks or delays the page.
const W_=-122.509,E_=-122.375,S_=37.709,N_=37.807;   // the city box (hover layer uses it too)
const GRAYLIFT='grayscale(1) brightness(1.28) contrast(.88)';
let atlasOK=false, atlasG=null, atlasFade=0;
(function(){
  const Z=14,T=256,N2=Math.pow(2,Z);
  const lon2x=l=>(l+180)/360*N2;
  const lat2y=l=>{const s=Math.sin(l*Math.PI/180);return (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*N2;};
  function build(){
    const tx0=Math.floor(lon2x(W_)), tx1=Math.floor(lon2x(E_));
    const ty0=Math.floor(lat2y(N_)), ty1=Math.floor(lat2y(S_));
    const mos=document.createElement('canvas');
    mos.width=(tx1-tx0+1)*T; mos.height=(ty1-ty0+1)*T;
    const mx=mos.getContext('2d');
    let done=0, got=0; const total=(tx1-tx0+1)*(ty1-ty0+1);
    const finish=()=>{
      if(++done<total)return;
      if(!got){ setTimeout(build,4000); return; }  // CDN unreachable — try again in a while
      const sx=(lon2x(W_)-tx0)*T, sw=(lon2x(E_)-lon2x(W_))*T;
      const sy=(lat2y(N_)-ty0)*T, sh=(lat2y(S_)-lat2y(N_))*T;
      const c=document.createElement('canvas'); c.width=Math.round(sw); c.height=Math.round(sh);
      const x=c.getContext('2d');
      x.filter=GRAYLIFT;
      x.drawImage(mos,sx,sy,sw,sh,0,0,c.width,c.height);
      atlasG=c; atlasOK=true;
    };
    for(let tx=tx0;tx<=tx1;tx++)for(let ty=ty0;ty<=ty1;ty++){
      const im=new Image(); im.crossOrigin='anonymous';
      im.onload=()=>{ try{ mx.drawImage(im,(tx-tx0)*T,(ty-ty0)*T); got++; }catch(e){} finish(); };
      im.onerror=()=>finish();
      im.src='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+Z+'/'+ty+'/'+tx;
    }
  }
  if(document.readyState==='complete') build();
  else addEventListener('load',()=>build(),{once:true});
})();

// ---------------- the ripped paper: brush it away, the basemap is underneath ------------------
// a persistent mask canvas accumulates ragged white stamps wherever the cursor brushes in the
// final phase; each frame the gray basemap is composited through that mask (source-in), with
// the mask silhouette drawn offset in raw paper-white first — the torn fringe of the page.
let maskCv=null,maskX=null,revealCv=null,revX=null,parcelCv=null,parcelX=null,inkCv=null,inkX=null,lastStamp=null,stamps=0;
const STAMPS=[];
(function makeStamps(){
  // the stamp edges run through the SAME #tornpaper displacement filter the old top-left
  // sticker wore — the tear keeps that banner's edge design. (Browsers without canvas
  // filter url() references just get a clean ellipse — an acceptable fallback.)
  for(let i=0;i<4;i++){
    const R=70,PAD=24,c=document.createElement('canvas'); c.width=c.height=(R+PAD)*2;
    const x=c.getContext('2d');
    try{ x.filter='url(#tornpaper)'; }catch(e){}
    x.fillStyle='#fff'; x.beginPath();
    x.ellipse(R+PAD,R+PAD,R*(.78+Math.random()*.3),R*(.62+Math.random()*.34),Math.random()*3.14,0,6.284);
    x.fill(); STAMPS.push(c);
  }
})();
function stampAt(x,y,scale){
  if(!maskX)return;
  const st=STAMPS[(Math.random()*STAMPS.length)|0];
  const s=(110+Math.random()*60)*DPR*(scale||1);
  maskX.save(); maskX.translate(x,y); maskX.rotate(Math.random()*6.283);
  maskX.drawImage(st,-s/2,-s/2,s,s); maskX.restore();
  stamps++; window.__stamps=stamps;   // read by the capture harness's probe
}
function sizeReveal(){
  const old=(maskCv&&maskCv.width>1)?maskCv:null;
  maskCv=document.createElement('canvas'); maskCv.width=cv.width; maskCv.height=cv.height;
  maskX=maskCv.getContext('2d');
  // a resize must NOT cost the reader their tearing — carry the old mask over, scaled
  if(old)maskX.drawImage(old,0,0,old.width,old.height,0,0,maskCv.width,maskCv.height);
  revealCv=document.createElement('canvas'); revealCv.width=cv.width; revealCv.height=cv.height;
  revX=revealCv.getContext('2d');
  parcelCv=document.createElement('canvas'); parcelCv.width=cv.width; parcelCv.height=cv.height;
  parcelX=parcelCv.getContext('2d');
  inkCv=document.createElement('canvas'); inkCv.width=cv.width; inkCv.height=cv.height;
  inkX=inkCv.getContext('2d');
  lastStamp=null;
  if(!old){ holeDone=false;
    if(PHASE==='peel'){ const ex=document.getElementById('explore'); if(ex)holeUnder(ex); } }
}
addEventListener('pointermove',e=>{
  if((PHASE!=='peel'&&PHASE!=='final')||!maskX)return;
  if(dragV&&dragV.moved)return;                  // panning the view is not tearing the paper
  if(PHASE==='peel')tearStart();                 // the first movement begins the peel
  const x=e.clientX*DPR, y=e.clientY*DPR;
  if(lastStamp&&Math.hypot(x-lastStamp[0],y-lastStamp[1])<16*DPR)return;
  lastStamp=[x,y];
  stampAt(x,y);
},{passive:true});
function drawReveal(){
  if(!maskCv)return;
  if(atlasOK&&atlasFade<1)atlasFade=Math.min(1,atlasFade+.045);
  revX.setTransform(1,0,0,1,0,0);
  revX.globalCompositeOperation='source-over';
  revX.clearRect(0,0,revealCv.width,revealCv.height);
  revX.drawImage(maskCv,0,0);
  revX.globalCompositeOperation='source-in';
  revX.setTransform(DPR,0,0,DPR,0,0);
  revX.save(); revX.beginPath(); revX.rect(mapBox.x,mapBox.y,mapBox.w,mapBox.h); revX.clip();
  if(atlasOK){
    try{ revX.drawImage(atlasG, mapBox.x+VIEW.tx*mapBox.w, mapBox.y+VIEW.ty*mapBox.h,
      mapBox.w*VIEW.k, mapBox.h*VIEW.k); }catch(e){}
    if(REF)try{ revX.drawImage(REF.c, sxOf(REF.u0), syOf(REF.v0),
      (REF.u1-REF.u0)*VIEW.k*mapBox.w, (REF.v1-REF.v0)*VIEW.k*mapBox.h); }catch(e){}
  }
  else{ revX.fillStyle='#d8d4c8'; revX.fillRect(mapBox.x,mapBox.y,mapBox.w,mapBox.h); }  // warm under-paper gray, never a blue screen
  revX.restore();
  revX.setTransform(1,0,0,1,0,0); revX.globalCompositeOperation='source-over';
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=.9;                            // the torn fringe: raw paper-white past the tear
  for(const o of [[-4,0],[4,0],[0,-4],[0,4],[-3,-3],[3,3],[-3,3],[3,-3]]) ctx.drawImage(maskCv,o[0],o[1]);
  ctx.globalAlpha=atlasOK?Math.max(atlasFade,.25):1;
  ctx.drawImage(revealCv,0,0);
  ctx.restore(); ctx.globalAlpha=1;
}

// ---------------- click a parcel: its photographs ride the right-panel ring -------------------
// (the hover photo-cards are retired — see DECISIONS.md 2026-07-25)
const panel=document.getElementById('panel'), pnlring=document.getElementById('pnlring'),
      pnlkind=document.getElementById('pnlkind'), pnlname=document.getElementById('pnlname'),
      pnldetail=document.getElementById('pnldetail'),
      pnlfacts=document.getElementById('pnlfacts');
const escH=x=>String(x||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let SEL=null, PST=null;
const PBAD=new Set();
const PGOOD=new Set(window.PHOTO_ASSETS||[]);
function photoEntries(p){
  const byURL=new Map();
  const add=(recid,y,cap)=>{
    const u='geotag/thumbs/'+recid+'.jpg';
    if(PGOOD.has(u)&&!byURL.has(u))byURL.set(u,{y:y||0,cap:cap||'',src:'sfpl digitalsf',u});
  };
  // Landmark metadata enriches a parcel; it must never replace its archive index.
  p.ph.forEach(e=>add(e[1],e[0],e[2]));
  if(p.lm)(p.lm.timeline||[]).filter(e=>e.t==='photo').forEach(e=>add(e.recid,e.y,e.d));
  const es=[...byURL.values()];
  if(p.lm&&p.lm.photo)es.push({y:1e4,now:true,cap:p.lm.name+' — the city\u2019s current photograph',
    src:'sf planning',u:p.lm.photo.replace('/Large/','/Docs/')});
  es.sort((x,y)=>(x.y||9998)-(y.y||9998));         // chronological; undated after the dated, 'now' last
  return es;
}
function photoInRange(e){
  return PGOOD.has(e.u)&&!PBAD.has(e.u)
    &&(e.now?YHI>=2026:(!e.y||(e.y>=YLO&&e.y<=YHI)));
}
function pnlEntries(p){ return p.entries.filter(photoInRange); }
function verifyPlanningPhotos(){
  // Remote metadata is not proof that an image exists. Only light those lots after
  // an actual image load; use a small queue so archive thumbnails keep priority.
  const queue=[...new Set(PARCS.flatMap(p=>p.entries.filter(e=>e.now).map(e=>e.u)))];
  const next=()=>{
    const u=queue.shift(); if(!u)return;
    const im=new Image(); let timer;
    const finish=ok=>{
      clearTimeout(timer); im.onload=im.onerror=null;
      if(ok){PGOOD.add(u); if(SEL&&SEL.entries.some(e=>e.u===u))window.__stackRefilter();}
      else PBAD.add(u);
      next();
    };
    im.onload=()=>finish(im.naturalWidth>0); im.onerror=()=>finish(false);
    timer=setTimeout(()=>finish(false),10000);
    im.fetchPriority='low'; im.src=u;
  };
  for(let i=0;i<4;i++)next();
}
function openPanel(p){
  if(!inRange(p))return;
  SEL=p;
  pnlkind.textContent=p.lm
    ? (p.lm.landmarkno==='curated'?'curated place':'sf landmark #'+p.lm.landmarkno)+' · parcel '+p.b
    : 'parcel '+p.b;
  pnlname.textContent=p.lm?p.lm.name:'';
  document.getElementById('pnllocation').textContent=[p.hood,p.street||(p.lm&&p.lm.address)].filter(Boolean).join(' · ');
  if(p.lm){                                        // landmarks: full detail, collapsible
    pnldetail.style.display='block';
    const l=p.lm;
    pnlfacts.innerHTML=[
      l.address&&escH(l.address),
      l.yearbuilt&&('<b>built '+escH(l.yearbuilt)+'</b>'),
      l.archbuild&&escH(l.archbuild),
      l.style&&escH(l.style)
    ].filter(Boolean).join(' · ')
    +(l.yeardes?'<br>designated '+escH(l.yeardes):'')
    +(l.sigsum?'<br>'+escH(l.sigsum):'')
    +(l.story?'<div class="story"><b>'+escH(l.story.title)+'</b><br>'+escH(l.story.text)+'</div>':'');
  }else{
    pnldetail.style.display='none'; pnlfacts.innerHTML='';
  }
  buildRing(pnlEntries(p));
  panel.classList.add('open');
  document.getElementById('galleryhint').style.visibility='hidden';
}
function buildRing(es){
  // A new parcel (or an empty result) should not rotate through the previous wheel.
  pnlring.style.transition='none';
  if(!es.length){
    pnlring.style.transform='none';
    pnlring.innerHTML='<div class="pnlnote">no photographs available in this year range —<br>try another parcel or widen the sliders</div>';
    PST=null; document.getElementById('pnlcaption').replaceChildren(); updRingNav(); return;
  }
  const n=es.length, step=360/Math.max(n,8);
  PST={es,focus:n-1,step,R:0,cardW:0,cardH:0};   // enter at the newest — scrolling down digs older
  // cards are born WITHOUT src: only the wheel-window around the focus fetches (hydrateCards).
  // A 54-photo parcel used to fire 54 requests at once and the front card queued behind
  // 53 others it was hiding — now the visible few load first and the rest load as you turn.
  pnlring.innerHTML=es.map((e,i)=>
    '<div class="pnlcard" data-i="'+i+'">'
    +'<img decoding="async" alt="" data-src="'+escH(e.u)+'" '
    +'onload="this.classList.add(\'ld\')" onerror="window.__mvpDrop(this.dataset.src)">'
    +'</div>').join('');
  layoutRing(); updRingNav();
  void pnlring.offsetHeight;
  pnlring.style.transition='';
}
let warmT=null;
function hydrateCards(){
  if(!PST)return;
  [...pnlring.children].forEach(c=>{
    const im=c.querySelector('img'); if(!im||im.src)return;
    const d=Math.abs(+c.dataset.i-PST.focus);
    if(d<=3){ im.fetchPriority=d===0?'high':'low'; im.src=im.dataset.src; }
  });
  // after the visible few have loaded (or 1.4s, whichever first), quietly warm the rest
  clearTimeout(warmT);
  warmT=setTimeout(()=>{
    if(!PST)return;
    [...pnlring.querySelectorAll('img')].forEach(im=>{
      if(!im.src&&im.dataset.src){ im.fetchPriority='low'; im.src=im.dataset.src; }
    });
  },1400);
}
function layoutRing(){
  if(!PST)return;
  const stage=document.getElementById('pnlstage');
  const cardW=Math.min(330,galleryBox.w-24,Math.max(110,stage.clientHeight*.95));
  const cardH=cardW*2/3;
  // Apothem of the polygonal wheel: adjacent photographs meet edge to edge.
  const R=cardH/(2*Math.tan(PST.step*Math.PI/360));
  Object.assign(PST,{R,cardW,cardH});
  pnlring.style.setProperty('--card-w',cardW+'px');
  pnlring.style.setProperty('--card-h',cardH+'px');
  [...pnlring.children].forEach(c=>{
    const i=+c.dataset.i, d=i-PST.focus;
    c.style.transform='rotateX('+(i*PST.step)+'deg) translateZ('+R+'px)';
    c.classList.toggle('front',d===0);
    c.style.setProperty('--shade',Math.min(.28,Math.abs(d)*.08));
    c.style.opacity=Math.abs(d*PST.step)<100?1:0;
    c.style.pointerEvents=Math.abs(d*PST.step)<90?'auto':'none';
  });
  pnlring.style.transform='translateZ('+(-R)+'px) rotateX('+(-PST.focus*PST.step)+'deg)';
  const e=PST.es[PST.focus];
  document.getElementById('pnlcaption').innerHTML='<div class="pyr">'+(e.now?'now':(e.y||'undated'))+'</div>'
    +'<div class="pcap">'+escH(e.cap)+'</div><div class="psrc">photograph: '+escH(e.src)+'</div>';
  hydrateCards();
}

function rotateRing(to){
  if(!PST)return;
  PST.focus=clamp(to,0,PST.es.length-1);         // the ends are ends — no wrap
  layoutRing(); updRingNav();
}
// the buttons carry the year of the photograph in that direction — blank when there is none
const pnlolder=document.getElementById('pnlolder'), pnlnewer=document.getElementById('pnlnewer');
function updRingNav(){
  if(!PST){ pnlolder.textContent=''; pnlnewer.textContent='';
    pnlolder.style.visibility='hidden'; pnlnewer.style.visibility='hidden'; return; }
  const prev=PST.focus>0?PST.es[PST.focus-1]:null;
  const next=PST.focus<PST.es.length-1?PST.es[PST.focus+1]:null;
  pnlolder.style.visibility=prev?'visible':'hidden';
  pnlnewer.style.visibility=next?'visible':'hidden';
  pnlolder.textContent=prev?('▼ '+(prev.now?'now':(prev.y||'undated'))):'';
  pnlnewer.textContent=next?('▲ '+(next.now?'now':(next.y||'undated'))):'';
}
// one broken image must not thrash the whole ring: hide that card, keep everything
// else loading, and re-space the ring once, after the dust settles
let dropT=null;
window.__stackRefilter=()=>{ if(SEL&&panel.classList.contains('open'))buildRing(pnlEntries(SEL)); };
window.__mvpDrop=u=>{
  if(PBAD.has(u))return;
  PBAD.add(u);
  [...pnlring.querySelectorAll('img')].forEach(im=>{
    if(im.dataset.src===u)im.closest('.pnlcard').style.display='none';
  });
  clearTimeout(dropT);
  dropT=setTimeout(()=>{
    if(!SEL||!PST)return;
    const keepY=PST.es[PST.focus]&&PST.es[PST.focus].y;
    buildRing(pnlEntries(SEL));
    if(PST&&keepY!=null){
      const i=PST.es.findIndex(e=>e.y===keepY);
      if(i>=0)rotateRing(i);
    }
  },600);
};
pnlolder.addEventListener('click',()=>rotateRing(PST?PST.focus-1:0));
pnlnewer.addEventListener('click',()=>rotateRing(PST?PST.focus+1:0));
document.getElementById('pnlclose').addEventListener('click',()=>{
  panel.classList.remove('open'); document.getElementById('galleryhint').style.visibility='';
});
pnlring.addEventListener('click',e=>{
  const c=e.target.closest('.pnlcard');
  if(c&&PST)rotateRing(+c.dataset.i===PST.focus?PST.focus+1:+c.dataset.i);
});
function hitParcel(mx,my){
  if(!PARCS||!inMap(mx,my))return null;
  let best=null,bd=1e9;
  PARCS.forEach(p=>{
    if(!inRange(p))return;
    const cx=sxOf(p.ucx), cy=syOf(p.ucy);
    const rad=Math.max(p.uw*mapBox.w,p.uh*mapBox.h)*VIEW.k/2;
    const d=Math.hypot(cx-mx,cy-my)-Math.min(rad,14);
    if(d<bd){bd=d;best=p;}
  });
  // zoomed in, the slop tightens — selection gets granular instead of "the general area"
  return bd<=Math.max(3.5,11/Math.sqrt(VIEW.k))?best:null;
}
pin.addEventListener('click',e=>{
  if(PHASE!=='final')return;
  if(performance.now()-dragEnded<250)return;     // that was a pan, not a pick
  if(e.target.closest('#panel,#yearbar,#logo,#word,#zoomctl,#legend'))return;
  const p=hitParcel(e.clientX,e.clientY);
  if(p)openPanel(p);
});
let lastCur=0;
addEventListener('pointermove',e=>{                       // the cursor tells you a lot is live
  if(PHASE!=='final'||performance.now()-lastCur<90)return;
  lastCur=performance.now();
  pin.style.cursor=hitParcel(e.clientX,e.clientY)?'pointer':'';
},{passive:true});

// ---------------- clicks: play the flip, or begin the sequence --------------------------------
word.addEventListener('click',e=>{
  if(PHASE==='prompt'&&(e.target===sfs||e.target===tf||e.target===tg)){ startTyping(); return; }
  if(PHASE!=='word')return;
  const sp=progress();
  PLAY={t0:performance.now(),from:(PLAY||sp>.6)?0:sp,to:.5,dur:2600};
});
word.style.pointerEvents='auto'; word.style.cursor='pointer';

// ---------------- the loop --------------------------------------------------------------------
let lastSP=0;
function frame(ts){
  try{
    fontTick(ts);
    const sp=progress();
    if(PLAY){
      if(Math.abs(sp-lastSP)>0.004) PLAY=null;
      else{ const k=(ts-PLAY.t0)/PLAY.dur;
        if(k>=1){ drive(PLAY.to); PLAY=null; }
        else drive(PLAY.from+(PLAY.to-PLAY.from)*ez(clamp(k,0,1))); }
    }
    if(!PLAY&&PHASE==='word') drive();
    lastSP=sp;
    drawCity(ts);
  }catch(e){ console.error('[hero]',e); }
  requestAnimationFrame(frame);
}
// rAF is suppressed in some embedded/hidden contexts — the font clock and the scroll-driven
// flip get their own event paths so the page never plays dead
setInterval(()=>{ try{fontTick(performance.now())}catch(e){} },250);
addEventListener('scroll',()=>{ if(!PLAY&&PHASE==='word')drive(); },{passive:true});
addEventListener('resize',()=>{ lockWidths(); buildScene(); });
addEventListener('load',()=>{ lockWidths(); buildScene(); });
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>setTimeout(lockWidths,50));
lockWidths();
buildScene();
// the wordmark stays hidden until the 0xA000 files are ACTUALLY loaded — otherwise the
// first paint shows the fallback monospace in the logo (the "unapproved font" flash).
// A 2.5s timeout means a slow font CDN can only delay the reveal, never hold it hostage.
(function(){
  let shown=false;
  const show=()=>{ if(shown)return; shown=true; lockWidths(); word.style.visibility='visible'; };
  try{
    Promise.all(FONTS.map(f=>document.fonts.load("16px '"+f+"'"))).then(show,show);
  }catch(e){ show(); }
  setTimeout(show,2500);
})();
// the intro always plays: a reload that restores deep scroll would land past the flip,
// lock the letters instantly, and the reader would never see the materials rotate
if('scrollRestoration' in history)history.scrollRestoration='manual';
scrollTo(0,0);
requestAnimationFrame(frame);
})();
