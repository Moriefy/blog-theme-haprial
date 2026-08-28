---
title: Mermaid 图表完全指南：从入门到精通
date: 2026-09-03
tags: [图表, Mermaid, 工具, 可视化]
category: tech
excerpt: 一篇文章展示 Mermaid 支持的所有图表类型：流程图、序列图、饼图，以及子图、样式、注解等高级用法。
---

Mermaid 是一种用文本语法绘制图表的工具。不需要拖拽、不需要鼠标，纯文本就能生成专业级的图表。这篇文章展示本站支持的所有 Mermaid 语法。

## 基础流程图

最简单的流程图，从上到下：

```mermaid
graph TD
    A[开始] --> B{是否准备好?}
    B -->|是| C[执行任务]
    B -->|否| D[准备资源]
    D --> B
    C --> E[结束]
```

从左到右：

```mermaid
graph LR
    A[需求分析] --> B[原型设计]
    B --> C[开发实现]
    C --> D[测试验证]
    D --> E[上线发布]
```

## 多种节点形状

```mermaid
graph TD
    A[矩形节点] --> B{菱形判断}
    B --> C(圆角矩形)
    B --> D((圆形))
    B --> E[[子程序]]
```

## 边标签与虚线

```mermaid
graph TD
    A[用户请求] -->|HTTP| B[CDN]
    B -->|缓存命中| C[返回响应]
    B -.->|缓存未命中| D[源服务器]
    D --> E[返回响应]
    E --> F[缓存到边缘]
    F -.-> C
```

## 子图分组

用 `subgraph ... end` 将相关节点分组：

```mermaid
graph TD
    subgraph 前端
        A[React] --> B[状态管理]
        B --> C[组件渲染]
    end
    subgraph 后端
        D[API 网关] --> E[业务逻辑]
        E --> F[数据库]
    end
    C -->|HTTP 请求| D
    F -->|响应| C
```

另一个例子——网络协议分层：

```mermaid
graph TD
    subgraph HTTP/1.1
        A[TCP] --> B[TLS]
        B --> C[HTTP]
    end
    subgraph HTTP/2
        D[TCP] --> E[TLS]
        E --> F[HTTP/2]
    end
    subgraph HTTP/3
        G[UDP] --> H[QUIC+TLS]
        H --> I[HTTP/3]
    end
```

## 自定义节点样式

用 `style` 指令给节点上色：

```mermaid
graph LR
    A[1969 ARPANET] --> B[1983 TCP/IP]
    B --> C[1989 WWW]
    C --> D[1998 Google]
    D --> E[2007 iPhone]
    E --> F[2015 HTTP/2]
    F --> G[2020s AI]
    style A fill:#3D5A6E,color:#fff
    style D fill:#4A7B6A,color:#fff
    style G fill:#8E6B9E,color:#fff
```

## 序列图

展示多个参与者之间的交互：

```mermaid
sequenceDiagram
    participant 浏览器
    participant CDN
    participant 服务器
    participant 数据库

    浏览器->>CDN: GET /index.html
    CDN-->>浏览器: 缓存命中 ✓
    浏览器->>CDN: GET /theme/app.js
    CDN-->>浏览器: defer 加载
    浏览器->>CDN: GET /posts/xxx/article.json
    CDN->>服务器: 回源请求
    服务器->>数据库: 查询文章
    数据库-->>服务器: 返回数据
    服务器-->>CDN: 缓存并返回
```

带注解的序列图：

```mermaid
sequenceDiagram
    participant 发送方
    participant 路由器A
    participant 路由器B
    participant 接收方

    发送方->>路由器A: 包1
    发送方->>路由器A: 包2
    发送方->>路由器A: 包3
    路由器A->>路由器B: 包1
    路由器A->>路由器B: 包3
    路由器A->>接收方: 包2 (不同路径)
    路由器B->>接收方: 包1
    路由器B->>接收方: 包3
    Note over 接收方: 重新组装: 包1 + 包2 + 包3
```

## 饼图

```mermaid
pie title 文章分类占比
    "技术" : 12
    "设计" : 3
    "随想" : 4
    "文化" : 3
```

## 综合示例：博客架构

```mermaid
graph TD
    subgraph 构建
        A[Markdown] --> B[build.js]
        B --> C[HTML + CSS + JS]
    end
    subgraph 部署
        C --> D[Vercel CDN]
        D --> E[用户浏览器]
    end
    subgraph 交互
        E --> F[SPA 路由]
        F --> G[文章渲染]
        G --> H[Mermaid 图表]
        H --> I[灯箱预览]
    end
    style A fill:#3D5A6E,color:#fff
    style D fill:#4A7B6A,color:#fff
    style I fill:#8E6B9E,color:#fff
```

## 交互功能

所有图表都支持：

- **放大缩小**：点击右上角 +/- 按钮
- **拖拽平移**：放大后拖动图表
- **双指缩放**：移动端支持捏合手势

---

*这些图表全部用文本语法生成，不需要任何绘图工具。*
