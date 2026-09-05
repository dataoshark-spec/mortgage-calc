/* 物件總覽 2026.09.05C：成功載入完整新版後才啟用，離線保留正常頁面。 */
const VERSION="20260905C";
const SCOPE=new URL(self.registration.scope);
const PREFIX="property-app-shell:"+encodeURIComponent(SCOPE.pathname)+":";
const CACHE=PREFIX+VERSION;
const SHELL=["./","./index.html","./icon-180.png?v="+VERSION,"./icon-192.png?v="+VERSION,"./icon-512.png?v="+VERSION];
self.addEventListener("install",e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=="GET" || url.origin!==SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname))return;
 const isPage=req.mode==="navigate";
 const file=url.pathname.slice(SCOPE.pathname.length);
 if(!isPage && !["index.html","icon-180.png","icon-192.png","icon-512.png"].includes(file))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),6000);
  let response=null;
  try{
   response=await fetch(req,{signal:ctrl.signal});
   if(response.ok && response.type!=="opaque"){
    const copy=response.clone();
    e.waitUntil(cache.put(req,copy).catch(()=>{}));
    return response;
   }
  }catch(err){}finally{clearTimeout(timer)}
  const hit=await cache.match(req);
  if(hit && hit.ok)return hit;
  if(isPage){
   const page=await cache.match("./index.html");
   if(page && page.ok)return page;
  }
  if(response)return response;
  return new Response(isPage?"目前無法連線，請連上網路後重新開啟物件總覽。":"Resource unavailable",
   {status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
 })());
});

