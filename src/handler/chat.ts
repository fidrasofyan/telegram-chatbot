import { devToolsMiddleware } from '@ai-sdk/devtools';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  createGateway,
  type ImagePart,
  type LanguageModel,
  type ModelMessage,
  streamText,
  type UserModelMessage,
  wrapLanguageModel,
} from 'ai';
import { createFactory } from 'hono/factory';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { convert as telegramifyMarkdown } from 'telegram-markdown-v2';
import { config } from '@/config';
import {
  DEFAULT_MAX_MESSAGE_IN_CONTEXT,
  DEFAULT_REPLY_MARKUP,
  DEFAULT_SYSTEM_PROMPT,
} from '@/constant';
import { db } from '@/database';
import { updateThread } from '@/repository/telegram';
import type {
  Asset,
  TelegramPhoto,
  TelegramRequest,
  TelegramResponse,
} from '@/types';
import {
  downloadFile,
  editForumTopic,
  normalizeModelName,
  sendMessage,
  sendMessageDraft,
  splitMarkdown,
} from '@/util';

const factory = createFactory();

const vercelAI = createGateway({
  apiKey: config.VERCEL_AI_API_KEY,
});

const openRouter = createOpenRouter({
  apiKey: config.OPENROUTER_API_KEY,
});

export const chatHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    const req = {
      chatID: body.message?.chat.id,
      threadID: body.message?.message_thread_id,
      text: body.message?.text || body.message?.caption,
      photo: body.message?.photo || [],
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    // If chat command, update thread settings
    if (req.text.toLowerCase() === '/chat') {
      const title = 'Chat';

      // Update thread mode
      await updateThread({
        chatID: req.chatID,
        threadID: req.threadID,
        title,
        outputFormat: 'text',
        maxMessagesInContext:
          DEFAULT_MAX_MESSAGE_IN_CONTEXT,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      });

      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
        parse_mode: 'HTML',
        text: '<i>This thread is now in chat mode</i>',
        reply_markup: DEFAULT_REPLY_MARKUP,
      } satisfies TelegramResponse);
    }

    // Process chat in the background
    processChat({
      chatID: req.chatID,
      threadID: req.threadID,
      text: req.text,
      photo: req.photo,
    }).catch((error) => {
      // TODO: save error message to db
      console.error(error);

      if (req.chatID && req.threadID) {
        sendMessage({
          chat_id: req.chatID,
          message_thread_id: req.threadID,
          parse_mode: 'HTML',
          text: '<i>Something went wrong</i>',
        });
      }
    });

    // Return immediately to avoid timeout
    return c.json({});
  },
);

async function processChat(req: {
  chatID: number;
  threadID: number;
  text: string;
  photo: TelegramPhoto[];
}) {
  // Get thread
  const thread = await db
    .selectFrom('threads')
    .select((eb) => [
      'threads.title',
      'threads.max_messages_in_context',
      'threads.system_prompt',
      jsonObjectFrom(
        eb
          .selectFrom('models')
          .select([
            'models.model_id',
            'models.provider_id',
            'models.is_enabled',
          ])
          .whereRef('models.id', '=', 'threads.model_id'),
      ).as('model'),
    ])
    .where('threads.id', '=', `${req.threadID}`)
    .where('threads.chat_id', '=', `${req.chatID}`)
    .executeTakeFirstOrThrow();

  // If thread model is not set, use default model (if enabled)
  if (!thread.model) {
    const defaultModel = await db
      .selectFrom('users')
      .innerJoin(
        'models',
        'users.default_model_id',
        'models.id',
      )
      .select([
        'models.id',
        'models.model_id',
        'models.model_name',
        'models.provider_id',
        'models.is_enabled',
      ])
      .where('users.id', '=', `${req.chatID}`)
      .executeTakeFirst();

    if (defaultModel?.is_enabled) {
      // Update thread model
      await db
        .updateTable('threads')
        .set({
          model_id: defaultModel.id,
          updated_at: new Date(),
        })
        .where('id', '=', `${req.threadID}`)
        .where('chat_id', '=', `${req.chatID}`)
        .executeTakeFirstOrThrow();

      // Edit forum topic
      await editForumTopic({
        chat_id: req.chatID,
        message_thread_id: req.threadID,
        name: `${thread.title || 'Chat'} - ${normalizeModelName(defaultModel.model_name)}`,
      });

      thread.model = {
        model_id: defaultModel.model_id,
        provider_id: defaultModel.provider_id,
        is_enabled: defaultModel.is_enabled,
      };
    }
  }

  // If thread model is not set and default model is also not set or not enabled, show error
  if (!thread.model || !thread.model.is_enabled) {
    await sendMessage({
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      parse_mode: 'HTML',
      text: `<i>Please choose a model first. If you don't want to choose a model every time, set a default model.</i>`,
      reply_markup: DEFAULT_REPLY_MARKUP,
    });
    return;
  }

  // Initialize model
  let model: LanguageModel;
  switch (thread.model.provider_id) {
    case 'vercel-ai':
      if (config.NODE_ENV === 'development') {
        model = wrapLanguageModel({
          model: vercelAI(thread.model.model_id),
          middleware: devToolsMiddleware(),
        });
      } else {
        model = vercelAI(thread.model.model_id);
      }
      break;
    case 'openrouter':
      if (config.NODE_ENV === 'development') {
        model = wrapLanguageModel({
          model: openRouter(thread.model.model_id),
          middleware: devToolsMiddleware(),
        });
      } else {
        model = openRouter(thread.model.model_id);
      }
      break;
    default:
      throw new Error('Unknown provider');
  }

  // Get asset
  let asset: Asset | undefined;
  if (req.photo.length > 0) {
    const targetWidth = 600;
    const photo = req.photo.reduce((prev, current) => {
      const prevDiff = Math.abs(prev.width - targetWidth);
      const currDiff = Math.abs(
        current.width - targetWidth,
      );
      return currDiff < prevDiff ? current : prev;
    });

    if (photo) {
      asset = {
        file_id: await downloadFile(photo.file_id),
        file_type: 'image',
      };
    }
  }

  // Save user message. ID is used as draft_id
  const userMessage = await db
    .insertInto('messages')
    .values({
      chat_id: req.chatID,
      thread_id: req.threadID,
      role: 'user',
      content: req.text,
      asset,
      created_at: new Date(),
    })
    .returning(['id', 'role', 'content'])
    .executeTakeFirstOrThrow();

  // Single message for max_messages_in_context = 0
  let messages: ModelMessage[] = [
    {
      role: userMessage.role as any,
      content: [
        {
          type: 'text',
          text: userMessage.content,
        },
      ],
    },
  ];

  // Get messages for context
  if (Number(thread.max_messages_in_context) !== 0) {
    const history = await db
      .selectFrom('messages')
      .select(['role', 'content', 'asset'])
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .orderBy('created_at', 'desc')
      .limit(thread.max_messages_in_context)
      .execute();

    const reversedHistory = history.reverse();
    messages = await Promise.all(
      reversedHistory.map(async (m) => {
        const message: UserModelMessage = {
          role: m.role as any,
          content: [
            {
              type: 'text',
              text: m.content,
            },
          ],
        };

        if (m.asset) {
          const asset = m.asset as Asset;

          switch (asset.file_type) {
            case 'image': {
              const image = await Bun.file(
                `./storage/${asset.file_id}`,
              ).arrayBuffer();

              (message.content as Array<ImagePart>).push({
                type: 'image',
                image,
              });
              break;
            }
          }
        }

        return message;
      }),
    );
  }

  let fullResponse = '';
  let lastSentCharCount = 0;

  try {
    // Stream response
    const result = streamText({
      model,
      timeout: 300000, // 5 minutes
      maxOutputTokens: 8192,
      system: thread.system_prompt,
      messages: messages,
      onError: ({ error }) => {
        fullResponse = `Error: ${error}`;
      },
      onFinish: async ({ text }) => {
        fullResponse = text;
      },
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        // Reasoning start
        case 'reasoning-start': {
          await sendMessageDraft({
            chat_id: req.chatID,
            message_thread_id: req.threadID,
            draft_id: Number(userMessage.id),
            parse_mode: 'HTML',
            text: '<i>Thinking...</i>',
          });
          break;
        }
        // Text delta
        case 'text-delta': {
          fullResponse += part.text;

          // Only send if character count increased by at least 128
          if (
            fullResponse.length >=
            lastSentCharCount + 128
          ) {
            await sendMessageDraft({
              chat_id: req.chatID,
              message_thread_id: req.threadID,
              draft_id: Number(userMessage.id),
              parse_mode: 'MarkdownV2',
              text: telegramifyMarkdown(
                fullResponse,
                'escape',
              ),
            });
            lastSentCharCount = fullResponse.length;
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error(error);
    fullResponse = `Error: ${error}`;
  }

  // Send final response in parts (max 3500 chars) to avoid Telegram message limit
  const parts = splitMarkdown(fullResponse, 3500);

  for (const [index, part] of parts.entries()) {
    await sendMessage({
      chat_id: req.chatID,
      message_thread_id: req.threadID,
      parse_mode: 'MarkdownV2',
      text: telegramifyMarkdown(part, 'escape'),
      // Only set reply markup on the last message
      reply_markup:
        index === parts.length - 1
          ? DEFAULT_REPLY_MARKUP
          : undefined,
    });
  }

  // Save assistant message if max_messages_in_context is not 0
  if (Number(thread.max_messages_in_context) !== 0) {
    await db
      .insertInto('messages')
      .values({
        chat_id: req.chatID,
        thread_id: req.threadID,
        model: thread.model.model_id,
        role: 'assistant',
        content: fullResponse,
        created_at: new Date(),
      })
      .execute();
  }

  // Keep only last N messages for this thread
  const oldestToKeep = await db
    .selectFrom('messages')
    .select('id')
    .where('chat_id', '=', `${req.chatID}`)
    .where('thread_id', '=', `${req.threadID}`)
    .where('role', '!=', 'tool')
    .orderBy('created_at', 'desc')
    .offset(thread.max_messages_in_context)
    .limit(1)
    .executeTakeFirst();

  if (oldestToKeep) {
    await db
      .deleteFrom('messages')
      .where('chat_id', '=', `${req.chatID}`)
      .where('thread_id', '=', `${req.threadID}`)
      .where('role', '!=', 'tool')
      .where('id', '<=', oldestToKeep.id)
      .execute();
  }
}
