// events.js — Event delegation (click, keyboard, scroll, resize)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;
var $ = H.$;

// ── Scroll handlers ──────────────────────────────────────────────────────
H.handleMainScroll = function(){
  var y = window.scrollY, el = y>0, fv = y>400, artOpen = H.el.articleView.classList.contains('open');
  if(el !== H.state._lastElevated){ H.el.topAppBar.classList.toggle('elevated',el); H.state._lastElevated=el }
  if(!artOpen && fv !== H.state._lastFab){ H.el.fab.classList.toggle('visible',fv); H.state._lastFab=fv }
};

H.initScrollHandlers = function(){
  // Article view scroll
  H.el.articleView.addEventListener('scroll',function(){
    if(H.state.artScrollRaf) return;
    H.state.artScrollRaf = requestAnimationFrame(function(){
      H.state.artScrollRaf = null;
      var s=H.el.articleView.scrollTop, sc=s>0, fv=s>400;
      var max = H.state._artScrollMax = H.el.articleView.scrollHeight - H.el.articleView.clientHeight;
      var prog = max>0 ? 'scaleX('+Math.min(1,s/max)+')' : 'scaleX(0)';
      H.el.rprog.style.transform = prog;
      if(sc !== H.state._lastArtScrolled){ H.el.avBar.classList.toggle('scrolled',sc); H.state._lastArtScrolled=sc }
      if(fv !== H.state._lastArtFab){
        H.el.fab.classList.toggle('visible',fv);
        H.el.fabComment.classList.toggle('shifted',fv);
        H.state._lastArtFab = fv;
      }
      if(innerWidth<=768 && H.el.articleView.classList.contains('open')){
        clearTimeout(H.state._fabIdleTimer);
        H.el.fab.classList.remove('idle'); H.el.fabComment.classList.remove('idle');
        H.state._fabIdleTimer = setTimeout(function(){
          if(H.el.articleView.classList.contains('open')){ H.el.fab.classList.add('idle'); H.el.fabComment.classList.add('idle') }
        },1000);
      }
      if(!H.state._tocRaf){
        H.state._tocRaf = requestAnimationFrame(function(){ H.state._tocRaf=null; H.updateTOCHighlight() });
      }
    });
  },{passive:true});

  // Main window scroll
  window.addEventListener('scroll',function(){
    if(H.state.scrollRaf) return;
    H.state.scrollRaf = requestAnimationFrame(function(){ H.state.scrollRaf=null; H.handleMainScroll() });
  },{passive:true});

  // Resize
  window.addEventListener('resize',function(){
    clearTimeout(H.state.resizeTimer);
    H.state.resizeTimer = setTimeout(function(){
      H.updateTabIndicator();
      H.invalidateHeadingCache();
      H.state._artScrollMax = H.el.articleView.scrollHeight - H.el.articleView.clientHeight;
    },120);
  });
};

// ── Tab management ───────────────────────────────────────────────────────
H.updateTabIndicator = function(){
  var a = document.querySelector('.tab.active');
  if(a && H.el.tabBar){
    var w=a.offsetWidth, x=a.offsetLeft;
    H.el.tabBar.style.width = w+'px';
    H.el.tabBar.style.willChange = 'transform';
    H.el.tabBar.style.transform = 'translateX('+x+'px)';
    clearTimeout(H.state._tabWCTimer);
    H.state._tabWCTimer = setTimeout(function(){ if(H.el.tabBar) H.el.tabBar.style.willChange='' },320);
  }
};

H.syncTabs = function(n){
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active',t.dataset.page===n) });
  H.updateTabIndicator();
};

H.applyFilterDirect = function(label,fn){
  H.getAllCards().forEach(function(c){
    if(!fn(c)){ c.dataset._filtered='1'; c.style.display='none'; c.classList.remove('show') }
    else{ c.dataset._filtered=''; c.style.display='' }
  });
  H.el.filterLabel.textContent = label;
  if(!H.el.filterBar.classList.contains('on')){
    H.el.filterBar.classList.add('on');
    if(!H.reducedMotion){
      H.el.filterBar.style.animation = 'filterBarIn .3s cubic-bezier(0,0,.2,1) forwards';
      H.el.filterBar.addEventListener('animationend',function(){ H.el.filterBar.style.animation='' },{once:true});
    }
  }
  H.state.paginationPage = 0;
  H.renderPaginationPage();
};

H.applyFilter = function(label,fn){
  H.state.activeFilterLabel = label; H.state.activeFilterFn = fn;
  if(H.state.currentPage!=='articles') H.switchPageVisual('articles','left');
  else H.syncTabs('articles');
  H.applyFilterDirect(label,fn);
  H.instantScroll(0);
  H.pushRoute({type:'page',page:'articles'});
};

H.clearFilter = function(){
  H.state.activeFilterLabel = ''; H.state.activeFilterFn = null;
  if(!H.reducedMotion && H.el.filterBar.classList.contains('on')){
    H.el.filterBar.classList.add('out'); H.el.filterBar.classList.remove('on');
    H.el.filterBar.addEventListener('animationend',function(){ H.el.filterBar.classList.remove('out') },{once:true});
  } else H.el.filterBar.classList.remove('on');
  H.el.filterLabel.textContent = '';
  H.state.paginationPage = 0;
  H.getAllCards().forEach(function(c){ c.dataset._filtered='' });
  H.state._lastRenderKey = '';
  H.renderPaginationPage();
};

// ── Search ───────────────────────────────────────────────────────────────
H.openSearch = function(){
  H.el.searchView.classList.add('open');
  H.el.svInput.value = '';
  H.el.svResults.innerHTML = '<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>';
  H.state.searchActiveIdx = -1;
  H.lockBody();
  history.pushState({type:'search'},'','#search');
  setTimeout(function(){ H.el.svInput.focus() },300);
};

H.closeSearch = function(fromPopstate){
  if(!H.el.searchView.classList.contains('open')) return;
  H.el.searchView.classList.remove('open');
  H.state.searchActiveIdx = -1;
  H.unlockBody();
  if(!fromPopstate) history.back();
};

H.hlMatch = function(t,q){
  var s = H.escHtml(t); if(!q) return s;
  return s.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark class="hl-match">$1</mark>');
};

H.filterSearch = function(q){
  q = (q||'').toLowerCase().trim();
  if(!q){ H.el.svResults.innerHTML='<p class="sv-hint">输入关键词搜索文章、标签和摘要。</p>'; return }
  var cards = H.getAllCards(), html='', found=false;
  cards.forEach(function(c){
    var t=c.dataset.title||'', e=c.dataset.excerpt||'', g=c.dataset.tags||'';
    if(t.toLowerCase().indexOf(q)!==-1 || e.toLowerCase().indexOf(q)!==-1 || g.toLowerCase().indexOf(q)!==-1){
      found=true;
      var tag = c.querySelector('.tag');
      html+='<div class="sv-item" data-id="'+c.dataset.id+'"><div class="sv-item-tag">'+(tag?tag.textContent:'')+'</div><div class="sv-item-title">'+H.hlMatch(t,q)+'</div><div class="sv-item-excerpt">'+H.hlMatch(e,q)+'</div></div>';
    }
  });
  H.el.svResults.innerHTML = found ? html : '<div class="sv-no-results">未找到相关结果。</div>';
  H.state.searchActiveIdx = -1;
};

H.updateSearchHighlight = function(){
  var items = H.el.svResults.querySelectorAll('.sv-item');
  for(var i=0;i<items.length;i++) items[i].classList.toggle('sv-item-active',i===H.state.searchActiveIdx);
  if(H.state.searchActiveIdx>=0 && items[H.state.searchActiveIdx]) items[H.state.searchActiveIdx].scrollIntoView({block:'nearest'});
};

// ── Click event delegation ───────────────────────────────────────────────
H.initClickHandler = function(){
  document.addEventListener('click',function(e){
    var t;
    // Code copy
    if((t=e.target.closest('.cb-copy'))){
      var cd=t.closest('.code-block'); cd=cd&&cd.querySelector('code');
      if(cd){ H.copyText(cd.textContent); t.classList.add('copied'); var old=t.innerHTML; t.innerHTML=H.icons.check; setTimeout(function(){t.innerHTML=old;t.classList.remove('copied')},2000) }
      return;
    }
    // Article nav
    if((t=e.target.closest('.art-nav-btn'))&&t.dataset.navId){
      var nId=t.dataset.navId, dir=t.classList.contains('next')?'next':'prev';
      H.switchToArticleVisual(nId,dir); H.replaceRoute({type:'article',articleId:nId}); return;
    }
    // Tag click in article
    if((t=e.target.closest('#artTags .tag'))&&t.dataset.tagname){
      var tn=t.dataset.tagname;
      H.state.activeFilterLabel=tn;
      H.state.activeFilterFn=function(c){ var tags=(c.dataset.tags||'').split('\u001f'); return tags.indexOf(tn)!==-1 };
      H.closeArticleVisual();
      if(H.state.currentPage!=='articles') H.switchPageVisual('articles','left');
      H.replaceRoute({type:'page',page:'articles'});
      H.applyFilterDirect(tn,H.state.activeFilterFn);
      window.scrollTo({top:0,behavior:'smooth'}); return;
    }
    // Pagination
    if((t=e.target.closest('.pg-btn'))&&!t.disabled){
      var p=t.dataset.pg;
      if(p==='prev') H.state.paginationPage--;
      else if(p==='next') H.state.paginationPage++;
      else H.state.paginationPage=parseInt(p);
      H.renderPaginationPage();
      var list=$('articleList'); if(list) list.scrollIntoView({behavior:'smooth',block:'start'});
      H.pushRoute({type:'page',page:'articles',paginationPage:H.state.paginationPage}); return;
    }
    // Search result click
    if((t=e.target.closest('.sv-item'))&&t.dataset.id){
      H.closeSearch(); var sid=t.dataset.id;
      setTimeout(function(){ H.pushRoute({type:'article',articleId:sid}); H.openArticleVisual(sid) },150); return;
    }
    // Archive/card click
    if((t=e.target.closest('.archive-card'))&&t.dataset.id){ H.pushRoute({type:'article',articleId:t.dataset.id}); H.openArticleVisual(t.dataset.id); return }
    if((t=e.target.closest('.card'))&&t.dataset.id){ H.pushRoute({type:'article',articleId:t.dataset.id}); H.openArticleVisual(t.dataset.id); return }
    // Back button
    if(e.target.closest('#avBack')){ if(history.length>1)history.back(); else{H.closeArticleVisual();H.pushRoute({type:'page',page:'articles'})} return }
    // TOC toggle
    if(e.target.closest('#tocToggleBtn')){ H.el.tocSheet.classList.contains('open')?H.closeTocSheet():H.openTocSheet(); return }
    if(e.target.closest('#tocScrim')){ H.closeTocSheet(); return }
    // Search
    if(e.target.closest('#searchBtn')){ H.openSearch(); return }
    if(e.target.closest('#svBack')){ H.closeSearch(); return }
    if(e.target.closest('#svClear')){ H.el.svInput.value=''; H.el.svInput.focus(); H.filterSearch(''); return }
    // Theme
    if(e.target.closest('#themeBtn')||e.target.closest('#avThemeBtn')){ H.toggleTheme(); return }
    // FAB
    if(e.target.closest('#fab')){ if(H.el.articleView.classList.contains('open'))H.el.articleView.scrollTo({top:0,behavior:'smooth'}); else window.scrollTo({top:0,behavior:'smooth'}); return }
    if(e.target.closest('#fabComment')){ var cs=$('commentSection'); if(cs)H.el.articleView.scrollTo({top:cs.offsetTop-64,behavior:'smooth'}); return }
    // Logo
    if(e.target.closest('#logoBtn')){
      H.state.activeFilterLabel=''; H.state.activeFilterFn=null;
      if(H.el.articleView.classList.contains('open')){H.closeArticleVisual();H.pushRoute({type:'page',page:'articles'})}
      else{H.pushRoute({type:'page',page:'articles'});H.switchPageVisual('articles','left')} return;
    }
    // Tab/footer link
    if((t=e.target.closest('.tab'))&&t.dataset.page){
      var pg=t.dataset.page;
      if(pg!==H.state.currentPage||H.el.articleView.classList.contains('open')){
        if(H.el.articleView.classList.contains('open')) H.closeArticleVisual();
        var oi=H.tabOrder.indexOf(H.state.currentPage),ni=H.tabOrder.indexOf(pg);
        H.switchPageVisual(pg,ni>oi?'right':'left'); H.pushRoute({type:'page',page:pg});
      } return;
    }
    if((t=e.target.closest('.footer-link'))&&t.dataset.page){
      var pg=t.dataset.page;
      if(pg!==H.state.currentPage||H.el.articleView.classList.contains('open')){
        if(H.el.articleView.classList.contains('open')) H.closeArticleVisual();
        var oi=H.tabOrder.indexOf(H.state.currentPage),ni=H.tabOrder.indexOf(pg);
        H.switchPageVisual(pg,ni>oi?'right':'left'); H.pushRoute({type:'page',page:pg});
      } return;
    }
    // Tag/category card filter
    if((t=e.target.closest('.tag-card'))&&t.dataset.tag){ H.applyFilter(t.dataset.tag,function(c){var tags=(c.dataset.tags||'').split('\u001f');return tags.indexOf(t.dataset.tag)!==-1}); return }
    if((t=e.target.closest('.cat-card'))&&t.dataset.cat){ var cv=t.dataset.cat; H.applyFilter(H.catNameMap[cv]||cv,function(c){return H.catMap[+c.dataset.id]===cv}); return }
    if(e.target.closest('#filterClear')){ H.clearFilter(); return }
  });
};

// ── Keyboard handler ─────────────────────────────────────────────────────
H.initKeyboardHandler = function(){
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      if(window.__cmtInputFocused) return;
      if(H.el.tocSheet.classList.contains('open')){H.closeTocSheet();return}
      if(H.el.searchView.classList.contains('open')){H.closeSearch();return}
      var lb=document.getElementById('lightbox');
      if(lb&&lb.classList.contains('open')){if(window.__lbClose)window.__lbClose();else{lb.classList.remove('open');document.body.style.overflow=''}return}
      if(H.el.articleView.classList.contains('open')){if(history.length>1)history.back();else{H.closeArticleVisual();H.pushRoute({type:'page',page:'articles'})}return}
    }
    if(window.__cmtInputFocused) return;
    var ae=document.activeElement;
    if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.isContentEditable)) return;
    if(e.key==='t'||e.key==='T'){if(H.el.articleView.classList.contains('open')){H.el.toc.classList.toggle('visible');return}}
    // Search navigation
    if(H.el.searchView.classList.contains('open')){
      var items=H.el.svResults.querySelectorAll('.sv-item');
      if(e.key==='ArrowDown'){e.preventDefault();if(H.state.searchActiveIdx<items.length-1){H.state.searchActiveIdx++;H.updateSearchHighlight()}return}
      if(e.key==='ArrowUp'){e.preventDefault();if(H.state.searchActiveIdx>0){H.state.searchActiveIdx--;H.updateSearchHighlight()}return}
      if(e.key==='Enter'){
        e.preventDefault();
        if(H.state.searchActiveIdx>=0&&items[H.state.searchActiveIdx]){
          H.closeSearch();var sid=items[H.state.searchActiveIdx].dataset.id;
          setTimeout(function(){H.pushRoute({type:'article',articleId:sid});H.openArticleVisual(sid)},150);
        }return;
      }
    }
    // Article navigation
    if(H.el.articleView.classList.contains('open')&&!H.el.searchView.classList.contains('open')){
      if(e.key==='ArrowRight'){var idx=H.articleOrder.indexOf(H.state.currentArticleId);if(idx<H.articleOrder.length-1){H.switchToArticleVisual(H.articleOrder[idx+1],'next');H.replaceRoute({type:'article',articleId:H.articleOrder[idx+1]})}return}
      if(e.key==='ArrowLeft'){var idx=H.articleOrder.indexOf(H.state.currentArticleId);if(idx>0){H.switchToArticleVisual(H.articleOrder[idx-1],'prev');H.replaceRoute({type:'article',articleId:H.articleOrder[idx-1]})}return}
    }
    if(e.key==='/'&&!H.el.searchView.classList.contains('open')&&!H.el.articleView.classList.contains('open')){e.preventDefault();H.openSearch()}
  });
};

// ── Ripple effect ────────────────────────────────────────────────────────
H.createRipple = function(e,el){
  if(H.reducedMotion) return;
  if(el.querySelectorAll('.ripple').length>3) return;
  var r=el.getBoundingClientRect(), s=Math.max(r.width,r.height)*2;
  var sp=document.createElement('span'); sp.className='ripple';
  sp.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';
  el.appendChild(sp);
  sp.addEventListener('animationend',function(){sp.remove()});
};

H.initRippleHandler = function(){
  document.addEventListener('pointerdown',function(e){
    var el=e.target.closest('.fl-card,.art-nav-btn,.archive-card,#filterClear');
    if(!el||el.disabled||el.offsetParent===null) return;
    H.createRipple(e,el);
  },{passive:true});
};

})();
