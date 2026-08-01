---
title: "CSS 动画入门（二）：Keyframes 与性能"
date: "2026-07-31"
tags: ["CSS", "动画", "前端"]
category: "tech"
series: "CSS 动画深入浅出"
seriesOrder: "2"
excerpt: "深入 @keyframes 的用法，以及如何避免动画导致的掉帧。"
---

## @keyframes：精确控制 {#keyframes}

```css filename="animation.css"
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.page-enter {
  animation: slideIn 0.3s ease both;
}
```

## 性能黄金法则 {#performance}

只动画这两个属性：

```diff
- /* 触发 layout + paint */
- width: 100px → 200px;
- left: 0 → 100px;

+ /* 只触发 composite，GPU 加速 */
+ transform: translateX(100px);
+ opacity: 0 → 1;
```

## 浏览器渲染流水线 {#pipeline}

```mermaid
graph LR
    A[Style] --> B[Layout]
    B --> C[Paint]
    C --> D[Composite]
    style A fill:#3D5A6E,color:#fff
    style D fill:#4A7B6A,color:#fff
```

## will-change 提示 {#will-change}

```javascript app.js
// 提前告知浏览器这个元素要动画
element.style.willChange = 'transform, opacity';

// 动画结束后移除
element.addEventListener('transitionend', () => {
  element.style.willChange = 'auto';
});
```

## 总结 {#summary}

| 属性 | 触发 | 性能 |
|------|------|------|
| width/height | Layout + Paint + Composite | ❌ 慢 |
| top/left | Layout + Paint + Composite | ❌ 慢 |
| transform | Composite only | ✅ 快 |
| opacity | Composite only | ✅ 快 |

这就是为什么我们博客的所有动画都只用 `transform` 和 `opacity`。
