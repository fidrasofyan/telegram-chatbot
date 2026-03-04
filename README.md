# Telegram Chatbot

A Telegram chatbot that connects to AI models via Vercel AI Gateway and OpenRouter, with streaming responses, model management, and thread-based conversations.

## Features

- **Multi-model AI chat** - Connect to various AI models through Vercel AI Gateway and OpenRouter
- **Streaming responses** - Real-time message drafting as the AI generates responses
- **Model management** - Fetch, enable, disable, and select models per user
- **Thread-based conversations** - Separate chat contexts per Telegram topic/thread
- **Message history** - Maintains conversation context (last 10 messages per thread)
- **Access control** - Restrict bot access to specific Telegram chat IDs
- **Webhook-based** - Handles Telegram updates via webhooks for reliable delivery

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: PostgreSQL with [Kysely](https://kysely.dev) query builder
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai) with Vercel AI Gateway and OpenRouter providers
- **Telegram**: Webhook-based Bot API with MarkdownV2 formatting

## Prerequisites

- Bun
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- API keys for your preferred AI providers:
  - [Vercel AI Gateway](https://vercel.com/ai)
  - [OpenRouter](https://openrouter.ai)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key configuration:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `WEBHOOK_SECRET_TOKEN` | Secret for webhook verification (generate with `openssl rand -hex 32`) |
| `WEBHOOK_DOMAIN` | Your public domain (e.g., `https://example.com`) |
| `ALLOWED_CHAT_IDS` | Comma-separated list of Telegram chat IDs allowed to use the bot |
| `VERCEL_AI_API_KEY` | API key for Vercel AI Gateway |
| `OPENROUTER_API_KEY` | API key for OpenRouter |

### 3. Set up the database

Create a PostgreSQL database, then run migrations:

```bash
bun run migrate-latest
```

### 4. Set the Telegram webhook

After deploying your bot, register the webhook:

```bash
bun run set-webhook
```

## Development

Start the development server with hot reload:

```bash
bun run dev
```

### AI SDK DevTools

In development mode, the AI SDK DevTools middleware is enabled. Run the dev tools UI:

```bash
bun run dev-tools
```

This provides a local dashboard for inspecting AI model calls, traces, and responses.

## Deployment

The bot is designed to run as a webhook receiver. Deploy it to any platform that supports Bun and can receive HTTPS requests.

Ensure your `WEBHOOK_DOMAIN` points to your deployment and the `/telegram-bot` endpoint is accessible.

### Docker

Build and run with Docker Compose:

```bash
# Build the image
docker compose build

# Run the container
docker compose up -d

# View logs
docker compose logs -f

# Stop the container
docker compose down
```

The Dockerfile uses a multi-stage build for minimal image size. The container runs as a non-root user with read-only filesystem.

**Configuration:**

- Ensure your `.env` file is configured with production values before building
- Database connection should point to your external PostgreSQL instance

## License

MIT
