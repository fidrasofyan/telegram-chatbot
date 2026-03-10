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

export async function enableModelHandler(
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
    // Step 1: Type model name
    case 1: {
      await setSession({
        chatID: update.chatID,
        threadID: update.threadID,
        command: session.command!,
        nextStep: 2,
      });

      // Count models
      const modelsCount = (
        await db
          .selectFrom('models')
          .select(({ fn }) => [fn.countAll().as('count')])
          .executeTakeFirstOrThrow()
      ).count;

      if (!Number(modelsCount)) {
        await resetSession({
          chatID: update.chatID,
          threadID: update.threadID,
        });

        return {
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          text: 'No models found. /fetch_models first',
        };
      }

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        parse_mode: 'HTML',
        text: '<i>Type model name...</i>',
      };
    }

    // Step 2: Search model
    case 2: {
      const models = await db
        .selectFrom('models')
        .innerJoin(
          'providers',
          'providers.id',
          'models.provider_id',
        )
        .select([
          'models.id',
          'models.model_name',
          'providers.name as provider_name',
        ])
        .where(
          'models.model_name',
          'ilike',
          `%${update.text}%`,
        )
        .orderBy('models.model_name', 'asc')
        .execute();

      if (!models.length) {
        await resetSession({
          chatID: update.chatID,
          threadID: update.threadID,
        });

        return {
          method: 'sendMessage',
          chat_id: update.chatID,
          message_thread_id: update.threadID,
          parse_mode: 'HTML',
          text: '<i>No models found</i>',
        };
      }

      await setSession({
        chatID: update.chatID,
        threadID: update.threadID,
        command: session.command!,
        nextStep: 3,
      });

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        text: 'Choose model:',
        reply_markup: {
          inline_keyboard: [
            ...models.map((model) => [
              {
                text: `${model.provider_name} - ${model.model_name}`,
                callback_data: model.id,
              },
            ]),
            [
              {
                text: '❌ Cancel',
                callback_data: 'cancel',
              },
            ],
          ],
        },
      };
    }

    // Step 3: Enable model
    case 3: {
      await resetSession({
        chatID: update.chatID,
        threadID: update.threadID,
      });

      if (!update.isCallbackQuery) {
        return {
          method: 'sendMessage',
          message_thread_id: update.threadID,
          chat_id: update.chatID,
          parse_mode: 'HTML',
          text: '<i>Invalid command</i>',
        };
      }

      if (update.callbackQueryData === 'cancel') {
        return {
          method: 'editMessageText',
          message_thread_id: update.threadID,
          message_id: update.messageID,
          chat_id: update.chatID,
          parse_mode: 'HTML',
          text: '<i>Cancelled</i>',
        };
      }

      // Enable model
      const model = await db
        .updateTable('models')
        .set({
          is_enabled: true,
        })
        .where('id', '=', update.callbackQueryData)
        .returning(['model_name'])
        .executeTakeFirstOrThrow();

      return {
        method: 'editMessageText',
        message_thread_id: update.threadID,
        message_id: update.messageID,
        chat_id: update.chatID,
        parse_mode: 'HTML',
        text: `Model <b>${model.model_name}</b> is now enabled`,
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
