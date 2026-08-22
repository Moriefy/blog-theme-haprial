# Haprial 博客全面审查报告

---

## 一、Bug 类

### 🔴 P0 — 必须修

#### 1. `build.js` — `jsContent` 读取了但从未使用
```js
const jsContent = fs.readFileSync(path.join(THEME_DIR, 'app.js'), 'utf8');
```
这行读取了 `app.js` 的全部内容，但 `jsContent` 从未在任何模板中使用（SPA 通过 `<script src="/theme/app.js">` 外部加载）。**每次构建白白读取一个文件。**

#### 2. `build.js` — `fileHash` 函数定义了但从未调用
```js
function fileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}
```
完全没被使用。死代码。

#### 3. `build.js` — `newOutputHashes` 创建了但从未写入
```js
const newOutputHashes = {};
// ... 从未赋值 ...
saveCache({
  // ...
  outputHashes: newOutputHashes,  // 永远是 {}
});
```
缓存中的 `outputHashes` 永远是空对象，这段逻辑形同虚设。

#### 4. `build.js` — `themeTransition` 硬编码空字符串
```js
const themeTransition = ''; // theme snap — no transition to avoid jank
```
变量被引用到模板 `<style>${cssContent}${themeTransition}</style>` 中，但永远是空字符串。残留代码。

#### 5. `app.js` — `skipClear` 变量赋值了但从未读取
```js
var skipClear=false;
// 在 applyFilter 中:
skipClear=true;
switchPageVisual('articles','left');
skipClear=false;
```
`skipClear` 在整个代码中只被赋值，从未被检查。完全无效的逻辑。

#### 6. `app.js` — `savedPaginationPage` 赋值了但从未读取
```js
var savedPaginationPage=0;
// 在 switchPageVisual 中:
if(currentPage==='articles')savedPaginationPage=paginationPage;
```
保存了分页状态但从未恢复。意图是返回文章列表时恢复页码，但没有实现。

#### 7. `app.js` — `_artScrollThrottle` 声明了但从未使用
```js
var _artScrollThrottle=null,_tocRaf=null;
```
`_artScrollThrottle` 从未被赋值或读取。死变量。

#### 8. `app.js` — `buildSlug` 函数定义了但从未调用
```js
function buildSlug(id){var a=articles[id];return a?a.dateISO.replace(/-/g,''):''}
```
`routeToHash` 中直接用 `articles[id].dateISO.replace(/-/g,'')`，没有调用 `buildSlug`。

#### 9. `app.js` — `renderPaginationPage` 中 `var i` 重复声明
```js
function renderPaginationPage(){
  // ...
  var start=paginationPage*perPage,end=start+perPage,i,ci=0;  // 第一次声明 i
  // ...
  for(var i=0;i<total;i++)  // 第二次声明 i
```
同一函数作用域内 `var i` 声明了两次。虽然 JS 的 var 提升机制允许这样做，但这是潜在的 bug 来源。

#### 10. `app.js` — `renderPaginationPage` 中 `var s` 变量名冲突
```js
for(i=0;i<cardsState.length;i++){
  var s=cardsState[i];  // s 是 object
  // ...
}
// ...
var h='<button ...';
for(var i=0;i<total;i++)h+='<button ...';
```
`s` 在循环中作为 cardState 对象使用，但后面又用 `h` 做字符串拼接。虽然不冲突，但变量命名混乱。

### 🟡 P1 — 建议修

#### 11. `app.js` — 文章切换时 TOC 不重新绑定 drawer 点击事件
`buildTOC` 中为 `tocDrawerList` 的每一项绑定了 `click` 事件。但 `closeArticleVisual` 调用了 `closeTocSheet()`，而 `openArticleVisual` 没有清空 drawer 内容。如果 `buildTOC` 被多次调用（切换文章），旧的 drawer 项会被清空重建，这是正确的。但 `tocDrawerList.innerHTML=''` 在 `buildTOC` 开头，所以没问题。**实际无 bug，但逻辑不够清晰。**

#### 12. `app.js` — `_cachedCards` 在 `loadArticleMeta` 中被无效化
```js
function loadArticleMeta(id){_cachedCards=null; ...}
```
每次打开文章都把卡片缓存清空。但如果用户只是切换文章（`switchToArticleVisual`），卡片列表并没有变化，缓存被白白清空了。

#### 13. `app.js` — `closeArticleVisual` 中 anti-fouc 移除逻辑冗余
```js
function closeArticleVisual(){
  // ...
  var af=document.getElementById('anti-fouc');if(af)af.remove();
  // ...
}
```
关闭文章时移除 anti-fouc。但 anti-fouc 只在首次加载时存在，关闭文章时早就被 `openArticleVisual` 或 `openArticleVisualImmediate` 移除了。这行代码在正常流程中永远不会执行到有效逻辑。（保留也无害，作为防御性代码。）

#### 14. `app.js` — 初始化时 `switchPageVisual` 不带动画
```js
if(initRoute.page&&initRoute.page!=='articles'){
  switchPageVisual(initRoute.page,null);  // dir=null，不带动画
  syncTabs(initRoute.page)
}
```
`dir=null` 时 `switchPageVisual` 跳过动画。这是正确的（首次加载不需要动画），但 `syncTabs` 在 `switchPageVisual` 内部已经调用了，外部又调用了一次。**`syncTabs` 被调用了两次。**

#### 15. `app.js` — Mermaid 渲染器硬编码颜色
```js
var bg='#FFF',nBg='#D4DDE3',nBd='#3D5A6E',tc='#1C1C1E',ac='#75787C',dBg='#D4E8DF';
```
流程图颜色硬编码，不跟随暗色主题。在暗色模式下，白色背景和深色文字会导致图表不可读。（CSS 中有 `[data-theme="dark"] .mermaid-block::after` 添加半透明遮罩，但这只是部分修复。）

#### 16. `app.js` — 时序图和饼图同样硬编码颜色
```js
// renderSequenceDiagram:
var tc='#1C1C1E',ac='#75787C',lc='#3D5A6E';var bg='#D4DDE3';

// renderPieChart:
var tc='#1C1C1E',ac='#8E9196',lb='#1C1C1E';var bg='#FFFFFF';
```
同上，不跟随主题。

#### 17. `build.js` — `buildPostHtml` 中的独立文章页缺少 `avBar`
独立文章页（`/posts/{id}/`）的结构是：
```html
<header class="top-app-bar">...</header>
<main>...</main>
<aside class="toc">...</aside>
```
没有 SPA 中的 `avBar`（返回按钮、目录切换、主题切换）。用户直接访问独立页时没有返回按钮。

#### 18. `build.js` — `buildPostHtml` 中 TOC hover 代码查询 `main` 但阈值计算可能不准
修复后的代码：
```js
var av=document.querySelector('.av-content')||document.querySelector('main');
```
`main` 的 `getBoundingClientRect().right` 会包含 `padding`。如果 `main` 的 max-width 是 720px 且居中，right 值是正确的。但如果 `main` 有 `padding:0 24px`，right 值会包含 padding。**实际影响很小。**

---

## 二、冗余代码

### `app.js` 冗余清单

| 变量/函数 | 状态 | 建议 |
|-----------|------|------|
| `skipClear` | 赋值但未读取 | 删除 |
| `savedPaginationPage` | 赋值但未读取 | 删除或实现恢复逻辑 |
| `_artScrollThrottle` | 声明但未使用 | 删除 |
| `buildSlug()` | 定义但未调用 | 删除 |
| `isLowEnd` | 仅在 `createRipple` 中使用一次 | 内联 |
| `isReload` | 仅在初始化中使用一次 | 内联 |

### `build.js` 冗余清单

| 变量/函数 | 状态 | 建议 |
|-----------|------|------|
| `fileHash()` | 定义但未调用 | 删除 |
| `jsContent` | 读取但未使用 | 删除 |
| `themeTransition` | 硬编码空字符串 | 删除或实现 |
| `newOutputHashes` | 创建但未写入 | 删除或实现 |
| `outputHashes` (cache) | 永远是空对象 | 删除或实现 |

---

## 三、性能优化

### 🟢 已有的好设计
- 增量构建缓存（MD5 hash）
- CSS 内联到 index.html
- 文章元数据内嵌到 `__HAPRIAL_DATA__`
- 文章内容懒加载（`article.json`）
- Hover 预加载（150ms 延迟）
- 邻居预加载（加载完当前文章后预加载前后文章）
- LRU 内容缓存（最多 10 篇）
- Prism 代码高亮懒加载
- 图片 IntersectionObserver 懒加载
- `prefers-reduced-motion` 支持
- `will-change` 和 `contain` CSS 优化
- `passive: true` 滚动监听

### 🟡 可优化

#### 1. `observeImages` 每次文章切换都重建 IntersectionObserver
```js
function observeImages(){
  if(imgObserver)imgObserver.disconnect();
  // ... 创建新 observer
}
```
可以复用同一个 observer，只更新 `root` 选项（如果 `articleView` 不变的话）。但实际上 `articleView` 是固定的，所以可以只创建一次 observer，然后在 `loadArticle` 中调用 `observeImages` 时只添加新的 target。

#### 2. `buildTOC` 中 `articleBody.querySelectorAll('h2,h3')` 查询了两次
一次在 `buildTOC` 中遍历生成 TOC，一次在 `cacheHeadings` 中缓存位置。可以合并为一次查询。

#### 3. `processMermaid` 中为每个 mermaid 块创建独立的事件监听器
每个 mermaid 块的 zoom 按钮、拖拽、触摸事件都是独立绑定的。对于大量 mermaid 图表的页面，这会创建很多事件监听器。但由于 mermaid 图表通常不多（每页最多几个），实际影响很小。

#### 4. `renderPaginationPage` 中 `getAllCards()` 缓存了 DOM 查询
```js
function getAllCards(){if(!_cachedCards)_cachedCards=[].slice.call(document.querySelectorAll('.card'));return _cachedCards}
```
但 `loadArticleMeta` 中 `_cachedCards=null` 会清空缓存。如果用户频繁切换文章，缓存会被频繁清空。

#### 5. `build.js` 中 `syncToD1` 使用 Node.js `https` 模块
```js
const https = require('https');
// ...
function api(method, apiPath, body, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => { ... });
  });
}
```
可以使用 `fetch`（Node.js 18+ 内置），简化代码。

#### 6. 独立文章页（`buildPostHtml`）的 CSS 是外部加载
```html
<link rel="stylesheet" href="/theme/styles.css?v=1785775352">
```
而 SPA 的 CSS 是内联的。独立页多了一次 HTTP 请求。可以考虑也将 CSS 内联到独立页（代价是每个独立页都有一份 CSS 副本）。

---

## 四、代码质量

### 1. 全局变量过多
`app.js` 有 30+ 个全局变量。建议用一个状态对象管理：
```js
var state = {
  scrollPos: 0,
  codeProcessed: false,
  currentPage: 'articles',
  // ...
};
```
但这会增加代码量，对于零依赖的极简博客来说，当前方式可以接受。

### 2. 魔法数字
| 值 | 含义 | 建议 |
|---|------|------|
| `6` | 每页文章数 | 提取为 `PER_PAGE` |
| `10` | 内容缓存最大数 | 提取为 `CACHE_MAX` |
| `1500` | TOC 自动隐藏延迟 | 提取为 `TOC_HIDE_DELAY` |
| `3000` | TOC 手动锁定时间 | 提取为 `TOC_LOCK_DURATION` |
| `400` | FAB 显示阈值 | 提取为 `FAB_THRESHOLD` |
| `1000` | FAB 空闲隐藏延迟 | 提取为 `FAB_IDLE_DELAY` |
| `150` | Hover 预加载延迟 | 提取为 `PREFETCH_DELAY` |
| `350` | 搜索防抖延迟 | 提取为 `SEARCH_DEBOUNCE` |
| `80` | TOC 构建延迟 | 提取为 `TOC_BUILD_DELAY` |
| `100` | 滚动恢复延迟 | 提取为 `SCROLL_RESTORE_DELAY` |

### 3. 事件委托的单一大 click handler
整个 `document.addEventListener('click', ...)` 有 15+ 个 `if` 分支。建议拆分为独立函数：
```js
function handleCodeCopy(e) { ... }
function handleArticleNav(e) { ... }
// ...
```
但这会增加代码量。当前方式对于零依赖博客可以接受。

### 4. `renderPaginationPage` 函数过长
这个函数有 ~50 行，混合了状态管理、DOM 操作和 HTML 生成。建议拆分。

### 5. Mermaid 渲染器代码量大
`processMermaid` + `renderFlowGraph` + `renderSequenceDiagram` + `renderPieChart` + `initPieChart` 合计 ~250 行。这些代码在没有 mermaid 图表的页面上完全不会执行，但由于在主 bundle 中，会增加初始加载的 JS 体积。可以考虑提取为独立文件并懒加载。

---

## 五、安全

### ✅ 已有
- `escHtml` 正确转义 HTML 实体
- 评论 API 有 IP 频率限制（5次/分钟）
- Admin 认证使用 HMAC-SHA256 签名 token
- GitHub Webhook 有签名验证
- 使用参数化 SQL 查询（D1）
- 图片路径检查 `..` 防止路径遍历

### 🟡 建议
- CORS 设置为 `Access-Control-Allow-Origin: *`，建议限制为博客域名
- Admin 密码使用 SHA-256 哈希，建议使用 bcrypt/argon2（但 Cloudflare Worker 环境限制）
- 评论内容使用简单的 Markdown 渲染，可能被注入恶意 HTML（需要验证 `renderMd` 的转义逻辑）

---

## 六、无障碍

### ✅ 已有
- 按钮有 `aria-label`
- 键盘导航支持（Esc, ←, →, /）
- `prefers-reduced-motion` 支持
- `:focus-visible` 样式
- 打印样式
- `::selection` 样式

### 🟡 建议
- 动态内容更新缺少 `aria-live` 区域（如搜索结果、文章加载）
- TOC 和评论的键盘导航可以改进
- 颜色对比度需要验证（特别是暗色模式下的 outline 颜色）

---

## 七、优化建议汇总（按优先级）

### 高优先级
1. 删除 `build.js` 中的 `fileHash`、`jsContent`、`themeTransition`、`newOutputHashes` 死代码
2. 删除 `app.js` 中的 `skipClear`、`savedPaginationPage`、`_artScrollThrottle`、`buildSlug` 死代码
3. 修复 `renderPaginationPage` 中 `var i` 重复声明
4. 修复 `switchPageVisual` 初始化时 `syncTabs` 被调用两次

### 中优先级
5. Mermaid 渲染器支持暗色主题颜色
6. `observeImages` 复用 IntersectionObserver
7. `buildTOC` 合并 heading 查询
8. CORS 限制为博客域名

### 低优先级
9. 魔法数字提取为常量
10. 拆分 click handler
11. Mermaid 渲染器懒加载
12. 独立文章页 CSS 内联
13. `syncToD1` 使用 fetch 替代 https 模块
