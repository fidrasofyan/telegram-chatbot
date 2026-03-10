import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { resetSession } from '@/repository/telegram';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function notFoundHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  await resetSession({
    chatID: update.chatID,
    threadID: update.threadID,
  });

  if (update.isCallbackQuery) {
    return {
      method: 'editMessageText',
      message_id: update.messageID,
      message_thread_id: update.threadID,
      chat_id: update.chatID,
      parse_mode: 'HTML',
      text: '<i>Invalid session</i>',
    };
  }

  return {
    method: 'sendMessage',
    message_thread_id: update.threadID,
    chat_id: update.chatID,
    parse_mode: 'HTML',
    text: '<i>Unknown command</i>',
    reply_markup: DEFAULT_REPLY_MARKUP,
  };
}
