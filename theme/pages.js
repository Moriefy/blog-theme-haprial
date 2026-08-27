// pages.js — Page rendering (tags, categories, archive, friends, pagination)
// Depends on: Haprial (core.js)
(function(){
'use strict';

var H = window.Haprial;

H.renderPaginationPage = function(){
  var all = H.getAllCards(), cards = all.filter(function(c){ return c.dataset._filtered!=='1' });
  var total = Math.ceil(cards.length / H.state.perPage);
  if(total<1) total=1;
  if(H.state.paginationPage>=total) H.state.paginationPage=total-1;
  if(H.state.paginationPage<0) H.state.paginationPage=0;
  try{ sessionStorage.setItem('pg',H.state.paginationPage) }catch(e){}
  var renderKey = H.state.paginationPage+'|'+cards.map(function(c){return c.dataset.id}).join(',');
  var animate = renderKey !== H.state._lastRenderKey;
  H.state._lastRenderKey = renderKey;
  var start = H.state.paginationPage*H.state.perPage, end = start+H.state.perPage, ci=0;
  for(var i=0;i<all.length;i++){
    var c=all[i], isFiltered=c.dataset._filtered==='1', inPage=false;
    if(!isFiltered){ inPage=ci>=start&&ci<end; ci++ }
    if(isFiltered||!inPage){ c.style.display='none'; c.classList.remove('show') }
    else{
      c.style.display='';
      if(animate){ c.classList.add('show'); c.style.animationDelay=((ci-start)*20)+'ms' }
      else if(!c.classList.contains('show')){ c.classList.add('show'); c.style.animationDelay='' }
    }
  }
  var noR = $('noResults'), pagination = H.el.pagination;
  if(!cards.length){ noR.classList.add('show'); pagination.innerHTML=''; pagination.classList.remove('show'); return }
  noR.classList.remove('show');
  if(total>1){
    var h='<button class="pg-btn"'+(H.state.paginationPage===0?' disabled':'')+' data-pg="prev" aria-label="上一页">'+H.icons.chevL+'</button>';
    for(i=0;i<total;i++) h+='<button class="pg-btn'+(i===H.state.paginationPage?' active':'')+'"'+(i===H.state.paginationPage?' aria-current="page"':'')+' data-pg="'+i+'" aria-label="第'+(i+1)+'页">'+(i+1)+'</button>';
    h+='<button class="pg-btn"'+(H.state.paginationPage===total-1?' disabled':'')+' data-pg="next" aria-label="下一页">'+H.icons.chevR+'</button>';
    pagination.innerHTML=h; pagination.classList.add('show');
  } else {
    pagination.innerHTML='<span style="font-size:13px;color:var(--outline)">共 '+cards.length+' 篇文章</span>';
    pagination.classList.add('show');
  }
};

H.renderArticleNav = function(id){
  var idx = H.articleOrder.indexOf(String(id)), nav = $('artNav'), html = '';
  if(idx>0){
    var n = H.articles[H.articleOrder[idx-1]];
    if(n) html+='<button class="art-nav-btn prev" data-nav-id="'+H.articleOrder[idx-1]+'"><span class="art-nav-icon">'+H.icons.back+'</span><div class="art-nav-info"><div class="art-nav-label">'+H.escHtml(n.date)+'</div><div class="art-nav-title">'+H.escHtml(n.title)+'</div></div></button>';
  }
  if(idx<H.articleOrder.length-1){
    var p = H.articles[H.articleOrder[idx+1]];
    if(p) html+='<button class="art-nav-btn next" data-nav-id="'+H.articleOrder[idx+1]+'"><div class="art-nav-info"><div class="art-nav-label">'+H.escHtml(p.date)+'</div><div class="art-nav-title">'+H.escHtml(p.title)+'</div></div><span class="art-nav-icon">'+H.icons.fwd+'</span></button>';
  }
  nav.innerHTML = html;
  requestAnimationFrame(function(){ nav.classList.add('revealed') });
};

H.renderTags = function(){
  var sorted = H.allTags.slice().sort(function(a,b){ return a.n.localeCompare(b.n,'zh-CN') });
  $('tagsCount').textContent = '共 '+sorted.length+' 个标签';
  $('tagsGrid').innerHTML = sorted.map(function(t,i){
    return '<div class="tag-card" data-tag="'+t.n+'" style="--sd:'+i*15+'ms"><div class="tag-card-name">'+t.n+'</div><div class="tag-card-count">'+t.c+' 篇文章</div></div>';
  }).join('');
};

H.renderCats = function(){
  $('catsCount').textContent = '共 '+H.cats.length+' 个分类';
  $('catsGrid').innerHTML = H.cats.map(function(c,i){
    return '<div class="cat-card" data-cat="'+c.f+'" style="--sd:'+i*15+'ms"><div class="cat-dot" style="background:'+c.col+'"></div><div class="cat-name">'+c.n+'</div><div class="cat-desc">'+c.d+'</div><div class="cat-count">'+c.c+' 篇文章</div></div>';
  }).join('');
};

H.renderArchive = function(){
  var entries = [];
  H.articleOrder.forEach(function(id){
    var art = H.articles[id]; if(!art) return;
    var m = art.dateISO.match(/(\d{4})-(\d{2})-(\d{2})/); if(!m) return;
    entries.push({id:id, year:+m[1], month:+m[2], day:+m[3], title:art.title, tags:art.tags, rt:art.rt, category:art.category});
  });
  entries.sort(function(a,b){ return (b.year*10000+b.month*100+b.day)-(a.year*10000+a.month*100+a.day) });
  var grouped={}, html='', idx=0;
  var monthNames={1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"};
  entries.forEach(function(e){ if(!grouped[e.year])grouped[e.year]=[]; grouped[e.year].push(e) });
  Object.keys(grouped).sort(function(a,b){return b-a}).forEach(function(y){
    var items = grouped[y];
    html+='<div class="archive-year-group"><div class="archive-year-label">'+y+'<span class="archive-year-count">'+items.length+' 篇</span></div>';
    items.forEach(function(e){
      var tag = e.tags.length ? e.tags[0] : '';
      html+='<div class="archive-card" data-id="'+e.id+'" style="--arch-d:'+(idx++*25)+'ms"><div class="archive-card-date"><span class="archive-card-month">'+monthNames[e.month]+'</span><span class="archive-card-day">'+e.day+'</span></div><div class="archive-card-body"><div class="archive-card-title">'+H.escHtml(e.title)+'</div><div class="archive-card-meta">'+(tag?'<span class="archive-card-tag">'+H.escHtml(tag)+'</span>':'')+'<span class="archive-card-rt">'+e.rt+'</span></div></div></div>';
    });
    html+='</div>';
  });
  $('archiveCount').textContent = '共 '+entries.length+' 篇文章';
  $('archiveTimeline').innerHTML = html;
};

H.renderFriends = function(){
  $('flGrid').innerHTML = H.friends.map(function(f,i){
    return '<a class="fl-card" href="'+H.escHtml(f.u)+'" target="_blank" rel="noopener" style="--sd:'+i*15+'ms"><img class="fl-avatar" src="'+H.escHtml(f.a)+'" alt="'+H.escHtml(f.n)+'" width="48" height="48" loading="lazy"><div class="fl-info"><div class="fl-name">'+H.escHtml(f.n)+'</div><div class="fl-desc">'+H.escHtml(f.d)+'</div></div></a>';
  }).join('');
};

})();
