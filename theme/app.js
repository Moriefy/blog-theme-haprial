(function(){
'use strict';

if('scrollRestoration' in history)history.scrollRestoration='manual';var scrollPos=0,codeProcessed=false,currentPage='articles',pageScrollPos={},skipClear=false;
var headingCache=null,lastActiveId=null,scrollRaf=null,artScrollRaf=null,resizeTimer=null,tocBuildTimer=null;
var paginationPage=0,savedPaginationPage=0,perPage=6;
var currentArticleId=null,isSwitchingArticle=false;
var searchTimer=null;
var tocManualLock=false,tocManualTimer=null;
var articleOrder=window.__HAPRIAL_DATA__.articleOrder;
var activeFilterLabel='',activeFilterFn=null;
var searchActiveIdx=-1;
var reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
var isLowEnd=reducedMotion||(navigator.deviceMemory&&navigator.deviceMemory<=2);
var isReload=false;
try{var ne=performance.getEntriesByType('navigation');isReload=ne.length>0&&ne[0].type==='reload'}catch(e){}

var $=function(id){return document.getElementById(id)};
var topAppBar=$('topAppBar'),articleView=$('articleView'),articleBody=$('articleBody'),
    rprog=$('rprog'),avBar=$('avBar'),searchView=$('searchView'),svInput=$('svInput'),
    svResults=$('svResults'),fab=$('fab'),toc=$('toc'),tocList=$('tocList'),
    filterBar=$('filterBar'),filterLabel=$('filterLabel'),tabBar=$('tabBar'),
    tocSheet=$('tocSheet'),tocDrawerList=$('tocDrawerList'),tocToggleBtn=$('tocToggleBtn'),
    pagination=$('pagination'),fabComment=$('fabComment');
var tabOrder=['articles','tags','categories','archive','friends','about'];
var seoTitles={'articles':window.__HAPRIAL_DATA__.siteTitle,'tags':'标签 | '+window.__HAPRIAL_DATA__.siteTitle,'categories':'分类 | '+window.__HAPRIAL_DATA__.siteTitle,'archive':'归档 | '+window.__HAPRIAL_DATA__.siteTitle,'friends':'友链 | '+window.__HAPRIAL_DATA__.siteTitle,'about':'关于 | '+window.__HAPRIAL_DATA__.siteTitle};
var metaDesc=document.querySelector('meta[name="description"]');
var ogTitle=document.querySelector('meta[property="og:title"]');
var ogDesc=document.querySelector('meta[property="og:description"]');
var linkCanon=document.querySelector('link[rel="canonical"]');
var icons={chevL:'<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',chevR:'<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',back:'<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',fwd:'<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',check:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'};

var _lastElevated=null,_lastFab=null,_lastArtScrolled=null,_lastArtFab=null;var _fabIdleTimer=null;

var allTags=window.__HAPRIAL_DATA__.allTags;
var cats=window.__HAPRIAL_DATA__.cats;
var catMap=window.__HAPRIAL_DATA__.catMap;
var friends=window.__HAPRIAL_DATA__.friends;
var articles=window.__HAPRIAL_DATA__.articles;
var catNameMap={};cats.forEach(function(c){catNameMap[c.f]=c.n});

var slugToId={};
(function(){for(var id in articles)slugToId[articles[id].dateISO.replace(/-/g,'')]=id})();
function buildSlug(id){var a=articles[id];return a?a.dateISO.replace(/-/g,''):''}
function lockBody(){var sw=innerWidth-document.documentElement.clientWidth;document.body.style.paddingRight=sw>0?sw+'px':'';document.body.classList.add('locked')}
function unlockBody(){document.body.classList.remove('locked');document.body.style.paddingRight=''}
function copyText(t){if(navigator.clipboard&&isSecureContext){navigator.clipboard.writeText(t);return}var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function getAllCards(){return [].slice.call(document.querySelectorAll('.card'))}
var prismLoaded=false;
function revealImages(){articleBody.querySelectorAll('img').forEach(function(img){if(img.classList.contains('revealed'))return;if(reducedMotion){img.style.opacity='1';img.style.transform='';img.classList.add('revealed');return}if(img.complete&&img.naturalWidth>0){img.classList.add('revealed');return}img.addEventListener('load',function(){setTimeout(function(){img.classList.add('revealed')},60)},{once:true});img.addEventListener('error',function(){img.style.opacity='1';img.style.transform='';img.classList.add('revealed')},{once:true})})}
var imgObserver=null;
function observeImages(){if(imgObserver)imgObserver.disconnect();if(reducedMotion){articleBody.querySelectorAll('img').forEach(function(img){img.classList.add('revealed')});return}imgObserver=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){var img=entry.target;imgObserver.unobserve(img);if(img.complete&&img.naturalWidth>0){setTimeout(function(){img.classList.add('revealed')},60)}}})},{root:articleView,rootMargin:'100px',threshold:0.05});articleBody.querySelectorAll('img:not(.revealed)').forEach(function(img){imgObserver.observe(img)})}

function processCodeBlocks(){if(codeProcessed)return;codeProcessed=true;var pres=articleBody.querySelectorAll('pre');if(!pres.length)return;if(!document.querySelector('link[href*="prism-tomorrow"]')){var cb=document.createElement('link');cb.rel='stylesheet';cb.href='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';document.head.appendChild(cb)}function transformOne(pre){if(pre.closest('.code-block'))return;var code=pre.querySelector('code'),text=code?code.textContent:pre.textContent;text=text.replace(/^\n+/,'').replace(/\n+$/,'');var lines=text.split('\n');var lm=code?code.className.match(/language-(\w+)/):null,lang=lm?lm[1]:'code';var w=document.createElement('div');w.className='code-block';var bar=document.createElement('div');bar.className='cb-bar';bar.innerHTML='<span class="cb-lang">'+lang+'</span><button class="cb-copy" type="button" aria-label="复制代码">'+icons.copy+'</button>';var body=document.createElement('div');body.className='cb-body';var lnDiv=document.createElement('div');lnDiv.className='cb-lines';var lh='';for(var j=0;j<lines.length;j++)lh+='<span>'+(j+1)+'</span>';lnDiv.innerHTML=lh;var sep=document.createElement('div');sep.className='cb-sep';var preW=document.createElement('div');preW.className='cb-pre-wrap';var np=document.createElement('pre');np.className='language-'+lang;var nc=document.createElement('code');nc.className='language-'+lang;nc.textContent=lines.join('\n');np.appendChild(nc);preW.appendChild(np);body.appendChild(lnDiv);body.appendChild(sep);body.appendChild(preW);w.appendChild(bar);w.appendChild(body);pre.parentNode.replaceChild(w,pre);if(typeof Prism!=='undefined'&&window.Prism)try{Prism.highlightElement(nc)}catch(e){}}function batchTransform(list,idx){if(idx>=list.length)return;var deadline=window.requestIdleCallback?undefined:1;function run(dl){transformOne(list[idx]);if(idx+1<list.length){if(window.requestIdleCallback)window.requestIdleCallback(run,{timeout:100});else setTimeout(function(){batchTransform(list,idx+1)},0)}}if(window.requestIdleCallback)window.requestIdleCallback(run,{timeout:100});else setTimeout(function(){run()},0)}if(prismLoaded){batchTransform(pres,0);return}prismLoaded=true;var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';s.setAttribute('data-manual','');s.onload=function(){if(typeof Prism!=='undefined')batchTransform(pres,0)};document.head.appendChild(s)}
function setPageStagger(pid){}

var pageHash={'/':'articles','/tags':'tags','/categories':'categories','/archive':'archive','/friends':'friends','/about':'about'};
var hashPage={articles:'/',tags:'/tags',categories:'/categories',archive:'/archive',friends:'/friends',about:'/about'};
function routeToHash(r){if(r.type==='article')return '#/posts/'+buildSlug(r.articleId);var page=r.page||'articles';if(page==='articles'){if(r.paginationPage>0)return '#/page/'+(r.paginationPage+1);return '#/'}return '#'+(hashPage[page]||'/')}
function parseHash(){var h=(location.hash||'').replace(/^#/,'')||'/';if(h==='/')return{type:'page',page:'articles'};var am=h.match(/^\/posts\/(\d{8})$/);if(am&&slugToId[am[1]])return{type:'article',articleId:slugToId[am[1]]};var pm=h.match(/^\/page\/(\d+)$/);if(pm)return{type:'page',page:'articles',paginationPage:parseInt(pm[1])-1};return{type:'page',page:pageHash[h]||'articles'}}
function pushRoute(r){history.pushState(r,'',routeToHash(r));updateSEO(r)}
function replaceRoute(r){history.replaceState(r,'',routeToHash(r));updateSEO(r)}
function updateSEO(r){if(r.type==='article'){var a=articles[r.articleId];if(a){document.title=a.title+' | '+window.__HAPRIAL_DATA__.siteTitle;if(metaDesc)metaDesc.content=a.excerpt;if(ogTitle)ogTitle.content=a.title;if(ogDesc)ogDesc.content=a.excerpt;addJsonLd(a)}}else{document.title=seoTitles[r.page]||window.__HAPRIAL_DATA__.siteTitle;if(metaDesc)metaDesc.content=window.__HAPRIAL_DATA__.siteTitle;removeJsonLd()}if(linkCanon)linkCanon.href=location.href}
function addJsonLd(a){removeJsonLd();var s=document.createElement('script');s.type='application/ld+json';s.id='artld';s.textContent=JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":a.title,"description":a.excerpt,"datePublished":a.dateISO,"author":{"@type":"Person","name":window.__HAPRIAL_DATA__.siteAuthor}});document.head.appendChild(s)}
function removeJsonLd(){var o=document.getElementById('artld');if(o)o.remove()}
var lastRouteWasArticle=false;
function applyRoute(route){if(!route)route={type:'page',page:'articles'};var artOpen=articleView.classList.contains('open');if(route.type==='article'){lastRouteWasArticle=true;if(artOpen&&route.articleId===currentArticleId){updateSEO(route);return}if(!artOpen)openArticleVisual(route.articleId);else{var dir=articleOrder.indexOf(route.articleId)<articleOrder.indexOf(currentArticleId)?'next':'prev';switchToArticleVisual(route.articleId,dir)}}else{if(artOpen)closeArticleVisual();if(lastRouteWasArticle&&route.page==='articles'){lastRouteWasArticle=false;syncTabs('articles');updateSEO(route);return}lastRouteWasArticle=false;if(route.page!==currentPage){var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(route.page);switchPageVisual(route.page,ni>oi?'right':'left')}else syncTabs(route.page);if(route.page==='articles'&&route.paginationPage!=null){paginationPage=route.paginationPage;renderPaginationPage()}}updateSEO(route)}

function renderPaginationPage(noStagger){var all=getAllCards(),cards=all.filter(function(c){return c.dataset._filtered!=='1'});var total=Math.ceil(cards.length/perPage);if(total<1)total=1;if(paginationPage>=total)paginationPage=total-1;if(paginationPage<0)paginationPage=0;try{sessionStorage.setItem('pg',paginationPage)}catch(e){}var start=paginationPage*perPage,end=start+perPage,i,ci=0;var cardsState=[];for(i=0;i<all.length;i++){var c=all[i],isFiltered=c.dataset._filtered==='1',inPage=false;if(!isFiltered){inPage=ci>=start&&ci<end;ci++}cardsState.push({el:c,filtered:isFiltered,show:inPage})}for(i=0;i<cardsState.length;i++){var s=cardsState[i];s.el.style.display=s.filtered?'none':'';if(s.show)s.el.classList.add('show');else s.el.classList.remove('show')}var noR=$('noResults');if(!cards.length){noR.classList.add('show');pagination.innerHTML='';pagination.classList.remove('show');return}noR.classList.remove('show');if(total>1){var h='<button class="pg-btn"'+(paginationPage===0?' disabled':'')+' data-pg="prev" aria-label="上一页">'+icons.chevL+'</button>';for(var i=0;i<total;i++)h+='<button class="pg-btn'+(i===paginationPage?' active':'')+'" data-pg="'+i+'" aria-label="第'+(i+1)+'页">'+(i+1)+'</button>';h+='<button class="pg-btn"'+(paginationPage===total-1?' disabled':'')+' data-pg="next" aria-label="下一页">'+icons.chevR+'</button>';pagination.innerHTML=h;pagination.classList.add('show')}else{pagination.innerHTML='<span style="font-size:13px;color:var(--outline)">共 '+cards.length+' 篇文章</span>';pagination.classList.add('show')}}
function renderAllCards(){getAllCards().forEach(function(c){c.dataset._filtered='';c.style.display='';c.classList.remove('show')})}

function setTocHighlight(id){lastActiveId=id;var items=tocList.children;for(var i=0;i<items.length;i++){var it=items[i];it.classList.toggle('active',it.dataset.target===id)}var dItems=tocDrawerList.children;for(var i=0;i<dItems.length;i++){var di=dItems[i];di.classList.toggle('active',di.dataset.target===id)}var activeItem=tocList.querySelector('.active');if(activeItem){var aTop=activeItem.offsetTop,sTop=toc.scrollTop,cH=toc.clientHeight;if(aTop<sTop||aTop+activeItem.offsetHeight>sTop+cH){toc.scrollTop=aTop-cH/2}}if(tocSheet.classList.contains('open')){var activeDrawer=tocDrawerList.querySelector('.active');if(activeDrawer){var dTop=activeDrawer.offsetTop,dsTop=tocDrawerList.scrollTop,dH=tocDrawerList.clientHeight;if(dTop<dsTop||dTop+activeDrawer.offsetHeight>dsTop+dH){tocDrawerList.scrollTop=dTop-dH/3}}}}
function lockTocManual(){tocManualLock=true;clearTimeout(tocManualTimer);tocManualTimer=setTimeout(function(){tocManualLock=false},3000)}
function buildTOC(){tocList.innerHTML='';tocDrawerList.innerHTML='';headingCache=null;lastActiveId=null;var heads=articleBody.querySelectorAll('h2,h3');heads.forEach(function(h){var li=document.createElement('li');li.className='toc-item';li.dataset.target=h.id;li.innerHTML='<a class="toc-link'+(h.tagName==='H3'?' sub':'')+'">'+h.textContent+'</a>';tocList.appendChild(li);li.addEventListener('click',function(){lockTocManual();setTocHighlight(h.id);articleView.scrollTo({top:h.offsetTop-80,behavior:'smooth'})});var di=document.createElement('li');di.className='toc-drawer-item'+(h.tagName==='H3'?' sub':'');di.textContent=h.textContent;di.dataset.target=h.id;tocDrawerList.appendChild(di);di.addEventListener('click',function(){closeTocSheet();lockTocManual();setTocHighlight(h.id);articleView.scrollTo({top:h.offsetTop-80,behavior:'smooth'})})});cacheHeadings();if(headingCache.length)setTocHighlight(headingCache[0].id)}
function cacheHeadings(){headingCache=[];articleBody.querySelectorAll('h2,h3').forEach(function(h){headingCache.push({id:h.id})})}
function updateTOCHighlight(){if(tocManualLock||!headingCache||!headingCache.length)return;var st=articleView.scrollTop,maxS=articleView.scrollHeight-articleView.clientHeight;if(maxS<100)return;var curId=null;for(var i=headingCache.length-1;i>=0;i--){var el=document.getElementById(headingCache[i].id);if(el&&el.offsetTop<=st+120){curId=headingCache[i].id;break}}if(!curId&&st>=maxS-30)curId=headingCache[headingCache.length-1].id;if(!curId)curId=headingCache[0].id;if(curId!==lastActiveId)setTocHighlight(curId)}
function openTocSheet(){tocSheet.classList.add('open');setTimeout(function(){document.addEventListener('click',tocOutClick)},10);var active=tocDrawerList.querySelector('.toc-drawer-item.active');if(active){tocDrawerList.scrollTop=active.offsetTop-tocDrawerList.clientHeight/3}}
function closeTocSheet(){tocSheet.classList.remove('open');document.removeEventListener('click',tocOutClick)}
function tocOutClick(e){if(!e.target.closest('.toc-drawer')&&e.target!==tocToggleBtn&&!tocToggleBtn.contains(e.target))closeTocSheet()}
function renderArticleNav(id){var idx=articleOrder.indexOf(String(id)),nav=$('artNav'),html='';if(idx>0){var n=articles[articleOrder[idx-1]];if(n)html+='<button class="art-nav-btn prev" data-nav-id="'+articleOrder[idx-1]+'"><span class="art-nav-icon">'+icons.back+'</span><div class="art-nav-info"><div class="art-nav-label">'+escHtml(n.date)+'</div><div class="art-nav-title">'+escHtml(n.title)+'</div></div></button>'}if(idx<articleOrder.length-1){var p=articles[articleOrder[idx+1]];if(p)html+='<button class="art-nav-btn next" data-nav-id="'+articleOrder[idx+1]+'"><div class="art-nav-info"><div class="art-nav-label">'+escHtml(p.date)+'</div><div class="art-nav-title">'+escHtml(p.title)+'</div></div><span class="art-nav-icon">'+icons.fwd+'</span></button>'}nav.innerHTML=html;requestAnimationFrame(function(){nav.classList.add('revealed')})}

var __twikooLoaded=false;
var __friendsTwikooLoaded=false;
function __initFriendsTwikoo(){
  var envId=window.__HAPRIAL_DATA__.twikooEnvId;
  if(!envId||__friendsTwikooLoaded)return;
  var el=document.getElementById('tcomment-friends');
  if(!el)return;
  __friendsTwikooLoaded=true;
  function doInit(){if(typeof twikoo!=='undefined'){try{twikoo.init({envId:envId,el:'#tcomment-friends',path:'/friends/'})}catch(e){}}}
  var obs=new IntersectionObserver(function(entries){
    if(entries[0].isIntersecting){obs.disconnect();
      if(__twikooLoaded){doInit();return}
      __twikooLoaded=true;
      var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/twikoo@1.6.40/dist/twikoo.all.min.js';s.onload=doInit;document.head.appendChild(s);
    }
  },{rootMargin:'200px'});
  obs.observe(el);
}
function __initTwikoo(path){
  var envId=window.__HAPRIAL_DATA__.twikooEnvId;
  if(!envId)return;
  var section=document.getElementById('commentSection');
  if(!section)return;
  section.innerHTML='<div id="tcomment"></div>';
  function doInit(){
    if(typeof twikoo!=='undefined'){
      try{twikoo.init({envId:envId,el:'#tcomment',path:path})}catch(e){}
    }
  }
  if(typeof twikoo!=='undefined'){
    doInit();
  }else if(!__twikooLoaded){
    __twikooLoaded=true;
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/twikoo@1.6.40/dist/twikoo.all.min.js';
    s.onload=doInit;
    document.head.appendChild(s);
  }
}
function loadArticleMeta(id){var art=articles[id];if(!art)return;currentArticleId=id;$('artMeta').innerHTML='<span>'+art.date+'</span><span style="color:var(--outline-variant)"> · </span><span>'+art.wc+' 字</span><span style="color:var(--outline-variant)"> · </span><span>'+art.rt+'</span>';$('artTitle').textContent=art.title;$('artTags').innerHTML=art.tags.map(function(t){return'<span class="tag" data-tagname="'+escHtml(t)+'">'+escHtml(t)+'</span>'}).join('');renderArticleNav(id)}
function loadArticle(id){var art=articles[id];if(!art)return;loadArticleMeta(id);rprog.style.transform='scaleX(0)';fab.classList.remove('visible');articleView.scrollTop=0;headingCache=null;lastActiveId=null;tocManualLock=false;clearTimeout(tocManualTimer);clearTimeout(tocBuildTimer);_lastArtScrolled=null;_lastArtFab=null;articleBody.innerHTML=art.content||'';articleBody.classList.remove('revealed');codeProcessed=false;processCodeBlocks();revealImages();observeImages();requestAnimationFrame(function(){articleBody.classList.add('revealed')});tocBuildTimer=setTimeout(buildTOC,80);__initTwikoo('/posts/'+id+'/')}
function openArticleVisual(id){scrollPos=window.scrollY;loadArticle(id);lockBody();requestAnimationFrame(function(){articleView.classList.add('open')});avBar.classList.remove('scrolled');fabComment.classList.add('visible');fabComment.classList.remove('shifted')}
function openArticleVisualImmediate(id){loadArticle(id);lockBody();articleView.style.transition='none';articleView.classList.add('open');articleView.offsetHeight;requestAnimationFrame(function(){articleView.style.transition=''});avBar.classList.remove('scrolled');fabComment.classList.add('visible');fabComment.classList.remove('shifted')}
function switchToArticleVisual(nid,dir){if(isSwitchingArticle)return;isSwitchingArticle=true;var ac=$('avContent'),dx=dir==='next'?-16:16;ac.style.transition='opacity 160ms cubic-bezier(.4,0,1,1),transform 160ms cubic-bezier(.4,0,1,1)';ac.style.opacity='0';ac.style.transform='translateX('+dx+'px)';ac.addEventListener('transitionend',function handler(){ac.removeEventListener('transitionend',handler);ac.style.transition='none';ac.style.transform='translateX('+(-dx)+'px)';loadArticle(nid);requestAnimationFrame(function(){ac.style.transition='opacity 240ms cubic-bezier(0,0,.2,1),transform 240ms cubic-bezier(0,0,.2,1)';ac.style.opacity='1';ac.style.transform='translateX(0)';ac.addEventListener('transitionend',function handler2(){ac.removeEventListener('transitionend',handler2);ac.style.transition='';ac.style.opacity='';ac.style.transform='';isSwitchingArticle=false},{once:true})})},{once:true})}
function closeArticleVisual(){if(!articleView.classList.contains('open'))return;articleView.classList.remove('open');closeTocSheet();unlockBody();var af=document.getElementById('anti-fouc');if(af)af.remove();currentArticleId=null;_lastFab=null;fabComment.classList.remove('visible');fabComment.classList.remove('shifted');fab.classList.remove('idle');fabComment.classList.remove('idle');clearTimeout(_fabIdleTimer);lastRouteWasArticle=false;requestAnimationFrame(function(){window.scrollTo(0,scrollPos);topAppBar.classList.toggle('elevated',scrollPos>0);fab.classList.toggle('visible',scrollPos>400)})}
function switchPageVisual(name,dir){pageScrollPos[currentPage]=window.scrollY;if(currentPage==='articles')savedPaginationPage=paginationPage;syncTabs(name);document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active','slide-in-right','slide-in-left')});var el=$('page'+name.charAt(0).toUpperCase()+name.slice(1));if(el){if(dir&&!reducedMotion){var cls=dir==='right'?'slide-in-right':'slide-in-left';el.classList.add('active',cls);var onEnd=function(){el.classList.remove(cls);el.removeEventListener('animationend',onEnd)};el.addEventListener('animationend',onEnd)}else{el.classList.add('active')}}if(name==='articles'){renderAllCards();if(!skipClear){if(activeFilterLabel&&activeFilterFn){getAllCards().forEach(function(c){if(!activeFilterFn(c)){c.dataset._filtered='1';c.style.display='none';c.classList.remove('show')}else{c.dataset._filtered='';c.style.display=''}});filterLabel.textContent=activeFilterLabel;filterBar.classList.add('on');paginationPage=0}else{filterBar.classList.remove('on');filterLabel.textContent='';paginationPage=savedPaginationPage}}else{paginationPage=savedPaginationPage}renderPaginationPage()}currentPage=name;instantScroll(pageScrollPos[name]||0);if(name==='friends')__initFriendsTwikoo()}

articleView.addEventListener('scroll',function(){if(artScrollRaf)return;artScrollRaf=requestAnimationFrame(function(){artScrollRaf=null;var s=articleView.scrollTop,m=articleView.scrollHeight-articleView.clientHeight;rprog.style.transform=m>0?'scaleX('+s/m+')':'scaleX(0)';var sc=s>0;if(sc!==_lastArtScrolled){avBar.classList.toggle('scrolled',sc);_lastArtScrolled=sc}var fv=s>400;if(fv!==_lastArtFab){fab.classList.toggle('visible',fv);fabComment.classList.toggle('shifted',fv);_lastArtFab=fv}clearTimeout(_fabIdleTimer);fab.classList.remove('idle');fabComment.classList.remove('idle');if(innerWidth<=768&&articleView.classList.contains('open')){_fabIdleTimer=setTimeout(function(){if(articleView.classList.contains('open')){fab.classList.add('idle');fabComment.classList.add('idle')}},1000)}updateTOCHighlight()})},{passive:true});

function handleMainScroll(){var y=window.scrollY,el=y>0;if(el!==_lastElevated){topAppBar.classList.toggle('elevated',el);_lastElevated=el}if(!articleView.classList.contains('open')){var fv=y>400;if(fv!==_lastFab){fab.classList.toggle('visible',fv);_lastFab=fv}}}
window.addEventListener('scroll',function(){if(scrollRaf)return;scrollRaf=requestAnimationFrame(function(){scrollRaf=null;handleMainScroll()})},{passive:true});

function openSearch(){searchView.classList.add('open');svInput.value='';svResults.innerHTML='<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>';searchActiveIdx=-1;lockBody();history.pushState({type:'search'},'','#search');setTimeout(function(){svInput.focus()},300)}
function closeSearch(fromPopstate){if(!searchView.classList.contains('open'))return;searchView.classList.remove('open');searchActiveIdx=-1;unlockBody();if(!fromPopstate)history.back()}
function hlMatch(t,q){var s=escHtml(t);if(!q)return s;return s.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark class="hl-match">$1</mark>')}
function filterSearch(q){q=(q||'').toLowerCase().trim();if(!q){svResults.innerHTML='<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>';return}var cards=getAllCards(),html='',found=false;cards.forEach(function(c){var t=c.dataset.title||'',e=c.dataset.excerpt||'',g=c.dataset.tags||'';if(t.toLowerCase().indexOf(q)!==-1||e.toLowerCase().indexOf(q)!==-1||g.toLowerCase().indexOf(q)!==-1){found=true;var tag=c.querySelector('.tag');html+='<div class="sv-item" data-id="'+c.dataset.id+'"><div class="sv-item-tag">'+(tag?tag.textContent:'')+'</div><div class="sv-item-title">'+hlMatch(t,q)+'</div><div class="sv-item-excerpt">'+hlMatch(e,q)+'</div></div>'}});svResults.innerHTML=found?html:'<div class="sv-no-results">未找到相关结果。</div>';svResults.querySelectorAll('.sv-item').forEach(function(el,i){el.style.setProperty('--sd',(i*40)+'ms')});searchActiveIdx=-1}
function updateSearchHighlight(){var items=svResults.querySelectorAll('.sv-item');for(var i=0;i<items.length;i++)items[i].classList.toggle('sv-item-active',i===searchActiveIdx);if(searchActiveIdx>=0&&items[searchActiveIdx])items[searchActiveIdx].scrollIntoView({block:'nearest'})}
svInput.addEventListener('input',function(){clearTimeout(searchTimer);searchActiveIdx=-1;var v=this.value;searchTimer=setTimeout(function(){filterSearch(v)},350)});

function updateTabIndicator(){var a=document.querySelector('.tab.active');if(a&&tabBar){var w=a.offsetWidth;var x=a.offsetLeft;tabBar.style.width=w+'px';tabBar.style.transform='translateX('+x+'px)'}}
function syncTabs(n){document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.dataset.page===n)});updateTabIndicator()}
function applyFilterDirect(label,fn){getAllCards().forEach(function(c){if(!fn(c)){c.dataset._filtered='1';c.style.display='none';c.classList.remove('show')}else{c.dataset._filtered='';c.style.display=''}});filterLabel.textContent=label;filterBar.classList.add('on');paginationPage=0;renderPaginationPage()}
function instantScroll(y){document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,y);document.documentElement.style.scrollBehavior='';_lastElevated=null;_lastFab=null;handleMainScroll()}
function applyFilter(label,fn){activeFilterLabel=label;activeFilterFn=fn;skipClear=true;switchPageVisual('articles','left');skipClear=false;applyFilterDirect(label,fn);instantScroll(0);pushRoute({type:'page',page:'articles'})}
function clearFilter(){activeFilterLabel='';activeFilterFn=null;filterBar.classList.remove('on');filterLabel.textContent='';paginationPage=0;var all=getAllCards();all.forEach(function(c){c.dataset._filtered='';c.style.display='';c.classList.remove('show')});requestAnimationFrame(function(){renderPaginationPage()})}

function renderTags(){$('tagsCount').textContent='共 '+allTags.length+' 个标签';$('tagsGrid').innerHTML=allTags.map(function(t){return'<div class="tag-card" data-tag="'+t.n+'"><div class="tag-card-name">'+t.n+'</div><div class="tag-card-count">'+t.c+' 篇文章</div></div>'}).join('')}
function renderCats(){$('catsCount').textContent='共 '+cats.length+' 个分类';$('catsGrid').innerHTML=cats.map(function(c){return'<div class="cat-card" data-cat="'+c.f+'"><div class="cat-dot" style="background:'+c.col+'"></div><div class="cat-name">'+c.n+'</div><div class="cat-desc">'+c.d+'</div><div class="cat-count">'+c.c+' 篇文章</div></div>'}).join('')}
function renderArchive(){var entries=[];articleOrder.forEach(function(id){var art=articles[id];if(!art)return;var m=art.dateISO.match(/(\d{4})-(\d{2})-(\d{2})/);if(!m)return;entries.push({id:id,year:+m[1],month:+m[2],day:+m[3],title:art.title,tags:art.tags,rt:art.rt,category:art.category})});entries.sort(function(a,b){return(b.year*10000+b.month*100+b.day)-(a.year*10000+a.month*100+a.day)});var grouped={},html='',idx=0;var monthNames={1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};entries.forEach(function(e){if(!grouped[e.year])grouped[e.year]=[];grouped[e.year].push(e)});Object.keys(grouped).sort(function(a,b){return b-a}).forEach(function(y){var items=grouped[y];html+='<div class="archive-year-group"><div class="archive-year-label">'+y+'<span class="archive-year-count">'+items.length+' 篇</span></div>';items.forEach(function(e){var tag=e.tags.length?e.tags[0]:'';html+='<div class="archive-card" data-id="'+e.id+'" style="--arch-d:'+(idx++*50)+'ms"><div class="archive-card-date"><span class="archive-card-month">'+monthNames[e.month]+'</span><span class="archive-card-day">'+e.day+'</span></div><div class="archive-card-body"><div class="archive-card-title">'+escHtml(e.title)+'</div><div class="archive-card-meta">'+(tag?'<span class="archive-card-tag">'+escHtml(tag)+'</span>':'')+'<span class="archive-card-rt">'+e.rt+'</span></div></div></div>'});html+='</div>'});$('archiveCount').textContent='共 '+entries.length+' 篇文章';$('archiveTimeline').innerHTML=html}
function renderFriends(){$('flGrid').innerHTML=friends.map(function(f){return'<a class="fl-card" href="'+escHtml(f.u)+'" target="_blank" rel="noopener"><img class="fl-avatar" src="'+escHtml(f.a)+'" alt="'+escHtml(f.n)+'" width="48" height="48" loading="lazy"><div class="fl-info"><div class="fl-name">'+escHtml(f.n)+'</div><div class="fl-desc">'+escHtml(f.d)+'</div></div></a>'}).join('')}
function createRipple(e,el){if(isLowEnd)return;if(el.querySelectorAll('.ripple').length>3)return;var r=el.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,sp=document.createElement('span');sp.className='ripple';sp.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';el.appendChild(sp);sp.addEventListener('animationend',function(){sp.remove()})}
function syncAllIcons(t){document.querySelectorAll('.theme-wrap').forEach(function(w){var s=w.querySelector('.sun'),m=w.querySelector('.moon');if(t==='dark'){s.classList.add('off');m.classList.remove('off')}else{s.classList.remove('off');m.classList.add('off')}})}
function setTheme(t){var el=document.documentElement;el.classList.add('theme-transitioning');el.setAttribute('data-theme',t);try{localStorage.setItem('th',t)}catch(e){}syncAllIcons(t);setTimeout(function(){el.classList.remove('theme-transitioning')},220)}
function toggleTheme(){var cur=document.documentElement.getAttribute('data-theme')||'light';setTheme(cur==='light'?'dark':'light')}

window.addEventListener('popstate',function(){if(searchView.classList.contains('open')){closeSearch(true);return}var st=history.state;if(!st)st=parseHash();applyRoute(st)});

/* Ripple: cards excluded — they only ripple on click, not pointerdown */
document.addEventListener('pointerdown',function(e){var el=e.target.closest('.icon-btn,.fab,.tab,.tag-card,.cat-card,.fl-card,.filter-clear,.pg-btn,.art-nav-btn,.archive-card,.about-link,.about-skill');if(!el||el.disabled)return;var cs=getComputedStyle(el);if(parseFloat(cs.opacity)<.1)return;createRipple(e,el)},{passive:true});

document.addEventListener('click',function(e){
  var t;
  if((t=e.target.closest('.cb-copy'))){var cd=t.closest('.code-block');cd=cd&&cd.querySelector('code');if(cd){copyText(cd.textContent);t.classList.add('copied');var old=t.innerHTML;t.innerHTML=icons.check;setTimeout(function(){t.innerHTML=old;t.classList.remove('copied')},2000)}return}
  if((t=e.target.closest('.art-nav-btn'))&&t.dataset.navId){var nId=t.dataset.navId,dir=t.classList.contains('next')?'next':'prev';switchToArticleVisual(nId,dir);replaceRoute({type:'article',articleId:nId});return}
  if((t=e.target.closest('#artTags .tag'))&&t.dataset.tagname){var tn=t.dataset.tagname;activeFilterLabel=tn;activeFilterFn=function(c){var tags=(c.dataset.tags||'').split('\u001f');return tags.indexOf(tn)!==-1};closeArticleVisual();if(currentPage!=='articles'){switchPageVisual('articles','left')}replaceRoute({type:'page',page:'articles'});applyFilterDirect(tn,activeFilterFn);window.scrollTo({top:0,behavior:'smooth'});return}
  if((t=e.target.closest('.pg-btn'))&&!t.disabled){var p=t.dataset.pg;if(p==='prev')paginationPage--;else if(p==='next')paginationPage++;else paginationPage=parseInt(p);renderPaginationPage();var list=$('articleList');if(list)list.scrollIntoView({behavior:'smooth',block:'start'});pushRoute({type:'page',page:'articles',paginationPage:paginationPage});return}
  if((t=e.target.closest('.sv-item'))&&t.dataset.id){closeSearch();var sid=t.dataset.id;setTimeout(function(){pushRoute({type:'article',articleId:sid});openArticleVisual(sid)},150);return}
  if((t=e.target.closest('.archive-card'))&&t.dataset.id){createRipple(e,t);pushRoute({type:'article',articleId:t.dataset.id});openArticleVisual(t.dataset.id);return}
  if((t=e.target.closest('.card'))&&t.dataset.id){createRipple(e,t);pushRoute({type:'article',articleId:t.dataset.id});openArticleVisual(t.dataset.id);return}
  if(e.target.closest('#avBack')){if(history.length>1)history.back();else{closeArticleVisual();pushRoute({type:'page',page:'articles'})}return}
  if(e.target.closest('#tocToggleBtn')){tocSheet.classList.contains('open')?closeTocSheet():openTocSheet();return}
  if(e.target.closest('#tocScrim')){closeTocSheet();return}
  if(e.target.closest('#searchBtn')){openSearch();return}
  if(e.target.closest('#svBack')){closeSearch();return}
  if(e.target.closest('#svClear')){svInput.value='';svInput.focus();filterSearch('');return}
  if(e.target.closest('#themeBtn')||e.target.closest('#avThemeBtn')){toggleTheme();return}
  if(e.target.closest('#fab')){if(articleView.classList.contains('open'))articleView.scrollTo({top:0,behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'});return}
  if(e.target.closest('#fabComment')){var cs=$('commentSection');if(cs)articleView.scrollTo({top:cs.offsetTop-64,behavior:'smooth'});return}
  if(e.target.closest('#logoBtn')){activeFilterLabel='';activeFilterFn=null;if(articleView.classList.contains('open')){closeArticleVisual();pushRoute({type:'page',page:'articles'})}else{pushRoute({type:'page',page:'articles'});switchPageVisual('articles','left')}return}
  if((t=e.target.closest('.tab'))&&t.dataset.page){var pg=t.dataset.page;if(pg!==currentPage||articleView.classList.contains('open')){if(articleView.classList.contains('open'))closeArticleVisual();var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(pg);switchPageVisual(pg,ni>oi?'right':'left');pushRoute({type:'page',page:pg})}return}
  if((t=e.target.closest('.footer-link'))&&t.dataset.page){var pg=t.dataset.page;if(pg!==currentPage||articleView.classList.contains('open')){if(articleView.classList.contains('open'))closeArticleVisual();var oi=tabOrder.indexOf(currentPage),ni=tabOrder.indexOf(pg);switchPageVisual(pg,ni>oi?'right':'left');pushRoute({type:'page',page:pg})}return}
  if((t=e.target.closest('.tag-card'))&&t.dataset.tag){applyFilter(t.dataset.tag,function(c){var tags=(c.dataset.tags||'').split('\u001f');return tags.indexOf(t.dataset.tag)!==-1});return}
  if((t=e.target.closest('.cat-card'))&&t.dataset.cat){var cv=t.dataset.cat;applyFilter(catNameMap[cv]||cv,function(c){return catMap[+c.dataset.id]===cv});return}
  if(e.target.closest('#filterClear')){clearFilter();return}

});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(tocSheet.classList.contains('open')){closeTocSheet();return}if(searchView.classList.contains('open')){closeSearch();return}var lb=document.getElementById('lightbox');if(lb&&lb.classList.contains('open')){if(window.__lbClose)window.__lbClose();else{lb.classList.remove('open');document.body.style.overflow=''}return}if(articleView.classList.contains('open')){if(history.length>1)history.back();else{closeArticleVisual();pushRoute({type:'page',page:'articles'})}return}}
  if(searchView.classList.contains('open')){var items=svResults.querySelectorAll('.sv-item');if(e.key==='ArrowDown'){e.preventDefault();if(searchActiveIdx<items.length-1){searchActiveIdx++;updateSearchHighlight()}return}if(e.key==='ArrowUp'){e.preventDefault();if(searchActiveIdx>0){searchActiveIdx--;updateSearchHighlight()}return}if(e.key==='Enter'){e.preventDefault();if(searchActiveIdx>=0&&items[searchActiveIdx]){closeSearch();var sid=items[searchActiveIdx].dataset.id;setTimeout(function(){pushRoute({type:'article',articleId:sid});openArticleVisual(sid)},150)}return}}
  if(articleView.classList.contains('open')&&!searchView.classList.contains('open')){if(e.key==='ArrowRight'){var idx=articleOrder.indexOf(currentArticleId);if(idx<articleOrder.length-1){switchToArticleVisual(articleOrder[idx+1],'next');replaceRoute({type:'article',articleId:articleOrder[idx+1]})}return}if(e.key==='ArrowLeft'){var idx=articleOrder.indexOf(currentArticleId);if(idx>0){switchToArticleVisual(articleOrder[idx-1],'prev');replaceRoute({type:'article',articleId:articleOrder[idx-1]})}return}}
  if(e.key==='/'&&!searchView.classList.contains('open')&&!articleView.classList.contains('open')){e.preventDefault();openSearch()}
});
window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(updateTabIndicator,120)});

var th=null;try{th=localStorage.getItem('th')}catch(e){}if(!th)th=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
document.documentElement.setAttribute('data-theme',th);syncAllIcons(th);
var initRoute=parseHash();
if(initRoute.type==='page'&&initRoute.paginationPage){paginationPage=initRoute.paginationPage}
else{try{var sp=sessionStorage.getItem('pg');if(sp!==null)paginationPage=parseInt(sp)||0}catch(e){}}
renderTags();renderCats();renderArchive();renderFriends();renderPaginationPage();handleMainScroll();requestAnimationFrame(updateTabIndicator);
if(initRoute.type==='article'){if(isReload){replaceRoute(initRoute);openArticleVisualImmediate(initRoute.articleId)}else{replaceRoute({type:'page',page:'articles'});pushRoute(initRoute);requestAnimationFrame(function(){openArticleVisual(initRoute.articleId)})}}else{var af=document.getElementById('anti-fouc');if(af)af.remove();replaceRoute(initRoute);if(initRoute.page&&initRoute.page!=='articles'){switchPageVisual(initRoute.page,null);syncTabs(initRoute.page)}}




// TOC hover — bind/unbind mousemove for zero overhead when article closed
(function(){
  if(!toc||!articleView)return;
  var hideTimer=null, artOpen=false, threshold=9999, thresholdDirty=true;
  function updateThreshold(){var av=document.querySelector('.av-content');if(av)threshold=av.getBoundingClientRect().right;thresholdDirty=false}
  function show(){clearTimeout(hideTimer);toc.classList.add('visible')}
  function scheduleHide(){clearTimeout(hideTimer);hideTimer=setTimeout(function(){toc.classList.remove('visible')},1500)}
  var moveRaf=null;
  function onMove(e){
    if(moveRaf)return;
    moveRaf=requestAnimationFrame(function(){
      moveRaf=null;
      if(thresholdDirty)updateThreshold();
      if(e.clientX>=threshold)show();
      else scheduleHide();
    });
  }
var _moveBound=false;
  function bindMove(){if(!_moveBound){_moveBound=true;document.addEventListener('mousemove',onMove)}}
  function unbindMove(){if(_moveBound){_moveBound=false;document.removeEventListener('mousemove',onMove)}}
  toc.addEventListener('mouseenter',function(){if(artOpen)clearTimeout(hideTimer)});
  toc.addEventListener('mouseleave',function(){if(artOpen)scheduleHide()});
  var _origOpen=openArticleVisual;
  openArticleVisual=function(id){artOpen=true;thresholdDirty=true;bindMove();_origOpen(id)};
  var _origClose=closeArticleVisual;
  closeArticleVisual=function(){artOpen=false;unbindMove();clearTimeout(hideTimer);toc.classList.remove('visible');_origClose()};
  var _origImm=openArticleVisualImmediate;
  openArticleVisualImmediate=function(id){artOpen=true;thresholdDirty=true;bindMove();_origImm(id)};
  window.addEventListener('resize',function(){thresholdDirty=true});
})();
// Initialize lightbox (shared module)
window.__initLightbox(articleBody);

})();
