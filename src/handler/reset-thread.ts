import { rm } from 'node:fs/promises';
import { createFactory } from 'hono/factory';
import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';
import { safePath } from '@/util';

const factory = createFactory();

export const resetThreadHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    const req = {
      chatID: body.message?.chat.id,
      threadID: body.message?.message_thread_id,
      text: body.message?.text,
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    // If chat command, update thread settings
    if (req.text.toLowerCase() !== 'reset thread') {
      return next();
    }

    // Delete assets
    const dirPath = safePath(
      `${req.chatID}-${req.threadID}`,
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
        .where('chat_id', '=', `${req.chatID}`)
        .where('thread_id', '=', `${req.threadID}`)
        .executeTakeFirst();

      // Delete messages
      await trx
        .deleteFrom('messages')
        .where('chat_id', '=', `${req.chatID}`)
        .where('thread_id', '=', `${req.threadID}`)
        .executeTakeFirst();
    });

    return c.json({
      method: 'sendMessage',
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      text: 'Thread reset',
      reply_markup: DEFAULT_REPLY_MARKUP,
    } satisfies TelegramResponse);
  },
);
