// app.js — Main orchestrator
// Depends on: core.js, mermaid.js, routing.js, article.js, toc.js, pages.js, events.js
// Also: lightbox.js, comments.js (loaded separately)
(function(){
'use strict';

var H = window.Haprial;

// ── Initialize DOM refs ──────────────────────────────────────────────────
H.initDom();

// ── Comments ─────────────────────────────────────────────────────────────
H.__initFriendsComments = function(){
  var _c = H.comments; if(!_c||!_c.enabled||!_c.api) return;
  var sec = document.getElementById('friendsCommentSection'); if(!sec||sec.dataset.loaded) return;
  sec.dataset.loaded = '1';
  var el = sec.querySelector('#friendsCommentInner'); if(!el) return;
  if(typeof HaprialComments!=='undefined') H.__friendsCommentsInstance = new HaprialComments(el,{api:_c.api,page:'/friends/'});
};

H.__initComments = function(path){
  var _c = H.comments; if(!_c||!_c.enabled||!_c.api) return;
  var section = document.getElementById('commentSection'); if(!section) return;
  var el = section.querySelector('#commentSectionInner');
  if(!el){ section.innerHTML='<div id="commentSectionInner"></div>'; el=section.querySelector('#commentSectionInner') }
  if(typeof HaprialComments!=='undefined'){
    if(H.__commentsInstance&&H.__commentsInstance._f!==undefined){H.__commentsInstance._f=false;window.__cmtInputFocused=false}
    H.__commentsInstance = new HaprialComments(el,{api:_c.api,page:path});
  }
};

// ── Image handling ───────────────────────────────────────────────────────
H.observeImages = function(){
  if(H.state.imgObserver) H.state.imgObserver.disconnect();
  if(H.reducedMotion){ H.el.articleBody.querySelectorAll('img').forEach(function(img){img.classList.add('img-revealed')}); return }
  H.state.imgObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var img=entry.target; H.state.imgObserver.unobserve(img);
        if(img.complete&&img.naturalWidth>0) setTimeout(function(){img.classList.add('img-revealed')},60);
      }
    });
  },{root:H.el.articleView, rootMargin:'100px', threshold:0.05});
  H.el.articleBody.querySelectorAll('img:not(.img-revealed)').forEach(function(img){ H.state.imgObserver.observe(img) });
};

H.revealImages = function(){
  H.el.articleBody.querySelectorAll('img').forEach(function(img){
    if(img.classList.contains('img-revealed')) return;
    if(H.reducedMotion){ img.classList.add('img-revealed'); return }
    if(img.complete&&img.naturalWidth>0){ img.classList.add('img-revealed'); return }
    img.addEventListener('load',function(){ setTimeout(function(){img.classList.add('img-revealed')},60) },{once:true});
    img.addEventListener('error',function(){ img.classList.add('img-revealed') },{once:true});
  });
};

// ── Code blocks ──────────────────────────────────────────────────────────
H.processCodeBlocks = function(){
  if(H.state.codeProcessed) return;
  H.state.codeProcessed = true;
  var pres = H.el.articleBody.querySelectorAll('pre'); if(!pres.length) return;
  if(!document.querySelector('link[href*="prism-tomorrow"]')){
    var cb=document.createElement('link');cb.rel='stylesheet';cb.href='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';cb.integrity='sha384-wFjoQjtV1y5jVHbt0p35Ui8aV8GVpEZkyF99OXWqP/eNJDU93D3Ugxkoyh6Y2I4A';cb.crossOrigin='anonymous';document.head.appendChild(cb);
  }
  function highlightAll(){
    for(var i=0;i<pres.length;i++){
      var pre=pres[i]; if(pre.closest('.code-block')) continue;
      var code=pre.querySelector('code'); var text=code?code.textContent:pre.textContent;
      text=text.replace(/^\n+/,'').replace(/\n+$/,''); var lines=text.split('\n');
      var lm=code?code.className.match(/language-(\w+)/):null, lang=lm?lm[1]:'code';
      var w=document.createElement('div');w.className='code-block';
      var bar=document.createElement('div');bar.className='cb-bar';bar.innerHTML='<span class="cb-lang">'+lang+'</span><button class="cb-copy" type="button" aria-label="复制代码">'+H.icons.copy+'</button>';
      var body=document.createElement('div');body.className='cb-body';
      var lnDiv=document.createElement('div');lnDiv.className='cb-lines';var lh='';for(var j=0;j<lines.length;j++)lh+='<span>'+(j+1)+'</span>';lnDiv.innerHTML=lh;
      var sep=document.createElement('div');sep.className='cb-sep';
      var preW=document.createElement('div');preW.className='cb-pre-wrap';
      pre.parentNode.insertBefore(w,pre);preW.appendChild(pre);body.appendChild(lnDiv);body.appendChild(sep);body.appendChild(preW);w.appendChild(bar);w.appendChild(body);
      if(typeof Prism!=='undefined'&&window.Prism)try{Prism.highlightElement(code||pre)}catch(e){}
    }
  }
  if(H.state.prismLoaded){highlightAll();return}
  H.state.prismLoaded=true;
  var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';s.integrity='sha384-06z5D//U/xpvxZHuUz92xBvq3DqBBFi7Up53HRrbV7Jlv7Yvh/MZ7oenfUe9iCEt';s.crossOrigin='anonymous';s.setAttribute('data-manual','');
  s.onload=function(){if(typeof Prism!=='undefined')highlightAll()};document.head.appendChild(s);
};

// ── Theme ────────────────────────────────────────────────────────────────
H.syncAllIcons = function(t){
  document.querySelectorAll('.theme-wrap').forEach(function(w){
    var s=w.querySelector('.sun'),m=w.querySelector('.moon');
    if(t==='dark'){s.classList.add('off');m.classList.remove('off')}else{s.classList.remove('off');m.classList.add('off')}
  });
};

H.rerenderMermaidsOnTheme = function(){
  if(!H.el.articleBody) return;
  var blocks=[].slice.call(H.el.articleBody.querySelectorAll('.mermaid-block'));
  for(var i=0;i<blocks.length;i++){var b=blocks[i];if(b._zoomCleanup){try{b._zoomCleanup()}catch(e){}}b.innerHTML='';b.removeAttribute('data-mr');H._renderMermaidBlock(b)}
};

H.applyTheme = function(t){
  var el=document.documentElement;
  var apply=function(){el.setAttribute('data-theme',t);try{localStorage.setItem('th',t)}catch(e){}H.syncAllIcons(t);var btn=document.getElementById('themeBtn');if(btn)btn.setAttribute('aria-pressed',t==='dark'?'true':'false')};
  if(!H.reducedMotion&&!H.isLowEnd&&document.startViewTransition){
    var vt=document.startViewTransition(function(){apply();H.rerenderMermaidsOnTheme();return Promise.resolve()});
    vt.finished.catch(function(){});
    return;
  }
  el.classList.add('theme-transitioning');apply();H.rerenderMermaidsOnTheme();
  setTimeout(function(){el.classList.remove('theme-transitioning')},250);
};

H.toggleTheme = function(){
  var cur=document.documentElement.getAttribute('data-theme')||'light';
  H.applyTheme(cur==='light'?'dark':'light');
};

// ── Popstate ─────────────────────────────────────────────────────────────
window.addEventListener('popstate',function(){
  if(H.el.searchView.classList.contains('open')){H.closeSearch(true);return}
  var st=history.state; if(!st) st=H.parseHash();
  H.applyRoute(st);
});

// ── Search input ─────────────────────────────────────────────────────────
H.el.svInput.addEventListener('input',function(){
  clearTimeout(H.state.searchTimer); H.state.searchActiveIdx=-1;
  var v=this.value; H.state.searchTimer = setTimeout(function(){ H.filterSearch(v) },350);
});

// ── Archive timeline animation ───────────────────────────────────────────
(function(){
  var pg=$('pageArchive'); if(!pg) return;
  var tl=pg.querySelector('.archive-timeline'); if(!tl) return;
  new MutationObserver(function(){
    if(pg.classList.contains('active')) tl.classList.add('grow'); else tl.classList.remove('grow');
  }).observe(pg,{attributes:true,attributeFilter:['class']});
})();

// ── TOC visibility (hover zone + auto-hide) ──────────────────────────────
(function(){
  var toc=H.el.toc, articleView=H.el.articleView;
  if(!toc||!articleView) return;
  var hideTimer=null, threshold=9999, inToc=false, needInit=true;
  function updateThreshold(){var av=document.querySelector('.av-content');if(av)threshold=av.getBoundingClientRect().right}
  function show(){clearTimeout(hideTimer);toc.classList.add('visible')}
  function scheduleHide(){clearTimeout(hideTimer);hideTimer=setTimeout(function(){toc.classList.remove('visible')},1500)}
  var moveRaf=null, lastMouseX=0;
  function onMove(e){
    lastMouseX=e.clientX;
    if(moveRaf) return;
    moveRaf=requestAnimationFrame(function(){
      moveRaf=null;
      if(needInit){needInit=false;updateThreshold();if(lastMouseX<threshold){scheduleHide();return}}
      if(lastMouseX>=threshold) show(); else if(!inToc) scheduleHide();
    });
  }
  var _moveBound=false;
  function bindMove(){if(!_moveBound){_moveBound=true;needInit=true;document.addEventListener('mousemove',onMove)}}
  function unbindMove(){if(_moveBound){_moveBound=false;needInit=true;document.removeEventListener('mousemove',onMove)}}
  toc.addEventListener('mouseenter',function(){inToc=true;clearTimeout(hideTimer)});
  toc.addEventListener('mouseleave',function(){inToc=false;scheduleHide()});
  var _origOpen=H.openArticleVisual;
  H.openArticleVisual=function(id){needInit=true;bindMove();_origOpen(id)};
  var _origClose=H.closeArticleVisual;
  H.closeArticleVisual=function(){inToc=false;unbindMove();clearTimeout(hideTimer);toc.classList.remove('visible');_origClose()};
  var _origImm=H.openArticleVisualImmediate;
  H.openArticleVisualImmediate=function(id){needInit=true;bindMove();_origImm(id)};
  window.addEventListener('resize',function(){needInit=true});
})();

// ── Mermaid modifier keys ────────────────────────────────────────────────
(function(){
  function blocks(){return H.el.articleBody.querySelectorAll('.mermaid-block')}
  function setMod(cls,on){blocks().forEach(function(b){b.classList.toggle(cls,on)})}
  document.addEventListener('keydown',function(e){
    if(e.ctrlKey)setMod('mod-ctrl',true); if(e.shiftKey)setMod('mod-shift',true); if(e.altKey)setMod('mod-alt',true);
  });
  document.addEventListener('keyup',function(e){
    if(!e.ctrlKey)setMod('mod-ctrl',false); if(!e.shiftKey)setMod('mod-shift',false); if(!e.altKey)setMod('mod-alt',false);
  });
  document.addEventListener('click',function(e){
    var b=e.target.closest('.mermaid-block');
    if(!b||e.target.closest('.mermaid-zoom-btn')||e.target.closest('.pie-chart')) return;
    var svg=b.querySelector('svg'); if(!svg) return;
    if(e.altKey) return;
    if(e.ctrlKey){e.preventDefault();if(b._zoomAround)b._zoomAround(e,'in');return}
    if(e.shiftKey){e.preventDefault();if(b._zoomAround)b._zoomAround(e,'out');return}
  });
  // Footnote/TOC link handling
  document.addEventListener('click',function(e){
    var tl=e.target.closest('.toc-auto-link');
    if(tl&&tl.dataset.target){var tgt=document.getElementById(tl.dataset.target);if(tgt)tgt.scrollIntoView({behavior:'smooth',block:'start'});return}
    var fn=e.target.closest('[data-fn-name]');
    if(fn){
      var tid='fn-'+fn.dataset.fnName, be=false;
      if(fn.classList.contains('footnote-backref')){tid='fnref-'+fn.dataset.fnName;be=true}
      var el=document.getElementById(tid);
      if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.background='var(--primary-container)';setTimeout(function(){el.style.background=''},2000)}
      e.preventDefault(); return;
    }
  });
})();

// ── Initialize all event handlers ────────────────────────────────────────
H.initScrollHandlers();
H.initClickHandler();
H.initKeyboardHandler();
H.initRippleHandler();

// ── Theme initialization ─────────────────────────────────────────────────
var th=null; try{th=localStorage.getItem('th')}catch(e){}
if(!th) th=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
document.documentElement.setAttribute('data-theme',th); H.syncAllIcons(th);

// ── Route initialization ─────────────────────────────────────────────────
var initRoute = H.parseHash();
if(initRoute.type==='page'&&initRoute.paginationPage){ H.state.paginationPage=initRoute.paginationPage }
else{ try{var sp=sessionStorage.getItem('pg');if(sp!==null)H.state.paginationPage=parseInt(sp)||0 }catch(e){} }

// ── Init steps (staggered via requestIdleCallback) ───────────────────────
var _initIdx=0, _initSteps=[
  function(){ H.renderTags(); H.renderCats() },
  function(){ H.renderArchive() },
  function(){ H.renderFriends(); H.renderPaginationPage() },
  function(){ H.handleMainScroll(); requestAnimationFrame(H.updateTabIndicator) }
];
(function runInit(){
  if(_initIdx<_initSteps.length){ var _f=_initSteps[_initIdx++]; H._ric(function(){_f();runInit()}) }
})();

// ── Apply initial route ──────────────────────────────────────────────────
if(initRoute.type==='article'){
  if(H.isReload){ H.replaceRoute(initRoute); H.openArticleVisualImmediate(initRoute.articleId) }
  else{ H.replaceRoute({type:'page',page:'articles'}); H.pushRoute(initRoute); requestAnimationFrame(function(){ H.openArticleVisual(initRoute.articleId) }) }
} else {
  var af=document.getElementById('anti-fouc'); if(af) af.remove();
  H.replaceRoute(initRoute);
  if(initRoute.page&&initRoute.page!=='articles') H.switchPageVisual(initRoute.page,null);
}

// ── Initialize lightbox (shared module) ──────────────────────────────────
window.__initLightbox(H.el.articleBody);

})();
