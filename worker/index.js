// ============================================================
// Haprial 评论系统 — Cloudflare Worker (单文件)
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });

    try {
      // ── 健康检查 ──
      if (path === '/api/health') return json({ ok: true });

      // ── 获取评论 ──
      if (method === 'GET' && path === '/api/comments') {
        const page = url.searchParams.get('page');
        const cursor = parseInt(url.searchParams.get('cursor')) || 0;
        const limit = Math.min(100, parseInt(url.searchParams.get('limit')) || 50);
        if (!page) return json({ error: '缺少 page 参数' }, 400);

        const stmt = cursor > 0
          ? env.DB.prepare(
              "SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' AND id>? ORDER BY id ASC LIMIT ?"
            ).bind(page, cursor, limit)
          : env.DB.prepare(
              "SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' ORDER BY id ASC LIMIT ?"
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

        // 频率限制
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

        // 验证父评论
        if (parentId > 0) {
          const parent = await env.DB.prepare(
            "SELECT id,depth FROM comments WHERE id=? AND page_slug=? AND status='approved'"
          ).bind(parentId, page).first();
          if (!parent) return json({ error: '回复的评论不存在' }, 400);
          if (parent.depth >= 2) return json({ error: '已达最大回复深度' }, 400);
        }

        // Gravatar hash (SHA-256)
        let avatarHash = null;
        if (email) {
          const data = new TextEncoder().encode(email.trim().toLowerCase());
          const buf = await crypto.subtle.digest('SHA-256', data);
          avatarHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // 简易 Markdown 渲染
        const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        let contentHtml = escHtml(content);
        contentHtml = contentHtml.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        contentHtml = contentHtml.replace(/\*(.+?)\*/g, '<em>$1</em>');
        contentHtml = contentHtml.replace(/`([^`]+)`/g, '<code>$1</code>');
        contentHtml = contentHtml.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          '<a href="$2" rel="noopener noreferrer nofollow" target="_blank">$1</a>');
        contentHtml = contentHtml.replace(/\n/g, '<br>');

        const result = await env.DB.prepare(
          "INSERT INTO comments (page_slug,parent_id,depth,nickname,email,website,avatar_hash,content,content_html,ip,user_agent,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        ).bind(page, parentId, depth, escHtml(nickname), email, website ? escHtml(website) : null,
          avatarHash, content, contentHtml, ip, request.headers.get('user-agent') || '', 'approved').run();

        return json({ ok: true, id: result.meta.last_row_id, status: 'approved', message: '评论已发布' }, 201);
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

      // ── 404 ──
      return json({ error: '未找到' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: '服务器内部错误' }, 500);
    }
  },
};
