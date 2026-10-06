/* Shared code for Home, Library, Genres and Stats: AniList anime loading, caching, live refresh, top menu. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const FORMAT={TV:'TV',TV_SHORT:'TV Short',MOVIE:'Movie',SPECIAL:'Special',OVA:'OVA',ONA:'ONA',MUSIC:'Music'};
const STATUS={CURRENT:'Watching',REPEATING:'Watching',COMPLETED:'Completed',PAUSED:'On hold',PLANNING:'Plan to watch',DROPPED:'Dropped'};
const STATUS_ORDER=['Watching','Completed','On hold','Plan to watch','Dropped'];
const TYPES=['TV','Movie','OVA','ONA','Special','TV Short','Music'];
/* "type" of a title = its AniList format (TV, Movie, OVA, ...) */
const originOf=e=>FORMAT[e.media.format]||'Other';
/* content label from AniList's own flags: Adult if AniList marks it adult, Suggestive for Ecchi or adult-type tags */
function contentLabel(e){
  const m=e.media,g=m.genres||[];
  if(m.isAdult||g.includes('Hentai'))return 'Adult';
  if(g.includes('Ecchi')||(m.adultTags||[]).length)return 'Suggestive';
  return '';
}
const titleOf=e=>e.media.title.english||e.media.title.romaji||'Untitled';
const avg=e=>e.media.averageScore?e.media.averageScore/10:0;
const norm=t=>String(t||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
let nameCache=new WeakMap();
const namesOf=e=>{let n=nameCache.get(e.media);if(!n){const t=e.media.title;n=norm([t.english,t.romaji,t.native,...(e.media.synonyms||[])].filter(Boolean).join(' | '));nameCache.set(e.media,n)}return n};
const matches=(e,q)=>{const n=namesOf(e);return q.split(' ').every(w=>n.includes(w))};
function agoText(sec){
  const m=(Date.now()-sec*1000)/6e4;
  if(m<2)return 'just now';if(m<60)return Math.floor(m)+' min ago';
  const h=m/60;if(h<24)return Math.floor(h)+'h ago';
  const d=h/24;if(d<30)return Math.floor(d)+'d ago';
  if(d<365)return Math.floor(d/30)+'mo ago';return Math.floor(d/365)+'y ago';
}

/* ---------- AniList ---------- */
const QUERY=`query($name:String,$chunk:Int){
 User(name:$name){name avatar{large} bannerImage siteUrl}
 MediaListCollection(userName:$name,type:ANIME,chunk:$chunk){hasNextChunk lists{entries{
  status progress updatedAt createdAt startedAt{year} completedAt{year}
  media{id startDate{year} siteUrl isAdult tags{name rank isMediaSpoiler isAdult} format status genres synonyms episodes averageScore title{romaji english native} coverImage{large}}
 }}}}`;
async function fetchList(name){
  const seen=new Set(),entries=[];let user=null,chunk=1,more=true;
  while(more&&chunk<=40){
    const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:QUERY,variables:{name,chunk}})});
    const j=await r.json();
    if(j.errors){
      const nf=j.errors.some(e=>e.status===404);
      const err=new Error(nf?`No AniList user named "${name}". Check the spelling and try again.`:'AniList returned an error. Try again in a moment.');
      err.known=true;throw err;
    }
    user=j.data.User;
    const col=j.data.MediaListCollection;
    col.lists.flatMap(l=>l.entries).forEach(e=>{if(STATUS[e.status]&&!seen.has(e.media.id)){
      seen.add(e.media.id);
      const tg=(e.media.tags||[]).filter(t=>!t.isMediaSpoiler&&t.rank>=40);
      e.media.tagNames=tg.map(t=>t.name);e.media.adultTags=tg.filter(t=>t.isAdult).map(t=>t.name);delete e.media.tags;
      entries.push(e)}});
    more=!!col.hasNextChunk;chunk++;
  }
  return {u:user,entries};
}
const errText=e=>e&&e.known?e.message:'Could not reach AniList. Check your connection and try again.';
const sigOf=es=>es.map(e=>[e.media.id,e.status,e.progress,e.updatedAt,e.createdAt,(e.media.tagNames||[]).length,(e.media.startDate||{}).year,e.startedAt.year,e.completedAt.year].join(':')).sort().join('|');

/* ---------- storage (always guarded) ---------- */
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const ckey=n=>'list.anime:'+String(n).toLowerCase();
function readCache(n){try{const v=sessionStorage.getItem(ckey(n));return v?JSON.parse(v):null}catch(e){return null}}
function writeCache(n,d){try{sessionStorage.setItem(ckey(n),JSON.stringify({t:Date.now(),u:d.u,entries:d.entries}))}catch(e){}}
const recents=()=>store.get('recentUsers',[]);
function remember(n){store.set('lastUser',n);store.set('recentUsers',[n,...recents().filter(x=>x!==n)].slice(0,5))}
function currentUser(){
  const p=new URLSearchParams(location.search).get('user');
  return (p&&p.trim())||store.get('lastUser','')||'';
}

/* ---------- top menu ---------- */
const CROWN='<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><path d="M20 1c1.5 9 4.5 13.5 13 15-8.5 1.5-11.5 6-13 15-1.5-9-4.5-13.5-13-15 8.5-1.5 11.5-6 13-15z"/><path d="M33 24c.6 3.5 1.8 5.2 5 5.8-3.2.6-4.4 2.3-5 5.8-.6-3.5-1.8-5.2-5-5.8 3.2-.6 4.4-2.3 5-5.8z"/></svg>';
function topState(){
  const h=document.querySelector('.topbar'),p=$('prof');if(!h)return;
  const over=!!(p&&p.firstChild);
  h.classList.toggle('clear',over&&scrollY<p.offsetHeight-90);
}
addEventListener('scroll',()=>topState(),{passive:true});addEventListener('resize',()=>topState());
function mountNav(active,user,u){
  const q=user?'?user='+encodeURIComponent(user):'';
  $('nav').innerHTML=`<header class="topbar">
    <a class="brand" href="index.html">${CROWN}<span>AnimeShelf Tracker</span></a>
    <nav class="tabs" aria-label="Main">
      <a class="tab${active==='library'?' on':''}" href="library.html${q}"${active==='library'?' aria-current="page"':''}>Library</a>
      <a class="tab${active==='genres'?' on':''}" href="genres.html${q}"${active==='genres'?' aria-current="page"':''}>Genres</a>
      <a class="tab${active==='stats'?' on':''}" href="stats.html${q}"${active==='stats'?' aria-current="page"':''}>Stats</a>
    </nav>
  </header>`;
  let pr=$('prof');
  if(!pr){pr=document.createElement('div');pr.id='prof';$('nav').insertAdjacentElement('afterend',pr)}
  pr.className='prof'+(u&&u.bannerImage?' hasimg':'');
  pr.innerHTML=u?`${u.bannerImage?`<img class="pbanner" src="${esc(u.bannerImage)}" alt="">`:''}<div class="pin"><img class="pav" src="${esc(u.avatar.large)}" alt=""><a class="pname" href="${esc(u.siteUrl||'#')}" target="_blank" rel="noopener">${esc(u.name)}</a><button type="button" class="suggest" id="suggest" title="Pick a random title from this whole library">Suggest</button></div>`:'';
  topState();
}

/* ---------- live refresh ---------- */
const L={timer:null,on:true,name:null,sig:'',at:0,fail:0,cb:null};
function liveUI(){
  const el=$('livebox');if(!el)return;
  if(!el.firstChild){
    el.innerHTML='<span class="dot" id="ldot"></span><span class="lt" id="ltext"></span><button class="btn quiet" id="lbtn">Pause</button>';
    $('lbtn').onclick=()=>{L.on=!L.on;if(L.on){L.fail=0;liveTick()}else clearTimeout(L.timer);liveUI()};
  }
  const s=Math.round((Date.now()-L.at)/1000);
  $('ldot').className='dot'+(!L.on?' off':L.fail?' bad':'');
  $('ltext').textContent=!L.on?'Live updates paused':L.fail?'AniList unreachable, retrying':`Live, checked ${s<5?'just now':s+'s ago'}`;
  $('lbtn').textContent=L.on?'Pause':'Resume';
}
function liveSchedule(){clearTimeout(L.timer);if(L.name&&L.on)L.timer=setTimeout(liveTick,Math.min(30000*2**L.fail,240000))}
async function liveTick(){
  clearTimeout(L.timer);
  if(!L.name||!L.on)return;
  if(document.hidden){liveSchedule();return}
  const name=L.name;
  try{
    const d=await fetchList(name);
    if(name!==L.name)return;
    L.fail=0;L.at=Date.now();
    const sig=sigOf(d.entries);
    if(sig!==L.sig){L.sig=sig;writeCache(name,d);L.cb(d)}
  }catch(e){L.fail=Math.min(L.fail+1,3)}
  liveUI();liveSchedule();
}
function liveStart(name,sig,cb){Object.assign(L,{name,sig,cb,on:true,fail:0,at:Date.now()});liveSchedule();liveUI()}
setInterval(liveUI,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&L.name&&L.on)liveTick()});

/* ---------- page boot (Library and Genres) ---------- */
let CUR=[];
async function boot(active,onData){
  const user=currentUser();
  if(!user){
    mountNav(active,'',null);
    $('main').innerHTML='<p class="msg">Search for an AniList username first, then your library and genres will appear here.<br><a href="index.html">Go to search</a></p>';
    return;
  }
  const cached=readCache(user);
  let first=true;
  const show=d=>{
    CUR=d.entries;
    remember(d.u.name);
    mountNav(active,d.u.name,d.u);
    first=false;onData(d);
  };
  if(cached){show(cached)}else{mountNav(active,user,null);$('main').dataset.state='loading'}
  try{
    const d=await fetchList(user);
    writeCache(user,d);
    if(!cached||sigOf(d.entries)!==sigOf(cached.entries)||JSON.stringify(d.u)!==JSON.stringify(cached.u))show(d);
    liveStart(d.u.name,sigOf(d.entries),show);
  }catch(e){
    if(!cached){
      $('main').innerHTML=`<p class="msg err">${esc(errText(e))}<br><a href="index.html">Back to search</a></p>`;
    }else{
      liveStart(cached.u.name,sigOf(cached.entries),show);
    }
  }
}

/* ---------- Suggest: a random title from the whole library ---------- */
(()=>{let last=null,box=null;
const close=()=>{if(box){box.remove();box=null}};
function pick(){
  if(!CUR.length)return null;
  if(CUR.length===1)return CUR[0];
  let e;do{e=CUR[Math.floor(Math.random()*CUR.length)]}while(last&&e.media.id===last);
  last=e.media.id;return e;
}
function open(){
  const e=pick();if(!e)return;
  const m=e.media,a=avg(e),prog=e.progress?`, Ep. ${e.progress}${m.episodes?'/'+m.episodes:''}`:'';
  const html=`<div class="sg-card" role="dialog" aria-modal="true" aria-label="Suggested title">
    <button type="button" class="sg-x" data-sg="close" aria-label="Close">&times;</button>
    <img src="${esc(m.coverImage.large)}" alt="">
    <div class="sg-body"><small>Random pick from ${CUR.length} titles</small>
      <b>${esc(titleOf(e))}</b>
      <span>${esc(originOf(e))} · ${esc(STATUS[e.status])}${prog}${a?' · '+a.toFixed(1):''}</span>
      <div class="sg-btns"><button type="button" class="btn primary" data-sg="again">Suggest another</button><a class="btn" href="${esc(m.siteUrl)}" target="_blank" rel="noopener">AniList</a></div></div></div>`;
  if(!box){box=document.createElement('div');box.className='sg-back';document.body.appendChild(box)}
  box.innerHTML=html;box.querySelector('[data-sg="again"]').focus();
}
document.addEventListener('click',ev=>{
  if(ev.target.closest('#suggest')){open();return}
  const t=ev.target.closest('[data-sg]');
  if(t){t.dataset.sg==='again'?open():close();return}
  if(box&&ev.target===box)close();
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')close()});
})();

window.Site={contentLabel,$,esc,STATUS,STATUS_ORDER,TYPES,originOf,titleOf,avg,norm,matches,agoText,fetchList,errText,writeCache,remember,recents,store,boot,CROWN};
})();

/* ---------- scroll to top ---------- */
(()=>{if(!document.body.classList.contains('app'))return;const b=document.createElement('button');b.type='button';b.className='totop';b.setAttribute('aria-label','Scroll to top');b.innerHTML='&uarr;';
b.onclick=()=>scrollTo({top:0,behavior:'smooth'});document.body.appendChild(b);
const f=()=>b.classList.toggle('show',scrollY>600);addEventListener('scroll',f,{passive:true});f()})();

