
# Stage 1: Builder
FROM oven/bun:1.3.10-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Production
FROM oven/bun:1.3.10-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

ENV NODE_ENV=production
ENV PORT=3000

USER appuser
EXPOSE 3000
CMD ["bun", "run", "src/app.ts"]
