// Haprial Comments — 全新版本
// 酷安楼中楼逻辑：表单移动到被回复评论下方
(function () {
  'use strict';

  // ═══ 状态 ═══════════════════════════════════════════════════════════════
  var api = '', pageUrl = '';
  var all = [];           // 所有评论（平铺数组，每条有 pid 字段）
  var loading = false, sending = false;
  var root = null, bound = false;
  var FOLD = 120;

  // ═══ 工具 ═══════════════════════════════════════════════════════════════
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ago(iso) {
    if (!iso) return ''; var d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 60) return '刚刚'; if (s < 3600) return (s / 60 | 0) + ' 分钟前'; if (s < 86400) return (s / 3600 | 0) + ' 小时前';
    if (s < 604800) return (s / 86400 | 0) + ' 天前';
    var m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '年') + m + '月' + day + '日';
  }

  // 构建树：把平铺数组转成 { roots: [...], childrenOf: {id: [...]} }
  function buildTree(comments) {
    var map = {}, roots = [], kids = {};
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      // 兼容 pid 和 parent_id 两种字段名
      if (!c.pid && c.parent_id) c.pid = c.parent_id;
      map[c.id] = c;
    }
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      if (!c.pid) { roots.push(c); kids[c.id] = []; }
      else {
        var cur = c;
        while (cur.pid && map[cur.pid]) cur = map[cur.pid];
        var rootId = cur.id;
        if (!kids[rootId]) kids[rootId] = [];
        c._replyTo = map[c.pid] ? map[c.pid].nick : '';
        c._isSubReply = c.pid !== rootId;
        kids[rootId].push(c);
      }
    }
    return { roots: roots, kids: kids };
  }

  // ═══ 点赞 ═══════════════════════════════════════════════════════════════
  var LK_KEY = '***';
  function getLiked() { try { return JSON.parse(localStorage.getItem(LK_KEY) || '[]'); } catch { return []; } }
  function setLiked(a) { try { localStorage.setItem(LK_KEY, JSON.stringify(a)); } catch {} }
  function hasLiked(id) { return getLiked().indexOf(id) >= 0; }
  function flipLike(id) { var a = getLiked(), i = a.indexOf(id); if (i < 0) { a.push(id); setLiked(a); return true; } a.splice(i, 1); setLiked(a); return false; }

  // ═══ 草稿 ═══════════════════════════════════════════════════════════════
  var dk = 'cmt_draft', dTmr = null;
  function saveDraft() { try { localStorage.setItem(dk, JSON.stringify({ n: $('c_n').value, e: $('c_e').value, w: $('c_w').value })); } catch {} }
  function loadDraft() { try { var d = JSON.parse(localStorage.getItem(dk) || 'null'); if (!d) return; if (d.n) $('c_n').value = d.n; if (d.e) $('c_e').value = d.e; if (d.w) $('c_w').value = d.w; } catch {} }
  function clearDraft() { try { localStorage.removeItem(dk); } catch {} }
  function touchDraft() { clearTimeout(dTmr); dTmr = setTimeout(saveDraft, 500); }

  // ═══ XHR ═══════════════════════════════════════════════════════════════
  function xhr(method, url, body, cb) {
    var r = new XMLHttpRequest(); r.open(method, url);
    if (body) r.setRequestHeader('Content-Type', 'application/json');
    r.onload = function () { try { cb(null, JSON.parse(r.responseText)); } catch (e) { cb(e); } };
    r.onerror = function () { cb(new Error('网络错误')); };
    r.send(body ? JSON.stringify(body) : null);
  }

  // ═══ 头像颜色 ═══════════════════════════════════════════════════════════
  var PAL = ['#3D5A6E', '#4A7B6A', '#8E6B9E', '#B07D56', '#5C7A3D', '#6B5B8A', '#8B6B4A', '#4A6B8A'];
  function avCol(n) { var h = 0; for (var i = 0; i < n.length; i++) h = ((h << 5) - h) + n.charCodeAt(i); return PAL[Math.abs(h) % PAL.length]; }

  // ═══ 渲染 ═══════════════════════════════════════════════════════════════
  function nickHTML(c) {
    return c.website
      ? '<a class="q-nick" href="' + esc(c.website) + '" target="_blank" rel="noopener">' + esc(c.nick) + '</a>'
      : '<span class="q-nick">' + esc(c.nick) + '</span>';
  }

  function likeHTML(c) {
    var liked = hasLiked(c.id), lk = c.likes || 0;
    return '<button class="q-like' + (liked ? ' on' : '') + '" data-act="like" data-id="' + c.id + '">' + (liked ? '▲' : '△') + (lk ? ' ' + lk : '') + '</button>';
  }

  // 单条评论节点（递归渲染子评论）
  function nodeHTML(c, kidsMap, depth) {
    var children = kidsMap[c.id] || [];
    var replyTag = '';
    if (c._replyTo) {
      replyTag = c._isSubReply
        ? '<span class="q-replyto">回复 <span class="q-at">@' + esc(c._replyTo) + '</span></span>'
        : '';
    }

    var h = '<div class="q-node" data-depth="' + depth + '" id="q-' + c.id + '">';
    h += '<div class="q-row">';
    h += '<div class="q-av" style="background:' + avCol(c.nick) + '">' + esc(c.nick.charAt(0).toUpperCase()) + '</div>';
    h += '<div class="q-col">';
    h += '<div class="q-meta">' + nickHTML(c) + replyTag + (c.ua ? '<span class="q-dev">' + esc(c.ua) + '</span>' : '') + '<span class="q-time">' + ago(c.time) + '</span></div>';
    h += '<div class="q-body">' + c.content + '</div>';
    h += '<div class="q-acts">';
    h += '<button class="q-btn" data-act="reply" data-id="' + c.id + '" data-nick="' + esc(c.nick) + '">回复</button>';
    h += likeHTML(c);
    h += '</div>';
    h += '</div>'; // q-col
    h += '</div>'; // q-row

    // 子评论
    if (children.length) {
      h += '<div class="q-children">';
      for (var i = 0; i < children.length; i++) h += nodeHTML(children[i], kidsMap, depth + 1);
      h += '</div>';
    }

    // 表单槽位
    h += '<div class="q-slot" data-for="' + c.id + '"></div>';
    h += '</div>'; // q-node
    return h;
  }

  function renderAll() {
    var tree = buildTree(all);
    var roots = tree.roots;
    // 最新在前
    roots.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });

    var h = '';
    for (var i = 0; i < roots.length; i++) h += nodeHTML(roots[i], tree.kids, 0);
    return h;
  }

  // ═══ 完整渲染 ═══════════════════════════════════════════════════════════
  function render() {
    if (!root) return;
    var n = all.length;

    root.innerHTML =
      '<div class="q-wrap">' +
        '<div class="q-head"><span class="q-title">评论</span>' + (n ? '<span class="q-cnt">' + n + '</span>' : '') + '</div>' +

        // 表单占位
        '<div class="q-form-wrap" id="qFormWrap">' +
          '<div class="q-form" id="qForm">' +
            '<input type="text" name="hp" tabindex="-1" autocomplete="off" class="q-hp">' +
            '<div class="q-fields">' +
              '<input class="q-in" id="c_n" placeholder="昵称 *" maxlength="50" autocomplete="name">' +
              '<input class="q-in" id="c_e" placeholder="邮箱" maxlength="100" autocomplete="email">' +
              '<input class="q-in" id="c_w" placeholder="网站" maxlength="200" autocomplete="url">' +
            '</div>' +
            '<textarea class="q-ta" id="c_c" placeholder="写点什么…" maxlength="2000"></textarea>' +
            '<div class="q-foot">' +
              '<div class="q-foot-left">' +
                '<span class="q-hint"><code>**粗体**</code> <code>*斜体*</code> <code>`代码`</code></span>' +
                '<span class="q-reply-badge" id="qReplyBadge" style="display:none">回复 <strong id="qReplyName"></strong> <button class="q-cancel" id="qCancelReply">取消</button></span>' +
              '</div>' +
              '<button class="q-send" id="qSend">发表</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // 评论列表
        '<div id="qList">' + (loading ? skelHTML() : n ? renderAll() : emptyHTML()) + '</div>' +
      '</div>';

    loadDraft();
    requestAnimationFrame(foldLong);
  }

  function skelHTML() {
    return '<div class="q-skel"><div class="q-skel-av"></div><div class="q-skel-ln" style="width:30%"></div></div>' +
           '<div class="q-skel"><div class="q-skel-av"></div><div class="q-skel-ln" style="width:50%"></div></div>';
  }
  function emptyHTML() { return '<div class="q-empty"><p class="q-empty-ico">💬</p><p>还没有评论，来抢沙发吧</p></div>'; }

  // ═══ 长评论折叠 ═════════════════════════════════════════════════════════
  function foldLong() {
    if (!root) return;
    var bs = root.querySelectorAll('.q-body');
    for (var i = 0; i < bs.length; i++) (function (el) {
      if (el._f) return;
      requestAnimationFrame(function () {
        if (el.scrollHeight <= FOLD + 20) return;
        el._f = true; el.classList.add('q-fold');
        var btn = document.createElement('button');
        btn.className = 'q-fold-btn'; btn.textContent = '展开';
        btn.onclick = function () {
          if (el.classList.contains('q-fold')) { el.classList.remove('q-fold'); btn.textContent = '收起'; }
          else { el.classList.add('q-fold'); btn.textContent = '展开'; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        };
        el.parentNode.insertBefore(btn, el.nextSibling);
      });
    })(bs[i]);
  }

  // ═══ 回复：移动表单到被回复评论下方 ═════════════════════════════════════
  function moveForm(targetId, nickName) {
    var slot = root.querySelector('.q-slot[data-for="' + targetId + '"]');
    if (!slot) return;
    var form = $('qForm');
    slot.appendChild(form);
    $('qReplyBadge').style.display = 'inline-flex';
    $('qReplyName').textContent = nickName;
    form.setAttribute('data-pid', targetId);
    setTimeout(function () { $('c_c').focus(); }, 60);
  }

  function cancelReply() {
    var wrap = $('qFormWrap');
    var form = $('qForm');
    wrap.appendChild(form);
    $('qReplyBadge').style.display = 'none';
    form.removeAttribute('data-pid');
    $('c_c').value = '';
  }

  // ═══ 提交 ═══════════════════════════════════════════════════════════════
  function submit() {
    if (sending) return;
    var nick = ($('c_n').value || '').trim();
    var email = ($('c_e').value || '').trim();
    var website = ($('c_w').value || '').trim();
    var content = ($('c_c').value || '').trim();
    if (!nick) { $('c_n').focus(); return; }
    if (!content) { $('c_c').focus(); return; }

    var form = $('qForm');
    var pid = form.getAttribute('data-pid') || null;
    var hp = root ? root.querySelector('#qForm input[name="hp"]') : null;

    sending = true;
    var btn = $('qSend');
    btn.disabled = true; btn.textContent = '发送中…';

    xhr('POST', api + '/api/comments', {
      path: pageUrl, nick: nick, email: email, website_url: website,
      content: content, parent_id: pid, hp: hp ? hp.value : ''
    }, function (err, res) {
      sending = false;
      btn.disabled = false; btn.textContent = '发表';
      if (err || !res || !res.ok) { alert((res && res.error) || '发送失败'); return; }
      // 保存用户信息
      try { localStorage.setItem('cmt_user', JSON.stringify({ n: nick, e: email, w: website })); } catch {}
      if (res.comment) { var nc = res.comment; if (!nc.pid && nc.parent_id) nc.pid = nc.parent_id; all.push(nc); }
      cancelReply();
      render();
    });
  }

  // ═══ 点赞 ═══════════════════════════════════════════════════════════════
  function handleLike(id) {
    var c = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === id) { c = all[i]; break; }
    if (!c) return;
    var cur = c.likes || 0;
    var nowLiked = flipLike(id);
    c.likes = nowLiked ? cur + 1 : Math.max(0, cur - 1);

    var btn = root.querySelector('[data-act="like"][data-id="' + id + '"]');
    if (btn) { btn.classList.toggle('on', nowLiked); btn.innerHTML = (nowLiked ? '▲' : '△') + (c.likes ? ' ' + c.likes : ''); }

    xhr('POST', api + '/api/comments/like', { comment_id: id, path: pageUrl, action: nowLiked ? 'like' : 'unlike' }, function (err, res) {
      if (!err && res && res.likes !== undefined) { c.likes = res.likes; if (btn) btn.innerHTML = (nowLiked ? '▲' : '△') + (res.likes ? ' ' + res.likes : ''); }
    });
  }

  // ═══ 事件委托 ═══════════════════════════════════════════════════════════
  function bind() {
    if (bound || !root) return;
    bound = true;

    root.addEventListener('click', function (e) {
      var t = e.target;

      // 发表
      if (t.id === 'qSend' || t.closest('#qSend')) { e.preventDefault(); submit(); return; }

      // 取消回复
      if (t.id === 'qCancelReply' || t.closest('#qCancelReply')) { e.preventDefault(); cancelReply(); return; }

      // 操作按钮
      var act = t.closest('[data-act]');
      if (act) {
        e.preventDefault();
        var a = act.dataset.act, id = act.dataset.id;
        if (a === 'reply') moveForm(id, act.dataset.nick);
        else if (a === 'like') handleLike(id);
        return;
      }
    });

    // 草稿 + 键盘守卫
    function w(el) {
      if (!el) return;
      el.addEventListener('input', touchDraft);
      el.addEventListener('focus', function () { window.__cmtFocus = true; });
      el.addEventListener('blur', function () { window.__cmtFocus = false; });
    }
    w($('c_n')); w($('c_e')); w($('c_w')); w($('c_c'));
    var ta = $('c_c');
    if (ta) ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });
  }

  // ═══ CSS ═════════════════════════════════════════════════════════════════
  function injectCSS() {
    if (document.getElementById('q-css')) return;
    var s = document.createElement('style'); s.id = 'q-css';
    s.textContent = [
      // ── 整体 ──
      '.q-wrap{margin-top:48px;padding-top:32px;border-top:1px solid var(--outline-variant)}',
      '.q-head{display:flex;align-items:center;gap:10px;margin-bottom:28px}',
      '.q-title{font-size:18px;font-weight:600;color:var(--on-surface)}',
      '.q-cnt{font-size:12px;font-weight:500;color:var(--on-primary-container);background:var(--primary-container);padding:2px 10px;border-radius:999px}',

      // ── 表单 ──
      '.q-form{background:var(--surface-container-low);border-radius:28px;padding:28px}',
      '.q-fields{display:flex;gap:12px;margin-bottom:14px}',
      '.q-in{flex:1;height:44px;padding:0 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;font-size:14px;color:var(--on-surface);outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit}',
      '.q-in:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.q-in::placeholder{color:var(--outline)}',
      '.q-ta{width:100%;min-height:120px;padding:14px 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;font-size:14px;color:var(--on-surface);line-height:1.8;outline:none;resize:vertical;transition:border-color .2s,box-shadow .2s;font-family:inherit}',
      '.q-ta:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.q-ta::placeholder{color:var(--outline)}',
      '.q-foot{display:flex;align-items:center;gap:12px;margin-top:14px}',
      '.q-foot-left{flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.q-hint{font-size:12px;color:var(--outline)}',
      '.q-hint code{font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--surface-container-high);padding:1px 5px;border-radius:3px}',
      '.q-hp{position:absolute;left:-9999px;height:0;width:0;opacity:0}',

      // 回复徽章
      '.q-reply-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--on-primary-container);background:var(--primary-container);padding:4px 12px;border-radius:999px}',
      '.q-cancel{background:none;border:none;font-size:12px;color:var(--primary);cursor:pointer;padding:0;font-family:inherit}',
      '.q-cancel:hover{text-decoration:underline}',

      // 按钮
      '.q-send{height:40px;padding:0 24px;border:none;border-radius:999px;font-size:13px;font-weight:500;cursor:pointer;background:var(--primary);color:var(--on-primary);font-family:inherit;transition:box-shadow .2s}',
      '.q-send:hover{box-shadow:var(--e1)}',
      '.q-send:active{transform:scale(.97)}',
      '.q-send:disabled{opacity:.4;pointer-events:none}',

      // ── 评论节点 ──
      '.q-node{padding:20px 0;border-bottom:1px solid var(--outline-variant)}',
      '.q-node:last-child{border-bottom:none}',
      '.q-node[data-depth="0"]+.q-node[data-depth="0"]{border-top:none}',
      '.q-row{display:flex;gap:12px}',
      '.q-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;user-select:none}',
      '.q-col{flex:1;min-width:0}',
      '.q-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}',
      '.q-nick{font-size:14px;font-weight:600;color:var(--on-surface);text-decoration:none}',
      'a.q-nick:hover{color:var(--primary)}',
      '.q-time{font-size:12px;color:var(--outline)}',
      '.q-dev{font-size:11px;color:var(--outline);background:var(--surface-container-high);padding:1px 6px;border-radius:4px}',
      '.q-replyto{font-size:12px;color:var(--on-surface-variant)}',
      '.q-at{color:var(--primary);font-weight:500}',

      // 内容
      '.q-body{font-size:14px;line-height:1.8;color:var(--on-surface-variant);word-break:break-word}',
      '.q-body code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:2px 6px;border-radius:3px}',
      '.q-body strong{font-weight:600;color:var(--on-surface)}',
      '.q-body a{color:var(--primary);text-decoration:none;border-bottom:1px solid var(--primary-container)}',
      '.q-body a:hover{border-bottom-color:var(--primary)}',

      // 折叠
      '.q-fold{max-height:120px;overflow:hidden;position:relative}',
      '.q-fold::after{content:\'\';position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,var(--surface-container-lowest))}',
      '.q-fold-btn{font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px}',

      // 操作栏
      '.q-acts{display:flex;align-items:center;gap:6px;margin-top:8px}',
      '.q-btn,.q-like{font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:4px 10px;border-radius:999px;font-family:inherit}',
      '.q-btn:hover,.q-like:hover{color:var(--primary);background:var(--surface-container-high)}',
      '.q-like.on{color:var(--primary)}',

      // 子评论（楼中楼）
      '.q-children{margin-top:12px;margin-left:48px;background:var(--surface-container-low);border-radius:12px;padding:4px 16px}',
      '.q-children .q-node{padding:10px 0;border-bottom:1px solid var(--outline-variant)}',
      '.q-children .q-node:last-child{border-bottom:none}',
      '.q-children .q-av{width:28px;height:28px;font-size:11px}',
      '.q-children .q-nick{font-size:13px}',

      // 表单槽位（移动表单用）
      '.q-slot{margin-top:12px}',
      '.q-slot .q-form{padding:20px;border-radius:16px}',
      '.q-slot .q-ta{min-height:80px}',

      // 空态/骨架
      '.q-empty{text-align:center;padding:48px 0;font-size:14px;color:var(--outline)}',
      '.q-empty-ico{font-size:32px;margin-bottom:12px;opacity:.3}',
      '.q-skel{display:flex;gap:14px;padding:18px 0;align-items:center}',
      '.q-skel-av{width:36px;height:36px;border-radius:50%;background:var(--surface-container-high)}',
      '.q-skel-ln{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--surface-container-high) 0,var(--surface-container) 40%,var(--surface-container-high) 80%);background-size:200px 100%;animation:qShimmer 1.6s ease-in-out infinite}',
      '@keyframes qShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',

      // 移动端
      '@media(max-width:768px){',
      '.q-form{padding:20px 16px;border-radius:20px}',
      '.q-fields{flex-direction:column;gap:10px}',
      '.q-in{height:48px;font-size:16px}',
      '.q-ta{font-size:16px;min-height:100px;padding:12px 14px}',
      '.q-av{width:32px;height:32px;font-size:13px}',
      '.q-children{margin-left:0;padding:4px 12px}',
      '.q-children .q-av{width:26px;height:26px;font-size:10px}',
      '.q-slot .q-form{padding:16px;border-radius:12px}',
      '.q-slot .q-ta{font-size:16px}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══ 公开接口 ═══════════════════════════════════════════════════════════
  function init(url, apiUrl) {
    destroy();
    if (!url) return;
    pageUrl = url; api = apiUrl || '';
    all = []; loading = true;
    injectCSS();

    root = $('commentSection');
    if (!root) {
      var nav = $('artNav');
      if (nav) { root = document.createElement('div'); root.id = 'commentSection'; nav.parentNode.insertBefore(root, nav.nextSibling); }
    }
    if (!root) return;

    // 恢复用户信息
    try {
      var u = JSON.parse(localStorage.getItem('cmt_user') || '{}');
      render();
      if (u.n) $('c_n').value = u.n;
      if (u.e) $('c_e').value = u.e;
      if (u.w) $('c_w').value = u.w;
    } catch { render(); }

    bind();

    // 懒加载
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { obs.disconnect(); fetchList(); } }, { rootMargin: '200px' });
      obs.observe(root);
    } else fetchList();
  }

  function fetchList() {
    if (!pageUrl) return;
    loading = true;
    var el = $('qList'); if (el) el.innerHTML = skelHTML();
    xhr('GET', api + '/api/comments?path=' + encodeURIComponent(pageUrl), null, function (err, data) {
      loading = false;
      if (err || !data) {
        if (el) el.innerHTML = '<div class="q-empty"><p>加载失败</p><button class="q-cancel" onclick="window.__initComments(\'' + pageUrl + '\',\'' + api + '\')">重试</button></div>';
        return;
      }
      all = data.comments || [];
      render();
    });
  }

  function destroy() {
    root = null; bound = false; pageUrl = ''; all = []; loading = false; sending = false;
  }

  window.__initComments = init;
  window.__destroyComments = destroy;
  window.__cmtFocus = false;
})();
