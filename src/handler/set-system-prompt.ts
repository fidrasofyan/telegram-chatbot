import { DEFAULT_REPLY_MARKUP } from '@/constant';
import { db } from '@/database';
import {
  getSession,
  resetSession,
  setSession,
} from '@/repository/telegram';
import type {
  TelegramResponse,
  TelegramUpdate,
} from '@/types';

export async function setSystemPromptHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  let session = await getSession({
    chatID: update.chatID,
    threadID: update.threadID,
  });

  if (!session.next_step) {
    session = await setSession({
      chatID: update.chatID,
      threadID: update.threadID,
      command: update.text!,
      nextStep: 1,
    });
  }

  switch (session.next_step) {
    // Type custom system prompt
    case 1: {
      await setSession({
        chatID: update.chatID,
        threadID: update.threadID,
        command: session.command!,
        nextStep: 2,
      });

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        parse_mode: 'HTML',
        text: '<i>Type your custom system prompt...</i>',
        reply_markup: {
          keyboard: [['Cancel']],
          resize_keyboard: true,
        },
      };
    }

    // Set custom system prompt
    case 2: {
      await resetSession({
        chatID: update.chatID,
        threadID: update.threadID,
      });

      if (update.text!.toLowerCase() === 'cancel') {
        return {
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          parse_mode: 'HTML',
          text: '<i>Cancelled</i>',
          reply_markup: DEFAULT_REPLY_MARKUP,
        };
      }

      await db
        .updateTable('threads')
        .set({
          system_prompt: update.text!,
          updated_at: new Date(),
        })
        .where('chat_id', '=', `${update.chatID}`)
        .where('thread_id', '=', `${update.threadID}`)
        .executeTakeFirstOrThrow();

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        text: 'System prompt has been successfully changed',
        reply_markup: DEFAULT_REPLY_MARKUP,
      };
    }

    default:
      await resetSession({
        chatID: update.chatID,
        threadID: update.threadID,
      });
      return {
        method: 'sendMessage',
        message_thread_id: update.threadID,
        chat_id: update.chatID,
        parse_mode: 'HTML',
        text: '<i>Unhandled step</i>',
      };
  }
}
