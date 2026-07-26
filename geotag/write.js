// write — your own parcel stories. External file (see hero.js for why).
// Stories persist in localStorage keyed by blklot; Export downloads a stories.json whose
// shape matches the pipeline's (keyed by landmarkno when known, else blklot), so
// `pipeline.py timelines` merges your writing into the landmark pages directly.
(function(){
if(window.__writeBooted)return; window.__writeBooted=true;
const $=id=>document.getElementById(id);
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KEY='palimpsesf-stories';
const load=()=>{ try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return{};} };
const store=o=>localStorage.setItem(KEY,JSON.stringify(o));
const L=window.LANDMARKS||[];

// landmark picker
const sel=$('lmsel');
L.filter(l=>l.blklot).forEach(l=>{
  const o=document.createElement('option');
  o.value=l.blklot; o.textContent=(l.landmarkno==='curated'?'★':'#'+l.landmarkno)+' '+l.name+' — '+l.blklot;
  sel.appendChild(o);
});
sel.onchange=()=>{ if(sel.value){ $('blklot').value=sel.value; refresh(); } };
$('blklot').addEventListener('input',refresh);

function lmFor(bl){ return L.find(l=>l.blklot===bl); }
function refresh(){
  const bl=$('blklot').value.trim();
  const lm=lmFor(bl);
  // the evidence: the parcel's real photographs (no placeholders — images appear only once loaded)
  const refs=[];
  if(lm)(lm.timeline||[]).forEach(e=>{
    let u=null;
    if(e.t==='photo') u=(e.src==='wikimedia'&&e.img)?e.img:(e.recid?'thumbs/'+e.recid+'.jpg':null);
    if(e.t==='occupant'&&e.img)u=e.img;
    if(u)refs.push({u,y:e.y});
  });
  $('refs').innerHTML=refs.slice(0,14).map(r=>
    '<img loading="lazy" src="'+esc(r.u)+'" title="'+(r.y||'')+'" onload="this.style.opacity=1" onerror="this.remove()">').join('');
  $('refnote').textContent=lm?(lm.name+' · '+(lm.address||'')+' · '+refs.length+' pieces of evidence on this lot'):(bl?'parcel '+bl+' — no landmark record here; write anyway':'');
  const mine=load()[bl];
  if(mine){ $('title').value=mine.title||''; $('text').value=mine.text||''; }
  renderMine();
}
$('save').onclick=()=>{
  const bl=$('blklot').value.trim();
  if(!bl){ $('savestat').textContent='pick a parcel first'; return; }
  const all=load();
  all[bl]={title:$('title').value.trim(),text:$('text').value.trim(),
           notes:[],written:new Date().toISOString().slice(0,10)};
  store(all);
  $('savestat').textContent='saved · '+new Date().toLocaleTimeString();
  renderMine();
};
$('export').onclick=()=>{
  const all=load(), out={};
  Object.entries(all).forEach(([bl,s])=>{
    const lm=lmFor(bl);
    out[lm?String(lm.landmarkno):bl]={title:s.title,text:s.text,notes:s.notes||[]};
  });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
  a.download='stories.json';
  a.click();
};
function renderMine(){
  const all=load();
  const ks=Object.keys(all);
  $('mine').innerHTML=ks.length
    ? '<span class="lbl">your stories ('+ks.length+') — click to open</span><br>'+ks.map(bl=>
        '<b data-bl="'+esc(bl)+'">'+esc(all[bl].title||'(untitled)')+'</b> — '+esc(bl)+' · '+esc(all[bl].written||'')).join('<br>')
    : '<span class="lbl">nothing written yet — the ledger is open</span>';
  [...$('mine').querySelectorAll('b[data-bl]')].forEach(b=>b.onclick=()=>{
    $('blklot').value=b.dataset.bl; refresh(); });
}
renderMine();
})();
