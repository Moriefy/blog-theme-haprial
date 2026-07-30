#!/usr/bin/env node
'use strict';
const https = require('https'), fs = require('fs'), path = require('path');
const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'Moriefy', REPO = 'Blog_Astro', BRANCH = 'main';
function api(m, u, b) {
  return new Promise((ok, no) => {
    const d = b ? JSON.stringify(b) : null;
    const r = https.request({hostname:'api.github.com',path:u,method:m,headers:{'Authorization':'token '+TOKEN,'User-Agent':'Push','Accept':'application/vnd.github+json',...(d?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(d)}:{})},timeout:30000}, res => {let c=[];res.on('data',x=>c.push(x));res.on('end',()=>{try{ok(JSON.parse(Buffer.concat(c).toString()))}catch(e){ok({})}})});r.on('error',no);r.setTimeout(30000);if(d)r.write(d);r.end();
  });
}
async function main() {
  const br = await api('GET','/repos/'+OWNER+'/'+REPO+'/branches/'+BRANCH);
  const base = br.commit.sha;
  console.log('Base:', base);
  const ROOT = path.join(__dirname, '..');
  const files = [];
  function walk(d,r){for(const f of fs.readdirSync(d)){const p=path.join(d,f),x=r?r+'/'+f:f;if(f==='.git'||f==='dist'||f==='node_modules'||f==='.build-cache.json'||f==='.openclaw')continue;if(fs.statSync(p).isDirectory())walk(p,x);else files.push({path:x,full:p})}}
  walk(ROOT,'');
  console.log('Files:', files.length);
  const shas = {};
  for(const f of files){
    const r = await api('POST','/repos/'+OWNER+'/'+REPO+'/git/blobs',{content:fs.readFileSync(f.full).toString('base64'),encoding:'base64'});
    shas[f.path]=r.sha; console.log('  ✓',f.path);
  }
  const tr = await api('POST','/repos/'+OWNER+'/'+REPO+'/git/trees',{tree:files.map(f=>({path:f.path,mode:'100644',type:'blob',sha:shas[f.path]}))});
  const cr = await api('POST','/repos/'+OWNER+'/'+REPO+'/git/commits',{message:'fix: 修复同日期文章slug冲突，两篇文章现在都能正常显示\n\n- 20260729-network-culture.md 和 20260729-study-guide.md 同日期\n- 后者自动追加文件名后缀避免覆盖',tree:tr.sha,parents:[base]});
  await api('PATCH','/repos/'+OWNER+'/'+REPO+'/git/refs/heads/'+BRANCH,{sha:cr.sha});
  console.log('✅ Pushed!', cr.sha);
}
main().catch(e=>{console.error(e);process.exit(1)});
