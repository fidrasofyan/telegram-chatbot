import { updateThread } from '@/repository/telegram';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function promptGeneratorHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  const systemPrompt = [
    `I want you to act as a prompt generator.`,
    `Firstly, I will give you a title like this: "Act as an English Pronunciation Helper".`,
    `Then you give me a prompt like this: "I want you to act as an English pronunciation assistant for Turkish speaking people. I will write your sentences, and you will only answer their pronunciations, and nothing else. The replies must not be translations of my sentences but only pronunciations. Pronunciations should use Turkish Latin letters for phonetics. Do not write explanations on replies."`,
    `You should adapt the sample prompt according to the title I gave.`,
    `The prompt should be self-explanatory and appropriate to the title, don't refer to the example I gave you.`,
  ].join(' ');

  try {
    const title = 'Prompt Generator';

    // Update thread mode
    await updateThread({
      chatID: update.chatID,
      threadID: update.threadID,
      title,
      outputFormat: 'text',
      maxMessagesInContext: 0,
      systemPrompt,
    });

    return {
      method: 'sendMessage',
      message_thread_id: update.threadID,
      chat_id: update.chatID,
      parse_mode: 'HTML',
      text: '<i>This thread is now a prompt generator</i>',
    };
  } catch (error) {
    console.error(error);
    return {
      method: 'sendMessage',
      message_thread_id: update.threadID,
      chat_id: update.chatID,
      parse_mode: 'HTML',
      text: '<i>Failed to make this thread as prompt generator</i>',
    };
  }
}
