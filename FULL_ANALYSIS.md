# Haprial 博客系统 — 全面深度分析

> 逐行级代码分析 + 文件关系体系 + 底层原理

---

## 一、项目总览

**Haprial** 是一个零依赖的静态博客生成器，由 Moriefy 开发。整个系统由以下几层构成：

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  index.html  │  │ posts/*/     │  │  admin/       │   │
│  │  (SPA 主页)  │  │ (独立文章页)  │  │  (管理后台)    │   │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘   │
│         │                │                   │           │
│  ┌──────┴────────────────┴───────────────────┘           │
│  │  theme/app.js        ← SPA 路由 + UI 逻辑            │
│  │  theme/styles.css     ← Material Design 3 样式        │
│  │  theme/lightbox.js    ← 图片灯箱                      │
│  │  theme/comments.js    ← 评论系统前端                   │
│  └──────────────────────┬───────────────────────────────┘
│                         │ fetch API                       │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│              Cloudflare Worker (worker/index.js)           │
│  ┌──────────────────────┴──────────────────────────────┐  │
│  │  /api/comments       ← 公开评论读写                   │  │
│  │  /api/admin/*        ← 管理后台 API                   │  │
│  │  /api/webhook/github ← GitHub Webhook 自动同步        │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│  ┌──────────────────────┴──────────────────────────────┐  │
│  │  Cloudflare D1 (SQLite)  ← 数据持久化                 │  │
│  │  tables: comments, articles, friends, trash,         │  │
│  │          likes, rate_limits, admin_config             │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │ GitHub API                       │
│  ┌──────────────────────┴──────────────────────────────┐  │
│  │  GitHub Repo (Moriefy/Blog_Astro)                    │  │
│  │  content/blog/*.md  ← 文章源文件                      │  │
│  │  static/images/     ← 图片资源                        │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│              Vercel (静态站点托管)                           │
│  dist/                ← build.js 生成的静态文件             │
│  vercel.json          ← 部署配置 + 安全头 + CSP            │
└───────────────────────────────────────────────────────────┘
```

---

## 二、文件逐一分析

### 2.1 配置层

#### `package.json`
```json
{
  "name": "haprial",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node build.js",
    "dev": "node build.js && cd dist && npx serve"
  }
}
```
- **零依赖**：没有任何 dependencies，只用 Node.js 内置模块（fs, path, crypto, https）
- 构建命令就是 `node build.js`，开发用 `npx serve` 预览

#### `site.config.json`
- 站点元数据：标题、描述、URL、作者、bio
- 技能标签、社交链接、分类定义、友链列表
- 评论系统配置：`provider: "custom"`, `api: "https://comments.pluslogic.eu.org"`
- **所有内容硬编码在这个 JSON 中**，build.js 读取后注入 HTML

#### `vercel.json`
- `cleanUrls: true`, `trailingSlash: true` — URL 美化
- 安全头：CSP（限制脚本/样式/图片/连接来源）、X-Frame-Options: DENY、nosniff
- 主题文件设为 immutable 长缓存，HTML 设为 must-revalidate

#### `.gitignore`
- 忽略 `node_modules/`, `dist/`, `.build-cache.json`, `.recycle/`, `worker/.wrangler/`

---

### 2.2 构建层 — `build.js`（~700行）

这是整个系统的心脏。**零依赖、纯 Node.js** 的静态站点生成器。

#### 核心流程：

```
1. 读取 site.config.json
2. 计算全局指纹 (getGlobalFingerprint)
3. 增量加载文章 (loadArticles) — MD5 缓存命中则跳过解析
4. 计算标签/分类 (computeTags, computeCats)
5. 读取 CSS 内联到 index.html（消除 FOUC）
6. 生成 index.html（SPA 主页，包含所有文章元数据）
7. 为每篇文章生成 posts/{id}/index.html + article.json
8. 生成 SEO 独立页面：tags/, categories/, archive/, friends/, about/
9. 复制 theme/ 和 static/ 到 dist/
10. 生成 sitemap.xml, robots.txt, rss.xml, 404.html
11. 复制 admin/ 到 dist/
12. 异步同步到 D1（如果设置了 ADMIN_PASSWORD 环境变量）
13. 保存构建缓存
```

#### 关键设计决策：

**增量构建缓存**：
```javascript
function getGlobalFingerprint() {
  // 对影响每个页面的文件计算 MD5
  const files = ['site.config.json', 'styles.css', 'app.js', 'build.js', ...];
  const h = crypto.createHash('md5');
  files.forEach(f => h.update(fs.readFileSync(f)));
  return h.digest('hex');
}
```
- 每篇文章单独缓存：文件 MD5 + 全局指纹
- 命中缓存时跳过 Markdown 解析，直接复用 article 对象

**文章 ID 生成**：
```javascript
let slug = dateVal ? dateVal.replace(/-/g, '') : id_guess;
// 碰撞处理：追加文件名后缀
if (articles[slug]) {
  const fileSuffix = file.replace(/^\d{8}-/, '').replace(/\.md$/, '');
  slug = slug + '-' + fileSuffix;
}
```
- 优先用日期作为 slug（如 `20260815`）
- 碰撞时追加文件名后缀（如 `20260815-deep-listening`）

**阅读时间计算**：
```javascript
const cnChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
const enWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
const totalMin = Math.ceil((cnChars / 400) + (enWords / 200));
```
- 中文按 400字/分钟，英文按 200词/分钟

**TOC 自动生成**：
```javascript
if (a.content.includes('id="md-toc-auto"')) {
  // 从 HTML 中提取 h2/h3 标题，生成目录
}
```
- 文章中写 `[TOC]` 会触发自动目录生成

**数据传递给前端**：
```javascript
const dataObj = {
  siteTitle, siteAuthor, comments,
  articleOrder,  // 排序后的文章 ID 数组
  articles: articlesMeta,  // 文章元数据（不含 content）
  allTags, cats, catMap, friends
};
// 内联到 index.html 的 <script> 中
window.__HAPRIAL_DATA__ = ${JSON.stringify(dataObj)};
```
- **文章内容不内联**，通过 `article.json` 按需加载
- 只内联元数据（标题、日期、标签、摘要等）

**文章页面生成**：
```javascript
function buildPostHtml(id, art, config, opts) {
  // 独立的完整 HTML，不依赖 SPA
  // 包含完整的 meta/OG/JSON-LD 结构化数据
  // 包含前后文章导航
  // 包含侧边栏 TOC
  // 包含评论区
}
```
- 每篇文章有独立的 `index.html`（SEO 友好）和 `article.json`（SPA 懒加载用）

**SEO 页面**：
- `/tags/index.html` — 标签页，包含每个标签下的文章列表
- `/categories/index.html` — 分类页
- `/archive/index.html` — 归档页（按年分组）
- `/friends/index.html` — 友链页
- `/about/index.html` — 关于页
- 这些是**真正的静态页面**，不是重定向，确保搜索引擎可索引

**D1 同步**（`syncToD1`）：
- 如果设置了 `ADMIN_PASSWORD` 环境变量，构建完成后自动同步文章和友链到 D1
- 通过 Worker API 完成

---

### 2.3 Markdown 解析层 — `lib/markdown.js`（~450行）

**完全自研的零依赖 Markdown 解析器**，支持：

#### `parseFrontMatter(src)` — Front Matter 解析
```javascript
// 支持两种格式：
// key: "value"    — 带引号
// key: value      — 不带引号
// key: [...]      — JSON 数组
```

#### `mdInline(text, footnotes)` — 行内元素解析
处理顺序（重要！）：
1. `\$` → `$`（转义美元符号）
2. `<br>` → 占位符（保护换行）
3. `![alt](src)` → 图片占位符（保护图片不被 HTML 转义破坏）
4. `$...$` → 数学公式占位符（保护公式）
5. HTML 转义（`& < > "`）— **XSS 防护**
6. 恢复 `<br>`
7. `***bold italic***` → `<strong><em>`
8. `**bold**` → `<strong>`
9. `*italic*` → `<em>`
10. `~~strike~~` → `<del>`
11. `` `code` `` → `<code>`
12. `[^footnote]` → 脚注引用
13. `[text](url)` → 链接（外部链接自动 `target="_blank"`）
14. 恢复图片、数学公式

**图片处理的特殊逻辑**：
```javascript
if (isUnsplash) {
  // 自动添加 srcset 响应式图片
  srcset = ' srcset="' + baseUrl + '?w=400 400w, ...';
  // 自动计算 width/height（避免 CLS）
  dimAttr = ' width="' + w + '" height="' + h + '"';
}
```

#### `mdToHtml(src)` — 块级元素解析

状态机设计：
```javascript
let inCodeBlock = false;   // ``` 代码块
let inList = false;         // 列表
let inTable = false;        // 表格
let inBlockquote = false;   // 引用块
let inDefList = false;      // 定义列表
let inHtmlBlock = false;    // 原始 HTML 块
```

支持的语法：
- 标题（h1-h6），支持自定义 ID：`## Title {#custom-id}`
- 代码块（围栏式 + 缩进式），支持语言标识
- **Mermaid 图表**：` ```mermaid ` → `<div class="mermaid-block" data-code="...">`
- 数学公式：`$$...$$`（块级）和 `$...$`（行内）
- `[TOC]` 目录指令
- 引用块、有序/无序列表、任务列表
- 表格（带对齐）
- 定义列表（`:` 前缀）
- 脚注
- 原始 HTML 透传

**XSS 防护**：
- 所有用户输入在 `mdInline` 中先 HTML 转义
- 图片 URL 直接使用（信任 Markdown 作者）
- 外部链接自动加 `rel="noopener"`

---

### 2.4 前端 SPA 层 — `theme/app.js`（~552行）

这是前端的核心，实现了**完整的单页应用**。

#### 架构概览：

```
SPA 路由系统 (Hash-based)
├── 页面切换（articles/tags/categories/archive/friends/about）
├── 文章打开/关闭（全屏覆盖层）
├── 搜索（全屏覆盖层）
├── 分页
├── 标签/分类筛选
└── 历史记录管理 (pushState/replaceState)
```

#### 路由系统：

```javascript
// Hash 解析
function parseHash() {
  // '#/' → { type: 'page', page: 'articles' }
  // '#/posts/20260815' → { type: 'article', articleId: '20260815' }
  // '#/page/2' → { type: 'page', page: 'articles', paginationPage: 1 }
  // '#/tags' → { type: 'page', page: 'tags' }
}

// SEO 更新
function updateSEO(route) {
  // 切换 title, meta description, og:title, og:description
  // 文章页动态添加 JSON-LD 结构化数据
}
```

#### 文章加载流程：

```javascript
function loadArticle(id) {
  1. 显示骨架屏（skeleton loader）
  2. fetch('/posts/' + id + '/article.json')
  3. 渲染内容到 articleBody
  4. 延迟 80ms 后构建 TOC
  5. 处理代码块（Prism.js 语法高亮）
  6. 处理图片懒加载
  7. 处理 Mermaid 图表
  8. 初始化评论区
  9. 预取相邻文章
}
```

**内容缓存**：
```javascript
var _contentCache = {};  // id → HTML
var _cacheOrder = [];    // LRU 顺序
var _cacheMax = 10;      // 最多缓存 10 篇
```

**悬停预取**：
```javascript
document.addEventListener('mouseover', function(e) {
  var card = e.target.closest('.card[data-id]');
  // 鼠标悬停 150ms 后开始预取文章内容
  _hoverTimer = setTimeout(function() { prefetchArticle(hid) }, 150);
});
```

#### Mermaid 图表渲染：

内置了一个**轻量级 Mermaid 替代方案**，支持：
- 流程图（graph TD/LR/RL/BT）
- 时序图（sequenceDiagram）
- 饼图（pie）

```javascript
function renderFlowGraph(lines) {
  // 1. 解析节点和边
  // 2. 计算层级布局（depth-based）
  // 3. 生成 SVG
  // 4. 添加缩放/拖拽交互
}
```

**缩放交互**：
- 放大/缩小按钮
- 鼠标拖拽平移
- 触摸拖拽（移动端）
- Ctrl+Click 放大，Shift+Click 缩小

#### 主题切换：

```javascript
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('th', t);
  syncAllIcons(t);  // 更新所有太阳/月亮图标
}
```
- 支持 `prefers-color-scheme` 系统偏好检测
- localStorage 持久化

#### 代码块处理：

```javascript
function processCodeBlocks() {
  // 1. 动态加载 Prism.js CSS + JS
  // 2. 包装为 .code-block 容器
  // 3. 添加语言标签 + 复制按钮
  // 4. 添加行号
  // 5. Prism 语法高亮
}
```

#### 键盘快捷键：

```javascript
// Escape — 关闭灯箱/搜索/文章
// ← → — 切换文章（文章打开时）
// / — 打开搜索
// 评论输入时禁用所有快捷键
```

---

### 2.5 样式层 — `theme/styles.css`（~544行）

**Material Design 3 设计系统**的完整实现。

#### 设计 Token：

```css
[data-theme="light"] {
  --primary: #3D5A6E;          /* 深蓝灰主色 */
  --on-primary: #fff;
  --primary-container: #D4DDE3;
  --surface: #FFFFFF;
  --on-surface: #1C1C1E;
  --outline-variant: #D4D5D7;
  /* ... 20+ 设计变量 */
}

[data-theme="dark"] {
  --primary: #9AB0BF;          /* 暗色模式主色 */
  --surface: #191B1D;
  /* ... */
}
```

#### 字体系统：

```css
/* 标题/装饰：Cormorant Garamond（衬线体） */
/* 中文正文：Noto Sans SC + LXGW WenKai（文艺楷体） */
/* 代码：JetBrains Mono */
```

#### 响应式断点：

```css
@media(max-width:1200px) { /* 隐藏侧边 TOC，显示 TOC 按钮 */ }
@media(max-width:768px)  { /* 移动端优化 */ }
@media(max-width:480px)  { /* 小屏手机 */ }
```

#### 动画系统：

```css
/* 减少动画支持 */
@media(prefers-reduced-motion:reduce) {
  .ripple,.card,.tag-card,... { animation:none!important }
  .si,.article-body>*,... { transition:none!important }
}
```

- 页面切换：slideIn/slideOut
- 卡片入场：fadeUp
- 英雄区：heroReveal
- 骨架屏：skelShimmer
- 灯箱：lbEnterAnim
- 涟漪：ripExpand

---

### 2.6 灯箱 — `theme/lightbox.js`（~380行）

**独立的图片灯箱模块**，通过 `window.__initLightbox` 暴露。

功能：
- 图片点击打开
- 左右滑动/键盘切换
- 双指缩放（移动端）
- 鼠标滚轮缩放
- 拖拽平移（缩放后）
- 图片计数器
- 图片说明（figcaption）
- 下载按钮
- 定位按钮（关闭灯箱并滚动到图片位置）
- 历史记录集成（返回键关闭灯箱）

---

### 2.7 评论系统 — `theme/comments.js` + `theme/comments.css`

**自研评论系统前端**，零依赖。

#### `comments.js` 核心：

```javascript
function CS(el, opts) {
  this.api = opts.api;   // 'https://comments.pluslogic.eu.org'
  this.page = opts.page;  // '/posts/20260815/'
  this._build();
}
```

功能：
- 评论列表加载（树形结构）
- 发表评论（昵称、邮箱、网站、内容）
- 回复评论（最大深度 2）
- 点赞（localStorage 去重）
- 长评论折叠/展开
- 草稿自动保存（localStorage）
- 昵称/邮箱/网站记忆
- 管理员标识（艾德密 badge）
- 置顶评论
- 焦点追踪（防止键盘快捷键冲突）
- 超时重试机制

#### `comments.css`：
- MD3 风格表单
- 嵌套回复缩进
- Toast 提示
- 加载动画

---

### 2.8 Twikoo 适配 — `theme/twikoo-custom.css`

为 Twikoo 评论系统提供 MD3 风格覆盖。虽然当前使用自研评论系统，但保留了 Twikoo 的样式兼容。

---

### 2.9 404 页面 — `src/404.html`

独立的 404 页面，包含：
- 完整的 MD3 样式（不依赖外置 CSS）
- 主题切换功能
- 涟漪动画
- 大号 "404" 装饰文字

---

### 2.10 管理后台 — `admin/`

#### `admin/index.html`
- 登录页 + 主应用布局
- 侧边栏导航（桌面）+ 底部导航（移动）
- 弹窗 + Toast 组件

#### `admin/styles.css`
- MD3 统一设计系统
- 按钮规格：h40, px24, r20
- 输入框规格：h40, px16, r8
- 响应式：桌面侧边栏 + 移动底部导航

#### `admin/app.js`（~900行）

完整的博客管理后台 SPA：

**路由**：Hash-based，支持 /, /articles, /editor, /editor/:id, /comments, /friends, /images, /trash, /settings

**功能模块**：
1. **仪表盘**：统计卡片（已发布/草稿/评论/友链/回收站）
2. **文章管理**：列表 + 筛选（状态/年份/分类/标签/搜索）+ 分页
3. **编辑器**：
   - 标题/日期/分类/标签/摘要
   - Markdown 工具栏（加粗/斜体/代码/链接/图片...）
   - 实时预览（双栏布局）
   - 滚动同步
   - 图片上传（base64 → GitHub）
   - 自动保存（5s 本地 + 60s D1）
   - 快捷键（Ctrl+S/B/I, Tab 缩进）
4. **评论管理**：两栏布局（文章列表 + 评论树）+ 回复/置顶/删除/点赞
5. **友链管理**：CRUD
6. **图片管理**：
   - 文件夹浏览
   - 上传（base64 → GitHub）
   - 复制/剪切/粘贴（跨文件夹）
   - 批量操作
   - 图片预览灯箱
   - 查找引用
   - URL 复制
7. **回收站**：恢复/彻底删除/清空
8. **设置**：修改密码、管理员评论设置、数据导入导出

---

### 2.11 Cloudflare Worker — `worker/`

#### `worker/index.js`（~700行）

完整的后端 API，运行在 Cloudflare Workers 上。

**数据库表**（D1 SQLite）：
```sql
-- comments: 评论表（嵌套回复、点赞、置顶）
-- articles: 文章表（slug 唯一、支持草稿/发布状态）
-- friends: 友链表
-- trash: 回收站（JSON 存储原始数据）
-- likes: 点赞记录（comment_id + IP 唯一）
-- rate_limits: 频率限制
-- admin_config: 管理配置（密码哈希）
```

**认证系统**：
```javascript
// 密码：SHA-256 哈希存储
// Token：HMAC-SHA256 签名，7 天有效期
// 格式：{expires}.{hmac_signature}
```

**公开 API**：
- `GET /api/comments?page=/posts/xxx/` — 获取评论
- `POST /api/comments` — 发表评论（IP 频率限制：5次/分钟）
- `POST /api/comments/:id/like` — 点赞（IP 去重）

**管理 API**（需要认证）：
- 文章 CRUD + 发布/下架
- 评论 CRUD + 置顶 + 导入导出
- 友链 CRUD
- 回收站管理
- 图片上传/列表/删除/复制/移动/文件夹管理
- 全站数据导入导出
- GitHub Webhook（自动同步）

**GitHub 集成**：
```javascript
async function githubPush(env, filePath, content, message) {
  // 1. 获取现有文件 SHA
  // 2. PUT 创建/更新文件
  // 使用 GitHub Contents API
}

async function githubDelete(env, filePath, message) {
  // 获取 SHA 后 DELETE
}
```

**GitHub Webhook**：
- 监听 push 事件
- 自动同步 `content/blog/` 下的 .md 文件到 D1
- 支持签名验证（X-Hub-Signature-256）

**Markdown 渲染**（评论用）：
```javascript
function renderMd(src) {
  // 简化版 Markdown → HTML
  // 支持：标题、代码块、引用、列表、加粗、斜体、删除线、链接、图片
  // XSS 防护：先 HTML 转义再解析
}
```

#### `worker/wrangler.toml`
```toml
name = "haprial-comments"
main = "index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "haprial-comments"
database_id = "d6bf9f4f-b099-421f-a46c-c604a3974307"

[vars]
CORS_ORIGIN = "https://pluslogic.eu.org"
# ADMIN_TOKEN — 在 Cloudflare Dashboard 中设置
```

#### `worker/schema.sql`
- comments、likes、rate_limits 表定义
- 索引：page_slug+status, parent_id, ip+action+created_at

---

### 2.12 迁移脚本 — `migrate.js`

一次性脚本，用于将本地 Markdown 文件和友链导入 D1 数据库。

```bash
node migrate.js <管理密码>
```

流程：登录 → 遍历友链 → 遍历 .md 文件 → POST 到 Worker API

---

### 2.13 内容层 — `content/blog/*.md`

38 篇文章，格式统一：

```markdown
---
title: "标题"
date: 2026-08-15
tags: ["标签1", "标签2"]
category: "think"
excerpt: "摘要"
---

正文内容（支持完整 Markdown 语法）
```

主题涵盖：心理学、技术、历史、文化、学习方法、社会观察等。

---

### 2.14 静态资源 — `static/`

```
static/
├── avatar.png          # 头像
├── favicon.svg         # SVG 图标
└── images/
    ├── 2026/03/       # 文章配图
    └── 2026/08/       # 文章配图
```

---

## 三、文件关系图谱

```
site.config.json ──────────┐
                           │
lib/markdown.js ───────────┤
  ├── parseFrontMatter()   │
  ├── mdInline()           │
  └── mdToHtml()           │
                           ▼
build.js ──────────────► dist/
  │ 读取                      ├── index.html (SPA 主页)
  │ ├── content/blog/*.md     │   ├── 内联 CSS (styles.css)
  │ ├── theme/styles.css      │   ├── 内联数据 (__HAPRIAL_DATA__)
  │ ├── theme/app.js          │   ├── theme/app.js
  │ ├── theme/lightbox.js     │   ├── theme/lightbox.js
  │ ├── theme/comments.js     │   ├── theme/comments.js
  │ ├── theme/comments.css    │   └── theme/comments.css
  │ ├── src/404.html          │
  │ └── static/               ├── posts/{id}/index.html (独立文章页)
  │                           ├── posts/{id}/article.json (SPA 懒加载)
  │                           ├── tags/index.html
  │                           ├── categories/index.html
  │                           ├── archive/index.html
  │                           ├── friends/index.html
  │                           ├── about/index.html
  │                           ├── admin/ (管理后台)
  │                           ├── sitemap.xml
  │                           ├── robots.txt
  │                           ├── rss.xml
  │                           └── 404.html
  │
  └── 同步到 D1 ──────► Cloudflare Worker
                            ├── D1 数据库
                            └── GitHub API (双向同步)

theme/app.js ◄──────────── window.__HAPRIAL_DATA__
  │
  ├── SPA 路由 (Hash-based)
  ├── 文章加载 (fetch article.json)
  ├── 代码高亮 (Prism.js CDN)
  ├── Mermaid 图表 (内置渲染)
  ├── 主题切换 (localStorage)
  ├── 搜索 (客户端)
  ├── 灯箱 (__initLightbox)
  └── 评论 (HaprialComments)

admin/app.js ─────────────► Worker API
  │
  ├── 认证 (密码 → token)
  ├── 文章 CRUD → D1 + GitHub
  ├── 评论管理 → D1
  ├── 友链管理 → D1
  ├── 图片管理 → GitHub
  └── 设置管理 → D1

worker/index.js
  ├── 公开 API (评论)
  ├── 管理 API (CRUD)
  ├── GitHub Webhook (自动同步)
  └── D1 数据库操作
```

---

## 四、底层原理总结

### 4.1 数据流

```
写作流程：
  Admin 编辑器 → POST /api/admin/articles
    → D1 存储
    → GitHub Push (content/blog/xxx.md)
    → Vercel Webhook 触发重新部署
    → build.js 生成静态页面
    → 用户看到新文章

评论流程：
  用户评论 → POST /api/comments
    → D1 存储
    → 前端 fetch 刷新评论列表

GitHub 双向同步：
  Admin 修改 → GitHub Push → Vercel 部署
  Git Push → Webhook → D1 同步
```

### 4.2 性能优化

1. **零依赖**：不引入任何 npm 包，减少攻击面和体积
2. **增量构建**：MD5 缓存，只重建变更文件
3. **CSS 内联**：消除 FOUC（Flash of Unstyled Content）
4. **文章懒加载**：SPA 模式下按需 fetch article.json
5. **内容缓存**：LRU 缓存最近 10 篇文章
6. **悬停预取**：鼠标悬停 150ms 后预取
7. **图片懒加载**：IntersectionObserver
8. **Prism.js 按需加载**：有代码块时才加载
9. **字体异步加载**：`media="print" onload="this.media='all'"`
10. **骨架屏**：加载时显示 shimmer 动画

### 4.3 安全设计

1. **XSS 防护**：Markdown 解析时先 HTML 转义
2. **CSP**：严格的内容安全策略
3. **频率限制**：评论 5次/分钟/IP
4. **认证**：HMAC-SHA256 签名 token
5. **密码哈希**：SHA-256 不可逆存储
6. **Webhook 签名**：HMAC-SHA256 验证
7. **CORS**：限制来源域名
8. **安全头**：X-Frame-Options, nosniff, strict-origin

### 4.4 SEO 策略

1. **静态 HTML**：每篇文章独立页面
2. **JSON-LD**：BlogPosting + BreadcrumbList 结构化数据
3. **Open Graph**：完整的 og:title/description/image/url
4. **Sitemap**：自动生成
5. **RSS**：自动生成
6. **robots.txt**：允许爬取
7. **canonical URL**：避免重复内容
8. **hreflang**：zh-CN 标记

### 4.5 设计系统

- **Material Design 3** 风格
- CSS 变量驱动的主题系统
- 深色/浅色模式
- 响应式（1200px / 768px / 480px）
- 减少动画支持
- 打印样式
- 焦点可见性样式

---

## 五、技术亮点

1. **自研 Markdown 解析器**：支持 Mermaid、数学公式、脚注、定义列表等高级语法
2. **内置 Mermaid 渲染**：不依赖 mermaid.js，自行解析并生成 SVG
3. **SPA + 静态页面双模式**：SPA 提供流畅体验，静态页面保证 SEO
4. **GitHub 双向同步**：Admin 修改推送到 GitHub，Git push 自动同步到 D1
5. **图片管理**：完整的文件管理器（复制/剪切/粘贴/批量操作/查找引用）
6. **增量构建**：MD5 缓存，大型博客也能秒级构建
7. **零依赖**：整个项目没有任何 npm 依赖
