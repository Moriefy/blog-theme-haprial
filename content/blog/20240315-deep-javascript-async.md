---
title: "深入理解 JavaScript 异步编程模型"
date: "2024-03-15"
tags: ["前端", "JavaScript", "异步编程"]
category: "tech"
excerpt: "从回调地狱到 Promise 再到 async/await，全面梳理 JavaScript 异步编程的演进之路。"
---

## 引言 {#s-intro}

JavaScript 的异步模型是其最强大也最容易让人困惑的特性之一。从最早的回调函数，到 ES6 引入的 Promise，再到 ES2017 的 `async/await`，异步编程的方式在不断演进。

**异步不等于并发**，这句话到底意味着什么？

> 如果你曾经被回调地狱折磨过——这篇文章就是为你写的。

## 事件循环：JavaScript 的心脏 {#s-el}

事件循环（Event Loop）是协调异步操作的核心机制。存在两个队列：**宏任务队列**和**微任务队列**。

### 微任务 vs 宏任务 {#s-micro}

`Promise.then()` 属于微任务，而 `setTimeout` 属于宏任务。

```javascript
console.log('1. 同步代码开始');
setTimeout(() => { console.log('4. 宏任务'); }, 0);
Promise.resolve().then(() => { console.log('3. 微任务'); });
console.log('2. 同步代码结束');
```

## Promise {#s-pro}

Promise 解决了回调嵌套的问题，让异步代码可以链式调用。

## Async/Await {#s-async}

`async/await` 是 Promise 的语法糖。

## 最佳实践 {#s-best}

- **始终处理 rejection**
- **避免不必要的串行 await** — 使用 `Promise.all()`

## 结语 {#s-end}

**理解原理，胜过记忆 API**。
