#!/usr/bin/env node
// 数据迁移脚本：将现有文章和友链导入 D1
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://comments.pluslogic.eu.org';
const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

let TOKEN = '';

function apiReq(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(API + apiPath);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { resolve({ raw: Buffer.concat(chunks).toString() }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return [{}, src];
  const meta = {};
  m[1].split(/\r?\n/).forEach(line => {
    const fm = line.match(/^(\w+):\s*"([^"]*)"/);
    const fn = line.match(/^(\w+):\s*(.+)$/);
    if (fm) meta[fm[1]] = fm[2];
    else if (fn) {
      const key = fn[1];
      let val = fn[2].trim();
      if (val.startsWith('[')) try { val = JSON.parse(val); } catch (e) {}
      meta[key] = val;
    }
  });
  return [meta, src.slice(m[0].length)];
}

async function main() {
  // 先登录获取 token
  const password = process.argv[2];
  if (!password) { console.error('用法: node migrate.js <管理密码>'); process.exit(1); }
  console.log('🔐 登录中...');
  const auth = await apiReq('POST', '/api/admin/auth', { password });
  if (!auth.ok) { console.error('登录失败:', auth.error); process.exit(1); }
  TOKEN = auth.token;
  console.log('✓ 登录成功\n');

  console.log('🚀 开始迁移数据到 D1...\n');

  // 1. 迁移友链
  console.log('📌 迁移友链...');
  for (const f of CONFIG.friends) {
    const res = await apiReq('POST', '/api/admin/friends', {
      name: f.name,
      url: f.url,
      avatar: f.avatar || '',
      desc: f.desc || '',
      sort: 0
    });
    console.log(`  ${res.ok ? '✓' : '✗'} ${f.name}`);
  }

  // 2. 迁移文章
  console.log('\n📝 迁移文章...');
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const [meta, body] = parseFrontMatter(raw);
    const dateVal = meta.date || '';
    const slug = file.replace('.md', '');
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const res = await apiReq('POST', '/api/admin/articles', {
      title: meta.title || slug,
      date: dateVal,
      tags,
      category: meta.category || '',
      excerpt: meta.excerpt || '',
      content: body.trim(),
      status: 'published'
    });
    console.log(`  ${res.ok ? '✓' : '✗'} ${meta.title || slug}`);
  }

  console.log(`\n✅ 迁移完成！友链 ${CONFIG.friends.length} 条，文章 ${files.length} 篇`);
}

main().catch(console.error);
