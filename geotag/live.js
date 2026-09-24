// PALIMPSESF live — the camera overlay, on site.
// The phone's camera is the ground layer (the present). GPS locates you; the compass reads
// where you point. When your heading matches the ORIGINAL BEARING of a photograph taken
// within ~140m — a camera that once pointed the same way down the same street — that photo
// surfaces in a scrollable collage of paper cards over the live feed.
// External file on purpose (see hero.js). Desktop gets a simulator: fixed standpoint
// (Portsmouth Square) + a heading slider, camera feed replaced by dark ground.
(function(){
if(window.__liveBooted)return; window.__liveBooted=true;
const $=id=>document.getElementById(id);
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const F=(window.PHOTO_GEOJSON||{features:[]}).features.filter(f=>f.properties.bearing!=null);
$('stat').textContent='◉ '+F.length+' bearing-tagged photos loaded';

const R_NEAR=140, CONE=28;
let LAT=null,LNG=null,HEAD=null,shown='';
const dist=(la1,lo1,la2,lo2)=>{const x=(lo2-lo1)*Math.cos((la1+la2)*Math.PI/360)*111320,y=(la2-la1)*110540;return Math.hypot(x,y);};
const dAng=(a,b)=>{let d=Math.abs(a-b)%360;return d>180?360-d:d;};

function thumbSrc(p){ return 'thumbs/'+p.recid+'.jpg'; }
function bigSrc(p){
  if(p.iiif)return 'https://digitalsf.org/nanna/proxy/iiif/image/'+p.iiif+'/full/%5E1600,/0/default.jpg';
  return 'thumbs/'+p.recid+'.jpg';
}
function yearOf(p){const m=/(1[89]\d\d|20\d\d)/.exec(p.date||'');return m?m[0]:'';}

function render(){
  if(LAT==null||HEAD==null)return;
  const hits=[];
  F.forEach(f=>{
    const [lng,lat]=f.geometry.coordinates;
    const d=dist(LAT,LNG,lat,lng);
    if(d>R_NEAR)return;
    const dv=dAng(HEAD,f.properties.bearing);
    if(dv<=CONE)hits.push({f,d,dv});
  });
  hits.sort((a,b)=>(a.dv+a.d*.15)-(b.dv+b.d*.15));
  const top=hits.slice(0,12);
  const key=top.map(h=>h.f.properties.recid).join(',');
  $('stat').textContent='◉ '+Math.round(HEAD)+'° · '+hits.length+' photo'+(hits.length===1?'':'s')+' pointed this way';
  $('none').style.display=top.length?'none':'block';
  if(key===shown)return;   // stack unchanged — don't rebuild mid-scroll
  shown=key;
  $('stack').innerHTML=top.map(h=>{
    const p=h.f.properties;
    return '<div class="card" data-recid="'+esc(p.recid)+'">'
      +'<img loading="lazy" src="'+esc(thumbSrc(p))+'" onload="this.classList.add(\'ld\')" onerror="this.closest(\'.card\').remove()">'
      +'<div class="cy">'+(yearOf(p)||'—')+'</div>'
      +'<div class="cc">'+esc(p.caption)+'</div>'
      +'<div class="cm">'+Math.round(h.d)+'m away · original bearing '+Math.round(p.bearing)+'° · '
      +(p.bearing_src==='caption'?'exact':'≈')+'</div></div>';
  }).join('');
  [...$('stack').children].forEach((el,i)=>{
    el.onclick=()=>{ const p=top[i].f.properties;
      $('big').querySelector('img').src=bigSrc(p);
      $('big').querySelector('.bc').textContent=(yearOf(p)?yearOf(p)+' · ':'')+p.caption;
      $('big').classList.add('on'); };
  });
}
$('big').onclick=()=>$('big').classList.remove('on');

// ---- sensors ----
function onHead(e){
  let h=null;
  if(e.webkitCompassHeading!=null)h=e.webkitCompassHeading;
  else if(e.absolute&&e.alpha!=null)h=(360-e.alpha)%360;
  if(h!=null){HEAD=h;render();}
}
function start(){
  // camera — fire and forget: a pending permission prompt must never block the
  // compass, GPS, or simulator wiring below
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})
      .then(s=>{ $('cam').srcObject=s; })
      .catch(()=>{ /* denied / absent / not https — the dark ground stays */ });
  }
  // compass (iOS needs a user-gesture permission; first tap requests it)
  if(window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){
    document.body.addEventListener('click',async()=>{
      try{ if(await DeviceOrientationEvent.requestPermission()==='granted')
        addEventListener('deviceorientation',onHead,true); }catch(e){}
    },{once:true});
    $('stat').textContent='◉ tap once to enable the compass';
  }else{
    addEventListener('deviceorientationabsolute',onHead,true);
    addEventListener('deviceorientation',onHead,true);
  }
  // position
  navigator.geolocation.watchPosition(p=>{
    LAT=p.coords.latitude; LNG=p.coords.longitude; render();
  },err=>{
    // no fix: desktop simulator — stand at Portsmouth Square, slide the heading
    LAT=37.7946; LNG=-122.4058;
    $('sim').style.display='flex';
    $('stat').textContent='◉ simulator · Portsmouth Square';
    render();
  },{enableHighAccuracy:true,maximumAge:2000,timeout:8000});
  // the simulator: touching the slider commits fully to the simulated standpoint
  // (Portsmouth Square) — desktop has no compass, and its GPS fix is wherever the
  // laptop happens to sit, which is not a walking tour.
  $('simh').addEventListener('input',()=>{
    HEAD=+$('simh').value; $('simhv').textContent=HEAD+'°';
    LAT=37.7946; LNG=-122.4058;
    render(); });
  // no compass event within 3s (desktop) → offer the simulator
  setTimeout(()=>{ if(HEAD==null){
    $('sim').style.display='flex';
    $('stat').textContent='◉ no compass — simulator armed · Portsmouth Square';
  }},3000);
}
start();
})();
