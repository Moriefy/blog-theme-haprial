// Haprial Comments — Lightweight Material Design 3 Comment Module
// Zero dependencies. Uses blog's CSS variables for theming.
// Lifecycle: initComments(path) / destroyComments()
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var API = '';
  var currentPath = null;
  var comments = [];
  var loading = false;
  var submitting = false;
  var observer = null;
  var container = null;
  var replyTo = null; // comment id being replied to

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

      /* Buttons */
      '.cmt-btn{height:36px;padding:0 20px;border:none;border-radius:var(--shape-full);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:transform 150ms var(--motion-standard),box-shadow 200ms,background 200ms;position:relative;overflow:hidden}',
      '.cmt-btn:active{transform:scale(.96);transition-duration:60ms}',
      '.cmt-btn-primary{background:var(--primary);color:var(--on-primary);box-shadow:var(--e1)}',
      '.cmt-btn-primary:hover{box-shadow:var(--e2)}',
      '.cmt-btn-primary:disabled{opacity:.5;cursor:default;pointer-events:none}',
      '.cmt-btn-ghost{background:none;color:var(--on-surface-variant);padding:0 12px}',
      '.cmt-btn-ghost:hover{background:var(--surface-container-high)}',

      /* Reply indicator */
      '.cmt-reply-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;margin-bottom:14px;background:var(--primary-container);border-radius:var(--shape-s);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:13px;color:var(--on-primary-container)}',
      '.cmt-reply-bar .cmt-reply-name{font-weight:600}',
      '.cmt-reply-close{margin-left:auto;cursor:pointer;opacity:.6;transition:opacity 150ms}',
      '.cmt-reply-close:hover{opacity:1}',

      /* Comment list */
      '.cmt-list{display:flex;flex-direction:column;gap:0}',
      '.cmt-item{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cmt-item:last-child{border-bottom:none}',
      '.cmt-avatar{width:36px;height:36px;border-radius:var(--shape-full);display:flex;align-items:center;justify-content:center;font-family:\'Noto Sans SC\',sans-serif;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;user-select:none}',
      '.cmt-body{flex:1;min-width:0}',
      '.cmt-meta{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
      '.cmt-nick{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;font-weight:600;color:var(--on-surface)}',
      '.cmt-time{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:12px;color:var(--outline)}',
      '.cmt-reply-tag{font-family:\'Noto Sans SC\',sans-serif;font-size:11px;color:var(--primary);background:var(--primary-container);padding:1px 8px;border-radius:var(--shape-full)}',
      '.cmt-text{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;line-height:1.75;color:var(--on-surface-variant);word-break:break-word}',
      '.cmt-text code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:2px 6px;border-radius:3px}',
      '.cmt-text strong{font-weight:600;color:var(--on-surface)}',
      '.cmt-reply-btn{margin-top:6px;font-family:\'Noto Sans SC\',sans-serif;font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:2px 0;transition:color 150ms}',
      '.cmt-reply-btn:hover{color:var(--primary)}',

      /* Nested replies */
      '.cmt-replies{margin-left:50px;padding-left:16px;border-left:2px solid var(--outline-variant)}',
      '.cmt-replies .cmt-item{padding:14px 0}',
      '.cmt-replies .cmt-avatar{width:28px;height:28px;font-size:12px}',

      /* States */
      '.cmt-empty{text-align:center;padding:40px 0;font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif}',
      '.cmt-empty-icon{font-size:32px;margin-bottom:12px;opacity:.3}',
      '.cmt-empty-text{font-size:14px;color:var(--outline)}',
      '.cmt-error{text-align:center;padding:20px;font-family:\'Noto Sans SC\',sans-serif;font-size:13px;color:var(--outline)}',
      '.cmt-error button{margin-top:8px}',

      /* Skeleton */
      '.cmt-skel{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cmt-skel-avatar{width:36px;height:36px;border-radius:50%;background:var(--surface-container-high)}',
      '.cmt-skel-body{flex:1}',
      '.cmt-skel-line{height:12px;border-radius:6px;background:var(--surface-container-high);margin-bottom:10px}',
      '@keyframes cmtShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',
      '.cmt-skel-line{background:linear-gradient(90deg,var(--surface-container-high) 0,var(--surface-container) 40%,var(--surface-container-high) 80%);background-size:200px 100%;animation:cmtShimmer 1.6s ease-in-out infinite}',

      /* Fade in */
      '@keyframes cmtFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '.cmt-item{animation:cmtFadeIn .25s cubic-bezier(0,0,.2,1) backwards}',

      /* Responsive */
      '@media(max-width:768px){',
      '.cmt-form{padding:16px 14px}',
      '.cmt-form-row{flex-direction:column;gap:10px}',
      '.cmt-input{height:44px}',
      '.cmt-replies{margin-left:36px;padding-left:12px}',
      '.cmt-item{gap:10px;padding:14px 0}',
      '.cmt-avatar{width:32px;height:32px;font-size:13px}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Avatar Color ──────────────────────────────────────────────────────────
  var AVATAR_COLORS = [
    '#3D5A6E', '#4A7B6A', '#8E6B9E', '#B07D56', '#5C7A3D',
    '#6B5B8A', '#8B6B4A', '#4A6B8A', '#7A5B6B', '#5B7A6A',
    '#6E5A3D', '#7B6A4A', '#6B9E8E', '#567DB0', '#9E6B8E',
  ];
  function avatarColor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }
  function avatarInitial(name) {
    return name.charAt(0).toUpperCase();
  }

  // ── Time Formatting ───────────────────────────────────────────────────────
  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var now = new Date();
    var diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    if (y === now.getFullYear()) return m + '月' + day + '日';
    return y + '年' + m + '月' + day + '日';
  }

  // ── API ───────────────────────────────────────────────────────────────────
  function fetchComments(path, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API + '/api/comments?path=' + encodeURIComponent(path));
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e); }
      } else { cb(new Error('HTTP ' + xhr.status)); }
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

  // ── Build Comment HTML ────────────────────────────────────────────────────
  function buildCommentHTML(c, isReply, animDelay) {
    var color = avatarColor(c.nick);
    var initial = avatarInitial(c.nick);
    var replyTag = '';
    if (c.replyTo) {
      var parent = comments.find(function (p) { return p.id === c.replyTo; });
      if (parent) replyTag = '<span class="cmt-reply-tag">↩ ' + escHtml(parent.nick) + '</span>';
    }
    var delay = animDelay ? ' style="animation-delay:' + animDelay + 'ms"' : '';
    return '<div class="cmt-item" data-id="' + c.id + '"' + delay + '>' +
      '<div class="cmt-avatar" style="background:' + color + '">' + escHtml(initial) + '</div>' +
      '<div class="cmt-body">' +
        '<div class="cmt-meta"><span class="cmt-nick">' + escHtml(c.nick) + '</span>' + replyTag +
        '<span class="cmt-time">' + formatTime(c.time) + '</span></div>' +
        '<div class="cmt-text">' + c.content + '</div>' +
        (isReply ? '' : '<button class="cmt-reply-btn" data-reply="' + c.id + '">回复</button>') +
      '</div>' +
    '</div>';
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Build Nest (top-level + replies) ──────────────────────────────────────
  function buildNestedHTML() {
    var top = comments.filter(function (c) { return !c.replyTo; });
    var html = '';
    top.forEach(function (c, i) {
      html += buildCommentHTML(c, false, i * 40);
      var replies = comments.filter(function (r) { return r.replyTo === c.id; });
      if (replies.length) {
        html += '<div class="cmt-replies">';
        replies.forEach(function (r, j) {
          html += buildCommentHTML(r, true, (i * 40) + (j + 1) * 30);
        });
        html += '</div>';
      }
    });
    return html;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    if (!container) return;

    var count = comments.length;
    var formHTML =
      '<div class="cmt-form" id="cmtForm">' +
        '<div class="cmt-hp"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>' +
        '<div class="cmt-form-row">' +
          '<input class="cmt-input" id="cmtNick" type="text" placeholder="昵称 *" maxlength="50" autocomplete="name">' +
          '<input class="cmt-input" id="cmtEmail" type="email" placeholder="邮箱（选填，不会公开）" maxlength="100" autocomplete="email">' +
        '</div>' +
        '<div id="cmtReplyBar"></div>' +
        '<textarea class="cmt-textarea" id="cmtContent" placeholder="写下你的想法…（支持 **粗体**、*斜体*、`代码`）" maxlength="2000"></textarea>' +
        '<div class="cmt-actions">' +
          '<span class="cmt-hint">支持 <code>**粗体**</code> <code>*斜体*</code> <code>`代码`</code></span>' +
          '<button class="cmt-btn cmt-btn-ghost" id="cmtCancel" style="display:none">取消回复</button>' +
          '<button class="cmt-btn cmt-btn-primary" id="cmtSubmit">发表评论</button>' +
        '</div>' +
      '</div>';

    var listHTML = '';
    if (loading) {
      listHTML =
        '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body">' +
        '<div class="cmt-skel-line" style="width:30%"></div>' +
        '<div class="cmt-skel-line" style="width:100%"></div>' +
        '<div class="cmt-skel-line" style="width:80%"></div>' +
        '</div></div>' +
        '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body">' +
        '<div class="cmt-skel-line" style="width:25%"></div>' +
        '<div class="cmt-skel-line" style="width:90%"></div>' +
        '</div></div>';
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

    // Restore saved nick/email
    try {
      var saved = JSON.parse(localStorage.getItem('cmt_user') || '{}');
      if (saved.nick) document.getElementById('cmtNick').value = saved.nick;
      if (saved.email) document.getElementById('cmtEmail').value = saved.email;
    } catch (e) {}

    bindEvents();
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindEvents() {
    var form = document.getElementById('cmtForm');
    if (!form) return;

    form.addEventListener('click', function (e) {
      var t = e.target;

      // Submit
      if (t.id === 'cmtSubmit' || t.closest('#cmtSubmit')) {
        e.preventDefault();
        submitComment();
        return;
      }

      // Cancel reply
      if (t.id === 'cmtCancel' || t.closest('#cmtCancel')) {
        clearReply();
        return;
      }

      // Reply button in comment list
      var replyBtn = t.closest('.cmt-reply-btn');
      if (replyBtn) {
        setReply(replyBtn.dataset.reply);
        return;
      }
    });

    // Enter to submit (Ctrl+Enter or Cmd+Enter)
    var textarea = document.getElementById('cmtContent');
    if (textarea) {
      textarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitComment();
        }
      });
    }
  }

  function setReply(commentId) {
    replyTo = commentId;
    var parent = comments.find(function (c) { return c.id === commentId; });
    var bar = document.getElementById('cmtReplyBar');
    var cancel = document.getElementById('cmtCancel');
    if (bar && parent) {
      bar.innerHTML = '<div class="cmt-reply-bar"><span>↩ 回复</span><span class="cmt-reply-name">' + escHtml(parent.nick) + '</span><span class="cmt-reply-close" onclick="document.getElementById(\'cmtReplyBar\').innerHTML=\'\'">✕</span></div>';
    }
    if (cancel) cancel.style.display = '';
    var textarea = document.getElementById('cmtContent');
    if (textarea) { textarea.placeholder = '回复 ' + (parent ? parent.nick : '') + '…'; textarea.focus(); }
  }

  function clearReply() {
    replyTo = null;
    var bar = document.getElementById('cmtReplyBar');
    var cancel = document.getElementById('cmtCancel');
    if (bar) bar.innerHTML = '';
    if (cancel) cancel.style.display = 'none';
    var textarea = document.getElementById('cmtContent');
    if (textarea) textarea.placeholder = '写下你的想法…（支持 **粗体**、*斜体*、`代码`）';
  }

  function submitComment() {
    if (submitting) return;

    var nickEl = document.getElementById('cmtNick');
    var emailEl = document.getElementById('cmtEmail');
    var contentEl = document.getElementById('cmtContent');
    var honeypot = document.querySelector('#cmtForm input[name="website"]');

    var nick = (nickEl.value || '').trim();
    var email = (emailEl.value || '').trim();
    var content = (contentEl.value || '').trim();

    if (!nick) { nickEl.focus(); return; }
    if (!content) { contentEl.focus(); return; }

    // Save nick/email
    try { localStorage.setItem('cmt_user', JSON.stringify({ nick: nick, email: email })); } catch (e) {}

    submitting = true;
    var btn = document.getElementById('cmtSubmit');
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }

    postComment({
      path: currentPath,
      nick: nick,
      email: email,
      content: content,
      replyTo: replyTo,
      website: honeypot ? honeypot.value : '', // honeypot
    }, function (err, result) {
      submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = '发表评论'; }

      if (err) {
        alert(typeof err === 'string' ? err : '评论发送失败，请稍后重试');
        return;
      }

      // Add to local list
      if (result && result.comment) {
        comments.push(result.comment);
      }

      // Clear form
      contentEl.value = '';
      clearReply();

      // Re-render list
      var listEl = document.getElementById('cmtList');
      if (listEl) {
        if (comments.length === 0) {
          listEl.innerHTML = '<div class="cmt-empty"><div class="cmt-empty-icon">💬</div><div class="cmt-empty-text">还没有评论，来抢沙发吧</div></div>';
        } else {
          listEl.innerHTML = '<div class="cmt-list">' + buildNestedHTML() + '</div>';
        }
      }

      // Update count
      var countEl = container.querySelector('.cmt-count');
      if (comments.length > 0) {
        if (countEl) {
          countEl.textContent = comments.length;
        } else {
          var header = container.querySelector('.cmt-header');
          if (header) header.insertAdjacentHTML('beforeend', '<span class="cmt-count">' + comments.length + '</span>');
        }
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function initComments(path, apiUrl) {
    destroyComments();
    if (!path) return;

    API = apiUrl || API;
    currentPath = path;
    comments = [];
    loading = true;
    replyTo = null;

    injectStyles();

    // Find or create container
    container = document.getElementById('commentSection');
    if (!container) {
      // SPA mode: create container after article nav
      var nav = document.getElementById('artNav');
      if (nav) {
        container = document.createElement('div');
        container.id = 'commentSection';
        nav.parentNode.insertBefore(container, nav.nextSibling);
      }
    }
    if (!container) return;

    render();

    // Use IntersectionObserver for lazy loading
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          observer = null;
          loadComments();
        }
      }, { rootMargin: '200px' });
      observer.observe(container);
    } else {
      loadComments();
    }
  }

  function loadComments() {
    if (!currentPath) return;
    loading = true;
    var listEl = document.getElementById('cmtList');
    if (listEl) {
      listEl.innerHTML =
        '<div class="cmt-skel"><div class="cmt-skel-avatar"></div><div class="cmt-skel-body">' +
        '<div class="cmt-skel-line" style="width:30%"></div>' +
        '<div class="cmt-skel-line" style="width:100%"></div>' +
        '<div class="cmt-skel-line" style="width:80%"></div>' +
        '</div></div>';
    }

    fetchComments(currentPath, function (err, data) {
      loading = false;
      if (err) {
        if (listEl) listEl.innerHTML = '<div class="cmt-error">评论加载失败<button class="cmt-btn cmt-btn-ghost" onclick="window.__initComments(\'' + currentPath + '\')">重试</button></div>';
        return;
      }
      comments = (data && data.comments) || [];
      var listEl = document.getElementById('cmtList');
      if (listEl) {
        if (comments.length === 0) {
          listEl.innerHTML = '<div class="cmt-empty"><div class="cmt-empty-icon">💬</div><div class="cmt-empty-text">还没有评论，来抢沙发吧</div></div>';
        } else {
          listEl.innerHTML = '<div class="cmt-list">' + buildNestedHTML() + '</div>';
        }
      }
      // Update count
      var countEl = container ? container.querySelector('.cmt-count') : null;
      if (comments.length > 0) {
        if (countEl) countEl.textContent = comments.length;
        else if (container) {
          var header = container.querySelector('.cmt-header');
          if (header) header.insertAdjacentHTML('beforeend', '<span class="cmt-count">' + comments.length + '</span>');
        }
      }
    });
  }

  function destroyComments() {
    if (observer) { observer.disconnect(); observer = null; }
    container = null;
    currentPath = null;
    comments = [];
    replyTo = null;
    loading = false;
    submitting = false;
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.__initComments = initComments;
  window.__destroyComments = destroyComments;
})();
