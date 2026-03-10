import { updateThread } from '@/repository/telegram';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function translatorHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse | null> {
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
    ].join(' '),
  };

  let systemPrompt: string;
  switch (update.text!.toLowerCase()) {
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
    switch (update.text!.toLowerCase()) {
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
      chatID: update.chatID,
      threadID: update.threadID,
      title,
      outputFormat: 'text',
      maxMessagesInContext: 0,
      systemPrompt,
    });

    // Message
    let message: string;
    switch (update.text!.toLowerCase()) {
      case '/translator':
        message = '<i>This thread is now a translator</i>';
        break;
      case '/casual_translator':
        message =
          '<i>This thread is now a casual translator</i>';
        break;
      default:
        message = '<i>This thread is now a translator</i>';
        break;
    }

    return {
      method: 'sendMessage',
      message_thread_id: update.threadID,
      chat_id: update.chatID,
      parse_mode: 'HTML',
      text: message,
    };
  } catch (error) {
    console.error(error);
    return {
      method: 'sendMessage',
      message_thread_id: update.threadID,
      chat_id: update.chatID,
      parse_mode: 'HTML',
      text: '<i>Failed to make this thread as translator</i>',
    };
  }
}
