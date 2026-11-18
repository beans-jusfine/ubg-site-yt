(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function renderIcons(){if(window.lucide && window.lucide.createIcons)window.lucide.createIcons()}
const SAVED='nero.tube.saved.v2',HISTORY='nero.tube.history.v2',SEARCHES='nero.tube.searches.v1';
const IV_DISCOVERY='https://api.invidious.io/instances.json?pretty=1&sort_by=health';
const IV_FALLBACK=['https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yt.chocolatemoo53.com','https://invidious.tiekoetter.com'];
const PI_FALLBACK=['https://pipedapi.kavin.rocks','https://pipedapi.leptons.xyz','https://pipedapi.nosebs.ru','https://pipedapi-libre.kavin.rocks','https://piped-api.privacy.com.de','https://pipedapi.adminforge.de','https://api.piped.yt','https://pipedapi.drgns.space','https://pipedapi.owo.si','https://api.piped.private.coffee'];
let query='popular videos',page=1,nextPage='',provider='Invidious',activeInstance='',busy=false,items=[],pageName='home',currentVideo=null;
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(t){$('#status').textContent=t}
function thumb(v){const a=v.videoThumbnails||v.thumbnails||[];return(a.find(x=>/maxres|high|medium|hqdefault/i.test(x.quality||''))||a[a.length-1]||{}).url||v.thumbnail||v.thumbnailUrl||''}
function normalize(v,src,base){const fromUrl=(()=>{try{const u=new URL(v.url||'',base||location.origin);return u.searchParams.get('v')||(u.pathname.match(/\\/(?:watch|videos)\\/([A-Za-z0-9_-]{6,20})/)||[])[1]||''}catch{return''}})();const id=v.videoId||v.id||fromUrl;if(!id)return null;const authorThumbs=v.authorThumbnails||v.uploaderAvatars||[];const avatar=(Array.isArray(authorThumbs)?(authorThumbs.find(x=>x&&(/medium|high|large/i.test(x.quality||'')||x.width>=48))||authorThumbs[authorThumbs.length-1]||{}).url:'')||v.uploaderAvatar||v.authorAvatar||'';const rawViews=Number((v.viewCount!==undefined&&v.viewCount!==null?v.viewCount:v.views));const views=Number.isFinite(rawViews)&&rawViews>=0?new Intl.NumberFormat('en-US').format(rawViews)+' views':String(v.viewCountText||v.views||'').replace(/[٠-٩۰-۹]/g,d=>String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d)%10));const rawDuration=(v.lengthSeconds!==undefined&&v.lengthSeconds!==null?v.lengthSeconds:(v.duration!==undefined&&v.duration!==null?v.duration:(v.length!==undefined&&v.length!==null?v.length:v.durationSeconds)));let duration='';if(typeof rawDuration==='string'&&/^\\d{1,3}:\\d{2}(?::\\d{2})?$/.test(rawDuration.trim()))duration=rawDuration.trim();else{const seconds=Number(rawDuration);if(Number.isFinite(seconds)&&seconds>0){const total=Math.floor(seconds),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;duration=h?[h,m,s].map((n,i)=>i===0?String(n):String(n).padStart(2,'0')).join(':'):[m,s].map(n=>String(n).padStart(2,'0')).join(':')}}return{id,title:v.title||'Untitled video',author:v.author||v.uploader||v.uploaderName||'YouTube',avatar,thumb:thumb(v),duration,published:v.publishedText||v.uploaded||'',views,source:src,base}}
async function json(url,timeout=9000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function makeUrl(base,path,params={}){const u=new URL(path,base+'/');Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,v)});return u.href}
async function ivInstances(){try{const d=await json(IV_DISCOVERY,4500);const entries=Array.isArray(d)?d.map(x=>Array.isArray(x)?x[1]:x):Object.values(d).map(x=>Array.isArray(x)?x[0]:x);const live=entries.filter(x=>x&&x.api!==false&&x.uri&&String(x.type||'https')==='https').map(x=>String(x.uri).replace(/\/$/,''));return[...new Set([...live,...IV_FALLBACK])]}catch{return IV_FALLBACK}}
async function pipedInstances(){let list=PI_FALLBACK.slice();try{const r=await fetch('https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md');if(r.ok){const body=await r.text();const found=[...body.matchAll(/https:\/\/[a-z0-9.-]+(?=\s+\|)/gi)].map(x=>x[0]);if(found.length)list=[...found,...list]}}catch{}return[...new Set(list)]}
async function requestIV(path,params={}){let last;for(const base of await ivInstances()){try{const data=await json(makeUrl(base,path,params));provider='Invidious';activeInstance=base;return{data,base}}catch(e){last=e}}throw last||Error('No Invidious instances responded')}
async function requestPiped(path,params={}){let last;for(const base of await pipedInstances()){try{const data=await json(makeUrl(base,path,params));provider='Piped';activeInstance=base;return{data,base}}catch(e){last=e}}throw last||Error('No Piped instances responded')}
function render(list,append=false){const grid=$('#grid');if(!append){grid.innerHTML='';items=[]}items=append?items.concat(list):list;const html=list.map(v=>{const saved=read(SAVED).some(x=>x.id===v.id);return '<article class="video-card"><button class="thumb" data-play="'+esc(v.id)+'" aria-label="Play '+esc(v.title)+'"><img loading="lazy" src="'+esc(v.thumb)+'" alt=""><span class="play-hint"><i data-lucide="play" class="play-icon"></i></span>'+(v.duration?'<span class="video-duration">'+esc(v.duration)+'</span>':'')+'</button><div class="video-info"><div class="avatar">'+(v.avatar?'<img src="'+esc(v.avatar)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent=\''+esc(v.author.slice(0,1).toUpperCase())+'\'">' :esc(v.author.slice(0,1).toUpperCase()))+'</div><div><button class="video-title" data-play="'+esc(v.id)+'">'+esc(v.title)+'</button><div class="video-meta">'+esc(v.author)+'</div><div class="video-meta">'+esc([v.views,v.published].filter(Boolean).join(' · '))+'</div></div><button class="save-btn" data-save="'+esc(v.id)+'" title="'+(saved?'Remove saved':'Save video')+'">'+(saved?'<i data-lucide="bookmark-check"></i>':'<i data-lucide="bookmark-plus"></i>')+'</button></div></article>'}).join('');if(!html&&!append)grid.innerHTML='<p class="empty">No videos found.</p>';else grid.insertAdjacentHTML('beforeend',html);renderIcons()}
function rememberSearch(q){const value=String(q||'').trim();if(value.length<2||/^(popular videos|shorts)$/i.test(value))return;const a=read(SEARCHES).filter(x=>String(x.q||x).toLowerCase()!==value.toLowerCase());a.unshift({q:value,at:Date.now()});write(SEARCHES,a.slice(0,30))}
async function search(q=query,append=false){if(busy)return;busy=true;query=q;rememberSearch(q);if(!append){page=1;nextPage=''}status('Searching video sources…');try{const data=await json('/api/search?q='+encodeURIComponent(q)+'&page='+page,18000);const raw=Array.isArray(data.items)?data.items:[];const normalized=raw.map(v=>normalize(v,data.provider||'YouTube',data.base||'')).filter(Boolean);provider=data.provider||'YouTube';activeInstance=data.base||'';render(normalized,append);$('#provider-status').textContent=provider+(activeInstance?' · '+new URL(activeInstance).host:' · server proxy');status(normalized.length+' videos · '+provider);$('#load-more').hidden=raw.length<20}catch(e){status('Search sources are unavailable. Try again shortly.');if(!append)$('#grid').innerHTML='<p class="empty">Could not load videos right now. Please try again.</p>';$('#load-more').hidden=true}finally{busy=false}}
async function details(id){const data=await json('/api/video/'+encodeURIComponent(id),18000);return normalize(data.video,data.provider||'YouTube',data.base||'')}
async function personalizedFeed(){if(busy)return;const searches=read(SEARCHES),watched=read(HISTORY).slice().reverse(),candidates=[];for(const x of searches.slice(0,8)){const q=String(x.q||x).trim();if(q)candidates.push(q)}for(const x of watched.slice(0,12)){const title=String(x.title||'').trim(),author=String(x.author||'').trim();if(title)candidates.push([title.split(/\\s+/).slice(0,5).join(' '),author].filter(Boolean).join(' '));else if(author)candidates.push(author+' videos')}const terms=[...new Set(candidates)].slice(0,4);if(!terms.length){search('popular videos');return}busy=true;status('Building your mix from your searches and watches…');let combined=[];try{const batches=await Promise.all(terms.map(async q=>{try{const d=await json('/api/search?q='+encodeURIComponent(q)+'&page=1',18000);return(Array.isArray(d.items)?d.items:[]).map(v=>normalize(v,d.provider||'YouTube',d.base||'')).filter(Boolean)}catch{return[]}}));const seen=new Set();for(const batch of batches)for(const v of batch)if(!seen.has(v.id)){seen.add(v.id);combined.push(v)}}finally{busy=false}if(!combined.length){search('popular videos');return}render(combined);$('#provider-status').textContent='Personalized mix · based on your activity';status('Your mix · based on '+searches.length+' searches and '+watched.length+' watches');$('#load-more').hidden=true}
function renderUpNext(){const list=items.filter(x=>x.id!==(currentVideo&&currentVideo.id)).slice(0,12);$('#up-next-list').innerHTML=list.map(v=>'<button class="up-next-item" data-next="'+esc(v.id)+'"><span class="up-next-thumb"><img src="'+esc(v.thumb)+'" alt="" loading="lazy">'+(v.duration?'<span class="video-duration">'+esc(v.duration)+'</span>':'')+'</span><span class="up-next-info"><strong>'+esc(v.title)+'</strong><span>'+esc(v.author)+'</span></span></button>').join('')||'<p class="up-next-empty">Search results and recommendations will appear here.</p>'}
let playerSourcesList=[],playerSourceIndex=0;
function buildPlayerSources(v){
 const hosts=[...(v.source==='Invidious'&&v.base?[v.base]:[]),...IV_FALLBACK];
 const unique=[...new Set(hosts.map(x=>String(x).replace(/[/]+$/,'')))];
 const sources=unique.map(host=>({kind:'embed',label:'Invidious · '+new URL(host).host,url:host+'/embed/'+encodeURIComponent(v.id)+'?autoplay=1&controls=1&hl=en-US&local=true&player_style=youtube'}));
 sources.push({kind:'embed',label:'Piped',url:'https://piped.video/embed/'+encodeURIComponent(v.id)});
 return sources;
}
function setPlayerSource(index){
 if(!playerSourcesList.length)return;
 playerSourceIndex=Math.max(0,Math.min(index,playerSourcesList.length-1));
 const source=playerSourcesList[playerSourceIndex],stage=$('#stage');
 $('#player-source-label').textContent='Player: '+source.label;
 $('#player-source-count').textContent=(playerSourceIndex+1)+' / '+playerSourcesList.length;
 if(source.kind==='stream'){
  stage.innerHTML='<video id="video-element" controls autoplay playsinline preload="metadata"></video>';
  const video=$('#video-element');video.src=source.url;video.load();
  video.onerror=()=>{if(playerSourceIndex<playerSourcesList.length-1)setPlayerSource(playerSourceIndex+1);else $('#player-source-label').textContent='Player unavailable · try another video';};
  video.play().catch(()=>{});
 }else{
  stage.innerHTML='<iframe id="video-frame" title="Video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
  $('#video-frame').src=source.url;
 }
}
let playbackRequest=0;
async function loadPlayback(v){
 const request=++playbackRequest;
 try{
  const data=await json('/api/playback/'+encodeURIComponent(v.id),18000);
  if(request!==playbackRequest||(currentVideo&&currentVideo.id)!==v.id)return;
  const streams=(data.streams||[]).filter(x=>x&&typeof x.url==='string'&&x.url.startsWith('https://'));
  if(streams.length){
   const embeds=playerSourcesList.filter(x=>x.kind==='embed');
   playerSourcesList=streams.map(x=>({kind:'stream',label:(x.provider||data.provider||'Direct')+' · '+(x.label||'MP4'),url:x.url})).concat(embeds);
   setPlayerSource(0);
  }else setPlayerSource(0);
 }catch{if(request===playbackRequest&&(currentVideo&&currentVideo.id)===v.id)setPlayerSource(0);}
}
function play(v,updateUrl=true){
 currentVideo=v;playerSourcesList=buildPlayerSources(v);
 $('#player-title').textContent=v.title;$('#player-author').textContent=v.author||'YouTube';
 $('#player-avatar').innerHTML=v.avatar?'<img src="'+esc(v.avatar)+'" alt="" referrerpolicy="no-referrer">':esc((v.author||'N').slice(0,1).toUpperCase());
 $('#player-channel-label').textContent='NERO Tube channel';
 $('#watch-stats').textContent=[v.views,v.published].filter(Boolean).join(' · ')||'Watch on NERO Tube';
 $('#watch-description-text').textContent='You are watching '+v.title+' by '+(v.author||'YouTube')+'. NERO Tube tries alternative video frontends if playback is unavailable.';
 $('#description-toggle').textContent='Show more';
 $('#stage').innerHTML='<div class="playback-loading">Preparing video…</div>';
 setPlayerSource(0);$('#player').hidden=false;renderUpNext();loadPlayback(v);
 const h=read(HISTORY).filter(x=>x.id!==v.id);h.push({id:v.id,title:v.title,author:v.author,at:Date.now()});write(HISTORY,h.slice(-100));
 updateSaveButton();if(updateUrl){const u=new URL(location.href);u.searchParams.set('v',v.id);history.pushState({video:v.id},'',u)}
}
function closePlayer(updateUrl=true){playbackRequest++;$('#player').hidden=true;$('#stage').innerHTML='';if(updateUrl){const u=new URL(location.href);u.searchParams.delete('v');history.pushState({},'',u)}currentVideo=null}
function updateSaveButton(){if(!currentVideo)return;const yes=read(SAVED).some(x=>x.id===currentVideo.id);$('#save-current').innerHTML=yes?'<i data-lucide="bookmark-check"></i> Saved':'<i data-lucide="bookmark-plus"></i> Save';renderIcons()}
function saveVideo(id){const a=read(SAVED),i=a.findIndex(x=>x.id===id);if(i>=0)a.splice(i,1);else a.push({id,at:Date.now()});write(SAVED,a);if((currentVideo&&currentVideo.id)===id)updateSaveButton();if(pageName==='saved')loadLocal('saved');else render(items)}
async function loadLocal(which){const arr=read(which==='saved'?SAVED:HISTORY);$('#load-more').hidden=true;$('#page-title').textContent=which==='saved'?'Saved videos':'Watch history';if(!arr.length){render([]);$('#grid').innerHTML='<p class="empty">'+(which==='saved'?'No saved videos yet.':'No watch history yet.')+'</p>';status(which==='saved'?'Saved videos':'Watch history');return}busy=true;status('Loading '+which+'…');try{const found=[];for(const item of arr.slice().reverse().slice(0,30)){try{const v=await details(item.id);if(v)found.push(v)}catch{}}render(found);status(found.length+' videos · '+provider)}finally{busy=false}}
function activate(p,skipLoad=false){pageName=p;$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#chips').hidden=p!=='home';$('#page-title').textContent=p==='home'?(new URL(location.href).searchParams.has('search')?'Search results':'Explore'):p==='shorts'?'Shorts':p==='saved'?'Saved videos':'Watch history';$('#load-more').hidden=true;if(skipLoad)return;if(p==='home')search(query);else if(p==='shorts')search('shorts');else loadLocal(p)}
$('#search-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#query').value.trim();if(q){const u=new URL(location.href);u.searchParams.set('search',q);u.searchParams.delete('v');location.assign(u.href)}});
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.page)));
$('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-query]');if(!b)return;document.querySelectorAll('#chips [data-query]').forEach(x=>x.classList.toggle('selected',x===b));$('#query').value=b.dataset.query;const u=new URL(location.href);u.searchParams.set('search',b.dataset.query);u.searchParams.delete('v');location.assign(u.href)});
$('#grid').addEventListener('click',e=>{const p=e.target.closest('[data-play]'),s=e.target.closest('[data-save]');if(p){const v=items.find(x=>x.id===p.dataset.play);if(v)play(v)}if(s)saveVideo(s.dataset.save)});
$('#load-more').onclick=()=>{page++;search(query,true)};
$('#settings-toggle').onclick=()=>$('#settings').hidden=!$('#settings').hidden;
$('#close-player').onclick=()=>closePlayer();
$('#try-player-again').onclick=()=>setPlayerSource(playerSourceIndex+1);
$('#player').addEventListener('click',e=>{if(e.target===$('#player'))closePlayer()});
$('#up-next-list').addEventListener('click',e=>{const b=e.target.closest('[data-next]');if(!b)return;const v=items.find(x=>x.id===b.dataset.next);if(v)play(v)});
$('#subscribe-btn').onclick=()=>{const b=$('#subscribe-btn');b.classList.toggle('subscribed');b.textContent=b.classList.contains('subscribed')?'Subscribed':'Subscribe'};
$('#description-toggle').onclick=()=>{const p=$('#watch-description-text'),expanded=p.classList.toggle('expanded');$('#description-toggle').textContent=expanded?'Show less':'Show more'};
$('#save-current').onclick=()=>{if(currentVideo)saveVideo(currentVideo.id)};
$('#share-video').onclick=async()=>{if(!currentVideo)return;const link=new URL(location.href);link.searchParams.set('v',currentVideo.id);try{await navigator.clipboard.writeText(link.href);$('#share-video').innerHTML='<i data-lucide="check"></i> Link copied';renderIcons();setTimeout(()=>{$('#share-video').innerHTML='<i data-lucide="share-2"></i> Share video';renderIcons()},1800)}catch{prompt('Copy this video link:',link.href)}};
window.addEventListener('popstate',()=>{const u=new URL(location.href),id=u.searchParams.get('v'),q=u.searchParams.get('search');if(id){const v=items.find(x=>x.id===id);if(v)play(v,false);else details(id).then(v=>v&&play(v,false)).catch(()=>{})}else{closePlayer(false);if(q){$('#query').value=q;query=q;activate('home',true);search(q)}else{$('#query').value='';query='popular videos';activate('home',true);personalizedFeed()}}});
async function init(){const u=new URL(location.href),id=u.searchParams.get('v'),q=u.searchParams.get('search');if(id){status('Loading shared video…');try{const v=await details(id);if(v)play(v,false);else search()}catch{status('Could not load this video.');search()}}else if(q){$('#query').value=q;query=q;search(q)}else personalizedFeed()}
init();
})();