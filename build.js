#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { escHtml, parseFrontMatter, mdInline, mdToHtml } = require('./lib/markdown');

// ── Config ──────────────────────────────────────────────────────────────────
const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const THEME_DIR = path.join(ROOT, 'theme');
const STATIC_DIR = path.join(ROOT, 'static');
const OUT_DIR = path.join(ROOT, 'dist');
const CACHE_FILE = path.join(ROOT, '.build-cache.json');
const SITE_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

// ── Build Cache ─────────────────────────────────────────────────────────────
function fileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getGlobalFingerprint() {
  // Hash files that affect every page: theme, config, build script itself
  const files = [
    path.join(ROOT, 'site.config.json'),
    path.join(THEME_DIR, 'styles.css'),
    path.join(THEME_DIR, 'app.js'),
    path.join(THEME_DIR, 'lightbox.js'),
    path.join(THEME_DIR, 'comments.css'),
    path.join(THEME_DIR, 'comments.js'),
    path.join(ROOT, 'build.js'),
    path.join(ROOT, 'lib', 'markdown.js'),
    path.join(ROOT, 'src', '404.html'),
  ];
  const h = crypto.createHash('md5');
  files.forEach(f => { try { h.update(fs.readFileSync(f)); } catch (e) { /* skip missing */ } });
  return h.digest('hex');
}

// ── Read & Parse Articles (with incremental cache) ────────────────────────
function loadArticles(prevCache, globalFp) {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).sort();
  const articles = {};
  const articleOrder = [];
  let cacheHits = 0;
  const newCache = {};

  files.forEach(file => {
    const filePath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(raw).digest('hex');
    const id_guess = file.replace('.md', '');
    const cacheKey = file;
    const cached = prevCache.articles && prevCache.articles[cacheKey];

    // Check if this article + global context are unchanged
    if (cached && cached.hash === hash && cached.globalFp === globalFp) {
      // Cache hit — reuse parsed result
      cacheHits++;
      const art = cached.article;
      articles[art._id] = art;
      articleOrder.push(art._id);
      newCache[cacheKey] = { hash, globalFp, article: art };
      return;
    }

    // Cache miss — parse fresh
    const [meta, body] = parseFrontMatter(raw);
    const dateVal = meta.date || meta.dateISO || '';
    let slug = dateVal ? dateVal.replace(/-/g, '') : id_guess;
    const content = mdToHtml(body);

    // Handle slug collision: append filename-based suffix
    if (articles[slug]) {
      // Extract suffix from filename (e.g. '20260729-network-craft.md' -> 'network-craft')
      const fileSuffix = file.replace(/^\d{8}-/, '').replace(/\.md$/, '');
      slug = slug + '-' + fileSuffix;
      // If still colliding, add counter
      if (articles[slug]) {
        let counter = 2;
        while (articles[slug + '-' + counter]) counter++;
        slug = slug + '-' + counter;
      }
    }
    const id = slug;

    // Validate dateISO format (YYYY-MM-DD)
    const isValidISO = /^\d{4}-\d{2}-\d{2}$/.test(dateVal);
    const dateISO = isValidISO ? dateVal : '';

    // Auto-calculate reading time
    const plainText = body.replace(/<[^>]+>/g, '').replace(/[#*`~\[\]()!>\-|]/g, '');
    const cnChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
    const enWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
    const totalMin = Math.ceil((cnChars / 400) + (enWords / 200));
    const readingTime = (totalMin < 1 ? 1 : totalMin) + ' 分钟';
    const wordCount = cnChars + enWords;

    const article = {
      _id: id,
      date: dateVal,
      dateISO: dateISO,
      rt: readingTime,
      wc: wordCount,
      title: meta.title || '',
      excerpt: meta.excerpt || '',
      pinned: meta.pinned === 'true' || meta.pinned === true,
      tags: Array.isArray(meta.tags) ? meta.tags : (typeof meta.tags === 'string' ? JSON.parse(meta.tags) : []),
      category: meta.category || '',
      content: content
    };

    articles[id] = article;
    articleOrder.push(id);
    newCache[cacheKey] = { hash, globalFp, article };
  });

  if (cacheHits > 0) console.log(`  ⚡ Cache hit: ${cacheHits}/${files.length} articles unchanged`);

  // Store for later saving
  loadArticles._newArticleCache = newCache;

  // Post-process: build [TOC] for articles that have it
  Object.values(articles).forEach(a => {
    if (a.content.includes('id="md-toc-auto"')) {
      const headingRegex = /<h([23])\s+id="([^"]*)"[^>]*>(.*?)<\/h\1>/g;
      let tocHtml = '<div class="toc-title">目录</div><ol class="toc-auto-list">';
      let m;
      while ((m = headingRegex.exec(a.content)) !== null) {
        const level = m[1];
        const hid = m[2];
        const text = m[3].replace(/<[^>]+>/g, '');
        const indent = level === '3' ? ' class="sub"' : '';
        tocHtml += '<li' + indent + '><a style="cursor:pointer" onclick="var el=document.getElementById(\'' + hid + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'start\'})}">' + escHtml(text) + '</a></li>';
      }
      tocHtml += '</ol>';
      a.content = a.content.replace(/<nav class="md-toc" id="md-toc-auto"><\/nav>/, '<nav class="md-toc" id="md-toc-auto">' + tocHtml + '</nav>');
    }
  });

  // Sort by date descending
  articleOrder.sort((a, b) => { const pa = articles[a].pinned ? 1 : 0; const pb = articles[b].pinned ? 1 : 0; if (pa !== pb) return pb - pa; return b.localeCompare(a); });

  return { articles, articleOrder };
}

// ── Compute Tags & Categories ───────────────────────────────────────────────
function computeTags(articles) {
  const tagMap = {};
  Object.values(articles).forEach(a => {
    a.tags.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
  });
  return Object.entries(tagMap).map(([n, c]) => ({ n, c }));
}

function computeCats(articles, config) {
  const catCounts = {};
  Object.values(articles).forEach(a => {
    catCounts[a.category] = (catCounts[a.category] || 0) + 1;
  });
  return config.categories.map(c => ({
    n: c.name,
    d: c.desc,
    c: catCounts[c.slug] || 0,
    col: c.color,
    f: c.slug
  }));
}

function computeCatMap(articles) {
  const map = {};
  Object.entries(articles).forEach(([id, a]) => {
    map[id] = a.category;
  });
  return map;
}

// ── Generate article card HTML ──────────────────────────────────────────────
function articleCardHtml(id, art) {
  const pinHtml = art.pinned ? '<span class="pin-badge">📌 置顶</span>' : '';
  const tagHtml = art.tags.length
    ? '<span class="tag">' + escHtml(art.tags[0]) + '</span>'
    : '';
  return `<article class="card" data-id="${id}" data-title="${escHtml(art.title)}" data-excerpt="${escHtml(art.excerpt)}" data-tags="${escHtml(art.tags.join('\u001f'))}"><div class="card-date">${escHtml(art.date)}${pinHtml}</div><h2 class="card-title">${escHtml(art.title)}</h2><p class="card-excerpt">${escHtml(art.excerpt)}</p><div class="card-meta">${tagHtml}<span class="reading-time">${escHtml(art.rt)}</span></div></article>`;
}

// ── Shared JS Helpers ───────────────────────────────────────────────────────
function themeInitScript() {
  return `(function(){var th=null;try{th=localStorage.getItem('th')}catch(e){}if(!th)th=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',th);document.querySelectorAll('.theme-wrap').forEach(function(w){var s=w.querySelector('.sun'),m=w.querySelector('.moon');if(th==='dark'){s.classList.add('off');m.classList.remove('off')}else{s.classList.remove('off');m.classList.add('off')}})})()`;
}

function postPageScript() {
  return `
  // Prism lazy-load for code blocks (conditional)
  var codeBlocks=document.querySelectorAll('pre code');
  if(codeBlocks.length){
    var cb=document.createElement('link');cb.rel='stylesheet';cb.href='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';document.head.appendChild(cb);
    var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';s.setAttribute('data-manual','');s.onload=function(){if(typeof Prism!=='undefined')Prism.highlightAll()};document.head.appendChild(s);
  }
  // Smooth TOC scroll
  document.querySelectorAll('.toc-item').forEach(function(li){
    li.addEventListener('click',function(){
      var t=document.getElementById(li.dataset.target);
      if(t)t.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });
  // Image lazy load with blur placeholder
  (function(){
    var imgs=document.querySelectorAll('.article-body img');
    var motionOK=!window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    function reveal(img){img.classList.add('revealed')}
    imgs.forEach(function(img){
      img.setAttribute('loading','lazy');
      if(!motionOK){reveal(img);return}
      if(img.complete&&img.naturalWidth>0){reveal(img);return}
      img.addEventListener('load',function(){setTimeout(function(){reveal(img)},50)},{once:true});
      img.addEventListener('error',function(){img.style.opacity='1';img.style.filter='';img.style.transform=''},{once:true});
    });
    if(motionOK&&'IntersectionObserver' in window){
      var obs=new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting){obs.unobserve(e.target);var im=e.target;if(im.complete&&im.naturalWidth>0){setTimeout(function(){reveal(im)},50)}}
        });
      },{threshold:0.1});
      imgs.forEach(function(img){if(!img.classList.contains('revealed'))obs.observe(img)});
    }
  })();`;
}

// ── Generate Pages ──────────────────────────────────────────────────────────
function buildIndexHtml(articleCardsHtml, config, opts) {
  const { cssContent, themeTransition, jsContent, dataObj, articles, allTags } = opts;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(config.title)}</title>
<meta name="description" content="${escHtml(config.description)}">
<meta name="robots" content="index, follow">
<meta name="googlebot" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escHtml(config.title)}">
<meta property="og:title" content="${escHtml(config.title)}">
<meta property="og:description" content="${escHtml(config.description)}">
<meta property="og:url" content="${escHtml(config.url)}">
<meta property="og:image" content="${escHtml(config.url)}/avatar.png">
<meta name="twitter:image" content="${escHtml(config.url)}/avatar.png">
<link rel="canonical" href="${escHtml(config.url)}/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="${escHtml(config.title)}" href="/rss.xml">
<link rel="alternate" hreflang="zh-CN" href="${escHtml(config.url)}/">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escHtml(config.title)}">
<meta name="twitter:description" content="${escHtml(config.description)}">
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebSite','name':config.title,'url':config.url,'description':config.description,'author':{'@type':'Person','name':config.author},'potentialAction':{'@type':'SearchAction','target':config.url+'/?q={search_term_string}','query-input':'required name=search_term_string'}})}</script>
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://fonts.gstatic.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;600&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css" media="print" onload="this.media='all'">

<noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;600&display=swap" rel="stylesheet"></noscript>
<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
${articleOrder.slice(0, 3).map(id => '<link rel="prefetch" href="/posts/' + id + '/article.json" as="fetch" crossorigin>').join('\n')}
<style>${cssContent}${themeTransition}</style>
<style id="anti-fouc">.top-app-bar,.page-tabs,.page.active,.site-footer,.fab,.fab-comment{display:none!important}</style>
<script>(function(){var h=location.hash;if(h.indexOf('#/posts/')!==0||h.length!==16){var af=document.getElementById('anti-fouc');if(af)af.remove()}})()</script>
${commentsEnabled?'<link rel="stylesheet" href="/theme/comments.css?v=1785775352" media="print" onload="this.media=\'all\'">':''}
</head>
<body>

<header class="top-app-bar" id="topAppBar">
  <span class="logo" id="logoBtn">Moriefy</span>
  <div class="spacer"></div>
  <button class="icon-btn" id="searchBtn" aria-label="搜索"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></button>
  <button class="icon-btn" id="themeBtn" aria-label="切换主题" aria-pressed="false"><span class="theme-wrap"><svg class="theme-ico sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><svg class="theme-ico moon off" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></button>
</header>

<nav class="page-tabs" id="pageTabs" role="navigation" aria-label="主导航">
  <button class="tab active" data-page="articles">文章</button>
  <button class="tab" data-page="tags">标签</button>
  <button class="tab" data-page="categories">分类</button>
  <button class="tab" data-page="archive">归档</button>
  <button class="tab" data-page="friends">友链</button>
  <button class="tab" data-page="about">关于</button>
  <div class="tab-bar" id="tabBar"></div>
</nav>

<section class="page active" id="pageArticles" itemscope itemtype="https://schema.org/Blog"><div class="container">
  <section class="hero"><h1>Moriefyの半岛铁盒</h1><p>${escHtml(config.tagline)}</p></section>
  <div class="filter-bar" id="filterBar"><span>筛选标签：</span><strong id="filterLabel"></strong><button class="filter-clear" id="filterClear" aria-label="清除筛选">清除筛选</button></div>
  <section class="article-list" id="articleList">
    ${articleCardsHtml}
  </section>
  <div class="pagination" id="pagination"></div>
  <div class="no-results" id="noResults"><p>未找到匹配的文章。</p></div>
</div></section>

<section class="page" id="pageTags"><div class="container"><section class="page-hero"><h1>标签</h1><p id="tagsCount"></p></section><div class="tags-grid" id="tagsGrid"></div></div></section>
<section class="page" id="pageCategories"><div class="container"><section class="page-hero"><h1>分类</h1><p id="catsCount"></p></section><div class="cats-grid" id="catsGrid"></div></div></section>
<section class="page" id="pageArchive"><div class="container"><section class="page-hero"><h1>归档</h1><p id="archiveCount"></p></section><div class="archive-timeline" id="archiveTimeline"></div></div></section>
<section class="page" id="pageFriends"><div class="container"><section class="page-hero"><h1>友链</h1><p>这些站点值得关注。</p></section><div class="fl-grid" id="flGrid"></div>${commentsEnabled?'<section class="comment-section" id="friendsCommentSection"><div id="friendsCommentInner"></div></section>':''}</div></section>
<section class="page" id="pageAbout"><div class="container"><div class="about-center"><div class="about-mono"><img src="/avatar.png" alt="Moriefy" width="72" height="72"></div><h1>Moriefy</h1><p class="about-tagline">${escHtml(config.tagline)}</p><div class="about-divider"></div><div class="about-bio">${config.bio.split('\n').filter(Boolean).map(p => '<p>' + escHtml(p) + '</p>').join('')}</div><div class="about-divider"></div><h3 class="about-section-title">技术栈</h3><div class="about-skill-list">${config.skills.map(s => '<span class="about-skill">' + escHtml(s) + '</span>').join('')}</div><div class="about-divider"></div><div class="about-stats"><div class="about-stat"><span class="about-stat-num">${Object.keys(articles).length}</span><span class="about-stat-label">篇文章</span></div><div class="about-stat"><span class="about-stat-num">${config.categories.length}</span><span class="about-stat-label">个分类</span></div><div class="about-stat"><span class="about-stat-num">${allTags.length}</span><span class="about-stat-label">个标签</span></div></div><div class="about-divider"></div><div class="about-links">${config.links.map(l => '<a class="about-link" href="' + escHtml(l.url) + '" target="_blank" rel="noopener">' + escHtml(l.name) + '</a>').join('')}</div></div></div></section>

<article class="article-view" id="articleView">
  <header class="av-bar" id="avBar">
    <button class="icon-btn" id="avBack" aria-label="返回"><svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
    <button class="icon-btn toc-toggle" id="tocToggleBtn" aria-label="目录"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg></button>
    <div class="spacer"></div>
    <button class="icon-btn" id="avThemeBtn" aria-label="切换主题"><span class="theme-wrap"><svg class="theme-ico sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><svg class="theme-ico moon off" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></button>
  </header>
  <div class="rprog" id="rprog"></div>
  <div class="av-content" id="avContent"><header class="article-header"><div class="art-meta si d0" id="artMeta"></div><h1 class="si d1" id="artTitle"></h1><div class="art-tags si d2" id="artTags"></div><div class="art-div si d3"></div></header><div class="article-body" id="articleBody" data-stg></div><div class="art-nav" id="artNav"></div>${config.comments&&config.comments.enabled?'<section class="comment-section" id="commentSection"><div id="commentSectionInner"></div></section>':''}</div>
</article>

<div class="search-view" id="searchView">
  <header class="sv-bar"><button class="icon-btn" id="svBack" aria-label="返回"><svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button><input class="sv-input" id="svInput" type="text" placeholder="搜索文章…" autocomplete="off"><button class="icon-btn" id="svClear" aria-label="清除"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></header>
  <div class="sv-results" id="svResults" aria-live="polite"><p class="sv-hint">输入关键词搜索文章、标签和摘要。</p></div>
</div>

<aside class="toc" id="toc"><div class="toc-title">目录</div><ul class="toc-list" id="tocList"></ul></aside>
<div class="toc-sheet" id="tocSheet"><div class="toc-scrim" id="tocScrim"></div><div class="toc-drawer"><div class="toc-drawer-handle"></div><div class="toc-drawer-title">目录</div><ul class="toc-drawer-list" id="tocDrawerList"></ul></div></div>

<button class="fab" id="fab" aria-label="回到顶部"><svg viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
<button class="fab fab-comment" id="fabComment" aria-label="评论区"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
<div class="lightbox" id="lightbox"><div class="lightbox-scrim" id="lbScrim"></div><div class="lightbox-toolbar"><span class="lightbox-counter" id="lbCounter"></span><button class="lightbox-close" id="lightboxClose" aria-label="关闭"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="lightbox-stage" id="lbStage"><button class="lightbox-nav lightbox-prev" id="lbPrev" aria-label="上一张"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="lightbox-img-wrap" id="lbImgWrap"><img class="lightbox-img" id="lightboxImg" src="" alt=""></div><button class="lightbox-nav lightbox-next" id="lbNext" aria-label="下一张"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button></div><div class="lightbox-bottombar"><button class="lightbox-btn" id="lbLocate" aria-label="定位"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button><div class="spacer"></div><button class="lightbox-btn" id="lbDownload" aria-label="下载"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button></div></div>
<footer class="site-footer">
  <nav class="footer-nav"><a class="footer-link" role="link" tabindex="0" data-page="articles">文章</a><a class="footer-link" role="link" tabindex="0" data-page="tags">标签</a><a class="footer-link" role="link" tabindex="0" data-page="categories">分类</a><a class="footer-link" role="link" tabindex="0" data-page="archive">归档</a><a class="footer-link" role="link" tabindex="0" data-page="friends">友链</a><a class="footer-link" role="link" tabindex="0" data-page="about">关于</a></nav>
  <p class="footer-copy">&copy; ${new Date().getFullYear()} ${escHtml(config.title)}</p>
</footer>
<noscript><style>.page{display:block!important}.article-view{display:none!important}</style></noscript>

<script src="/theme/lightbox.js"></script>
<script src="/theme/comments.js"></script>
<script defer src="/theme/app.js"></script>
<script>
window.__HAPRIAL_DATA__ = ${JSON.stringify(dataObj).replace(/<\/script>/gi, '<\\/script>').replace(/-->/g, '--\\u003e')}
</script>
</body>
</html>`;
}

function buildPostHtml(id, art, config, opts) {
  const { articles, articleOrder } = opts;
  const tagsHtml = art.tags.map(t => '<span class="tag">' + escHtml(t) + '</span>').join('');

  // Find prev/next
  const idx = articleOrder.indexOf(id);
  let navHtml = '';
  if (idx > 0) {
    const newerArt = articles[articleOrder[idx - 1]];
    if (newerArt) navHtml += `<a class="art-nav-btn prev" href="/posts/${articleOrder[idx - 1]}/"><span class="art-nav-icon"><svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></span><div class="art-nav-info"><div class="art-nav-label">${escHtml(newerArt.date)}</div><div class="art-nav-title">${escHtml(newerArt.title)}</div></div></a>`;
  }
  if (idx < articleOrder.length - 1) {
    const olderArt = articles[articleOrder[idx + 1]];
    if (olderArt) navHtml += `<a class="art-nav-btn next" href="/posts/${articleOrder[idx + 1]}/"><div class="art-nav-info"><div class="art-nav-label">${escHtml(olderArt.date)}</div><div class="art-nav-title">${escHtml(olderArt.title)}</div></div><span class="art-nav-icon"><svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span></a>`;
  }

  // Build TOC from headings
  const headingRegex = /<h([23])\s+id="([^"]*)"[^>]*>(.*?)<\/h\1>/g;
  let tocHtml = '';
  let m;
  while ((m = headingRegex.exec(art.content)) !== null) {
    const level = m[1];
    const hid = m[2];
    const text = m[3].replace(/<[^>]+>/g, '');
    const subClass = level === '3' ? ' sub' : '';
    tocHtml += `<li class="toc-item" data-target="${hid}"><a class="toc-link${subClass}">${escHtml(text)}</a></li>`;
  }

  
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': art.title,
    'description': art.excerpt,
    'datePublished': art.dateISO,
    'dateModified': art.dateISO,
    'wordCount': art.wc,
    'author': { '@type': 'Person', 'name': config.author },
    'publisher': { '@type': 'Person', 'name': config.author },
    'url': config.url + '/posts/' + id + '/',
    'mainEntityOfPage': { '@type': 'WebPage', '@id': config.url + '/posts/' + id + '/' }
  });
  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': config.title, 'item': config.url + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': art.category ? (config.categories.find(c => c.slug === art.category) || {}).name || art.category : '文章', 'item': config.url + '/#' + (art.category || 'articles') },
      { '@type': 'ListItem', 'position': 3, 'name': art.title, 'item': config.url + '/posts/' + id + '/' }
    ]
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(art.title)} | ${escHtml(config.title)}</title>

<meta name="description" content="${escHtml(art.excerpt)}">
<meta name="robots" content="index, follow">
<meta name="googlebot" content="index, follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escHtml(config.title)}">
<meta property="og:title" content="${escHtml(art.title)}">
<meta property="og:description" content="${escHtml(art.excerpt)}">
<meta property="og:url" content="${escHtml(config.url)}/posts/${id}/">
<meta property="og:image" content="${escHtml(config.url)}/avatar.png">
<meta name="twitter:image" content="${escHtml(config.url)}/avatar.png">
<meta property="article:published_time" content="${art.dateISO}">
<meta property="article:author" content="${escHtml(config.author)}">
${art.tags.map(t => '<meta property="article:tag" content="' + escHtml(t) + '">').join('\n')}
<link rel="canonical" href="${escHtml(config.url)}/posts/${id}/">
<link rel="alternate" hreflang="zh-CN" href="${escHtml(config.url)}/posts/${id}/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="${escHtml(config.title)}" href="/rss.xml">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escHtml(art.title)}">
<meta name="twitter:description" content="${escHtml(art.excerpt)}">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://fonts.gstatic.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;600&display=swap" media="print" onload="this.media='all'">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css" media="print" onload="this.media='all'">

<noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;600&display=swap" rel="stylesheet"></noscript>
<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
<link rel="stylesheet" href="/theme/styles.css?v=1785775352">
${config.comments&&config.comments.enabled?'<link rel="stylesheet" href="/theme/comments.css?v=1785775352">':''}
<script type="application/ld+json">${jsonLd}</script>
<script type="application/ld+json">${breadcrumbLd}</script>

</head>
<body>

<header class="top-app-bar" id="topAppBar">
  <span class="logo" onclick="location.href='/'" style="cursor:pointer">Moriefy</span>
  <div class="spacer"></div>
  <button class="icon-btn" aria-label="切换主题" aria-pressed="false" onclick="(function(){var c=document.documentElement.getAttribute('data-theme')||'light';var t=c==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('th',t)}catch(e){};document.querySelectorAll('.theme-wrap').forEach(function(w){var s=w.querySelector('.sun'),m=w.querySelector('.moon');if(t==='dark'){s.classList.add('off');m.classList.remove('off')}else{s.classList.remove('off');m.classList.add('off')}})})()"><span class="theme-wrap"><svg class="theme-ico sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><svg class="theme-ico moon off" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></button>
</header>

<main style="max-width:720px;margin:0 auto;padding:0 24px 120px">
  <header class="article-header" style="padding-top:32px">
    <div class="art-meta"><span>${escHtml(art.date)}</span><span style="color:var(--outline-variant)"> · </span><span>${art.wc} 字</span><span style="color:var(--outline-variant)"> · </span><span>${escHtml(art.rt)}</span></div>
    <h1>${escHtml(art.title)}</h1>
    <div class="art-tags">${tagsHtml}</div>
    <div class="art-div"></div>
  </header>
    <div class="article-body revealed">${art.content}</div>
  <div class="art-nav revealed">${navHtml}</div>
  ${config.comments&&config.comments.enabled?'<section class="comment-section" id="commentSection"><div id="commentSectionInner"></div></section>':''}
</main>

<aside class="toc">
  <div class="toc-title">目录</div>
  <ul class="toc-list">${tocHtml}</ul>
</aside>

<div class="lightbox" id="lightbox"><div class="lightbox-scrim" id="lbScrim"></div><div class="lightbox-toolbar"><span class="lightbox-counter" id="lbCounter"></span><button class="lightbox-close" id="lightboxClose" aria-label="关闭"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="lightbox-stage" id="lbStage"><button class="lightbox-nav lightbox-prev" id="lbPrev" aria-label="上一张"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><div class="lightbox-img-wrap" id="lbImgWrap"><img class="lightbox-img" id="lightboxImg" src="" alt=""></div><button class="lightbox-nav lightbox-next" id="lbNext" aria-label="下一张"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button></div><div class="lightbox-bottombar"><button class="lightbox-btn" id="lbLocate" aria-label="定位"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button><div class="spacer"></div><button class="lightbox-btn" id="lbDownload" aria-label="下载"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button></div></div>
<footer class="site-footer">
  <nav class="footer-nav"><a class="footer-link" href="/">文章</a><a class="footer-link" href="/tags/">标签</a><a class="footer-link" href="/categories/">分类</a><a class="footer-link" href="/archive/">归档</a><a class="footer-link" href="/friends/">友链</a><a class="footer-link" href="/about/">关于</a></nav>
  <p class="footer-copy">&copy; ${new Date().getFullYear()} ${escHtml(config.title)}</p>
</footer>

<script src="/theme/lightbox.js"></script>
<script src="/theme/comments.js"></script>
<script>
${themeInitScript()}
${postPageScript()}
window.__initLightbox(document.querySelector('.article-body'));
(function(){var tc=document.querySelector('.toc'),av=1785775352document.querySelector('.av-content'),ht=null;if(!tc||!av)return;function thr(){return av.getBoundingClientRect().right}function show(){clearTimeout(ht);tc.classList.add('visible')}function hide(){clearTimeout(ht);ht=setTimeout(function(){tc.classList.remove('visible')},1500)}document.addEventListener('mousemove',function(e){if(e.clientX>=thr())show();else hide()});tc.addEventListener('mouseenter',function(){clearTimeout(ht)});tc.addEventListener('mouseleave',function(){hide()})})();
${config.comments&&config.comments.enabled&&config.comments.api?'(function(){var el=document.getElementById("commentSectionInner");if(el&&typeof HaprialComments!=="undefined")new HaprialComments(el,{api:"'+escHtml(config.comments.api)+'",page:"/posts/'+id+'/"})})();':''}
</script>
</body>
</html>`;
}

// ── Build ───────────────────────────────────────────────────────────────────
console.log('🔨 Building Haprial...');

// Load cache and compute fingerprints
const prevCache = loadCache();
const globalFp = getGlobalFingerprint();
const globalChanged = prevCache.globalFp !== globalFp;
if (globalChanged) console.log('  🔄 Global config/theme changed, full rebuild');

const { articles, articleOrder } = loadArticles(prevCache, globalFp);
const allTags = computeTags(articles);
const cats = computeCats(articles, SITE_CONFIG);
const catMap = computeCatMap(articles);

// Check if we can skip HTML generation (cache hit + no global change)
const cachedOutput = prevCache.outputHashes || {};
const newOutputHashes = {};

// Read CSS for inlining (full CSS inline eliminates async flicker)
const cssContent = fs.readFileSync(path.join(THEME_DIR, 'styles.css'), 'utf8');

// Add theme transition CSS — target only key elements (not *) to avoid mobile jank
const themeTransition = ''; // theme snap — no transition to avoid jank

const jsContent = fs.readFileSync(path.join(THEME_DIR, 'app.js'), 'utf8');

// Build article cards
const articleCardsHtml = articleOrder.map(id => articleCardHtml(id, articles[id])).join('\n    ');

// Data object for client-side JS
// Create lightweight articles (without content) for embedded data
const articlesMeta = {};
Object.entries(articles).forEach(([id, a]) => {
  articlesMeta[id] = { date: a.date, dateISO: a.dateISO, rt: a.rt, wc: a.wc, title: a.title, excerpt: a.excerpt, tags: a.tags, category: a.category, pinned: a.pinned };
});

const commentsEnabled = !!(SITE_CONFIG.comments && SITE_CONFIG.comments.enabled);
const commentsApi = commentsEnabled ? (SITE_CONFIG.comments.api || '') : '';

const dataObj = {
  siteTitle: SITE_CONFIG.title,
  siteAuthor: SITE_CONFIG.author,
  comments: { enabled: commentsEnabled, provider: commentsEnabled ? (SITE_CONFIG.comments.provider || 'custom') : '', api: commentsApi },
  articleOrder,
  articles: articlesMeta,
  allTags,
  cats,
  catMap,
  friends: SITE_CONFIG.friends.map(f => ({n: f.name, u: f.url, a: f.avatar, d: f.desc}))
};

// Clean output
if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// Write index.html
const indexHtml = buildIndexHtml(articleCardsHtml, SITE_CONFIG, {
  cssContent, themeTransition, jsContent, dataObj, articles, allTags
});
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);
console.log('  ✓ index.html');

// Write individual post pages
const postsDir = path.join(OUT_DIR, 'posts');
fs.mkdirSync(postsDir, { recursive: true });
articleOrder.forEach(id => {
  const postDir = path.join(postsDir, id);
  fs.mkdirSync(postDir, { recursive: true });
  fs.writeFileSync(path.join(postDir, 'index.html'), buildPostHtml(id, articles[id], SITE_CONFIG, {
    articles, articleOrder
  }));
  // Write article JSON for lazy loading
  fs.writeFileSync(path.join(postDir, 'article.json'), JSON.stringify({ content: articles[id].content }));
  console.log('  ✓ posts/' + id + '/index.html');
});

// ── SEO-friendly standalone pages (real content, not just redirects) ────────
function seoPageHead(title, description) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)} | ${escHtml(SITE_CONFIG.title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${escHtml(SITE_CONFIG.url)}/${escHtml(title.toLowerCase())}/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/theme/styles.css?v=1785775352">
</head>
<body>
<header class="top-app-bar"><span class="logo" onclick="location.href='/'" style="cursor:pointer">${escHtml(SITE_CONFIG.author)}</span><div class="spacer"></div></header>
<main style="max-width:960px;margin:0 auto;padding:80px 24px 120px">
`;
}

function seoPageFoot() {
  return `</main>
<footer class="site-footer"><nav class="footer-nav"><a class="footer-link" href="/">文章</a><a class="footer-link" href="/tags/">标签</a><a class="footer-link" href="/categories/">分类</a><a class="footer-link" href="/archive/">归档</a><a class="footer-link" href="/friends/">友链</a><a class="footer-link" href="/about/">关于</a></nav><p class="footer-copy">© ${new Date().getFullYear()} ${escHtml(SITE_CONFIG.title)}</p></footer>
</body></html>`;
}

// Tags page
{
  const dir = path.join(OUT_DIR, 'tags');
  fs.mkdirSync(dir, { recursive: true });
  let body = `<section class="page-hero"><h1>标签</h1><p>${allTags.length} 个标签</p></section><div class="tags-grid">`;
  allTags.forEach(t => {
    body += `<div class="tag-card" onclick="location.href='/#tags'"><span class="tag-name">${escHtml(t.n)}</span><span class="tag-count">${t.c} 篇</span></div>`;
  });
  body += '</div>';
  // Add article list by tag for SEO
  allTags.forEach(t => {
    body += `<section style="margin-top:32px"><h2 style="font-size:18px;margin-bottom:12px">${escHtml(t.n)}</h2>`;
    articleOrder.forEach(id => {
      if (articles[id].tags.includes(t.n)) {
        body += `<article style="margin-bottom:8px"><a href="/posts/${id}/" style="color:var(--on-surface);text-decoration:none">${escHtml(articles[id].title)}</a><span style="color:var(--on-surface-variant);margin-left:8px;font-size:13px">${escHtml(articles[id].date)}</span></article>`;
      }
    });
    body += '</section>';
  });
  fs.writeFileSync(path.join(dir, 'index.html'), seoPageHead('标签', SITE_CONFIG.description) + body + seoPageFoot());
  console.log('  ✓ tags/index.html');
}

// Categories page
{
  const dir = path.join(OUT_DIR, 'categories');
  fs.mkdirSync(dir, { recursive: true });
  let body = `<section class="page-hero"><h1>分类</h1><p>${cats.length} 个分类</p></section><div class="cats-grid">`;
  cats.forEach(c => {
    body += `<div class="cat-card" style="border-left:4px solid ${c.col}" onclick="location.href='/#categories'"><div class="cat-name">${escHtml(c.n)}</div><div class="cat-desc">${escHtml(c.d)}</div><div class="cat-count">${c.c} 篇</div></div>`;
  });
  body += '</div>';
  // Article list by category
  cats.forEach(c => {
    body += `<section style="margin-top:32px"><h2 style="font-size:18px;margin-bottom:12px">${escHtml(c.n)}</h2>`;
    articleOrder.forEach(id => {
      if (articles[id].category === c.f) {
        body += `<article style="margin-bottom:8px"><a href="/posts/${id}/" style="color:var(--on-surface);text-decoration:none">${escHtml(articles[id].title)}</a><span style="color:var(--on-surface-variant);margin-left:8px;font-size:13px">${escHtml(articles[id].date)}</span></article>`;
      }
    });
    body += '</section>';
  });
  fs.writeFileSync(path.join(dir, 'index.html'), seoPageHead('分类', SITE_CONFIG.description) + body + seoPageFoot());
  console.log('  ✓ categories/index.html');
}

// Archive page
{
  const dir = path.join(OUT_DIR, 'archive');
  fs.mkdirSync(dir, { recursive: true });
  // Group by year
  const byYear = {};
  articleOrder.forEach(id => {
    const a = articles[id];
    const year = (a.dateISO || a.date || '').slice(0, 4) || '未知';
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push({ id, ...a });
  });
  let body = `<section class="page-hero"><h1>归档</h1><p>共 ${articleOrder.length} 篇文章</p></section>`;
  Object.keys(byYear).sort((a, b) => b.localeCompare(a)).forEach(year => {
    body += `<h2 style="font-size:20px;margin:24px 0 12px">${escHtml(year)}</h2>`;
    byYear[year].forEach(a => {
      body += `<article style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--outline-variant)"><span style="color:var(--on-surface-variant);font-size:13px;white-space:nowrap">${escHtml(a.date)}</span><a href="/posts/${a.id}/" style="color:var(--on-surface);text-decoration:none;flex:1">${escHtml(a.title)}</a></article>`;
    });
  });
  fs.writeFileSync(path.join(dir, 'index.html'), seoPageHead('归档', SITE_CONFIG.description) + body + seoPageFoot());
  console.log('  ✓ archive/index.html');
}

// Friends page
{
  const dir = path.join(OUT_DIR, 'friends');
  fs.mkdirSync(dir, { recursive: true });
  let body = `<section class="page-hero"><h1>友链</h1><p>这些站点值得关注。</p></section><div class="fl-grid">`;
  SITE_CONFIG.friends.forEach(f => {
    body += `<a class="fl-card" href="${escHtml(f.url)}" target="_blank" rel="noopener"><img class="fl-avatar" src="${escHtml(f.avatar)}" alt="${escHtml(f.name)}" width="48" height="48"><div class="fl-info"><div class="fl-name">${escHtml(f.name)}</div><div class="fl-desc">${escHtml(f.desc)}</div></div></a>`;
  });
  body += '</div>';
  if (commentsEnabled && commentsApi) {
    body += '<link rel="stylesheet" href="/theme/comments.css?v=1785775352">';
    body += '<section class="comment-section"><div id="friendsCommentInner"></div></section>';
    body += '<script src="/theme/comments.js"></script>';
    body += `<script>new window.HaprialComments(document.getElementById("friendsCommentInner"),{api:"${escHtml(commentsApi)}",page:"/friends/"})</script>`;
  }
  fs.writeFileSync(path.join(dir, 'index.html'), seoPageHead('友链', '这些站点值得关注。') + body + seoPageFoot());
  console.log('  ✓ friends/index.html');
}

// About page
{
  const dir = path.join(OUT_DIR, 'about');
  fs.mkdirSync(dir, { recursive: true });
  let body = `<div class="about-center"><div class="about-mono"><img src="/avatar.png" alt="${escHtml(SITE_CONFIG.author)}" width="72" height="72"></div><h1>${escHtml(SITE_CONFIG.author)}</h1><p class="about-tagline">${escHtml(SITE_CONFIG.tagline)}</p><div class="about-divider"></div><div class="about-bio">${SITE_CONFIG.bio.split('\n').filter(Boolean).map(p => '<p>' + escHtml(p) + '</p>').join('')}</div><div class="about-divider"></div><h3 class="about-section-title">技术栈</h3><div class="about-skill-list">${SITE_CONFIG.skills.map(s => '<span class="about-skill">' + escHtml(s) + '</span>').join('')}</div><div class="about-divider"></div><div class="about-stats"><div class="about-stat"><span class="about-stat-num">${articleOrder.length}</span><span class="about-stat-label">篇文章</span></div><div class="about-stat"><span class="about-stat-num">${cats.length}</span><span class="about-stat-label">个分类</span></div><div class="about-stat"><span class="about-stat-num">${allTags.length}</span><span class="about-stat-label">个标签</span></div></div><div class="about-divider"></div><div class="about-links">${SITE_CONFIG.links.map(l => '<a class="about-link" href="' + escHtml(l.url) + '" target="_blank" rel="noopener">' + escHtml(l.name) + '</a>').join('')}</div></div>`;
  fs.writeFileSync(path.join(dir, 'index.html'), seoPageHead('关于', SITE_CONFIG.description) + body + seoPageFoot());
  console.log('  ✓ about/index.html');
}

// Copy theme assets
const themeOut = path.join(OUT_DIR, 'theme');
fs.mkdirSync(themeOut, { recursive: true });
fs.copyFileSync(path.join(THEME_DIR, 'styles.css'), path.join(themeOut, 'styles.css'));
fs.copyFileSync(path.join(THEME_DIR, 'app.js'), path.join(themeOut, 'app.js'));
fs.copyFileSync(path.join(THEME_DIR, 'lightbox.js'), path.join(themeOut, 'lightbox.js'));
if (commentsEnabled) {
  fs.copyFileSync(path.join(THEME_DIR, 'comments.css'), path.join(themeOut, 'comments.css'));
  fs.copyFileSync(path.join(THEME_DIR, 'comments.js'), path.join(themeOut, 'comments.js'));
}
console.log('  ✓ theme/');

// Copy static assets
if (fs.existsSync(STATIC_DIR)) {
  const copyDir = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(f => {
      const sp = path.join(src, f);
      const dp = path.join(dest, f);
      if (fs.statSync(sp).isDirectory()) copyDir(sp, dp);
      else fs.copyFileSync(sp, dp);
    });
  };
  copyDir(STATIC_DIR, OUT_DIR);
  console.log('  ✓ static/');
}

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
// Use the most recent article date as the homepage lastmod
const latestDate = articleOrder.length ? articles[articleOrder[0]].dateISO : today;
let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
sitemap += `  <url><loc>${SITE_CONFIG.url}/</loc><lastmod>${latestDate}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
articleOrder.forEach(id => {
  sitemap += `  <url><loc>${SITE_CONFIG.url}/posts/${id}/</loc><lastmod>${articles[id].dateISO}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
});
['tags', 'categories', 'archive', 'friends', 'about'].forEach(pg => {
  sitemap += `  <url><loc>${SITE_CONFIG.url}/${pg}/</loc><lastmod>${latestDate}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>\n`;
});
sitemap += '</urlset>';
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemap);
console.log('  ✓ sitemap.xml');

// Generate robots.txt
const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_CONFIG.url}/sitemap.xml
`;
fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots);
console.log('  ✓ robots.txt');

// Generate RSS feed
let rss = '<?xml version="1.0" encoding="UTF-8"?>\n';
rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
rss += '<channel>\n';
rss += `  <title>${escHtml(SITE_CONFIG.title)}</title>\n`;
rss += `  <link>${SITE_CONFIG.url}</link>\n`;
rss += `  <description>${escHtml(SITE_CONFIG.description)}</description>\n`;
rss += `  <language>zh-CN</language>\n`;
rss += `  <atom:link href="${SITE_CONFIG.url}/rss.xml" rel="self" type="application/rss+xml"/>\n`;
articleOrder.forEach(id => {
  const a = articles[id];
  rss += '  <item>\n';
  rss += `    <title>${escHtml(a.title)}</title>\n`;
  rss += `    <link>${SITE_CONFIG.url}/posts/${id}/</link>\n`;
  rss += `    <guid>${SITE_CONFIG.url}/posts/${id}/</guid>\n`;
  rss += `    <pubDate>${a.dateISO ? new Date(a.dateISO).toUTCString() : ''}</pubDate>\n`;
  rss += `    <description>${escHtml(a.excerpt)}</description>\n`;
  rss += `    <content:encoded><![CDATA[${a.content}]]></content:encoded>\n`;
  rss += '  </item>\n';
});
rss += '</channel>\n</rss>';
fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), rss);
console.log('  ✓ rss.xml');

// Generate 404 page
const notFoundHtml = fs.readFileSync(path.join(ROOT, 'src', '404.html'), 'utf8');
fs.writeFileSync(path.join(OUT_DIR, '404.html'), notFoundHtml);
console.log('  ✓ 404.html');

console.log('\n✅ Build complete! Output: dist/');
console.log('   Articles: ' + articleOrder.length);
console.log('   Tags: ' + allTags.length);
console.log('   Categories: ' + cats.length);

// Save build cache for next incremental run
saveCache({
  globalFp,
  articles: loadArticles._newArticleCache || {},
  outputHashes: newOutputHashes,
  lastBuild: new Date().toISOString()
});
console.log('   Cache saved for next build');
