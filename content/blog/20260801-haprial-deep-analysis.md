---
title: "从零手写一个博客引擎：Haprial 全架构深度拆解"
date: "2026-08-01"
tags: ["架构", "前端", "博客", "Node.js", "Material Design"]
category: "tech"
excerpt: "不依赖任何框架，从 Markdown 解析器到 SPA 路由引擎，逐行拆解一个零依赖静态博客系统的全部设计决策。"
---

## 写在前面

这个博客运行在一个叫 **Haprial** 的引擎上。它没有用 Astro、Hexo、Hugo——整个系统从零手写，零依赖、零 node_modules。

这篇文章是对整个项目的一次彻底拆解：从 Markdown 解析器的状态机，到前端 SPA 的路由系统，再到 Material Design 3 的设计体系。

如果你对"一个博客到底是怎么跑起来的"这件事好奇，这篇文章应该能回答你。

---

## 项目结构 [TOC]

先看全局：

```
haprial/
├── site.config.json       ← 全站配置中心
├── build.js               ← 构建引擎（~550行）
├── lib/
│   └── markdown.js        ← 自研 Markdown 解析器（~400行）
├── content/blog/*.md      ← 文章内容（21篇）
├── theme/
│   ├── styles.css         ← MD3 设计系统（~900行）
│   ├── app.js             ← 前端 SPA 引擎（~650行）
│   ├── lightbox.js        ← 图片灯箱（~350行）
│   ├── post-init.js       ← 独立文章页初始化
│   └── twikoo-custom.css  ← 评论系统样式
├── src/404.html           ← 自包含 404 页
├── static/                ← 静态资源
└── vercel.json            ← 部署配置 + 安全头
```

核心代码约 2500 行，撑起了一个完整的博客系统。

---

## 第一层：自研 Markdown 解析器

这是整个项目最核心的技术决策——不用 `marked`、`remark`，自己写。

### 为什么？

博客的 Markdown 需求其实是特殊的：需要 Front Matter、需要自定义标题 ID、需要 `[TOC]` 指令、需要数学公式、需要脚注。通用库要么不支持，要么需要一堆插件。不如自己写一个精准匹配需求的。

### 解析器架构

`lib/markdown.js` 导出四个函数：

```javascript
module.exports = { escHtml, parseFrontMatter, mdInline, mdToHtml };
```

**`escHtml`** — XSS 防护的基础，所有用户内容输出前都经过它。

**`parseFrontMatter`** — 解析 `---` 包裹的 YAML 块。不支持完整 YAML，只支持 `key: "value"` 和 `key: [JSON array]`，对博客场景够用。

**`mdInline`** — 行内元素解析。处理顺序很讲究：

```
\$ → $  →  保护 <br>  →  保护图片  →  保护数学公式
→  HTML 转义  →  还原 <br>  →  粗体/斜体/删除线/行内代码
→  脚注引用  →  链接  →  还原图片  →  还原数学公式
```

图片和数学公式用占位符保护，避免被 HTML 转义误伤——这是个巧妙的设计。

**`mdToHtml`** — 块级解析，**状态机架构**。

```
┌─────────────────────────────────────┐
│         行遍历状态机                  │
│                                     │
│  状态: inCodeBlock, inList,          │
│        inTable, inBlockquote,        │
│        inDefList, inHtmlBlock        │
│                                     │
│  每行 → 匹配类型 → flush 其他状态    │
└─────────────────────────────────────┘
```

每当遇到新类型的块元素，先关闭当前打开的其他块——`flushAll()` 是核心机制。

支持的元素：代码块、数学块、目录指令、引用、定义列表、表格（自动对齐）、HTML 直通、缩进代码、标题（自定义 ID）、分隔线、任务列表、段落。

脚注系统分两遍：第一遍收集定义，第二遍替换引用，最后生成脚注区域。支持双向跳转 + 平滑滚动。

---

## 第二层：构建引擎

`build.js` 约 550 行，是整个系统的编排中心。

### 增量构建

构建不是每次都从头来。系统维护一个 `.build-cache.json`：

```javascript
// 全局指纹：对所有影响每个页面的文件取 MD5
function getGlobalFingerprint() {
  const files = [
    'site.config.json', 'theme/styles.css', 'theme/app.js',
    'build.js', 'lib/markdown.js', 'src/404.html', /* ... */
  ];
  // 合并所有文件内容 → MD5
}
```

每个文章文件也有独立的 MD5。只有当文章 hash 变了 **或** 全局指纹变了，才重新解析。

改一篇文章 → 只重建那一篇。改配置/样式 → 全量重建。

### 文章解析流程

```
.md 文件 → parseFrontMatter() → mdToHtml() → article 对象
                                                  ↓
                                          slug 生成 (日期去横线)
                                          阅读时间计算 (中文400字/分)
                                          字数统计
                                          [TOC] 目录自动生成
```

Slug 冲突处理：追加文件名后缀，再冲突加数字计数器。

### 双模板输出

**首页 SPA (`buildIndexHtml`):**
- 所有 CSS 内联（消除 FOUC）
- 所有 JS 内联
- 文章数据嵌入 `window.__HAPRIAL_DATA__`
- 包含完整的 Tab 页、搜索、文章详情、Lightbox、TOC

**独立文章页 (`buildPostHtml`):**
- 完整 SEO 元数据（OG、JSON-LD、Breadcrumb）
- 独立加载 CSS/JS
- 上下篇导航
- 评论区

为什么两套？SPA 给站内导航用（快、无刷新），SSR 给直接访问和搜索引擎用。

### SEO 输出

构建还会生成：
- `sitemap.xml` — 所有页面 URL
- `robots.txt` — 允许所有爬虫
- `rss.xml` — RSS 2.0 订阅源
- 5 个独立 SEO 页面（标签/分类/归档/友链/关于）

---

## 第三层：前端 SPA 引擎

`theme/app.js` 约 650 行，是浏览器端的核心。

### 路由系统

Hash 路由，映射关系：

```
#/                    → 文章列表
#/page/2              → 第2页
#/posts/20260729      → 文章详情
#/tags                → 标签页
#/categories          → 分类页
#/archive             → 归档页
#/friends             → 友链页
#/about               → 关于页
```

每次路由变化同步更新 `<title>`、`meta description`、`og:title`、JSON-LD——SEO 不会因为 SPA 而丢失。

### 文章打开动画

文章详情从底部滑入：

```css
.article-view {
  position: fixed; inset: 0;
  transform: translateY(100%);
  transition: transform .4s cubic-bezier(.4,0,.2,1);
}
.article-view.open { transform: translateY(0); }
```

上下篇切换有平滑的淡入淡出 + 平移动画（160ms + 240ms）。

### 搜索

纯客户端搜索，搜 `data-title`、`data-excerpt`、`data-tags`。350ms 防抖，结果高亮，支持键盘导航（↑↓ 选择，Enter 打开，Escape 关闭）。

### TOC 系统

**桌面端**：鼠标移到文章右侧区域自动显示，1.5 秒无操作隐藏，滚动时高亮当前标题。

**移动端**：底部抽屉，点击 TOC 按钮打开，遮罩层 + 滑入动画。

### 性能检测

```javascript
var isLowEnd = reducedMotion || (navigator.deviceMemory && navigator.deviceMemory <= 2);
```

低端设备禁用 Ripple 效果，减少动画开销。

---

## 第四层：Material Design 3 设计系统

`theme/styles.css` 约 900 行，定义了整个博客的视觉语言。

### 色彩

双主题（浅色/深色），标准 MD3 色彩系统：

```css
/* 浅色 */
--primary: #3D5A6E;           /* 深灰蓝 */
--surface: #FFFFFF;
--on-surface: #1C1C1E;

/* 深色 */
--primary: #9AB0BF;           /* 浅灰蓝 */
--surface: #191B1D;
--on-surface: #E3E3E6;
```

所有颜色通过 CSS 变量引用，切换主题只需改变 `data-theme` 属性。

### 动画系统

```css
--motion-emphasized: cubic-bezier(.175,.885,.32,1.275);  /* 弹性 */
--motion-standard: cubic-bezier(.4,0,.2,1);               /* 标准 */
```

所有动画都尊重 `prefers-reduced-motion`——用户说不要动画，就真的没有动画。

### 响应式

三个断点：
- `1200px` — TOC 侧边栏隐藏
- `768px` — 移动端适配
- `480px` — 小屏压缩

打印样式也做了——隐藏导航/FAB/TOC，文章静态展示。

---

## 第五层：Lightbox 图片灯箱

`theme/lightbox.js` 约 350 行，独立模块，SPA 和独立文章页共用。

功能：点击放大、左右切换（按钮+键盘+触摸滑动）、双指缩放、鼠标拖拽平移、下载、定位回文章中对应位置、History 集成（返回键关闭灯箱而非页面）。

关闭动画会缩放回原位——这个细节很加分。

---

## 性能策略总结

| 策略 | 实现 |
|------|------|
| CSS 内联 | 首页所有 CSS 内联，零 FOUC |
| JS 内联 | 首页所有 JS 内联，减少请求 |
| 数据嵌入 | `__HAPRIAL_DATA__` 嵌入完整文章数据 |
| 增量构建 | MD5 哈希缓存 |
| 图片懒加载 | IntersectionObserver |
| 代码高亮懒加载 | 按需加载 Prism.js |
| 评论懒加载 | IntersectionObserver + Twikoo |
| CSS Containment | `contain: content` |
| 字体异步 | `media="print" onload="this.media='all'"` |
| DNS 预取 | `<link rel="dns-prefetch">` |

---

## 写在最后

2500 行代码，零依赖，撑起了一个完整的博客系统。

不是说轮子一定要自己造——但造一次，你会真正理解那些"显而易见"的事情到底是怎么工作的。Markdown 怎么变成 HTML？SPA 路由怎么不刷新页面？深色主题怎么切换？代码高亮怎么按需加载？

这些问题的答案，都在这 2500 行里。
