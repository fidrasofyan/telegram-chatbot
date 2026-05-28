import { db } from '@/database';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function getContextLimitHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  const thread = await db
    .selectFrom('threads')
    .select(['max_messages_in_context'])
    .where('chat_id', '=', `${update.chatID}`)
    .where('thread_id', '=', `${update.threadID}`)
    .executeTakeFirstOrThrow();

  return {
    method: 'sendMessage',
    chat_id: update.chatID,
    message_thread_id: update.threadID,
    text: `Current context limit: ${thread.max_messages_in_context} messages`,
  };
}
