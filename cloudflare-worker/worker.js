// Haprial Comments API — Cloudflare Worker + KV
const ORIGINS = ['https://pluslogic.eu.org', 'http://localhost:3000', 'http://localhost:8788'];

function cors(o) { return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }; }
function json(d, s, o) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...cors(o) } }); }
function ip(r) { return r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For') || ''; }
function trim(s, n) { return String(s || '').trim().slice(0, n); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function device(ua) {
  if (!ua) return ''; ua = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  if (/macintosh/.test(ua)) return 'macOS';
  if (/windows/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux';
  return '';
}

function render(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/@(\S+)/g, '<span class="cm-at">@$1</span>').replace(/\n/g, '<br>');
}

async function rl(kv, ipAddr) {
  const now = Math.floor(Date.now() / 1000), key = 'rl:' + ipAddr + ':' + Math.floor(now / 60);
  try { const n = parseInt(await kv.get(key, 'text')) || 0; if (n >= 5) return false; await kv.put(key, String(n + 1), { expirationTtl: 120 }); return true; } catch (e) { return true; }
}

// ── Comment object: always use `pid` internally, `parent_id` externally ─────
function toPublic(c) {
  return { id: c.id, nick: c.nick, website: c.website || '', content: c.content, time: c.time, parent_id: c.pid || null, device: c.ua || '', likes: c.likes || 0 };
}

// GET
async function handleGet(req, env) {
  const u = new URL(req.url), path = trim(u.searchParams.get('path'), 200);
  if (!path || !path.startsWith('/')) return json({ error: 'invalid' }, 400, u.origin);
  const raw = await env.COMMENTS.get('cmt:' + path, 'json');
  return json({ comments: (Array.isArray(raw) ? raw : []).map(toPublic) }, 200, u.origin);
}

// POST
async function handlePost(req, env) {
  const u = new URL(req.url), o = u.origin, ipAddr = ip(req);
  if (!await rl(env.COMMENTS, ipAddr)) return json({ error: '稍后再试' }, 429, o);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'invalid' }, 400, o); }
  if (b.website) return json({ ok: true }, 200, o);

  const path = trim(b.path, 200), nick = trim(b.nick, 50), email = trim(b.email, 100);
  const website = trim(b.website_url, 200), body = trim(b.content, 2000);
  const pid = trim(b.parent_id, 30) || null, lid = trim(b.link_id, 100) || null;
  if (!path.startsWith('/')) return json({ error: 'invalid' }, 400, o);
  if (!nick) return json({ error: '需要昵称' }, 400, o);
  if (body.length < 2) return json({ error: '内容太短' }, 400, o);

  const ua = device(req.headers.get('User-Agent'));
  const c = { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5), nick, email: email || null, website: website || null, content: render(body), raw: body, time: new Date().toISOString(), pid, lid, ua, likes: 0, ip: ipAddr };

  const key = 'cmt:' + (lid ? 'link:' + lid : path);
  const arr = Array.isArray(await env.COMMENTS.get(key, 'json')) ? await env.COMMENTS.get(key, 'json') : [];
  arr.push(c);
  await env.COMMENTS.put(key, JSON.stringify(arr));
  return json({ ok: true, comment: toPublic(c) }, 200, o);
}

// LIKE
async function handleLike(req, env) {
  const u = new URL(req.url), o = u.origin;
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'invalid' }, 400, o); }
  const cid = trim(b.comment_id, 30), path = trim(b.path, 200), lid = trim(b.link_id, 100), act = trim(b.action, 10) || 'like';
  if (!cid) return json({ error: 'missing id' }, 400, o);
  const key = 'cmt:' + (lid ? 'link:' + lid : path);
  const arr = Array.isArray(await env.COMMENTS.get(key, 'json')) ? await env.COMMENTS.get(key, 'json') : [];
  const i = arr.findIndex(c => c.id === cid);
  if (i < 0) return json({ error: 'not found' }, 404, o);
  arr[i].likes = Math.max(0, (arr[i].likes || 0) + (act === 'unlike' ? -1 : 1));
  await env.COMMENTS.put(key, JSON.stringify(arr));
  return json({ ok: true, likes: arr[i].likes }, 200, o);
}

async function handleRequest(req, env) {
  const u = new URL(req.url), o = req.headers.get('Origin') || u.origin;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(o) });
  const p = u.pathname;
  if (req.method === 'POST' && p === '/api/comments') return handlePost(req, env);
  if (req.method === 'POST' && p === '/api/comments/like') return handleLike(req, env);
  if (req.method === 'GET' && p === '/api/comments') return handleGet(req, env);
  return json({ error: 'not found' }, 404, o);
}

export default { async fetch(req, env, ctx) { try { return await handleRequest(req, env); } catch (e) { return json({ error: 'server error' }, 500, new URL(req.url).origin); } } };
