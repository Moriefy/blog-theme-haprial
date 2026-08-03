// Haprial Comments v2
// Clean rewrite: single event delegation, proper draft cache, MD3 design
(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  var API = '';
  var currentPath = null;
  var currentLinkId = null;
  var comments = [];
  var loading = false;
  var submitting = false;
  var observer = null;
  var $ = null; // container element
  var eventsBound = false;
  var inlineForm = null;
  var inlineReplyTo = null;
  var draftTimer = null;
  var FOLD_PX = 120;
  var MAX_DEPTH = 8;
  var LIKES_KEY = 'cmt_likes';
  var DRAFT_NS = '';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function timeAgo(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = new Date(), s = (now - d) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 604800) return Math.floor(s / 86400) + ' 天前';
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return (y === now.getFullYear() ? '' : y + '年') + m + '月' + day + '日';
  }

  function findComment(id) { for (var i = 0; i < comments.length; i++) { if (comments[i].id === id) return comments[i]; } return null; }
  function childrenOf(pid) { return comments.filter(function (c) { return (c.parent_id || null) === pid; }); }

  // ── Likes ─────────────────────────────────────────────────────────────────
  function getLikes() { try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '[]'); } catch (e) { return []; } }
  function setLikes(arr) { try { localStorage.setItem(LIKES_KEY, JSON.stringify(arr)); } catch (e) {} }
  function isLiked(id) { return getLikes().indexOf(id) !== -1; }
  function toggleLike(id) {
    var arr = getLikes(), i = arr.indexOf(id);
    if (i === -1) { arr.push(id); setLikes(arr); return true; }
    arr.splice(i, 1); setLikes(arr); return false;
  }

  // ── Draft Cache ───────────────────────────────────────────────────────────
  function draftKey() { return 'cmt_draft_' + DRAFT_NS; }
  function saveDraft() {
    var n = el('cmtNick'), e = el('cmtEmail'), w = el('cmtWebsite'), c = el('cmtContent');
    if (!n) return;
    try { localStorage.setItem(draftKey(), JSON.stringify({ n: n.value, e: e ? e.value : '', w: w ? w.value : '', c: c ? c.value : '' })); } catch (x) {}
  }
  function loadDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (!d) return;
      var n = el('cmtNick'), e = el('cmtEmail'), w = el('cmtWebsite'), c = el('cmtContent');
      if (n && d.n) n.value = d.n;
      if (e && d.e) e.value = d.e;
      if (w && d.w) w.value = d.w;
      if (c && d.c) c.value = d.c;
    } catch (x) {}
  }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (x) {} }
  function debounceDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 600); }

  // ── API ───────────────────────────────────────────────────────────────────
  function apiFetch(path, linkId, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API + '/api/comments?path=' + encodeURIComponent(path));
    xhr.onload = function () { try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e); } };
    xhr.onerror = function () { cb(new Error('网络错误')); };
    xhr.send();
  }

  function apiPost(data, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/comments');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () { try { var r = JSON.parse(xhr.responseText); cb(xhr.status === 200 ? null : r.error, r); } catch (e) { cb(e); } };
    xhr.onerror = function () { cb(new Error('网络错误')); };
    xhr.send(JSON.stringify(data));
  }

  function apiLike(id, path, linkId, action, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/comments/like');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () { try { var r = JSON.parse(xhr.responseText); cb(xhr.status === 200 ? null : r.error, r); } catch (e) { cb(e); } };
    xhr.onerror = function () { cb(new Error('网络错误')); };
    xhr.send(JSON.stringify({ comment_id: id, path: path, link_id: linkId, action: action }));
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  var COLORS = ['#3D5A6E', '#4A7B6A', '#8E6B9E', '#B07D56', '#5C7A3D', '#6B5B8A', '#8B6B4A', '#4A6B8A', '#7A5B6B', '#5B7A6A'];
  function avColor(n) { var h = 0; for (var i = 0; i < n.length; i++) h = ((h << 5) - h) + n.charCodeAt(i); return COLORS[Math.abs(h) % COLORS.length]; }

  // ── Render: single comment ────────────────────────────────────────────────
  function commentHTML(c, depth) {
    var liked = isLiked(c.id), lk = c.likes || 0;
    var replyTag = '';
    if (c.parent_id) { var p = findComment(c.parent_id); if (p) replyTag = '<span class="cmt-reply-tag">↩ ' + esc(p.nick) + '</span>'; }

    var deviceHtml = c.device ? '<span class="cmt-device">' + esc(c.device) + '</span>' : '';

    var nickHtml = c.website
      ? '<a class="cmt-nick" href="' + esc(c.website) + '" target="_blank" rel="noopener">' + esc(c.nick) + '</a>'
      : '<span class="cmt-nick">' + esc(c.nick) + '</span>';

    return '<div class="cmt-item" data-id="' + c.id + '">' +
      '<div class="cmt-avatar" style="background:' + avColor(c.nick) + '">' + esc(c.nick.charAt(0).toUpperCase()) + '</div>' +
      '<div class="cmt-body">' +
        '<div class="cmt-meta">' + nickHtml + replyTag + deviceHtml + '<span class="cmt-time">' + timeAgo(c.time) + '</span></div>' +
        '<div class="cmt-text">' + c.content + '</div>' +
        '<div class="cmt-bar">' +
          '<button class="cmt-act" data-action="reply" data-id="' + c.id + '">回复</button>' +
          '<button class="cmt-act cmt-like' + (liked ? ' liked' : '') + '" data-action="like" data-id="' + c.id + '">' +
            '<span class="cmt-like-icon">' + (liked ? '▲' : '△') + '</span><span class="cmt-like-n">' + (lk || '') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function treeHTML(pid, depth) {
    var ch = childrenOf(pid);
    if (!ch.length) return '';
    var cls = depth >= MAX_DEPTH ? 'cmt-children cmt-depth-accent' : 'cmt-children';
    var h = '<div class="' + cls + '">';
    for (var i = 0; i < ch.length; i++) { h += commentHTML(ch[i], depth); h += treeHTML(ch[i].id, depth + 1); }
    return h + '</div>';
  }

  function allCommentsHTML() {
    var top = comments.filter(function (c) { return !c.parent_id; });
    var h = '';
    for (var i = 0; i < top.length; i++) { h += commentHTML(top[i], 0); h += treeHTML(top[i].id, 1); }
    return h;
  }

  // ── Full render ───────────────────────────────────────────────────────────
  function render() {
    if (!$) return;
    var n = comments.length;

    $.innerHTML =
      '<div class="cmt-wrap">' +
        '<div class="cmt-head"><span class="cmt-head-title">评论</span>' + (n ? '<span class="cmt-head-count">' + n + '</span>' : '') + '</div>' +
        '<div class="cmt-form" id="cmtForm">' +
          '<input type="text" name="website_url" tabindex="-1" autocomplete="off" class="cmt-hp">' +
          '<div class="cmt-row">' +
            '<input class="cmt-in" id="cmtNick" type="text" placeholder="昵称 *" maxlength="50" autocomplete="name">' +
            '<input class="cmt-in" id="cmtEmail" type="email" placeholder="邮箱" maxlength="100" autocomplete="email">' +
            '<input class="cmt-in" id="cmtWebsite" type="url" placeholder="网站" maxlength="200" autocomplete="url">' +
          '</div>' +
          '<textarea class="cmt-ta" id="cmtContent" placeholder="写下你的想法…" maxlength="2000"></textarea>' +
          '<div class="cmt-foot">' +
            '<span class="cmt-hint"><code>**粗体**</code> <code>*斜体*</code> <code>`代码`</code></span>' +
            '<button class="cmt-submit" id="cmtSubmit">发表</button>' +
          '</div>' +
        '</div>' +
        '<div id="cmtList">' + (loading ? skeletonHTML() : (n ? '<div class="cmt-list">' + allCommentsHTML() + '</div>' : emptyHTML())) + '</div>' +
      '</div>';

    loadDraft();
    requestAnimationFrame(applyFold);
  }

  function skeletonHTML() {
    return '<div class="cmt-skel"><div class="cmt-skel-av"></div><div class="cmt-skel-body"><div class="cmt-skel-line" style="width:30%"></div><div class="cmt-skel-line"></div><div class="cmt-skel-line" style="width:70%"></div></div></div>' +
           '<div class="cmt-skel"><div class="cmt-skel-av"></div><div class="cmt-skel-body"><div class="cmt-skel-line" style="width:25%"></div><div class="cmt-skel-line" style="width:90%"></div></div></div>';
  }

  function emptyHTML() { return '<div class="cmt-empty"><div class="cmt-empty-icon">💬</div><p class="cmt-empty-text">还没有评论，来抢沙发吧</p></div>'; }

  // ── Long comment fold ─────────────────────────────────────────────────────
  function applyFold() {
    if (!$) return;
    var texts = $.querySelectorAll('.cmt-text');
    for (var i = 0; i < texts.length; i++) {
      var txt = texts[i];
      if (txt.dataset.folded) continue;
      (function (txt) {
        requestAnimationFrame(function () {
          if (txt.scrollHeight <= FOLD_PX + 20) return;
          txt.classList.add('cmt-folded');
          txt.dataset.folded = '1';
          var btn = document.createElement('button');
          btn.className = 'cmt-fold-btn';
          btn.textContent = '展开';
          btn.onclick = function () {
            if (txt.classList.contains('cmt-folded')) {
              txt.classList.remove('cmt-folded');
              txt.dataset.folded = '2';
              btn.textContent = '收起';
            } else {
              txt.classList.add('cmt-folded');
              txt.dataset.folded = '1';
              btn.textContent = '展开';
              txt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          };
          txt.parentNode.insertBefore(btn, txt.nextSibling);
        });
      })(txt);
    }
  }

  // ── Inline reply ──────────────────────────────────────────────────────────
  function removeInline() {
    if (inlineForm) { inlineForm.remove(); inlineForm = null; inlineReplyTo = null; }
  }

  function showInline(cid) {
    removeInline();
    var parent = findComment(cid);
    if (!parent) return;
    var item = $ ? $.querySelector('.cmt-item[data-id="' + cid + '"]') : null;
    if (!item) return;
    inlineReplyTo = cid;

    var f = document.createElement('div');
    f.className = 'cmt-inline';
    f.innerHTML =
      '<div class="cmt-row">' +
        '<input class="cmt-in cmt-in-nick" type="text" placeholder="昵称 *" maxlength="50">' +
        '<input class="cmt-in cmt-in-email" type="email" placeholder="邮箱" maxlength="100">' +
        '<input class="cmt-in cmt-in-site" type="url" placeholder="网站" maxlength="200">' +
      '</div>' +
      '<textarea class="cmt-ta cmt-ta-body" placeholder="回复 ' + esc(parent.nick) + '…" maxlength="2000"></textarea>' +
      '<div class="cmt-foot">' +
        '<span class="cmt-hint">Ctrl+Enter 发送</span>' +
        '<button class="cmt-cancel">取消</button>' +
        '<button class="cmt-submit cmt-inline-send">回复</button>' +
      '</div>';

    var body = item.querySelector('.cmt-body');
    if (body) body.appendChild(f); else item.appendChild(f);
    inlineForm = f;

    // Pre-fill from main form
    var mn = el('cmtNick'), me = el('cmtEmail'), mw = el('cmtWebsite');
    var ni = f.querySelector('.cmt-in-nick'), ei = f.querySelector('.cmt-in-email'), wi = f.querySelector('.cmt-in-site');
    if (mn && mn.value) ni.value = mn.value;
    if (me && me.value) ei.value = me.value;
    if (mw && mw.value) wi.value = mw.value;

    setTimeout(function () { f.querySelector('.cmt-ta-body').focus(); }, 50);

    // Inline events
    f.querySelector('.cmt-cancel').onclick = removeInline;
    f.querySelector('.cmt-inline-send').onclick = function () { submitInline(f, cid); };
    f.querySelector('.cmt-ta-body').onkeydown = function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitInline(f, cid); }
    };

    // Draft save
    var inputs = f.querySelectorAll('.cmt-in, .cmt-ta');
    for (var i = 0; i < inputs.length; i++) inputs[i].oninput = debounceDraft;
  }

  function submitInline(f, parentId) {
    if (submitting) return;
    var nick = (f.querySelector('.cmt-in-nick').value || '').trim();
    var email = (f.querySelector('.cmt-in-email').value || '').trim();
    var website = (f.querySelector('.cmt-in-site').value || '').trim();
    var content = (f.querySelector('.cmt-ta-body').value || '').trim();
    if (!nick) { f.querySelector('.cmt-in-nick').focus(); return; }
    if (!content) { f.querySelector('.cmt-ta-body').focus(); return; }

    // Sync to main form
    var mn = el('cmtNick'), me = el('cmtEmail'), mw = el('cmtWebsite');
    if (mn) mn.value = nick;
    if (me) me.value = email;
    if (mw) mw.value = website;

    submitting = true;
    var btn = f.querySelector('.cmt-inline-send');
    btn.disabled = true; btn.textContent = '发送中…';

    doSubmit({ path: currentPath, nick: nick, email: email, website_url: website, content: content, parent_id: parentId, link_id: currentLinkId || '', website: '' }, function () {
      submitting = false;
      btn.disabled = false; btn.textContent = '回复';
      removeInline();
      clearDraft();
      var ci = el('cmtContent'); if (ci) ci.value = '';
    });
  }

  // ── Submit main ───────────────────────────────────────────────────────────
  function submitMain() {
    if (submitting) return;
    var nick = (el('cmtNick').value || '').trim();
    var email = (el('cmtEmail').value || '').trim();
    var website = (el('cmtWebsite').value || '').trim();
    var content = (el('cmtContent').value || '').trim();
    if (!nick) { el('cmtNick').focus(); return; }
    if (!content) { el('cmtContent').focus(); return; }

    submitting = true;
    var btn = el('cmtSubmit');
    btn.disabled = true; btn.textContent = '发送中…';

    var hp = $ ? $.querySelector('#cmtForm input[name="website_url"]') : null;
    doSubmit({ path: currentPath, nick: nick, email: email, website_url: website, content: content, parent_id: null, link_id: currentLinkId || '', website: hp ? hp.value : '' }, function () {
      submitting = false;
      btn.disabled = false; btn.textContent = '发表';
      el('cmtContent').value = '';
      clearDraft();
    });
  }

  function doSubmit(data, after) {
    apiPost(data, function (err, result) {
      after();
      if (err) { alert(typeof err === 'string' ? err : '发送失败'); return; }
      if (result && result.comment) comments.push(result.comment);
      render();
    });
  }

  // ── Like ──────────────────────────────────────────────────────────────────
  function handleLike(cid) {
    var c = findComment(cid);
    var now = c ? (c.likes || 0) : 0;
    var added = toggleLike(cid);
    if (c) c.likes = added ? now + 1 : Math.max(0, now - 1);

    // Update UI instantly
    var btn = $ ? $.querySelector('[data-action="like"][data-id="' + cid + '"]') : null;
    if (btn) {
      btn.classList.toggle('liked', added);
      btn.innerHTML = '<span class="cmt-like-icon">' + (added ? '▲' : '△') + '</span><span class="cmt-like-n">' + (c.likes || '') + '</span>';
    }

    apiLike(cid, currentPath, currentLinkId, added ? 'like' : 'unlike', function (err, r) {
      if (!err && c && r && r.likes !== undefined) {
        c.likes = r.likes;
        if (btn) {
          var n = btn.querySelector('.cmt-like-n');
          if (n) n.textContent = r.likes || '';
        }
      }
    });
  }

  // ── Event delegation (bound once, never re-bound) ─────────────────────────
  function bindEvents() {
    if (eventsBound || !$) return;
    eventsBound = true;

    $.addEventListener('click', function (e) {
      var t = e.target;

      // Submit
      if (t.id === 'cmtSubmit' || t.closest('#cmtSubmit')) { e.preventDefault(); submitMain(); return; }

      // Reply / Like buttons
      var act = t.closest('[data-action]');
      if (act) {
        e.preventDefault();
        var action = act.dataset.action;
        var id = act.dataset.id;
        if (action === 'reply') {
          if (inlineReplyTo === id) removeInline(); else showInline(id);
        } else if (action === 'like') {
          handleLike(id);
        }
        return;
      }
    });

    // Main form: draft + keyboard guard
    function watchInput(inp) {
      if (!inp) return;
      inp.addEventListener('input', debounceDraft);
      inp.addEventListener('focus', function () { window.__cmtInputFocused = true; });
      inp.addEventListener('blur', function () { window.__cmtInputFocused = false; });
    }
    watchInput(el('cmtNick'));
    watchInput(el('cmtEmail'));
    watchInput(el('cmtWebsite'));
    watchInput(el('cmtContent'));

    var ta = el('cmtContent');
    if (ta) ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitMain(); }
    });
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('haprial-cmt-css')) return;
    var s = document.createElement('style');
    s.id = 'haprial-cmt-css';
    s.textContent = [
      // Wrap
      '.cmt-wrap{margin-top:48px;padding-top:32px;border-top:1px solid var(--outline-variant)}',
      '.cmt-head{display:flex;align-items:center;gap:10px;margin-bottom:28px}',
      '.cmt-head-title{font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:18px;font-weight:600;color:var(--on-surface)}',
      '.cmt-head-count{font-size:12px;font-weight:500;color:var(--on-primary-container);background:var(--primary-container);padding:2px 10px;border-radius:var(--shape-full)}',

      // Form
      '.cmt-form{background:var(--surface-container-low);border-radius:var(--shape-xl);padding:28px;margin-bottom:32px}',
      '.cmt-row{display:flex;gap:12px;margin-bottom:14px}',
      '.cmt-in{flex:1;height:44px;padding:0 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:var(--shape-m);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;color:var(--on-surface);outline:none;transition:border-color 200ms,box-shadow 200ms}',
      '.cmt-in:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.cmt-in::placeholder{color:var(--outline)}',
      '.cmt-ta{width:100%;min-height:120px;padding:14px 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:var(--shape-m);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:14px;color:var(--on-surface);line-height:1.8;outline:none;resize:vertical;transition:border-color 200ms,box-shadow 200ms}',
      '.cmt-ta:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.cmt-ta::placeholder{color:var(--outline)}',
      '.cmt-foot{display:flex;align-items:center;gap:12px;margin-top:14px}',
      '.cmt-hint{flex:1;font-size:12px;color:var(--outline)}',
      '.cmt-hint code{font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--surface-container-high);padding:1px 5px;border-radius:3px}',
      '.cmt-hp{position:absolute;left:-9999px;opacity:0;height:0;width:0;overflow:hidden}',

      // Submit button
      '.cmt-submit{height:40px;padding:0 24px;border:none;border-radius:var(--shape-full);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:13px;font-weight:500;cursor:pointer;background:var(--primary);color:var(--on-primary);transition:box-shadow 200ms,opacity 200ms;letter-spacing:.02em}',
      '.cmt-submit:hover{box-shadow:var(--e1)}',
      '.cmt-submit:active{transform:scale(.97)}',
      '.cmt-submit:disabled{opacity:.4;pointer-events:none}',
      '.cmt-cancel{height:40px;padding:0 16px;border:none;border-radius:var(--shape-full);font-family:\'Noto Sans SC\',\'PingFang SC\',sans-serif;font-size:13px;cursor:pointer;background:none;color:var(--on-surface-variant);transition:background 150ms}',
      '.cmt-cancel:hover{background:var(--surface-container-high)}',

      // Inline form
      '.cmt-inline{background:var(--surface-container-low);border-radius:var(--shape-l);padding:20px;margin:14px 0;animation:cmtIn .2s ease both}',
      '.cmt-inline .cmt-row{margin-bottom:12px}',
      '.cmt-inline .cmt-ta{min-height:80px}',

      // Comment list
      '.cmt-list{display:flex;flex-direction:column}',
      '.cmt-item{display:flex;gap:14px;padding:20px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cmt-item:last-child{border-bottom:none}',
      '.cmt-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#fff;flex-shrink:0;user-select:none}',
      '.cmt-body{flex:1;min-width:0}',
      '.cmt-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}',
      '.cmt-nick{font-size:14px;font-weight:600;color:var(--on-surface);text-decoration:none}',
      'a.cmt-nick:hover{color:var(--primary)}',
      '.cmt-time{font-size:12px;color:var(--outline)}',
      '.cmt-device{font-size:11px;color:var(--outline);background:var(--surface-container-high);padding:1px 6px;border-radius:var(--shape-xs)}',
      '.cmt-reply-tag{font-size:11px;color:var(--primary);background:var(--primary-container);padding:1px 8px;border-radius:var(--shape-full)}',

      // Content
      '.cmt-text{font-size:14px;line-height:1.8;color:var(--on-surface-variant);word-break:break-word}',
      '.cmt-text code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:2px 6px;border-radius:3px}',
      '.cmt-text strong{font-weight:600;color:var(--on-surface)}',
      '.cmt-text a{color:var(--primary);text-decoration:none;border-bottom:1px solid var(--primary-container)}',
      '.cmt-text a:hover{border-bottom-color:var(--primary)}',
      '.cmt-mention{color:var(--primary);font-weight:500}',

      // Fold
      '.cmt-folded{max-height:120px;overflow:hidden;position:relative}',
      '.cmt-folded::after{content:\'\';position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,var(--surface-container-lowest))}',
      '.cmt-fold-btn{font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px}',
      '.cmt-fold-btn:hover{text-decoration:underline}',

      // Action bar
      '.cmt-bar{display:flex;align-items:center;gap:8px;margin-top:8px}',
      '.cmt-act{font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:var(--shape-full);transition:color 150ms,background 150ms;display:inline-flex;align-items:center;gap:4px}',
      '.cmt-act:hover{color:var(--primary);background:var(--surface-container-high)}',
      '.cmt-like.liked{color:var(--primary)}',
      '.cmt-like-icon{font-size:11px}',
      '.cmt-like-n{font-variant-numeric:tabular-nums;min-width:8px}',

      // Nesting
      '.cmt-children{margin-left:0;padding-left:24px;border-left:2px solid var(--outline-variant)}',
      '.cmt-children .cmt-item{padding:14px 0}',
      '.cmt-children .cmt-avatar{width:30px;height:30px;font-size:12px}',
      '.cmt-depth-accent{border-left:3px solid var(--primary);background:var(--surface-container-low);border-radius:0 var(--shape-s) var(--shape-s) 0;padding-left:14px}',

      // States
      '.cmt-empty{text-align:center;padding:48px 0}',
      '.cmt-empty-icon{font-size:32px;margin-bottom:12px;opacity:.3}',
      '.cmt-empty-text{font-size:14px;color:var(--outline)}',
      '.cmt-skel{display:flex;gap:14px;padding:18px 0}',
      '.cmt-skel-av{width:36px;height:36px;border-radius:50%;background:var(--surface-container-high)}',
      '.cmt-skel-body{flex:1}',
      '.cmt-skel-line{height:12px;border-radius:6px;margin-bottom:10px;background:linear-gradient(90deg,var(--surface-container-high) 0,var(--surface-container) 40%,var(--surface-container-high) 80%);background-size:200px 100%;animation:cmtShimmer 1.6s ease-in-out infinite}',
      '@keyframes cmtShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',
      '@keyframes cmtIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',

      // Mobile
      '@media(max-width:768px){',
      '.cmt-form{padding:20px 16px}',
      '.cmt-row{flex-direction:column;gap:10px}',
      '.cmt-in{height:48px;font-size:16px}',
      '.cmt-ta{font-size:16px;min-height:100px;padding:12px 14px}',
      '.cmt-inline{padding:16px}',
      '.cmt-inline .cmt-row{flex-direction:column}',
      '.cmt-inline .cmt-in{height:44px;font-size:16px}',
      '.cmt-inline .cmt-ta{font-size:16px}',
      '.cmt-children{padding-left:16px}',
      '.cmt-item{gap:10px;padding:14px 0}',
      '.cmt-avatar{width:32px;height:32px;font-size:13px}',
      '.cmt-children .cmt-avatar{width:28px;height:28px;font-size:11px}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function initComments(path, apiUrl, linkId) {
    destroyComments();
    if (!path && !linkId) return;
    API = apiUrl || API;
    currentPath = path || '';
    currentLinkId = linkId || null;
    DRAFT_NS = currentLinkId ? 'link_' + currentLinkId : (currentPath || '').replace(/\//g, '_');
    comments = [];
    loading = true;

    injectCSS();

    $ = el('commentSection');
    if (!$) {
      var nav = el('artNav');
      if (nav) {
        $ = document.createElement('div');
        $.id = 'commentSection';
        nav.parentNode.insertBefore($, nav.nextSibling);
      }
    }
    if (!$) return;

    render();
    bindEvents();

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { observer.disconnect(); observer = null; loadComments(); }
      }, { rootMargin: '200px' });
      observer.observe($);
    } else {
      loadComments();
    }
  }

  function loadComments() {
    if (!currentPath && !currentLinkId) return;
    loading = true;
    var list = el('cmtList');
    if (list) list.innerHTML = skeletonHTML();

    apiFetch(currentPath, currentLinkId, function (err, data) {
      loading = false;
      if (err) {
        if (list) list.innerHTML = '<div class="cmt-empty"><p class="cmt-empty-text">评论加载失败</p><button class="cmt-cancel" onclick="window.__initComments(\'' + (currentPath || '') + '\',\'' + API + '\',\'' + (currentLinkId || '') + '\')">重试</button></div>';
        return;
      }
      comments = (data && data.comments) || [];
      render();
    });
  }

  function destroyComments() {
    if (observer) { observer.disconnect(); observer = null; }
    removeInline();
    $ = null;
    eventsBound = false;
    currentPath = null;
    currentLinkId = null;
    comments = [];
    loading = false;
    submitting = false;
  }

  window.__initComments = initComments;
  window.__destroyComments = destroyComments;
  window.__cmtInputFocused = false;
})();
