// ── Cloudflare Worker — Haprial Comment System ──
// Deploy to: comments.pluslogic.eu.org
// KV Binding: COMMENTS
// Env Var: ADMIN_SECRET
// Version: 2

const ALLOWED_ORIGINS = [
  'https://pluslogic.eu.org',
  'https://www.pluslogic.eu.org',
  'http://localhost:3000',
  'http://localhost:4321',
];

const MAX_NICK = 30;
const MAX_CONTENT = 2000;
const RATE_WINDOW = 8000; // 8s cooldown per IP

// ── Router ──────────────────────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = buildCors(origin, env);

    if (req.method === 'OPTIONS') return preflight(cors);

    try {
      const { pathname } = url;

      if (pathname === '/api/comments' && req.method === 'GET')
        return await handleGet(url, cors, env);
      if (pathname === '/api/comment' && req.method === 'POST')
        return await handlePost(req, cors, env);
      if (pathname === '/api/comment' && req.method === 'DELETE')
        return await handleDelete(req, cors, env);
      if (pathname === '/api/like' && req.method === 'POST')
        return await handleLike(req, cors, env);
      if (pathname === '/api/count' && req.method === 'GET')
        return await handleCount(url, cors, env);

      return json({ error: 'Not Found' }, 404, cors);
    } catch (err) {
      return json({ error: err.message || 'Internal Error' }, 500, cors);
    }
  },
};

// ── CORS ────────────────────────────────────────────────────────────────────
function buildCors(origin, env) {
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = [...ALLOWED_ORIGINS, ...extra];
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function preflight(cors) {
  return new Response(null, { status: 204, headers: cors });
}

// ── GET /api/comments ───────────────────────────────────────────────────────
async function handleGet(url, cors, env) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'missing path' }, 400, cors);

  const key = `comments:${path}`;
  const data = await env.COMMENTS.get(key, 'json');
  const all = Array.isArray(data) ? data : [];
  const visible = all.filter(c => c.content !== null);

  return json({ comments: visible, total: visible.length }, 200, cors);
}

// ── GET /api/count?paths=/a,/b ──────────────────────────────────────────────
async function handleCount(url, cors, env) {
  const paths = (url.searchParams.get('paths') || '').split(',').filter(Boolean);
  const counts = {};

  await Promise.all(paths.map(async p => {
    const data = await env.COMMENTS.get(`comments:${p}`, 'json');
    const all = Array.isArray(data) ? data : [];
    counts[p] = all.filter(c => c.content !== null).length;
  }));

  return json({ counts }, 200, cors);
}

// ── POST /api/comment ───────────────────────────────────────────────────────
async function handlePost(req, cors, env) {
  const body = await req.json();
  const { path, parent, nick, email, link, content } = body;

  // Validate
  if (!path || !nick || !content) return json({ error: 'missing fields' }, 400, cors);
  if (typeof nick !== 'string' || typeof content !== 'string')
    return json({ error: 'invalid type' }, 400, cors);
  if (nick.trim().length < 1 || nick.trim().length > MAX_NICK)
    return json({ error: 'nick length' }, 400, cors);
  if (content.trim().length < 1 || content.trim().length > MAX_CONTENT)
    return json({ error: 'content length' }, 400, cors);
  if (parent && typeof parent !== 'string') return json({ error: 'invalid parent' }, 400, cors);
  if (link && typeof link !== 'string') return json({ error: 'invalid link' }, 400, cors);

  // Rate limit
  const ip = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const rlKey = `rl:${hash(ip)}`;
  const last = await env.COMMENTS.get(rlKey);
  if (last && Date.now() - parseInt(last) < RATE_WINDOW) {
    return json({ error: 'slow down' }, 429, cors);
  }
  await env.COMMENTS.put(rlKey, String(Date.now()), { expirationTtl: 60 });

  // Build comment
  const ts = Date.now();
  const id = `c${Math.floor(ts / 1000).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const comment = {
    id,
    parent: parent || null,
    nick: sanitize(nick.trim()),
    email: email ? await hash(email.trim().toLowerCase()) : '',
    link: link ? sanitize(link.trim()).slice(0, 200) : '',
    html: renderMd(content.trim()),
    likes: 0,
    likedBy: [],
    ua: parseUA(req.headers.get('User-Agent')),
    ip: await hash(ip),
    created: ts,
    updated: ts,
    isOwner: false,
  };

  // Verify owner
  const token = req.headers.get('Authorization');
  if (token && token.startsWith('Bearer ')) {
    const sig = token.slice(7);
    const valid = await verifyOwner(sig, comment.email, env.ADMIN_SECRET);
    if (valid) comment.isOwner = true;
  }

  // Append
  const key = `comments:${path}`;
  const existing = (await env.COMMENTS.get(key, 'json')) || [];

  // If replying, verify parent exists
  if (comment.parent) {
    const parentExists = existing.some(c => c.id === comment.parent && c.content !== null);
    if (!parentExists) return json({ error: 'parent not found' }, 400, cors);
  }

  existing.push(comment);
  await env.COMMENTS.put(key, JSON.stringify(existing));

  return json({ comment }, 201, cors);
}

// ── DELETE /api/comment ─────────────────────────────────────────────────────
async function handleDelete(req, cors, env) {
  const auth = req.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_SECRET}`)
    return json({ error: 'unauthorized' }, 401, cors);

  const { path, commentId } = await req.json();
  if (!path || !commentId) return json({ error: 'missing fields' }, 400, cors);

  const key = `comments:${path}`;
  const existing = (await env.COMMENTS.get(key, 'json')) || [];
  const idx = existing.findIndex(c => c.id === commentId);
  if (idx === -1) return json({ error: 'not found' }, 404, cors);

  // Soft delete
  existing[idx].content = null;
  existing[idx].html = null;
  existing[idx].updated = Date.now();

  await env.COMMENTS.put(key, JSON.stringify(existing));
  return new Response(null, { status: 204, headers: cors });
}

// ── POST /api/like ──────────────────────────────────────────────────────────
async function handleLike(req, cors, env) {
  const { path, commentId } = await req.json();
  if (!path || !commentId) return json({ error: 'missing fields' }, 400, cors);

  const ip = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hash(ip);

  const key = `comments:${path}`;
  const existing = (await env.COMMENTS.get(key, 'json')) || [];
  const idx = existing.findIndex(c => c.id === commentId);
  if (idx === -1) return json({ error: 'not found' }, 404, cors);

  const c = existing[idx];
  if (!c.likedBy) c.likedBy = [];

  if (c.likedBy.includes(ipHash)) {
    // Unlike
    c.likedBy = c.likedBy.filter(h => h !== ipHash);
    c.likes = Math.max(0, (c.likes || 0) - 1);
  } else {
    c.likedBy.push(ipHash);
    c.likes = (c.likes || 0) + 1;
  }
  c.updated = Date.now();

  await env.COMMENTS.put(key, JSON.stringify(existing));
  return json({ likes: c.likes, liked: c.likedBy.includes(ipHash) }, 200, cors);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function sanitize(s) {
  return s.replace(/[<>"'&]/g, ch => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;'
  }[ch]));
}

function renderMd(src) {
  let h = src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  h = h.replace(/~~(.+?)~~/g, '<del>$1</del>');
  h = h.replace(/`([^`]+?)`/g, '<code>$1</code>');
  h = h.replace(/\[([^\]]+?)\]\((https?:\/\/[^)]+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\n/g, '<br>');
  return h;
}

async function hash(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str + '_haprial_2026'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).slice(0, 12).join('');
}

async function verifyOwner(sig, emailHash, secret) {
  if (!secret || !sig) return false;
  const expected = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(emailHash)
  );
  const expectedHex = Array.from(new Uint8Array(expected)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === expectedHex;
}

function parseUA(ua) {
  if (!ua) return '';
  let b = 'Unknown', o = '';
  if (/Chrome\/(\d+)/.test(ua) && !/Edg\//.test(ua)) b = 'Chrome ' + RegExp.$1;
  else if (/Firefox\/(\d+)/.test(ua)) b = 'Firefox ' + RegExp.$1;
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) b = 'Safari';
  else if (/Edg\/(\d+)/.test(ua)) b = 'Edge ' + RegExp.$1;
  if (/Windows/.test(ua)) o = 'Windows';
  else if (/Mac OS X/.test(ua)) o = 'macOS';
  else if (/Linux/.test(ua)) o = 'Linux';
  else if (/Android/.test(ua)) o = 'Android';
  else if (/iPhone|iPad/.test(ua)) o = 'iOS';
  return o ? b + ' · ' + o : b;
}
