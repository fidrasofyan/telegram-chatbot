import { db } from '@/database';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function getUsageHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  const thread = await db
    .selectFrom('threads')
    .select([
      'context_messages',
      'max_messages_in_context',
      'token_usage',
    ])
    .where('chat_id', '=', `${update.chatID}`)
    .where('thread_id', '=', `${update.threadID}`)
    .executeTakeFirstOrThrow();

  return {
    method: 'sendMessage',
    chat_id: update.chatID,
    message_thread_id: update.threadID,
    text: [
      `Context: ${thread.token_usage} tokens`,
      `Context messages: ${thread.context_messages} / ${thread.max_messages_in_context}`,
    ].join('\n'),
  };
}
