import { createFactory } from 'hono/factory';
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

const factory = createFactory();

export const enableModelHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    const req: {
      isCallbackQuery: boolean;
      messageID: number;
      chatID: number;
      threadID: number;
      command: string | null;
      text: string | null;
      callbackQueryData: string | null;
    } = {
      isCallbackQuery: false,
      messageID: 0,
      chatID: 0,
      threadID: 0,
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

    // Set command
    let session = await getSession({
      chatID: req.chatID,
      threadID: req.threadID,
    });
    if (session.last_command) {
      req.command = session.last_command;
    }

    if (req.command?.toLowerCase() !== '/enable_model') {
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
      // Step 1: Type model name
      case 1: {
        await setSession({
          chatID: req.chatID,
          threadID: req.threadID,
          command: req.command,
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
            chatID: req.chatID,
            threadID: req.threadID,
          });

          return c.json({
            method: 'sendMessage',
            chat_id: req.chatID,
            message_thread_id: req.threadID,
            text: 'No models found. /fetch_models first',
          } satisfies TelegramResponse);
        }

        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          parse_mode: 'HTML',
          text: '<i>Type model name...</i>',
        } satisfies TelegramResponse);
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
            `%${req.text}%`,
          )
          .orderBy('models.model_name', 'asc')
          .execute();

        if (!models.length) {
          await resetSession({
            chatID: req.chatID,
            threadID: req.threadID,
          });

          return c.json({
            method: 'sendMessage',
            chat_id: req.chatID,
            message_thread_id: req.threadID,
            parse_mode: 'HTML',
            text: '<i>No models found</i>',
          } satisfies TelegramResponse);
        }

        await setSession({
          chatID: req.chatID,
          threadID: req.threadID,
          command: req.command,
          nextStep: 3,
        });

        return c.json({
          method: 'sendMessage',
          chat_id: req.chatID,
          message_thread_id: req.threadID,
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
        } satisfies TelegramResponse);
      }

      // Step 3: Enable model
      case 3: {
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

        const model = await db
          .updateTable('models')
          .set({
            is_enabled: true,
          })
          .where('id', '=', req.callbackQueryData)
          .returning(['model_name'])
          .executeTakeFirstOrThrow();

        return c.json({
          method: 'editMessageText',
          message_thread_id: req.threadID,
          message_id: req.messageID,
          chat_id: req.chatID,
          parse_mode: 'HTML',
          text: `Model <b>${model.model_name}</b> is now enabled`,
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
