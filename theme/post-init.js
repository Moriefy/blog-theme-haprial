// Post page initialization (shared module)
// Handles: lightbox, Prism.js, TOC scroll, image reveal for standalone post pages
(function(){
  'use strict';

  // 1. Load lightbox module
  var lbScript=document.createElement('script');
  lbScript.src='/theme/lightbox.js';
  lbScript.onload=function(){
    if(typeof window.__initLightbox==='function'){
      window.__initLightbox(document.querySelector('.article-body'));
    }
  };
  lbScript.onerror=function(){console.warn('[post-init] lightbox.js failed to load')};
  document.head.appendChild(lbScript);

  // 2. Prism.js lazy-load for code blocks
  var codeBlocks=document.querySelectorAll('pre code');
  if(codeBlocks.length){
    var cb=document.createElement('link');cb.rel='stylesheet';
    cb.href='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(cb);
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
    s.setAttribute('data-manual','');
    s.onload=function(){if(typeof Prism!=='undefined')try{Prism.highlightAll()}catch(e){console.warn('[post-init] Prism error:',e)}};
    s.onerror=function(){console.warn('[post-init] Prism.js failed to load')};
    document.head.appendChild(s);
  }

  // 3. Smooth TOC scroll
  document.querySelectorAll('.toc-item').forEach(function(li){
    li.addEventListener('click',function(){
      var t=document.getElementById(li.dataset.target);
      if(t)t.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });

  // 4. Image lazy load with blur placeholder
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
})();
