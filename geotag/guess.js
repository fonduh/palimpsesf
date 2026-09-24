// guess the year — external file (see hero.js for why).
// The photograph and its location are real; the year is withheld (captions leak years, so
// nothing textual from the record is shown until after the guess). Scoring: 100 minus 2 per
// year of error, floor 0. Five photographs per game.
(function(){
if(window.__guessBooted)return; window.__guessBooted=true;
const $=id=>document.getElementById(id);
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const yearOf=p=>{const m=/(1[89]\d\d|20\d\d)/.exec(p.date||"");return m?+m[0]:null;};
const POOL=(window.PHOTO_GEOJSON||{features:[]}).features.filter(f=>{
  const p=f.properties;
  return yearOf(p)&&p.iiif;
});
const bigSrc=p=>'https://digitalsf.org/nanna/proxy/iiif/image/'+p.iiif+'/full/%5E1024,/0/default.jpg';
// the location line: street/hood only — never the caption, which tends to contain the answer
const whereOf=p=>{
  const street=(p.query||'').replace(/,\s*San Francisco.*/i,'').trim();
  return [street||null,p.hood||null].filter(Boolean).join(' · ')||'san francisco';
};

const N=5;
let round=0,total=0,cur=null,locked=false;
function rounds(){ $('rounds').innerHTML=Array.from({length:N},(_,i)=>
  '<div class="rdot'+(i<round?' done':'')+'">'+(i+1)+'</div>').join(''); }
function next(){
  if(round>=N){
    $('vline').className='big';
    $('vline').textContent='FINAL: '+total+' / '+(N*100)+' — '+
      (total>=400?'you have been here before':total>=250?'a promising archivist':'the city keeps its secrets');
    $('vcap').innerHTML='<button id="again">Play again</button>';
    $('verdict').classList.add('on');
    $('again').onclick=()=>{ round=0; total=0; $('pts').textContent='0 PTS'; next(); };
    $('go').style.display='none';
    return;
  }
  cur=POOL[(Math.random()*POOL.length)|0];
  locked=false;
  const p=cur.properties;
  const im=$('photo');
  im.classList.remove('ld'); im.src=bigSrc(p);
  im.onerror=()=>{ cur=null; next(); };   // dead image — deal another, never show a blank
  $('where').textContent=whereOf(p);
  $('verdict').classList.remove('on');
  $('go').style.display='';
  $('round').textContent='R'+(round+1)+'/'+N;
  rounds();
}
$('photo').addEventListener('load',function(){ this.classList.add('ld'); });
$('slider').addEventListener('input',()=>$('yrval').textContent=$('slider').value);
$('go').onclick=()=>{
  if(locked||!cur)return; locked=true;
  const p=cur.properties, truth=yearOf(p), guess=+$('slider').value;
  const off=Math.abs(truth-guess), pts=Math.max(0,100-2*off);
  total+=pts; round++;
  $('pts').textContent=total+' PTS';
  $('vline').className='big '+(off<=5?'vgood':off>=30?'vbad':'');
  $('vline').textContent=off===0?truth+' — DEAD ON. +100'
    :'IT WAS '+truth+' — off by '+off+' year'+(off===1?'':'s')+' · +'+pts;
  $('vcap').innerHTML='“'+esc(p.caption)+'”'
    +' <span style="opacity:.55">· SFPL Historical Photograph Collection</span>'
    +(cur.geometry?' · <a href="map.html#ll='+cur.geometry.coordinates[1]+','+cur.geometry.coordinates[0]+',18">see it on the map →</a>':'');
  $('verdict').classList.add('on');
  rounds();
};
$('next').onclick=next;
next();
})();
