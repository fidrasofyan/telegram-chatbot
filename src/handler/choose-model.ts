import { jsonObjectFrom } from 'kysely/helpers/postgres';
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
import { editForumTopic, normalizeModelName } from '@/util';

export async function chooseModelHandler(
  update: TelegramUpdate,
): Promise<TelegramResponse> {
  // Get thread
  const thread = await db
    .selectFrom('threads')
    .select((eb) => [
      'threads.title',
      jsonObjectFrom(
        eb
          .selectFrom('models')
          .innerJoin(
            'providers',
            'providers.id',
            'models.provider_id',
          )
          .select([
            'models.model_name',
            'providers.name as provider_name',
          ])
          .whereRef('models.id', '=', 'threads.model_id'),
      ).as('model'),
    ])
    .where('threads.chat_id', '=', `${update.chatID}`)
    .where('threads.thread_id', '=', `${update.threadID}`)
    .executeTakeFirstOrThrow();

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
      if (thread.model) {
        currentModel = `<b>${thread.model.provider_name} - ${thread.model.model_name}</b>`;
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

    // Step 2: Update thread model
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

      await db
        .updateTable('threads')
        .set({
          model_id: update.callbackQueryData!,
          updated_at: new Date(),
        })
        .where('chat_id', '=', `${update.chatID}`)
        .where('thread_id', '=', `${update.threadID}`)
        .returning(['model_id'])
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
        .where('models.id', '=', update.callbackQueryData!)
        .executeTakeFirstOrThrow();

      // Update title
      editForumTopic({
        chat_id: update.chatID,
        message_thread_id: update.threadID,
        name: `${thread.title || 'Chat'} - ${normalizeModelName(selectedModel.model_name)}`,
      });

      return {
        method: 'editMessageText',
        message_thread_id: update.threadID,
        message_id: update.messageID,
        chat_id: update.chatID,
        parse_mode: 'HTML',
        text: `Model set to <b>${selectedModel.provider_name} - ${selectedModel.model_name}</b>`,
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
