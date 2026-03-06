import { createFactory } from 'hono/factory';
import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { db } from '@/database';
import type {
  Asset,
  TelegramRequest,
  TelegramResponse,
} from '@/types';

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
    const assets = (await db
      .selectFrom('messages')
      .select('asset')
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .where('asset', 'is not', null)
      .execute()) as { asset: Asset }[];

    const fileIDs = assets.map(
      (asset) => asset.asset.file_id,
    );

    for (const fileID of fileIDs) {
      const exists = await Bun.file(
        `./storage/${fileID}`,
      ).exists();

      if (exists) {
        await Bun.file(`./storage/${fileID}`).delete();
      }
    }

    // Delete messages
    await db
      .deleteFrom('messages')
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .executeTakeFirstOrThrow();

    return c.json({
      method: 'sendMessage',
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      parse_mode: 'HTML',
      text: '<i>Thread reset</i>',
      reply_markup: DEFAULT_REPLY_MARKUP,
    } satisfies TelegramResponse);
  },
);
