---
title: "Hello World"
date: "January 1, 2024"
dateISO: "2024-01-01"
readingTime: "5 min"
tags: ["Hello", "World", "Tutorial"]
category: "tech"
excerpt: "Welcome to your new blog! This is your first post showcasing all supported features."
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

## Mermaid Diagrams

Haprial supports three types of Mermaid diagrams: Flowcharts, Sequence Diagrams, and Pie Charts.

### Flowchart (Top-Down)

```mermaid
graph TD
    Start[🚀 Start] --> Config[⚙️ Configure]
    Config --> Write[📝 Write Posts]
    Write --> Build[🔨 Build]
    Build --> Deploy[☁️ Deploy]
    Deploy --> Done[✅ Done!]
    
    Config -->|Need help?| Docs[📖 Read Docs]
    Docs --> Write
```

### Flowchart (Left-Right)

```mermaid
graph LR
    A[User] -->|Visit| B[Browser]
    B -->|Request| C[Server]
    C -->|Response| B
    B -->|Render| D[Page]
    D -->|Interact| A
```

### Flowchart with Decision

```mermaid
graph TD
    A[📝 Write Article] --> B{Has Front Matter?}
    B -->|Yes| C[✅ Valid Article]
    B -->|No| D[❌ Add Front Matter]
    D --> A
    C --> E[🔨 Build]
    E --> F{Build Success?}
    F -->|Yes| G[🚀 Deploy]
    F -->|No| H[🐛 Fix Errors]
    H --> A
    G --> I[🎉 Published!]
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant B as 🌐 Browser
    participant S as 🖥️ Server
    participant D as 💾 Database
    
    U->>B: Open Blog
    B->>S: GET /index.html
    S->>D: Query Articles
    D-->>S: Return Data
    S-->>B: HTML + CSS + JS
    B-->>U: Render Page
    
    U->>B: Click Article
    B->>S: GET /posts/slug
    S->>D: Query Article
    D-->>S: Return Content
    S-->>B: Article JSON
    B-->>U: Show Article
```

### Sequence Diagram (API Flow)

```mermaid
sequenceDiagram
    participant C as 📱 Client
    participant W as ⚡ Worker
    participant D1 as 🗄️ D1 Database
    participant R as 📧 Resend
    
    C->>W: POST /api/comments
    W->>W: Validate Input
    W->>D1: Insert Comment
    D1-->>W: Success
    
    alt Has Parent Comment
        W->>D1: Query Parent Email
        D1-->>W: Parent Data
        W->>R: Send Notification
        R-->>W: Email Sent
    end
    
    W-->>C: Comment Created
```

### Pie Chart

```mermaid
pie title Blog Features
    "Material Design 3" : 30
    "Markdown Support" : 25
    "SEO Optimization" : 20
    "Comments System" : 15
    "Other Features" : 10
```

### Pie Chart (Content Distribution)

```mermaid
pie title Content Categories
    "Technology" : 40
    "Design" : 25
    "Thoughts" : 20
    "Culture" : 15
```

## Markdown Examples

### Code Blocks

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
```

### Tables

| Feature | Status | Description |
|---------|--------|-------------|
| Material Design 3 | ✅ | Light/Dark mode |
| Responsive | ✅ | All devices |
| SEO | ✅ | Meta tags, OG |
| Comments | ✅ | Optional |

### Footnotes

This is a sentence with a footnote[^1]. And another one[^2].

[^1]: This is the first footnote.
[^2]: This is the second footnote.

## Start Writing

Now, start your writing journey!

Happy blogging! 🎉
