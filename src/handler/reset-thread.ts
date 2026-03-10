import { rm } from 'node:fs/promises';
import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { db } from '@/database';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';
import { safePath } from '@/util';

export async function resetThreadHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  // Delete assets
  const dirPath = safePath(
    `${update.chatID}-${update.threadID}`,
  );
  await rm(dirPath, {
    recursive: true,
    force: true,
  });

  await db.transaction().execute(async (trx) => {
    // Update thread
    await trx
      .updateTable('threads')
      .set({
        context_messages: 0,
        token_usage: 0,
        updated_at: new Date(),
      })
      .where('chat_id', '=', `${update.chatID}`)
      .where('thread_id', '=', `${update.threadID}`)
      .executeTakeFirst();

    // Delete messages
    await trx
      .deleteFrom('messages')
      .where('chat_id', '=', `${update.chatID}`)
      .where('thread_id', '=', `${update.threadID}`)
      .executeTakeFirst();
  });

  return {
    method: 'sendMessage',
    chat_id: update.chatID,
    message_thread_id: update.threadID,
    text: 'Thread reset',
    reply_markup: DEFAULT_REPLY_MARKUP,
  };
}
