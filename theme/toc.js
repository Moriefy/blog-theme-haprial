// toc.js — TOC management (build, highlight, drawer)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

// ── Highlight a TOC item ────────────────────────────────────────────────
H.setTocHighlight = function(id){
  if(H.state.lastActiveId === id) return;
  H.state.lastActiveId = id;
  var tocList = H.el.tocList, tocDrawerList = H.el.tocDrawerList, tocSheet = H.el.tocSheet;
  var items = tocList.children;
  for(var i=0;i<items.length++){ var it=items[i]; it.classList.toggle('active', it.dataset.target===id) }
  var dItems = tocDrawerList.children;
  for(var i=0;i<dItems.length;i++){ var di=dItems[i]; di.classList.toggle('active', di.dataset.target===id) }
  if(!tocSheet.classList.contains('open')) return;
  var activeDrawer = tocDrawerList.querySelector('.active');
  if(activeDrawer){
    var dTop = activeDrawer.offsetTop, dsTop = tocDrawerList.scrollTop, dH = tocDrawerList.clientHeight;
    if(dTop<dsTop || dTop+activeDrawer.offsetHeight>dsTop+dH) tocDrawerList.scrollTop = dTop-dH/3;
  }
};

// ── Manual lock (after clicking a TOC item) ─────────────────────────────
H.lockTocManual = function(){
  H.state.tocManualLock = true;
  clearTimeout(H.state.tocManualTimer);
  H.state.tocManualTimer = setTimeout(function(){ H.state.tocManualLock = false }, 2500);
};

// ── Build TOC from article headings ─────────────────────────────────────
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

// ── Cache heading positions (offsetTop relative to articleBody) ─────────
H.cacheHeadings = function(){
  H.state.headingCache = [];
  H.el.articleBody.querySelectorAll('h2,h3').forEach(function(h){
    H.state.headingCache.push({id:h.id, top:h.offsetTop, tag:h.tagName});
  });
  H.state._headingCacheDirty = false;
};

H.invalidateHeadingCache = function(){ H.state._headingCacheDirty = true };

// ── Update TOC highlight on scroll ──────────────────────────────────────
// Logic:
//   1. The "judgment line" is scrollTop + TOP_OFFSET (120px, below the app bar)
//   2. Among all headings whose top <= judgment line, pick the last one
//   3. Edge case: scrollTop is small → highlight first heading
//   4. Edge case: near bottom → if last heading is below judgment line, force highlight it
H.updateTOCHighlight = function(){
  if(H.state.tocManualLock) return;
  var cache = H.state.headingCache;
  if(!cache || !cache.length) return;
  if(H.state._headingCacheDirty) H.cacheHeadings();

  var view = H.el.articleView;
  var st = view.scrollTop;
  var viewH = view.clientHeight;
  var scrollMax = view.scrollHeight - viewH;
  var TOP_OFFSET = 120; // below the app bar

  // Edge: at the very top → first heading
  if(st < 80){
    H.setTocHighlight(cache[0].id);
    return;
  }

  // Edge: at the very bottom → last heading
  // (the last heading may have scrolled past the judgment line)
  if(scrollMax > 0 && st >= scrollMax - 10){
    H.setTocHighlight(cache[cache.length-1].id);
    return;
  }

  // Normal: find the last heading whose top <= judgment line
  var judgmentLine = st + TOP_OFFSET;
  var best = null;
  for(var i = 0; i < cache.length; i++){
    if(cache[i].top <= judgmentLine) best = cache[i];
    else break;
  }

  // If no heading is above the judgment line (all headings are below),
  // this shouldn't normally happen after scrolling past 80px, but handle it:
  if(!best) best = cache[0];

  if(best.id !== H.state.lastActiveId) H.setTocHighlight(best.id);
};

// ── TOC drawer sheet ────────────────────────────────────────────────────
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
