// ============================================================
// 评论系统前端 — Haprial 博客专用
// 零依赖 · MD3 风格 · 键盘冲突修复
// ============================================================
(function () {
  'use strict';

  var HEART = '<svg viewBox="0 0 16 16"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var HEART_FILL = '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>';
  var REPLY = '<svg viewBox="0 0 16 16"><path d="M6 3L2 7l4 4"/><path d="M2 7h8a4 4 0 014 4v1"/></svg>';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function timeAgo(ds) {
    var s = Math.floor((Date.now() - new Date(ds + 'Z').getTime()) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return (s / 60 | 0) + ' 分钟前';
    if (s < 86400) return (s / 3600 | 0) + ' 小时前';
    if (s < 2592000) return (s / 86400 | 0) + ' 天前';
    return new Date(ds + 'Z').toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function avatar(h, n) {
    if (h) return '<img src="https://cravatar.cn/avatar/' + h + '?d=retro&s=72" alt="' + esc(n) + '" loading="lazy" width="36" height="36">';
    return '<span class="cs-avatar-initial">' + esc((n || '?')[0].toUpperCase()) + '</span>';
  }

  function toast(msg) {
    var t = document.querySelector('.cs-toast');
    if (!t) { t = document.createElement('div'); t.className = 'cs-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('visible');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('visible'); }, 3000);
  }

  function item(c) {
    var ed = c.created_at !== c.updated_at;
    var nm = c.website
      ? '<a href="' + esc(c.website) + '" rel="noopener noreferrer nofollow" target="_blank">' + esc(c.nickname) + '</a>'
      : esc(c.nickname);
    var badge = c.is_admin ? '<span class="cs-badge">艾德密</span>' : '' ;
    var contentLen = (c.content_html || '').replace(/<[^>]+>/g, '').length;
    var longCls = contentLen > 300 ? ' cs-long' : '';
    return '<li class="cs-item" data-id="' + c.id + '" data-depth="' + c.depth + '">'
      + '<div class="cs-item-main"><div class="cs-avatar">' + avatar(c.avatar_hash, c.nickname) + '</div>'
      + '<div class="cs-body"><div class="cs-meta"><span class="cs-nickname">' + nm + '</span>' + badge
      + '<time class="cs-time">' + timeAgo(c.created_at) + '</time>'
      + (ed ? '<span class="cs-edited">(已编辑)</span>' : '')
      + '</div><div class="cs-content' + longCls + '">' + c.content_html + '</div>'
      + (contentLen > 300 ? '<button class="cs-expand-btn">展开全文</button>' : '')
      + '<div class="cs-actions">'
      + '<button class="cs-action cs-like" data-id="' + c.id + '">'
      + (c.liked > 0 ? HEART_FILL : HEART) + '<span>' + (c.liked || '') + '</span></button>'
      + (c.depth < 2 ? '<button class="cs-action cs-reply-btn" data-id="' + c.id + '" data-name="' + esc(c.nickname) + '">' + REPLY + '<span>回复</span></button>' : '')
      + '</div></div></div></li>';
  }

  function tree(list, pid) {
    var h = '';
    for (var i = 0; i < list.length; i++) {
      if (list[i].parent_id !== pid) continue;
      var r = tree(list, list[i].id);
      h += item(list[i]);
      if (r) h += '<ul class="cs-replies cs-list">' + r + '</ul>';
    }
    return h;
  }

  // ══════════════════════════════════════════
  function CS(el, opts) {
    this.el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.el) return;
    this.api = (opts && opts.api) || '';
    this.page = (opts && opts.page) || '';
    if (!this.api || !this.page) return;
    this.comments = []; this.cursor = null; this.more = false;
    this._f = false;
    this._build();
  }

  CS.prototype._build = function () {
    var self = this;
    var d = this.el;
    d.style.opacity = '1';

    d.innerHTML =
      '<div class="cs-header"><h3>评论</h3><span class="cs-count"></span></div>'
      + '<form class="cs-form" novalidate>'
      + '<input type="hidden" name="pid" value="0"><input type="hidden" name="dep" value="0">'
      + '<div class="cs-reply-indicator"><span>回复 <strong class="cs-rn"></strong></span><button type="button" class="cs-cr" aria-label="取消"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>'
      + '<div class="cs-form-row">'
      + '<input type="text" name="nick" placeholder="昵称 *" required maxlength="30" autocomplete="name">'
      + '<input type="email" name="em" placeholder="邮箱（可选）" maxlength="100" autocomplete="email">'
      + '<input type="url" name="web" placeholder="网站（可选）" maxlength="200">'
      + '</div>'
      + '<div class="cs-textarea-wrap"><textarea name="body" placeholder="写下你的评论…" required maxlength="2000" rows="3"></textarea><div class="cs-btn-group"><button type="button" class="cs-discard" style="display:none">放弃</button><button type="submit" class="cs-submit">发送</button></div></div>'
      + '</form>'
      + '<div class="cs-lw"></div>';

    this.f = d.querySelector('.cs-form');
    this.lw = d.querySelector('.cs-lw');
    this.ri = d.querySelector('.cs-reply-indicator');
    this.rn = d.querySelector('.cs-rn');
    this.cnt = d.querySelector('.cs-count');
    this.btn = d.querySelector('.cs-submit');

    // 焦点追踪
    var ins = this.f.querySelectorAll('input,textarea');
    for (var i = 0; i < ins.length; i++) {
      (function (x) {
        x.addEventListener('focus', function () { self._f = true; window.__cmtInputFocused = true; });
        x.addEventListener('blur', function () { self._f = false; setTimeout(function () { if (!self._f) window.__cmtInputFocused = false; }, 200); });
      })(ins[i]);
    }

    this.discardBtn = d.querySelector('.cs-discard');
    this.f.addEventListener('submit', function (e) { self._submit(e); });
    d.querySelector('.cs-cr').addEventListener('click', function () { self._cancel(); });
    this.discardBtn.addEventListener('click', function () { self._cancel(); });

    // 博主认证入口（只在没认证时显示）
    var selfApi = this.api;
    try {
      if (!localStorage.getItem('cs_admin_token')) {
        var adminLink = document.createElement('a');
        adminLink.className = 'cs-admin-link';
        adminLink.textContent = '博主认证';
        adminLink.href = 'javascript:void(0)';
        adminLink.addEventListener('click', function () {
          var t = prompt('输入管理 Token：');
          if (!t) return;
          adminLink.textContent = '验证中…';
          adminLink.style.pointerEvents = 'none';
          fetch(selfApi + '/api/admin/verify', {
            headers: { 'Authorization': 'Bearer ' + t }
          }).then(function (r) { return r.json(); }).then(function (d) {
            if (d.ok) {
              localStorage.setItem('cs_admin_token', t);
              toast('认证成功，之后你的评论会显示博主标识');
              adminLink.remove();
            } else {
              toast('密码错误，认证失败');
              adminLink.textContent = '博主认证';
              adminLink.style.pointerEvents = '';
            }
          }).catch(function () {
            toast('验证请求失败，请稍后重试');
            adminLink.textContent = '博主认证';
            adminLink.style.pointerEvents = '';
          });
        });
        this.el.appendChild(adminLink);
      }
    } catch (e) {}
    this.lw.addEventListener('click', function (e) {
      var a = e.target.closest('.cs-like'), b = e.target.closest('.cs-reply-btn'), c = e.target.closest('.cs-load-more'), d = e.target.closest('.cs-expand-btn');
      if (a) self._like(a); else if (b) self._reply(b); else if (c) self._load(1);
      else if (d) {
        var content = d.previousElementSibling;
        if (content && content.classList.contains('cs-content')) {
          var expanded = content.classList.toggle('cs-expanded');
          d.textContent = expanded ? '收起' : '展开全文';
        }
      }
    });

    // 恢复昵称、邮箱、网站
    try {
      var n = localStorage.getItem('cs_nick'), em = localStorage.getItem('cs_email'), w = localStorage.getItem('cs_web');
      if (n) this.f.nick.value = n; if (em) this.f.em.value = em; if (w) this.f.web.value = w;
    } catch (e) {}

    // 恢复草稿
    try {
      var draft = localStorage.getItem('cs_draft_' + this.page);
      if (draft) this.f.body.value = draft;
    } catch (e) {}

    // 实时保存草稿
    this.f.body.addEventListener('input', function () {
      try { localStorage.setItem('cs_draft_' + self.page, self.f.body.value); } catch (e) {}
    });

    this._load();
  };

  CS.prototype._fetchWithTimeout = function (url, opts, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('请求超时')) }, timeoutMs || 10000);
      fetch(url, opts).then(function (r) { clearTimeout(timer); resolve(r); },
        function (e) { clearTimeout(timer); reject(e); });
    });
  };

  CS.prototype._load = function (ap, retries) {
    var self = this;
    var u = this.api + '/api/comments?page=' + encodeURIComponent(this.page) + '&limit=50';
    if (ap && this.cursor) u += '&cursor=' + this.cursor;
    if (!ap) this.lw.innerHTML = '<div class="cs-loading">加载中</div>';
    retries = retries || 0;

    self._fetchWithTimeout(u, {}, 10000).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      self.comments = ap ? self.comments.concat(d.comments) : d.comments;
      self.comments.sort(function(a, b) { return b.id - a.id; });
      self.cursor = d.cursor; self.more = d.hasMore;
      self._show(d.total);
      self._applyLikedState();
    }).catch(function (e) {
      console.error('[CS] load error:', e);
      if (retries < 1) {
        setTimeout(function () { self._load(ap, retries + 1); }, 2000);
      } else {
        self.lw.innerHTML = '<div class="cs-empty">加载失败，请点击<a href="javascript:void(0)" onclick="this.closest(\'.cs-lw\').parentNode.querySelector(\'.cs-form\').__cs && this.closest(\'.cs-lw\').parentNode.querySelector(\'.cs-form\').__cs._load()">重试</a>或刷新页面</div>';
      }
    });
  };

  CS.prototype._submit = function (e) {
    e.preventDefault();
    var self = this;
    var nk = this.f.nick.value.trim(), ct = this.f.body.value.trim();
    if (!nk) { toast('请输入昵称'); this.f.nick.focus(); return; }
    if (!ct) { toast('请输入评论内容'); this.f.body.focus(); return; }

    var bd = {
      page: this.page,
      parent_id: parseInt(this.f.pid.value) || 0,
      depth: parseInt(this.f.dep.value) || 0,
      nickname: nk, email: this.f.em.value.trim(), website: this.f.web.value.trim(), content: ct
    };

    this.btn.disabled = true; this.btn.textContent = '发送中…';

    var hdrs = { 'Content-Type': 'application/json' };
    try { var at = localStorage.getItem('cs_admin_token'); if (at) hdrs['Authorization'] = 'Bearer ' + at; } catch (e) {}
    fetch(this.api + '/api/comments', {
      method: 'POST', headers: hdrs, body: JSON.stringify(bd)
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (r) {
      if (!r.ok) throw new Error(r.d.error || '提交失败');
      toast(r.d.message || '评论已提交');
      self.f.body.value = '';
      try { localStorage.removeItem('cs_draft_' + self.page); } catch (e) {}
      self._cancel();
      self._load();
      try { localStorage.setItem('cs_nick', bd.nickname); if (bd.email) localStorage.setItem('cs_email', bd.email); if (bd.website) localStorage.setItem('cs_web', bd.website); } catch (e) {}
    }).catch(function (e) { toast(e.message); })
    .finally(function () { self.btn.disabled = false; self.btn.textContent = '发送'; });
  };

  CS.prototype._like = function (b) {
    if (b.classList.contains('liked')) return;
    var id = b.dataset.id;
    var self = this;
    fetch(this.api + '/api/comments/' + id + '/like', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        b.classList.add('liked');
        b.innerHTML = HEART_FILL + '<span>' + d.liked + '</span>';
        self._saveLiked(id);
      })
      .catch(function (e) { toast(e.message); });
  };

  CS.prototype._getLikedSet = function () {
    try {
      var raw = localStorage.getItem('cs_liked');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return [] }
  };

  CS.prototype._saveLiked = function (id) {
    try {
      var arr = this._getLikedSet();
      if (arr.indexOf(id) === -1) { arr.push(id); localStorage.setItem('cs_liked', JSON.stringify(arr)); }
    } catch (e) {}
  };

  CS.prototype._applyLikedState = function () {
    var liked = this._getLikedSet();
    var btns = this.el.querySelectorAll('.cs-like');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (liked.indexOf(b.dataset.id) !== -1 && !b.classList.contains('liked')) {
        b.classList.add('liked');
        var count = b.querySelector('span');
        b.innerHTML = HEART_FILL;
        if (count) b.appendChild(count);
      }
    }
  };

  CS.prototype._reply = function (b) {
    this.f.pid.value = b.dataset.id;
    var it = b.closest('.cs-item');
    this.f.dep.value = it ? (parseInt(it.dataset.depth || 0) + 1) : 1;
    this.rn.textContent = b.dataset.name;
    this.ri.classList.add('visible');
    this.discardBtn.style.display = '';
    this.f.body.placeholder = '回复 ' + b.dataset.name + '…';
    // 把表单移到被回复评论的下方
    if (it && it.nextSibling) {
      it.parentNode.insertBefore(this.f, it.nextSibling);
    } else if (it) {
      it.parentNode.appendChild(this.f);
    }
    this.f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.f.body.focus();
  };

  CS.prototype._cancel = function () {
    this.f.pid.value = '0'; this.f.dep.value = '0';
    this.ri.classList.remove('visible');
    this.discardBtn.style.display = 'none';
    this.f.body.placeholder = '写下你的评论…';
    // 把表单移回原位（列表后面）
    this.lw.parentNode.insertBefore(this.f, this.lw);
  };

  CS.prototype._show = function (total) {
    this.cnt.textContent = total > 0 ? '(' + total + ')' : '';
    if (!this.comments.length) { this.lw.innerHTML = '<div class="cs-empty">还没有评论，来抢沙发吧 ✨</div>'; return; }
    this.lw.innerHTML = '<ul class="cs-list">' + tree(this.comments, 0) + '</ul>'
      + (this.more ? '<button class="cs-load-more">加载更多评论</button>' : '');
  };

  window.HaprialComments = CS;
  window.__cmtInputFocused = false;
})();
