// landmark viewer — external file (see hero.js for why: inline scripts die on prose pages).
// One landmark at a time now — the endless vertical ledger is gone. Each landmark's
// photographs ride a rotating carousel, newest at the front; rotating backward walks the
// year ruler back through time in step. The description keeps only the essentials — name,
// address, built, by whom, style — plus the blurb of whichever postcard is facing you.
// No placeholders: a photograph fades in only after it has actually loaded; a card whose
// image 404s is dropped and the ring closes around the gap.
(function(){
if(window.__lmBooted)return; window.__lmBooted=true;
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const L=window.LANDMARKS||[];
const SHOW_STORIES=true;    // the written descriptions stay in the panel
const BAD=new Set();        // image urls that failed — never rebuild a card around one

document.getElementById('count').textContent=L.length+' LANDMARKS';

// photo-rich landmarks first, then the thinner records — ‹ › walks this order
const rich=[],thin=[];
L.forEach(l=>((l.timeline||[]).length>=3?rich:thin).push(l));
const ORDER=[...rich,...thin];
let cur=0, ST=null;   // ST: {entries, focus, ang, step, R} for the current carousel

function imgFor(e){
  if(e.t==='photo'){
    if(e.src==='wikimedia'&&e.img)return e.img;
    if(e.recid)return 'thumbs/'+e.recid+'.jpg';
  }
  if(e.t==='occupant'&&e.img)return e.img;
  return null;
}
function entriesFor(l){
  const es=(l.timeline||[]).map(e=>({...e,u:imgFor(e)})).filter(e=>e.u&&!BAD.has(e.u));
  es.sort((a,b)=>(a.y||0)-(b.y||0));                  // oldest first; newest faces you
  if(l.photo){const u=l.photo.replace('/Large/','/Docs/');  // Docs ~50KB; Large ~1MB stalls the queue
    if(!BAD.has(u))es.push({t:'photo',y:null,d:l.name+' — the city’s own photograph',u,official:true});}
  return es;
}
const srcName=e=>e.official?'SF Planning':(e.src==='wikimedia'?'Wikimedia Commons':'SFPL DigitalSF');
// ring radius: cards must clear each other; half-width 125 + breathing room
const radiusFor=n=>n<3?170:Math.max(170,Math.round(141/Math.tan(Math.PI/n)));

// ---------------- the year ruler — the carousel seen sideways ------------------------------
let RUL=null;   // {y0,y1} of the current ruler, for the riding cursor
function rulerHTML(l,es){
  const tl=(l.timeline||[]);
  const yrs=tl.map(e=>e.y).filter(Boolean);
  RUL=null;
  if(!yrs.length)return '';
  const y0=Math.min(...yrs), y1=Math.max(Math.max(...yrs),2026);
  RUL={y0,y1};
  const px=y=>((y-y0)/Math.max(1,(y1-y0))*100).toFixed(2);
  let marks='';
  tl.forEach(e=>{
    if(!e.y)return;
    const pi=es.findIndex(se=>se.y===e.y&&se.d===e.d);   // photo entries link to the ring
    marks+='<div class="rmark '+esc(e.t)+(pi>=0?' link':'')+'" style="left:'+px(e.y)+'%" '
      +(pi>=0?'data-i="'+pi+'" ':'')
      +'title="'+e.y+' — '+esc((e.d||e.t).slice(0,80))+'">'
      +'<i></i><span>'+e.y+'</span></div>';
  });
  return '<div class="ruler" id="ruler"><div class="rline"></div>'+marks
    +'<div class="rcur" id="rcur"></div>'
    +'<div class="rends"><span>'+y0+'</span><span>'+y1+'</span></div></div>';
}

// ---------------- carousel geometry ---------------------------------------------------------
function layout(){
  const ring=document.getElementById('ring'); if(!ring||!ST)return;
  [...ring.children].forEach(c=>{
    const i=+c.dataset.i;
    c.style.transform='rotateY('+(i*ST.step)+'deg) translateZ('+ST.R+'px)';
    c.classList.toggle('front',i===ST.focus);
  });
  ring.style.transform='translateZ('+(-ST.R)+'px) rotateY('+ST.ang+'deg)';
  const ru=document.getElementById('ruler');
  if(ru)[...ru.querySelectorAll('.rmark.link')].forEach(m=>m.classList.toggle('on',+m.dataset.i===ST.focus));
  // the cursor rides to the year facing you; the official 'now' card parks at the far end
  const rc=document.getElementById('rcur');
  if(rc&&RUL){
    const e=ST.entries[ST.focus];
    const y=e.y||(e.official?RUL.y1:null);
    if(y!=null){rc.style.display='block';
      rc.style.left=((y-RUL.y0)/Math.max(1,RUL.y1-RUL.y0)*100).toFixed(2)+'%';}
    else rc.style.display='none';
  }
}
function rotate(to){
  if(!ST)return;
  const n=ST.entries.length;
  to=((to%n)+n)%n;
  let d=to-ST.focus;                       // shortest way around the ring
  if(d>n/2)d-=n; if(d<-n/2)d+=n;
  ST.focus=to; ST.ang-=d*ST.step;
  layout(); syncBlurb();
}
function syncBlurb(){
  const b=document.getElementById('blurb'); if(!b)return;
  if(!ST){b.innerHTML='';return}
  const e=ST.entries[ST.focus];
  b.innerHTML='<span class="byr">'+(e.y||(e.official?'now':'·'))+'</span>'
    +esc(e.d||'')
    +'<span class="bsrc">photograph: '+srcName(e)+'</span>';
}

// ---------------- the viewer ----------------------------------------------------------------
function render(){
  const l=ORDER[cur], es=entriesFor(l);
  const host=document.getElementById('viewer');
  let left;
  if(es.length){
    const cards=es.map((e,i)=>
      '<div class="pcard" data-i="'+i+'">'
      +'<img decoding="async" src="'+esc(e.u)+'" alt="" '
      +'onload="this.classList.add(\'ld\')" onerror="window.__lmDrop(this.getAttribute(\'src\'))">'
      +'<div class="pyr">'+(e.y||(e.official?'now':'·'))+'</div></div>').join('');
    left='<div class="stage"><div class="ring" id="ring">'+cards+'</div></div>'
      +'<div class="crow"><button class="cbtn" id="older">‹ older</button>'
      +'<span class="lbl">rotate the postcards — the ruler follows</span>'
      +'<button class="cbtn" id="newer">newer ›</button></div>'
      +rulerHTML(l,es);
  }else{
    left='<div class="stage empty"><div class="lbl">no photographs geocoded to this parcel yet</div></div>';
  }
  const right=
    '<div class="lbl">'+(l.landmarkno==='curated'?'curated place':'SF landmark #'+esc(String(l.landmarkno)))+'</div>'
    +'<div class="lmname">'+esc(l.name)+'</div>'
    +'<div class="facts">'+[
        l.address&&esc(l.address),
        l.yearbuilt&&('<b>built '+l.yearbuilt+'</b>'),
        l.archbuild&&esc(l.archbuild),
        l.style&&esc(l.style)
      ].filter(Boolean).join(' · ')+'</div>'
    +(SHOW_STORIES&&l.story?'<div class="story"><h3>'+esc(l.story.title)+'</h3><p>'+esc(l.story.text)+'</p>'
      +(l.story.notes||[]).map(n=>'<div class="note">'+esc(n)+'</div>').join('')+'</div>':'')
    +'<div class="blurb" id="blurb"></div>';
  host.innerHTML='<div>'+left+'</div><div>'+right+'</div>';
  // scroll left on the carousel → back in time; scroll right → forward
  const stEl=host.querySelector('.stage');
  if(stEl&&es.length){
    let acc=0;
    stEl.addEventListener('wheel',ev=>{
      if(Math.abs(ev.deltaX)<=Math.abs(ev.deltaY))return;   // horizontal gestures only
      ev.preventDefault();
      acc+=ev.deltaX;
      if(acc>70){acc=0;rotate(ST.focus+1)}
      else if(acc<-70){acc=0;rotate(ST.focus-1)}
    },{passive:false});
  }
  ST=null;
  if(es.length){
    const n=es.length;
    ST={entries:es,focus:n-1,step:360/n,R:radiusFor(n),ang:0};
    ST.ang=-ST.focus*ST.step;
    layout();
  }
  syncBlurb();
  const sel=document.getElementById('sel');
  if(sel.value!==String(cur))sel.value=String(cur);
  history.replaceState(null,'','#lm-'+l.landmarkno);
  setTimeout(prefetchNeighbors,400);   // after this landmark's own images have first claim
}
window.__lmDrop=u=>{BAD.add(u);render()};

// the official city photograph comes from sfplanninggis.org (~1.7s cold) — warm the
// neighbors' copies while you read, so ‹ › lands on an already-cached image
function prefetchNeighbors(){
  [cur+1,cur-1].forEach(k=>{
    const l=ORDER[((k%ORDER.length)+ORDER.length)%ORDER.length];
    if(l&&l.photo)new Image().src=l.photo.replace('/Large/','/Docs/');
  });
}

function pick(i){ cur=((i%ORDER.length)+ORDER.length)%ORDER.length; render(); }
function pickByHash(){
  const m=location.hash.match(/^#lm-(.+)$/); if(!m)return false;
  const i=ORDER.findIndex(l=>String(l.landmarkno)===decodeURIComponent(m[1]));
  if(i>=0){cur=i;return true}
  return false;
}

// ---------------- controls ------------------------------------------------------------------
document.addEventListener('click',e=>{
  const card=e.target.closest('.pcard');
  if(card&&ST){
    const i=+card.dataset.i;
    rotate(i===ST.focus?ST.focus-1:i);     // front card clicked → keep going back in time
    return;
  }
  const mark=e.target.closest('.rmark.link');
  if(mark){rotate(+mark.dataset.i);return}
  if(e.target.id==='older'){rotate(ST?ST.focus-1:0);return}
  if(e.target.id==='newer'){rotate(ST?ST.focus+1:0);return}
  if(e.target.id==='prevL'){pick(cur-1);return}
  if(e.target.id==='nextL'){pick(cur+1);return}
});
document.addEventListener('keydown',e=>{
  if(/select|input|textarea/i.test(e.target.tagName))return;
  if(e.key==='ArrowLeft'){rotate(ST?ST.focus-1:0);e.preventDefault()}
  if(e.key==='ArrowRight'){rotate(ST?ST.focus+1:0);e.preventDefault()}
});
window.addEventListener('hashchange',()=>{ if(pickByHash())render(); });

// ---------------- boot ----------------------------------------------------------------------
const sel=document.getElementById('sel');
sel.innerHTML=
  '<optgroup label="with photographs — '+rich.length+'">'
  +ORDER.slice(0,rich.length).map((l,i)=>'<option value="'+i+'">'
    +(l.landmarkno==='curated'?'★':'#'+esc(String(l.landmarkno)))+' — '+esc(l.name)+'</option>').join('')
  +'</optgroup><optgroup label="thinner records — '+thin.length+'">'
  +ORDER.slice(rich.length).map((l,i)=>'<option value="'+(i+rich.length)+'">'
    +'#'+esc(String(l.landmarkno))+' — '+esc(l.name)+'</option>').join('')
  +'</optgroup>';
sel.addEventListener('change',()=>pick(+sel.value));
pickByHash();
render();
})();
