import { Hono } from 'hono';
import { config } from './config';
import { dbCleanupCron } from './cron';
import { migrate } from './database';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware } from './middleware/logger';
import { telegramRouter } from './router';
import { setTelegramWebhook } from './util';

async function main() {
  if (config.NODE_ENV === 'production') {
    await migrate('latest');
    await setTelegramWebhook();
  }

  const app = new Hono();

  // Middleware
  app.use(loggerMiddleware);
  app.use(authMiddleware);

  // Handler
  app.post('/telegram-bot', ...telegramRouter);

  // HTTP Server
  const httpServer = Bun.serve({
    development: config.NODE_ENV === 'development',
    hostname: config.APP_HOST,
    port: config.APP_PORT,
    fetch: app.fetch,
  });

  console.log(`Server running at ${httpServer.url}`);

  // Graceful shutdown
  async function gracefulShutdown() {
    console.log(
      'Received signal, shutting down gracefully...',
    );

    await httpServer.stop();
    dbCleanupCron.stop();

    console.log('Server stopped');
    process.exit(0);
  }

  process.once('SIGINT', gracefulShutdown);
  process.once('SIGTERM', gracefulShutdown);
}

main();
