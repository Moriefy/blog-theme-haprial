// ============================================================
// 评论系统前端 — 与 Haprial 博客主题融合
// 零依赖，MD3 风格，修复键盘冲突
// ============================================================
(function () {
  'use strict';

  // ── SVG 图标 ──
  var ICONS = {
    heart: '<svg viewBox="0 0 16 16"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>',
    heartFilled: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>',
    reply: '<svg viewBox="0 0 16 16"><path d="M6 3L2 7l4 4"/><path d="M2 7h8a4 4 0 014 4v1"/></svg>',
  };

  // ── 工具函数 ──
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr + 'Z').getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
    return new Date(dateStr + 'Z').toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function avatarHtml(hash, nickname) {
    if (hash) {
      return '<img src="https://www.gravatar.com/avatar/' + hash + '?d=retro&s=72" alt="' + esc(nickname) + '" loading="lazy" width="36" height="36">';
    }
    var initial = (nickname || '?').charAt(0).toUpperCase();
    return '<span class="cs-avatar-initial">' + esc(initial) + '</span>';
  }

  function showToast(msg) {
    var toast = document.querySelector('.cs-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cs-toast';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('visible'); }, 3000);
  }

  // ── 渲染单条评论 ──
  function renderComment(c) {
    var isEdited = c.created_at !== c.updated_at;
    var nameHtml = c.website
      ? '<a href="' + esc(c.website) + '" rel="noopener noreferrer nofollow" target="_blank">' + esc(c.nickname) + '</a>'
      : esc(c.nickname);

    return '<li class="cs-item" data-id="' + c.id + '" data-depth="' + c.depth + '" id="cs-' + c.id + '">'
      + '<div class="cs-item-main">'
      + '<div class="cs-avatar" aria-hidden="true">' + avatarHtml(c.avatar_hash, c.nickname) + '</div>'
      + '<div class="cs-body">'
      + '<div class="cs-meta"><span class="cs-nickname">' + nameHtml + '</span>'
      + '<time class="cs-time" datetime="' + c.created_at + '">' + timeAgo(c.created_at) + '</time>'
      + (isEdited ? '<span class="cs-edited">(已编辑)</span>' : '')
      + '</div>'
      + '<div class="cs-content">' + c.content_html + '</div>'
      + '<div class="cs-actions">'
      + '<button class="cs-action cs-like" data-id="' + c.id + '" aria-label="点赞">'
      + (c.liked > 0 ? ICONS.heartFilled : ICONS.heart)
      + '<span>' + (c.liked || '') + '</span></button>'
      + (c.depth < 2
        ? '<button class="cs-action cs-reply-btn" data-id="' + c.id + '" data-name="' + esc(c.nickname) + '" aria-label="回复">'
          + ICONS.reply + '<span>回复</span></button>'
        : '')
      + '</div></div></div></li>';
  }

  // ── 递归渲染树 ──
  function renderTree(comments, parentId) {
    var children = [];
    for (var i = 0; i < comments.length; i++) {
      if (comments[i].parent_id === parentId) children.push(comments[i]);
    }
    if (!children.length) return '';
    var html = '';
    for (var j = 0; j < children.length; j++) {
      var c = children[j];
      var replies = renderTree(comments, c.id);
      html += renderComment(c);
      if (replies) html += '<ul class="cs-replies cs-list">' + replies + '</ul>';
    }
    return html;
  }

  // ── 主类 ──
  function CommentSystem(container, config) {
    this.config = config || {};
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.el) return;
    this.api = this.config.api || this.el.dataset.api || '';
    this.page = this.config.page || this.el.dataset.page || '';
    if (!this.api || !this.page) return;

    this.comments = [];
    this.cursor = null;
    this.hasMore = false;

    // ── 标记：评论区正在输入，阻止键盘快捷键 ──
    this._inputFocused = false;

    this.init();
  }

  CommentSystem.prototype.init = function () {
    var self = this;

    // 注入 HTML
    this.el.innerHTML = ''
      + '<div class="cs-header"><h3>评论</h3><span class="cs-count"></span></div>'
      + '<form class="cs-form" novalidate>'
      + '<input type="hidden" name="parent_id" value="0">'
      + '<input type="hidden" name="depth" value="0">'
      + '<div class="cs-reply-indicator"><span>回复 <strong class="cs-reply-name"></strong></span>'
      + '<button type="button" class="cs-cancel-reply" aria-label="取消回复">&times;</button></div>'
      + '<div class="cs-form-row">'
      + '<input type="text" name="nickname" placeholder="昵称 *" required maxlength="30" autocomplete="name" aria-label="昵称">'
      + '<input type="email" name="email" placeholder="邮箱（可选）" maxlength="100" autocomplete="email" aria-label="邮箱">'
      + '<input type="url" name="website" placeholder="网站（可选）" maxlength="200" aria-label="个人网站">'
      + '</div>'
      + '<textarea name="content" placeholder="写下你的评论…" required maxlength="2000" rows="3" aria-label="评论内容"></textarea>'
      + '<div class="cs-form-actions">'
      + '<span class="cs-form-hint">支持 **粗体**、*斜体*、`代码`、[链接](url)</span>'
      + '<button type="submit" class="cs-submit">发表评论</button>'
      + '</div>'
      + '</form>'
      + '<div class="cs-list-wrap"><div class="cs-loading">加载中</div></div>';

    // 缓存引用
    this.form = this.el.querySelector('.cs-form');
    this.listWrap = this.el.querySelector('.cs-list-wrap');
    this.replyIndicator = this.el.querySelector('.cs-reply-indicator');
    this.replyName = this.el.querySelector('.cs-reply-name');
    this.countEl = this.el.querySelector('.cs-count');

    // ── 输入焦点追踪（修复键盘冲突）──
    var inputs = this.form.querySelectorAll('input, textarea');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('focus', function () {
        self._inputFocused = true;
        window.__cmtInputFocused = true;
      });
      inputs[i].addEventListener('blur', function () {
        self._inputFocused = false;
        // 延迟清除，避免点击按钮时误触发
        setTimeout(function () {
          if (!self._inputFocused) window.__cmtInputFocused = false;
        }, 200);
      });
    }

    // 事件绑定
    this.form.addEventListener('submit', function (e) { self.handleSubmit(e); });
    this.el.querySelector('.cs-cancel-reply').addEventListener('click', function () { self.cancelReply(); });

    // 事件代理
    this.listWrap.addEventListener('click', function (e) {
      var likeBtn = e.target.closest('.cs-like');
      var replyBtn = e.target.closest('.cs-reply-btn');
      var loadMoreBtn = e.target.closest('.cs-load-more');
      if (likeBtn) self.handleLike(likeBtn);
      else if (replyBtn) self.handleReply(replyBtn);
      else if (loadMoreBtn) self.loadComments(true);
    });

    this.loadComments();
  };

  // ── API: 加载评论 ──
  CommentSystem.prototype.loadComments = function (append) {
    var self = this;
    var url = this.api + '/api/comments?page=' + encodeURIComponent(this.page) + '&limit=50';
    if (append && this.cursor) url += '&cursor=' + this.cursor;

    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      self.comments = append ? self.comments.concat(data.comments) : data.comments;
      self.cursor = data.cursor;
      self.hasMore = data.hasMore;
      self.render(data.total);
    }).catch(function () {
      self.listWrap.innerHTML = '<div class="cs-empty">加载失败，请刷新重试</div>';
    });
  };

  // ── API: 提交评论 ──
  CommentSystem.prototype.handleSubmit = function (e) {
    e.preventDefault();
    var self = this;
    var btn = this.form.querySelector('.cs-submit');
    var data = {
      page: this.page,
      parent_id: parseInt(this.form.parent_id.value) || 0,
      depth: parseInt(this.form.depth.value) || 0,
      nickname: this.form.nickname.value.trim(),
      email: this.form.email.value.trim(),
      website: this.form.website.value.trim(),
      content: this.form.content.value.trim(),
    };
    if (!data.nickname) { showToast('请输入昵称'); this.form.nickname.focus(); return; }
    if (!data.content) { showToast('请输入评论内容'); this.form.content.focus(); return; }

    btn.disabled = true;
    btn.textContent = '发送中…';

    fetch(this.api + '/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.data.error || '提交失败');
      showToast(res.data.message || '评论已提交');
      self.form.content.value = '';
      self.cancelReply();
      if (res.data.status === 'approved') self.loadComments();
      else self.listWrap.insertAdjacentHTML('afterbegin', '<div class="cs-pending-notice">评论已提交，等待审核通过后显示</div>');
      try {
        localStorage.setItem('cs_nick', data.nickname);
        if (data.email) localStorage.setItem('cs_email', data.email);
        if (data.website) localStorage.setItem('cs_web', data.website);
      } catch (e) {}
    }).catch(function (err) {
      showToast(err.message);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = '发表评论';
    });
  };

  // ── 点赞 ──
  CommentSystem.prototype.handleLike = function (btn) {
    if (btn.classList.contains('liked')) return;
    var id = btn.dataset.id;
    var self = this;
    fetch(this.api + '/api/comments/' + id + '/like', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        btn.classList.add('liked');
        btn.innerHTML = ICONS.heartFilled + '<span>' + data.liked + '</span>';
      }).catch(function (err) { showToast(err.message); });
  };

  // ── 回复 ──
  CommentSystem.prototype.handleReply = function (btn) {
    this.form.parent_id.value = btn.dataset.id;
    var item = btn.closest('.cs-item');
    this.form.depth.value = item ? (parseInt(item.dataset.depth || 0) + 1) : 1;
    this.replyName.textContent = btn.dataset.name;
    this.replyIndicator.classList.add('visible');
    this.form.content.focus();
    this.form.content.placeholder = '回复 ' + btn.dataset.name + '…';
  };

  CommentSystem.prototype.cancelReply = function () {
    this.form.parent_id.value = '0';
    this.form.depth.value = '0';
    this.replyIndicator.classList.remove('visible');
    this.form.content.placeholder = '写下你的评论…';
  };

  // ── 渲染 ──
  CommentSystem.prototype.render = function (total) {
    this.countEl.textContent = total > 0 ? '(' + total + ')' : '';
    if (!this.comments.length) {
      this.listWrap.innerHTML = '<div class="cs-empty">还没有评论，来抢沙发吧 ✨</div>';
      return;
    }
    var html = '<ul class="cs-list">' + renderTree(this.comments, 0) + '</ul>';
    if (this.hasMore) html += '<button class="cs-load-more">加载更多评论</button>';
    this.listWrap.innerHTML = html;
    // 恢复记住的昵称
    try {
      var n = localStorage.getItem('cs_nick');
      var e = localStorage.getItem('cs_email');
      var w = localStorage.getItem('cs_web');
      if (n && !this.form.nickname.value) this.form.nickname.value = n;
      if (e && !this.form.email.value) this.form.email.value = e;
      if (w && !this.form.website.value) this.form.website.value = w;
    } catch (err) {}
  };

  // ── 暴露全局接口 ──
  window.HaprialComments = CommentSystem;

  // ── 为 app.js 提供输入焦点检查 ──
  window.__cmtInputFocused = false;
})();
