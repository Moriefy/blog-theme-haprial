#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Moriefy';
const REPO = 'Blog_Astro';
const BRANCH = 'main';

if (!TOKEN) { console.error('GITHUB_TOKEN required'); process.exit(1); }

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'Blog-Astro-Push',
        'Accept': 'application/vnd.github+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(txt)); } catch (e) { resolve(txt); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Check if branch exists
  console.log('Checking repo...');
  const branch = await api('GET', `/repos/${OWNER}/${REPO}/branches/${BRANCH}`);
  
  let baseSha = null;
  if (branch && branch.commit) {
    baseSha = branch.commit.sha;
    console.log(`Branch ${BRANCH} exists, base SHA: ${baseSha}`);
  } else {
    console.log(`Branch ${BRANCH} doesn't exist, will create.`);
  }

  // 2. Collect all files
  const ROOT = path.join(__dirname, '..', '..', '..');
  const files = [];
  function walk(dir, rel) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const r = rel ? rel + '/' + f : f;
      if (f === '.git' || f === 'dist' || f === 'node_modules' || f === '.build-cache.json') continue;
      if (fs.statSync(full).isDirectory()) walk(full, r);
      else files.push({ path: r, full });
    }
  }
  walk(ROOT, '');
  console.log(`Found ${files.length} files to push`);

  // 3. Create blobs
  console.log('Creating blobs...');
  const blobShas = {};
  for (const f of files) {
    const content = fs.readFileSync(f.full);
    const b64 = content.toString('base64');
    const res = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
      content: b64,
      encoding: 'base64'
    });
    if (!res.sha) {
      console.error(`  FAIL: ${f.path}`, res);
      process.exit(1);
    }
    blobShas[f.path] = res.sha;
    console.log(`  ✓ ${f.path} -> ${res.sha.slice(0, 8)}...`);
  }

  // 4. Create tree
  console.log('Creating tree...');
  const tree = files.map(f => ({
    path: f.path,
    mode: '100644',
    type: 'blob',
    sha: blobShas[f.path]
  }));
  const treeRes = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, {
    tree,
    ...(baseSha ? { base_tree: baseSha } : {})
  });
  if (!treeRes.sha) {
    console.error('Tree creation failed:', treeRes);
    process.exit(1);
  }
  console.log(`Tree SHA: ${treeRes.sha}`);

  // 5. Create commit
  console.log('Creating commit...');
  const commitRes = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: 'feat: 优化构建缓存、Markdown解析器、SEO页面、图片处理\n\n- 构建缓存：基于内容哈希增量构建\n- Markdown增强：任务列表、内联数学公式\n- SEO页面：生成真实可索引内容\n- 图片优化：width/height、srcset、WebP',
    tree: treeRes.sha,
    ...(baseSha ? { parents: [baseSha] } : {})
  });
  if (!commitRes.sha) {
    console.error('Commit creation failed:', commitRes);
    process.exit(1);
  }
  console.log(`Commit SHA: ${commitRes.sha}`);

  // 6. Update ref
  console.log('Updating ref...');
  if (baseSha) {
    const refRes = await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      sha: commitRes.sha
    });
    console.log('Ref updated:', refRes.ref || refRes);
  } else {
    const refRes = await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
      ref: `refs/heads/${BRANCH}`,
      sha: commitRes.sha
    });
    console.log('Ref created:', refRes.ref || refRes);
  }

  console.log(`\n✅ Done! https://github.com/${OWNER}/${REPO}/tree/${BRANCH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
