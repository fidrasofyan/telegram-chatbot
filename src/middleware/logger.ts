import { createMiddleware } from 'hono/factory';
import { DateTime } from 'luxon';
import { config } from '@/config';

function colorStatus(status: number) {
  const out: { [key: string]: string } = {
    7: `\x1b[35m${status}\x1b[0m`,
    5: `\x1b[31m${status}\x1b[0m`,
    4: `\x1b[33m${status}\x1b[0m`,
    3: `\x1b[36m${status}\x1b[0m`,
    2: `\x1b[32m${status}\x1b[0m`,
    1: `\x1b[32m${status}\x1b[0m`,
    0: `\x1b[33m${status}\x1b[0m`,
  };

  const calculateStatus = (status / 100) | 0;
  return out[calculateStatus];
}

function extractUrl(stringUrl: string) {
  const url = new URL(stringUrl);
  return `${url.pathname}${url.search}`;
}

export const loggerMiddleware = createMiddleware(
  async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      await next();
      return;
    }

    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(
      `${DateTime.now().setZone(config.APP_TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss')} ${c.req.method} ${extractUrl(c.req.url)} ${colorStatus(c.res.status)} ${duration}ms`,
    );
  },
);
