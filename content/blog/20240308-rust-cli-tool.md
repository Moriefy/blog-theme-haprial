---
title: "用 Rust 重写我的命令行工具"
date: "2024-03-08"
tags: ["Rust", "性能优化", "命令行"]
category: "tech"
excerpt: "一次从 Python 到 Rust 的性能优化实践，CLI 工具速度提升显著。"
---

## 引言 {#r-start}

我有一个 Python CLI 工具，用 Rust 重写了核心逻辑——**结果出乎意料地好**。

## 为什么选 Rust {#r-why}

- **零成本抽象**
- **内存安全**

## 成果 {#r-result}

快了 **45 倍**，二进制仅 **3.2 MB**。
