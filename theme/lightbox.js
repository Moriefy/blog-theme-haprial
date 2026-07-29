// Lightbox — Material Design 3 (shared module)
// Used by both SPA (app.js) and standalone post pages (build.js)
window.__initLightbox = function(articleBody) {
  var lb=document.getElementById('lightbox');
  var lbImg=document.getElementById('lightboxImg');
  var lbWrap=document.getElementById('lbImgWrap');
  var lbStage=document.getElementById('lbStage');
  var lbClose=document.getElementById('lightboxClose');
  var lbPrev=document.getElementById('lbPrev');
  var lbNext=document.getElementById('lbNext');
  var lbCounter=document.getElementById('lbCounter');
  var lbScrim=document.getElementById('lbScrim');
  var lbLocate=document.getElementById('lbLocate');
  var lbDownload=document.getElementById('lbDownload');
  if(!lb||!lbImg||!lbClose)return;

  var images=[],currentIdx=0,scale=1,panOX=50,panOY=50;
  var dragging=false,startX=0,startY=0,switching=false,justDragged=false;
  var spinner=null;
  var _origImg=null,_origRect=null;

  function showSpinner(){if(!spinner){spinner=document.createElement('div');spinner.className='lb-spinner'}lbWrap.appendChild(spinner);lbImg.classList.add('loading')}
  function hideSpinner(){if(spinner&&spinner.parentNode)spinner.parentNode.removeChild(spinner);lbImg.classList.remove('loading')}
  function waitImgLoad(cb,timeout){
    var timer=setTimeout(function(){hideSpinner();cb()},timeout||10000);
    if(lbImg.complete&&lbImg.naturalWidth>0){clearTimeout(timer);hideSpinner();cb();return}
    lbImg.onload=function(){clearTimeout(timer);hideSpinner();cb()};
    lbImg.onerror=function(){clearTimeout(timer);hideSpinner();cb()};
  }

  function collectImages(){images=[].slice.call(articleBody.querySelectorAll('img'))}
  function resetZoom(opts){
    var instant=opts&&opts.instant;
    if(instant)lbImg.style.transition='none';
    lbImg.style.transform='';
    if(instant){void lbImg.offsetWidth;lbImg.style.transition=''}
    scale=1;panOX=50;panOY=50;
    if(lbWrap)lbWrap.classList.remove('zoomed','panning');
    // Reset origin AFTER animation completes (not before)
    setTimeout(function(){lbImg.style.transformOrigin='50% 50%'},instant?10:360);
  }
  function updateNav(){if(!lbPrev||!lbNext)return;var show=images.length>1;lbPrev.style.display=show?'':'none';lbNext.style.display=show?'':'none';if(lbCounter)lbCounter.textContent=show?(currentIdx+1)+' / '+images.length:''}

  function openLb(idx){
    if(idx<0||idx>=images.length)return;
    if(!images.length)collectImages();currentIdx=idx;resetZoom();updateNav();
    showSpinner();lbImg.src=images[idx].src;lbImg.alt=images[idx].alt||'';
    lbImg.style.animation='';lbImg.classList.remove('lb-closing');lbImg.style.transform='';lbImg.style.opacity='';
    lb.classList.add('open');document.body.style.overflow='hidden';
    if(_origImg){_origRect=_origImg.getBoundingClientRect()}
    waitImgLoad(function(){lbImg.style.animation='lbEnterAnim .3s cubic-bezier(0,0,.2,1) both';setTimeout(function(){lbImg.style.animation=''},350)});
  }

  function closeLb(){
    if(switching)return;
    if(scale>1)resetZoom({instant:true});
    if(_origRect&&lbImg.naturalWidth){
      var lbRect=lbImg.getBoundingClientRect();
      var sx=_origRect.width/lbRect.width;
      var sy=_origRect.height/lbRect.height;
      var s=Math.min(sx,sy);
      var dx=_origRect.left+_origRect.width/2-(lbRect.left+lbRect.width/2);
      var dy=_origRect.top+_origRect.height/2-(lbRect.top+lbRect.height/2);
      lbImg.classList.add('lb-closing');
      lbImg.style.transform='translate('+dx+'px,'+dy+'px) scale('+s+')';
      lbImg.style.opacity='0';
      lbImg.style.transformOrigin='50% 50%';
      setTimeout(function(){lb.classList.remove('open');document.body.style.overflow='';lbImg.classList.remove('lb-closing');lbImg.style.transform='';lbImg.style.opacity='';lbImg.src='';_origImg=null;_origRect=null},340);
    }else{
      lb.classList.remove('open');document.body.style.overflow='';setTimeout(function(){lbImg.src=''},300)
    }
  }

  function animateSwitch(newIdx,dir){
    if(switching||newIdx<0||newIdx>=images.length)return;switching=true;resetZoom({instant:true});
    var outAnim=dir==='next'?'fbSlideOutL .2s cubic-bezier(.4,0,1,1)':'fbSlideOutR .2s cubic-bezier(.4,0,1,1)';
    var inAnim=dir==='next'?'fbSlideInR .28s cubic-bezier(0,0,.2,1)':'fbSlideInL .28s cubic-bezier(0,0,.2,1)';
    lbImg.style.animation=outAnim;
    setTimeout(function(){
      currentIdx=newIdx;showSpinner();lbImg.src=images[currentIdx].src;lbImg.alt=images[currentIdx].alt||'';updateNav();
      waitImgLoad(function(){lbImg.style.animation=inAnim;setTimeout(function(){lbImg.style.animation='';switching=false},290)});
    },210);
  }
  function goNext(){animateSwitch(currentIdx+1,'next')}
  function goPrev(){animateSwitch(currentIdx-1,'prev')}

  articleBody.addEventListener('click',function(e){var img=e.target.closest('img');if(img&&articleBody.contains(img)){e.preventDefault();_origImg=img;collectImages();var idx=images.indexOf(img);openLb(idx>=0?idx:0)}});
  if(lbStage)lbStage.addEventListener('click',function(e){if(e.target===lbStage||e.target===lbScrim)closeLb()});
  if(lbScrim)lbScrim.addEventListener('click',closeLb);
  if(lbWrap)lbWrap.addEventListener('click',function(e){
    e.stopPropagation();if(!lbImg.naturalWidth||switching)return;if(justDragged){justDragged=false;return}
    if(scale>1){resetZoom();return}
    var rect=lbImg.getBoundingClientRect();var px=(e.clientX-rect.left)/rect.width*100;var py=(e.clientY-rect.top)/rect.height*100;
    lbImg.style.transformOrigin=px+'% '+py+'%';lbImg.style.transform='scale(2.5)';scale=2.5;panOX=px;panOY=py;lbWrap.classList.add('zoomed');
  });
  if(lbWrap){lbWrap.addEventListener('mousedown',function(e){if(scale<=1)return;e.preventDefault();dragging=true;startX=e.clientX;startY=e.clientY;lbWrap.classList.add('panning')});
  document.addEventListener('mousemove',function(e){if(!dragging)return;var dx=(e.clientX-startX)/lbImg.offsetWidth*100;var dy=(e.clientY-startY)/lbImg.offsetHeight*100;panOX=Math.max(0,Math.min(100,panOX-dx));panOY=Math.max(0,Math.min(100,panOY-dy));lbImg.style.transformOrigin=panOX+'% '+panOY+'%';startX=e.clientX;startY=e.clientY;justDragged=true});
  document.addEventListener('mouseup',function(){if(dragging){dragging=false;if(lbWrap)lbWrap.classList.remove('panning')}})}

  if(lbPrev)lbPrev.addEventListener('click',function(e){e.stopPropagation();goPrev()});
  if(lbNext)lbNext.addEventListener('click',function(e){e.stopPropagation();goNext()});
  lbClose.addEventListener('click',closeLb);
  if(lbDownload)lbDownload.addEventListener('click',function(){if(!lbImg.src)return;var a=document.createElement('a');a.href=lbImg.src;a.download=lbImg.alt||'image';a.click()});
  if(lbLocate)lbLocate.addEventListener('click',function(){if(currentIdx<0||currentIdx>=images.length)return;var target=images[currentIdx];if(!target)return;closeLb();setTimeout(function(){target.scrollIntoView({behavior:'smooth',block:'center'});target.style.outline='3px solid var(--primary)';target.style.outlineOffset='4px';setTimeout(function(){target.style.outline='';target.style.outlineOffset=''},2000)},350)});
  document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;if(e.key==='Escape'){closeLb();return}if(scale<=1&&!switching){if(e.key==='ArrowRight'){e.preventDefault();goNext()}if(e.key==='ArrowLeft'){e.preventDefault();goPrev()}}});

  // Touch support: swipe to navigate, pinch to zoom
  var touchStartX=0,touchStartY=0,touchStartTime=0;
  var pinchStartDist=0,pinchStartScale=1,isPinching=false;
  if(lbWrap){
    lbWrap.addEventListener('touchstart',function(e){
      if(e.touches.length===2){
        e.preventDefault();
        isPinching=true;
        var dx=e.touches[0].clientX-e.touches[1].clientX;
        var dy=e.touches[0].clientY-e.touches[1].clientY;
        pinchStartDist=Math.sqrt(dx*dx+dy*dy);
        pinchStartScale=scale;
        panOX=(e.touches[0].clientX+e.touches[1].clientX)/2/lbImg.offsetWidth*100;
        panOY=(e.touches[0].clientY+e.touches[1].clientY)/2/lbImg.offsetHeight*100;
      }else if(e.touches.length===1&&scale<=1){
        touchStartX=e.touches[0].clientX;
        touchStartY=e.touches[0].clientY;
        touchStartTime=Date.now();
      }
    },{passive:false});
    lbWrap.addEventListener('touchmove',function(e){
      if(e.touches.length===2&&isPinching){
        e.preventDefault();
        var dx=e.touches[0].clientX-e.touches[1].clientX;
        var dy=e.touches[0].clientY-e.touches[1].clientY;
        var dist=Math.sqrt(dx*dx+dy*dy);
        scale=Math.max(1,Math.min(5,pinchStartScale*(dist/pinchStartDist)));
        lbImg.style.transformOrigin=panOX+'% '+panOY+'%';
        lbImg.style.transform='scale('+scale+')';
        if(scale>1)lbWrap.classList.add('zoomed');
      }else if(e.touches.length===1&&scale>1){
        var dx=(e.touches[0].clientX-startX)/lbImg.offsetWidth*100;
        var dy=(e.touches[0].clientY-startY)/lbImg.offsetHeight*100;
        panOX=Math.max(0,Math.min(100,panOX-dx));
        panOY=Math.max(0,Math.min(100,panOY-dy));
        lbImg.style.transformOrigin=panOX+'% '+panOY+'%';
        startX=e.touches[0].clientX;
        startY=e.touches[0].clientY;
      }
    },{passive:false});
    lbWrap.addEventListener('touchend',function(e){
      if(isPinching){
        isPinching=false;
        if(scale<=1)resetZoom();
        return;
      }
      if(e.changedTouches.length===1&&scale<=1){
        var dx=e.changedTouches[0].clientX-touchStartX;
        var dy=e.changedTouches[0].clientY-touchStartY;
        var dt=Date.now()-touchStartTime;
        if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>50&&dt<500){
          if(dx<0)goNext();else goPrev();
        }
      }
    });
    lbWrap.addEventListener('touchstart',function(e){
      if(e.touches.length===1&&scale>1){
        startX=e.touches[0].clientX;
        startY=e.touches[0].clientY;
      }
    },{passive:true});
  }

  window.__lbClose=closeLb;
};
