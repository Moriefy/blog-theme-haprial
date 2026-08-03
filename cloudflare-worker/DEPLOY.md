# 自定义评论系统部署指南

## 架构

```
浏览器 → 你的博客 (Vercel)
              ↓ fetch
         Cloudflare Worker (API)
              ↓
         Cloudflare KV (存储)
```

## 你需要做的

### 1. 注册 Cloudflare 账号

去 https://dash.cloudflare.com/sign-up 注册（免费）。

### 2. 安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 3. 创建 KV 命名空间

```bash
cd blog/cloudflare-worker
npx wrangler kv namespace create COMMENTS
```

输出类似：
```
{ binding = "COMMENTS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

把 `id` 填入 `wrangler.toml`：
```toml
[[kv_namespaces]]
binding = "COMMENTS"
id = "你拿到的id"
```

### 4. 部署 Worker

```bash
npx wrangler deploy
```

输出类似：
```
Published haprial-comments (x.xx sec)
  https://haprial-comments.你的子域名.workers.dev
```

记下这个 URL。

### 5. 更新博客配置

编辑 `site.config.json`：

```json
"comments": {
  "enabled": true,
  "provider": "custom",
  "apiUrl": "https://haprial-comments.你的子域名.workers.dev",
  "twikooEnvId": ""
}
```

### 6. 更新 Vercel CSP（可选但推荐）

在 `vercel.json` 的 `connect-src` 里加上你的 Worker URL：

```
connect-src 'self' https://haprial-comments.你的子域名.workers.dev ...
```

### 7. 重新构建部署

```bash
node build.js
# 然后 git push 触发 Vercel 部署
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/comments?path=/posts/xxx/` | 获取文章评论 |
| POST | `/api/comments` | 提交评论 |
| GET | `/api/comments/export?key=xxx` | 导出全部评论 |

## 数据导出

```bash
# 导出全部评论为 JSON
curl "https://你的worker/api/comments/export" > comments-backup.json

# 如果设置了 AUTH_KEY
curl "https://你的worker/api/comments/export?key=你的密钥" > comments-backup.json
```

## 安全设置（可选）

### 设置 AUTH_KEY 保护导出接口

```bash
cd blog/cloudflare-worker
npx wrangler secret put AUTH_KEY
# 输入一个密钥
```

### 自定义域名（可选）

在 Cloudflare Dashboard → Workers → 你的 Worker → Settings → Triggers → Custom Domains，添加一个自定义域名（如 `comments.pluslogic.eu.org`）。

然后更新 `site.config.json` 的 `apiUrl` 和 `vercel.json` 的 CSP。

## 反垃圾保护

当前已内置：
- **Honeypot 字段**：隐藏的 `website` 输入框，机器人会填写，真人看不到
- **IP 限流**：同一 IP 每分钟最多 5 条评论
- **内容长度限制**：昵称 50 字，内容 2000 字

如需更强保护，可添加 Cloudflare Turnstile（免费 CAPTCHA）。

## 监控

在 Cloudflare Dashboard → Workers → Analytics 查看：
- 请求量
- 错误率
- KV 读写次数
