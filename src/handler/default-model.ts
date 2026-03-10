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

export async function chooseDefaultModelHandler(
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
    // Step 1: Choose model
    case 1: {
      // Get default model
      const defaultModel = await db
        .selectFrom('users')
        .innerJoin(
          'models',
          'models.id',
          'users.default_model_id',
        )
        .innerJoin(
          'providers',
          'providers.id',
          'models.provider_id',
        )
        .select([
          'models.model_name',
          'providers.name as provider_name',
        ])
        .where('users.id', '=', `${update.chatID}`)
        .executeTakeFirst();

      // Get models
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
        .where('models.is_enabled', '=', true)
        .orderBy('models.model_name', 'asc')
        .execute();

      await setSession({
        chatID: update.chatID,
        threadID: update.threadID,
        command: session.command!,
        nextStep: 2,
      });

      let currentModel = 'No model selected';
      if (defaultModel) {
        currentModel = `<b>${defaultModel.provider_name} - ${defaultModel.model_name}</b>`;
      }

      return {
        method: 'sendMessage',
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        parse_mode: 'HTML',
        text: [
          `Current: ${currentModel}\n`,
          models.length
            ? 'Choose model:'
            : 'No available models. Please enable model first.',
        ].join('\n'),
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

    // Step 2: Set default model
    case 2: {
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

      const result = await db
        .updateTable('users')
        .set({
          default_model_id: update.callbackQueryData!,
          updated_at: new Date(),
        })
        .where('id', '=', `${update.chatID}`)
        .returning(['default_model_id'])
        .executeTakeFirstOrThrow();

      const selectedModel = await db
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
        .where('models.id', '=', result.default_model_id)
        .executeTakeFirstOrThrow();

      return {
        method: 'editMessageText',
        message_thread_id: update.threadID,
        message_id: update.messageID,
        chat_id: update.chatID,
        parse_mode: 'HTML',
        text: `Default model set to <b>${selectedModel.provider_name} - ${selectedModel.model_name}</b>`,
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
