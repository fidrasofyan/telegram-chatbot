import { createFactory } from 'hono/factory';
import { db } from '@/database';
import {
  getSession,
  resetSession,
  setSession,
} from '@/repository/telegram';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

const factory = createFactory();

export const setSystemPromptHandler =
  factory.createHandlers(async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    if (!body.message) {
      return next();
    }

    const req = {
      messageID: body.message.message_id,
      chatID: body.message.chat.id,
      threadID: body.message.message_thread_id,
      command: body.message.text,
      text: body.message.text,
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    // Set command
    let session = await getSession({
      chatID: req.chatID,
      threadID: req.threadID,
    });
    if (session.last_command) {
      req.command = session.last_command;
    }

    if (
      req.command?.toLowerCase() !== '/set_system_prompt'
    ) {
      return next();
    }

    // Set step
    if (!session.next_step) {
      session = await setSession({
        chatID: req.chatID,
        threadID: req.threadID,
        command: req.command,
        nextStep: 1,
      });
    }

    switch (session.next_step) {
      // Type custom system prompt
      case 1: {
        await setSession({
          chatID: req.chatID,
          threadID: req.threadID,
          command: req.command,
          nextStep: 2,
        });

        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          parse_mode: 'HTML',
          text: '<i>Type custom system prompt...</i>',
        } satisfies TelegramResponse);
      }

      // Set custom system prompt
      case 2: {
        await resetSession({
          chatID: req.chatID,
          threadID: req.threadID,
        });

        await db
          .updateTable('threads')
          .set({
            system_prompt: req.text,
            updated_at: new Date(),
          })
          .where('chat_id', '=', `${req.chatID}`)
          .where('thread_id', '=', `${req.threadID}`)
          .executeTakeFirstOrThrow();

        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          text: 'System prompt has been successfully changed',
        } satisfies TelegramResponse);
      }

      default:
        await resetSession({
          chatID: req.chatID,
          threadID: req.threadID,
        });
        return c.json({
          method: 'sendMessage',
          message_thread_id: req.threadID,
          chat_id: req.chatID,
          parse_mode: 'HTML',
          text: '<i>Unhandled step</i>',
        } satisfies TelegramResponse);
    }
  });
