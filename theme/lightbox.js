// Lightbox — Material Design 3
// Shared module: used by SPA (app.js) and standalone post pages
window.__initLightbox = function(articleBody) {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  var lb       = document.getElementById('lightbox');
  var lbImg    = document.getElementById('lightboxImg');
  var lbWrap   = document.getElementById('lbImgWrap');
  var lbStage  = document.getElementById('lbStage');
  var lbClose  = document.getElementById('lightboxClose');
  var lbPrev   = document.getElementById('lbPrev');
  var lbNext   = document.getElementById('lbNext');
  var lbCounter= document.getElementById('lbCounter');
  var lbScrim  = document.getElementById('lbScrim');
  var lbLocate = document.getElementById('lbLocate');
  var lbDl     = document.getElementById('lbDownload');
  if (!lb || !lbImg || !lbClose) return;

  // ── Caption (created once, appended to lightbox root) ─────────────────────
  var caption = document.createElement('div');
  caption.className = 'lb-caption';
  caption.setAttribute('aria-live', 'polite');
  lb.appendChild(caption);

  // ── MD3 glass panel: wraps the image stage to give the whole viewer a
  // frosted-card surface (solves the washed-out gap between scrim and image).
  var lbPanel = document.createElement('div');
  lbPanel.className = 'lb-panel';
  if (lbStage) {
    lbStage.insertBefore(lbPanel, lbWrap);
    lbPanel.appendChild(lbWrap);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var images = [];      // [{el, src, alt}, ...]
  var curIdx = 0;
  var scale  = 1;
  var panX   = 50;
  var panY   = 50;
  var switching   = false;
  var dragging    = false;
  var dragStartX  = 0;
  var dragStartY  = 0;
  var curDragX    = 0;
  var curDragY    = 0;
  var justDragged = false;
  var origImgEl   = null;
  var origRect    = null;
  var spinner     = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showSpinner() {
    if (!spinner) { spinner = document.createElement('div'); spinner.className = 'lb-spinner'; }
    lbWrap.appendChild(spinner);
    lbImg.classList.add('loading');
  }
  function hideSpinner() {
    if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
    lbImg.classList.remove('loading');
  }
  var zoomIndicator = null;
  function showZoomLevel(z) {
    if (!zoomIndicator) { zoomIndicator = document.createElement('div'); zoomIndicator.className = 'zoom-indicator'; lb.appendChild(zoomIndicator); }
    zoomIndicator.textContent = Math.round(z * 100) + '%';
    zoomIndicator.classList.add('show');
    clearTimeout(zoomIndicator._t);
    zoomIndicator._t = setTimeout(function() { zoomIndicator.classList.remove('show'); }, 800);
  }

  // Wait for image load with timeout fallback
  function waitLoad(cb, ms) {
    var timer = setTimeout(function() { hideSpinner(); cb(); }, ms || 10000);
    if (lbImg.complete && lbImg.naturalWidth > 0) { clearTimeout(timer); hideSpinner(); cb(); return; }
    lbImg.onload  = function() { clearTimeout(timer); hideSpinner(); cb(); };
    lbImg.onerror = function() { clearTimeout(timer); hideSpinner(); cb(); };
  }

  // ── Collect images from article body ──────────────────────────────────────
  // Must be called every time to handle SPA article switches
  function collect() {
    images = [];
    var imgs = articleBody.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i];
      var fig = el.closest('figure');
      var cap = fig ? fig.querySelector('figcaption') : null;
      images.push({ el: el, src: el.src, alt: cap ? cap.textContent.trim() : (el.alt || '') });
    }
  }

  // ── Find index of a clicked img element ───────────────────────────────────
  // Uses DOM position (querySelectorAll order) instead of object reference
  function indexOf(imgEl) {
    // Reuse collect()'s images array, avoiding a second querySelectorAll.
    for (var i = 0; i < images.length; i++) {
      if (images[i].el === imgEl) return i;
    }
    return -1;
  }

  // ── Zoom reset ────────────────────────────────────────────────────────────
  function resetZoom(instant) {
    if (instant) lbImg.style.transition = 'none';
    lbImg.style.transform = '';
    if (instant) { void lbImg.offsetWidth; lbImg.style.transition = ''; }
    scale = 1; panX = 50; panY = 50;
    if (lbWrap) lbWrap.classList.remove('zoomed', 'panning');
    if (zoomIndicator) showZoomLevel(1);
    setTimeout(function() { lbImg.style.transformOrigin = '50% 50%'; }, instant ? 10 : 360);
  }

  // ── Update nav buttons + counter ──────────────────────────────────────────
  function updateNav() {
    if (!lbPrev || !lbNext) return;
    var show = images.length > 1;
    lbPrev.style.display = show ? '' : 'none';
    lbNext.style.display = show ? '' : 'none';
    if (lbCounter) lbCounter.textContent = show ? (curIdx + 1) + ' / ' + images.length : '';
  }

  // ── Show/hide caption ─────────────────────────────────────────────────────
  function showCaption(text) {
    if (!text) { caption.style.display = 'none'; return; }
    caption.textContent = text;
    caption.style.display = 'block';
  }

  // ── Open lightbox at index ────────────────────────────────────────────────
  var _lbPushed = false;  // tracks whether we pushed a history state

  function open(idx) {
    collect();                          // always fresh
    if (idx < 0 || idx >= images.length) idx = 0;
    if (!images.length) return;
    curIdx = idx;
    resetZoom(true);
    updateNav();

    showSpinner();
    lbImg.src = images[curIdx].src;
    lbImg.alt = images[curIdx].alt || '';
    showCaption(images[curIdx].alt);

    lbImg.style.animation = '';
    lbImg.classList.remove('lb-closing');
    lbImg.style.transform = '';
    lbImg.style.opacity = '';
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Push history state so back button closes lightbox
    if (!_lbPushed) {
      history.pushState({ _lb: true }, '');
      _lbPushed = true;
    }

    if (origImgEl) origRect = origImgEl.getBoundingClientRect();
    waitLoad(function() {
      // FLIP: grow from the clicked image rect into the centered stage.
      if (origRect && lbImg.naturalWidth) {
        var r = lbImg.getBoundingClientRect();
        var sx = origRect.width / r.width;
        var sy = origRect.height / r.height;
        var sF = Math.min(sx, sy);
        var dx = origRect.left + origRect.width / 2 - (r.left + r.width / 2);
        var dy = origRect.top + origRect.height / 2 - (r.top + r.height / 2);
        lbImg.style.transformOrigin = '50% 50%';
        lbImg.animate([
          {transform:'translate('+dx+'px,'+dy+'px) scale('+sF+')',opacity:0},
          {transform:'translate(0,0) scale(1)',opacity:1}
        ],{duration:320,easing:'cubic-bezier(.2,0,0,1)',fill:'forwards'});
      } else {
        lbImg.animate([
          {opacity:0,transform:'scale(.92)'},
          {opacity:1,transform:'scale(1)'}
        ],{duration:300,easing:'cubic-bezier(0,0,.2,1)',fill:'forwards'});
      }
    });
  }

  // Close-out animation shared by close() and popstate (single sync layout read).
  function _startCloseAnimation() {
    if (origRect && lbImg.naturalWidth) {
      var r = lbImg.getBoundingClientRect();
      var sx = origRect.width / r.width;
      var sy = origRect.height / r.height;
      var s = Math.min(sx, sy);
      var dx = origRect.left + origRect.width / 2 - (r.left + r.width / 2);
      var dy = origRect.top + origRect.height / 2 - (r.top + r.height / 2);
      lbImg.style.transformOrigin = '50% 50%';
      var anim = lbImg.animate([
        {transform:'translate(0,0) scale(1)',opacity:1},
        {transform:'translate('+dx+'px,'+dy+'px) scale('+s+')',opacity:0}
      ],{duration:300,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
      anim.onfinish = finishClose;
    } else {
      finishClose();
    }
  }

  // ── Close lightbox ────────────────────────────────────────────────────────
  function close() {
    if (switching) return;
    _cancelGestures();
    if (scale > 1) resetZoom(true);

    // Pop history state if we pushed one
    if (_lbPushed) {
      _lbPushed = false;
      history.back();
      return;
    }

    _startCloseAnimation();
  }

  // ── Back button (popstate) closes lightbox instead of navigating ───────────
  window.addEventListener('popstate', function(e) {
    if (lb.classList.contains('open')) {
      _lbPushed = false;
      _startCloseAnimation();
    }
  });

  function finishClose() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.classList.remove('lb-closing');
    lbImg.style.transform = '';
    lbImg.style.opacity = '';
    lbImg.style.animation = '';
    lbImg.getAnimations().forEach(function(a){a.cancel()});
    lbImg.src = '';
    caption.style.display = 'none';
    origImgEl = null;
    origRect = null;
    caption.style.display = 'none';
    origImgEl = null;
    origRect = null;
  }

  // ── Navigate prev/next ────────────────────────────────────────────────────
  function animateSwitch(newIdx, dir) {
    if (switching || newIdx < 0 || newIdx >= images.length) return;
    switching = true;
    resetZoom(true);

    var outX = dir === 'next' ? '-25%' : '25%';
    var inX  = dir === 'next' ? '25%' : '-25%';

    lbImg.animate([
      {opacity:1,transform:'translateX(0)'},
      {opacity:0,transform:'translateX('+outX+')'}
    ],{duration:200,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}).onfinish = function() {
      curIdx = newIdx;
      showSpinner();
      lbImg.src = images[curIdx].src;
      lbImg.alt = images[curIdx].alt || '';
      updateNav();
      showCaption(images[curIdx].alt);

      waitLoad(function() {
        lbImg.animate([
          {opacity:0,transform:'translateX('+inX+')'},
          {opacity:1,transform:'translateX(0)'}
        ],{duration:280,easing:'cubic-bezier(0,0,.2,1)',fill:'forwards'});
        setTimeout(function() { switching = false; }, 290);
      });
    };
  }

  function goNext() { animateSwitch(curIdx + 1, 'next'); }
  function goPrev() { animateSwitch(curIdx - 1, 'prev'); }

  // ── Click: open lightbox on image click ───────────────────────────────────
  articleBody.addEventListener('click', function(e) {
    var img = e.target.closest('img');
    if (!img || !articleBody.contains(img)) return;
    e.preventDefault();
    origImgEl = img;
    collect();   // build images cache once, indexOf reuses it
    var idx = indexOf(img);
    open(idx >= 0 ? idx : 0);
  });

  // ── Click: close on scrim/stage backdrop (outside the glass panel) ────────
  // Stage fills the whole viewport behind the centered panel; clicking anywhere
  // besides the panel, toolbar, bottombar or image closes the lightbox.
  if (lbStage) lbStage.addEventListener('click', function(e) {
    if (e.target === lbStage || e.target === lbScrim) close();
  });
  if (lbScrim) lbScrim.addEventListener('click', close);
  // Clicking the glass panel surface (its padding / empty area) should keep the
  // viewer open — only clicking the scrim outside the card closes it.
  if (lbPanel) lbPanel.addEventListener('click', function(e) {
    if (e.target === lbPanel) e.stopPropagation();
  });

  // ── Click: zoom on image ──────────────────────────────────────────────────
  if (lbWrap) lbWrap.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!lbImg.naturalWidth || switching) return;
    if (justDragged) { justDragged = false; return; }
    if (scale > 1) { resetZoom(); return; }
    var r = lbImg.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width * 100;
    var py = (e.clientY - r.top) / r.height * 100;
    lbImg.style.transformOrigin = px + '% ' + py + '%';
    lbImg.style.transform = 'scale(2.5)';
    scale = 2.5; panX = px; panY = py;
    lbWrap.classList.add('zoomed');
    showZoomLevel(2.5);
  });

  // ── Mouse drag (when zoomed) ──────────────────────────────────────────────
  // Raf-throttled: event handler only records pointer coords, actual
  // transform write happens once per animation frame (avoids forced reflow).
  if (lbWrap) {
    var _dragRaf = null;
    // Cache image layout size: transform changes don't alter offsetWidth/Height,
    // so we only read it once when drag starts and reuse it during the drag.
    var _dragOX = 0, _dragOY = 0;
    function _applyMouseDrag() {
      _dragRaf = null;
      var dx = (curDragX - dragStartX) / _dragOX * 100;
      var dy = (curDragY - dragStartY) / _dragOY * 100;
      panX = Math.max(0, Math.min(100, panX - dx));
      panY = Math.max(0, Math.min(100, panY - dy));
      dragStartX = curDragX; dragStartY = curDragY;
      lbImg.style.transformOrigin = panX + '% ' + panY + '%';
    }
    var _dragMoved = false;
    var DRAG_THRESHOLD = 5; // px of real movement needed to classify as a drag (not a click)
    lbWrap.addEventListener('mousedown', function(e) {
      if (scale <= 1) return;
      e.preventDefault();
      dragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
      curDragX = e.clientX; curDragY = e.clientY;
      _dragOX = lbImg.offsetWidth; _dragOY = lbImg.offsetHeight;
      lbImg.style.transition = 'none';
      _dragMoved = false; // do NOT set justDragged here anymore → a plain click can zoom-toggle
      lbWrap.classList.add('panning');
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      curDragX = e.clientX; curDragY = e.clientY;
      if (!_dragMoved &&
          (Math.abs(curDragX - dragStartX) > DRAG_THRESHOLD ||
           Math.abs(curDragY - dragStartY) > DRAG_THRESHOLD)) {
        _dragMoved = true;
      }
      if (!_dragRaf) _dragRaf = requestAnimationFrame(_applyMouseDrag);
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      // Only suppress the upcoming click if the user actually dragged the image.
      // A plain click (no move beyond threshold) leaves justDragged false so the
      // click handler reaches resetZoom() and shrinks the image in one tap.
      if (_dragMoved) justDragged = true;
      _dragMoved = false;
      if (_dragRaf) { cancelAnimationFrame(_dragRaf); _dragRaf = null; }
      lbImg.style.transition = '';
      if (lbWrap) lbWrap.classList.remove('panning');
    });
  }

  // ── Nav buttons ───────────────────────────────────────────────────────────
  if (lbPrev) lbPrev.addEventListener('click', function(e) { e.stopPropagation(); goPrev(); });
  if (lbNext) lbNext.addEventListener('click', function(e) { e.stopPropagation(); goNext(); });
  lbClose.addEventListener('click', close);

  // ── Download button ───────────────────────────────────────────────────────
  if (lbDl) lbDl.addEventListener('click', function() {
    if (!lbImg.src) return;
    var a = document.createElement('a');
    a.href = lbImg.src;
    a.download = lbImg.alt || 'image';
    a.click();
  });

  // ── Locate button (scroll to image in article) ────────────────────────────
  if (lbLocate) lbLocate.addEventListener('click', function() {
    if (curIdx < 0 || curIdx >= images.length) return;
    var target = images[curIdx].el;
    if (!target) return;
    close();
    // Wait for close animation + one extra frame for reflow
    setTimeout(function() { requestAnimationFrame(function() {
      var av = document.getElementById('articleView');
      if (!av) return;
      var ir = target.getBoundingClientRect();
      var ar = av.getBoundingClientRect();
      var top = av.scrollTop + (ir.top - ar.top) - av.clientHeight / 2 + ir.height / 2;
      top = Math.max(0, top);
      var start = av.scrollTop;
      var dist = top - start;
      var dur = Math.min(600, Math.abs(dist) * 0.3);
      if (dur < 16) { av.scrollTop = top; }
      else {
        var t0 = 0;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          av.scrollTop = start + dist * (1 - Math.pow(1 - p, 3));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
      // outline-offset:-3 draws inside the image, never clipped by overflow
      target.style.outline = '3px solid var(--primary)';
      target.style.outlineOffset = '-3px';
      setTimeout(function() { target.style.outline = ''; target.style.outlineOffset = ''; }, 2000);
    }); }, 350);
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') { close(); return; }
    if (scale <= 1 && !switching) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    }
  });

  // ── Touch: swipe to navigate, pinch to zoom ───────────────────────────────
  var touchX0 = 0, touchY0 = 0, touchT0 = 0;
  var pinchDist0 = 0, pinchScale0 = 1, isPinching = false;
  // Raf-throttled touch gesture write-back (avoids per-event reflow)
  var _touchRaf = null, _tScale = 1, _tOX = 0, _tOY = 0;
  function _applyTouchGesture() {
    _touchRaf = null;
    scale = _tScale;
    lbImg.style.transformOrigin = panX + '% ' + panY + '%';
    lbImg.style.transform = 'scale(' + scale + ')';
    if (scale > 1.001) lbWrap.classList.add('zoomed');
  }
  function _scheduleTouchWrite() {
    if (_touchRaf) return;
    _touchRaf = requestAnimationFrame(function() {
      _touchRaf = null;
      _applyTouchGesture();
    });
  }
  // Cancel any pending touch/mouse gesture write-back (used on gesture end).
  function _cancelGestures() {
    if (_touchRaf) { cancelAnimationFrame(_touchRaf); _touchRaf = null; }
    if (_dragRaf)  { cancelAnimationFrame(_dragRaf);  _dragRaf  = null; }
    lbImg.style.transition = '';
  }

  if (lbWrap) {
    lbWrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        isPinching = true;
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist0 = Math.sqrt(dx * dx + dy * dy);
        pinchScale0 = scale;
        _tOX = lbImg.offsetWidth; _tOY = lbImg.offsetHeight;
        panX = (e.touches[0].clientX + e.touches[1].clientX) / 2 / _tOX * 100;
        panY = (e.touches[0].clientY + e.touches[1].clientY) / 2 / _tOY * 100;
        lbImg.style.transition = 'none';
      } else if (e.touches.length === 1 && scale <= 1) {
        touchX0 = e.touches[0].clientX;
        touchY0 = e.touches[0].clientY;
        touchT0 = Date.now();
      }
    }, { passive: false });

    lbWrap.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        _tScale = Math.max(1, Math.min(5, pinchScale0 * (dist / pinchDist0)));
        _scheduleTouchWrite();
      } else if (e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        var dx = (e.touches[0].clientX - dragStartX) / _tOX * 100;
        var dy = (e.touches[0].clientY - dragStartY) / _tOY * 100;
        panX = Math.max(0, Math.min(100, panX - dx));
        panY = Math.max(0, Math.min(100, panY - dy));
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        _tScale = scale;
        _scheduleTouchWrite();
      }
    }, { passive: false });

    lbWrap.addEventListener('touchend', function(e) {
      if (isPinching) {
        isPinching = false;
        // Cancel pending raf, but use the latest _tScale so the final pinch
        // increment (possibly still queued in the raf) is not lost on release.
        if (_touchRaf) { cancelAnimationFrame(_touchRaf); _touchRaf = null; }
        scale = _tScale;
        lbImg.style.transition = '';
        lbImg.style.transformOrigin = panX + '% ' + panY + '%';
        lbImg.style.transform = 'scale(' + _tScale + ')';
        if (_tScale <= 1.001) resetZoom();
        return;
      }
      if (e.touches.length === 0) _cancelGestures();
      if (e.changedTouches.length === 1 && scale <= 1) {
        var dx = e.changedTouches[0].clientX - touchX0;
        var dy = e.changedTouches[0].clientY - touchY0;
        var dt = Date.now() - touchT0;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50 && dt < 500) {
          if (dx < 0) goNext(); else goPrev();
        }
      }
    });

    // Pan while zoomed (touch)
    lbWrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1 && scale > 1) {
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        curDragX = e.touches[0].clientX;
        curDragY = e.touches[0].clientY;
        _tOX = lbImg.offsetWidth; _tOY = lbImg.offsetHeight;
        lbImg.style.transition = 'none';
      }
    }, { passive: true });
  }

  // ── Expose close for external use (ESC handler in app.js) ─────────────────
  window.__lbClose = close;
};
