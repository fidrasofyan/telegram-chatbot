import { createFactory } from 'hono/factory';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { db } from '@/database';
import {
  getSession,
  resetSession,
  setSession,
} from '@/repository/telegram';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';
import { editForumTopic, normalizeModelName } from '@/util';

const factory = createFactory();

export const chooseModelHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    const req: {
      isCallbackQuery: boolean;
      threadID: number;
      messageID: number;
      chatID: number;
      command: string | null;
      text: string | null;
      callbackQueryData: string | null;
    } = {
      isCallbackQuery: false,
      messageID: 0,
      threadID: 0,
      chatID: 0,
      command: null,
      text: null,
      callbackQueryData: null,
    };

    if (body.message) {
      req.threadID = body.message.message_thread_id;
      req.messageID = body.message.message_id;
      req.chatID = body.message.chat.id;
      req.command = body.message.text || null;
      req.text = body.message.text || null;
    } else if (body.callback_query) {
      req.isCallbackQuery = true;
      req.threadID =
        body.callback_query.message!.message_thread_id;
      req.messageID =
        body.callback_query.message!.message_id;
      req.chatID = body.callback_query.message!.chat.id;
      req.command =
        body.callback_query.message!.text || null;
      req.text = body.callback_query.message!.text || null;
      req.callbackQueryData =
        body.callback_query.data || null;
    }

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    // Get thread
    const thread = await db
      .selectFrom('threads')
      .select((eb) => [
        'threads.max_messages_in_context',
        'threads.system_prompt',
        jsonObjectFrom(
          eb
            .selectFrom('models')
            .innerJoin(
              'providers',
              'providers.id',
              'models.provider_id',
            )
            .select([
              'models.model_id',
              'models.model_name',
              'models.is_enabled',
              'models.provider_id',
              'providers.name as provider_name',
            ])
            .whereRef('models.id', '=', 'threads.model_id'),
        ).as('model'),
      ])
      .where('threads.id', '=', `${req.threadID}`)
      .where('threads.chat_id', '=', `${req.chatID}`)
      .executeTakeFirstOrThrow();

    // Set command
    let session = await getSession({
      chatID: req.chatID,
      threadID: req.threadID,
    });
    if (session.last_command) {
      req.command = session.last_command;
    }

    if (req.command?.toLowerCase() !== 'choose model') {
      return next();
    }

    // Set step
    if (!session.next_step) {
      session = await setSession({
        chatID: req.chatID,
        threadID: req.threadID,
        command: req.command,
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
          chatID: req.chatID,
          threadID: req.threadID,
          command: req.command,
          nextStep: 2,
        });

        let currentModel = 'No model selected';
        if (thread.model) {
          currentModel = `<b>${thread.model.provider_name} - ${thread.model.model_name}</b>`;
        }

        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
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
        } satisfies TelegramResponse);
      }

      // Step 2: Set thread model
      case 2: {
        await resetSession({
          chatID: req.chatID,
          threadID: req.threadID,
        });

        if (!req.isCallbackQuery) {
          return c.json({
            method: 'sendMessage',
            message_thread_id: req.threadID,
            chat_id: req.chatID,
            parse_mode: 'HTML',
            text: '<i>Invalid command</i>',
          } satisfies TelegramResponse);
        }

        if (req.callbackQueryData === 'cancel') {
          return c.json({
            method: 'editMessageText',
            message_thread_id: req.threadID,
            message_id: req.messageID,
            chat_id: req.chatID,
            parse_mode: 'HTML',
            text: '<i>Cancelled</i>',
          } satisfies TelegramResponse);
        }

        const result = await db
          .updateTable('threads')
          .set({
            model_id: req.callbackQueryData,
            updated_at: new Date(),
          })
          .where('id', '=', `${req.threadID}`)
          .where('chat_id', '=', `${req.chatID}`)
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
          .where('models.id', '=', result.model_id)
          .executeTakeFirstOrThrow();

        // Update title
        editForumTopic({
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          name: `Chat - ${normalizeModelName(selectedModel.model_name)}`,
        });

        return c.json({
          method: 'editMessageText',
          message_thread_id: req.threadID,
          message_id: req.messageID,
          chat_id: req.chatID,
          parse_mode: 'HTML',
          text: `Model set to <b>${selectedModel.provider_name} - ${selectedModel.model_name}</b>`,
        } satisfies TelegramResponse);
      }

      default:
        await resetSession({
          chatID: req.chatID,
          threadID: req.threadID,
        });

        return c.json({
          method: 'sendMessage',
          message_thread_id: req.threadID,
          chat_id: req.chatID,
          parse_mode: 'HTML',
          text: '<i>Unhandled step</i>',
        } satisfies TelegramResponse);
    }
  },
);
