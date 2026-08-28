# Comments Worker

> English | **[中文文档](README_CN.md)**

Cloudflare Worker backend for the Haprial blog comments system.

## Features

- Comment CRUD operations
- Like system
- Admin dashboard
- Rate limiting
- Spam protection
- Email notifications (via Resend)

## Setup

### 1. Prerequisites

- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)
- Resend account (for email notifications)

### 2. Create D1 Database

```bash
wrangler d1 create haprial-comments
```

Update `wrangler.toml` with the database ID.

### 3. Initialize Database

```bash
wrangler d1 execute haprial-comments --file=schema.sql
```

### 4. Set Secrets

```bash
# Admin token (generate a strong random string)
wrangler secret put ADMIN_TOKEN

# Resend API key (for email notifications)
wrangler secret put RESEND_API_KEY

# Notification sender email
wrangler secret put NOTIFY_FROM
```

### 5. Deploy

```bash
wrangler deploy
```

### 6. Configure CORS

Update `wrangler.toml`:

```toml
[vars]
CORS_ORIGIN = "https://your-domain.com"
```

## API Endpoints

### Comments

- `GET /api/comments?page=/posts/slug/` - Get comments
- `POST /api/comments` - Create comment
- `POST /api/comments/:id/like` - Like comment

### Admin

- `POST /api/admin/auth` - Login
- `GET /api/admin/comments` - List comments
- `POST /api/admin/comments` - Create comment
- `DELETE /api/admin/comments/:id` - Delete comment
- `GET /api/admin/articles` - List articles
- `POST /api/admin/articles` - Create article
- `PUT /api/admin/articles/:id` - Update article
- `DELETE /api/admin/articles/:id` - Delete article

## Email Notifications

The worker can send email notifications when someone replies to a comment.

### Setup

1. Create a [Resend](https://resend.com) account
2. Verify your domain in Resend
3. Get your API key
4. Set the secrets:

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put NOTIFY_FROM
```

### Configuration

Set `NOTIFY_FROM` to your verified email:

```
Your Blog Name <noreply@your-domain.com>
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_TOKEN` | Admin authentication token |
| `CORS_ORIGIN` | Allowed origin for CORS |
| `RESEND_API_KEY` | Resend API key for emails |
| `NOTIFY_FROM` | Sender email address |
| `SITE_URL` | Blog URL (for email links) |

## License

MIT License
