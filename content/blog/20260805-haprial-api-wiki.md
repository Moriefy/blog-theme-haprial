---
title: "Haprial 后台 API 完整文档 — 安卓客户端开发指南"
date: "2026-08-05"
tags: ["API", "开发文档", "Cloudflare", "安卓"]
category: "tech"
excerpt: "Haprial 博客系统后台 API 的完整文档，涵盖认证、文章、评论、友链、图片管理、回收站等所有接口，适用于安卓客户端开发。"
---

## 概述

Haprial 博客系统的后端基于 **Cloudflare Worker** + **D1 数据库**，前端通过 REST API 与后端通信。本文档涵盖所有 API 接口的详细说明，适用于安卓客户端开发。

**基础信息：**
- API 域名：`https://comments.pluslogic.eu.org`
- 数据库：Cloudflare D1（SQLite）
- 认证方式：HMAC-SHA256 Token（7天有效期）
- 图片存储：GitHub 仓库 `static/images/` 目录
- 图片 CDN：`https://pluslogic.eu.org/images/`
- GitHub 同步：文章的创建、更新、删除、发布、下架、恢复都会自动同步到 GitHub，触发 Vercel 重新部署

---

## 一、认证系统

### 1.1 认证流程

```
用户输入密码
    ↓
POST /api/admin/auth { password: "xxx" }
    ↓
Worker 计算 sha256(password)
    ↓
与 D1 admin_config 表中的 password_hash 比对
    ↓
匹配 → 生成 HMAC Token（7天有效）→ 返回
不匹配 → 返回 401
```

### 1.2 Token 格式

```
{timestamp}.{hmac_signature}
```

- `timestamp`：Token 创建时间戳（毫秒）
- `hmac_signature`：使用 `ADMIN_TOKEN`（环境变量）对 timestamp 做 HMAC-SHA256 签名

### 1.3 Token 验证

所有管理接口都需要在请求头中携带 Token：

```
Authorization: Bearer {token}
```

也可以通过 URL 参数传递（用于导出等 GET 请求）：

```
?token={token}
```

---

## 二、API 接口详细说明

### 2.1 公开接口（无需认证）

#### GET /api/health

健康检查。

**响应：**
```json
{
  "ok": true,
  "hasGithubToken": true,
  "repo": "Moriefy/Blog_Astro"
}
```

**字段说明：**
- `hasGithubToken`：Worker 是否配置了 GitHub Token
- `repo`：当前配置的 GitHub 仓库名

---

#### GET /api/comments

获取某篇文章的评论列表。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | string | 是 | 文章路径，如 `/posts/20260806/` |
| cursor | number | 否 | 分页游标（评论 ID） |
| limit | number | 否 | 每页数量，默认 50，最大 100 |

**响应：**
```json
{
  "comments": [
    {
      "id": 1,
      "parent_id": 0,
      "depth": 0,
      "nickname": "访客",
      "avatar_hash": "abc123",
      "website": null,
      "content_html": "<p>评论内容</p>",
      "liked": 5,
      "is_admin": 0,
      "pinned": 0,
      "created_at": "2026-08-06 12:00:00",
      "updated_at": "2026-08-06 12:00:00"
    }
  ],
  "total": 10,
  "cursor": 1,
  "hasMore": true
}
```

**字段说明：**
- `parent_id`：父评论 ID，0 表示顶级评论
- `depth`：嵌套层级（0、1、2）
- `avatar_hash`：邮箱的 MD5 哈希（用于 Cravatar 头像）
- `is_admin`：是否为博主评论（1=是）
- `pinned`：是否置顶（1=是）
- `liked`：点赞数

---

#### POST /api/comments

提交评论。

**请求体：**
```json
{
  "page": "/posts/20260806/",
  "parent_id": 0,
  "depth": 0,
  "nickname": "访客",
  "email": "user@example.com",
  "website": "https://example.com",
  "content": "评论内容"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | string | 是 | 文章路径 |
| parent_id | number | 否 | 父评论 ID，默认 0 |
| depth | number | 否 | 嵌套层级，默认 0，最大 2 |
| nickname | string | 是 | 昵称，最大 30 字符 |
| email | string | 否 | 邮箱（用于头像） |
| website | string | 否 | 个人网站 |
| content | string | 是 | 评论内容，最大 2000 字符 |

**博主自动标识：**
当 `nickname === "Moriefy"` 且 `email === "3518972914@qq.com"` 时，`is_admin` 自动设为 1。

**响应：**
```json
{
  "ok": true,
  "id": 1,
  "status": "approved",
  "is_admin": 1,
  "message": "评论已发布"
}
```

**频率限制：** 同一 IP 每分钟最多 5 条评论。

---

#### POST /api/comments/:id/like

点赞评论。

**响应：**
```json
{ "ok": true, "liked": 6 }
```

**限制：** 同一 IP 对同一评论只能点赞一次。

---

### 2.2 管理接口（需要认证）

所有管理接口都需要 `Authorization: Bearer {token}` 请求头。

---

#### POST /api/admin/auth

登录认证。

**请求体：**
```json
{ "password": "your_password" }
```

**响应（成功）：**
```json
{
  "ok": true,
  "token": "1691234567890.abc123def456...",
  "message": "密码已设置"  // 首次登录时
}
```

**响应（失败）：**
```json
{ "error": "密码错误" }
```

**特殊行为：** 首次登录时会自动设置密码。

---

#### GET /api/admin/verify

验证 Token 是否有效。

**响应：**
```json
{ "ok": true }  // 或 { "ok": false }
```

---

#### GET /api/admin/setup/status

检查是否已设置密码（无需认证）。

**响应：**
```json
{ "passwordSet": true }
```

---

#### GET /api/admin/github-test

测试 GitHub Token 是否有效（需要管理员认证）。

**响应（成功）：**
```json
{
  "ok": true,
  "repo": "Moriefy/Blog_Astro",
  "private": true,
  "pushAccess": true
}
```

**响应（失败）：**
```json
{
  "ok": false,
  "status": 401,
  "error": "Bad credentials"
}
```

---

#### POST /api/admin/password

修改密码。

**请求体：**
```json
{
  "old_password": "当前密码",
  "new_password": "新密码"
}
```

**验证：**
- 新密码至少 6 位
- 旧密码必须正确

---

### 2.3 文章管理

#### GET /api/admin/articles

获取文章列表。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 筛选状态：`all`、`published`、`draft` |

**响应：**
```json
{
  "articles": [
    {
      "id": 1,
      "slug": "20260806-api-wiki",
      "title": "文章标题",
      "date": "2026-08-06",
      "tags": "[\"标签1\",\"标签2\"]",
      "category": "tech",
      "excerpt": "摘要",
      "status": "published",
      "pinned": 0,
      "created_at": "2026-08-06 12:00:00",
      "updated_at": "2026-08-06 12:00:00"
    }
  ]
}
```

**注意：** `tags` 字段是 JSON 字符串，需要客户端解析。

---

#### GET /api/admin/articles/:id

获取单篇文章详情。

**响应：**
```json
{
  "article": {
    "id": 1,
    "slug": "20260806-api-wiki",
    "title": "文章标题",
    "date": "2026-08-06",
    "tags": "[\"标签1\",\"标签2\"]",
    "category": "tech",
    "excerpt": "摘要",
    "content": "Markdown 正文内容...",
    "status": "published",
    "pinned": 0,
    "created_at": "2026-08-06 12:00:00",
    "updated_at": "2026-08-06 12:00:00"
  }
}
```

---

#### POST /api/admin/articles

创建文章。

**请求体：**
```json
{
  "title": "文章标题",
  "date": "2026-08-06",
  "slug": "custom-slug",
  "tags": ["标签1", "标签2"],
  "category": "tech",
  "excerpt": "摘要",
  "content": "Markdown 正文",
  "status": "draft",
  "pinned": false
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 文章标题 |
| date | string | 否 | 日期，默认今天 |
| slug | string | 否 | 自定义 URL 后缀，默认自动生成 |
| tags | array | 否 | 标签数组 |
| category | string | 否 | 分类 slug |
| excerpt | string | 否 | 摘要 |
| content | string | 是 | Markdown 正文 |
| status | string | 否 | `draft` 或 `published`，默认 `draft` |
| pinned | boolean | 否 | 是否置顶 |

**Slug 生成规则：**
- 有自定义 slug：`{日期前缀}-{slug}`，如 `20260806-custom-slug`
- 无自定义 slug：`{日期前缀}-{标题}`，如 `20260806-文章标题`
- 日期前缀格式：`YYYYMMDD`

**GitHub 同步：** 创建时自动推送到 GitHub 仓库。

**响应：**
```json
{
  "ok": true,
  "id": 1,
  "slug": "20260806-custom-slug",
  "github": { "ok": true }
}
```

**注意：** `github` 字段反映 GitHub 同步结果。如果 `github.ok` 为 `false`，`github.error` 包含错误信息（如 `"GITHUB_TOKEN not set in Worker env"`）。

---

#### PUT /api/admin/articles/:id

更新文章。

**请求体：** 同创建，所有字段可选。

**GitHub 同步：** 更新时自动推送到 GitHub。

**响应：**
```json
{
  "ok": true,
  "github": { "ok": true }
}
```

---

#### DELETE /api/admin/articles/:id

删除文章（移到回收站）。

**执行顺序：**
1. 文章数据存入 trash 表
2. 从 articles 表删除
3. 从 GitHub 仓库删除对应 `.md` 文件

**响应：**
```json
{
  "ok": true,
  "github": { "ok": true }
}
```

**注意：** 如果 GitHub 删除失败（如 Token 无效），文章仍会从 D1 移入回收站，但 `github.ok` 为 `false`。

---

#### POST /api/admin/articles/:id/publish

发布/下架文章。

**逻辑：**
- `published` → `draft`：从 GitHub 删除文件，D1 保留为草稿
- `draft` → `published`：推送到 GitHub

**响应：**
```json
{
  "ok": true,
  "status": "published",
  "github": { "ok": true }
}
```

---

### 2.4 评论管理

#### GET /api/admin/comments

获取评论列表（管理后台用）。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| page_slug | string | 按文章筛选 |
| limit | number | 每页数量，默认 50 |
| offset | number | 偏移量 |

**响应：**
```json
{
  "comments": [...],
  "total": 100,
  "pages": ["/posts/20260801/", "/posts/20260802/"]
}
```

**注意：** `pages` 字段包含所有有评论的文章路径列表。

---

#### POST /api/admin/comments

管理员发评论。

**请求体：**
```json
{
  "page": "/posts/20260806/",
  "parent_id": 0,
  "depth": 0,
  "nickname": "Moriefy",
  "email": "3518972914@qq.com",
  "website": "https://pluslogic.eu.org",
  "content": "评论内容"
}
```

**特殊行为：** 管理员发的评论自动 `is_admin = 1`。

---

#### DELETE /api/admin/comments/:id

删除评论（软删除，status 改为 `deleted`）。

---

#### POST /api/admin/comments/:id/like

管理员点赞。

---

#### POST /api/admin/comments/:id/pin

置顶/取消置顶评论。

**响应：**
```json
{ "ok": true, "pinned": 1 }  // 1=已置顶, 0=已取消
```

---

#### GET /api/admin/comments/export

导出所有评论为 JSON 文件。

---

#### POST /api/admin/comments/import

导入评论。

**请求体：** 评论对象数组。

---

### 2.5 友链管理

#### GET /api/admin/friends

获取友链列表。

**响应：**
```json
{
  "friends": [
    {
      "id": 1,
      "name": "站点名",
      "url": "https://example.com",
      "avatar": "https://example.com/avatar.png",
      "desc": "描述",
      "sort": 0
    }
  ]
}
```

---

#### POST /api/admin/friends

添加友链。

**请求体：**
```json
{
  "name": "站点名",
  "url": "https://example.com",
  "avatar": "https://example.com/avatar.png",
  "desc": "描述",
  "sort": 0
}
```

---

#### PUT /api/admin/friends/:id

更新友链。

---

#### DELETE /api/admin/friends/:id

删除友链。

---

### 2.6 回收站

#### GET /api/admin/trash

获取回收站列表。

**响应：**
```json
{
  "trash": [
    {
      "id": 1,
      "original_id": 1,
      "type": "article",
      "title": "文章标题",
      "slug": "20260806-slug",
      "data": "{...完整文章JSON...}",
      "deleted_at": "2026-08-06 12:00:00"
    }
  ]
}
```

---

#### POST /api/admin/trash/:id/restore

恢复文章。

**执行顺序：**
1. 从 trash 表读取 data 字段
2. 重新插入 articles 表
3. 如果原状态为 published，推送到 GitHub
4. 从 trash 表删除

**响应：**
```json
{ "ok": true }
```

---

#### DELETE /api/admin/trash/:id

彻底删除单条。

---

#### DELETE /api/admin/trash

清空回收站。

---

### 2.7 图片管理

#### POST /api/admin/images/upload

上传图片。

**请求体：**
```json
{
  "data": "base64编码的图片数据",
  "name": "image.png",
  "folder": "2026/08"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| data | string | 是 | Base64 编码的图片数据（不含 data:image 前缀） |
| name | string | 是 | 文件名 |
| folder | string | 否 | 目录路径，默认按当前日期生成 `YYYY/MM` |

**支持格式：** jpg, jpeg, png, gif, webp, svg, ico

**文件名处理：** 非字母数字字符替换为下划线

**存储路径：** `static/images/{folder}/{name}`

**响应：**
```json
{
  "ok": true,
  "url": "https://pluslogic.eu.org/images/2026/08/image.png",
  "path": "static/images/2026/08/image.png"
}
```

**注意：** 上传后需要等待 Vercel 重新部署，图片才能通过 CDN 访问（约 15-60 秒）。

---

#### GET /api/admin/images/list

列出图片和文件夹。

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| folder | string | 目录路径，为空则列出根目录 |

**响应：**
```json
{
  "images": [
    {
      "name": "image.png",
      "url": "/images/2026/08/image.png",
      "size": 12345,
      "sha": "abc123..."
    }
  ],
  "folders": ["2026", "avatars"]
}
```

**注意：** `url` 是相对路径，完整 URL 需要拼接 `https://pluslogic.eu.org`。

---

#### POST /api/admin/images/copy

复制或移动图片文件。所有操作在 Worker 和 GitHub API 之间直接完成，不经过前端中转 base64。

**请求体：**
```json
{
  "srcPath": "2026/08/image.png",
  "destFolder": "2026/09",
  "mode": "copy"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| srcPath | string | 是 | 源文件路径（相对于 `static/images/`） |
| destFolder | string | 否 | 目标文件夹，空字符串表示根目录 |
| mode | string | 是 | `copy`（复制）或 `cut`（移动） |

**执行逻辑：**
1. 从 GitHub 读取源文件（保留原始 base64）
2. 检查目标路径是否已存在（存在则更新）
3. 写入目标路径
4. 如果 mode 为 `cut`，删除源文件

**响应：**
```json
{
  "ok": true,
  "url": "/images/2026/09/image.png",
  "name": "image.png"
}
```

**错误响应：**
```json
{ "error": "源文件不存在" }
{ "error": "写入失败: ..." }
```

---

#### DELETE /api/admin/images/:path

删除图片。

**路径示例：** `/api/admin/images/2026/08/image.png`

**实际删除：** `static/images/2026/08/image.png`

---

#### DELETE /api/admin/images/folder/:path

删除文件夹及其所有内容。

**路径示例：** `/api/admin/images/folder/2026/08`

**逻辑：** 列出文件夹内所有文件，逐个删除。

---

#### GET /api/admin/images/references/:url

查找引用某张图片的文章。

**路径示例：** `/api/admin/images/references/https://pluslogic.eu.org/images/2026/08/image.png`

**逻辑：** 用文件名模糊匹配所有文章的 content 字段。

**响应：**
```json
{
  "articles": [
    {
      "id": 1,
      "title": "文章标题",
      "slug": "20260806-slug"
    }
  ]
}
```

---

### 2.8 其他接口

#### GET /api/admin/stats

获取统计数据。

**响应：**
```json
{
  "articles": 20,
  "published": 15,
  "drafts": 5,
  "comments": 100,
  "friends": 7,
  "trash": 3
}
```

---

#### POST /api/admin/import-from-github

从 GitHub 仓库导入所有文章到 D1。

**逻辑：**
- 获取 `content/blog/` 目录下所有 `.md` 文件
- 解析 frontmatter 和正文
- upsert 到 articles 表

**响应：**
```json
{ "ok": true, "imported": 20 }
```

---

#### GET /api/admin/export

导出全站数据（文章 + 评论 + 友链）。

**响应：** JSON 文件下载。

---

### 2.9 GitHub Webhook

#### POST /api/webhook/github

接收 GitHub push event。

**验证：** HMAC-SHA256 签名（`WEBHOOK_SECRET` 环境变量）

**逻辑：**
- 解析 commits 中的 added 和 modified 文件
- 只处理 `content/blog/*.md` 文件
- 对每个文件：获取内容 → 解析 frontmatter → upsert D1
- 不处理 removed 文件（下架由管理接口处理）

---

## 三、数据结构

### 3.1 articles 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| slug | TEXT | URL 唯一标识 |
| title | TEXT | 标题 |
| date | TEXT | 日期（YYYY-MM-DD） |
| tags | TEXT | 标签 JSON 字符串 |
| category | TEXT | 分类 slug |
| excerpt | TEXT | 摘要 |
| content | TEXT | Markdown 正文 |
| status | TEXT | `published` 或 `draft` |
| pinned | INTEGER | 是否置顶 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 3.2 comments 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| page_slug | TEXT | 文章路径 |
| parent_id | INTEGER | 父评论 ID |
| depth | INTEGER | 嵌套层级 |
| nickname | TEXT | 昵称 |
| email | TEXT | 邮箱 |
| website | TEXT | 网站 |
| avatar_hash | TEXT | 邮箱 MD5 |
| content | TEXT | 原始内容 |
| content_html | TEXT | 渲染后 HTML |
| ip | TEXT | IP 地址 |
| user_agent | TEXT | 浏览器 UA |
| status | TEXT | `approved` 或 `deleted` |
| is_admin | INTEGER | 是否博主 |
| pinned | INTEGER | 是否置顶 |
| liked | INTEGER | 点赞数 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 3.3 friends 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| name | TEXT | 站点名 |
| url | TEXT | 链接 |
| avatar | TEXT | 头像 URL |
| desc | TEXT | 描述 |
| sort | INTEGER | 排序权重 |

### 3.4 trash 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| original_id | INTEGER | 原始 ID |
| type | TEXT | 类型（`article`） |
| title | TEXT | 标题 |
| slug | TEXT | URL 标识 |
| data | TEXT | 完整数据 JSON |
| deleted_at | TEXT | 删除时间 |

### 3.5 admin_config 表

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT | 配置键名 |
| value | TEXT | 配置值 |

**已知键：** `password_hash`（密码 SHA256 哈希）

---

## 四、安卓客户端开发指南

### 4.1 认证流程

```
1. 用户输入密码
2. POST /api/admin/auth → 获取 token
3. 本地存储 token（SharedPreferences）
4. 后续请求携带 Authorization: Bearer {token}
5. Token 过期（7天）后重新登录
```

### 4.2 文章编辑器

**Markdown 编辑器组件：**
- 支持实时预览
- 工具栏：加粗、斜体、代码块、标题、链接、图片
- 图片上传：调用 `/api/admin/images/upload`，插入完整 URL

**自动保存：**
- 每 5 秒保存到本地
- 每 1 分钟同步到 D1
- 发布后停止自动保存

### 4.3 图片管理

**上传流程：**
```
1. 选择图片 → 转 Base64
2. POST /api/admin/images/upload → 获取 URL
3. 在编辑器中插入 ![alt](url)
```

**浏览流程：**
```
1. GET /api/admin/images/list → 获取文件夹和图片列表
2. 点击文件夹 → 带 folder 参数重新请求
3. 点击图片 → 预览大图
```

**复制/移动流程：**
```
1. GET /api/admin/images/list → 浏览到目标文件夹
2. POST /api/admin/images/copy {
     srcPath: "2026/08/image.png",
     destFolder: "2026/09",
     mode: "copy"  // 或 "cut"
   }
3. 刷新列表
```

**删除流程：**
```
1. 确认删除
2. DELETE /api/admin/images/{path}
3. 刷新列表
```

### 4.4 评论管理

**置顶/取消置顶：**
```
POST /api/admin/comments/{id}/pin
```

**回复评论：**
```
POST /api/admin/comments
{
  "page": "文章路径",
  "parent_id": 父评论ID,
  "depth": 父评论depth+1,
  "nickname": "Moriefy",
  "email": "3518972914@qq.com",
  "website": "配置的网站",
  "content": "回复内容"
}
```

### 4.5 图片 URL 规范

**存储路径：** `static/images/{year}/{month}/{filename}`
**CDN URL：** `https://pluslogic.eu.org/images/{year}/{month}/{filename}`
**文章引用：** `![描述](https://pluslogic.eu.org/images/2026/08/xxx.png)`

### 4.6 GitHub 同步状态检查

所有涉及 GitHub 操作的接口（文章创建/更新/删除/发布、图片复制/移动）都会在响应中返回 `github` 字段：

```json
{
  "ok": true,
  "github": { "ok": true }
}
```

如果 GitHub 同步失败：
```json
{
  "ok": true,
  "github": { "ok": false, "error": "GITHUB_TOKEN not set in Worker env" }
}
```

**建议：** 客户端应检查 `github.ok`，如果为 `false`，提示用户 GitHub 同步失败但本地操作已成功。

### 4.7 错误处理

所有接口错误响应格式：
```json
{ "error": "错误信息" }
```

常见状态码：
- 200：成功
- 201：创建成功
- 400：请求参数错误
- 401：未授权（Token 无效或过期）
- 404：资源不存在
- 429：频率限制
- 500：服务器错误

---

## 五、环境变量

| 变量名 | 说明 |
|--------|------|
| ADMIN_TOKEN | HMAC 签名密钥 |
| GITHUB_TOKEN | GitHub Personal Access Token（需要 `repo` 权限） |
| GITHUB_REPO | GitHub 仓库名，默认 `Moriefy/Blog_Astro` |
| WEBHOOK_SECRET | GitHub Webhook 签名密钥 |

---

## 六、D1 数据库结构

完整建表 SQL：

```sql
-- 文章
CREATE TABLE IF NOT EXISTS articles(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  title TEXT,
  date TEXT,
  tags TEXT,
  category TEXT,
  excerpt TEXT,
  content TEXT,
  status TEXT DEFAULT 'published',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 评论
CREATE TABLE IF NOT EXISTS comments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug TEXT NOT NULL,
  parent_id INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  nickname TEXT NOT NULL,
  email TEXT,
  website TEXT,
  avatar_hash TEXT,
  content TEXT NOT NULL,
  content_html TEXT,
  ip TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'approved',
  is_admin INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  liked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 友链
CREATE TABLE IF NOT EXISTS friends(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  url TEXT,
  avatar TEXT,
  desc TEXT,
  sort INTEGER DEFAULT 0
);

-- 回收站
CREATE TABLE IF NOT EXISTS trash(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id INTEGER,
  type TEXT,
  title TEXT,
  slug TEXT,
  data TEXT,
  deleted_at TEXT DEFAULT (datetime('now'))
);

-- 配置
CREATE TABLE IF NOT EXISTS admin_config(
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 点赞记录
CREATE TABLE IF NOT EXISTS likes(
  comment_id INTEGER NOT NULL,
  ip TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, ip)
);

-- 频率限制
CREATE TABLE IF NOT EXISTS rate_limits(
  ip TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 七、CORS 配置

所有接口都允许跨域访问：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

OPTIONS 请求直接返回 204。

---

## 八、注意事项

1. **Token 安全：** Token 有效期 7 天，过期需重新登录
2. **图片上传：** Base64 数据不含 `data:image/xxx;base64,` 前缀
3. **图片 URL：** 返回的是完整 URL，可直接在 Markdown 中使用
4. **标签格式：** 文章标签是 JSON 字符串，需要客户端解析
5. **评论嵌套：** 最多 2 层嵌套（depth 0、1、2）
6. **博主标识：** 昵称 `Moriefy` + 邮箱 `3518972914@qq.com` 自动标识
7. **Webhook：** GitHub push event 触发时，只同步 added/modified 文件，不处理 removed
8. **频率限制：** 评论接口每 IP 每分钟 5 次
9. **GitHub 同步：** 所有文章和图片操作都会同步到 GitHub，响应中的 `github` 字段反映同步状态
10. **图片复制/移动：** 使用 `POST /api/admin/images/copy`，不经过前端中转 base64，避免数据损坏
11. **图片 CDN 延迟：** 上传/复制后需等待 Vercel 重新部署（约 15-60 秒），图片才能通过公网 URL 访问
