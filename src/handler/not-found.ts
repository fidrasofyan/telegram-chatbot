import { createFactory } from 'hono/factory';
import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { resetSession } from '@/repository/telegram';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

const factory = createFactory();

export const notFoundHandler = factory.createHandlers(
  async (c) => {
    const body = (await c.req.json()) as TelegramRequest;

    if (body.message) {
      await resetSession({
        chatID: body.message.chat.id,
        threadID: body.message.message_thread_id,
      });

      return c.json({
        method: 'sendMessage',
        message_thread_id: body.message.message_thread_id,
        chat_id: body.message.chat.id,
        parse_mode: 'HTML',
        text: '<i>Unknown command</i>',
        reply_markup: DEFAULT_REPLY_MARKUP,
      } satisfies TelegramResponse);
    }

    if (body.callback_query) {
      await resetSession({
        chatID: body.callback_query.from.id,
        threadID:
          body.callback_query.message!.message_thread_id,
      });

      return c.json({
        method: 'editMessageText',
        message_id: body.callback_query.message!.message_id,
        message_thread_id:
          body.callback_query.message!.message_thread_id,
        chat_id: body.callback_query.from.id,
        parse_mode: 'HTML',
        text: '<i>Invalid session</i>',
      } satisfies TelegramResponse);
    }

    throw new Error('Unknown request type');
  },
);
