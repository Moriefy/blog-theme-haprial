# 评论系统 Worker

> **[English](README.md)** | 中文文档

Haprial 博客评论系统的 Cloudflare Worker 后端。

## ✨ 功能

- 评论增删改查
- 点赞系统
- 管理后台
- 频率限制
- 垃圾评论防护
- 邮件通知（通过 Resend）

## 🚀 快速开始

### 1. 前提条件

- Cloudflare 账户
- Wrangler CLI (`npm install -g wrangler`)
- Resend 账户（用于邮件通知）

### 2. 创建 D1 数据库

```bash
wrangler d1 create haprial-comments
```

更新 `wrangler.toml` 中的数据库 ID。

### 3. 初始化数据库

```bash
wrangler d1 execute haprial-comments --file=schema.sql
```

### 4. 设置密钥

```bash
# 管理员令牌（生成一个强随机字符串）
wrangler secret put ADMIN_TOKEN

# Resend API 密钥（用于邮件通知）
wrangler secret put RESEND_API_KEY

# 通知发件人邮箱
wrangler secret put NOTIFY_FROM
```

### 5. 部署

```bash
wrangler deploy
```

### 6. 配置 CORS

更新 `wrangler.toml`：

```toml
[vars]
CORS_ORIGIN = "https://your-domain.com"
```

## 📧 邮件通知

Worker 可以在有人回复评论时发送邮件通知。

### 设置

1. 创建 [Resend](https://resend.com) 账户
2. 在 Resend 中验证你的域名
3. 获取 API 密钥
4. 设置密钥：

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put NOTIFY_FROM
```

### 配置

将 `NOTIFY_FROM` 设置为你的已验证邮箱：

```
你的博客名称 <noreply@your-domain.com>
```

## 🔌 API 接口

### 评论

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/comments?page=/posts/slug/` | 获取评论 |
| POST | `/api/comments` | 创建评论 |
| POST | `/api/comments/:id/like` | 点赞评论 |

### 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth` | 登录 |
| GET | `/api/admin/comments` | 列出评论 |
| POST | `/api/admin/comments` | 创建评论 |
| DELETE | `/api/admin/comments/:id` | 删除评论 |
| GET | `/api/admin/articles` | 列出文章 |
| POST | `/api/admin/articles` | 创建文章 |
| PUT | `/api/admin/articles/:id` | 更新文章 |
| DELETE | `/api/admin/articles/:id` | 删除文章 |

## ⚙️ 环境变量

| 变量 | 说明 |
|------|------|
| `ADMIN_TOKEN` | 管理员认证令牌 |
| `CORS_ORIGIN` | CORS 允许的源 |
| `RESEND_API_KEY` | Resend API 密钥 |
| `NOTIFY_FROM` | 发件人邮箱地址 |
| `SITE_URL` | 博客 URL（用于邮件链接） |

## 📁 文件结构

```
worker/
├── index.js        # Worker 代码
├── schema.sql      # 数据库结构
├── wrangler.toml   # Worker 配置
├── package.json    # 依赖配置
└── README.md       # 文档
```

## 🔧 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

### 部署

```bash
# 部署到 Cloudflare
npm run deploy
```

## 📄 许可证

MIT 许可证
