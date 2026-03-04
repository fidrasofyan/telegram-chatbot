import { Hono } from 'hono';
import { config } from './config';
import { migrate } from './database';
import { chatHandler } from './handler/chat';
import { chooseModelHandler } from './handler/choose-model';
import { chooseDefaultModelHandler } from './handler/default-model';
import { disableModelHandler } from './handler/disable-model';
import { enableModelHandler } from './handler/enable-model';
import { fetchModelsHandler } from './handler/fetch-models';
import { notFoundHandler } from './handler/not-found';
import { promptGeneratorHandler } from './handler/prompt-generator';
import { translatorHandler } from './handler/translator';
import { authMiddleware } from './middleware/auth';
import { loggerMiddleware } from './middleware/logger';
import { setTelegramWebhook } from './util';

if (config.NODE_ENV === 'production') {
  await migrate('latest');
  await setTelegramWebhook();
}

const app = new Hono();

// Middleware
app.use(loggerMiddleware);
app.use(authMiddleware);

// Handler
app.post(
  '/telegram-bot',
  ...fetchModelsHandler,
  ...enableModelHandler,
  ...disableModelHandler,
  ...chooseDefaultModelHandler,
  ...chooseModelHandler,
  // ...deleteTopicHandler,
  ...translatorHandler,
  ...promptGeneratorHandler,
  // The order after this matters
  ...chatHandler,
  ...notFoundHandler,
);

const server = Bun.serve({
  development: config.NODE_ENV === 'development',
  hostname: config.APP_HOST,
  port: config.APP_PORT,
  fetch: app.fetch,
});

console.log(`Server running at ${server.url}`);

// Graceful shutdown
async function gracefulShutdown() {
  console.log(
    'SIGINT received, shutting down gracefully...',
  );
  await server.stop();
  console.log('Server stopped');
  process.exit(0);
}

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);
