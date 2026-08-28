// routing.js — Hash routing, SEO, JSON-LD
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

var pageHash = {'/':'articles','/tags':'tags','/categories':'categories','/archive':'archive','/friends':'friends','/about':'about'};
var hashPage = {articles:'/',tags:'/tags',categories:'/categories',archive:'/archive',friends:'/friends',about:'/about'};

H.routeToHash = function(r){
  if(r.type==='article'){
    var a = H.articles[r.articleId];
    return '#/posts/' + (a ? a.dateISO.replace(/-/g,'') : r.articleId);
  }
  var page = r.page || 'articles';
  if(page==='articles'){
    if(r.paginationPage > 0) return '#/page/' + (r.paginationPage+1);
    return '#/';
  }
  return '#' + (hashPage[page] || '/');
};

H.parseHash = function(){
  var h = (location.hash||'').replace(/^#/,'') || '/';
  if(h==='/') return {type:'page', page:'articles'};
  var am = h.match(/^\/posts\/(\d{8})$/);
  if(am && H.slugToId[am[1]]) return {type:'article', articleId:H.slugToId[am[1]]};
  var pm = h.match(/^\/page\/(\d+)$/);
  if(pm) return {type:'page', page:'articles', paginationPage:parseInt(pm[1])-1};
  return {type:'page', page:pageHash[h] || 'articles'};
};

H.pushRoute = function(r){ history.pushState(r,'',H.routeToHash(r)); H.updateSEO(r) };
H.replaceRoute = function(r){ history.replaceState(r,'',H.routeToHash(r)); H.updateSEO(r) };

H.updateSEO = function(r){
  if(r.type==='article'){
    var a = H.articles[r.articleId];
    if(a){
      document.title = a.title + ' | ' + H.siteTitle;
      if(H.metaDesc) H.metaDesc.content = a.excerpt;
      if(H.ogTitle) H.ogTitle.content = a.title;
      if(H.ogDesc) H.ogDesc.content = a.excerpt;
      H.addJsonLd(a);
    }
  } else {
    document.title = H.seoTitles[r.page] || H.siteTitle;
    if(H.metaDesc) H.metaDesc.content = H.siteTitle;
    H.removeJsonLd();
  }
  if(H.linkCanon) H.linkCanon.href = location.href;
};

H.addJsonLd = function(a){
  H.removeJsonLd();
  var s = document.createElement('script');
  s.type = 'application/ld+json'; s.id = 'artld';
  s.textContent = JSON.stringify({
    "@context":"https://schema.org","@type":"BlogPosting",
    "headline":a.title,"description":a.excerpt,"datePublished":a.dateISO,
    "author":{"@type":"Person","name":H.siteAuthor}
  });
  document.head.appendChild(s);
};

H.removeJsonLd = function(){ var o = document.getElementById('artld'); if(o) o.remove() };

H.applyRoute = function(route){
  if(!route) route = {type:'page', page:'articles'};
  var artOpen = H.el.articleView.classList.contains('open');
  if(route.type==='article'){
    H.state.lastRouteWasArticle = true;
    if(artOpen && route.articleId === H.state.currentArticleId){ H.updateSEO(route); return }
    if(!artOpen) H.openArticleVisual(route.articleId);
    else{
      var dir = H.articleOrder.indexOf(route.articleId) < H.articleOrder.indexOf(H.state.currentArticleId) ? 'next' : 'prev';
      H.switchToArticleVisual(route.articleId, dir);
    }
  } else {
    if(artOpen) H.closeArticleVisual();
    if(H.state.lastRouteWasArticle && route.page==='articles'){
      H.state.lastRouteWasArticle = false;
      H.syncTabs('articles');
      H.updateSEO(route);
      return;
    }
    H.state.lastRouteWasArticle = false;
    if(route.page !== H.state.currentPage){
      var oi = H.tabOrder.indexOf(H.state.currentPage), ni = H.tabOrder.indexOf(route.page);
      H.switchPageVisual(route.page, ni>oi ? 'right' : 'left');
    } else H.syncTabs(route.page);
    if(route.page==='articles' && route.paginationPage!=null){
      H.state.paginationPage = route.paginationPage;
      H.renderPaginationPage();
    }
  }
  H.updateSEO(route);
};

})();
