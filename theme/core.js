// core.js — Global state, DOM refs, utilities
// Loaded first, all other modules depend on window.Haprial
(function(){
'use strict';

// Error boundary
window.addEventListener('error',function(e){console.error('[Haprial]',e.message,e.filename,e.lineno)});
window.addEventListener('unhandledrejection',function(e){console.error('[Haprial] Promise:',e.reason)});

if('scrollRestoration' in history)history.scrollRestoration='manual';

var H = window.Haprial = window.Haprial || {};

// ── Shared state ─────────────────────────────────────────────────────────
H.state = {
  scrollPos: 0,
  codeProcessed: false,
  currentPage: 'articles',
  pageScrollPos: {},
  headingCache: null,
  lastActiveId: null,
  scrollRaf: null,
  artScrollRaf: null,
  resizeTimer: null,
  _artScrollMax: 0,
  _tabWCTimer: null,
  _rprogWCTimer: null,
  paginationPage: 0,
  perPage: 6,
  currentArticleId: null,
  isSwitchingArticle: false,
  searchTimer: null,
  tocManualLock: false,
  tocManualTimer: null,
  activeFilterLabel: '',
  activeFilterFn: null,
  searchActiveIdx: -1,
  _lastElevated: null,
  _lastFab: null,
  _lastArtScrolled: null,
  _lastArtFab: null,
  _fabIdleTimer: null,
  _lastRenderKey: '',
  _cachedCards: null,
  prismLoaded: false,
  imgObserver: null,
  _mermaidIO: null,
  _closeAnimDone: false,
  _lastOpenedCardId: null,
  _tocRaf: null,
  _headingCacheDirty: false,
  lastRouteWasArticle: false,
  _lbPushed: false
};

// ── Data (from __HAPRIAL_DATA__) ─────────────────────────────────────────
var data = window.__HAPRIAL_DATA__ || {};
H.articleOrder = data.articleOrder || [];
H.articles = data.articles || {};
H.allTags = data.allTags || [];
H.cats = data.cats || [];
H.catMap = data.catMap || {};
H.friends = data.friends || [];
H.siteTitle = data.siteTitle || '';
H.siteAuthor = data.author || '';
H.comments = data.comments || {};

H.catNameMap = {};
H.cats.forEach(function(c){ H.catNameMap[c.f] = c.n });

H.slugToId = {};
(function(){ for(var id in H.articles) H.slugToId[H.articles[id].dateISO.replace(/-/g,'')] = id })();

// ── Feature detection ────────────────────────────────────────────────────
H.reducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
H.isLowEnd = H.reducedMotion || (navigator.deviceMemory && navigator.deviceMemory <= 2);
H.isMobile = matchMedia("(max-width:768px)").matches;
H.isReload = false;
try{ var ne = performance.getEntriesByType('navigation'); H.isReload = ne.length > 0 && ne[0].type === 'reload' }catch(e){}

// ── DOM refs ─────────────────────────────────────────────────────────────
H.$ = function(id){ return document.getElementById(id) };
H.el = {};
H.initDom = function() {
  var $ = H.$;
  H.el.topAppBar = $('topAppBar');
  H.el.articleView = $('articleView');
  H.el.articleBody = $('articleBody');
  H.el.rprog = $('rprog');
  H.el.avBar = $('avBar');
  H.el.searchView = $('searchView');
  H.el.svInput = $('svInput');
  H.el.svResults = $('svResults');
  H.el.fab = $('fab');
  H.el.toc = $('toc');
  H.el.tocList = $('tocList');
  H.el.filterBar = $('filterBar');
  H.el.filterLabel = $('filterLabel');
  H.el.tabBar = $('tabBar');
  H.el.tocSheet = $('tocSheet');
  H.el.tocDrawerList = $('tocDrawerList');
  H.el.tocToggleBtn = $('tocToggleBtn');
  H.el.pagination = $('pagination');
  H.el.fabComment = $('fabComment');
};

// ── Constants ────────────────────────────────────────────────────────────
H.tabOrder = ['articles','tags','categories','archive','friends','about'];
H.seoTitles = {};
H.tabOrder.forEach(function(p){
  H.seoTitles[p] = p === 'articles' ? H.siteTitle : {tags:'标签',categories:'分类',archive:'归档',friends:'友链',about:'关于'}[p] + ' | ' + H.siteTitle;
});

H.metaDesc = document.querySelector('meta[name="description"]');
H.ogTitle = document.querySelector('meta[property="og:title"]');
H.ogDesc = document.querySelector('meta[property="og:description"]');
H.linkCanon = document.querySelector('link[rel="canonical"]');

H.icons = {
  chevL: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>',
  back:  '<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  fwd:   '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  copy:  '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
};

// ── Utility functions ────────────────────────────────────────────────────
var _scrollBarW = null;
H.lockBody = function(){
  if(_scrollBarW === null) _scrollBarW = innerWidth - document.documentElement.clientWidth;
  document.body.classList.add('locked');
  document.body.style.paddingRight = _scrollBarW > 0 ? _scrollBarW + 'px' : '';
};
H.unlockBody = function(){
  document.body.classList.remove('locked');
  document.body.style.paddingRight = '';
};
H.copyText = function(t){
  if(navigator.clipboard && isSecureContext){ navigator.clipboard.writeText(t); return }
  var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
};
H.escHtml = function(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'"');
};

// requestIdleCallback shim (ES5-safe) - bound to window to avoid Illegal invocation
H._ric = window.requestIdleCallback ? window.requestIdleCallback.bind(window) : function(cb){
  var st = Date.now();
  return setTimeout(function(){ cb({didTimeout:false, timeRemaining:function(){ return Math.max(0,50-(Date.now()-st)) }}) }, 1);
};
H._ricCancel = window.cancelIdleCallback ? window.cancelIdleCallback.bind(window) : function(h){ clearTimeout(h) };

H.getAllCards = function(){
  if(!H.state._cachedCards) H.state._cachedCards = [].slice.call(document.querySelectorAll('.card'));
  return H.state._cachedCards;
};

H.instantScroll = function(y){
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = '';
  H.state._lastElevated = null;
  H.state._lastFab = null;
  if(H.handleMainScroll) H.handleMainScroll();
};

})();
