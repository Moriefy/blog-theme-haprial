// article.js — Article lifecycle (load, open, close, switch)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

H.loadArticleMeta = function(id){
  var art = H.articles[id]; if(!art) return;
  H.state.currentArticleId = id;
  $('artMeta').innerHTML = '<span>'+art.date+'</span><span style="color:var(--outline-variant)"> · </span><span>'+art.wc+' 字</span><span style="color:var(--outline-variant)"> · </span><span>'+art.rt+'</span>';
  $('artTitle').textContent = art.title;
  $('artTags').innerHTML = art.tags.map(function(t){ return '<span class="tag" data-tagname="'+H.escHtml(t)+'">'+H.escHtml(t)+'</span>' }).join('');
  H.renderArticleNav(id);
};

H.loadArticle = function(id){
  var art = H.articles[id]; if(!art) return;
  H.loadArticleMeta(id);
  var rprog = H.el.rprog, fab = H.el.fab, fabComment = H.el.fabComment;
  var articleView = H.el.articleView, articleBody = H.el.articleBody;
  rprog.style.transform = 'scaleX(0)'; fab.classList.remove('visible');
  articleView.scrollTop = 0;
  H.state.headingCache = null; H.state.lastActiveId = null;
  H.state.tocManualLock = false; clearTimeout(H.state.tocManualTimer);
  H.state._lastArtScrolled = null; H.state._lastArtFab = null;
  articleBody.classList.remove('revealed'); articleBody.textContent = '';
  var html = art.content || '';
  if(H.state.currentArticleId !== id) return;
  requestAnimationFrame(function(){
    if(H.state.currentArticleId !== id) return;
    articleBody.style.display = 'none';
    articleBody.innerHTML = html;
    articleBody.offsetHeight; // force reflow
    articleBody.style.display = '';
    H.state._artScrollMax = articleView.scrollHeight - articleView.clientHeight;
    articleBody.classList.add('revealed');
    var _cm = H.comments;
    if(_cm && _cm.enabled && _cm.api) H.__initComments('/posts/'+id+'/');
    var _sv = articleView.scrollTop;
    fab.classList.toggle('visible', _sv>400);
    fabComment.classList.toggle('shifted', _sv>400);
    H.state._lastArtFab = (_sv>400);
    H._ric(function(){
      if(H.state.currentArticleId !== id) return;
      H.state.codeProcessed = false;
      H.processCodeBlocks();
      if(H.state.currentArticleId !== id) return;
      H._ric(function(){
        if(H.state.currentArticleId !== id) return;
        H.revealImages(); H.observeImages();
        H._ric(function(){ if(H.state.currentArticleId !== id) return; H.processMermaid() });
      });
    });
    articleView.dispatchEvent(new CustomEvent('article:content-ready',{detail:{id:id}}));
  });
};

H.openArticleVisual = function(id){
  H.state._closeAnimDone = true;
  H.state.scrollPos = window.scrollY;
  H.lockBody();
  var articleView = H.el.articleView, articleBody = H.el.articleBody;
  articleView.style.willChange = 'transform';
  articleView.classList.add('open');
  articleBody.innerHTML = '';
  articleBody.classList.remove('revealed');
  H.el.avBar.classList.remove('scrolled');
  H.el.fabComment.classList.add('visible');
  H.el.fabComment.classList.remove('shifted');
  var af = document.getElementById('anti-fouc'); if(af) af.remove();
  articleView.addEventListener('article:content-ready',function h(e){
    if(e.detail.id !== id) return;
    articleView.removeEventListener('article:content-ready',h);
    H.buildTOC();
  },{once:true});
  requestAnimationFrame(function(){ H.loadArticle(id) });
};

H.openArticleVisualImmediate = function(id){
  var articleView = H.el.articleView;
  articleView.addEventListener('article:content-ready',function h(e){
    if(e.detail.id !== id) return;
    articleView.removeEventListener('article:content-ready',h);
    H.buildTOC();
  },{once:true});
  H.loadArticle(id);
  H.lockBody();
  articleView.style.transition = 'none';
  articleView.classList.add('open');
  articleView.offsetHeight;
  requestAnimationFrame(function(){ articleView.style.transition = '' });
  H.el.avBar.classList.remove('scrolled');
  H.el.fabComment.classList.add('visible');
  H.el.fabComment.classList.remove('shifted');
  H.state._lastFab = null; H.state._lastArtFab = null; H.state._lastArtScrolled = null;
  H.restoreArticleScroll(id);
  var af = document.getElementById('anti-fouc'); if(af) af.remove();
};

H.saveArticleScroll = function(id){ try{ sessionStorage.setItem('art_scroll_'+id, String(H.el.articleView.scrollTop)) }catch(e){} };

H.restoreArticleScroll = function(id){
  try{
    var saved = sessionStorage.getItem('art_scroll_'+id);
    if(saved){
      var y = parseInt(saved)||0;
      setTimeout(function(){
        H.el.articleView.scrollTop = y;
        var s=y, fv=s>400;
        H.el.fab.classList.toggle('visible',fv);
        H.el.fabComment.classList.toggle('shifted',fv);
        H.state._lastArtFab = fv; H.state._lastArtScrolled = s>0;
        H.el.avBar.classList.toggle('scrolled',s>0);
        var amax = H.el.articleView.scrollHeight - H.el.articleView.clientHeight;
        H.el.rprog.style.transform = amax>0 ? 'scaleX('+Math.min(1,s/amax)+')' : 'scaleX(0)';
      },100);
    }
  }catch(e){}
};

H.switchToArticleVisual = function(nid,dir){
  if(H.state.isSwitchingArticle) return;
  H.state.isSwitchingArticle = true;
  var ac = $('avContent'), dx = dir==='next' ? -16 : 16;
  function finish(){ H.state.isSwitchingArticle = false; ac.style.transition=''; ac.style.opacity=''; ac.style.transform='' }
  ac.style.transition = 'opacity 120ms cubic-bezier(.4,0,1,1),transform 120ms cubic-bezier(.4,0,1,1)';
  ac.style.opacity = '0'; ac.style.transform = 'translateX('+dx+'px)';
  var done1 = false;
  ac.addEventListener('transitionend',function h1(){ if(done1)return; done1=true; ac.removeEventListener('transitionend',h1); doLoad() },{once:true});
  setTimeout(function(){ if(!done1){done1=true;doLoad()} },150);
  function doLoad(){
    ac.style.transition = 'none'; ac.style.transform = 'translateX('+(-dx)+'px)';
    H.el.articleView.addEventListener('article:content-ready',function h(e){
      if(e.detail.id !== nid) return;
      H.el.articleView.removeEventListener('article:content-ready',h);
      H.buildTOC();
    },{once:true});
    H.loadArticle(nid);
    requestAnimationFrame(function(){
      ac.style.transition = 'opacity 180ms cubic-bezier(0,0,.2,1),transform 180ms cubic-bezier(0,0,.2,1)';
      ac.style.opacity = '1'; ac.style.transform = 'translateX(0)';
      var done2 = false;
      ac.addEventListener('transitionend',function h2(){ if(done2)return; done2=true; finish() },{once:true});
      setTimeout(function(){ if(!done2){done2=true;finish()} },220);
    });
  }
};

H.closeArticleVisual = function(){
  var articleView = H.el.articleView, articleBody = H.el.articleBody;
  if(!articleView.classList.contains('open')) return;
  if(H.state.currentArticleId) H.saveArticleScroll(H.state.currentArticleId);
  H.state.currentArticleId = null;
  H.closeTocSheet();
  articleView.classList.remove('open');
  H.state._lastFab = null;
  H.el.fabComment.classList.remove('visible');
  H.el.fabComment.classList.remove('shifted');
  H.state._closeAnimDone = false;
  function afterClose(){
    if(H.state._closeAnimDone) return;
    H.state._closeAnimDone = true;
    articleView.style.willChange = '';
    if(H.state.imgObserver){ H.state.imgObserver.disconnect(); H.state.imgObserver = null }
    articleBody.querySelectorAll('.mermaid-block').forEach(function(b){ if(b._zoomCleanup){b._zoomCleanup();delete b._zoomCleanup} });
    articleBody.textContent = '';
    window.scrollTo(0, H.state.scrollPos);
    H.unlockBody();
    var af = document.getElementById('anti-fouc'); if(af) af.remove();
    H.el.fab.classList.remove('idle');
    H.el.fabComment.classList.remove('idle');
    clearTimeout(H.state._fabIdleTimer);
    H.state.lastRouteWasArticle = false;
    H.el.topAppBar.classList.toggle('elevated', H.state.scrollPos>0);
    H.el.fab.classList.toggle('visible', H.state.scrollPos>400);
  }
  articleView.addEventListener('transitionend',function h(e){ if(e.target!==articleView)return; articleView.removeEventListener('transitionend',h); afterClose() });
  setTimeout(afterClose,350);
};

H.switchPageVisual = function(name,dir){
  H.state.pageScrollPos[H.state.currentPage] = window.scrollY;
  var el = $('page'+name.charAt(0).toUpperCase()+name.slice(1));
  var curEl = $('page'+H.state.currentPage.charAt(0).toUpperCase()+H.state.currentPage.slice(1));
  if(!el||el===curEl){ H.syncTabs(name); return }
  H.syncTabs(name);
  if(curEl){ curEl.classList.remove('active','slide-in-right','slide-in-left','slide-out-left','slide-out-right'); curEl.style.willChange='' }
  el.classList.add('active');
  if(dir && !H.reducedMotion && !H.isMobile){
    var inCls = dir==='right' ? 'slide-in-right' : 'slide-in-left';
    el.classList.add(inCls);
    el.addEventListener('animationend',function(){ el.classList.remove(inCls) },{once:true});
  }
  H.state.currentPage = name;
  if(name==='articles' && H.state.activeFilterLabel) H.applyFilterDirect(H.state.activeFilterLabel, H.state.activeFilterFn);
  if(name==='friends') H.__initFriendsComments();
  H.instantScroll(H.state.pageScrollPos[name]||0);
};

})();
