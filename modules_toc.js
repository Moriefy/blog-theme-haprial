// toc.js — TOC management (build, highlight, drawer)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

H.setTocHighlight = function(id){
  if(H.state.lastActiveId === id) return;
  H.state.lastActiveId = id;
  var tocList = H.el.tocList, tocDrawerList = H.el.tocDrawerList, tocSheet = H.el.tocSheet;
  var items = tocList.children;
  for(var i=0;i<items.length;i++){ var it=items[i]; it.classList.toggle('active', it.dataset.target===id) }
  var dItems = tocDrawerList.children;
  for(var i=0;i<dItems.length;i++){ var di=dItems[i]; di.classList.toggle('active', di.dataset.target===id) }
  if(!tocSheet.classList.contains('open')) return;
  var activeDrawer = tocDrawerList.querySelector('.active');
  if(activeDrawer){
    var dTop = activeDrawer.offsetTop, dsTop = tocDrawerList.scrollTop, dH = tocDrawerList.clientHeight;
    if(dTop<dsTop || dTop+activeDrawer.offsetHeight>dsTop+dH) tocDrawerList.scrollTop = dTop-dH/3;
  }
};

H.lockTocManual = function(){
  H.state.tocManualLock = true;
  clearTimeout(H.state.tocManualTimer);
  H.state.tocManualTimer = setTimeout(function(){ H.state.tocManualLock = false },3000);
};

H.buildTOC = function(){
  var tocList = H.el.tocList, tocDrawerList = H.el.tocDrawerList, articleBody = H.el.articleBody;
  tocList.innerHTML = ''; tocDrawerList.innerHTML = '';
  H.state.headingCache = null; H.state.lastActiveId = null;
  var heads = articleBody.querySelectorAll('h2,h3');
  heads.forEach(function(h){
    var li = document.createElement('li');
    li.className = 'toc-item'; li.dataset.target = h.id;
    li.innerHTML = '<a class="toc-link'+(h.tagName==='H3'?' sub':'')+'">'+h.textContent+'</a>';
    tocList.appendChild(li);
    li.addEventListener('click',function(){
      H.lockTocManual(); H.setTocHighlight(h.id);
      H.el.articleView.scrollTo({top:h.offsetTop-80, behavior:'smooth'});
    });
    var di = document.createElement('li');
    di.className = 'toc-drawer-item'+(h.tagName==='H3'?' sub':'');
    di.textContent = h.textContent; di.dataset.target = h.id;
    tocDrawerList.appendChild(di);
    di.addEventListener('click',function(){
      H.closeTocSheet(); H.lockTocManual(); H.setTocHighlight(h.id);
      H.el.articleView.scrollTo({top:h.offsetTop-80, behavior:'smooth'});
    });
  });
  H.cacheHeadings();
  if(H.state.headingCache.length) H.setTocHighlight(H.state.headingCache[0].id);
};

H.cacheHeadings = function(){
  H.state.headingCache = [];
  H.el.articleBody.querySelectorAll('h2,h3').forEach(function(h){
    H.state.headingCache.push({id:h.id, top:h.offsetTop});
  });
  H.state._headingCacheDirty = false;
};

H.invalidateHeadingCache = function(){ H.state._headingCacheDirty = true };

H.updateTOCHighlight = function(){
  if(H.state.tocManualLock || !H.state.headingCache || !H.state.headingCache.length) return;
  if(H.state._headingCacheDirty) H.cacheHeadings();
  var st = H.el.articleView.scrollTop;
  if(st<100) return;
  var target = st+120;
  var best = null;
  for(var i=0;i<H.state.headingCache.length;i++){
    if(H.state.headingCache[i].top<=target) best = H.state.headingCache[i];
    else break;
  }
  if(best && best.id !== H.state.lastActiveId) H.setTocHighlight(best.id);
};

H.openTocSheet = function(){
  H.el.tocSheet.classList.add('open');
  setTimeout(function(){ document.addEventListener('click',H.tocOutClick) },10);
  var active = H.el.tocDrawerList.querySelector('.toc-drawer-item.active');
  if(active) H.el.tocDrawerList.scrollTop = active.offsetTop - H.el.tocDrawerList.clientHeight/3;
};

H.closeTocSheet = function(){
  H.el.tocSheet.classList.remove('open');
  document.removeEventListener('click',H.tocOutClick);
};

H.tocOutClick = function(e){
  if(!e.target.closest('.toc-drawer') && e.target!==H.el.tocToggleBtn && !H.el.tocToggleBtn.contains(e.target)) H.closeTocSheet();
};

})();
