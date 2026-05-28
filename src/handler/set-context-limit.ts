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

export async function setContextLimitHandler(
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
    // Prompt for new limit
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
        text: '<i>Enter new context limit (0-100)...</i>',
        reply_markup: {
          keyboard: [['Cancel']],
          resize_keyboard: true,
        },
      };
    }

    // Process & update limit
    case 2: {
      const input = update.text?.trim() ?? '';

      if (input.toLowerCase() === 'cancel') {
        await resetSession({
          chatID: update.chatID,
          threadID: update.threadID,
        });

        return {
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          parse_mode: 'HTML',
          text: '<i>Cancelled</i>',
          reply_markup: DEFAULT_REPLY_MARKUP,
        };
      }

      const limit = Number.parseInt(input, 10);
      if (
        !/^\d+$/.test(input) ||
        Number.isNaN(limit) ||
        limit < 0 ||
        limit > 100
      ) {
        // Keep nextStep = 2, let them try again
        return {
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          parse_mode: 'HTML',
          text: [
            '<b>Invalid input.</b>',
            'Please enter a number between 0 and 100,',
            'or tap Cancel.',
          ].join(' '),
          reply_markup: {
            keyboard: [['Cancel']],
            resize_keyboard: true,
          },
        };
      }

      await resetSession({
        chatID: update.chatID,
        threadID: update.threadID,
      });

      await db
        .updateTable('threads')
        .set({
          max_messages_in_context: limit,
          updated_at: new Date(),
        })
        .where('chat_id', '=', `${update.chatID}`)
        .where('thread_id', '=', `${update.threadID}`)
        .executeTakeFirstOrThrow();

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        text: `Context limit set to ${limit} messages.`,
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
        reply_markup: DEFAULT_REPLY_MARKUP,
      };
  }
}
