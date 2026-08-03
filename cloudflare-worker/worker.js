// Haprial Comments — Cloudflare Worker
// Storage: Cloudflare KV (binding: COMMENTS)
// Endpoints:
//   GET  /api/comments?path=/posts/xxx/  → 获取评论列表
//   POST /api/comments                   → 提交评论
//   GET  /api/comments/export            → 导出全部评论 (可选, 需 AUTH_KEY)

const ALLOWED_ORIGINS = [
  'https://pluslogic.eu.org',
  'http://localhost:3000',
  'http://localhost:8788',
];

const MAX_CONTENT_LENGTH = 2000;
const MAX_NICK_LENGTH = 50;
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 5;     // per window per IP

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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
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

// Simple markdown-like formatting for comment content
function formatContent(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ── Rate Limiting (KV-based, best-effort) ───────────────────────────────────
async function checkRateLimit(kv, ip) {
  const key = `ratelimit:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `${key}:${Math.floor(now / RATE_LIMIT_WINDOW)}`;

  try {
    const count = await kv.get(windowKey, 'text');
    const n = parseInt(count) || 0;
    if (n >= RATE_LIMIT_MAX) return false;
    await kv.put(windowKey, String(n + 1), { expirationTtl: RATE_LIMIT_WINDOW * 2 });
    return true;
  } catch (e) {
    return true; // fail open
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────
async function handleGetComments(request, env) {
  const url = new URL(request.url);
  const path = sanitize(url.searchParams.get('path'), 200);

  if (!path || !path.startsWith('/')) {
    return json({ error: 'Invalid path parameter' }, 400, url.origin);
  }

  const kvKey = `comments:${path}`;
  const data = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(data) ? data : [];

  // Don't expose email to client
  const safe = comments.map(c => ({
    id: c.id,
    nick: c.nick,
    content: c.content,
    time: c.time,
    replyTo: c.replyTo || null,
  }));

  return json({ comments: safe, total: safe.length }, 200, url.origin);
}

async function handlePostComment(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const ip = getClientIP(request);

  // Rate limit
  const ok = await checkRateLimit(env.COMMENTS, ip);
  if (!ok) return json({ error: 'Too many requests. Please wait a moment.' }, 429, origin);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  // Honeypot check
  if (body.website) {
    // Bot detected — pretend success
    return json({ ok: true, id: 'honey' }, 200, origin);
  }

  const path = sanitize(body.path, 200);
  const nick = sanitize(body.nick, MAX_NICK_LENGTH);
  const email = sanitize(body.email, 100);
  const content = sanitize(body.content, MAX_CONTENT_LENGTH);
  const replyTo = sanitize(body.replyTo, 20);

  // Validation
  if (!path || !path.startsWith('/')) return json({ error: 'Invalid path' }, 400, origin);
  if (!nick) return json({ error: 'Nickname is required' }, 400, origin);
  if (!content) return json({ error: 'Content is required' }, 400, origin);
  if (content.length < 2) return json({ error: 'Comment is too short' }, 400, origin);

  const comment = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nick,
    email: email || null, // stored but not exposed
    content: formatContent(content),
    raw: content,         // original text for editing later if needed
    time: new Date().toISOString(),
    replyTo: replyTo || null,
    ip,                   // stored for moderation
  };

  const kvKey = `comments:${path}`;
  const existing = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(existing) ? existing : [];
  comments.push(comment);

  // KV has a 25MB value limit — should be fine for comments
  await env.COMMENTS.put(kvKey, JSON.stringify(comments));

  // Return the new comment (without sensitive fields)
  return json({
    ok: true,
    comment: {
      id: comment.id,
      nick: comment.nick,
      content: comment.content,
      time: comment.time,
      replyTo: comment.replyTo,
    },
  }, 200, origin);
}

async function handleExport(request, env) {
  const url = new URL(request.url);
  const authKey = url.searchParams.get('key');

  // Simple auth — set AUTH_KEY in wrangler secrets
  if (env.AUTH_KEY && authKey !== env.AUTH_KEY) {
    return json({ error: 'Unauthorized' }, 401, url.origin);
  }

  const list = await env.COMMENTS.list({ prefix: 'comments:' });
  const all = {};

  for (const key of list.keys) {
    const path = key.name.replace('comments:', '');
    const data = await env.COMMENTS.get(key.name, 'json');
    all[path] = Array.isArray(data) ? data : [];
  }

  return new Response(JSON.stringify(all, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename=comments-export.json',
      ...corsHeaders(url.origin),
    },
  });
}

async function handleExportSingle(path, env, origin) {
  const kvKey = `comments:${path}`;
  const data = await env.COMMENTS.get(kvKey, 'json');
  const comments = Array.isArray(data) ? data : [];

  return new Response(JSON.stringify(comments, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=comments-${path.replace(/\//g, '_')}.json`,
      ...corsHeaders(origin),
    },
  });
}

// ── Router ──────────────────────────────────────────────────────────────────
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || url.origin;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const path = url.pathname;

  // POST /api/comments
  if (request.method === 'POST' && path === '/api/comments') {
    return handlePostComment(request, env);
  }

  // GET /api/comments?path=...
  if (request.method === 'GET' && path === '/api/comments') {
    const targetPath = url.searchParams.get('path');
    if (targetPath && url.searchParams.has('export')) {
      return handleExportSingle(targetPath, env, origin);
    }
    return handleGetComments(request, env);
  }

  // GET /api/comments/export?key=...
  if (request.method === 'GET' && path === '/api/comments/export') {
    return handleExport(request, env);
  }

  return json({ error: 'Not found' }, 404, origin);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      return json({ error: 'Internal server error' }, 500, new URL(request.url).origin);
    }
  },
};
