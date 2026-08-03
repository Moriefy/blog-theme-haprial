// ── Haprial Comments — Material Design 3 ────────────────────────────────────
// Zero-dependency, ~4KB gzip. Integrates with CF Worker API.
// Usage: window.__initComments('/posts/20260801/')
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var API = 'https://comments.pluslogic.eu.org/api';
  var MAX_DEPTH = 3;

  // ── Avatar palette (MD3 tonal) ──
  var AVATAR_COLORS = [
    ['#3D5A6E', '#D4DDE3'], ['#4A7B6A', '#D4E8DF'], ['#8E6B9E', '#E8D6F0'],
    ['#B07D56', '#E8D8C8'], ['#5C7A3D', '#D8E8CC'], ['#6B5B8A', '#DDD6E8'],
    ['#8B6B4A', '#E0D4C8'], ['#4A6B8A', '#D0DDE8'], ['#7A5B6B', '#E0D4DA'],
    ['#5B7A6A', '#D4E0D8'],
  ];

  // ── State ──
  var state = { comments: [], replyTo: null, replyNick: '', loaded: false };

  // ── Utils ──
  function $(s, p) { return (p || document).querySelector(s); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function avatarColor(nick) {
    var c = AVATAR_COLORS[hashStr(nick) % AVATAR_COLORS.length];
    return { bg: c[0], fg: c[1] };
  }

  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return '刚刚';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分钟前';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前';
    var d = Math.floor(h / 24);
    if (d < 30) return d + ' 天前';
    var mo = Math.floor(d / 30);
    if (mo < 12) return mo + ' 个月前';
    return Math.floor(mo / 12) + ' 年前';
  }

  function isLiked(id) {
    try { return localStorage.getItem('cmt_liked_' + id) === '1'; } catch (e) { return false; }
  }
  function setLiked(id, v) {
    try {
      if (v) localStorage.setItem('cmt_liked_' + id, '1');
      else localStorage.removeItem('cmt_liked_' + id);
    } catch (e) { }
  }

  function getStoredNick() {
    try { return localStorage.getItem('cmt_nick') || ''; } catch (e) { return ''; }
  }
  function getStoredEmail() {
    try { return localStorage.getItem('cmt_email') || ''; } catch (e) { return ''; }
  }
  function getStoredLink() {
    try { return localStorage.getItem('cmt_link') || ''; } catch (e) { return ''; }
  }
  function saveIdentity(nick, email, link) {
    try {
      localStorage.setItem('cmt_nick', nick);
      if (email) localStorage.setItem('cmt_email', email);
      if (link) localStorage.setItem('cmt_link', link);
    } catch (e) { }
  }

  // ── Tree builder ──
  function buildTree(flat) {
    var map = {}, roots = [];
    for (var i = 0; i < flat.length; i++) {
      map[flat[i].id] = { _c: flat[i], children: [] };
    }
    for (var i = 0; i < flat.length; i++) {
      var c = flat[i];
      if (c.parent && map[c.parent]) {
        map[c.parent].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    }
    roots.sort(function (a, b) { return b._c.likes - a._c.likes || a._c.created - b._c.created; });
    for (var i = 0; i < roots.length; i++) {
      roots[i].children.sort(function (a, b) { return a._c.created - b._c.created; });
    }
    return roots;
  }

  // ── Render single comment ──
  function renderComment(node, depth) {
    var c = node._c;
    var ac = avatarColor(c.nick);
    var initial = c.nick.charAt(0).toUpperCase();
    var liked = isLiked(c.id);
    var depthClass = depth > 0 ? ' cmt-reply' : '';
    var indent = depth > 0 ? ' style="--cmt-depth:' + depth + '"' : '';

    var html = '<div class="cmt-item' + depthClass + '" data-id="' + c.id + '"' + indent + '>'
      + '<div class="cmt-avatar" style="background:' + ac.bg + ';color:' + ac.fg + '">' + esc(initial) + '</div>'
      + '<div class="cmt-body">'
      + '<div class="cmt-meta">'
      + '<span class="cmt-nick">' + esc(c.nick) + '</span>'
      + (c.isOwner ? '<span class="cmt-badge">博主</span>' : '')
      + '<span class="cmt-dot">·</span>'
      + '<span class="cmt-time" data-ts="' + c.created + '">' + timeAgo(c.created) + '</span>'
      + (c.ua ? '<span class="cmt-ua">' + esc(c.ua) + '</span>' : '')
      + '</div>'
      + '<div class="cmt-content">' + c.html + '</div>'
      + '<div class="cmt-actions">'
      + '<button class="cmt-action-btn cmt-like-btn' + (liked ? ' liked' : '') + '" data-id="' + c.id + '">'
      + '<svg class="cmt-icon" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="' + (liked ? 'currentColor' : 'none') + '"/></svg>'
      + '<span class="cmt-like-count">' + (c.likes || '') + '</span>'
      + '</button>'
      + (depth < MAX_DEPTH
        ? '<button class="cmt-action-btn cmt-reply-btn" data-id="' + c.id + '" data-nick="' + esc(c.nick) + '">'
        + '<svg class="cmt-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
        + '回复</button>'
        : '')
      + '</div>';

    // Children
    if (node.children.length) {
      html += '<div class="cmt-children">';
      for (var i = 0; i < node.children.length; i++) {
        html += renderComment(node.children[i], depth + 1);
      }
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  // ── Render all ──
  function render(container) {
    var total = state.comments.length;
    var tree = buildTree(state.comments);
    var storedNick = getStoredNick();
    var storedEmail = getStoredEmail();
    var storedLink = getStoredLink();

    var html = ''
      // Header
      + '<div class="cmt-header">'
      + '<div class="cmt-header-row">'
      + '<h3 class="cmt-title">评论</h3>'
      + '<span class="cmt-total">' + total + '</span>'
      + '</div>'
      + '</div>'

      // Form
      + '<div class="cmt-form" id="cmtForm">'
      + '<div class="cmt-identity">'
      + '<div class="cmt-field">'
      + '<input class="cmt-input" id="cmtNick" type="text" placeholder=" " maxlength="' + 30 + '" value="' + esc(storedNick) + '">'
      + '<label class="cmt-label">昵称 <span class="cmt-required">*</span></label>'
      + '<div class="cmt-line"></div>'
      + '</div>'
      + '<div class="cmt-field">'
      + '<input class="cmt-input" id="cmtEmail" type="email" placeholder=" " value="' + esc(storedEmail) + '">'
      + '<label class="cmt-label">邮箱 <span class="cmt-optional">(不会公开)</span></label>'
      + '<div class="cmt-line"></div>'
      + '</div>'
      + '<div class="cmt-field">'
      + '<input class="cmt-input" id="cmtLink" type="url" placeholder=" " value="' + esc(storedLink) + '">'
      + '<label class="cmt-label">网站 <span class="cmt-optional">(可选)</span></label>'
      + '<div class="cmt-line"></div>'
      + '</div>'
      + '</div>'

      // Reply hint
      + '<div class="cmt-reply-hint" id="cmtReplyHint" style="display:none">'
      + '<svg class="cmt-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
      + '<span>回复 <strong id="cmtReplyNick"></strong></span>'
      + '<button class="cmt-cancel-btn" id="cmtCancelReply">取消</button>'
      + '</div>'

      // Textarea
      + '<div class="cmt-textarea-wrap">'
      + '<textarea class="cmt-textarea" id="cmtContent" placeholder=" " maxlength="2000" rows="4"></textarea>'
      + '<label class="cmt-textarea-label">写下你的想法…</label>'
      + '<div class="cmt-textarea-line"></div>'
      + '</div>'

      // Actions
      + '<div class="cmt-form-actions">'
      + '<span class="cmt-hint">支持 **粗体**、\`代码\`、~~删除线~~、[链接](url)</span>'
      + '<div class="cmt-form-right">'
      + '<span class="cmt-char-count" id="cmtCharCount">0 / 2000</span>'
      + '<button class="cmt-submit" id="cmtSubmit">'
      + '<span class="cmt-submit-text">发表评论</span>'
      + '<span class="cmt-submit-loading" style="display:none">'
      + '<svg class="cmt-spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="60" stroke-dashoffset="20"/></svg>'
      + '</span>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '</div>'

      // List
      + '<div class="cmt-list" id="cmtList">';

    if (total === 0) {
      html += '<div class="cmt-empty">'
        + '<svg class="cmt-empty-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
        + '<p>还没有评论，来说点什么吧</p>'
        + '</div>';
    } else {
      for (var i = 0; i < tree.length; i++) {
        html += renderComment(tree[i], 0);
      }
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents(container);
    state.loaded = true;
  }

  // ── Events ──
  function bindEvents(el) {
    var form = $('#cmtForm', el);
    var textarea = $('#cmtContent', el);
    var charCount = $('#cmtCharCount', el);
    var submitBtn = $('#cmtSubmit', el);
    var replyHint = $('#cmtReplyHint', el);
    var replyNick = $('#cmtReplyNick', el);
    var cancelBtn = $('#cmtCancelReply', el);
    var list = $('#cmtList', el);

    // Textarea auto-resize + char count
    if (textarea) {
      textarea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.max(120, this.scrollHeight) + 'px';
        var len = this.value.length;
        charCount.textContent = len + ' / 2000';
        charCount.classList.toggle('warn', len > 1800);
      });
    }

    // Submit
    if (submitBtn) {
      submitBtn.addEventListener('click', function () { submit(form); });
    }
    if (textarea) {
      textarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(form); }
      });
    }

    // Cancel reply
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        state.replyTo = null;
        state.replyNick = '';
        replyHint.style.display = 'none';
        textarea.placeholder = ' ';
      });
    }

    // Delegate: reply + like buttons
    if (list) {
      list.addEventListener('click', function (e) {
        var likeBtn = e.target.closest('.cmt-like-btn');
        if (likeBtn) {
          e.preventDefault();
          handleLike(likeBtn);
          return;
        }
        var replyBtn = e.target.closest('.cmt-reply-btn');
        if (replyBtn) {
          e.preventDefault();
          handleReply(replyBtn, el);
          return;
        }
      });
    }
  }

  function handleReply(btn, el) {
    var id = btn.dataset.id;
    var nick = btn.dataset.nick;
    state.replyTo = id;
    state.replyNick = nick;

    var hint = $('#cmtReplyHint', el);
    var replyNickEl = $('#cmtReplyNick', el);
    var textarea = $('#cmtContent', el);

    if (hint) hint.style.display = '';
    if (replyNickEl) replyNickEl.textContent = nick;
    if (textarea) {
      textarea.focus();
      textarea.placeholder = '回复 ' + nick + '…';
    }

    // Scroll to form
    var form = $('#cmtForm', el);
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleLike(btn) {
    var id = btn.dataset.id;
    var path = location.pathname;
    btn.disabled = true;

    try {
      var res = await fetch(API + '/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path, commentId: id }),
      });
      var data = await res.json();
      if (res.ok) {
        setLiked(id, data.liked);
        btn.classList.toggle('liked', data.liked);
        var svg = btn.querySelector('svg path');
        if (svg) svg.setAttribute('fill', data.liked ? 'currentColor' : 'none');
        var countEl = btn.querySelector('.cmt-like-count');
        if (countEl) countEl.textContent = data.likes || '';
      }
    } catch (e) { }
    btn.disabled = false;
  }

  async function submit(form) {
    var nick = $('#cmtNick', form).value.trim();
    var email = $('#cmtEmail', form).value.trim();
    var link = $('#cmtLink', form).value.trim();
    var content = $('#cmtContent', form).value.trim();
    var submitBtn = $('#cmtSubmit', form);
    var submitText = $('.cmt-submit-text', submitBtn);
    var submitLoading = $('.cmt-submit-loading', submitBtn);

    if (!nick) { shake($('#cmtNick', form)); return; }
    if (!content) { shake($('#cmtContent', form)); return; }

    saveIdentity(nick, email, link);

    submitBtn.disabled = true;
    if (submitText) submitText.style.display = 'none';
    if (submitLoading) submitLoading.style.display = '';

    try {
      var res = await fetch(API + '/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: location.pathname,
          parent: state.replyTo,
          nick: nick,
          email: email || undefined,
          link: link || undefined,
          content: content,
        }),
      });

      if (res.ok) {
        // Reset form
        $('#cmtContent', form).value = '';
        $('#cmtContent', form).style.height = '';
        $('#cmtCharCount', form).textContent = '0 / 2000';
        state.replyTo = null;
        state.replyNick = '';
        var hint = $('#cmtReplyHint', form);
        if (hint) hint.style.display = 'none';

        // Reload
        await load();
      } else {
        var err = await res.json();
        showToast(err.error || '发送失败');
      }
    } catch (e) {
      showToast('网络错误');
    }

    submitBtn.disabled = false;
    if (submitText) submitText.style.display = '';
    if (submitLoading) submitLoading.style.display = 'none';
  }

  function shake(el) {
    if (!el) return;
    el.classList.add('cmt-shake');
    el.focus();
    setTimeout(function () { el.classList.remove('cmt-shake'); }, 500);
  }

  function showToast(msg) {
    var existing = document.querySelector('.cmt-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'cmt-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2500);
  }

  // ── Load comments ──
  async function load() {
    var container = document.getElementById('tcomment');
    if (!container) return;

    try {
      var res = await fetch(API + '/comments?path=' + encodeURIComponent(location.pathname));
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      state.comments = data.comments || [];
      render(container);
    } catch (e) {
      container.innerHTML = '<div class="cmt-error">'
        + '<p>评论加载失败</p>'
        + '<button class="cmt-retry" onclick="window.__initComments()">重试</button>'
        + '</div>';
    }
  }

  // ── Update relative times ──
  setInterval(function () {
    var els = document.querySelectorAll('.cmt-time[data-ts]');
    for (var i = 0; i < els.length; i++) {
      var ts = parseInt(els[i].dataset.ts);
      if (ts) els[i].textContent = timeAgo(ts);
    }
  }, 60000);

  // ── Public API ──
  window.__initComments = function () { load(); };
})();
