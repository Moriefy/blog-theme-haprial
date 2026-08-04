// ============================================================
// Haprial 评论系统 — Cloudflare Worker (单文件)
// ============================================================

// MD5 实现 (Cravatar/Gravatar 兼容)
function md5(str) {
  function h(a,b){var c=(a&65535)+(b&65535);return((a>>16)+(b>>16)+(c>>16))<<16|c&65535}
  function k(a,b,c,d,e,f){b=h(h(b,a),h(d,f));return h(b<<e|b>>>32-e,c)}
  function l(a,b,c,d,e,f,g){return k(b&c|~b&d,a,b,e,f,g)}
  function m(a,b,c,d,e,f,g){return k(b&d|c&~d,a,b,e,f,g)}
  function n(a,b,c,d,e,f,g){return k(b^c^d,a,b,e,f,g)}
  function p(a,b,c,d,e,f,g){return k(c^(b|~d),a,b,e,f,g)}
  var r,s,t,u,v,w=1732584193,x=-271733879,y=-1732584194,z=271733878;
  str=unescape(encodeURIComponent(str));var a=str.length;
  var b=[];for(r=0;r<a;r++)b[r>>2]|=(str.charCodeAt(r)&255)<<(r%4)*8;
  b[a>>2]|=128<<((a%4)*8);b[14+(a+8>>>6<<4)]=a*8;
  for(r=0;r<b.length;r+=16){
    s=w;t=x;u=y;v=z;
    w=l(w,x,y,z,b[r],7,-680876936);z=l(z,w,x,y,b[r+1],12,-389564586);
    y=l(y,z,w,x,b[r+2],17,606105819);x=l(x,y,z,w,b[r+3],22,-1044525330);
    w=l(w,x,y,z,b[r+4],7,-176418897);z=l(z,w,x,y,b[r+5],12,1200080426);
    y=l(y,z,w,x,b[r+6],17,-1473231341);x=l(x,y,z,w,b[r+7],22,-45705983);
    w=l(w,x,y,z,b[r+8],7,1770035416);z=l(z,w,x,y,b[r+9],12,-1958414417);
    y=l(y,z,w,x,b[r+10],17,-42063);x=l(x,y,z,w,b[r+11],22,-1990404162);
    w=l(w,x,y,z,b[r+12],7,1804603682);z=l(z,w,x,y,b[r+13],12,-40341101);
    y=l(y,z,w,x,b[r+14],17,-1502002290);x=l(x,y,z,w,b[r+15],22,1236535329);
    w=m(w,x,y,z,b[r+1],5,-165796510);z=m(z,w,x,y,b[r+6],9,-1069501632);
    y=m(y,z,w,x,b[r+11],14,643717713);x=m(x,y,z,w,b[r],20,-373897302);
    w=m(w,x,y,z,b[r+5],5,-701558691);z=m(z,w,x,y,b[r+10],9,38016083);
    y=m(y,z,w,x,b[r+15],14,-660478335);x=m(x,y,z,w,b[r+4],20,-405537848);
    w=m(w,x,y,z,b[r+9],5,568446438);z=m(z,w,x,y,b[r+14],9,-1019803690);
    y=m(y,z,w,x,b[r+3],14,-187363961);x=m(x,y,z,w,b[r+8],20,1163531501);
    w=m(w,x,y,z,b[r+13],5,-1444681467);z=m(z,w,x,y,b[r+2],9,-51403784);
    y=m(y,z,w,x,b[r+7],14,1735328473);x=m(x,y,z,w,b[r+12],20,-1926607734);
    w=n(w,x,y,z,b[r+5],4,-378558);z=n(z,w,x,y,b[r+8],11,-2022574463);
    y=n(y,z,w,x,b[r+11],16,1839030562);x=n(x,y,z,w,b[r+14],23,-35309556);
    w=n(w,x,y,z,b[r+1],4,-1530992060);z=n(z,w,x,y,b[r+4],11,1272893353);
    y=n(y,z,w,x,b[r+7],16,-155497632);x=n(x,y,z,w,b[r+10],23,-1094730640);
    w=n(w,x,y,z,b[r+13],4,681279174);z=n(z,w,x,y,b[r],11,-358537222);
    y=n(y,z,w,x,b[r+3],16,-722521979);x=n(x,y,z,w,b[r+6],23,76029189);
    w=n(w,x,y,z,b[r+9],4,-640364487);z=n(z,w,x,y,b[r+12],11,-421815835);
    y=n(y,z,w,x,b[r+15],16,530742520);x=n(x,y,z,w,b[r+2],23,-995338651);
    w=p(w,x,y,z,b[r],6,-198630844);z=p(z,w,x,y,b[r+7],10,1126891415);
    y=p(y,z,w,x,b[r+14],15,-1416354905);x=p(x,y,z,w,b[r+5],21,-57434055);
    w=p(w,x,y,z,b[r+12],6,1700485571);z=p(z,w,x,y,b[r+3],10,-1894986606);
    y=p(y,z,w,x,b[r+10],15,-1051523);x=p(x,y,z,w,b[r+1],21,-2054922799);
    w=p(w,x,y,z,b[r+8],6,1873313359);z=p(z,w,x,y,b[r+15],10,-30611744);
    y=p(y,z,w,x,b[r+6],15,-1560198380);x=p(x,y,z,w,b[r+13],21,1309151649);
    w=p(w,x,y,z,b[r+4],6,-145523070);z=p(z,w,x,y,b[r+11],10,-1120210379);
    y=p(y,z,w,x,b[r+2],15,718787259);x=p(x,y,z,w,b[r+9],21,-343485551);
    w=h(w,s);x=h(x,t);y=h(y,u);z=h(z,v)
  }
  function hex(v){var o='',i;for(i=0;i<4;i++)o+=('0'+(v>>>(i*8+4)&15).toString(16)).slice(-1)+('0'+(v>>>(i*8)&15).toString(16)).slice(-1);return o}
  return hex(w)+hex(x)+hex(y)+hex(z)
}

// Markdown → HTML (评论专用，排除 TOC/数学/图表)
function renderMd(src) {
  let h = src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // 围栏代码块
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    return '<pre><code' + (lang ? ' class="lang-' + lang + '"' : '') + '>' + code.replace(/\n$/, '') + '</code></pre>';
  });

  // 块级元素
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  h = h.replace(/^---+$/gm, '<hr>');

  // 列表
  h = h.replace(/^(\s*)[-*] (.+)$/gm, function(_, indent, text) {
    return '<li>' + text + '</li>';
  });
  h = h.replace(/^(\s*)\d+\. (.+)$/gm, function(_, indent, text) {
    return '<li>' + text + '</li>';
  });
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 行内元素
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/~~(.+?)~~/g, '<del>$1</del>');
  h = h.replace(/`([^`]+?)`/g, '<code>$1</code>');
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  h = h.replace(/\[([^\]]+?)\]\((https?:\/\/[^)]+?)\)/g,
    '<a href="$2" rel="noopener noreferrer nofollow" target="_blank">$1</a>');

  // 段落
  h = h.replace(/\n{2,}/g, '</p><p>');
  h = h.replace(/\n/g, '<br>');
  h = '<p>' + h + '</p>';

  // 清理空段落
  h = h.replace(/<p>\s*<\/p>/g, '');
  h = h.replace(/<p>\s*(<(?:h[23]|ul|ol|li|pre|blockquote|hr|img))/g, '$1');
  h = h.replace(/(<\/(?:h[23]|ul|ol|li|pre|blockquote|hr|img)>)\s*<\/p>/g, '$1');
  h = h.replace(/(<\/(?:h[23]|ul|ol|pre|blockquote|hr|img)>)\s*<(h[23]|ul|ol|pre|blockquote|hr|img)/g, '$1$2');

  return h;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
      'Access-Control-Max-Age': '86400',
    };
    if (method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    try {
      if (path === '/api/health') return json({ ok: true });
      function isAdmin(req) {
        const auth = req.headers.get('Authorization') || '';
        return auth.startsWith('Bearer ') && auth.slice(7) === env.ADMIN_TOKEN;
      }

      // ── 获取评论（最新在前） ──
      if (method === 'GET' && path === '/api/comments') {
        const page = url.searchParams.get('page');
        const cursor = parseInt(url.searchParams.get('cursor')) || 0;
        const limit = Math.min(100, parseInt(url.searchParams.get('limit')) || 50);
        if (!page) return json({ error: '缺少 page 参数' }, 400);

        const stmt = cursor > 0
          ? env.DB.prepare(
              "SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,is_admin,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' AND id<? ORDER BY id DESC LIMIT ?"
            ).bind(page, cursor, limit)
          : env.DB.prepare(
              "SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,is_admin,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' ORDER BY id DESC LIMIT ?"
            ).bind(page, limit);

        const { results } = await stmt.all();
        const countRow = await env.DB.prepare(
          "SELECT COUNT(*) as total FROM comments WHERE page_slug=? AND status='approved'"
        ).bind(page).first();

        return json({
          comments: results,
          total: countRow.total,
          cursor: results.length ? results[results.length - 1].id : null,
          hasMore: results.length >= limit,
        });
      }

      // ── 发表评论 ──
      if (method === 'POST' && path === '/api/comments') {
        const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
        const cutoff = new Date(Date.now() - 60000).toISOString();
        await env.DB.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(cutoff).run();
        const rl = await env.DB.prepare(
          "SELECT COUNT(*) as c FROM rate_limits WHERE ip=? AND action='comment' AND created_at>=?"
        ).bind(ip, cutoff).first();
        if (rl.c >= 5) return json({ error: '操作太频繁，请稍后再试' }, 429);
        await env.DB.prepare("INSERT INTO rate_limits (ip,action) VALUES (?,?)").bind(ip, 'comment').run();

        let body;
        try { body = await request.json(); } catch { return json({ error: '无效的请求' }, 400); }

        const nickname = (body.nickname || '').trim();
        const content = (body.content || '').trim();
        const page = (body.page || '').trim();
        const email = (body.email || '').trim() || null;
        const website = (body.website || '').trim() || null;
        const parentId = Math.max(0, parseInt(body.parent_id) || 0);
        const depth = Math.min(2, parseInt(body.depth) || 0);

        if (!page) return json({ error: '缺少页面标识' }, 400);
        if (!nickname) return json({ error: '昵称不能为空' }, 400);
        if (!content) return json({ error: '评论内容不能为空' }, 400);
        if (nickname.length > 30) return json({ error: '昵称最长 30 字' }, 400);
        if (content.length > 2000) return json({ error: '评论最长 2000 字' }, 400);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);

        if (parentId > 0) {
          const parent = await env.DB.prepare(
            "SELECT id,depth FROM comments WHERE id=? AND page_slug=? AND status='approved'"
          ).bind(parentId, page).first();
          if (!parent) return json({ error: '回复的评论不存在' }, 400);
          if (parent.depth >= 2) return json({ error: '已达最大回复深度' }, 400);
        }

        let avatarHash = null;
        if (email) { avatarHash = md5(email.trim().toLowerCase()); }

        const contentHtml = renderMd(content);
        const admin = isAdmin(request);

        const result = await env.DB.prepare(
          "INSERT INTO comments (page_slug,parent_id,depth,nickname,email,website,avatar_hash,content,content_html,ip,user_agent,status,is_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(page, parentId, depth, nickname, email, website || null,
          avatarHash, content, contentHtml, ip, request.headers.get('user-agent') || '', 'approved', admin ? 1 : 0).run();

        return json({ ok: true, id: result.meta.last_row_id, status: 'approved', is_admin: admin ? 1 : 0, message: '评论已发布' }, 201);
      }

      // ── 点赞 ──
      if (method === 'POST' && /^\/api\/comments\/(\d+)\/like$/.test(path)) {
        const id = parseInt(path.match(/\/(\d+)\/like/)[1]);
        const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
        const existing = await env.DB.prepare('SELECT 1 FROM likes WHERE comment_id=? AND ip=?').bind(id, ip).first();
        if (existing) return json({ error: '已经点过赞了' }, 409);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO likes (comment_id,ip) VALUES (?,?)').bind(id, ip),
          env.DB.prepare('UPDATE comments SET liked=liked+1 WHERE id=?').bind(id),
        ]);
        const row = await env.DB.prepare('SELECT liked FROM comments WHERE id=?').bind(id).first();
        return json({ ok: true, liked: row.liked });
      }

      return json({ error: '未找到' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: '服务器内部错误' }, 500);
    }
  },
};
