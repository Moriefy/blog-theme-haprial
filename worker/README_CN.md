# 评论系统 Worker

> **[English](README.md)** | 中文文档

Haprial 博客评论系统的 Cloudflare Worker 后端。

## 功能

- 评论增删改查
- 点赞系统
- 管理后台
- 频率限制
- 垃圾评论防护
- 邮件通知（通过 Resend）

## 快速开始

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

## 邮件通知

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

## 许可证

MIT 许可证
