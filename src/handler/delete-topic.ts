import { createFactory } from 'hono/factory';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';
import { deleteForumTopic, sendMessage } from '@/util';

const factory = createFactory();

export const deleteTopicHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    if (!body.message) {
      return next();
    }

    const req = {
      chatID: body.message.chat.id,
      threadID: body.message.message_thread_id,
      text: body.message.text,
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    if (req.text.toLowerCase() !== '/delete_topic') {
      return next();
    }

    try {
      await deleteForumTopic({
        chat_id: req.chatID,
        message_thread_id: req.threadID,
      });

      await db
        .deleteFrom('messages')
        .where('chat_id', '=', `${req.chatID}`)
        .where('thread_id', '=', `${req.threadID}`)
        .execute();

      await sendMessage({
        chat_id: req.chatID,
        message_thread_id: req.threadID,
        parse_mode: 'HTML',
        text: '<i>Topic has been deleted</i>',
      });

      return c.json({});
    } catch (error) {
      console.error(error);
      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
        parse_mode: 'HTML',
        text: '<i>Failed to delete topic</i>',
      } satisfies TelegramResponse);
    }
  },
);
