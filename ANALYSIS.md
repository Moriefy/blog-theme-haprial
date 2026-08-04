# Blog_Astro (Haprial) — 全面深度分析报告

> 逐行分析 + 文件关系 + 底层原理 + 体系架构

---

## 一、项目总览

**项目名称**: Haprial  
**类型**: 零依赖静态博客生成器  
**部署**: Vercel (静态站) + Cloudflare Workers (评论后端)  
**域名**: https://pluslogic.eu.org  
**作者**: Moriefy  

### 文件清单 (57个文件)

| 层级 | 文件 | 职责 |
|------|------|------|
| **配置层** | `package.json`, `site.config.json`, `vercel.json`, `wrangler.toml` | 项目元数据、站点配置、部署规则 |
| **构建层** | `build.js`, `lib/markdown.js` | 构建引擎、Markdown 解析器 |
| **内容层** | `content/blog/*.md` (28篇) | 博客文章 (Markdown + Front Matter) |
| **表现层** | `theme/styles.css`, `theme/app.js`, `theme/lightbox.js`, `theme/comments.js`, `theme/comments.css`, `theme/post-init.js`, `theme/twikoo-custom.css` | UI 样式、交互逻辑、图片灯箱、评论系统 |
| **模板层** | `src/404.html` | 404 错误页 |
| **服务层** | `worker/index.js`, `worker/worker.js`, `worker/schema.sql` | Cloudflare Worker 评论 API + D1 数据库 |
| **静态层** | `static/avatar.png`, `static/favicon.svg` | 头像、图标 |
| **输出层** | `dist/` (构建产物) | 生成的 HTML/CSS/JS/JSON |

---

## 二、逐文件逐行分析

### 2.1 `package.json` — 项目元数据

```json
{
  "name": "haprial",
  "version": "1.0.0",
  "private": true,
  "description": "Haprial - A minimal static blog generator",
  "scripts": {
    "build": "node build.js",
    "dev": "node build.js && cd dist && npx serve"
  }
}
```

- **零依赖**: 没有 `dependencies`，只用 Node.js 内置模块 (`fs`, `path`, `crypto`)
- `build` 脚本直接运行 `build.js`
- `dev` 脚本构建后用 `serve` 本地预览

### 2.2 `site.config.json` — 站点全局配置

**作用**: 整个博客的数据源头，所有页面都从这里读取数据。

关键字段：
- `title/tagline/description/url/author/bio` — SEO 和页面渲染的核心数据
- `skills[]` — 关于页的技能标签
- `links[]` — 社交链接 (GitHub, Twitter, RSS, Email)
- `categories[]` — 文章分类 (技术/设计/随想/文化/测试)，每个有 `name/slug/desc/color`
- `comments` — 评论系统配置，指向 Cloudflare Worker API
- `friends[]` — 友链数据 (7个友链)

**底层原理**: `build.js` 在构建时读取此文件，将所有数据注入到生成的 HTML 中（内联到 `window.__HAPRIAL_DATA__`），客户端 JS 直接读取，无需额外 API 请求。

### 2.3 `build.js` — 构建引擎 (核心，~600行)

这是整个博客的心脏。逐段分析：

#### 2.3.1 配置常量 (L1-L12)
```
ROOT → CONTENT_DIR → THEME_DIR → STATIC_DIR → OUT_DIR → CACHE_FILE
```
路径映射：源码 → 内容 → 主题 → 静态资源 → 输出目录

#### 2.3.2 增量构建缓存 (L14-L40)
```javascript
function fileHash(filePath) → MD5 哈希
function loadCache() → 读取 .build-cache.json
function saveCache() → 写入缓存
function getGlobalFingerprint() → 对所有影响全局的文件计算联合哈希
```

**底层原理**: 
- 每个 `.md` 文件独立计算 MD5
- 全局指纹 = `site.config.json` + 所有主题文件 + `build.js` 本身 + `lib/markdown.js` + `404.html`
- 只有文件哈希变化时才重新解析，否则复用缓存结果
- 这是**增量构建**的核心：大型博客只修改一篇文章时，构建时间从秒级降到毫秒级

#### 2.3.3 文章加载与解析 (L42-L110)
```javascript
function loadArticles(prevCache, globalFp)
```

逐行逻辑：
1. 读取 `content/blog/` 下所有 `.md` 文件，排序
2. 对每个文件计算 MD5，与缓存比对
3. **缓存命中**: 直接复用解析结果
4. **缓存未命中**: 
   - `parseFrontMatter()` 提取 YAML 前置数据
   - `mdToHtml()` 将 Markdown 转 HTML
   - 生成 slug (日期去连字符)
   - 处理 slug 冲突 (追加文件名后缀)
   - 自动计算阅读时间 (中文 400字/分钟 + 英文 200词/分钟)
   - 统计字数 (中文字符 + 英文单词)
5. 后处理: 构建 `[TOC]` 目录
6. 排序: 置顶优先 → 日期降序

**关键设计**: 
- `articlesMeta` (不含 content) 内联到 HTML 供客户端使用
- `article.json` 单独存放文章内容，支持懒加载

#### 2.3.4 标签与分类计算 (L112-L140)
```javascript
function computeTags() → {n: 标签名, c: 数量}
function computeCats() → {n, d, c, col, f} (名称/描述/数量/颜色/slug)
function computeCatMap() → {文章ID: 分类slug}
```

#### 2.3.5 文章卡片 HTML 生成 (L142-L155)
```javascript
function articleCardHtml(id, art)
```
生成 `<article class="card">` 带 `data-id/data-title/data-excerpt/data-tags` 属性，供客户端搜索和筛选使用。

#### 2.3.6 主题初始化脚本 (L157-L165)
```javascript
function themeInitScript()
```
内联的 IIFE，在页面渲染前执行：
- 从 `localStorage.getItem('th')` 读取主题偏好
- 如果没有，检测 `prefers-color-scheme: dark`
- 设置 `data-theme` 属性，切换太阳/月亮图标

**底层原理**: 这段脚本在 `<head>` 中执行，避免了页面加载时的"白闪"(FOUC)。

#### 2.3.7 文章页脚本 (L167-L210)
```javascript
function postPageScript()
```
独立文章页的内联 JS：
- Prism.js 代码高亮 (条件加载，有代码块才加载)
- TOC 平滑滚动
- 图片懒加载 + IntersectionObserver

#### 2.3.8 首页 HTML 生成 (L212-L350)
```javascript
function buildIndexHtml()
```
生成完整的 `index.html`，结构：
1. `<head>`: meta 标签、OG 标签、JSON-LD、字体预加载、CSS 内联
2. `<body>`: 
   - 顶栏 (logo, 搜索, 主题切换)
   - Tab 导航 (文章/标签/分类/归档/友链/关于)
   - 6个页面 section (只有 `articles` 默认显示)
   - 文章详情视图 (全屏覆盖)
   - 搜索视图
   - TOC 侧边栏 + 移动端 TOC 抽屉
   - FAB 按钮 (回顶部/评论)
   - Lightbox (图片查看器)
   - Footer

**关键设计**:
- CSS 全部内联 (`<style>${cssContent}</style>`)，消除外部 CSS 加载的闪烁
- 数据通过 `window.__HAPRIAL_DATA__` 内联，客户端零 API 请求
- FOUC 防护: `#anti-fouc` 样式隐藏未初始化的元素
- 字体使用 `media="print" onload="this.media='all'"` 异步加载

#### 2.3.9 文章页 HTML 生成 (L352-L480)
```javascript
function buildPostHtml(id, art, config, opts)
```
为每篇文章生成独立 HTML：
- 完整的 meta/OG/JSON-LD (SEO 必备)
- Schema.org `BlogPosting` + `BreadcrumbList` 结构化数据
- 前后文章导航
- TOC 从 h2/h3 提取
- 评论区

**注意**: 文章页的 JS 是内联的（`themeInitScript() + postPageScript()`），不依赖 `app.js`，是真正的独立页面。

#### 2.3.10 SEO 独立页面 (L482-L600)
```javascript
function seoPageHead() / seoPageFoot()
```
为标签/分类/归档/友链/关于生成独立的 SEO 页面：
- 每个页面有真实内容（不是纯重定向）
- 标签页列出所有标签下的文章
- 分类页列出所有分类下的文章
- 归档页按年分组
- 友链页带评论区

**底层原理**: 这些页面是为了搜索引擎爬虫准备的。SPA 内部用 hash 路由 (`#/tags`)，爬虫无法执行 JS，所以需要独立的 HTML 页面。

#### 2.3.11 静态资源复制 + SEO 生成 (L600-L700)
- 复制 `theme/` 和 `static/` 到 `dist/`
- 生成 `sitemap.xml` (所有页面 URL)
- 生成 `robots.txt`
- 生成 `rss.xml` (RSS 2.0 + Atom 自引用)
- 复制 `404.html`

### 2.4 `lib/markdown.js` — 零依赖 Markdown 解析器 (~500行)

这是整个项目技术含量最高的文件。

#### 2.4.1 `escHtml(s)` — HTML 转义
```javascript
& → &amp;  < → &lt;  > → &gt;  " → &quot;
```
XSS 防护的基础。

#### 2.4.2 `parseFrontMatter(src)` — YAML 前置数据解析
```
---\n
key: "value"
tags: ["a", "b"]
---
```
逐行正则匹配：
- `^(\w+):\s*"([^"]*)"` — 带引号的值
- `^(\w+):\s*(.+)$` — 不带引号的值
- 以 `[` 开头的尝试 `JSON.parse`

#### 2.4.3 `mdInline(text, footnotes)` — 行内 Markdown

处理顺序至关重要（防止误匹配）：
1. `\$` → `$` (转义美元符号)
2. `<br>` → 占位符 (保护换行)
3. 图片 `![alt](src)` → 占位符 (提取 Unsplash srcset)
4. 行内数学 `$...$` → 占位符 (跳过货币如 $100)
5. **HTML 转义** (此时所有特殊字符已安全)
6. 恢复 `<br>`
7. 粗斜体 `***` → 粗体 `**` → 斜体 `*`
8. 删除线 `~~`
9. 行内代码 `` ` ``
10. 脚注引用 `[^name]`
11. 链接 `[text](url)` (外部链接自动 `target="_blank"`)
12. 恢复图片占位符
13. 恢复数学占位符

**底层原理**: 占位符技术 (`\x00I0\x00`, `\x00M0\x00`) 确保嵌套内容不被 HTML 转义破坏。

#### 2.4.4 `mdToHtml(src)` — 块级 Markdown (~350行)

状态机驱动的逐行解析器：

**状态变量**:
- `inCodeBlock` / `codeLang` / `codeLines` — 代码块
- `inList` / `listType` — 列表
- `inTable` / `tableRows` / `tableAligns` — 表格
- `inBlockquote` / `bqLines` — 引用块
- `inDefList` — 定义列表
- `inHtmlBlock` / `htmlBlockTag` — 原生 HTML 块
- `footnotes` / `fnCounter` / `fnDefs` — 脚注

**解析优先级** (从高到低):
1. 围栏代码块 ` ``` `
2. 空行 (flush 所有状态)
3. 数学块 `$$`
4. `[TOC]` 指令
5. 引用块 `>`
6. 定义列表 `:   `
7. 表格 `|`
8. 原生 HTML 块
9. 缩进代码块 (4空格)
10. 标题 `#`
11. 水平线 `---`
12. 无序列表 `- / *`
13. 有序列表 `1.`
14. 段落 (默认)

**特殊支持**:
- Mermaid 图表 (` ```mermaid `) → 生成 `<div class="mermaid-block" data-code="...">`
- 任务列表 `- [ ] / - [x]`
- 脚注 `[^name]` + `[^name]: text`
- 表格对齐 (左/中/右)
- 原生 HTML 透传
- 标题自定义 ID `## Title {#custom-id}`

### 2.5 `theme/styles.css` — Material Design 3 主题 (~1200行)

#### 设计系统
- **色彩**: 基于 CSS 自定义属性，Light/Dark 两套完整色板
- **字体**: 
  - 正文: Noto Sans SC (中文无衬线)
  - 标题: LXGW WenKai (文楷，文艺感)
  - 装饰: Cormorant Garamond (英文衬线)
  - 代码: JetBrains Mono
- **形状**: 4/8/12/16/28/9999px 的圆角体系
- **阴影**: 3级 elevation (`--e1/--e2/--e3`)
- **动效**: Material Design 标准曲线 `cubic-bezier(.4,0,.2,1)`

#### 组件清单
- `.top-app-bar` — 顶栏 (sticky, elevation 阴影)
- `.page-tabs` — Tab 导航 (滑动指示条)
- `.card` — 文章卡片 (hover 高亮, ripple)
- `.article-view` — 文章详情 (全屏覆盖, 从底部滑入)
- `.toc` / `.toc-sheet` — 目录 (桌面侧边栏 / 移动端底部抽屉)
- `.search-view` — 搜索 (全屏, 从顶部滑入)
- `.lightbox` — 图片查看器 (缩放/拖拽/左右切换)
- `.code-block` — 代码块 (行号/复制/语言标签)
- `.mermaid-block` — Mermaid 图表 (缩放/平移)
- `.fl-card` — 友链卡片
- `.archive-card` — 归档时间线
- `.fab` — 浮动操作按钮
- `.comment-section` — 评论区

#### 响应式断点
- `> 1200px`: 显示 TOC 侧边栏
- `≤ 768px`: 移动端适配 (更紧凑的间距, 隐藏 hero)
- `≤ 480px`: 小屏手机进一步压缩

#### 无障碍
- `prefers-reduced-motion: reduce` → 禁用所有动画
- `:focus-visible` → 键盘导航焦点环
- `.skip-link` → 跳过导航
- `aria-label` / `aria-pressed` / `aria-live` → 屏幕阅读器

### 2.6 `theme/app.js` — 客户端 SPA 引擎 (~1000行)

这是博客的"大脑"，实现了完整的单页应用。

#### 2.6.1 状态管理
```javascript
currentPage, scrollPos, paginationPage, currentArticleId
pageScrollPos {} — 每个页面的滚动位置记忆
_contentCache {} — 文章内容缓存 (LRU, 最多10篇)
```

#### 2.6.2 路由系统 (Hash Router)
```
#/              → 文章列表
#/page/2        → 文章列表第2页
#/posts/20260804 → 文章详情
#/tags          → 标签页
#/categories    → 分类页
#/archive       → 归档页
#/friends       → 友链页
#/about         → 关于页
#search         → 搜索
```

**核心函数**:
- `parseHash()` → 解析 hash 为路由对象
- `pushRoute()` / `replaceRoute()` → 修改历史记录
- `applyRoute()` → 根据路由切换页面/打开文章
- `updateSEO()` → 动态更新 title/meta/JSON-LD

#### 2.6.3 页面切换动画
```javascript
switchPageVisual(name, dir)
```
- 左右滑动动画 (slide-in/out)
- 记忆每个页面的滚动位置
- `reducedMotion` / `isMobile` 时跳过动画

#### 2.6.4 文章加载系统
```javascript
loadArticle(id) → fetch article.json → render
prefetchArticle(id) → 预加载 (hover 触发)
prefetchNeighbors(id) → 预加载前后文章
```

**缓存策略**: LRU 缓存，最多 10 篇文章内容驻留内存。

**加载流程**:
1. 显示骨架屏 (shimmer 动画)
2. `fetch('/posts/' + id + '/article.json')`
3. 缓存 → 渲染
4. 处理代码块 (Prism.js)
5. 处理图片 (IntersectionObserver 懒加载)
6. 构建 TOC
7. 处理 Mermaid 图表
8. 初始化评论

#### 2.6.5 搜索系统
```javascript
openSearch() / closeSearch() / filterSearch(q)
```
- 纯客户端搜索，遍历所有 `.card` 的 `data-title/data-excerpt/data-tags`
- 350ms 防抖
- 键盘导航 (↑↓ Enter)
- 高亮匹配 (`<mark>`)

#### 2.6.6 主题切换
```javascript
toggleTheme() → setTheme(t) → syncAllIcons(t)
```
- 读写 `localStorage.setItem('th', t)`
- 设置 `data-theme` 属性
- 同步所有太阳/月亮图标状态

#### 2.6.7 Mermaid 图表渲染 (内建)
```javascript
renderMermaidFlowchart(code)
renderFlowGraph(lines) — 流程图
renderSequenceDiagram(lines) — 时序图
renderPieChart(lines) — 饼图
```

**底层原理**: 不依赖 Mermaid.js 库，直接用 SVG 手动渲染三种图表类型。流程图使用分层布局算法 (层次分配 → 位置计算 → SVG 绘制)。

#### 2.6.8 键盘快捷键
- `Escape` → 关闭搜索/灯箱/文章
- `←/→` → 前后文章切换
- `/` → 打开搜索

### 2.7 `theme/lightbox.js` — 图片灯箱 (~400行)

共享模块，SPA 和独立文章页都使用。

**功能**:
- 点击文章图片 → 全屏查看
- 左右切换 (按钮 + 滑动手势)
- 双指缩放 (pinch-to-zoom)
- 鼠标拖拽平移
- 下载按钮
- 定位按钮 (回到文章中的图片位置)
- Caption 显示
- 历史记录集成 (back 按钮关闭灯箱)
- 桌面端 ESC 关闭

### 2.8 `theme/comments.js` — 评论系统前端 (~300行)

零依赖的评论组件 `HaprialComments`。

**功能**:
- 加载评论 (GET `/api/comments?page=xxx`)
- 发表评论 (POST `/api/comments`)
- 回复嵌套 (最多2层)
- 点赞
- 博主标识 (admin token 认证)
- Markdown 简易渲染 (粗体/斜体/代码/链接)
- 本地持久化 (昵称/邮箱/网站)
- 焦点追踪 (`window.__cmtInputFocused`) — 防止快捷键冲突

### 2.9 `theme/comments.css` — 评论样式 (~400行)

Material Design 3 风格的评论区样式，与主题完全融合。

### 2.10 `theme/post-init.js` — 独立文章页初始化

独立文章页的共享初始化模块：
- 动态加载 `lightbox.js`
- Prism.js 条件加载
- TOC 平滑滚动
- 图片懒加载

### 2.11 `worker/index.js` — 评论后端 (D1 版本)

Cloudflare Worker，使用 D1 (SQLite) 数据库。

**API 端点**:
- `GET /api/comments?page=xxx` — 获取评论 (分页, cursor)
- `POST /api/comments` — 发表评论 (频率限制, 输入验证, Markdown)
- `POST /api/comments/:id/like` — 点赞 (IP 去重)
- `GET /api/health` — 健康检查

**安全措施**:
- IP 频率限制 (每分钟最多5条)
- 输入长度限制 (昵称30字, 内容2000字)
- XSS 防护 (HTML 转义)
- 父评论验证 (回复目标必须存在)
- 嵌套深度限制 (最多2层)
- Gravatar 头像 (SHA-256 哈希邮箱)

### 2.12 `worker/worker.js` — 评论后端 (KV 版本, 旧版)

使用 Cloudflare KV 存储的旧版本。API 略有不同 (`/api/comment` vs `/api/comments`)。
- KV 存储: 每个页面一个 key，value 是评论数组 JSON
- 软删除: `content = null`
- HMAC 签名验证博主身份

### 2.13 `worker/schema.sql` — D1 数据库结构

```sql
comments — 评论表 (id, page_slug, parent_id, depth, nickname, email, website, avatar_hash, content, content_html, ip, user_agent, status, liked, created_at, updated_at)
likes — 点赞表 (comment_id, ip) — 复合主键防重复
rate_limits — 频率限制表 (ip, action, created_at)
```

### 2.14 `worker/wrangler.toml` — Wrangler 配置

```toml
name = "haprial-comments"
main = "index.js"
# D1 绑定
[[d1_databases]]
binding = "DB"
database_name = "haprial-comments"
database_id = "d6bf9f4f-..."
# 环境变量
[vars]
ADMIN_TOKEN = "..."
```

### 2.15 `vercel.json` — Vercel 部署配置

- `cleanUrls: true` — 去掉 `.html` 后缀
- `trailingSlash: true` — URL 末尾加 `/`
- **缓存策略**:
  - `/theme/*` — 1年强缓存 (immutable, 因为文件名带版本号)
  - `*.html` — `must-revalidate` (内容可能变化)
- **安全头**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` — 严格的 CSP 策略

### 2.16 `src/404.html` — 404 页面

独立的完整 HTML，内联所有 CSS/JS：
- 大号 "404" 数字 (淡入动画)
- 主题切换功能
- Ripple 按钮效果
- 返回首页按钮

### 2.17 `content/blog/*.md` — 文章内容 (28篇)

每篇文章格式：
```markdown
---
title: "标题"
date: "2026-08-04"
tags: ["标签1", "标签2"]
category: "tech"
excerpt: "摘要"
---

正文 (Markdown)
```

时间跨度: 2024-01-30 ~ 2026-08-05  
分类分布: tech, design, think, culture, test

---

## 三、文件关系图谱

```
┌─────────────────────────────────────────────────────────────┐
│                     构建时 (Node.js)                         │
│                                                             │
│  site.config.json ──┐                                       │
│  content/blog/*.md ─┤                                       │
│  theme/*.css ───────┤──→ build.js ──→ dist/                │
│  theme/*.js ────────┤      ↑          (index.html,          │
│  src/404.html ──────┘      │           posts/*/index.html,  │
│                            │           posts/*/article.json, │
│                       lib/markdown.js    sitemap.xml,        │
│                       (解析器)          rss.xml,             │
│                                        robots.txt,          │
│                                        theme/*, static/*)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     运行时 (浏览器)                          │
│                                                             │
│  index.html                                                 │
│    ├── 内联 CSS (styles.css)                                │
│    ├── 内联数据 (window.__HAPRIAL_DATA__)                    │
│    │     ├── articles (元数据, 不含内容)                     │
│    │     ├── allTags, cats, catMap, friends                  │
│    │     └── comments 配置                                   │
│    ├── theme/lightbox.js → window.__initLightbox             │
│    ├── theme/comments.js → window.HaprialComments            │
│    └── theme/app.js (SPA 引擎)                               │
│          ├── 路由 (hash router)                              │
│          ├── 搜索 (客户端全文搜索)                           │
│          ├── 分页 (6篇/页)                                   │
│          ├── 文章加载 → fetch article.json → 缓存            │
│          ├── TOC (自动构建 + 高亮)                           │
│          ├── Mermaid (内建 SVG 渲染)                         │
│          ├── 代码高亮 (Prism.js CDN)                         │
│          ├── Lightbox (图片查看)                             │
│          ├── 评论 (HaprialComments)                          │
│          └── 主题切换 / 滚动 / 动画                          │
│                                                             │
│  posts/*/index.html (独立文章页, 不依赖 app.js)              │
│    ├── 内联 CSS                                              │
│    ├── 内联 JS (themeInitScript + postPageScript)            │
│    └── theme/lightbox.js + theme/comments.js                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   评论后端 (Cloudflare)                      │
│                                                             │
│  worker/index.js ──→ D1 (SQLite)                            │
│    GET  /api/comments?page=xxx → 评论列表                    │
│    POST /api/comments → 发表评论                             │
│    POST /api/comments/:id/like → 点赞                       │
│                                                             │
│  theme/comments.js ──→ fetch Worker API                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、底层原理深度解析

### 4.1 双轨路由架构

**问题**: SPA 用 hash 路由 (`#/posts/xxx`)，但 SEO 需要真实 URL (`/posts/xxx/`)。

**解决方案**: 
- SPA 内部: hash 路由 (`#/posts/20260804`) — 无需服务器配合
- SEO 页面: 独立 HTML (`dist/posts/20260804/index.html`) — 爬虫直接读取
- Vercel `trailingSlash: true` + `cleanUrls: true` — 确保两种 URL 都能访问

### 4.2 零 API 架构

传统博客: 浏览器 → API → 数据库 → 渲染  
Haprial: 浏览器 → HTML (数据已内联) → 渲染

**实现方式**:
1. 构建时: `articlesMeta` (不含 content) 序列化为 JSON
2. 注入: `<script>window.__HAPRIAL_DATA__ = ${JSON.stringify(dataObj)}</script>`
3. 运行时: `app.js` 直接读取 `window.__HAPRIAL_DATA__`

**优势**: 首屏零 API 请求，TTFB 最小化。

### 4.3 文章懒加载

**问题**: 28篇文章全部内联会导致 HTML 体积过大。

**解决方案**:
- 首页只内联元数据 (标题/摘要/标签/日期)
- 文章内容存储在 `posts/*/article.json`
- 点击文章时 `fetch` 加载
- LRU 缓存 (最多10篇)
- Hover 预加载 (提前 150ms)
- 邻居预加载 (打开文章后预加载前后各1篇)

### 4.4 增量构建

**问题**: 每次修改一个文件都全量重建太慢。

**解决方案**:
- `.build-cache.json` 存储每个文件的 MD5 哈希
- 全局指纹 = 所有影响全局的文件的联合哈希
- 只有哈希变化的文件才重新解析
- 全局指纹变化时强制全量重建

### 4.5 CSS 内联消除 FOUC

**问题**: 外部 CSS 加载期间页面会闪一下无样式内容。

**解决方案**: `build.js` 在构建时读取 `styles.css`，直接内联到 HTML 的 `<style>` 标签中。Vercel 的 `/theme/*` 1年缓存策略是为了独立文章页和 CDN 优化。

### 4.6 代码块渲染管线

```
Markdown ```代码``` 
  → build.js: <pre><code class="language-xxx">
  → app.js: processCodeBlocks()
     → 创建 .code-block 容器
     → 添加行号 (.cb-lines)
     → 添加语言标签 (.cb-lang)
     → 添加复制按钮 (.cb-copy)
     → Prism.js 语法高亮 (CDN)
```

### 4.7 Mermaid 内建渲染

**不依赖 Mermaid.js** (约 2MB)，自行实现三种图表的 SVG 渲染：

**流程图**: 
1. 解析 `graph TD/LR` 声明
2. 正则提取节点和边
3. 分层布局 (计算每个节点的深度)
4. 位置分配 (每层等间距排列)
5. SVG 绘制 (矩形/菱形/圆形 + 箭头)

**时序图**:
1. 解析 `participant` 声明
2. 提取消息 (from → to: label)
3. 按消息顺序纵向排列
4. SVG 绘制 (生命线 + 箭头)

**饼图**:
1. 解析 `pie title` 和数据
2. 计算角度 (value/total × 360°)
3. SVG 弧形路径 (A 命令)
4. 添加图例

**交互**: 缩放按钮 + 拖拽平移 + 触摸支持 + modifier 键 (Ctrl/Shift/Alt)

### 4.8 评论系统架构

```
用户浏览器                    Cloudflare
┌──────────┐                ┌──────────────┐
│ comments │  fetch API     │  Worker      │
│    .js   │ ──────────────→│  (index.js)  │
│          │                │      ↓       │
│ Haprial  │  JSON response │  D1 SQLite   │
│ Comments │ ←──────────────│  (comments)  │
└──────────┘                └──────────────┘
```

**数据流**:
1. 发表: 用户输入 → POST /api/comments → D1 INSERT → 返回结果
2. 加载: GET /api/comments?page=xxx → D1 SELECT → 渲染
3. 点赞: POST /api/comments/:id/like → D1 UPDATE (IP 去重)

**安全层**:
- CORS 白名单
- IP 频率限制 (D1 rate_limits 表)
- 输入验证 (长度/类型/格式)
- XSS 防护 (HTML 转义)
- 管理员 HMAC 签名

---

## 五、技术亮点总结

1. **零依赖**: 整个项目没有任何 npm 依赖，只用 Node.js 内置模块
2. **自研 Markdown 解析器**: ~500行代码支持表格/脚注/数学/Mermaid/任务列表
3. **自研 Mermaid 渲染**: 不依赖 2MB 的 Mermaid.js，自行实现流程图/时序图/饼图
4. **双轨路由**: Hash SPA + 独立 SEO 页面，兼顾用户体验和搜索引擎
5. **增量构建**: MD5 哈希缓存，修改单篇文章时毫秒级构建
6. **零 API 首屏**: 数据内联到 HTML，首屏无需任何异步请求
7. **Material Design 3**: 完整的 MD3 设计系统 (色彩/形状/动效/组件)
8. **极致性能**: CSS 内联、字体异步加载、图片懒加载、代码条件加载
9. **完整 SEO**: meta/OG/JSON-LD/sitemap/RSS/robots
10. **全端适配**: 桌面/平板/手机 + 深色/浅色 + 减少动效模式

---

## 六、潜在改进方向

1. **`worker/wrangler.toml` 泄露了 `ADMIN_TOKEN`** — 建议迁移到环境变量
2. **`worker/worker.js` (KV 版) 和 `worker/index.js` (D1 版) 共存** — 可以清理旧版
3. **`twikoo-custom.css`** — 看起来是给 Twikoo 评论系统准备的，但当前用的是自研评论系统，可能已废弃
4. **文章页的 `post-init.js`** — 与 `buildPostHtml` 中内联的 JS 功能重复，可以统一
5. **`.gitignore`** — 格式有点奇怪 (`-e` 前缀)，可能是编辑器误加的
