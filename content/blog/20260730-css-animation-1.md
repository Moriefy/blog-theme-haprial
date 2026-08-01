---
title: "CSS 动画入门（一）：Transition 与 Transform"
date: "2026-07-30"
tags: ["CSS", "动画", "前端"]
category: "tech"
series: "CSS 动画深入浅出"
seriesOrder: "1"
excerpt: "从零开始理解 CSS 过渡和变换，用最简单的例子做出流畅的动画效果。"
---

## 为什么需要动画 {#why}

好的动画不是装饰，而是**信息传递**。它告诉用户"发生了什么"。

## Transition：最简单的动画 {#transition}

```css filename="style.css"
.box {
  width: 100px;
  height: 100px;
  background: #3D5A6E;
  transition: transform 0.3s ease;
}

.box:hover {
  transform: scale(1.1);
}
```

`transition` 的四个要素：

```diff
- transition: property duration timing-function delay;
+ transition: transform 0.3s ease 0s;
```

## Transform：不触发重排 {#transform}

```python app.py
# Python 示例：计算动画帧
import math

def ease_out(t):
    """缓出曲线"""
    return 1 - (1 - t) ** 3

# 模拟 60 帧动画
for frame in range(60):
    t = frame / 60
    position = ease_out(t) * 300
    print(f"Frame {frame}: x={position:.1f}px")
```

## 下一篇预告 {#next}

下一篇文章我们会讨论 `@keyframes` 和 CSS 动画的性能优化。
