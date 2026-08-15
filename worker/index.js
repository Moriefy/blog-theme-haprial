// ============================================================
// Haprial 评论+管理后台 API — Cloudflare Worker
// ============================================================

// ── MD5 (Cravatar) ──
function md5(str){function h(a,b){var c=(a&65535)+(b&65535);return((a>>16)+(b>>16)+(c>>16))<<16|c&65535}function k(a,b,c,d,e,f){b=h(h(b,a),h(d,f));return h(b<<e|b>>>32-e,c)}function l(a,b,c,d,e,f,g){return k(b&c|~b&d,a,b,e,f,g)}function m(a,b,c,d,e,f,g){return k(b&d|c&~d,a,b,e,f,g)}function n(a,b,c,d,e,f,g){return k(b^c^d,a,b,e,f,g)}function p(a,b,c,d,e,f,g){return k(c^(b|~d),a,b,e,f,g)}var r,s,t,u,v,w=1732584193,x=-271733879,y=-1732584194,z=271733878;str=unescape(encodeURIComponent(str));var a=str.length;var b=[];for(r=0;r<a;r++)b[r>>2]|=(str.charCodeAt(r)&255)<<(r%4)*8;b[a>>2]|=128<<((a%4)*8);b[14+(a+8>>>6<<4)]=a*8;for(r=0;r<b.length;r+=16){s=w;t=x;u=y;v=z;w=l(w,x,y,z,b[r],7,-680876936);z=l(z,w,x,y,b[r+1],12,-389564586);y=l(y,z,w,x,b[r+2],17,606105819);x=l(x,y,z,w,b[r+3],22,-1044525330);w=l(w,x,y,z,b[r+4],7,-176418897);z=l(z,w,x,y,b[r+5],12,1200080426);y=l(y,z,w,x,b[r+6],17,-1473231341);x=l(x,y,z,w,b[r+7],22,-45705983);w=l(w,x,y,z,b[r+8],7,1770035416);z=l(z,w,x,y,b[r+9],12,-1958414417);y=l(y,z,w,x,b[r+10],17,-42063);x=l(x,y,z,w,b[r+11],22,-1990404162);w=l(w,x,y,z,b[r+12],7,1804603682);z=l(z,w,x,y,b[r+13],12,-40341101);y=l(y,z,w,x,b[r+14],17,-1502002290);x=l(x,y,z,w,b[r+15],22,1236535329);w=m(w,x,y,z,b[r+1],5,-165796510);z=m(z,w,x,y,b[r+6],9,-1069501632);y=m(y,z,w,x,b[r+11],14,643717713);x=m(x,y,z,w,b[r],20,-373897302);w=m(w,x,y,z,b[r+5],5,-701558691);z=m(z,w,x,y,b[r+10],9,38016083);y=m(y,z,w,x,b[r+15],14,-660478335);x=m(x,y,z,w,b[r+4],20,-405537848);w=m(w,x,y,z,b[r+9],5,568446438);z=m(z,w,x,y,b[r+14],9,-1019803690);y=m(y,z,w,x,b[r+3],14,-187363961);x=m(x,y,z,w,b[r+8],20,1163531501);w=m(w,x,y,z,b[r+13],5,-1444681467);z=m(z,w,x,y,b[r+2],9,-51403784);y=m(y,z,w,x,b[r+7],14,1735328473);x=m(x,y,z,w,b[r+12],20,-1926607734);w=n(w,x,y,z,b[r+5],4,-378558);z=n(z,w,x,y,b[r+8],11,-2022574463);y=n(y,z,w,x,b[r+11],16,1839030562);x=n(x,y,z,w,b[r+14],23,-35309556);w=n(w,x,y,z,b[r+1],4,-1530992060);z=n(z,w,x,y,b[r+4],11,1272893353);y=n(y,z,w,x,b[r+7],16,-155497632);x=n(x,y,z,w,b[r+10],23,-1094730640);w=n(w,x,y,z,b[r+13],4,681279174);z=n(z,w,x,y,b[r],11,-358537222);y=n(y,z,w,x,b[r+3],16,-722521979);x=n(x,y,z,w,b[r+6],23,76029189);w=n(w,x,y,z,b[r+9],4,-640364487);z=n(z,w,x,y,b[r+12],11,-421815835);y=n(y,z,w,x,b[r+15],16,530742520);x=n(x,y,z,w,b[r+2],23,-995338651);w=p(w,x,y,z,b[r],6,-198630844);z=p(z,w,x,y,b[r+7],10,1126891415);y=p(y,z,w,x,b[r+14],15,-1416354905);x=p(x,y,z,w,b[r+5],21,-57434055);w=p(w,x,y,z,b[r+12],6,1700485571);z=p(z,w,x,y,b[r+3],10,-1894986606);y=p(y,z,w,x,b[r+10],15,-1051523);x=p(x,y,z,w,b[r+1],21,-2054922799);w=p(w,x,y,z,b[r+8],6,1873313359);z=p(z,w,x,y,b[r+15],10,-30611744);y=p(y,z,w,x,b[r+6],15,-1560198380);x=p(x,y,z,w,b[r+13],21,1309151649);w=p(w,x,y,z,b[r+4],6,-145523070);z=p(z,w,x,y,b[r+11],10,-1120210379);y=p(y,z,w,x,b[r+2],15,718787259);x=p(x,y,z,w,b[r+9],21,-343485551);w=h(w,s);x=h(x,t);y=h(y,u);z=h(z,v)}function hex(v){var o='',i;for(i=0;i<4;i++)o+=('0'+(v>>>(i*8+4)&15).toString(16)).slice(-1)+('0'+(v>>>(i*8)&15).toString(16)).slice(-1);return o}return hex(w)+hex(x)+hex(y)+hex(z)}

// ── Markdown (评论用) ──
function renderMd(src){let h=src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');h=h.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,c)=>'<pre><code'+(l?' class="lang-'+l+'"':'')+'>'+c.replace(/\n$/,'')+'</code></pre>');h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');h=h.replace(/^> (.+)$/gm,'<blockquote><p>$1</p></blockquote>');h=h.replace(/^---+$/gm,'<hr>');h=h.replace(/^(\s*)[-*] (.+)$/gm,(_,i,t)=>'<li>'+t+'</li>');h=h.replace(/^(\s*)\d+\. (.+)$/gm,(_,i,t)=>'<li>'+t+'</li>');h=h.replace(/((?:<li>.*<\/li>\n?)+)/g,'<ul>$1</ul>');h=h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');h=h.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g,'<em>$1</em>');h=h.replace(/~~(.+?)~~/g,'<del>$1</del>');h=h.replace(/`([^`]+?)`/g,'<code>$1</code>');h=h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" loading="lazy">');h=h.replace(/\[([^\]]+?)\]\((https?:\/\/[^)]+?)\)/g,'<a href="$2" rel="noopener noreferrer nofollow" target="_blank">$1</a>');h=h.replace(/\n{2,}/g,'</p><p>');h=h.replace(/\n/g,'<br>');h='<p>'+h+'</p>';h=h.replace(/<p>\s*<\/p>/g,'');return h}

// ── Admin Auth ──
async function sha256Hex(str){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function hmacSign(secret,msg){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg));return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function verifyAdmin(req,env){const url=new URL(req.url);const qs=url.searchParams.get('token')||'';const auth=req.headers.get('Authorization')||'';let token='';if(auth.startsWith('Bearer '))token=auth.slice(7);if(qs)token=qs;if(!token)return false;const [payload,sig]=token.split('.');if(!payload||!sig)return false;const exp=parseInt(payload);if(!exp||Date.now()>exp)return false;const expected=await hmacSign(env.ADMIN_TOKEN,payload);return sig===expected}
async function makeAdminToken(env){const exp=Date.now()+7*24*60*60*1000;const payload=String(exp);const sig=await hmacSign(env.ADMIN_TOKEN,payload);return payload+'.'+sig}
async function isAdminComment(req,env){const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return false;const token=auth.slice(7);if(token===env.ADMIN_TOKEN)return true;const [payload,sig]=token.split('.');if(!payload||!sig)return false;const exp=parseInt(payload);if(!exp||Date.now()>exp)return false;try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ADMIN_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sigBuf=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));const expected=Array.from(new Uint8Array(sigBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');return expected===sig}catch(e){return false}}

// ── Webhook 签名验证 ──
async function verifyWebhookSignature(request, secret) {
  const sig = request.headers.get('X-Hub-Signature-256') || '';
  if (!sig || !secret) return false;
  const body = await request.clone().text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = 'sha256=' + Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === expected;
}

// ── GitHub Fetch Helper ──
async function githubFetch(env, filePath) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
  if (!token) return null;
  const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
  });
  if (!resp.ok) return null;
  const d = await resp.json();
  const content = decodeURIComponent(escape(atob(d.content)));
  return { content, sha: d.sha };
}

// ── Auto-migration ──
let migrated=false;
async function ensureTables(db){
  if(migrated)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT UNIQUE,title TEXT,date TEXT,tags TEXT,category TEXT,excerpt TEXT,content TEXT,status TEXT DEFAULT 'published',pinned INTEGER DEFAULT 0,created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS friends(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,url TEXT,avatar TEXT,desc TEXT,sort INTEGER DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS trash(id INTEGER PRIMARY KEY AUTOINCREMENT,original_id INTEGER,type TEXT,title TEXT,slug TEXT,data TEXT,deleted_at TEXT DEFAULT (datetime('now')))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_config(key TEXT PRIMARY KEY,value TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)`),
  ]);
  // 迁移：给 comments 表加 pinned 字段
  try { await db.prepare("SELECT pinned FROM comments LIMIT 1").first(); } catch(e) {
    await db.prepare("ALTER TABLE comments ADD COLUMN pinned INTEGER DEFAULT 0").run();
  }
  migrated=true;
}

// ── GitHub Push Helper ──
async function githubPush(env, filePath, content, message) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not set in Worker env' };

  // Get current file SHA (if exists)
  let sha = null;
  try {
    const getReq = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
    });
    if (getReq.ok) { const d = await getReq.json(); sha = d.sha; }
  } catch (e) {}

  const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch: 'main' };
  if (sha) body.sha = sha;

  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Haprial-Worker' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      let errDetail = '';
      try { const d = await resp.json(); errDetail = d.message || JSON.stringify(d); } catch(e) { errDetail = resp.statusText; }
      return { ok: false, status: resp.status, error: errDetail };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'network error' };
  }
}

// ── GitHub Push Binary (base64 direct, no re-encode) ──
async function githubPushBinary(env, filePath, base64Content, message) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not set' };
  let sha = null;
  try {
    const getReq = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
    });
    if (getReq.ok) { const d = await getReq.json(); sha = d.sha; }
  } catch (e) {}
  const body = { message, content: base64Content, branch: 'main' };
  if (sha) body.sha = sha;
  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Haprial-Worker' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      let errDetail = '';
      try { const d = await resp.json(); errDetail = d.message || JSON.stringify(d); } catch(e) { errDetail = resp.statusText; }
      return { ok: false, status: resp.status, error: errDetail };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function githubDelete(env, filePath, message) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
  if (!token) return { ok: false, error: 'GITHUB_TOKEN not set' };

  let sha = null;
  try {
    const getReq = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
    });
    if (getReq.ok) { const d = await getReq.json(); sha = d.sha; }
  } catch (e) {}
  if (!sha) return { ok: false, error: 'file not found on GitHub' };

  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'DELETE',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Haprial-Worker' },
      body: JSON.stringify({ message, sha, branch: 'main' })
    });
    if (!resp.ok) {
      let errDetail = '';
      try { const d = await resp.json(); errDetail = d.message || JSON.stringify(d); } catch(e) { errDetail = resp.statusText; }
      return { ok: false, status: resp.status, error: errDetail };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function buildMd(article) {
  let md = '---\n';
  md += `title: "${article.title}"\n`;
  md += `date: "${article.date}"\n`;
  let tags = article.tags;
  if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch (e) { tags = []; }
  md += `tags: ${JSON.stringify(tags)}\n`;
  md += `category: "${article.category}"\n`;
  md += `excerpt: "${article.excerpt}"\n`;
  md += '---\n\n';
  md += article.content;
  return md;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const cors = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    try {
      await ensureTables(env.DB);

      // ════════════════════════════════════════
      //  PUBLIC API (评论系统)
      // ════════════════════════════════════════
      if (path === '/api/health') return json({ ok: true, hasGithubToken: !!env.GITHUB_TOKEN, repo: env.GITHUB_REPO || 'Moriefy/Blog_Astro' });

      // GET /api/admin/github-test — 测试 GitHub token 是否有效
      if (method === 'GET' && path === '/api/admin/github-test') {
        const token = env.GITHUB_TOKEN;
        if (!token) return json({ ok: false, error: 'GITHUB_TOKEN 未设置' });
        const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
        try {
          const resp = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (!resp.ok) {
            let err = '';
            try { const d = await resp.json(); err = d.message; } catch(e) { err = resp.statusText; }
            return json({ ok: false, status: resp.status, error: err });
          }
          const d = await resp.json();
          return json({ ok: true, repo: d.full_name, private: d.private, pushAccess: true });
        } catch (e) {
          return json({ ok: false, error: e.message });
        }
      }

      // GET /api/comments
      if (method === 'GET' && path === '/api/comments') {
        const page = url.searchParams.get('page');
        const cursor = parseInt(url.searchParams.get('cursor')) || 0;
        const limit = Math.min(100, parseInt(url.searchParams.get('limit')) || 50);
        if (!page) return json({ error: '缺少 page 参数' }, 400);
        const stmt = cursor > 0
          ? env.DB.prepare("SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,is_admin,pinned,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' AND id<? ORDER BY pinned DESC, id DESC LIMIT ?").bind(page, cursor, limit)
          : env.DB.prepare("SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,is_admin,pinned,created_at,updated_at FROM comments WHERE page_slug=? AND status='approved' ORDER BY pinned DESC, id DESC LIMIT ?").bind(page, limit);
        const { results } = await stmt.all();
        const countRow = await env.DB.prepare("SELECT COUNT(*) as total FROM comments WHERE page_slug=? AND status='approved'").bind(page).first();
        return json({ comments: results, total: countRow.total, cursor: results.length ? results[results.length - 1].id : null, hasMore: results.length >= limit });
      }

      // POST /api/comments
      if (method === 'POST' && path === '/api/comments') {
        const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
        const cutoff = new Date(Date.now() - 60000).toISOString();
        await env.DB.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(cutoff).run();
        const rl = await env.DB.prepare("SELECT COUNT(*) as c FROM rate_limits WHERE ip=? AND action='comment' AND created_at>=?").bind(ip, cutoff).first();
        if (rl.c >= 5) return json({ error: '操作太频繁' }, 429);
        await env.DB.prepare("INSERT INTO rate_limits (ip,action) VALUES (?,?)").bind(ip, 'comment').run();
        let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
        const nickname = (body.nickname || '').trim();
        const content = (body.content || '').trim();
        const page = (body.page || '').trim();
        const email = (body.email || '').trim() || null;
        const website = (body.website || '').trim() || null;
        const parentId = Math.max(0, parseInt(body.parent_id) || 0);
        const depth = Math.min(2, parseInt(body.depth) || 0);
        if (!page || !nickname || !content) return json({ error: '缺少必填字段' }, 400);
        if (nickname.length > 30 || content.length > 2000) return json({ error: '内容过长' }, 400);
        let avatarHash = email ? md5(email.trim().toLowerCase()) : null;
        const contentHtml = renderMd(content);
        const admin = nickname === 'Moriefy' && email === '3518972914@qq.com';
        const result = await env.DB.prepare("INSERT INTO comments (page_slug,parent_id,depth,nickname,email,website,avatar_hash,content,content_html,ip,user_agent,status,is_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(page, parentId, depth, nickname, email, website, avatarHash, content, contentHtml, ip, request.headers.get('user-agent') || '', 'approved', admin ? 1 : 0).run();
        return json({ ok: true, id: result.meta.last_row_id, status: 'approved', is_admin: admin ? 1 : 0, message: '评论已发布' }, 201);
      }

      // POST /api/comments/:id/like
      if (method === 'POST' && /^\/api\/comments\/(\d+)\/like$/.test(path)) {
        const id = parseInt(path.match(/\/(\d+)\/like/)[1]);
        const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
        const existing = await env.DB.prepare('SELECT 1 FROM likes WHERE comment_id=? AND ip=?').bind(id, ip).first();
        if (existing) return json({ error: '已点赞' }, 409);
        await env.DB.batch([env.DB.prepare('INSERT INTO likes (comment_id,ip) VALUES (?,?)').bind(id, ip), env.DB.prepare('UPDATE comments SET liked=liked+1 WHERE id=?').bind(id)]);
        const row = await env.DB.prepare('SELECT liked FROM comments WHERE id=?').bind(id).first();
        return json({ ok: true, liked: row.liked });
      }

      // ════════════════════════════════════════
      //  ADMIN API (管理后台)
      // ════════════════════════════════════════

      // POST /api/admin/auth — 登录
      if (method === 'POST' && path === '/api/admin/auth') {
        let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
        const password = body.password || '';
        if (!password) return json({ error: '请输入密码' }, 400);
        const hash = await sha256Hex(password);
        const stored = await env.DB.prepare("SELECT value FROM admin_config WHERE key='password_hash'").first();
        if (!stored) {
          // 首次登录，设置密码
          await env.DB.prepare("INSERT OR REPLACE INTO admin_config (key,value) VALUES ('password_hash',?)").bind(hash).run();
          const token = await makeAdminToken(env);
          return json({ ok: true, token, message: '密码已设置' });
        }
        if (stored.value !== hash) return json({ error: '密码错误' }, 401);
        const token = await makeAdminToken(env);
        return json({ ok: true, token });
      }

      // GET /api/admin/verify — 验证 token
      if (method === 'GET' && path === '/api/admin/verify') {
        const ok = await verifyAdmin(request, env);
        return json({ ok });
      }

      // GET /api/admin/setup/status — 无需认证
      if (method === 'GET' && path === '/api/admin/setup/status') {
        const pw = await env.DB.prepare("SELECT value FROM admin_config WHERE key='password_hash'").first();
        return json({ passwordSet: !!pw });
      }

      // ════════════════════════════════════════
      //  GITHUB WEBHOOK
      // ════════════════════════════════════════
      if (method === 'POST' && path === '/api/webhook/github') {
        const secret = env.WEBHOOK_SECRET;
        if (secret) {
          const valid = await verifyWebhookSignature(request, secret);
          if (!valid) return json({ error: 'Invalid signature' }, 401);
        }
        let payload;
        try { payload = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!payload.commits || !Array.isArray(payload.commits)) return json({ ok: true, msg: 'no commits' });
        const blogPrefix = 'content/blog/';
        const added = [], modified = [];
        for (const commit of payload.commits) {
          (commit.added || []).forEach(f => { if (f.startsWith(blogPrefix) && f.endsWith('.md')) added.push(f); });
          (commit.modified || []).forEach(f => { if (f.startsWith(blogPrefix) && f.endsWith('.md')) modified.push(f); });
          // 注意：不处理 removed — 下架文章由 admin 接口处理，webhook 不删 D1
        }
        const toSync = [...new Set([...added, ...modified])];
        let synced = 0;
        for (const filePath of toSync) {
          const fileData = await githubFetch(env, filePath);
          if (!fileData) continue;
          const raw = fileData.content;
          const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
          const meta = {};
          if (fmMatch) {
            fmMatch[1].split(/\r?\n/).forEach(line => {
              const fm = line.match(/^(\w+):\s*"([^"]*)"$/);
              const fn = line.match(/^(\w+):\s*(.+)$/);
              if (fm) { meta[fm[1]] = fm[2]; } else if (fn) {
                let val = fn[2].trim();
                if (val.startsWith('[')) try { val = JSON.parse(val); } catch {}
                meta[fn[1]] = val;
              }
            });
          }
          const body = fmMatch ? raw.slice(fmMatch[0].length).trim() : raw.trim();
          const slug = filePath.replace(blogPrefix, '').replace(/\.md$/, '');
          const tags = Array.isArray(meta.tags) ? JSON.stringify(meta.tags) : (meta.tags || '[]');
          await env.DB.prepare(`INSERT INTO articles (slug,title,date,tags,category,excerpt,content,status) VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(slug) DO UPDATE SET title=excluded.title,date=excluded.date,tags=excluded.tags,category=excluded.category,excerpt=excluded.excerpt,content=excluded.content,updated_at=datetime('now')`)
            .bind(slug, meta.title || slug, meta.date || '', tags, meta.category || '', meta.excerpt || '', body, 'published').run();
          synced++;
        }
        return json({ ok: true, synced });
      }

      // 以下所有 /api/admin/* 路由需要认证
      if (path.startsWith('/api/admin/')) {
        const authed = await verifyAdmin(request, env);
        if (!authed) return json({ error: '未授权' }, 401);

        // ── 文章管理 ──
        // GET /api/admin/articles
        if (method === 'GET' && path === '/api/admin/articles') {
          const status = url.searchParams.get('status');
          let sql = "SELECT id,slug,title,date,tags,category,excerpt,status,pinned,created_at,updated_at FROM articles";
          const params = [];
          if (status && status !== 'all') { sql += " WHERE status=?"; params.push(status); }
          sql += " ORDER BY pinned DESC, updated_at DESC";
          const { results } = await env.DB.prepare(sql).bind(...params).all();
          return json({ articles: results });
        }

        // GET /api/admin/articles/:id
        if (method === 'GET' && /^\/api\/admin\/articles\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          const art = await env.DB.prepare("SELECT * FROM articles WHERE id=?").bind(id).first();
          if (!art) return json({ error: '文章不存在' }, 404);
          return json({ article: art });
        }

        // POST /api/admin/articles — 创建
        if (method === 'POST' && path === '/api/admin/articles') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const { title, date, slug: userSlug, tags, category, excerpt, content, status, pinned } = body;
          if (!title || !content) return json({ error: '标题和内容必填' }, 400);
          const datePrefix = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
          const slugSuffix = userSlug ? userSlug.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
            : title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
          const slug = datePrefix + '-' + slugSuffix;
          const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (tags || '[]');
          const result = await env.DB.prepare("INSERT INTO articles (slug,title,date,tags,category,excerpt,content,status,pinned) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,date=excluded.date,tags=excluded.tags,category=excluded.category,excerpt=excluded.excerpt,content=excluded.content,status=excluded.status,updated_at=datetime('now')").bind(slug, title, date || new Date().toISOString().slice(0, 10), tagsStr, category || '', excerpt || '', content, status || 'draft', pinned ? 1 : 0).run();
          // Push to GitHub
          const md = buildMd({ title, date: date || new Date().toISOString().slice(0, 10), tags: tags, category: category || '', excerpt: excerpt || '', content });
          const gh = await githubPush(env, `content/blog/${slug}.md`, md, `blog: ${title}`);
          return json({ ok: true, id: result.meta.last_row_id, slug, github: gh }, 201);
        }

        // PUT /api/admin/articles/:id — 更新
        if (method === 'PUT' && /^\/api\/admin\/articles\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const { title, date, tags, category, excerpt, content, status, pinned } = body;
          const tagsStr = tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : undefined;
          const fields = []; const params = [];
          if (title !== undefined) { fields.push('title=?'); params.push(title); }
          if (date !== undefined) { fields.push('date=?'); params.push(date); }
          if (tagsStr !== undefined) { fields.push('tags=?'); params.push(tagsStr); }
          if (category !== undefined) { fields.push('category=?'); params.push(category); }
          if (excerpt !== undefined) { fields.push('excerpt=?'); params.push(excerpt); }
          if (content !== undefined) { fields.push('content=?'); params.push(content); }
          if (status !== undefined) { fields.push('status=?'); params.push(status); }
          if (pinned !== undefined) { fields.push('pinned=?'); params.push(pinned ? 1 : 0); }
          if (!fields.length) return json({ error: '无更新内容' }, 400);
          fields.push("updated_at=datetime('now')");
          params.push(id);
          await env.DB.prepare("UPDATE articles SET " + fields.join(',') + " WHERE id=?").bind(...params).run();
          // Push to GitHub
          const updated = await env.DB.prepare("SELECT * FROM articles WHERE id=?").bind(id).first();
          let gh = { ok: false, error: 'not found' };
          if (updated) {
            const md = buildMd(updated);
            gh = await githubPush(env, `content/blog/${updated.slug}.md`, md, `blog update: ${updated.title}`);
          }
          return json({ ok: true, github: gh });
        }

        // DELETE /api/admin/articles/:id — 移到回收站
        if (method === 'DELETE' && /^\/api\/admin\/articles\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          const art = await env.DB.prepare("SELECT * FROM articles WHERE id=?").bind(id).first();
          if (!art) return json({ error: '文章不存在' }, 404);
          await env.DB.prepare("INSERT INTO trash (original_id,type,title,slug,data) VALUES (?,?,?,?,?)").bind(art.id, 'article', art.title, art.slug, JSON.stringify(art)).run();
          await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
          // Delete from GitHub
          const gh = await githubDelete(env, `content/blog/${art.slug}.md`, `blog delete: ${art.title}`);
          return json({ ok: true, github: gh });
        }

        // POST /api/admin/articles/:id/publish — 发布/下架
        if (method === 'POST' && /^\/api\/admin\/articles\/\d+\/publish$/.test(path)) {
          const id = parseInt(path.split('/')[4]);
          const art = await env.DB.prepare("SELECT * FROM articles WHERE id=?").bind(id).first();
          if (!art) return json({ error: '文章不存在' }, 404);
          const newStatus = art.status === 'published' ? 'draft' : 'published';
          await env.DB.prepare("UPDATE articles SET status=?, updated_at=datetime('now') WHERE id=?").bind(newStatus, id).run();
          let ghResult = { ok: true };
          // 下架：从 GitHub 删除文件
          if (newStatus === 'draft' && art.status === 'published') {
            ghResult = await githubDelete(env, `content/blog/${art.slug}.md`, `blog unpublish: ${art.title}`);
          }
          // 发布：推送到 GitHub
          if (newStatus === 'published') {
            const md = buildMd(art);
            ghResult = await githubPush(env, `content/blog/${art.slug}.md`, md, `blog publish: ${art.title}`);
          }
          return json({ ok: true, status: newStatus, github: ghResult });
        }

        // ── 评论管理 ──
        // GET /api/admin/comments
        if (method === 'GET' && path === '/api/admin/comments') {
          const page = url.searchParams.get('page_slug');
          const limit = Math.min(200, parseInt(url.searchParams.get('limit')) || 50);
          const offset = parseInt(url.searchParams.get('offset')) || 0;
          let sql = "SELECT id,parent_id,depth,nickname,avatar_hash,website,content_html,liked,is_admin,pinned,created_at,updated_at FROM comments WHERE status='approved'";
          const params = [];
          if (page) { sql += " AND page_slug=?"; params.push(page); }
          sql += " ORDER BY pinned DESC, id DESC LIMIT ? OFFSET ?";
          params.push(limit, offset);
          const { results } = await env.DB.prepare(sql).bind(...params).all();
          const countSql = "SELECT COUNT(*) as total FROM comments WHERE status='approved'" + (page ? " AND page_slug=?" : "");
          const countRow = await (page ? env.DB.prepare(countSql).bind(page) : env.DB.prepare(countSql)).first();
          // 获取所有评论的页面列表
          const pages = await env.DB.prepare("SELECT DISTINCT page_slug FROM comments WHERE status='approved' ORDER BY page_slug").all();
          return json({ comments: results, total: countRow.total, pages: pages.results.map(p => p.page_slug) });
        }

        // POST /api/admin/comments — 管理员发评论
        if (method === 'POST' && path === '/api/admin/comments') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const { page, parent_id, depth, nickname, email, website, content } = body;
          if (!page || !content) return json({ error: '缺少必填字段' }, 400);
          const avatarHash = email ? md5(email.trim().toLowerCase()) : null;
          const contentHtml = renderMd(content);
          const result = await env.DB.prepare("INSERT INTO comments (page_slug,parent_id,depth,nickname,email,website,avatar_hash,content,content_html,ip,user_agent,status,is_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(page, parent_id || 0, depth || 0, nickname || 'Moriefy', email || '3518972914@qq.com', website || 'https://pluslogic.eu.org', avatarHash, content, contentHtml, 'admin', 'Admin Dashboard', 'approved', 1).run();
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }

        // DELETE /api/admin/comments/:id
        if (method === 'DELETE' && /^\/api\/admin\/comments\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          await env.DB.prepare("UPDATE comments SET status='deleted', updated_at=datetime('now') WHERE id=?").bind(id).run();
          return json({ ok: true });
        }

        // POST /api/admin/comments/:id/like
        if (method === 'POST' && /^\/api\/admin\/comments\/\d+\/like$/.test(path)) {
          const id = parseInt(path.split('/')[4]);
          await env.DB.prepare("UPDATE comments SET liked=liked+1 WHERE id=?").bind(id).run();
          const row = await env.DB.prepare("SELECT liked FROM comments WHERE id=?").bind(id).first();
          return json({ ok: true, liked: row.liked });
        }

        // POST /api/admin/comments/:id/pin — 置顶/取消置顶
        if (method === 'POST' && /^\/api\/admin\/comments\/\d+\/pin$/.test(path)) {
          const id = parseInt(path.split('/')[4]);
          const comment = await env.DB.prepare("SELECT pinned FROM comments WHERE id=?").bind(id).first();
          if (!comment) return json({ error: '评论不存在' }, 404);
          const newPinned = comment.pinned ? 0 : 1;
          await env.DB.prepare("UPDATE comments SET pinned=? WHERE id=?").bind(newPinned, id).run();
          return json({ ok: true, pinned: newPinned });
        }

        // GET /api/admin/comments/export — 导出
        if (method === 'GET' && path === '/api/admin/comments/export') {
          const { results } = await env.DB.prepare("SELECT * FROM comments WHERE status='approved' ORDER BY id").all();
          return new Response(JSON.stringify(results, null, 2), { headers: { ...cors, 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=comments.json' } });
        }

        // POST /api/admin/comments/import — 导入
        if (method === 'POST' && path === '/api/admin/comments/import') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          if (!Array.isArray(body)) return json({ error: '需要数组格式' }, 400);
          let imported = 0;
          for (const c of body) {
            try {
              await env.DB.prepare("INSERT OR IGNORE INTO comments (page_slug,parent_id,depth,nickname,email,website,avatar_hash,content,content_html,ip,user_agent,status,is_admin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(c.page_slug||c.page, c.parent_id||0, c.depth||0, c.nickname, c.email, c.website, c.avatar_hash, c.content, c.content_html||renderMd(c.content||''), c.ip||'import', c.user_agent||'import', c.status||'approved', c.is_admin||0).run();
              imported++;
            } catch(e) {}
          }
          return json({ ok: true, imported });
        }

        // ── 友链管理 ──
        // GET /api/admin/friends
        if (method === 'GET' && path === '/api/admin/friends') {
          const { results } = await env.DB.prepare("SELECT * FROM friends ORDER BY sort ASC, id ASC").all();
          return json({ friends: results });
        }

        // POST /api/admin/friends
        if (method === 'POST' && path === '/api/admin/friends') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const { name, url: furl, avatar, desc, sort } = body;
          if (!name || !furl) return json({ error: '名称和链接必填' }, 400);
          const result = await env.DB.prepare("INSERT INTO friends (name,url,avatar,desc,sort) VALUES (?,?,?,?,?)").bind(name, furl, avatar || '', desc || '', sort || 0).run();
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }

        // PUT /api/admin/friends/:id
        if (method === 'PUT' && /^\/api\/admin\/friends\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const fields = []; const params = [];
          for (const k of ['name', 'url', 'avatar', 'desc', 'sort']) {
            if (body[k] !== undefined) { fields.push(k + '=?'); params.push(body[k]); }
          }
          if (!fields.length) return json({ error: '无更新' }, 400);
          params.push(id);
          await env.DB.prepare("UPDATE friends SET " + fields.join(',') + " WHERE id=?").bind(...params).run();
          return json({ ok: true });
        }

        // DELETE /api/admin/friends/:id
        if (method === 'DELETE' && /^\/api\/admin\/friends\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          await env.DB.prepare("DELETE FROM friends WHERE id=?").bind(id).run();
          return json({ ok: true });
        }

        // ── 回收站 ──
        // GET /api/admin/trash
        if (method === 'GET' && path === '/api/admin/trash') {
          const { results } = await env.DB.prepare("SELECT * FROM trash ORDER BY deleted_at DESC").all();
          return json({ trash: results });
        }

        // POST /api/admin/trash/:id/restore — 恢复
        if (method === 'POST' && /^\/api\/admin\/trash\/\d+\/restore$/.test(path)) {
          const id = parseInt(path.split('/')[4]);
          const item = await env.DB.prepare("SELECT * FROM trash WHERE id=?").bind(id).first();
          if (!item) return json({ error: '不存在' }, 404);
          if (item.type === 'article') {
            const art = JSON.parse(item.data);
            await env.DB.prepare("INSERT INTO articles (slug,title,date,tags,category,excerpt,content,status,pinned) VALUES (?,?,?,?,?,?,?,?,?)").bind(art.slug, art.title, art.date, art.tags, art.category, art.excerpt, art.content, art.status||'draft', art.pinned||0).run();
            // Push to GitHub
            const md = buildMd(art);
            const gh = await githubPush(env, `content/blog/${art.slug}.md`, md, `blog restore: ${art.title}`);
            if (!gh.ok) console.error('GitHub restore failed:', gh);
          }
          await env.DB.prepare("DELETE FROM trash WHERE id=?").bind(id).run();
          return json({ ok: true });
        }

        // DELETE /api/admin/trash/:id — 彻底删除
        if (method === 'DELETE' && /^\/api\/admin\/trash\/\d+$/.test(path)) {
          const id = parseInt(path.split('/').pop());
          await env.DB.prepare("DELETE FROM trash WHERE id=?").bind(id).run();
          return json({ ok: true });
        }

        // DELETE /api/admin/trash — 清空回收站
        if (method === 'DELETE' && path === '/api/admin/trash') {
          await env.DB.prepare("DELETE FROM trash").run();
          return json({ ok: true });
        }

        // ── 统计 ──
        if (method === 'GET' && path === '/api/admin/stats') {
          const arts = await env.DB.prepare("SELECT COUNT(*) as c FROM articles").first();
          const published = await env.DB.prepare("SELECT COUNT(*) as c FROM articles WHERE status='published'").first();
          const drafts = await env.DB.prepare("SELECT COUNT(*) as c FROM articles WHERE status='draft'").first();
          const comments = await env.DB.prepare("SELECT COUNT(*) as c FROM comments WHERE status='approved'").first();
          const friends = await env.DB.prepare("SELECT COUNT(*) as c FROM friends").first();
          const trash = await env.DB.prepare("SELECT COUNT(*) as c FROM trash").first();
          return json({ articles: arts.c, published: published.c, drafts: drafts.c, comments: comments.c, friends: friends.c, trash: trash.c });
        }

        // ── 修改密码 ──
        if (method === 'POST' && path === '/api/admin/password') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const oldPw = body.old_password || '';
          const newPw = body.new_password || '';
          if (!oldPw || !newPw) return json({ error: '请填写完整' }, 400);
          if (newPw.length < 6) return json({ error: '新密码至少6位' }, 400);
          const oldHash = await sha256Hex(oldPw);
          const stored = await env.DB.prepare("SELECT value FROM admin_config WHERE key='password_hash'").first();
          if (!stored || stored.value !== oldHash) return json({ error: '当前密码错误' }, 401);
          const newHash = await sha256Hex(newPw);
          await env.DB.prepare("UPDATE admin_config SET value=? WHERE key='password_hash'").bind(newHash).run();
          return json({ ok: true });
        }

        // ── 从 GitHub 导入数据 ──
        if (method === 'POST' && path === '/api/admin/import-from-github') {
          const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
          const token = env.GITHUB_TOKEN;
          if (!token) return json({ error: '未配置 GITHUB_TOKEN' }, 500);
          const listResp = await fetch(`https://api.github.com/repos/${repo}/contents/content/blog`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (!listResp.ok) return json({ error: '获取仓库文件失败' }, 500);
          const files = await listResp.json();
          const mdFiles = files.filter(f => f.name.endsWith('.md'));
          let imported = 0;
          for (const file of mdFiles) {
            const fileData = await githubFetch(env, `content/blog/${file.name}`);
            if (!fileData) continue;
            const raw = fileData.content;
            const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
            const meta = {};
            if (fmMatch) {
              fmMatch[1].split(/\r?\n/).forEach(line => {
                const fm = line.match(/^(\w+):\s*"([^"]*)"$/);
                const fn = line.match(/^(\w+):\s*(.+)$/);
                if (fm) { meta[fm[1]] = fm[2]; } else if (fn) {
                  let val = fn[2].trim();
                  if (val.startsWith('[')) try { val = JSON.parse(val); } catch {}
                  meta[fn[1]] = val;
                }
              });
            }
            const body = fmMatch ? raw.slice(fmMatch[0].length).trim() : raw.trim();
            const slug = file.name.replace(/\.md$/, '');
            const tags = Array.isArray(meta.tags) ? JSON.stringify(meta.tags) : (meta.tags || '[]');
            await env.DB.prepare(`INSERT INTO articles (slug,title,date,tags,category,excerpt,content,status) VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(slug) DO UPDATE SET title=excluded.title,date=excluded.date,tags=excluded.tags,category=excluded.category,excerpt=excluded.excerpt,content=excluded.content,updated_at=datetime('now')`)
              .bind(slug, meta.title || slug, meta.date || '', tags, meta.category || '', meta.excerpt || '', body, 'published').run();
            imported++;
          }
          return json({ ok: true, imported });
        }

        // ── 全站数据导出 ──
        if (method === 'GET' && path === '/api/admin/export') {
          const articles = await env.DB.prepare("SELECT * FROM articles ORDER BY id").all();
          const comments = await env.DB.prepare("SELECT * FROM comments ORDER BY id").all();
          const friends = await env.DB.prepare("SELECT * FROM friends ORDER BY id").all();
          const data = { articles: articles.results, comments: comments.results, friends: friends.results, exportedAt: new Date().toISOString() };
          return new Response(JSON.stringify(data, null, 2), { headers: { ...cors, 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=haprial-export.json' } });
        }

        // ── 图片管理 ──
        // POST /api/admin/images/upload — 上传图片
        if (method === 'POST' && path === '/api/admin/images/upload') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          let { data, name, folder } = body;
          if (!data || !name) return json({ error: '缺少图片数据或文件名' }, 400);
          // 去掉 base64 中的空白字符（换行、空格等）
          data = data.replace(/\s/g, '');
          const imgFolder = folder || new Date().toISOString().slice(0,7).replace('-','/');
          const ext = name.split('.').pop().toLowerCase();
          if (!['jpg','jpeg','png','gif','webp','svg','ico'].includes(ext)) return json({ error: '不支持的格式' }, 400);
          const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `static/images/${imgFolder}/${safeName}`;
          const result = await githubPushBinary(env, filePath, data, `image: ${safeName}`);
          if (!result.ok) return json({ error: '上传失败', detail: result }, 500);
          return json({ ok: true, url: `https://pluslogic.eu.org/images/${imgFolder}/${safeName}`, path: filePath });
        }

        // POST /api/admin/images/folder — 新建文件夹
        if (method === 'POST' && path === '/api/admin/images/folder') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const folderPath = (body.path || '').replace(/^\/+/, '').replace(/\/+$/, '');
          if (!folderPath || folderPath.includes('..')) return json({ error: '无效路径' }, 400);
          const result = await githubPush(env, `static/images/${folderPath}/.gitkeep`, '', `create folder: ${folderPath}`);
          if (!result.ok) return json({ error: result.error || '创建失败' }, 500);
          return json({ ok: true });
        }

        // GET /api/admin/images/list — 列出图片
        if (method === 'GET' && path === '/api/admin/images/list') {
          const folder = url.searchParams.get('folder') || '';
          const token = env.GITHUB_TOKEN;
          const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
          const ghPath = folder ? `static/images/${folder}` : 'static/images';
          const resp = await fetch(`https://api.github.com/repos/${repo}/contents/${ghPath}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (!resp.ok) return json({ images: [], folders: [] });
          const items = await resp.json();
          const images = items.filter(i => i.type === 'file' && i.name !== '.gitkeep').map(i => ({
            name: i.name, url: `/images/${folder ? folder + '/' : ''}${i.name}`, size: i.size, sha: i.sha
          }));
          const folders = items.filter(i => i.type === 'dir').map(i => i.name);
          return json({ images, folders });
        }

        // POST /api/admin/images/copy — 复制/移动文件
        if (method === 'POST' && path === '/api/admin/images/copy') {
          let body; try { body = await request.json(); } catch { return json({ error: '无效请求' }, 400); }
          const { srcPath, destFolder, mode } = body; // mode: 'copy' | 'cut'
          if (!srcPath) return json({ error: '缺少 srcPath' }, 400);
          const fileName = srcPath.split('/').pop();
          const srcFullPath = `static/images/${srcPath}`;
          const destFolderClean = (destFolder || '').replace(/^\/+|\/+$/g, '');
          const destFullPath = destFolderClean ? `static/images/${destFolderClean}/${fileName}` : `static/images/${fileName}`;

          // 1. 从 GitHub 读取源文件（保留原始 base64）
          const ghToken = env.GITHUB_TOKEN;
          const ghRepo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
          if (!ghToken) return json({ error: '未配置 GITHUB_TOKEN' }, 500);
          const getResp = await fetch(`https://api.github.com/repos/${ghRepo}/contents/${srcFullPath}`, {
            headers: { 'Authorization': `token ${ghToken}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (!getResp.ok) return json({ error: '源文件不存在' }, 404);
          const srcData = await getResp.json();

          // 2. 检查目标是否已存在
          let destSha = null;
          const checkResp = await fetch(`https://api.github.com/repos/${ghRepo}/contents/${destFullPath}`, {
            headers: { 'Authorization': `token ${ghToken}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (checkResp.ok) { const d = await checkResp.json(); destSha = d.sha; }

          // 3. 写入目标
          const putBody = { message: `${mode === 'cut' ? 'move' : 'copy'}: ${fileName}`, content: srcData.content, branch: 'main' };
          if (destSha) putBody.sha = destSha;
          const putResp = await fetch(`https://api.github.com/repos/${ghRepo}/contents/${destFullPath}`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json', 'User-Agent': 'Haprial-Worker' },
            body: JSON.stringify(putBody)
          });
          if (!putResp.ok) {
            let err = '';
            try { const d = await putResp.json(); err = d.message; } catch(e) { err = putResp.statusText; }
            return json({ error: '写入失败: ' + err }, 500);
          }

          // 4. 如果是 cut，删除源文件
          if (mode === 'cut') {
            await fetch(`https://api.github.com/repos/${ghRepo}/contents/${srcFullPath}`, {
              method: 'DELETE',
              headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json', 'User-Agent': 'Haprial-Worker' },
              body: JSON.stringify({ message: `move: ${fileName}`, sha: srcData.sha, branch: 'main' })
            });
          }

          const url = destFolderClean ? `/images/${destFolderClean}/${fileName}` : `/images/${fileName}`;
          return json({ ok: true, url, name: fileName });
        }

        // DELETE /api/admin/images/folder/:path — 删除文件夹（必须在通用 DELETE 之前）
        if (method === 'DELETE' && path.startsWith('/api/admin/images/folder/')) {
          const folderPath = decodeURIComponent(path.replace('/api/admin/images/folder/', ''));
          if (!folderPath || folderPath.includes('..')) return json({ error: '无效路径' }, 400);
          const token = env.GITHUB_TOKEN;
          const repo = env.GITHUB_REPO || 'Moriefy/Blog_Astro';
          const listResp = await fetch(`https://api.github.com/repos/${repo}/contents/static/images/${folderPath}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Haprial-Worker' }
          });
          if (!listResp.ok) return json({ error: '文件夹不存在' }, 404);
          const items = await listResp.json();
          let deleted = 0;
          for (const item of items) {
            if (item.type === 'file') {
              const r = await githubDelete(env, item.path, `delete: ${item.path}`);
              if (r.ok) deleted++;
            }
          }
          return json({ ok: true, deleted });
        }

        // DELETE /api/admin/images/:path — 删除图片
        if (method === 'DELETE' && path.startsWith('/api/admin/images/') && !path.includes('/references/')) {
          const imgPath = decodeURIComponent(path.replace('/api/admin/images/', ''));
          if (!imgPath || imgPath.includes('..')) return json({ error: '无效路径' }, 400);
          const fullPath = `static/images/${imgPath}`;
          const result = await githubDelete(env, fullPath, `image delete: ${imgPath}`);
          if (!result.ok) return json({ error: result.error || '删除失败' }, 500);
          return json({ ok: true });
        }

        // GET /api/admin/images/references/:url — 查找引用
        if (method === 'GET' && path.startsWith('/api/admin/images/references/')) {
          const imgUrl = decodeURIComponent(path.replace('/api/admin/images/references/', ''));
          if (!imgUrl) return json({ articles: [] });
          const likePattern = '%' + imgUrl.split('/').pop() + '%';
          const { results } = await env.DB.prepare('SELECT id,title,slug FROM articles WHERE content LIKE ?').bind(likePattern).all();
          return json({ articles: results });
        }
      }

      return json({ error: 'Not Found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'Internal Error' }, 500);
    }
  },
};