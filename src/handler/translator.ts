import { createFactory } from 'hono/factory';
import { updateThread } from '@/repository/telegram';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

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
        'Keep the meaning same, but do not make them sound like an AI-generated text.',
        'I want you to only reply the correction, the improvements and nothing else, do not write explanations.',
      ].join('\n'),
      casualTranslator: [
        'I want you to act as a casual English translator.',
        'I will speak to you in any language and you will detect the language, translate it into everyday English that sounds like how people actually speak in casual conversations.',
        'Use contractions, common slang, and relaxed phrasing where appropriate.',
        'Do not provide literal translations, make them sound natural and conversational in English.',
        'Do not make the translation sound like an AI-generated text.',
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
      //  Title
      let title: string;
      switch (req.text.toLowerCase()) {
        case '/translator':
          title = 'Translator';
          break;
        case '/casual_translator':
          title = 'Casual Translator';
          break;
        default:
          title = 'Translator';
          break;
      }

      // Update thread mode
      await updateThread({
        chatID: req.chatID,
        threadID: req.threadID,
        title,
        maxMessagesInContext: 0,
        systemPrompt,
      });

      // Message
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
