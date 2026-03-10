import { db } from '@/database';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function getSystemPromptHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  const thread = await db
    .selectFrom('threads')
    .select(['system_prompt'])
    .where('chat_id', '=', `${update.chatID}`)
    .where('thread_id', '=', `${update.threadID}`)
    .executeTakeFirstOrThrow();

  return {
    method: 'sendMessage',
    chat_id: update.chatID,
    message_thread_id: update.threadID,
    text: thread.system_prompt,
  };
}
