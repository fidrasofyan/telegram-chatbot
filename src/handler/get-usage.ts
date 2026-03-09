import { createFactory } from 'hono/factory';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

const factory = createFactory();

export const getUsageHandler = factory.createHandlers(
  async (c, next) => {
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

    if (req.text.toLowerCase() !== '/get_usage') {
      return next();
    }

    const thread = await db
      .selectFrom('threads')
      .select([
        'context_messages',
        'max_messages_in_context',
        'token_usage',
      ])
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .executeTakeFirstOrThrow();

    return c.json({
      method: 'sendMessage',
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      text: [
        `Context: ${thread.token_usage} tokens`,
        `Context messages: ${thread.context_messages} / ${thread.max_messages_in_context}`,
      ].join('\n'),
    } satisfies TelegramResponse);
  },
);
