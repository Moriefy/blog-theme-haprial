// ============================================================
// 评论系统前端 — Haprial 博客专用
// 零依赖 · MD3 风格 · 键盘冲突修复
// ============================================================
(function () {
  'use strict';

  var API_LIKE_ICON = '<svg viewBox="0 0 16 16"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var API_LIKED_ICON = '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var API_REPLY_ICON = '<svg viewBox="0 0 16 16"><path d="M6 3L2 7l4 4"/><path d="M2 7h8a4 4 0 014 4v1"/></svg>';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function timeAgo(dateStr) {
    var diff = Math.floor((Date.now() - new Date(dateStr + 'Z').getTime()) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
    return new Date(dateStr + 'Z').toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function avatarHtml(hash, name) {
    if (hash) return '<img src="https://www.gravatar.com/avatar/' + hash + '?d=retro&s=72" alt="' + esc(name) + '" loading="lazy" width="36" height="36">';
    return '<span class="cs-avatar-initial">' + esc((name || '?').charAt(0).toUpperCase()) + '</span>';
  }

  function showToast(msg) {
    var t = document.querySelector('.cs-toast');
    if (!t) { t = document.createElement('div'); t.className = 'cs-toast'; t.setAttribute('role', 'alert'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('visible'); }, 3000);
  }

  // ── 渲染单条评论 HTML ──
  function commentHtml(c) {
    var edited = c.created_at !== c.updated_at;
    var name = c.website
      ? '<a href="' + esc(c.website) + '" rel="noopener noreferrer nofollow" target="_blank">' + esc(c.nickname) + '</a>'
      : esc(c.nickname);
    var likeIcon = c.liked > 0 ? API_LIKED_ICON : API_LIKE_ICON;
    var likeSpan = c.liked > 0 ? '<span>' + c.liked + '</span>' : '<span></span>';
    var replyBtn = c.depth < 2
      ? '<button class="cs-action cs-reply-btn" data-id="' + c.id + '" data-name="' + esc(c.nickname) + '" aria-label="回复">' + API_REPLY_ICON + '<span>回复</span></button>'
      : '';

    return '<li class="cs-item" data-id="' + c.id + '" data-depth="' + c.depth + '">'
      + '<div class="cs-item-main">'
      + '<div class="cs-avatar" aria-hidden="true">' + avatarHtml(c.avatar_hash, c.nickname) + '</div>'
      + '<div class="cs-body">'
      + '<div class="cs-meta"><span class="cs-nickname">' + name + '</span>'
      + '<time class="cs-time" datetime="' + c.created_at + '">' + timeAgo(c.created_at) + '</time>'
      + (edited ? '<span class="cs-edited">(已编辑)</span>' : '')
      + '</div>'
      + '<div class="cs-content">' + c.content_html + '</div>'
      + '<div class="cs-actions">'
      + '<button class="cs-action cs-like" data-id="' + c.id + '" aria-label="点赞">' + likeIcon + likeSpan + '</button>'
      + replyBtn
      + '</div></div></div></li>';
  }

  // ── 递归构建评论树 ──
  function buildTree(list, parentId) {
    var html = '';
    for (var i = 0; i < list.length; i++) {
      if (list[i].parent_id !== parentId) continue;
      var replies = buildTree(list, list[i].id);
      html += commentHtml(list[i]);
      if (replies) html += '<ul class="cs-replies cs-list">' + replies + '</ul>';
    }
    return html;
  }

  // ══════════════════════════════════════════════════════════
  //  主类
  // ══════════════════════════════════════════════════════════
  function CommentSystem(container, opts) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) return console.warn('[Comments] container not found');
    this.api = (opts && opts.api) || this.el.dataset.api || '';
    this.page = (opts && opts.page) || this.el.dataset.page || '';
    if (!this.api || !this.page) return console.warn('[Comments] missing api or page');

    this.comments = [];
    this.cursor = null;
    this.hasMore = false;
    this._inputFocused = false;
    this._init();
  }

  CommentSystem.prototype._init = function () {
    var self = this;

    // 构建 DOM
    this.el.innerHTML =
      '<div class="cs-header"><h3>评论</h3><span class="cs-count"></span></div>' +
      '<form class="cs-form" novalidate>' +
        '<input type="hidden" name="parent_id" value="0">' +
        '<input type="hidden" name="depth" value="0">' +
        '<div class="cs-reply-indicator"><span>回复 <strong class="cs-reply-name"></strong></span>' +
          '<button type="button" class="cs-cancel-reply" aria-label="取消回复">&times;</button></div>' +
        '<div class="cs-form-row">' +
          '<input type="text" name="nickname" placeholder="昵称 *" required maxlength="30" autocomplete="name">' +
          '<input type="email" name="email" placeholder="邮箱（可选）" maxlength="100" autocomplete="email">' +
          '<input type="url" name="website" placeholder="网站（可选）" maxlength="200">' +
        '</div>' +
        '<textarea name="content" placeholder="写下你的评论…" required maxlength="2000" rows="3"></textarea>' +
        '<div class="cs-form-actions">' +
          '<span class="cs-form-hint">支持 **粗体**、*斜体*、`代码`、[链接](url)</span>' +
          '<button type="submit" class="cs-submit">发表评论</button>' +
        '</div>' +
      '</form>' +
      '<div class="cs-list-wrap"></div>';

    this.form = this.el.querySelector('.cs-form');
    this.listWrap = this.el.querySelector('.cs-list-wrap');
    this.replyIndicator = this.el.querySelector('.cs-reply-indicator');
    this.replyName = this.el.querySelector('.cs-reply-name');
    this.countEl = this.el.querySelector('.cs-count');
    this.submitBtn = this.el.querySelector('.cs-submit');

    // 输入焦点追踪 → 阻止 app.js 键盘快捷键
    var inputs = this.form.querySelectorAll('input, textarea');
    for (var i = 0; i < inputs.length; i++) {
      (function (inp) {
        inp.addEventListener('focus', function () { self._inputFocused = true; window.__cmtInputFocused = true; });
        inp.addEventListener('blur', function () {
          self._inputFocused = false;
          setTimeout(function () { if (!self._inputFocused) window.__cmtInputFocused = false; }, 200);
        });
      })(inputs[i]);
    }

    // 事件
    this.form.addEventListener('submit', function (e) { self._submit(e); });
    this.el.querySelector('.cs-cancel-reply').addEventListener('click', function () { self._cancelReply(); });
    this.listWrap.addEventListener('click', function (e) {
      var like = e.target.closest('.cs-like');
      var reply = e.target.closest('.cs-reply-btn');
      var more = e.target.closest('.cs-load-more');
      if (like) self._like(like);
      else if (reply) self._reply(reply);
      else if (more) self._load(true);
    });

    // 恢复记住的昵称
    try {
      var n = localStorage.getItem('cs_nick');
      var em = localStorage.getItem('cs_email');
      var w = localStorage.getItem('cs_web');
      if (n) this.form.nickname.value = n;
      if (em) this.form.email.value = em;
      if (w) this.form.website.value = w;
    } catch (e) {}

    this._load();
  };

  // ── 加载评论 ──
  CommentSystem.prototype._load = function (append) {
    var self = this;
    var url = this.api + '/api/comments?page=' + encodeURIComponent(this.page) + '&limit=50';
    if (append && this.cursor) url += '&cursor=' + this.cursor;

    if (!append) this.listWrap.innerHTML = '<div class="cs-loading">加载中</div>';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        self.comments = append ? self.comments.concat(data.comments) : data.comments;
        self.cursor = data.cursor;
        self.hasMore = data.hasMore;
        self._render(data.total);
      })
      .catch(function (err) {
        console.error('[Comments] load failed:', err);
        self.listWrap.innerHTML = '<div class="cs-empty">加载失败，请刷新重试</div>';
      });
  };

  // ── 提交评论 ──
  CommentSystem.prototype._submit = function (e) {
    e.preventDefault();
    var self = this;
    var nickname = this.form.nickname.value.trim();
    var content = this.form.content.value.trim();
    if (!nickname) { showToast('请输入昵称'); this.form.nickname.focus(); return; }
    if (!content) { showToast('请输入评论内容'); this.form.content.focus(); return; }

    var body = {
      page: this.page,
      parent_id: parseInt(this.form.parent_id.value) || 0,
      depth: parseInt(this.form.depth.value) || 0,
      nickname: nickname,
      email: this.form.email.value.trim(),
      website: this.form.website.value.trim(),
      content: content
    };

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = '发送中…';

    fetch(this.api + '/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.data.error || '提交失败');
      showToast(res.data.message || '评论已提交');
      self.form.content.value = '';
      self._cancelReply();
      self._load();  // 重新加载评论列表
      try {
        localStorage.setItem('cs_nick', body.nickname);
        if (body.email) localStorage.setItem('cs_email', body.email);
        if (body.website) localStorage.setItem('cs_web', body.website);
      } catch (e) {}
    })
    .catch(function (err) {
      showToast(err.message);
    })
    .finally(function () {
      self.submitBtn.disabled = false;
      self.submitBtn.textContent = '发表评论';
    });
  };

  // ── 点赞 ──
  CommentSystem.prototype._like = function (btn) {
    if (btn.classList.contains('liked')) return;
    var id = btn.dataset.id;
    fetch(this.api + '/api/comments/' + id + '/like', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        btn.classList.add('liked');
        btn.innerHTML = API_LIKED_ICON + '<span>' + d.liked + '</span>';
      })
      .catch(function (err) { showToast(err.message); });
  };

  // ── 回复 ──
  CommentSystem.prototype._reply = function (btn) {
    this.form.parent_id.value = btn.dataset.id;
    var item = btn.closest('.cs-item');
    this.form.depth.value = item ? (parseInt(item.dataset.depth || 0) + 1) : 1;
    this.replyName.textContent = btn.dataset.name;
    this.replyIndicator.classList.add('visible');
    this.form.content.focus();
    this.form.content.placeholder = '回复 ' + btn.dataset.name + '…';
  };

  CommentSystem.prototype._cancelReply = function () {
    this.form.parent_id.value = '0';
    this.form.depth.value = '0';
    this.replyIndicator.classList.remove('visible');
    this.form.content.placeholder = '写下你的评论…';
  };

  // ── 渲染评论列表 ──
  CommentSystem.prototype._render = function (total) {
    this.countEl.textContent = total > 0 ? '(' + total + ')' : '';
    if (!this.comments.length) {
      this.listWrap.innerHTML = '<div class="cs-empty">还没有评论，来抢沙发吧 ✨</div>';
      return;
    }
    this.listWrap.innerHTML =
      '<ul class="cs-list">' + buildTree(this.comments, 0) + '</ul>' +
      (this.hasMore ? '<button class="cs-load-more">加载更多评论</button>' : '');
  };

  // ── 暴露全局 ──
  window.HaprialComments = CommentSystem;
  window.__cmtInputFocused = false;
})();
