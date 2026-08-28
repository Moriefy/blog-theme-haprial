---
title: "Hello World"
date: "January 1, 2024"
dateISO: "2024-01-01"
readingTime: "3 min"
tags: ["Hello", "World"]
category: "tech"
excerpt: "Welcome to your new blog! This is your first post."
---

[TOC]

## Hello World

Welcome to your new blog! This is your first post. You can edit or delete it and start writing.

## Getting Started

### 1. Configure Your Blog

Edit `site.config.json`:

```json
{
  "title": "Your Blog Title",
  "tagline": "Your blog tagline",
  "author": "Your Name",
  "url": "https://your-domain.com"
}
```

### 2. Write Posts

Create a `.md` file in `content/blog/`:

```markdown
---
title: "Your Post Title"
date: "January 15, 2024"
dateISO: "2024-01-15"
readingTime: "5 min"
tags: ["Tag1", "Tag2"]
category: "tech"
excerpt: "A brief description."
---

Your content here...
```

### 3. Build and Deploy

```bash
# Build
node build.js

# Preview
cd dist && npx serve
```

## Features

- 🎨 Material Design 3 theme
- 🌙 Dark/Light mode
- 📱 Responsive design
- 🔍 Full-text search
- 📖 Auto-generated TOC
- 💬 Comments system (optional)
- 📊 Mermaid diagrams
- 📡 RSS feed

## Markdown Examples

### Code Blocks

```javascript
function hello() {
  console.log('Hello, World!');
}
```

### Tables

| Feature | Status |
|---------|--------|
| Markdown | ✅ |
| Mermaid | ✅ |
| TOC | ✅ |

### Mermaid Diagrams

```mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
```

### Footnotes

This is a sentence with a footnote[^1].

[^1]: This is the footnote content.

## Start Writing

Now, start your writing journey!

Happy blogging! 🎉
