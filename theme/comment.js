// Haprial Comments — 酷安楼中楼
// 数据模型：每条评论有 parent_id（null=根评论，否则=父评论ID）
// 渲染模型：根评论=卡片，所有后代=展平回复列表
(function () {
  'use strict';

  var api = '', path = '', linkId = '';
  var list = [];          // 所有评论（平铺，含 parent_id）
  var loading = false, busy = false;
  var root = null, bound = false;
  var inlineEl = null, inlineTargetId = null;
  var FOLD = 120, PREVIEW = 3;

  // ── 工具 ──────────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ago(iso) {
    if (!iso) return ''; var d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 60) return '刚刚'; if (s < 3600) return (s / 60 | 0) + ' 分钟前'; if (s < 86400) return (s / 3600 | 0) + ' 小时前';
    if (s < 604800) return (s / 86400 | 0) + ' 天前';
    var m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '年') + m + '月' + day + '日';
  }
  function byId(id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  // 收集 pid 下的所有后代（展平，深度优先）
  function descendants(pid) {
    var out = [], q = [pid];
    while (q.length) {
      var cur = q.shift();
      for (var i = 0; i < list.length; i++) {
        if (list[i].parent_id === cur) { out.push(list[i]); q.push(list[i].id); }
      }
    }
    return out;
  }

  // ── 点赞 ──────────────────────────────────────────────────────────────────
  var LK = '***';
  function getLikes() { try { return JSON.parse(localStorage.getItem(LK) || '[]'); } catch (e) { return []; } }
  function setLikes(a) { try { localStorage.setItem(LK, JSON.stringify(a)); } catch (e) {} }
  function hasLiked(id) { return getLikes().indexOf(id) >= 0; }
  function flipLike(id) { var a = getLikes(), i = a.indexOf(id); if (i < 0) { a.push(id); setLikes(a); return true; } a.splice(i, 1); setLikes(a); return false; }

  // ── 草稿 ──────────────────────────────────────────────────────────────────
  var dtTmr = null, dtNS = '';
  function dtKey() { return 'cmt_d_' + dtNS; }
  function saveDraft() { try { localStorage.setItem(dtKey(), JSON.stringify({ n: $('cmtNick').value, e: $('cmtEmail').value, w: $('cmtWeb').value, c: $('cmtBody').value })); } catch (x) {} }
  function loadDraft() { try { var d = JSON.parse(localStorage.getItem(dtKey()) || 'null'); if (!d) return; if (d.n) $('cmtNick').value = d.n; if (d.e) $('cmtEmail').value = d.e; if (d.w) $('cmtWeb').value = d.w; if (d.c) $('cmtBody').value = d.c; } catch (x) {} }
  function clearDraft() { try { localStorage.removeItem(dtKey()); } catch (x) {} }
  function touchDraft() { clearTimeout(dtTmr); dtTmr = setTimeout(saveDraft, 500); }

  // ── XHR ───────────────────────────────────────────────────────────────────
  function xhr(method, url, body, cb) {
    var r = new XMLHttpRequest(); r.open(method, url);
    if (body) r.setRequestHeader('Content-Type', 'application/json');
    r.onload = function () { try { cb(null, JSON.parse(r.responseText)); } catch (e) { cb(e); } };
    r.onerror = function () { cb(new Error('网络错误')); };
    r.send(body ? JSON.stringify(body) : null);
  }

  // ── 头像 ──────────────────────────────────────────────────────────────────
  var PAL = ['#3D5A6E', '#4A7B6A', '#8E6B9E', '#B07D56', '#5C7A3D', '#6B5B8A', '#8B6B4A', '#4A6B8A'];
  function avCol(n) { var h = 0; for (var i = 0; i < n.length; i++) h = ((h << 5) - h) + n.charCodeAt(i); return PAL[Math.abs(h) % PAL.length]; }

  // ── 渲染：昵称 ───────────────────────────────────────────────────────────
  function nick(c) {
    return c.website ? '<a class="cm-nick" href="' + esc(c.website) + '" target="_blank" rel="noopener">' + esc(c.nick) + '</a>' : '<span class="cm-nick">' + esc(c.nick) + '</span>';
  }

  // ── 渲染：一条子回复 ─────────────────────────────────────────────────────
  function replyLine(r) {
    var at = '';
    if (r.parent_id) { var p = byId(r.parent_id); if (p && p.nick !== r.nick) at = '回复 <span class="cm-at">@' + esc(p.nick) + '</span>：'; }
    return '<div class="cm-reply" data-act="reply-line" data-id="' + r.id + '">' + nick(r) + '<span class="cm-rbody">' + at + r.content + '</span></div>';
  }

  // ── 渲染：一张卡片 ───────────────────────────────────────────────────────
  function card(topId) {
    var top = byId(topId); if (!top) return '';
    var reps = descendants(topId), total = reps.length;
    var liked = hasLiked(top.id), lk = top.likes || 0;

    var h = '<div class="cm-card" data-top="' + topId + '">';
    // 主评论
    h += '<div class="cm-row"><div class="cm-av" style="background:' + avCol(top.nick) + '">' + esc(top.nick.charAt(0).toUpperCase()) + '</div>';
    h += '<div class="cm-col"><div class="cm-meta">' + nick(top) + (top.device ? '<span class="cm-dev">' + esc(top.device) + '</span>' : '') + '<span class="cm-time">' + ago(top.time) + '</span></div>';
    h += '<div class="cm-body">' + top.content + '</div>';
    h += '<div class="cm-acts"><button class="cm-btn" data-act="reply-top" data-id="' + topId + '">回复</button>';
    h += '<button class="cm-like' + (liked ? ' on' : '') + '" data-act="like" data-id="' + topId + '">' + (liked ? '▲' : '△') + (lk ? ' ' + lk : '') + '</button>';
    h += '</div></div></div>';

    // 回复区
    if (total > 0) {
      h += '<div class="cm-reps" data-top="' + topId + '"><div class="cm-reps-list">';
      var show = reps.slice(0, PREVIEW);
      for (var i = 0; i < show.length; i++) h += replyLine(show[i]);
      h += '</div>';
      if (total > PREVIEW) h += '<button class="cm-more" data-act="expand" data-top="' + topId + '">展开剩余 ' + (total - PREVIEW) + ' 条回复</button>';
      h += '</div>';
    }

    // 内联回复框槽位
    h += '<div class="cm-slot"></div></div>';
    return h;
  }

  // ── 渲染：全部 ────────────────────────────────────────────────────────────
  function allCards() {
    var tops = []; for (var i = 0; i < list.length; i++) if (!list[i].parent_id) tops.push(list[i]);
    var h = ''; for (var i = 0; i < tops.length; i++) h += card(tops[i].id);
    return h;
  }

  function render() {
    if (!root) return;
    var n = list.length;
    root.innerHTML =
      '<div class="cm-wrap">' +
      '<div class="cm-head"><span class="cm-title">评论</span>' + (n ? '<span class="cm-cnt">' + n + '</span>' : '') + '</div>' +
      '<div class="cm-form" id="cmForm">' +
      '<input type="text" name="web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;height:0;width:0;opacity:0">' +
      '<div class="cm-fields"><input class="cm-in" id="cmtNick" placeholder="昵称 *" maxlength="50" autocomplete="name"><input class="cm-in" id="cmtEmail" placeholder="邮箱" maxlength="100" autocomplete="email"><input class="cm-in" id="cmtWeb" placeholder="网站" maxlength="200" autocomplete="url"></div>' +
      '<textarea class="cm-ta" id="cmtBody" placeholder="写下你的想法…" maxlength="2000"></textarea>' +
      '<div class="cm-foot"><span class="cm-hint"><code>**粗体**</code> <code>*斜体*</code> <code>`代码`</code></span><button class="cm-send" id="cmSend">发表</button></div>' +
      '</div>' +
      '<div id="cmList">' + (loading ? skel() : n ? allCards() : empty()) + '</div>' +
      '</div>';
    loadDraft();
    requestAnimationFrame(foldLong);
  }

  function skel() { return '<div class="cm-skel"><div class="cm-skel-av"></div><div class="cm-skel-ln" style="width:30%"></div></div><div class="cm-skel"><div class="cm-skel-av"></div><div class="cm-skel-ln" style="width:50%"></div></div>'; }
  function empty() { return '<div class="cm-empty"><p class="cm-empty-ico">💬</p><p>还没有评论，来抢沙发吧</p></div>'; }

  // ── 长评论折叠 ────────────────────────────────────────────────────────────
  function foldLong() {
    if (!root) return;
    var bs = root.querySelectorAll('.cm-body');
    for (var i = 0; i < bs.length; i++) (function (el) {
      if (el._f) return;
      requestAnimationFrame(function () {
        if (el.scrollHeight <= FOLD + 20) return;
        el._f = true; el.classList.add('cm-fold');
        var btn = document.createElement('button');
        btn.className = 'cm-fold-btn'; btn.textContent = '展开';
        btn.onclick = function () {
          if (el.classList.contains('cm-fold')) { el.classList.remove('cm-fold'); btn.textContent = '收起'; }
          else { el.classList.add('cm-fold'); btn.textContent = '展开'; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        };
        el.parentNode.insertBefore(btn, el.nextSibling);
      });
    })(bs[i]);
  }

  // ── 展开回复 ──────────────────────────────────────────────────────────────
  function expand(topId) {
    var el = root.querySelector('.cm-reps[data-top="' + topId + '"]');
    if (!el) return;
    var reps = descendants(topId), listEl = el.querySelector('.cm-reps-list');
    if (listEl) { var h = ''; for (var i = 0; i < reps.length; i++) h += replyLine(reps[i]); listEl.innerHTML = h; }
    var btn = el.querySelector('.cm-more'); if (btn) btn.remove();
  }

  // ── 内联回复框 ────────────────────────────────────────────────────────────
  function killInline() { if (inlineEl) { inlineEl.remove(); inlineEl = null; inlineTargetId = null; } }

  function spawnInline(targetId) {
    killInline();
    var target = byId(targetId); if (!target) return;
    inlineTargetId = targetId;

    // 找到所属根卡片
    var topId = targetId;
    if (target.parent_id) { var c = target; while (c.parent_id) { c = byId(c.parent_id); if (!c) break; } if (c) topId = c.id; }
    var card = root.querySelector('.cm-card[data-top="' + topId + '"]');
    if (!card) return;
    var slot = card.querySelector('.cm-slot');
    if (!slot) return;

    var f = document.createElement('div');
    f.className = 'cm-inline';
    f.innerHTML =
      '<div class="cm-fields"><input class="cm-in cm-il-nick" placeholder="昵称 *" maxlength="50"><input class="cm-in cm-il-email" placeholder="邮箱" maxlength="100"><input class="cm-in cm-il-web" placeholder="网站" maxlength="200"></div>' +
      '<textarea class="cm-ta cm-il-body" placeholder="回复 ' + esc(target.nick) + '…" maxlength="2000"></textarea>' +
      '<div class="cm-foot"><span class="cm-hint">Ctrl+Enter 发送</span><button class="cm-cancel">取消</button><button class="cm-send cm-il-send">回复</button></div>';

    slot.appendChild(f);
    inlineEl = f;

    var mn = $('cmtNick'), me = $('cmtEmail'), mw = $('cmtWeb');
    if (mn && mn.value) f.querySelector('.cm-il-nick').value = mn.value;
    if (me && me.value) f.querySelector('.cm-il-email').value = me.value;
    if (mw && mw.value) f.querySelector('.cm-il-web').value = mw.value;
    setTimeout(function () { f.querySelector('.cm-il-body').focus(); }, 60);

    f.querySelector('.cm-cancel').onclick = killInline;
    f.querySelector('.cm-il-send').onclick = function () { submitInline(f, targetId); };
    f.querySelector('.cm-il-body').onkeydown = function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitInline(f, targetId); } };
    var ins = f.querySelectorAll('.cm-in, .cm-ta'); for (var i = 0; i < ins.length; i++) ins[i].oninput = touchDraft;
  }

  function submitInline(f, parentId) {
    if (busy) return;
    var nick = (f.querySelector('.cm-il-nick').value || '').trim(), body = (f.querySelector('.cm-il-body').value || '').trim();
    if (!nick) { f.querySelector('.cm-il-nick').focus(); return; }
    if (!body) { f.querySelector('.cm-il-body').focus(); return; }
    var mn = $('cmtNick'), me = $('cmtEmail'), mw = $('cmtWeb');
    if (mn) mn.value = nick; if (me) me.value = (f.querySelector('.cm-il-email').value || '').trim(); if (mw) mw.value = (f.querySelector('.cm-il-web').value || '').trim();
    busy = true; var btn = f.querySelector('.cm-il-send'); btn.disabled = true; btn.textContent = '发送中…';
    doSubmit(nick, (f.querySelector('.cm-il-email').value || '').trim(), (f.querySelector('.cm-il-web').value || '').trim(), body, parentId, function () { busy = false; btn.disabled = false; btn.textContent = '回复'; killInline(); clearDraft(); });
  }

  // ── 主表单提交 ────────────────────────────────────────────────────────────
  function submitMain() {
    if (busy) return;
    var nick = ($('cmtNick').value || '').trim(), body = ($('cmtBody').value || '').trim();
    if (!nick) { $('cmtNick').focus(); return; } if (!body) { $('cmtBody').focus(); return; }
    busy = true; var btn = $('cmSend'); btn.disabled = true; btn.textContent = '发送中…';
    doSubmit(nick, ($('cmtEmail').value || '').trim(), ($('cmtWeb').value || '').trim(), body, null, function () { busy = false; btn.disabled = false; btn.textContent = '发表'; $('cmtBody').value = ''; clearDraft(); });
  }

  function doSubmit(nick, email, web, body, parentId, after) {
    var hp = root ? root.querySelector('#cmForm input[name="web"]') : null;
    xhr('POST', api + '/api/comments', { path: path, nick: nick, email: email, website_url: web, content: body, parent_id: parentId, link_id: linkId || '', website: hp ? hp.value : '' }, function (err, res) {
      after();
      if (err || !res || !res.ok) { alert((res && res.error) || '发送失败'); return; }
      if (res.comment) list.push(res.comment); // 后端已返回带 parent_id 的对象
      render();
    });
  }

  // ── 点赞 ──────────────────────────────────────────────────────────────────
  function handleLike(cid) {
    var c = byId(cid), cur = c ? (c.likes || 0) : 0;
    var now = flipLike(cid);
    if (c) c.likes = now ? cur + 1 : Math.max(0, cur - 1);
    var btn = root.querySelector('[data-act="like"][data-id="' + cid + '"]');
    if (btn) { btn.classList.toggle('on', now); btn.innerHTML = (now ? '▲' : '△') + (c.likes ? ' ' + c.likes : ''); }
    xhr('POST', api + '/api/comments/like', { comment_id: cid, path: path, link_id: linkId || '', action: now ? 'like' : 'unlike' }, function (err, res) {
      if (!err && c && res && res.likes !== undefined) { c.likes = res.likes; if (btn) btn.innerHTML = (now ? '▲' : '△') + (res.likes ? ' ' + res.likes : ''); }
    });
  }

  // ── 事件委托（只绑定一次）─────────────────────────────────────────────────
  function bind() {
    if (bound || !root) return; bound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.id === 'cmSend' || t.closest('#cmSend')) { e.preventDefault(); submitMain(); return; }
      var act = t.closest('[data-act]');
      if (act) {
        e.preventDefault();
        var a = act.dataset.act, id = act.dataset.id;
        if (a === 'reply-top' || a === 'reply-line') { inlineTargetId === id ? killInline() : spawnInline(id); }
        else if (a === 'like') handleLike(id);
        else if (a === 'expand') expand(act.dataset.top);
        return;
      }
    });
    function w(el) { if (!el) return; el.addEventListener('input', touchDraft); el.addEventListener('focus', function () { window.__cmtFocus = true; }); el.addEventListener('blur', function () { window.__cmtFocus = false; }); }
    w($('cmtNick')); w($('cmtEmail')); w($('cmtWeb')); w($('cmtBody'));
    var ta = $('cmtBody'); if (ta) ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitMain(); } });
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('cm-css')) return;
    var s = document.createElement('style'); s.id = 'cm-css';
    s.textContent = [
      '.cm-wrap{margin-top:48px;padding-top:32px;border-top:1px solid var(--outline-variant)}',
      '.cm-head{display:flex;align-items:center;gap:10px;margin-bottom:28px}',
      '.cm-title{font-size:18px;font-weight:600;color:var(--on-surface)}',
      '.cm-cnt{font-size:12px;font-weight:500;color:var(--on-primary-container);background:var(--primary-container);padding:2px 10px;border-radius:999px}',
      // 表单
      '.cm-form{background:var(--surface-container-low);border-radius:28px;padding:28px;margin-bottom:24px}',
      '.cm-fields{display:flex;gap:12px;margin-bottom:14px}',
      '.cm-in{flex:1;height:44px;padding:0 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;font-size:14px;color:var(--on-surface);outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit}',
      '.cm-in:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.cm-in::placeholder{color:var(--outline)}',
      '.cm-ta{width:100%;min-height:120px;padding:14px 16px;background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;font-size:14px;color:var(--on-surface);line-height:1.8;outline:none;resize:vertical;transition:border-color .2s,box-shadow .2s;font-family:inherit}',
      '.cm-ta:focus{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary-container)}',
      '.cm-ta::placeholder{color:var(--outline)}',
      '.cm-foot{display:flex;align-items:center;gap:12px;margin-top:14px}',
      '.cm-hint{flex:1;font-size:12px;color:var(--outline)}',
      '.cm-hint code{font-family:\'JetBrains Mono\',monospace;font-size:11px;background:var(--surface-container-high);padding:1px 5px;border-radius:3px}',
      // 按钮
      '.cm-send{height:40px;padding:0 24px;border:none;border-radius:999px;font-size:13px;font-weight:500;cursor:pointer;background:var(--primary);color:var(--on-primary);font-family:inherit}',
      '.cm-send:hover{box-shadow:var(--e1)}',
      '.cm-send:active{transform:scale(.97)}',
      '.cm-send:disabled{opacity:.4;pointer-events:none}',
      '.cm-cancel{height:40px;padding:0 16px;border:none;border-radius:999px;font-size:13px;cursor:pointer;background:none;color:var(--on-surface-variant);font-family:inherit}',
      '.cm-cancel:hover{background:var(--surface-container-high)}',
      // 内联
      '.cm-inline{background:var(--surface-container-low);border-radius:16px;padding:20px;margin-top:16px;animation:cmIn .2s ease both}',
      '.cm-inline .cm-fields{margin-bottom:12px}',
      '.cm-inline .cm-ta{min-height:80px}',
      '.cm-slot:empty{display:none}',
      // 卡片
      '.cm-card{padding:20px 0;border-bottom:1px solid var(--outline-variant)}',
      '.cm-card:last-child{border-bottom:none}',
      '.cm-row{display:flex;gap:12px}',
      '.cm-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:#fff;flex-shrink:0}',
      '.cm-col{flex:1;min-width:0}',
      '.cm-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}',
      '.cm-nick{font-size:14px;font-weight:600;color:var(--on-surface);text-decoration:none}',
      'a.cm-nick:hover{color:var(--primary)}',
      '.cm-time{font-size:12px;color:var(--outline)}',
      '.cm-dev{font-size:11px;color:var(--outline);background:var(--surface-container-high);padding:1px 6px;border-radius:4px}',
      // 内容
      '.cm-body{font-size:14px;line-height:1.8;color:var(--on-surface-variant);word-break:break-word}',
      '.cm-body code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:2px 6px;border-radius:3px}',
      '.cm-body strong{font-weight:600;color:var(--on-surface)}',
      '.cm-body a{color:var(--primary);text-decoration:none;border-bottom:1px solid var(--primary-container)}',
      '.cm-at{color:var(--primary);font-weight:500}',
      // 折叠
      '.cm-fold{max-height:120px;overflow:hidden;position:relative}',
      '.cm-fold::after{content:\'\';position:absolute;bottom:0;left:0;right:0;height:48px;background:linear-gradient(transparent,var(--surface-container-lowest))}',
      '.cm-fold-btn{font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px}',
      // 操作栏
      '.cm-acts{display:flex;align-items:center;gap:6px;margin-top:8px}',
      '.cm-btn,.cm-like{font-size:12px;color:var(--outline);background:none;border:none;cursor:pointer;padding:4px 10px;border-radius:999px;font-family:inherit}',
      '.cm-btn:hover,.cm-like:hover{color:var(--primary);background:var(--surface-container-high)}',
      '.cm-like.on{color:var(--primary)}',
      // 回复区（酷安楼中楼）
      '.cm-reps{margin-top:12px;margin-left:48px;background:var(--surface-container-low);border-radius:12px;padding:4px 16px}',
      '.cm-reps-list{display:flex;flex-direction:column}',
      '.cm-reply{display:flex;gap:6px;padding:8px 0;border-bottom:1px solid var(--outline-variant);font-size:13px;line-height:1.7;color:var(--on-surface-variant);cursor:pointer}',
      '.cm-reply:last-child{border-bottom:none}',
      '.cm-reply:hover{background:var(--surface-container)}',
      '.cm-reply .cm-nick{font-size:13px;font-weight:600;flex-shrink:0}',
      '.cm-rbody{flex:1;min-width:0;word-break:break-word}',
      '.cm-rbody code{font-family:\'JetBrains Mono\',monospace;font-size:.85em;background:var(--surface-container-high);color:var(--primary);padding:1px 5px;border-radius:3px}',
      '.cm-rbody strong{font-weight:600;color:var(--on-surface)}',
      '.cm-more{display:block;width:100%;padding:10px 0;border:none;background:none;font-size:13px;color:var(--primary);cursor:pointer;text-align:left}',
      '.cm-more:hover{opacity:.7}',
      // 空态/骨架
      '.cm-empty{text-align:center;padding:48px 0;font-size:14px;color:var(--outline)}',
      '.cm-empty-ico{font-size:32px;margin-bottom:12px;opacity:.3}',
      '.cm-skel{display:flex;gap:14px;padding:18px 0;align-items:center}',
      '.cm-skel-av{width:36px;height:36px;border-radius:50%;background:var(--surface-container-high)}',
      '.cm-skel-ln{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--surface-container-high) 0,var(--surface-container) 40%,var(--surface-container-high) 80%);background-size:200px 100%;animation:cmShimmer 1.6s ease-in-out infinite}',
      '@keyframes cmShimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}',
      '@keyframes cmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      // 移动端
      '@media(max-width:768px){',
      '.cm-form{padding:20px 16px;border-radius:20px}',
      '.cm-fields{flex-direction:column;gap:10px}',
      '.cm-in{height:48px;font-size:16px}',
      '.cm-ta{font-size:16px;min-height:100px}',
      '.cm-inline{padding:16px;border-radius:12px}',
      '.cm-inline .cm-fields{flex-direction:column}',
      '.cm-reps{margin-left:0;padding:4px 12px}',
      '.cm-av{width:32px;height:32px;font-size:13px}',
      '.cm-reply{padding:6px 0;font-size:12px}',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── 公开接口 ──────────────────────────────────────────────────────────────
  function init(p, apiUrl, lid) {
    destroy();
    if (!p && !lid) return;
    api = apiUrl || ''; path = p || ''; linkId = lid || '';
    dtNS = linkId ? 'link_' + linkId : (path || '').replace(/\//g, '_');
    list = []; loading = true; css();
    root = $('commentSection');
    if (!root) { var nav = $('artNav'); if (nav) { root = document.createElement('div'); root.id = 'commentSection'; nav.parentNode.insertBefore(root, nav.nextSibling); } }
    if (!root) return;
    render(); bind();
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { obs.disconnect(); fetchList(); } }, { rootMargin: '200px' });
      obs.observe(root);
    } else fetchList();
  }

  function fetchList() {
    if (!path && !linkId) return;
    loading = true; var el = $('cmList'); if (el) el.innerHTML = skel();
    xhr('GET', api + '/api/comments?path=' + encodeURIComponent(path), null, function (err, data) {
      loading = false;
      if (err || !data) { if (el) el.innerHTML = '<div class="cm-empty"><p>加载失败</p><button class="cm-cancel" onclick="window.__initComments(\'' + path + '\',\'' + api + '\',\'' + linkId + '\')">重试</button></div>'; return; }
      list = data.comments || [];
      render();
    });
  }

  function destroy() { killInline(); root = null; bound = false; path = ''; linkId = ''; list = []; loading = false; busy = false; }

  window.__initComments = init;
  window.__destroyComments = destroy;
  window.__cmtFocus = false;
})();
