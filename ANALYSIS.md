# Haprial 博客系统 — 全面深度分析

## 一、项目概览

**Haprial** 是一个零依赖、纯 Node.js 构建的静态博客生成器。作者 Moriefy，部署于 Vercel，域名 `pluslogic.eu.org`。

### 核心理念
- **零依赖**：不使用任何 npm 包，连 Markdown 解析器都是手写的
- **极致性能**：SPA 架构 + 增量构建缓存 + 资源懒加载
- **Material Design 3**：完整的 MD3 设计语言实现
- **纯静态**：生成的 HTML 可以不依赖 JS 展示内容

---

## 二、文件清单与职责

```
blog/
├── .gitignore                  # Git 忽略规则
├── README.md                   # 项目说明文档
├── package.json                # 项目元数据（无依赖！）
├── site.config.json            # 站点全局配置
├── vercel.json                 # Vercel 部署 + 安全头 + 缓存策略
├── build.js                    # 🔑 构建核心（~600行）
├── lib/
│   └── markdown.js             # 🔑 自研 Markdown 解析器（~400行）
├── content/blog/               # 📝 文章目录（26篇 .md 文件）
├── src/
│   └── 404.html                # 自定义 404 页面
├── theme/
│   ├── styles.css              # 🎨 全局样式（MD3 设计系统）
│   ├── app.js                  # 🧠 SPA 核心逻辑（~700行）
│   ├── lightbox.js             # 🔍 图片灯箱模块
│   ├── post-init.js            # 独立文章页初始化
│   └── twikoo-custom.css       # 评论系统样式覆写
└── static/
    ├── avatar.png              # 头像
    └── favicon.svg             # 站点图标
```

---

## 三、逐文件逐行深度解析

### 3.1 `lib/markdown.js` — 零依赖 Markdown 解析器

这是整个项目的基石，手写了一个完整的 Markdown → HTML 转换器。

#### 导出接口
```
escHtml(s)          — HTML 实体转义（& < > "）
parseFrontMatter()  — 解析 YAML front matter
mdInline()          — 行内 Markdown 处理
mdToHtml()          — 块级 Markdown → HTML
```

#### `parseFrontMatter(src)` 解析流程
1. 用正则 `/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/` 匹配 front matter 块
2. 逐行解析 `key: "value"` 和 `key: value` 格式
3. 数组值（如 `["tag1","tag2"]`）用 `JSON.parse` 解析
4. 返回 `[meta, body]` 元组

#### `mdInline(text, footnotes)` 行内处理链

**处理顺序极为关键**（每一步都依赖前一步的结果）：

```
1. \$ → $                     # 转义美元符号
2. <br> → 占位符 \x01BR\x01   # 保护 HTML 换行
3. ![alt](src) → 占位符 \x00I{n}\x00  # 提取图片（保护不被HTML转义破坏）
4. $math$ → 占位符 \x00M{n}\x00       # 提取行内数学
5. HTML 转义 & < > "                   # XSS 防护
6. 恢复 <br>                            # 还原换行
7. *** → <strong><em>                   # 粗斜体
8. ** → <strong>                        # 粗体
9. * → <em>                             # 斜体
10. ~~ → <del>                          # 删除线
11. ` → <code>                          # 行内代码
12. [^name] → 脚注引用                   # 脚注
13. [text](url) → <a>                   # 链接（外部链接自动 target="_blank"）
14. 恢复图片占位符                        # 还原图片
15. 恢复数学占位符                        # 还原数学公式
```

**设计亮点**：
- 图片和数学公式在 HTML 转义**之前**提取为占位符，转义**之后**还原——这保证了 `src` 属性中的特殊字符不被破坏
- Unsplash 图片自动添加 `srcset` 响应式属性和 `width/height` 属性（避免 CLS）
- 外部链接自动添加 `target="_blank" rel="noopener"`

#### `mdToHtml(src)` 块级解析器

**状态机设计**，维护以下状态变量：
```
inCodeBlock    — 围栏代码块 (```)
codeLang       — 代码语言
codeLines      — 代码行缓冲
inList         — 列表中
listType       — ul/ol
inTable        — 表格中
tableRows      — 表格行
tableAligns    — 列对齐方式
inBlockquote   — 引用块
bqLines        — 引用行缓冲
inDefList      — 定义列表
inHtmlBlock    — 原生 HTML 块
htmlBlockTag   — 追踪的 HTML 标签
footnotes      — 脚注映射 {name: number}
fnCounter      — 脚注计数
fnDefs         — 脚注定义列表
```

**处理优先级**（从高到低）：
1. 围栏代码块 ``` — 进入/退出代码块模式
2. 空行 — flush 所有状态
3. 数学块 $$ — 单行/多行数学公式
4. `[TOC]` — 目录占位符
5. `>` — 块引用（连续行合并为一个 `<blockquote>`）
6. `:   ` — 定义列表
7. `|` — 表格（分隔行检测：所有非空单元格必须匹配 `---` 模式）
8. 原生 HTML 行 — 直接透传
9. 缩进代码块（4空格）
10. 标题 `#` — 支持 `{#custom-id}` 锚点
11. 分割线 `---`
12. 无序列表 `-` — 支持任务列表 `- [ ]`/`- [x]`
13. 有序列表 `1.`
14. 段落（默认兜底）

**Mermaid 特殊处理**：代码块语言为 `mermaid` 时，不生成 `<pre><code>`，而是生成 `<div class="mermaid-block" data-code="...">` 供前端渲染。

**脚注系统**：
- 第一遍扫描收集 `[^name]: text` 定义
- 第二遍解析正文时替换 `[^name]` 为带编号的上标链接
- 最后生成 `<section class="footnotes">` 附在文末

---

### 3.2 `build.js` — 构建编排器

#### 构建流水线

```
┌─────────────────────────────────────────────────────────────┐
│                    build.js 构建流程                          │
├─────────────────────────────────────────────────────────────┤
│ 1. 加载配置 (site.config.json)                               │
│ 2. 计算全局指纹 (globalFingerprint)                           │
│ 3. 加载文章 (loadArticles) — 带增量缓存                       │
│    ├─ 读取 .md 文件                                          │
│    ├─ MD5 哈希 → 缓存命中? → 复用解析结果                      │
│    ├─ 缓存未命中 → parseFrontMatter + mdToHtml                │
│    ├─ 自动生成阅读时间 (中文400字/分, 英文200词/分)             │
│    ├─ 生成 slug (日期去横线, 冲突时追加后缀)                    │
│    └─ 处理 [TOC] → 生成目录 HTML                              │
│ 4. 计算标签/分类                                              │
│ 5. 排序 (置顶优先 → 日期降序)                                  │
│ 6. 生成 dist/                                                │
│    ├─ index.html (SPA 主页, CSS 内联, 数据内嵌)                │
│    ├─ posts/<id>/index.html (独立文章页, SEO 用)               │
│    ├─ posts/<id>/article.json (文章内容, SPA 懒加载用)          │
│    ├─ tags/index.html                                         │
│    ├─ categories/index.html                                   │
│    ├─ archive/index.html                                      │
│    ├─ friends/index.html                                      │
│    ├─ about/index.html                                        │
│    ├─ theme/* (CSS/JS 静态资源)                                │
│    ├─ static/* (头像等)                                       │
│    ├─ sitemap.xml                                             │
│    ├─ robots.txt                                              │
│    └─ rss.xml                                                 │
│ 7. 保存构建缓存 (.build-cache.json)                            │
└─────────────────────────────────────────────────────────────┘
```

#### 增量构建缓存机制

```javascript
// 缓存键: 文件名
// 缓存值: { hash: 文件MD5, globalFp: 全局指纹, article: 解析结果 }
// 
// 命中条件: 文件哈希未变 AND 全局指纹未变
// 全局指纹 = MD5(site.config.json + styles.css + app.js + ... + build.js本身)
//
// 效果: 只修改一篇文章时, 其他25篇直接复用缓存
```

#### 文章卡片 HTML 生成

每篇文章生成一个 `<article class="card">` 元素，包含：
- `data-id` — 文章 ID（日期 slug）
- `data-title` — 标题（供搜索用）
- `data-tags` — 标签（用 `\u001f` 分隔）
- 置顶徽章 📌
- 日期、标题、摘要、标签、阅读时间

#### `buildIndexHtml()` — SPA 主页生成

**关键设计**：
- **CSS 全量内联**：`styles.css` 直接写入 `<style>` 标签，消除 FOUC
- **数据内嵌**：`window.__HAPRIAL_DATA__` 包含所有文章元数据、标签、分类、友链
- **字体懒加载**：`media="print" onload="this.media='all'"` 技巧
- **防 FOUC 样式**：`#anti-fouc` 隐藏关键元素，直到 JS 确定初始路由
- **资源预连接**：dns-prefetch + preconnect 到 Google Fonts、jsdelivr、cdnjs
- **文章预获取**：前3篇文章的 `article.json` 用 `<link rel="prefetch">` 提前加载

#### `buildPostHtml()` — 独立文章页

为 SEO 生成完全独立的文章页（不依赖 SPA）：
- 完整的 Open Graph / Twitter Card meta 标签
- JSON-LD 结构化数据（BlogPosting + BreadcrumbList）
- 内联主题切换脚本
- Twikoo 评论区
- 上下篇文章导航

#### SEO 独立页面

为 `/tags/`、`/categories/`、`/archive/`、`/friends/`、`/about/` 各生成独立 HTML：
- 每个页面包含完整的文章列表（对搜索引擎可见）
- 标签页：每个标签下列出所有相关文章
- 分类页：每个分类下列出所有相关文章
- 归档页：按年分组

---

### 3.3 `theme/app.js` — SPA 核心逻辑

这是最复杂的文件，实现了一个完整的单页应用。

#### 架构概览

```
┌───────────────────────────────────────────────────┐
│                    app.js SPA 架构                  │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐  │
│  │ 路由系统 │───→│ 页面切换  │───→│ 文章加载     │  │
│  │ Hash路由 │    │ Tab动画  │    │ JSON懒加载  │  │
│  └─────────┘    └──────────┘    └─────────────┘  │
│       │                               │           │
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐  │
│  │ SEO更新 │    │ 搜索系统  │    │ 评论系统     │  │
│  │ Meta标签│    │ 实时过滤  │    │ Twikoo懒加载│  │
│  └─────────┘    └──────────┘    └─────────────┘  │
│                                                   │
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐  │
│  │ TOC系统 │    │ 主题切换  │    │ Mermaid渲染 │  │
│  │ 高亮跟踪│    │ 深色/浅色 │    │ 流程图/饼图  │  │
│  └─────────┘    └──────────┘    └─────────────┘  │
│                                                   │
└───────────────────────────────────────────────────┘
```

#### 路由系统

**Hash-based SPA 路由**：

```
#/                  → 文章列表页
#/page/2            → 文章列表第2页
#/posts/20260805    → 文章详情
#/tags              → 标签页
#/categories        → 分类页
#/archive           → 归档页
#/friends           → 友链页
#/about             → 关于页
#search             → 搜索（pushState）
```

核心函数：
- `parseHash()` — 解析 hash → 路由对象
- `pushRoute()` / `replaceRoute()` — 更新历史 + SEO
- `applyRoute()` — 根据路由执行视觉切换
- `popstate` 监听 — 浏览器前进/后退

#### 文章加载与缓存

```
_contentCache = {}     // 内容缓存（最多10篇）
_cacheOrder = []       // LRU 缓存顺序
_prefetchInFlight = {} // 正在预获取的请求

加载流程:
1. loadArticleMeta(id)  — 填充标题/日期/标签/导航
2. 检查 _contentCache   — 命中则直接渲染
3. 未命中 → 显示骨架屏 → fetch article.json → 渲染
4. 缓存内容 → 预获取相邻文章
```

**Hover 预获取**：鼠标悬停卡片 150ms 后开始预获取文章内容。

#### 页面切换动画

```javascript
switchPageVisual(name, dir):
  // dir = 'right' | 'left'（根据 tab 顺序判断方向）
  // 退出动画: slideOutLeft / slideOutRight (150ms)
  // 进入动画: slideInRight / slideInLeft (200ms)
  // 移动端禁用动画（直接切换）
  // prefers-reduced-motion 禁用动画
```

#### 文章切换动画

```javascript
switchToArticleVisual(nid, dir):
  // 退出: opacity→0, translateX→±16px (160ms)
  // 加载新文章
  // 进入: translateX→0, opacity→1 (240ms)
```

#### TOC（目录）系统

**桌面端**：右侧固定侧边栏，鼠标靠近右边缘时显示
- `toc.visible` 类控制显隐
- 滚动时高亮当前章节（`updateTOCHighlight`）
- 点击平滑滚动到目标位置
- 3秒手动锁定（点击后暂停自动高亮）

**移动端**：底部抽屉（Bottom Sheet）
- `tocSheet.open` 控制打开
- 点击遮罩关闭
- 内部滚动 + 自动居中当前项

#### Mermaid 图表渲染

**纯前端实现**，不依赖 mermaid.js 库！

支持三种图表类型：
1. **流程图** (`graph LR/TD/RL/BT`) — `renderFlowGraph()`
2. **时序图** (`sequenceDiagram`) — `renderSequenceDiagram()`
3. **饼图** (`pie`) — `renderPieChart()`

每种图表：
- 解析 Mermaid DSL → 构建数据结构 → 生成 SVG
- 支持缩放（+/-按钮）、拖拽平移、触摸手势
- 修改键辅助：Ctrl=放大, Shift=缩小, Alt=文本选择

#### 搜索系统

- 实时过滤：输入后 350ms 防抖
- 搜索范围：标题 + 摘要 + 标签
- 键盘导航：↑↓选择, Enter 打开
- 高亮匹配文本

#### Twikoo 评论系统

- **懒加载**：IntersectionObserver 检测评论区进入视口后才加载
- 文章页和友链页分别初始化
- 文章切换时销毁旧实例、初始化新实例

---

### 3.4 `theme/lightbox.js` — 图片灯箱

导出 `window.__initLightbox(articleBody)` 供 SPA 和独立页共用。

#### 功能
- 点击文章内图片打开灯箱
- 左右滑动/箭头键切换图片
- 双指缩放 / 点击放大（2.5x）
- 拖拽平移（缩放后）
- 图片计数器
- 下载按钮
- 定位按钮（关闭灯箱并滚动到图片位置）
- Caption 显示（figcaption 内容）
- 历史状态管理（back 按钮关闭灯箱而非导航）

#### 关闭动画

```javascript
// 计算原图位置 → 灯箱图片位置的变换矩阵
// translate(dx, dy) + scale(s) + opacity→0
// 模拟图片"飞回"原位的效果
```

---

### 3.5 `theme/post-init.js` — 独立文章页初始化

为非 SPA 的独立文章页提供：
1. 加载 lightbox.js 并初始化
2. Prism.js 代码高亮懒加载
3. TOC 平滑滚动
4. 图片懒加载 + 淡入动画

---

### 3.6 `theme/styles.css` — Material Design 3 设计系统

#### CSS 变量体系

```css
/* 浅色主题 */
[data-theme="light"] {
  --primary: #3D5A6E;           /* 深灰蓝 — 品牌主色 */
  --on-primary: #fff;
  --primary-container: #D4DDE3; /* 浅灰蓝 — 容器色 */
  --surface: #FFFFFF;
  --surface-container-lowest: #FFFFFF;
  --surface-container-low: #F8F9FA;
  --surface-container: #F2F3F5;
  --surface-container-high: #ECEDEF;
  --surface-container-highest: #E6E7E9;
  --on-surface: #1C1C1E;
  --on-surface-variant: #4A4D51;
  --outline: #75787C;
  --outline-variant: #D4D5D7;
  --e1/e2/e3: 三级阴影;
}

/* 深色主题 */
[data-theme="dark"] {
  --primary: #9AB0BF;           /* 浅灰蓝 — 深色模式主色 */
  --surface: #191B1D;
  /* ... */
}
```

#### 字体方案

```
标题/logo:  'Cormorant Garamond' (衬线, 优雅)
正文:       'Noto Sans SC' + 'PingFang SC' (无衬线, 清晰)
文章标题:   'LXGW WenKai' (楷体, 文艺)
代码:       'JetBrains Mono' (等宽)
```

#### 组件样式

完整实现了 MD3 组件：
- Top App Bar（粘性顶栏，滚动时添加阴影）
- Tabs（带滑动指示器）
- Cards（淡入动画）
- FAB（浮动操作按钮，回到顶部/评论区）
- Ripple（涟漪效果）
- Skeleton Loader（骨架屏）
- Tags/Categories Grid
- Archive Timeline（时间线动画）
- Search View
- Article View（全屏覆盖，从底部滑入）
- Code Blocks（行号 + 语言标签 + 复制按钮）
- Lightbox（灯箱）
- TOC Sidebar / Drawer

#### 响应式断点

```
> 1200px  — TOC 侧边栏可见
≤ 1200px  — TOC 隐藏，显示 TOC 切换按钮
≤ 768px   — 移动端适配（减小间距/字号，禁用页面切换动画）
≤ 480px   — 小屏手机进一步压缩
```

#### 无障碍

- `prefers-reduced-motion` — 禁用所有动画和过渡
- `:focus-visible` — 键盘焦点环
- `skip-link` — 跳过导航
- `aria-label` / `aria-pressed` / `aria-live`
- `role="navigation"` / `itemscope itemtype`

---

### 3.7 `site.config.json` — 站点配置

```json
{
  "title": "Moriefyの半岛铁盒",     // 站点标题
  "tagline": "我点燃烛火温暖岁末的秋天", // 标语
  "description": "关于代码、设计与构建 Web 的思考和实践。",
  "url": "https://pluslogic.eu.org",
  "author": "Moriefy",
  "bio": "...",                       // 关于页简介
  "skills": ["JavaScript","TypeScript","Rust",...], // 技术栈
  "links": [...],                     // 社交链接
  "categories": [                     // 5个分类
    { "name":"技术","slug":"tech","color":"#3E505B" },
    { "name":"设计","slug":"design","color":"#4A7B6A" },
    { "name":"随想","slug":"think","color":"#8E6B9E" },
    { "name":"文化","slug":"culture","color":"#B07D56" },
    { "name":"测试","slug":"test","color":"#4c1353" }
  ],
  "twikooEnvId": "https://twikoo.pluslogic.eu.org/",
  "friends": [...]                    // 7个友链
}
```

---

### 3.8 `vercel.json` — 部署配置

```json
{
  "buildCommand": "node build.js",
  "outputDirectory": "dist",
  "framework": null,              // 非框架项目
  "cleanUrls": true,              // 去掉 .html 后缀
  "trailingSlash": true,          // 强制尾斜杠
  "headers": [
    "/theme/*" → 1年强缓存 + nosniff
    "/*.html"  → must-revalidate + nosniff
    "/*"       → 完整安全头:
      - X-Content-Type-Options: nosniff
      - X-Frame-Options: DENY
      - Referrer-Policy: strict-origin-when-cross-origin
      - X-DNS-Prefetch-Control: on
      - Content-Security-Policy: 白名单策略
  ]
}
```

**CSP 白名单**：
- script: self, unsafe-inline, cdnjs, cdn.jsdelivr, vercel-analytics, vercel-live
- style: self, unsafe-inline, fonts.googleapis, cdnjs, cdn.jsdelivr
- font: self, fonts.gstatic, cdn.jsdelivr
- img: self, data, https, http
- connect: self, vercel-analytics, vercel-live, twikoo.pluslogic.eu.org

---

### 3.9 `src/404.html` — 自定义 404 页面

独立的、不依赖 SPA 的 404 页面：
- 自带完整 CSS（与主站共享设计变量）
- 自带主题切换逻辑
- 大号 "404" 数字 + 错误描述 + 返回首页按钮
- 涟漪效果
- `prefers-reduced-motion` 支持

---

### 3.10 文章格式（content/blog/*.md）

```markdown
---
title: "文章标题"
date: "2026-08-05"              # YYYY-MM-DD 格式
tags: ["标签1", "标签2"]        # JSON 数组
category: "think"               # tech|design|think|culture|test
excerpt: "文章摘要"             # 用于卡片和 SEO
---

正文内容，支持完整 Markdown 语法：
- 标题（## h2 / ### h3）支持 {#custom-id} 锚点
- 代码块（围栏/缩进）支持语言标注
- Mermaid 图表（流程图/时序图/饼图）
- 数学公式（行内 $...$ / 块级 $$...$$）
- 脚注 [^name]
- 表格
- 任务列表
- 定义列表
- [TOC] 目录占位符
- 原生 HTML 透传
```

---

## 四、文件间关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        构建时 (Node.js)                          │
│                                                                 │
│  site.config.json ──┐                                           │
│                     │                                           │
│  content/blog/*.md ─┼──→ build.js ──→ dist/                     │
│                     │     │                                     │
│  lib/markdown.js ───┘     │                                     │
│  (parseFrontMatter,       ├─→ index.html (内联CSS + 内嵌数据)    │
│   mdToHtml,               ├─→ posts/<id>/index.html (SEO)       │
│   mdInline,               ├─→ posts/<id>/article.json (懒加载)   │
│   escHtml)                ├─→ tags/categories/archive/friends/   │
│                           ├─→ sitemap.xml + rss.xml + robots.txt│
│                           └─→ theme/* + static/* (复制)          │
│                                                                 │
│  .build-cache.json ←── 增量缓存                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        运行时 (浏览器)                            │
│                                                                 │
│  index.html                                                     │
│    ├─ <style> 内联 styles.css                                   │
│    ├─ <script> window.__HAPRIAL_DATA__ (文章元数据)               │
│    ├─ <script src="/theme/lightbox.js">  ← 先加载               │
│    ├─ <script defer src="/theme/app.js"> ← 后加载               │
│    │                                                            │
│    │   app.js (SPA 核心)                                        │
│    │     ├─ 读取 __HAPRIAL_DATA__ (标签/分类/友链/文章索引)       │
│    │     ├─ Hash 路由 → 页面切换 → 文章加载                      │
│    │     ├─ fetch article.json → 缓存 → 渲染                    │
│    │     ├─ __initLightbox(articleBody)                         │
│    │     ├─ __initTwikoo(path) → 加载 twikoo CDN                │
│    │     ├─ processCodeBlocks() → 加载 Prism.js CDN             │
│    │     ├─ processMermaid() → 纯前端 SVG 渲染                   │
│    │     ├─ buildTOC() + updateTOCHighlight()                   │
│    │     └─ 搜索/筛选/分页                                      │
│    │                                                            │
│    └─ <link> Google Fonts + LXGW WenKai (懒加载)                │
│                                                                 │
│  posts/<id>/index.html (独立页)                                  │
│    ├─ 内联 styles.css (直接引用)                                 │
│    ├─ 内联 theme 切换脚本                                       │
│    ├─ JSON-LD 结构化数据                                        │
│    ├─ post-init.js → lightbox + Prism + TOC                     │
│    └─ Twikoo 评论                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、核心设计原理

### 5.1 双轨渲染架构

**问题**：SPA 体验好但 SEO 差；纯静态 SEO 好但体验差。

**解决方案**：双轨并行
1. **SPA 轨道**（`index.html`）：所有文章元数据内嵌 → hash 路由 → 动态加载 `article.json` → 无刷新体验
2. **静态轨道**（`posts/<id>/index.html`）：每篇文章独立 HTML → 搜索引擎可直接抓取

两套轨道共享同一套 CSS（`styles.css`）和 Markdown 解析结果，只是包装方式不同。

### 5.2 增量构建缓存

```
文件哈希 + 全局指纹 → 缓存命中 → 跳过解析
                   → 缓存未命中 → 重新解析

全局指纹 = MD5(config + theme + build.js + markdown.js + 404.html)

效果：
- 修改一篇文章 → 只重新解析那篇文章
- 修改 CSS/JS → 全局指纹变化 → 所有文章重新生成 HTML（但不重新解析 Markdown）
- 修改 build.js → 全局指纹变化 → 全量重建
```

### 5.3 资源加载策略

```
关键路径（阻塞渲染）：
  ├─ CSS 内联在 <style> → 无网络请求
  ├─ 数据内嵌在 <script> → 无网络请求
  └─ 主题初始化脚本内联 → 无 FOUC

非关键路径（延迟加载）：
  ├─ Google Fonts → media="print" onload="this.media='all'"
  ├─ LXGW WenKai → 同上
  ├─ Prism.js → 有代码块时才加载
  ├─ Twikoo → IntersectionObserver 进入视口后加载
  ├─ Mermaid → 纯前端渲染，无需外部库
  └─ 文章内容 → hover 预获取 + LRU 缓存
```

### 5.4 性能优化清单

| 优化 | 实现方式 |
|------|---------|
| 零 npm 依赖 | 手写 Markdown 解析器、Mermaid 渲染器 |
| 增量构建 | MD5 哈希缓存，只重建变更文件 |
| CSS 内联 | 消除渲染阻塞的 CSS 网络请求 |
| 字体懒加载 | print onload 技巧 |
| 代码高亮懒加载 | 有代码块时才加载 Prism.js |
| 评论懒加载 | IntersectionObserver |
| 文章预获取 | hover 150ms 后开始 fetch |
| 内容 LRU 缓存 | 最多缓存 10 篇文章 HTML |
| 骨架屏 | 加载文章时显示 shimmer 动画 |
| 图片懒加载 | loading="lazy" + IntersectionObserver |
| 图片响应式 | Unsplash 图片自动 srcset |
| 减少 CLS | 图片设置 width/height |
| 低内存设备 | deviceMemory ≤ 2 时禁用动画 |
| 无障碍动画 | prefers-reduced-motion |
| 安全头 | CSP + X-Frame-Options + nosniff |

---

## 六、数据流全景

```
写文章 (Markdown)
    │
    ▼
build.js 读取 content/blog/*.md
    │
    ├─ parseFrontMatter() → { title, date, tags, category, excerpt }
    ├─ mdToHtml()          → HTML 内容
    ├─ 自动计算阅读时间    → "8 分钟"
    └─ 缓存检查            → 跳过/重解析
    │
    ▼
生成 dist/
    │
    ├─ index.html ← 内嵌 window.__HAPRIAL_DATA__
    │   │
    │   ▼
    │   浏览器加载
    │   │
    │   ├─ app.js 读取 __HAPRIAL_DATA__
    │   ├─ 渲染文章卡片列表
    │   ├─ 用户点击卡片
    │   │   ├─ pushRoute({type:'article', articleId})
    │   │   ├─ openArticleVisual(id)
    │   │   │   ├─ 显示骨架屏
    │   │   │   ├─ fetch('/posts/' + id + '/article.json')
    │   │   │   ├─ 缓存内容
    │   │   │   ├─ 渲染 HTML
    │   │   │   ├─ processCodeBlocks() → Prism 高亮
    │   │   │   ├─ processMermaid() → SVG 图表
    │   │   │   ├─ buildTOC() → 目录
    │   │   │   └─ __initTwikoo() → 评论
    │   │   └─ updateSEO() → 更新 title/meta/JSON-LD
    │   │
    │   └─ 用户切换页面/标签/搜索 → 纯前端，无网络请求
    │
    ├─ posts/<id>/index.html → Google 直接抓取
    ├─ posts/<id>/article.json → SPA 懒加载数据源
    ├─ sitemap.xml → 搜索引擎发现
    └─ rss.xml → RSS 订阅
```

---

## 七、技术亮点总结

1. **真正的零依赖**：不装一个 npm 包，连 Mermaid 都是纯前端手写 SVG 渲染
2. **双轨渲染**：SPA 体验 + 静态 SEO，两全其美
3. **增量构建**：改一篇文章只重新解析那一篇
4. **CSS 内联**：首屏无网络 CSS 请求，零 FOUC
5. **字体加载技巧**：`media="print" onload` 不阻塞渲染
6. **文章预获取**：hover 即加载，点击几乎零延迟
7. **Mermaid 纯前端**：流程图/时序图/饼图全部手写 SVG，不依赖外部库
8. **完整 MD3 设计**：从色彩到动效到组件，严格遵循 Material Design 3
9. **无障碍优先**：reduced-motion、focus-visible、skip-link、ARIA 属性
10. **安全意识**：CSP 白名单、XSS 防护（HTML 转义）、nosniff、X-Frame-Options
