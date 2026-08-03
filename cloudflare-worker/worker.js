// Haprial Comments — Cloudflare Worker (v2)
// Storage: Cloudflare KV (binding: COMMENTS)
// Endpoints:
//   GET    /api/comments?path=/posts/xxx/          → 获取评论列表
//   POST   /api/comments                           → 提交评论
//   POST   /api/comments/like                      → 点赞
//   GET    /api/comments/export?key=***             → 导出全部评论
//   GET    /api/comments/search?q=keyword&path=...  → 搜索评论

const ALLOWED_ORIGINS = [
  'https://pluslogic.eu.org',
  'http://localhost:3000',
  'http://localhost:8788',
];

const MAX_CONTENT_LENGTH = 2000;
const MAX_NICK_LENGTH = 50;
const MAX_URL_LENGTH = 200;
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 5;
const LIKE_RATE_LIMIT_WINDOW = 10;
const LIKE_RATE_LIMIT_MAX = 30;
const MAX_NESTING_DEPTH = 50; // data limit (visual limit handled by frontend)

// ── CORS ────────────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

function sanitize(str, maxLen) {
  return String(str || '').trim().slice(0, maxLen);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseDevice(ua) {
  if (!ua) return '';
  ua = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  if (/macintosh|mac os x/.test(ua)) return 'macOS';
  if (/windows/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux';
  if (/cros/.test(ua)) return 'ChromeOS';
  return '';
}

function formatContent(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/@(\S+)/g, '<span class="cmt-mention">@$1</span>')
    .replace(/\n/g, '<br>');
}

// ── Geolocation ─────────────────────────────────────────────────────────────
async function getLocation(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return '';
  try {
    const resp = await fetch('http://ip-api.com/json/' + ip + '?fields=status,country,regionName,city&lang=zh-CN', {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    if (data.status !== 'success') return '';
    const parts = [];
    if (data.regionName) parts.push(data.regionName);
    if (data.city && data.city !== data.regionName) parts.push(data.city);
    return parts.join(' ');
  } catch (e) {
    return '';
  }
}

// ── Rate Limiting ───────────────────────────────────────────────────────────
async function checkRateLimit(kv, ip, window, max, prefix) {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = prefix + ':' + ip + ':' + Math.floor(now / window);
  try {
    const count = await kv.get(windowKey, 'text');
    const n = parseInt(count) || 0;
    if (n >= max) return false;
    await kv.put(windowKey, String(n + 1), { expirationTtl: window * 2 });
    return true;
  } catch (e) {
    return true;
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────
async function handleGetComments(request, env) {
  const url = new URL(request.url);
  const path = sanitize(url.searchParams.get('path'), 200);
  if (!path || !path.startsWith('/')) return json({ error: 'Invalid path parameter' }, 400, url.origin);

  const kvKey = 'comments:' + path;
  const data = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(data) ? data : [];

  const safe = comments.map(c => ({
    id: c.id,
    nick: c.nick,
    website: c.website || '',
    content: c.content,
    time: c.time,
    parent_id: c.parent_id || null,
    device: c.device || '',
    location: c.location || '',
    likes: c.likes || 0,
  }));

  return json({ comments: safe, total: safe.length }, 200, url.origin);
}

async function handlePostComment(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const ip = getClientIP(request);

  const ok = await checkRateLimit(env.COMMENTS, ip, RATE_LIMIT_WINDOW, RATE_LIMIT_MAX, 'rl');
  if (!ok) return json({ error: 'Too many requests. Please wait a moment.' }, 429, origin);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body' }, 400, origin); }

  if (body.website) return json({ ok: true, id: 'honey' }, 200, origin);

  const path = sanitize(body.path, 200);
  const nick = sanitize(body.nick, MAX_NICK_LENGTH);
  const email = sanitize(body.email, 100);
  const website = sanitize(body.website_url || body.website, MAX_URL_LENGTH);
  const content = sanitize(body.content, MAX_CONTENT_LENGTH);
  const parent_id = sanitize(body.parent_id, 30) || null;
  const link_id = sanitize(body.link_id, 100) || null;

  if (!path || !path.startsWith('/')) return json({ error: 'Invalid path' }, 400, origin);
  if (!nick) return json({ error: 'Nickname is required' }, 400, origin);
  if (!content) return json({ error: 'Content is required' }, 400, origin);
  if (content.length < 2) return json({ error: 'Comment is too short' }, 400, origin);

  const ua = request.headers.get('User-Agent') || '';
  const device = parseDevice(ua);
  const location = await getLocation(ip);

  const comment = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    nick,
    email: email || null,
    website: website || null,
    content: formatContent(content),
    raw: content,
    time: new Date().toISOString(),
    parent_id: parent_id,
    link_id: link_id,
    device: device,
    location: location,
    likes: 0,
    ip: ip,
  };

  // Determine storage path
  const storePath = link_id ? 'comments:link:' + link_id : path;
  const kvKey = 'comments:' + storePath;
  const existing = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(existing) ? existing : [];
  comments.push(comment);
  await env.COMMENTS.put(kvKey, JSON.stringify(comments));

  return json({
    ok: true,
    comment: {
      id: comment.id,
      nick: comment.nick,
      website: comment.website,
      content: comment.content,
      time: comment.time,
      parent_id: comment.parent_id,
      device: comment.device,
      location: comment.location,
      likes: 0,
    },
  }, 200, origin);
}

async function handleLike(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const ip = getClientIP(request);

  const ok = await checkRateLimit(env.COMMENTS, ip, LIKE_RATE_LIMIT_WINDOW, LIKE_RATE_LIMIT_MAX, 'rl-like');
  if (!ok) return json({ error: 'Too many requests' }, 429, origin);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body' }, 400, origin); }

  const commentId = sanitize(body.comment_id, 30);
  const path = sanitize(body.path, 200);
  const link_id = sanitize(body.link_id, 100);

  if (!commentId) return json({ error: 'Missing comment_id' }, 400, origin);
  if (!path && !link_id) return json({ error: 'Missing path or link_id' }, 400, origin);

  const storePath = link_id ? 'comments:link:' + link_id : path;
  const kvKey = 'comments:' + storePath;
  const existing = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(existing) ? existing : [];

  const idx = comments.findIndex(c => c.id === commentId);
  if (idx === -1) return json({ error: 'Comment not found' }, 404, origin);

  comments[idx].likes = (comments[idx].likes || 0) + 1;
  await env.COMMENTS.put(kvKey, JSON.stringify(comments));

  return json({ ok: true, likes: comments[idx].likes }, 200, origin);
}

async function handleExport(request, env) {
  const url = new URL(request.url);
  const authKey = url.searchParams.get('key');
  if (env.AUTH_KEY && authKey !== env.AUTH_KEY) return json({ error: 'Unauthorized' }, 401, url.origin);

  const list = await env.COMMENTS.list({ prefix: 'comments:' });
  const all = {};
  for (const key of list.keys) {
    const path = key.name.replace('comments:', '');
    const data = await env.COMMENTS.get(key.name, 'json');
    all[path] = Array.isArray(data) ? data : [];
  }
  return new Response(JSON.stringify(all, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=comments-export.json', ...corsHeaders(url.origin) },
  });
}

// ── Router ──────────────────────────────────────────────────────────────────
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || url.origin;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const path = url.pathname;

  if (request.method === 'POST' && path === '/api/comments') return handlePostComment(request, env);
  if (request.method === 'POST' && path === '/api/comments/like') return handleLike(request, env);
  if (request.method === 'GET' && path === '/api/comments') return handleGetComments(request, env);
  if (request.method === 'GET' && path === '/api/comments/export') return handleExport(request, env);

  return json({ error: 'Not found' }, 404, origin);
}

export default {
  async fetch(request, env, ctx) {
    try { return await handleRequest(request, env); }
    catch (e) { return json({ error: 'Internal server error' }, 500, new URL(request.url).origin); }
  },
};
