import { createMiddleware } from 'hono/factory';
import { config } from '@/config';
import {
  DEFAULT_MAX_MESSAGE_IN_CONTEXT,
  DEFAULT_SYSTEM_PROMPT,
} from '@/constant';
import { db } from '@/database';
import type {
  TelegramPhoto,
  TelegramRequest,
  TelegramResponse,
} from '@/types';

export const authMiddleware = createMiddleware(
  async (c, next) => {
    // Token
    const secretToken = c.req.header(
      'X-Telegram-Bot-Api-Secret-Token',
    );
    if (secretToken !== config.WEBHOOK_SECRET_TOKEN) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        401,
      );
    }

    const body = (await c.req.json()) as TelegramRequest;

    const req: {
      isCallbackQuery: boolean;
      messageID: number;
      threadID: number;
      chatID: number;
      text: string | null;
      photo: TelegramPhoto[];
    } = {
      isCallbackQuery: false,
      messageID: 0,
      threadID: 0,
      chatID: 0,
      text: null,
      photo: [],
    };

    if (body.message) {
      req.messageID = body.message.message_id;
      req.threadID = body.message.message_thread_id;
      req.chatID = body.message.chat.id;
      req.text =
        body.message.text || body.message.caption || null;
      req.photo = body.message.photo || [];
    } else if (body.callback_query) {
      req.isCallbackQuery = true;
      req.messageID =
        body.callback_query.message!.message_id;
      req.threadID =
        body.callback_query.message!.message_thread_id;
      req.chatID = body.callback_query.message!.chat.id;
      req.text = body.callback_query.message!.text || null;
      req.photo = [];
    }

    // Only allow messages in threads
    if (!req.threadID) {
      return c.json({
        method: 'sendMessage',
        chat_id: req.chatID,
        message_thread_id: req.threadID,
        parse_mode: 'HTML',
        text: '<i>This bot can only be used in thread mode</i>',
      } satisfies TelegramResponse);
    }

    // Chat ID
    if (!config.ALLOWED_CHAT_IDS.includes(req.chatID)) {
      return c.json({
        method: 'sendMessage',
        chat_id: req.chatID,
        message_thread_id: req.threadID,
        parse_mode: 'HTML',
        text: `Access denied. Your chat ID is <code>${req.chatID}</code>.`,
      } satisfies TelegramResponse);
    }

    // Ignore non-text messages
    if (!req.text) {
      if (body.message?.video) {
        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          parse_mode: 'HTML',
          text: '<i>Video is not supported</i>',
        } satisfies TelegramResponse);
      }

      if (req.photo.length > 0) {
        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          parse_mode: 'HTML',
          text: '<i>Missing prompt. Please send a photo with a prompt</i>',
        } satisfies TelegramResponse);
      }
      return c.json({});
    }

    // Check if user exists
    const user = await db
      .selectFrom('users')
      .select(['users.id'])
      .where('users.id', '=', `${req.chatID}`)
      .executeTakeFirst();

    if (!user) {
      await db
        .insertInto('users')
        .values({
          id: req.chatID,
          username: body.message?.from?.username,
          first_name: body.message?.from?.first_name,
          last_name: body.message?.from?.last_name,
          created_at: new Date(),
        })
        .executeTakeFirstOrThrow();
    }

    // Check if thread exists
    const thread = await db
      .selectFrom('threads')
      .select(['threads.chat_id', 'threads.thread_id'])
      .where('threads.chat_id', '=', `${req.chatID}`)
      .where('threads.thread_id', '=', `${req.threadID}`)
      .executeTakeFirst();

    if (!thread) {
      const title = 'Chat';

      // Create thread
      await db
        .insertInto('threads')
        .values({
          chat_id: req.chatID,
          thread_id: req.threadID,
          title,
          output_format: 'text',
          system_prompt: DEFAULT_SYSTEM_PROMPT,
          context_messages: 0,
          max_messages_in_context:
            DEFAULT_MAX_MESSAGE_IN_CONTEXT,
          token_usage: 0,
          created_at: new Date(),
        })
        .executeTakeFirstOrThrow();
    }

    await next();
  },
);
