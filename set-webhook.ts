import { setTelegramWebhook } from '@/util';

try {
  await setTelegramWebhook();
} catch (error) {
  console.error(error);
  process.exit(1);
}
