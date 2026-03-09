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
      messageID: body.message.message_id,
      chatID: body.message.chat.id,
      threadID: body.message.message_thread_id,
      text: body.message.text,
    };

    if (!req.chatID || !req.threadID || !req.text) {
      return next();
    }

    if (req.text.toLowerCase() !== '/fetch_models') {
      return next();
    }

    try {
      await Promise.all([
        fetchVercelAIModels(),
        fetchOpenRouterModels(),
      ]);

      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
        text: 'Models have been successfully updated',
      } satisfies TelegramResponse);
    } catch (error) {
      console.error(error);
      return c.json({
        method: 'sendMessage',
        message_thread_id: req.threadID,
        chat_id: req.chatID,
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

async function fetchVercelAIModels() {
  const availableModels =
    await vercelAI.getAvailableModels();

  if (!availableModels.models.length) {
    return;
  }

  const modelIds = availableModels.models.map((m) => m.id);

  await db.transaction().execute(async (trx) => {
    // Create provider
    const vercelAIProvider = await trx
      .insertInto('providers')
      .values({
        id: 'vercel-ai',
        name: 'Vercel',
      })
      .returning(['id'])
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          name: (eb) => eb.ref('excluded.name'),
        }),
      )
      .executeTakeFirstOrThrow();

    // Insert models
    await trx
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
        oc
          .columns(['provider_id', 'model_id'])
          .doUpdateSet({
            model_name: (eb) =>
              eb.ref('excluded.model_name'),
            model_description: (eb) =>
              eb.ref('excluded.model_description'),
          }),
      )
      .execute();

    // Delete obsolete models
    await trx
      .deleteFrom('models')
      .where('provider_id', '=', vercelAIProvider.id)
      .where('model_id', 'not in', modelIds)
      .execute();
  });
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

async function fetchOpenRouterModels() {
  const result = await fetch(
    `${config.OPENROUTER_API_URL}/models`,
    {
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      },
    },
  );

  if (!result.ok) {
    return;
  }

  const { data } = (await result.json()) as {
    data: OpenRouterModel[];
  };

  if (!data.length) {
    return;
  }

  const modelIds = data.map((m) => m.id);

  await db.transaction().execute(async (trx) => {
    // Create provider
    const openRouterProvider = await trx
      .insertInto('providers')
      .values({
        id: 'openrouter',
        name: 'OR',
      })
      .returning(['id'])
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          name: (eb) => eb.ref('excluded.name'),
        }),
      )
      .executeTakeFirstOrThrow();

    // Insert models
    await trx
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
        oc
          .columns(['provider_id', 'model_id'])
          .doUpdateSet({
            model_name: (eb) =>
              eb.ref('excluded.model_name'),
            model_description: (eb) =>
              eb.ref('excluded.model_description'),
          }),
      )
      .execute();

    // Delete obsolete models
    await trx
      .deleteFrom('models')
      .where('provider_id', '=', openRouterProvider.id)
      .where('model_id', 'not in', modelIds)
      .execute();
  });
}
