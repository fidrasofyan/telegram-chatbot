import { createFactory } from 'hono/factory';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

const factory = createFactory();

export const getSystemPromptHandler =
  factory.createHandlers(async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    if (!body.message) {
      return next();
    }

    const req = {
      messageID: body.message.message_id,
      chatID: body.message.chat.id,
      threadID: body.message.message_thread_id,
      text: body.message.text,
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    if (req.text.toLowerCase() !== '/get_system_prompt') {
      return next();
    }

    const thread = await db
      .selectFrom('threads')
      .select(['system_prompt'])
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .executeTakeFirstOrThrow();

    return c.json({
      method: 'sendMessage',
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      text: thread.system_prompt,
    } satisfies TelegramResponse);
  });
