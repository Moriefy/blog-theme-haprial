// Haprial Comments — Cloudflare Worker + KV
// 清空重写，与旧数据完全无关
const OK = ['https://pluslogic.eu.org', 'http://localhost:3000', 'http://localhost:8788'];
function cors(o) { return { 'Access-Control-Allow-Origin': OK.includes(o) ? o : OK[0], 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }; }
function json(d, s, o) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...cors(o) } }); }
function ip(r) { return r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For') || ''; }
function s(v, n) { return String(v || '').trim().slice(0, n); }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function device(ua) {
  if (!ua) return ''; ua = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS'; if (/android/.test(ua)) return 'Android';
  if (/macintosh/.test(ua)) return 'macOS'; if (/windows/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux'; return '';
}

function fmt(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

async function rl(kv, ip) {
  const k = 'rl:' + ip + ':' + Math.floor(Date.now() / 60000);
  try { const n = parseInt(await kv.get(k, 'text')) || 0; if (n >= 5) return false; await kv.put(k, String(n + 1), { expirationTtl: 120 }); return true; } catch { return true; }
}

// GET /api/comments?url=...
async function onGet(req, env) {
  const u = new URL(req.url), url = s(u.searchParams.get('url'), 300);
  if (!url) return json({ error: 'missing url' }, 400, u.origin);
  const raw = await env.COMMENTS.get('c:' + url, 'json');
  return json({ ok: true, comments: Array.isArray(raw) ? raw : [] }, 200, u.origin);
}

// POST /api/comments
async function onPost(req, env) {
  const u = new URL(req.url), o = u.origin, ipAddr = ip(req);
  if (!await rl(env.COMMENTS, ipAddr)) return json({ error: '稍后再试' }, 429, o);
  let b; try { b = await req.json(); } catch { return json({ error: 'invalid' }, 400, o); }
  if (b.hp) return json({ ok: true }, 200, o); // honeypot

  const url = s(b.url, 300), nick = s(b.nick, 50), email = s(b.email, 100);
  const website = s(b.website, 200), content = s(b.content, 2000);
  const pid = s(b.parent_id, 30) || null;
  if (!url) return json({ error: 'missing url' }, 400, o);
  if (!nick) return json({ error: '需要昵称' }, 400, o);
  if (content.length < 2) return json({ error: '内容太短' }, 400, o);

  const c = {
    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
    nick, email: email || null, website: website || null,
    content: fmt(content), raw: content,
    time: new Date().toISOString(),
    pid, ua: device(req.headers.get('User-Agent')),
    likes: 0, ip: ipAddr
  };

  const key = 'c:' + url;
  const arr = Array.isArray(await env.COMMENTS.get(key, 'json')) ? await env.COMMENTS.get(key, 'json') : [];
  arr.push(c);
  await env.COMMENTS.put(key, JSON.stringify(arr));

  return json({ ok: true, comment: { id: c.id, nick: c.nick, website: c.website, email: c.email, content: c.content, time: c.time, pid: c.pid, ua: c.ua, likes: 0 } }, 200, o);
}

// POST /api/comments/like
async function onLike(req, env) {
  const u = new URL(req.url), o = u.origin;
  let b; try { b = await req.json(); } catch { return json({ error: 'invalid' }, 400, o); }
  const cid = s(b.id, 30), url = s(b.url, 300), act = s(b.action, 10) || 'like';
  if (!cid || !url) return json({ error: 'missing' }, 400, o);
  const key = 'c:' + url;
  const arr = Array.isArray(await env.COMMENTS.get(key, 'json')) ? await env.COMMENTS.get(key, 'json') : [];
  const i = arr.findIndex(c => c.id === cid);
  if (i < 0) return json({ error: 'not found' }, 404, o);
  arr[i].likes = Math.max(0, (arr[i].likes || 0) + (act === 'unlike' ? -1 : 1));
  await env.COMMENTS.put(key, JSON.stringify(arr));
  return json({ ok: true, likes: arr[i].likes }, 200, o);
}

async function handle(req, env) {
  const u = new URL(req.url), o = req.headers.get('Origin') || u.origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
  const p = u.pathname;
  if (req.method === 'GET' && p === '/api/comments') return onGet(req, env);
  if (req.method === 'POST' && p === '/api/comments') return onPost(req, env);
  if (req.method === 'POST' && p === '/api/comments/like') return onLike(req, env);
  return json({ error: 'not found' }, 404, o);
}

export default { async fetch(req, env, ctx) { try { return await handle(req, env); } catch { return json({ error: 'server error' }, 500, new URL(req.url).origin); } } };
