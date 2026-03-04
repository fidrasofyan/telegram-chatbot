import { readFileSync } from 'node:fs';
import packageJson from '../package.json';

function readEnvSync(name: string): string {
  try {
    // Docker secret
    const secretPath = process.env[`${name}_FILE`];
    return readFileSync(secretPath ?? '', 'utf8');
  } catch (_error) {
    const env = process.env[name];
    if (!env) {
      console.error(`${name} is undefined`);
      process.exit(1);
    }
    return env;
  }
}

function parseAllowedChatIDs(value: string): number[] {
  return value
    .trim()
    .split(',')
    .map((id) => Number.parseInt(id.trim(), 10));
}

export const config = {
  // App
  NODE_ENV: readEnvSync('NODE_ENV') as
    | 'development'
    | 'production',
  APP_HOST: readEnvSync('APP_HOST'),
  APP_PORT: Number.parseInt(readEnvSync('APP_PORT'), 10),
  APP_TIMEZONE: readEnvSync('APP_TIMEZONE'),

  // AI
  VERCEL_AI_API_KEY: readEnvSync('VERCEL_AI_API_KEY'),
  OPENROUTER_API_URL: readEnvSync('OPENROUTER_API_URL'),
  OPENROUTER_API_KEY: readEnvSync('OPENROUTER_API_KEY'),

  // Telegram
  TELEGRAM_BOT_TOKEN: readEnvSync('TELEGRAM_BOT_TOKEN'),
  WEBHOOK_SECRET_TOKEN: readEnvSync('WEBHOOK_SECRET_TOKEN'),
  WEBHOOK_DOMAIN: readEnvSync('WEBHOOK_DOMAIN'),
  ALLOWED_CHAT_IDS: parseAllowedChatIDs(
    readEnvSync('ALLOWED_CHAT_IDS'),
  ),

  // Database
  DATABASE_HOST: readEnvSync('DATABASE_HOST'),
  DATABASE_PORT: Number.parseInt(
    readEnvSync('DATABASE_PORT'),
    10,
  ),
  DATABASE_USER: readEnvSync('DATABASE_USER'),
  DATABASE_PASSWORD: readEnvSync('DATABASE_PASSWORD'),
  DATABASE_NAME: readEnvSync('DATABASE_NAME'),
  DATABASE_CONNECTION_LIMIT: Number.parseInt(
    readEnvSync('DATABASE_CONNECTION_LIMIT'),
    10,
  ),
};

// Validate config
const validNodeEnvs = ['production', 'development'];

if (!validNodeEnvs.includes(config.NODE_ENV)) {
  console.error(`Invalid NODE_ENV: ${config.NODE_ENV}`);
  process.exit(1);
}

console.log(
  `Runtime: ${Bun.version} - Env: ${config.NODE_ENV} - Version: v${packageJson.version}`,
);
