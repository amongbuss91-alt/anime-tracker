/* Shared code for Home, Library and Genres: AniList loading, caching, live refresh, top menu. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ORIGIN={KR:'Manhwa',JP:'Manga',CN:'Manhua',TW:'Manhua'};
const STATUS={CURRENT:'Reading',REPEATING:'Reading',COMPLETED:'Completed',PAUSED:'On hold',PLANNING:'Plan to read',DROPPED:'Dropped'};
const STATUS_ORDER=['Reading','Completed','On hold','Plan to read','Dropped'];
const TYPES=['Manhwa','Manga','Manhua','Novel'];
const HANGUL=/[가-힯]/,KANA=/[぀-ヿ]/;
const originOf=e=>{
  const m=e.media,n=m.title.native||'';
  if(m.format==='NOVEL')return 'Novel';
  if(HANGUL.test(n))return 'Manhwa';
  if(KANA.test(n))return 'Manga';
  return ORIGIN[m.countryOfOrigin]||'Other';
};
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
/* names AniList doesn't list, so the English title still finds the entry (add more as id: [names]) */
const BUILTIN_ALIASES={217430:['I Became the Youngest Martial God'],215524:['Survivalism']};
let nameCache=new WeakMap();
let looked={};   /* AniList id -> {names:[], en:''} filled by lookupNames() */
const aliasesOf=id=>[...(BUILTIN_ALIASES[id]||[]),...((looked[id]&&looked[id].names)||[])];
const akaOf=id=>(BUILTIN_ALIASES[id]||[])[0]||(looked[id]&&looked[id].en)||'';
const namesOf=e=>{let n=nameCache.get(e.media);if(!n){const t=e.media.title;n=norm([t.english,t.romaji,t.native,...(e.media.synonyms||[]),...aliasesOf(e.media.id)].filter(Boolean).join(' | '));nameCache.set(e.media,n)}return n};
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
 MediaListCollection(userName:$name,type:MANGA,chunk:$chunk){hasNextChunk lists{entries{
  status progress updatedAt createdAt startedAt{year} completedAt{year}
  media{id startDate{year} siteUrl isAdult tags{name rank isMediaSpoiler isAdult} format status genres synonyms countryOfOrigin chapters averageScore title{romaji english native} coverImage{large}}
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
const ckey=n=>'list:'+String(n).toLowerCase();
function readCache(n){try{const v=sessionStorage.getItem(ckey(n));return v?JSON.parse(v):null}catch(e){return null}}
function writeCache(n,d){try{sessionStorage.setItem(ckey(n),JSON.stringify({t:Date.now(),u:d.u,entries:d.entries}))}catch(e){}}
const recents=()=>store.get('recentUsers',[]);
function remember(n){store.set('lastUser',n);store.set('recentUsers',[n,...recents().filter(x=>x!==n)].slice(0,5))}
function currentUser(){
  const p=new URLSearchParams(location.search).get('user');
  return (p&&p.trim())||store.get('lastUser','')||'';
}

/* ---------- top menu ---------- */
const CROWN='<svg viewBox="0 0 40 30" fill="currentColor" aria-hidden="true"><path d="M3 24 1 7l10 8L20 2l9 13 10-8-2 17z"/><rect x="3" y="26" width="34" height="3" rx="1"/></svg>';
function topState(){
  const h=document.querySelector('.topbar'),p=$('prof');if(!h)return;
  const over=!!(p&&p.firstChild);
  h.classList.toggle('clear',over&&scrollY<p.offsetHeight-90);
}
addEventListener('scroll',()=>topState(),{passive:true});addEventListener('resize',()=>topState());
function mountNav(active,user,u){
  const q=user?'?user='+encodeURIComponent(user):'';
  $('nav').innerHTML=`<header class="topbar">
    <a class="brand" href="index.html">${CROWN}<span>StoryShelf Tracker</span></a>
    <nav class="tabs" aria-label="Main">
      <a class="tab${active==='library'?' on':''}" href="library.html${q}"${active==='library'?' aria-current="page"':''}>Library</a>
      <a class="tab${active==='genres'?' on':''}" href="genres.html${q}"${active==='genres'?' aria-current="page"':''}>Genres</a>
      <a class="tab${active==='stats'?' on':''}" href="stats.html${q}"${active==='stats'?' aria-current="page"':''}>Stats</a>
      <a class="tab${active==='universe'?' on':''}" href="universe.html${q}"${active==='universe'?' aria-current="page"':''}>Universe</a>
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

/* ---------- alternate names (MangaUpdates + MangaBaka), used ONLY to help search ---------- */
/* Tracking always comes from AniList. These sites just supply other names for the same series:
   1. MangaBaka links an AniList id to a MangaUpdates id (exact), then MangaUpdates supplies the names.
   2. If that link isn't available, MangaUpdates is searched by title and a result is accepted only
      when it lists AniList's original-language (native) title, so a look-alike can't slip through. */
const BAKA_URL='https://api.mangabaka.org/v1/source/anilist/',MU_URL='https://api.mangaupdates.com/v1/';
const ALT_KEY='altNames.v2',DAY=864e5;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const muTitles=s=>[s&&s.title,...((s&&s.associated)||[]).map(a=>typeof a==='string'?a:a&&a.title)].filter(Boolean);
const hasLatin=t=>/[A-Za-z]/.test(t||'');
function parseBaka(id,j){
  const list=(j&&j.data&&j.data.series)||[];
  const s=list.find(x=>x.source&&x.source.anilist&&+x.source.anilist.id===+id);
  if(!s)return null;
  const ts=s.titles||[];
  const names=[s.title,s.native_title,s.romanized_title,...ts.map(t=>t.title),...Object.values(s.secondary_titles||{}).flat().map(t=>t&&t.title)].filter(Boolean);
  const en=(ts.find(t=>t.language==='en'&&t.is_primary)||ts.find(t=>t.language==='en')||{}).title||'';
  const mu=s.source&&s.source.manga_updates&&s.source.manga_updates.id;
  return {names,en,mu:mu?String(mu):''};
}
/* one request; waits and retries when a site says "slow down"; throws 'blocked' if the browser can't reach it */
async function call(url,opts){
  for(let tries=0;tries<4;tries++){
    let r;
    try{r=await fetch(url,opts)}catch(e){throw new Error('blocked')}
    if(r.status===429){await sleep(5000);continue}
    return r;
  }
  throw new Error('slow');
}
async function muSeries(numId){
  const r=await call(MU_URL+'series/'+numId);
  return r.ok?r.json():null;
}
function overlaps(a,b){const set=new Set(a.map(norm).filter(Boolean));return b.some(x=>set.has(norm(x)))}

async function altFor(m,blocked){
  const mine=[m.title.romaji,m.title.native,...(m.synonyms||[])].filter(Boolean);
  let names=[],en='',used='';
  let mu='';
  if(!blocked.baka){
    try{
      const r=await call(BAKA_URL+m.id);
      if(r.ok){const p=parseBaka(m.id,await r.json());if(p){names=p.names;en=p.en;mu=p.mu;used='b'}}
    }catch(e){if(e.message==='blocked')blocked.baka=true}
  }
  /* MangaUpdates by the id MangaBaka gave us */
  if(!blocked.mu&&mu){
    try{
      const s=await muSeries(parseInt(mu,36));
      const t=muTitles(s);
      if(t.length&&overlaps(t,[...names,...mine])){
        names=[...names,...t];used+='m';
        if(!en&&hasLatin(s.title)&&norm(s.title)!==norm(m.title.romaji))en=s.title;
      }
    }catch(e){if(e.message==='blocked')blocked.mu=true}
  }
  /* no link found: search MangaUpdates by title, accept only on a native-title match */
  if(!names.length&&!blocked.mu&&m.title.romaji){
    try{
      const r=await call(MU_URL+'series/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search:m.title.romaji,perpage:5})});
      if(r.ok){
        const j=await r.json(),ids=((j&&j.results)||[]).map(x=>x.record&&x.record.series_id).filter(Boolean).slice(0,3);
        const want=norm(m.title.native)||norm(m.title.romaji);
        for(const id of ids){
          const s=await muSeries(id),t=muTitles(s);
          if(t.some(x=>norm(x)===want)){
            names=t;used='m';
            if(hasLatin(s.title)&&norm(s.title)!==norm(m.title.romaji))en=s.title;
            break;
          }
          await sleep(200);
        }
      }
    }catch(e){if(e.message==='blocked')blocked.mu=true}
  }
  return {names:[...new Set(names)],en,src:used};
}

let lookupBusy=false;
/* Only titles AniList has no English name for are looked up. Results are cached in this browser. */
async function lookupNames(entries,onProgress){
  if(lookupBusy)return;
  lookupBusy=true;
  const cache=store.get(ALT_KEY,{}),now=Date.now(),todo=[],blocked={baka:false,mu:false};
  let hit=false;
  entries.forEach(e=>{
    if(e.media.title.english)return;
    const id=e.media.id,c=cache[id];
    if(c&&now-c.t<(c.names.length?14*DAY:DAY)){if(c.names.length){looked[id]=c;hit=true}}
    else todo.push(e.media);
  });
  if(hit)nameCache=new WeakMap();
  const total=todo.length;let done=0;
  const sources=()=>{const u=Object.values(looked).map(x=>x.src||'').join('');return {baka:u.includes('b'),mu:u.includes('m')}};
  const report=()=>onProgress&&onProgress({total,done,blocked:{...blocked},both:blocked.baka&&blocked.mu,have:Object.keys(looked).length,sources:sources()});
  report();
  for(const m of todo){
    if(blocked.baka&&blocked.mu)break;
    try{
      const rec=await altFor(m,blocked);
      cache[m.id]={...rec,t:Date.now()};
      if(rec.names.length){looked[m.id]=cache[m.id];nameCache=new WeakMap()}
    }catch(e){/* skip this title; try again next visit */}
    done++;
    if(done%5===0){store.set(ALT_KEY,cache);report()}
    await sleep(200);
  }
  store.set(ALT_KEY,cache);
  lookupBusy=false;
  if(blocked.baka&&blocked.mu)done=total;
  report();
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
  const m=e.media,a=avg(e),prog=e.progress?`, Ch. ${e.progress}${m.chapters?'/'+m.chapters:''}`:'';
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

window.Site={contentLabel,lookupNames,akaOf,aliasesOf,BUILTIN_ALIASES,$,esc,STATUS,STATUS_ORDER,TYPES,originOf,titleOf,avg,norm,matches,agoText,fetchList,errText,writeCache,remember,recents,store,boot,CROWN};
})();

/* ---------- scroll to top ---------- */
(()=>{if(!document.body.classList.contains('app'))return;const b=document.createElement('button');b.type='button';b.className='totop';b.setAttribute('aria-label','Scroll to top');b.innerHTML='&uarr;';
b.onclick=()=>scrollTo({top:0,behavior:'smooth'});document.body.appendChild(b);
const f=()=>b.classList.toggle('show',scrollY>600);addEventListener('scroll',f,{passive:true});f()})();

