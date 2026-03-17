# Stage 1: Builder
FROM oven/bun:1.3.10-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN bun run build

# Stage 2: Production
FROM oven/bun:1.3.10-alpine AS production
WORKDIR /app

COPY --from=builder /app/dist ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["./telegram-chatbot"]
