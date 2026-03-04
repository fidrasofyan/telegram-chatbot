import { createGateway } from 'ai';
import { createFactory } from 'hono/factory';
import { config } from '@/config';
import { db } from '@/database';
import type {
  TelegramRequest,
  TelegramResponse,
} from '@/types';

const factory = createFactory();

export const fetchModelsHandler = factory.createHandlers(
  async (c, next) => {
    const body = (await c.req.json()) as TelegramRequest;

    if (!body.message) {
      return next();
    }

    const req = {
      messageThreadId: body.message.message_thread_id,
      messageId: body.message.message_id,
      chatId: body.message.chat.id,
      text: body.message.text,
    };

    if (!req.chatId || !req.messageThreadId || !req.text) {
      return next();
    }

    if (req.text.toLowerCase() !== '/fetch_models') {
      return next();
    }

    try {
      const [vercelAIResult, openRouterResult] =
        await Promise.all([
          fetchVercelAIModels(),
          fetchOpenRouterModels(),
        ]);

      if (!vercelAIResult || !openRouterResult) {
        return c.json({
          method: 'sendMessage',
          message_thread_id: req.messageThreadId,
          chat_id: req.chatId,
          parse_mode: 'HTML',
          text: '<i>Failed to fetch models</i>',
        } satisfies TelegramResponse);
      }

      return c.json({
        method: 'sendMessage',
        message_thread_id: req.messageThreadId,
        chat_id: req.chatId,
        parse_mode: 'HTML',
        text: '<i>Models have been successfully updated</i>',
      } satisfies TelegramResponse);
    } catch (error) {
      console.error(error);
      return c.json({
        method: 'sendMessage',
        message_thread_id: req.messageThreadId,
        chat_id: req.chatId,
        parse_mode: 'HTML',
        text: '<i>Failed to fetch models</i>',
      } satisfies TelegramResponse);
    }
  },
);

// Vercel AI
const vercelAI = createGateway({
  apiKey: config.VERCEL_AI_API_KEY,
});

async function fetchVercelAIModels(): Promise<boolean> {
  // Create provider
  const vercelAIProvider = await db
    .insertInto('providers')
    .values({
      id: 'vercel-ai',
      name: 'Vercel AI',
    })
    .returning(['id'])
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        name: (eb) => eb.ref('excluded.name'),
      }),
    )
    .executeTakeFirstOrThrow();

  const availableModels =
    await vercelAI.getAvailableModels();

  await db
    .insertInto('models')
    .values(
      availableModels.models.map((model) => ({
        provider_id: vercelAIProvider.id,
        model_id: model.id,
        model_name: model.name,
        model_context_length: null,
        model_description: model.description || null,
        is_enabled: false,
      })),
    )
    .onConflict((oc) =>
      oc.columns(['provider_id', 'model_id']).doUpdateSet({
        model_name: (eb) => eb.ref('excluded.model_name'),
        model_description: (eb) =>
          eb.ref('excluded.model_description'),
      }),
    )
    .execute();

  return true;
}

// OpenRouter
type OpenRouterModel = {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: Record<string, unknown>;
  pricing: Record<string, unknown>;
  top_provider: Record<string, unknown>;
  per_request_limits: Record<string, unknown> | null;
  supported_parameters: string[];
  default_parameters: Record<string, unknown>;
  expiration_date: number | null;
};

async function fetchOpenRouterModels(): Promise<boolean> {
  // Create provider
  const openRouterProvider = await db
    .insertInto('providers')
    .values({
      id: 'openrouter',
      name: 'OpenRouter',
    })
    .returning(['id'])
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        name: (eb) => eb.ref('excluded.name'),
      }),
    )
    .executeTakeFirstOrThrow();

  const result = await fetch(
    `${config.OPENROUTER_API_URL}/models`,
    {
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      },
    },
  );

  if (!result.ok) {
    return false;
  }

  const { data } = (await result.json()) as {
    data: OpenRouterModel[];
  };

  await db
    .insertInto('models')
    .values(
      data.map((model) => ({
        provider_id: openRouterProvider.id,
        model_id: model.id,
        model_name: model.name,
        model_context_length: model.context_length,
        model_description: model.description,
        is_enabled: false,
      })),
    )
    .onConflict((oc) =>
      oc.columns(['provider_id', 'model_id']).doUpdateSet({
        model_name: (eb) => eb.ref('excluded.model_name'),
        model_description: (eb) =>
          eb.ref('excluded.model_description'),
      }),
    )
    .execute();

  return true;
}
