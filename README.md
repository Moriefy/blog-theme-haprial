# Haprial

A minimal, zero-dependency static blog generator. Built for performance and pixel-perfect reproduction.

## Quick Start

```bash
# Build
node build.js

# Preview
cd dist && npx serve
```

## Project Structure

```
haprial/
├── content/blog/       # Blog posts (Markdown)
├── lib/                # Modules (markdown parser)
│   └── markdown.js     # Zero-dependency Markdown → HTML
├── theme/              # Theme files (CSS + JS)
├── static/             # Static assets (favicon, etc.)
├── src/                # Source pages (404)
├── site.config.json    # Site configuration
├── build.js            # Build orchestrator
├── vercel.json         # Vercel deployment config
└── dist/               # Generated output
```

## Writing Posts

Create a `.md` file in `content/blog/`:

```markdown
---
title: "Your Post Title"
date: "2024 年 3 月 15 日"
dateISO: "2024-03-15"
readingTime: "8 分钟"
tags: ["Tag1", "Tag2"]
category: "tech"
excerpt: "A brief description."
---

## Heading {#custom-id}

Your content here.
```

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Framework: **Other**
4. Build Command: `node build.js`
5. Output Directory: `dist`

## Features

- ⚡ Zero dependencies - modular Node.js build (lib/markdown.js + build.js)
- 🎨 Material Design 3 theme (light/dark)
- 📱 Fully responsive
- 🔍 SEO optimized (meta, OG, JSON-LD, sitemap, RSS)
- 🚀 Static HTML - no JS required for content
- 📝 Markdown content with front matter
- 🏷️ Tags, categories, archive
- 🔗 Friend links page
- 🔎 Full-text search (client-side)
- 📖 Table of contents
- 🎭 Smooth animations (CSS + JS)
# Tue Aug  4 00:07:27 CST 2026
# test

