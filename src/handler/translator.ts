import { createFactory } from 'hono/factory';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';
import { editForumTopic } from '@/util';

const factory = createFactory();

export const translatorHandler = factory.createHandlers(
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

    if (
      req.text.toLowerCase() !== '/translator' &&
      req.text.toLowerCase() !== '/casual_translator'
    ) {
      return next();
    }

    const systemPrompts = {
      translator: [
        'I want you to act as an English translator, spelling corrector and improver.',
        'I will speak to you in any language and you will detect the language, translate it and answer in the corrected and improved version of my text, in English.',
        'I want you to replace my simplified A0-level words and sentences with correct and natural English words and sentences.',
        'Keep the meaning same, but make them more literary.',
        'Do not make the translation look like an AI wrote it.',
        'I want you to only reply the correction, the improvements and nothing else, do not write explanations.',
      ].join('\n'),
      casualTranslator: [
        'I want you to act as a casual English translator.',
        'I will speak to you in any language and you will detect the language, translate it into everyday English that sounds like how people actually speak in casual conversations.',
        'Use contractions, common slang, and relaxed phrasing where appropriate.',
        'Do not provide literal translations, make them sound natural and conversational in English.',
        'Do not make the translation look like an AI wrote it.',
        'Do not add explanations or notes, just give the translation.',
      ].join('\n'),
    };

    let systemPrompt: string;
    switch (req.text.toLowerCase()) {
      case '/translator':
        systemPrompt = systemPrompts.translator;
        break;
      case '/casual_translator':
        systemPrompt = systemPrompts.casualTranslator;
        break;
      default:
        systemPrompt = systemPrompts.translator;
        break;
    }

    try {
      // Upsert thread
      const systemPromptCount = await db
        .selectFrom('threads')
        .select(({ fn }) => [fn.countAll().as('count')])
        .where('id', '=', `${req.threadID}`)
        .where('chat_id', '=', `${req.chatID}`)
        .executeTakeFirstOrThrow();

      if (!Number(systemPromptCount.count)) {
        await db
          .insertInto('threads')
          .values({
            id: req.threadID,
            chat_id: req.chatID,
            max_messages_in_context: 0,
            system_prompt: systemPrompt,
            created_at: new Date(),
          })
          .executeTakeFirstOrThrow();
      } else {
        await db
          .updateTable('threads')
          .set({
            max_messages_in_context: 0,
            system_prompt: systemPrompt,
            updated_at: new Date(),
          })
          .where('id', '=', `${req.threadID}`)
          .where('chat_id', '=', `${req.chatID}`)
          .executeTakeFirstOrThrow();
      }

      // Reset messages
      await db
        .deleteFrom('messages')
        .where('chat_id', '=', `${req.chatID}`)
        .where('thread_id', '=', `${req.threadID}`)
        .executeTakeFirstOrThrow();

      // Update title
      let name: string;
      switch (req.text.toLowerCase()) {
        case '/translator':
          name = 'Translator';
          break;
        case '/casual_translator':
          name = 'Casual Translator';
          break;
        default:
          name = 'Translator';
          break;
      }

      await db
        .updateTable('threads')
        .set({
          title: name,
          updated_at: new Date(),
        })
        .where('id', '=', `${req.threadID}`)
        .where('chat_id', '=', `${req.chatID}`)
        .executeTakeFirstOrThrow();

      await editForumTopic({
        chat_id: req.chatID,
        message_thread_id: req.threadID,
        name,
      });

      // Send message
      let message: string;
      switch (req.text.toLowerCase()) {
        case '/translator':
          message =
            '<i>This thread is now a translator</i>';
          break;
        case '/casual_translator':
          message =
            '<i>This thread is now a casual translator</i>';
          break;
        default:
          message =
            '<i>This thread is now a translator</i>';
          break;
      }

      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
        parse_mode: 'HTML',
        text: message,
      } satisfies TelegramResponse);
    } catch (error) {
      console.error(error);
      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
        parse_mode: 'HTML',
        text: '<i>Failed to make this thread as translator</i>',
      } satisfies TelegramResponse);
    }
  },
);
