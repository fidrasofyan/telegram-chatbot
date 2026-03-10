import { createMiddleware } from 'hono/factory';
import { config } from '@/config';
import {
  DEFAULT_MAX_MESSAGE_IN_CONTEXT,
  DEFAULT_SYSTEM_PROMPT,
} from '@/constant';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
  TelegramUpdate,
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

    const update: TelegramUpdate = {
      isCallbackQuery: false,
      messageID: 0,
      threadID: 0,
      chatID: 0,
      text: null,
      callbackQueryData: null,
      photo: [],
    };

    if (body.message) {
      update.messageID = body.message.message_id;
      update.threadID = body.message.message_thread_id;
      update.chatID = body.message.chat.id;
      update.text =
        body.message.text || body.message.caption || null;
      update.photo = body.message.photo || [];
    } else if (body.callback_query) {
      update.isCallbackQuery = true;
      update.messageID =
        body.callback_query.message!.message_id;
      update.threadID =
        body.callback_query.message!.message_thread_id;
      update.chatID = body.callback_query.message!.chat.id;
      update.text = 'callback_query';
      update.callbackQueryData =
        body.callback_query.data || null;
      update.photo = [];
    }

    // Only allow messages in threads
    if (!update.threadID) {
      return c.json({
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        parse_mode: 'HTML',
        text: '<i>This bot can only be used in thread mode</i>',
      } satisfies TelegramResponse);
    }

    // Chat ID
    if (!config.ALLOWED_CHAT_IDS.includes(update.chatID)) {
      return c.json({
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        parse_mode: 'HTML',
        text: `Access denied. Your chat ID is <code>${update.chatID}</code>.`,
      } satisfies TelegramResponse);
    }

    // Ignore non-text messages
    if (!update.text) {
      if (body.message?.video) {
        return c.json({
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          parse_mode: 'HTML',
          text: '<i>Video is not supported</i>',
        } satisfies TelegramResponse);
      }

      if (update.photo.length > 0) {
        return c.json({
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
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
      .where('users.id', '=', `${update.chatID}`)
      .executeTakeFirst();

    if (!user) {
      await db
        .insertInto('users')
        .values({
          id: update.chatID,
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
      .where('threads.chat_id', '=', `${update.chatID}`)
      .where('threads.thread_id', '=', `${update.threadID}`)
      .executeTakeFirst();

    if (!thread) {
      const title = 'Chat';

      // Create thread
      await db
        .insertInto('threads')
        .values({
          chat_id: update.chatID,
          thread_id: update.threadID,
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

    // Set parsed update on context for downstream handlers
    c.set('telegramUpdate', update);

    await next();
  },
);
