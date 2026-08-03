// Haprial Comments v2 — Material Design 3 Comment Module
// Features: infinite nesting, inline reply, likes, draft cache, device/location,
//            long comment fold, @mention, emoji, mobile optimization, keyboard guard
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var API = '';
  var currentPath = null;
  var currentLinkId = null;
  var comments = [];
  var loading = false;
  var submitting = false;
  var observer = null;
  var container = null;

  // Draft cache
  var DRAFT_KEY_PREFIX = 'cmt_draft_';
  var draftTimer = null;
  var DRAFT_DEBOUNCE = 800;

  // Likes tracking (localStorage)
  var LIKES_KEY = 'cmt_liked';

  // Visual nesting limit
  var MAX_VISUAL_DEPTH = 8;
  var INDENT_PX = 40;

  // Long comment threshold
  var FOLD_HEIGHT = 120;

  // ── Liked IDs ─────────────────────────────────────────────────────────────
  function getLikedIds() {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '[]'); } catch (e) { return []; }
  }
  function addLikedId(id) {
    var arr = getLikedIds();
    if (arr.indexOf(id) === -1) { arr.push(id); try { localStorage.setItem(LIKES_KEY, JSON.stringify(arr)); } catch (e) {} }
  }
  function isLiked(id) { return getLikedIds().indexOf(id) !== -1; }

  // ── Draft Cache ───────────────────────────────────────────────────────────
  function draftKey() { return DRAFT_KEY_PREFIX + (currentLinkId ? 'link_' + currentLinkId : (currentPath || '').replace(/\//g, '_')); }

  function saveDraft() {
    var nick = el('cmtNick'), email = el('cmtEmail'), website = el('cmtWebsite'), content = el('cmtContent');
    if (!nick) return;
    var data = { nick: nick.value, email: email ? email.value : '', website: website ? website.value : '', content: content ? content.value : '' };
    try { localStorage.setItem(draftKey(), JSON.stringify(data)); } catch (e) {}
  }

  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (!d) return;
      var nick = el('cmtNick'), email = el('cmtEmail'), website = el('cmtWebsite'), content = el('cmtContent');
      if (nick && d.nick) nick.value = d.nick;
      if (email && d.email) email.value = d.email;
      if (website && d.website) website.value = d.website;
      if (content && d.content) content.value = d.content;
    } catch (e) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) {}
  }

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, DRAFT_DEBOUNCE);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  var STYLE_ID = 'haprial-comments-css';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* Section */
      '.cmt-section{margin-top:48px;padding-top:32px;border-top:1px solid var(--outline-variant)}',
      '.cmt-header{display:flex;align-items:center;gap:10px;margin-bottom:24px}',
      '.cmt-title{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:18px;font-weight:600;color:var(--on-surface);letter-spacing:.01em}',
      '.cmt-count{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:12px;font-weight:500;color:var(--on-primary-container);background:var(--primary-container);padding:2px 10px;border-radius:var(--shape-full);min-width:24px;text-align:center}',

      /* Form */
      '.cmt-form{background:var(--surface-container-lowest);border:1px solid var(--outline-variant);border-radius:var(--shape-l);padding:20px 22px;margin-bottom:28px;transition:border-color 200ms}',
      '.cmt-form:focus-within{border-color:var(--primary)}',
      '.cmt-form-row{display:flex;gap:12px;margin-bottom:14px}',
      '.cmt-input{flex:1;height:40px;padding:0 14px;background:var(--surface-container);border:1px solid transparent;border-radius:var(--shape-s);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;color:var(--on-surface);outline:none;transition:border-color 200ms,background 200ms}',
      '.cmt-input:focus{border-color:var(--primary);background:var(--surface-container-lowest)}',
      '.cmt-input::placeholder{color:var(--outline)}',
      '.cmt-textarea{width:100%;min-height:100px;padding:12px 14px;background:var(--surface-container);border:1px solid transparent;border-radius:var(--shape-s);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;color:var(--on-surface);line-height:1.7;outline:none;resize:vertical;transition:border-color 200ms,background 200ms}',
      '.cmt-textarea:focus{border-color:var(--primary);background:var(--surface-container-lowest)}',
      '.cmt-textarea::placeholder{color:var(--outline)}',
      '.cmt-actions{display:flex;align-items:center;gap:12px;margin-top:14px}',
      '.cmt-hint{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:12px;color:var(--outline);flex:1}',
      '.cmt-hint code{font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--surface-container-high);padding:1px 5px;border-radius:3px}',
      '.cmt-hp{position:absolute;left:-9999px;opacity:0;height:0;width:0;overflow:hidden}',

      /* Inline reply form */
      '.cmt-inline-form{background:var(--surface-container-low);border:1px solid var(--outline-variant);border-radius:var(--shape-m);padding:14px 16px;margin:12px 0;animation:cmtFadeIn .2s cubic-bezier(0,0,.2,1) both}',
      '.cmt-inline-form .cmt-form-row{margin-bottom:10px}',
      '.cmt-inline-form .cmt-textarea{min-height:72px}',

      /* Buttons */
      '.cmt-btn{height:36px;padding:0 20px;border:none;border-radius:var(--shape-full);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:transform 150ms var(--motion-standard),box-shadow 200ms,background 200ms;position:relative;overflow:hidden}',
      '.cmt-btn:active{transform:scale(.96);transition-duration:60ms}',
      '.cmt-btn-primary{background:var(--primary);color:var(--on-primary);box-shadow:var(--e1)}',
      '.cmt-btn-primary:hover{box-shadow:var(--e2)}',
      '.cmt-btn-primary:disabled{opacity:.5;cursor:default;pointer-events:none}',
      '.cmt-btn-ghost{background:none;color:var(--on-surface-variant);padding:0 12px}',
      '.cmt-btn-ghost:hover{background:var(--surface-container-high)}',

      /* Comment list */
      '.cmt-list{display:flex;flex-direction:column;gap:0}',
      '.cmt-item{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cmt-item:last-child{border-bottom:none}',
      '.cmt-nest{border-left:2px solid var(--outline-variant);margin-left:0;padding-left:0}',
      '.cmt-nest .cmt-item{padding-left:0}',
      '.cmt-avatar{width:36px;height:36px;border-radius:var(--shape-full);display:flex;align-items:center;justify-content:center;font-family:\'Noto Sans SC\',sans-serif;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;user-select:none}',
      '.cmt-body{flex:1;min-width:0}',
      '.cmt-meta{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}',
      '.cmt-nick{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;font-weight:600;color:var(--on-surface)}',
      '.cmt-nick-link{color:var(--primary);text-decoration:none;border-bottom:1px solid transparent;transition:border-color 150ms}',
      '.cmt-nick-link:hover{border-bottom-color:var(--primary)}',
      '.cmt-time{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:12px;color:var(--outline)}',
      '.cmt-device{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:11px;color:var(--outline);background:var(--surface-container-high);padding:1px 6px;border-radius:var(--shape-xs)}',
      '.cmt-location{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:11px;color:var(--outline)}',
      '.cmt-mention{color:var(--primary);font-weight:500}',

      /* Reply tag */
      '.cmt-reply-tag{font-family:\'Noto Sans SC\',sans-serif;font-size:11px;color:var(--primary);background:var(--primary-container);padding:1px 8px;border-radius:var(--shape-full)}',

      /* Comment content */
      '.cmt-text{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;line-height:1.75;color:var(--on-surface-variant);word-break:break-word;position:relative}',
      '.cmt-text code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:2px 6px;border-radius:3px}',
      '.cmt-text strong{font-weight:600;color:var(--on-surface)}',
      '.cmt-text a{color:var(--primary);text-decoration:none;border-bottom:1px solid var(--primary-container)}',
      '.cmt-text a:hover{border-bottom-color:var(--primary)}',

      /* Long comment fold */
      '.cmt-text-fold{max-height:120px;overflow:hidden;position:relative}',
      '.cmt-text-fold::after{content:\'\';position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,var(--surface-container-lowest))}',
      '.cmt-fold-btn{display:inline-block;margin-top:6px;font-family:\'Noto Sans SC\',sans-serif;font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:2px 0}',
      '.cmt-fold-btn:hover{text-decoration:underline}',

      /* Actions row */
      '.cmt-actions-row{display:flex;align-items:center;gap:12px;margin-top:8px}',
      '.cmt-reply-btn{font-family:\'Noto Sans SC\',sans-serif;font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:2px 0;transition:color 150ms}',
      '.cmt-reply-btn:hover{color:var(--primary)}',
      '.cmt-like-btn{font-family:\'Noto Sans SC\',sans-serif;font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:2px 6px;transition:color 150ms;display:inline-flex;align-items:center;gap:4px;border-radius:var(--shape-full)}',
      '.cmt-like-btn:hover{color:var(--primary);background:var(--surface-container-high)}',
      '.cmt-like-btn.liked{color:var(--primary)}',
      '.cmt-like-count{font-variant-numeric:tabular-nums}',

      /* Nested replies */
      '.cmt-replies{margin-left:0;padding-left:20px;border-left:2px solid var(--outline-variant)}',
      '.cmt-replies .cmt-item{padding:14px 0}',
      '.cmt-replies .cmt-avatar{width:30px;height:30px;font-size:12px}',

      /* Deep nesting accent */
      '.cmt-depth-accent{border-left:3px solid var(--primary);background:var(--surface-container-low);border-radius:0 var(--shape-s) var(--shape-s) 0;padding-left:12px;margin-left:0}',

      /* Empty / Error / Skeleton */
      '.cmt-empty{text-align:center;padding:40px 0;font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif}',
      '.cmt-empty-icon{font-size:32px;margin-bottom:12px;opacity:.3}',
      '.cmt-empty-text{font-size:14px;color:var(--outline)}',
      '.cmt-error{text-align:center;padding:20px;font-family:\'Noto Sans SC\',sans-serif;font-size:13px;color:var(--outline)}',
      '.cmt-error button{margin-top:8px}',
      '.cmt-skel{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cmt-skel-avatar{width:36px;height:36px;border-radius:50%;background:var(--surface-container-high)}',
      '.cmt-skel-body{flex:1}',
      '.cmt-skel-line{height:12px;border-radius:6px;background:var(--surface-container-high);margin-bottom:10px}',
      '@keyframes cmtShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',
      '.cmt-skel-line{background:linear-gradient(90deg,var(--surface-container-high) 0,var(--surface-container) 40%,var(--surface-container-high) 80%);background-size:200px 100%;animation:cmtShimmer 1.6s ease-in-out infinite}',
      '@keyframes cmtFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '.cmt-item{animation:cmtFadeIn .25s cubic-bezier(0,0,.2,1) backwards}',

      /* Draft indicator */
      '.cmt-draft-hint{font-family:\'Noto Sans SC\',sans-serif;font-size:11px;color:var(--outline);font-style:italic}',

      /* Mobile optimization */
      '@media(max-width:768px){',
      '.cmt-form{padding:16px 14px}',
      '.cmt-form-row{flex-direction:column;gap:10px}',
      '.cmt-input{height:48px;padding:0 16px;font-size:16px}',
      '.cmt-textarea{padding:14px 16px;font-size:16px;min-height:88px}',
      '.cmt-inline-form{padding:12px 14px}',
      '.cmt-inline-form .cmt-form-row{flex-direction:column;gap:10px}',
      '.cmt-inline-form .cmt-input{height:44px;font-size:16px}',
      '.cmt-inline-form .cmt-textarea{font-size:16px;min-height:72px}',
      '.cmt-replies{padding-left:14px}',
      '.cmt-item{gap:10px;padding:14px 0}',
      '.cmt-avatar{width:32px;height:32px;font-size:13px}',
      '.cmt-replies .cmt-avatar{width:28px;height:28px;font-size:11px}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Avatar Color ──────────────────────────────────────────────────────────
  var AVATAR_COLORS = ['#3D5A6E','#4A7B6A','#8E6B9E','#B07D56','#5C7A3D','#6B5B8A','#8B6B4A','#4A6B8A','#7A5B6B','#5B7A6A','#6E5A3D','#7B6A4A','#6B9E8E','#567DB0','#9E6B8E'];
  function avatarColor(name) { var h = 0; for (var i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
  function avatarInitial(name) { return name.charAt(0).toUpperCase(); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    if (y === now.getFullYear()) return m + '月' + day + '日';
    return y + '年' + m + '月' + day + '日';
  }

  function findComment(id) {
    for (var i = 0; i < comments.length; i++) { if (comments[i].id === id) return comments[i]; }
    return null;
  }

  function getChildren(parentId) {
    return comments.filter(function (c) { return (c.parent_id || null) === parentId; });
  }

  // ── API ───────────────────────────────────────────────────────────────────
  function fetchComments(path, linkId, cb) {
    var url = API + '/api/comments?path=' + encodeURIComponent(path);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
      if (xhr.status === 200) { try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e); } }
      else cb(new Error('HTTP ' + xhr.status));
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send();
  }

  function postComment(data, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/comments');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      try { var r = JSON.parse(xhr.responseText); cb(xhr.status === 200 ? null : r.error, r); } catch (e) { cb(e); }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send(JSON.stringify(data));
  }

  function postLike(commentId, path, linkId, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/comments/like');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      try { var r = JSON.parse(xhr.responseText); cb(xhr.status === 200 ? null : r.error, r); } catch (e) { cb(e); }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send(JSON.stringify({ comment_id: commentId, path: path, link_id: linkId }));
  }

  // ── Build Comment HTML ────────────────────────────────────────────────────
  function buildCommentHTML(c, depth, animDelay) {
    var color = avatarColor(c.nick);
    var initial = avatarInitial(c.nick);
    var liked = isLiked(c.id);
    var likeCount = c.likes || 0;

    // Reply tag
    var replyTag = '';
    if (c.parent_id) {
      var parent = findComment(c.parent_id);
      if (parent) replyTag = '<span class="cmt-reply-tag">↩ ' + escHtml(parent.nick) + '</span>';
    }

    // Device & location
    var metaExtra = '';
    if (c.device) metaExtra += '<span class="cmt-device">' + escHtml(c.device) + '</span>';
    if (c.location) metaExtra += '<span class="cmt-location">📍' + escHtml(c.location) + '</span>';

    // Nick (with optional link)
    var nickHtml;
    if (c.website) {
      nickHtml = '<a class="cmt-nick cmt-nick-link" href="' + escHtml(c.website) + '" target="_blank" rel="noopener">' + escHtml(c.nick) + '</a>';
    } else {
      nickHtml = '<span class="cmt-nick">' + escHtml(c.nick) + '</span>';
    }

    // Content (with fold support)
    var contentHtml = '<div class="cmt-text" data-folded="false">' + c.content + '</div>';

    var delay = animDelay ? ' style="animation-delay:' + animDelay + 'ms"' : '';

    return '<div class="cmt-item" data-id="' + c.id + '"' + delay + '>' +
      '<div class="cmt-avatar" style="background:' + color + '">' + escHtml(initial) + '</div>' +
      '<div class="cmt-body">' +
        '<div class="cmt-meta">' + nickHtml + replyTag + metaExtra +
        '<span class="cmt-time">' + formatTime(c.time) + '</span></div>' +
        contentHtml +
        '<div class="cmt-actions-row">' +
          '<button class="cmt-reply-btn" data-reply="' + c.id + '">回复</button>' +
          '<button class="cmt-like-btn' + (liked ? ' liked' : '') + '" data-like="' + c.id + '">' +
            (liked ? '❤️' : '🤍') + ' <span class="cmt-like-count">' + (likeCount > 0 ? likeCount : '') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Recursive tree builder
  function buildTreeHTML(parentId, depth, baseDelay) {
    var children = getChildren(parentId);
    if (!children.length) return '';
    var html = '';
    var useAccent = depth >= MAX_VISUAL_DEPTH;
    var nestClass = useAccent ? 'cmt-replies cmt-depth-accent' : 'cmt-replies';
    html += '<div class="' + nestClass + '">';
    children.forEach(function (c, i) {
      var delay = baseDelay + i * 30;
      html += buildCommentHTML(c, depth, delay);
      html += buildTreeHTML(c.id, depth + 1, delay + 10);
    });
    html += '</div>';
    return html;
  }

  function buildNestedHTML() {
    var top = comments.filter(function (c) { return !c.parent_id; });
    var html = '';
    top.forEach(function (c, i) {
      html += buildCommentHTML(c, 0, i * 40);
      html += buildTreeHTML(c.id, 1, i * 40 + 20);
    });
    return html;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    if (!container) return;
    var count = comments.length;

    var formHTML =
      '<div class="cmt-form" id="cmtForm">' +
        '<div class="cmt-hp"><input type="text" name="website_url" tabindex="-1" autocomplete="off"></div>' +
        '<div class="cmt-form-row">' +
          '<input class="cmt-input" id="cmtNick" type="text" placeholder="昵称 *" maxlength="50" autocomplete="name">' +
          '<input class="cmt-input" id="cmtEmail" type="email" placeholder="邮箱" maxlength="100" autocomplete="email">' +
          '<input class="cmt-input" id="cmtWebsite" type="url" placeholder="网站" maxlength="200" autocomplete="url">' +
        '</div>' +
        '<textarea class="cmt-textarea" id="cmtContent" placeholder="写下你的想法…" maxlength="2000"></textarea>' +
        '<div class="cmt-actions">' +
          '<span class="cmt-hint">支持 <code>**粗体**</code> <code>*斜体*</code> <code>`代码`</code> <code>[链接](URL)</code></span>' +
          '<span class="cmt-draft-hint" id="cmtDraftHint"></span>' +
          '<button class="cmt-btn cmt-btn-primary" id="cmtSubmit">发表评论</button>' +
        '</div>' +
      '</div>';

    var listHTML = '';
    if (loading) {
      listHTML =
        '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body"><div class="cmt-skel-line" style="width:30%"></div><div class="cmt-skel-line" style="width:100%"></div><div class="cmt-skel-line" style="width:80%"></div></div></div>' +
        '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body"><div class="cmt-skel-line" style="width:25%"></div><div class="cmt-skel-line" style="width:90%"></div></div></div>';
    } else if (count === 0) {
      listHTML = '<div class="cmt-empty"><div class="cmt-empty-icon">💬</div><div class="cmt-empty-text">还没有评论，来抢沙发吧</div></div>';
    } else {
      listHTML = '<div class="cmt-list">' + buildNestedHTML() + '</div>';
    }

    container.innerHTML =
      '<div class="cmt-section">' +
        '<div class="cmt-header"><span class="cmt-title">评论</span>' +
        (count > 0 ? '<span class="cmt-count">' + count + '</span>' : '') +
        '</div>' +
        formHTML +
        '<div id="cmtList">' + listHTML + '</div>' +
      '</div>';

    loadDraft();
    bindEvents();
    applyFold();
  }

  // ── Long comment fold ─────────────────────────────────────────────────────
  function applyFold() {
    if (!container) return;
    var texts = container.querySelectorAll('.cmt-text[data-folded="false"]');
    texts.forEach(function (txt) {
      // Measure after render
      requestAnimationFrame(function () {
        if (txt.scrollHeight > FOLD_HEIGHT + 20) {
          txt.classList.add('cmt-text-fold');
          txt.dataset.folded = 'true';
          var btn = document.createElement('button');
          btn.className = 'cmt-fold-btn';
          btn.textContent = '展开全文';
          btn.addEventListener('click', function () {
            txt.classList.remove('cmt-text-fold');
            txt.dataset.folded = 'done';
            btn.remove();
          });
          txt.parentNode.insertBefore(btn, txt.nextSibling);
        }
      });
    });
  }

  // ── Inline Reply Box ──────────────────────────────────────────────────────
  var activeInlineForm = null;
  var activeReplyToId = null;

  function removeInlineForm() {
    if (activeInlineForm) { activeInlineForm.remove(); activeInlineForm = null; activeReplyToId = null; }
  }

  function showInlineReply(commentId) {
    removeInlineForm();
    activeReplyToId = commentId;
    var parent = findComment(commentId);
    if (!parent) return;

    var itemEl = container.querySelector('.cmt-item[data-id="' + commentId + '"]');
    if (!itemEl) return;

    var form = document.createElement('div');
    form.className = 'cmt-inline-form';
    form.innerHTML =
      '<div class="cmt-form-row">' +
        '<input class="cmt-input cmt-inline-nick" type="text" placeholder="昵称 *" maxlength="50" autocomplete="name">' +
        '<input class="cmt-input cmt-inline-email" type="email" placeholder="邮箱" maxlength="100" autocomplete="email">' +
        '<input class="cmt-input cmt-inline-website" type="url" placeholder="网站" maxlength="200" autocomplete="url">' +
      '</div>' +
      '<textarea class="cmt-textarea cmt-inline-content" placeholder="回复 ' + escHtml(parent.nick) + '…" maxlength="2000"></textarea>' +
      '<div class="cmt-actions">' +
        '<span class="cmt-hint">按 Ctrl+Enter 发送</span>' +
        '<button class="cmt-btn cmt-btn-ghost cmt-inline-cancel">取消</button>' +
        '<button class="cmt-btn cmt-btn-primary cmt-inline-submit">回复</button>' +
      '</div>';

    // Insert after the comment body
    var bodyEl = itemEl.querySelector('.cmt-body');
    if (bodyEl) bodyEl.appendChild(form);
    else itemEl.appendChild(form);

    activeInlineForm = form;

    // Pre-fill from main form or draft
    var mainNick = el('cmtNick'), mainEmail = el('cmtEmail'), mainWebsite = el('cmtWebsite');
    var nickInput = form.querySelector('.cmt-inline-nick');
    var emailInput = form.querySelector('.cmt-inline-email');
    var websiteInput = form.querySelector('.cmt-inline-website');
    if (mainNick && mainNick.value) nickInput.value = mainNick.value;
    if (mainEmail && mainEmail.value) emailInput.value = mainEmail.value;
    if (mainWebsite && mainWebsite.value) websiteInput.value = mainWebsite.value;

    // Focus
    var contentInput = form.querySelector('.cmt-inline-content');
    if (contentInput) setTimeout(function () { contentInput.focus(); }, 50);

    // Bind inline form events
    form.querySelector('.cmt-inline-cancel').addEventListener('click', removeInlineForm);

    form.querySelector('.cmt-inline-submit').addEventListener('click', function () {
      submitInlineComment(form, commentId);
    });

    contentInput.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitInlineComment(form, commentId); }
    });

    // Draft save for inline form
    [nickInput, emailInput, websiteInput, contentInput].forEach(function (inp) {
      inp.addEventListener('input', scheduleDraftSave);
      inp.addEventListener('focus', function () { window.__cmtInputFocused = true; });
      inp.addEventListener('blur', function () { window.__cmtInputFocused = false; });
    });
  }

  function submitInlineComment(form, parentId) {
    if (submitting) return;
    var nick = (form.querySelector('.cmt-inline-nick').value || '').trim();
    var email = (form.querySelector('.cmt-inline-email').value || '').trim();
    var website = (form.querySelector('.cmt-inline-website').value || '').trim();
    var content = (form.querySelector('.cmt-inline-content').value || '').trim();

    if (!nick) { form.querySelector('.cmt-inline-nick').focus(); return; }
    if (!content) { form.querySelector('.cmt-inline-content').focus(); return; }

    // Save nick/email/website to main form
    var mainNick = el('cmtNick'), mainEmail = el('cmtEmail'), mainWebsite = el('cmtWebsite');
    if (mainNick) mainNick.value = nick;
    if (mainEmail) mainEmail.value = email;
    if (mainWebsite) mainWebsite.value = website;

    submitting = true;
    var btn = form.querySelector('.cmt-inline-submit');
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }

    var data = {
      path: currentPath,
      nick: nick,
      email: email,
      website_url: website,
      content: content,
      parent_id: parentId,
      link_id: currentLinkId || '',
      website: '', // honeypot
    };

    postComment(data, function (err, result) {
      submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = '回复'; }
      if (err) { alert(typeof err === 'string' ? err : '回复发送失败'); return; }

      if (result && result.comment) comments.push(result.comment);
      removeInlineForm();
      clearDraft();
      render();
    });
  }

  // ── Events (delegation) ───────────────────────────────────────────────────
  function bindEvents() {
    if (!container) return;

    // Single delegated click handler on container
    container.addEventListener('click', function (e) {
      var t = e.target;

      // Submit main form
      if (t.id === 'cmtSubmit' || t.closest('#cmtSubmit')) {
        e.preventDefault();
        submitMainComment();
        return;
      }

      // Reply button
      var replyBtn = t.closest('.cmt-reply-btn');
      if (replyBtn && replyBtn.dataset.reply) {
        e.preventDefault();
        if (activeReplyToId === replyBtn.dataset.reply) {
          removeInlineForm();
        } else {
          showInlineReply(replyBtn.dataset.reply);
        }
        return;
      }

      // Like button
      var likeBtn = t.closest('.cmt-like-btn');
      if (likeBtn && likeBtn.dataset.like) {
        e.preventDefault();
        handleLike(likeBtn, likeBtn.dataset.like);
        return;
      }
    });

    // Main form input events (draft + keyboard guard)
    var mainInputs = ['cmtNick', 'cmtEmail', 'cmtWebsite', 'cmtContent'];
    mainInputs.forEach(function (id) {
      var inp = el(id);
      if (!inp) return;
      inp.addEventListener('input', scheduleDraftSave);
      inp.addEventListener('focus', function () { window.__cmtInputFocused = true; });
      inp.addEventListener('blur', function () { window.__cmtInputFocused = false; });
    });

    // Ctrl+Enter for main textarea
    var mainContent = el('cmtContent');
    if (mainContent) {
      mainContent.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitMainComment(); }
      });
    }
  }

  function submitMainComment() {
    if (submitting) return;
    var nickEl = el('cmtNick'), emailEl = el('cmtEmail'), websiteEl = el('cmtWebsite'), contentEl = el('cmtContent');
    var honeypot = container ? container.querySelector('#cmtForm input[name="website_url"]') : null;

    var nick = (nickEl.value || '').trim();
    var email = (emailEl ? emailEl.value : '').trim();
    var website = (websiteEl ? websiteEl.value : '').trim();
    var content = (contentEl.value || '').trim();

    if (!nick) { nickEl.focus(); return; }
    if (!content) { contentEl.focus(); return; }

    submitting = true;
    var btn = el('cmtSubmit');
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }

    postComment({
      path: currentPath,
      nick: nick,
      email: email,
      website_url: website,
      content: content,
      parent_id: null,
      link_id: currentLinkId || '',
      website: honeypot ? honeypot.value : '',
    }, function (err, result) {
      submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = '发表评论'; }
      if (err) { alert(typeof err === 'string' ? err : '评论发送失败'); return; }

      if (result && result.comment) comments.push(result.comment);
      if (contentEl) contentEl.value = '';
      clearDraft();
      render();
    });
  }

  // ── Like handler ──────────────────────────────────────────────────────────
  function handleLike(btn, commentId) {
    if (isLiked(commentId)) return; // already liked
    addLikedId(commentId);
    btn.classList.add('liked');
    btn.innerHTML = '❤️ <span class="cmt-like-count">' + (((findComment(commentId) || {}).likes || 0) + 1) + '</span>';

    postLike(commentId, currentPath, currentLinkId, function (err, result) {
      if (err) return;
      var c = findComment(commentId);
      if (c) c.likes = result.likes;
      var countEl = btn.querySelector('.cmt-like-count');
      if (countEl && result.likes) countEl.textContent = result.likes;
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function initComments(path, apiUrl, linkId) {
    destroyComments();
    if (!path && !linkId) return;

    API = apiUrl || API;
    currentPath = path || '';
    currentLinkId = linkId || null;
    comments = [];
    loading = true;

    injectStyles();

    container = document.getElementById('commentSection');
    if (!container) {
      var nav = document.getElementById('artNav');
      if (nav) {
        container = document.createElement('div');
        container.id = 'commentSection';
        nav.parentNode.insertBefore(container, nav.nextSibling);
      }
    }
    if (!container) return;

    render();

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { observer.disconnect(); observer = null; loadComments(); }
      }, { rootMargin: '200px' });
      observer.observe(container);
    } else {
      loadComments();
    }
  }

  function loadComments() {
    if (!currentPath && !currentLinkId) return;
    loading = true;
    var listEl = el('cmtList');
    if (listEl) {
      listEl.innerHTML = '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body"><div class="cmt-skel-line" style="width:30%"></div><div class="cmt-skel-line" style="width:100%"></div><div class="cmt-skel-line" style="width:80%"></div></div></div>';
    }

    fetchComments(currentPath, currentLinkId, function (err, data) {
      loading = false;
      if (err) {
        if (listEl) listEl.innerHTML = '<div class="cmt-error">评论加载失败<button class="cmt-btn cmt-btn-ghost" onclick="window.__initComments(\'' + (currentPath || '') + '\',\'' + API + '\',\'' + (currentLinkId || '') + '\')">重试</button></div>';
        return;
      }
      comments = (data && data.comments) || [];
      render();
    });
  }

  function destroyComments() {
    if (observer) { observer.disconnect(); observer = null; }
    removeInlineForm();
    container = null;
    currentPath = null;
    currentLinkId = null;
    comments = [];
    loading = false;
    submitting = false;
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.__initComments = initComments;
  window.__destroyComments = destroyComments;
  window.__cmtInputFocused = false;
})();
