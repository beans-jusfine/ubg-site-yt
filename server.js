'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'public');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const IV_FALLBACK = ['https://inv.nadeko.net','https://invidious.nerdvpn.de','https://yt.chocolatemoo53.com','https://invidious.tiekoetter.com'];
const PI_FALLBACK = ['https://pipedapi.kavin.rocks','https://pipedapi.leptons.xyz','https://pipedapi.nosebs.ru','https://pipedapi-libre.kavin.rocks','https://piped-api.privacy.com.de','https://pipedapi.adminforge.de','https://api.piped.yt','https://pipedapi.drgns.space','https://pipedapi.owo.si','https://api.piped.private.coffee'];
async function getJson(url, ms=7000) {
  const response = await fetch(url, {headers:{Accept:'application/json','Accept-Language':'en-US,en;q=0.9','User-Agent':'NERO-Tube/1.0'},signal:AbortSignal.timeout(ms)});
  if (!response.ok) throw new Error('HTTP '+response.status);
  return response.json();
}
async function invidiousInstances() {
  try {
    const data = await getJson('https://api.invidious.io/instances.json?pretty=1&sort_by=health',5000);
    const found = (Array.isArray(data)?data.map(x=>Array.isArray(x)?{...x[1],uri:x[0]}:x):Object.values(data))
      .filter(x=>x&&x.api!==false&&x.uri&&String(x.type||'https')==='https')
      .map(x=>String(x.uri).replace(/\/$/,''));
    return [...new Set([...found,...IV_FALLBACK])].slice(0,6);
  } catch { return IV_FALLBACK.slice(0,6); }
}
async function pipedInstances() {
  let list=PI_FALLBACK.slice();
  try {
    const response=await fetch('https://raw.githubusercontent.com/TeamPiped/documentation/main/content/docs/public-instances/index.md',{signal:AbortSignal.timeout(5000)});
    if(response.ok){const body=await response.text();const found=[...body.matchAll(/https:\/\/[a-z0-9.-]+(?=\s+\|)/gi)].map(x=>x[0]);if(found.length)list=[...found,...list];}
  } catch {}
  return [...new Set(list)].slice(0,6);
}
async function firstWorking(bases, makeRequest) {
  const results=await Promise.allSettled(bases.map(base=>makeRequest(base)));
  const found=results.find(x=>x.status==='fulfilled'&&x.value);
  if(found)return found.value;
  throw new Error('All public video instances failed');
}
async function searchVideos(q,page) {
  try {
    return await firstWorking(await invidiousInstances(),async base=>{
      const data=await getJson(base+'/api/v1/search?'+new URLSearchParams({q,page:String(page),type:'video',sort:'relevance',region:'US',hl:'en'}),5000);
      return Array.isArray(data)&&data.length?{items:data,provider:'Invidious',base}:null;
    });
  } catch {}
  return firstWorking(await pipedInstances(),async base=>{
    const data=await getJson(base+'/search?'+new URLSearchParams({q,filter:'videos'}),5000);
    const items=Array.isArray(data)?data:(data.items||[]);
    return items.length?{items,provider:'Piped',base}:null;
  });
}
async function videoDetails(id) {
  try {
    return await firstWorking(await invidiousInstances(),async base=>({
      video:await getJson(base+'/api/v1/videos/'+encodeURIComponent(id)+'?hl=en',5000),provider:'Invidious',base
    }));
  } catch {}
  return firstWorking(await pipedInstances(),async base=>({
    video:await getJson(base+'/streams/'+encodeURIComponent(id),5000),provider:'Piped',base
  }));
}
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));}
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname==='/api/suggest') {
    try {
      const q=(url.searchParams.get('q')||'').trim().slice(0,100);
      if(q.length<2) return sendJson(res,200,{suggestions:[]});
      const data=await getJson('https://suggestqueries.google.com/complete/search?'+new URLSearchParams({client:'firefox',ds:'yt',q}),5000);
      return sendJson(res,200,{suggestions:Array.isArray(data[1])?data[1].slice(0,10):[]});
    } catch(e) { return sendJson(res,200,{suggestions:[]}); }
  }
async function playbackSources(id) {
  try {
    return await firstWorking(await invidiousInstances(), async base => {
      const data = await getJson(base+'/api/v1/videos/'+encodeURIComponent(id)+'?hl=en',6500);
      const streams = (data.formatStreams || [])
        .filter(x => x && x.url && String(x.type || x.mimeType || '').toLowerCase().includes('video/mp4'))
        .map(x => ({url:x.url,label:x.qualityLabel || x.quality || 'MP4',type:x.type || x.mimeType || 'video/mp4',provider:'Invidious'}));
      return streams.length ? {provider:'Invidious',base,streams} : null;
    });
  } catch {}
  return firstWorking(await pipedInstances(), async base => {
    const data = await getJson(base+'/streams/'+encodeURIComponent(id),6500);
    const streams = (data.videoStreams || [])
      .filter(x => x && x.url && !x.videoOnly && String(x.mimeType || '').includes('video/mp4'))
      .map(x => ({url:x.url,label:x.quality || (x.height ? x.height+'p' : 'MP4'),type:x.mimeType || 'video/mp4',provider:'Piped'}));
    return streams.length ? {provider:'Piped',base,streams} : null;
  });
}
  if(url.pathname==='/api/search' || url.pathname.startsWith('/api/video/') || url.pathname.startsWith('/api/playback/')) {
    try {
      if(url.pathname.startsWith('/api/playback/')) {
        const id=decodeURIComponent(url.pathname.slice('/api/playback/'.length));
        if(!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return sendJson(res,400,{error:'Invalid video ID'});
        return sendJson(res,200,await playbackSources(id));
      }
      if(url.pathname==='/api/search') {
        const q=(url.searchParams.get('q')||'').trim().slice(0,200);
        if(!q) return sendJson(res,400,{error:'Search query required'});
        const page=Math.max(1,Math.min(20,Number(url.searchParams.get('page'))||1));
        return sendJson(res,200,await searchVideos(q,page));
      }
      const id=decodeURIComponent(url.pathname.slice('/api/video/'.length));
      if(!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return sendJson(res,400,{error:'Invalid video ID'});
      return sendJson(res,200,await videoDetails(id));
    } catch(e) { return sendJson(res,502,{error:'Video providers unavailable',detail:String(e.message||e)}); }
  }
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  let file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden');}
  try { if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html'); } catch { file=path.join(root,'index.html'); }
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  const ext=path.extname(file);
  const cacheControl=(ext==='.html'||ext==='.js'||ext==='.css')?'no-store':'public, max-age=3600';
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':cacheControl,'X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
});
const port=Number(process.env.PORT)||10000;
server.listen(port,'0.0.0.0',()=>console.log('NERO Tube listening on '+port));
