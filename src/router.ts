import { createFactory } from 'hono/factory';
import { chatHandler } from './handler/chat';
import { chooseModelHandler } from './handler/choose-model';
import { chooseDefaultModelHandler } from './handler/default-model';
import { disableModelHandler } from './handler/disable-model';
import { enableModelHandler } from './handler/enable-model';
import { fetchModelsHandler } from './handler/fetch-models';
import { getSystemPromptHandler } from './handler/get-system-prompt';
import { getUsageHandler } from './handler/get-usage';
import { notFoundHandler } from './handler/not-found';
import { promptGeneratorHandler } from './handler/prompt-generator';
import { resetThreadHandler } from './handler/reset-thread';
import { setSystemPromptHandler } from './handler/set-system-prompt';
import { translatorHandler } from './handler/translator';
import { getSession } from './repository/telegram';
import type {
  AppEnv,
  TelegramResponse,
  TelegramUpdate,
} from './types';

type CommandHandler = Record<
  string,
  (
    update: TelegramUpdate,
  ) => Promise<TelegramResponse | null>
>;

const commandHandlers: CommandHandler = {
  '/fetch_models': fetchModelsHandler,
  '/default_model': chooseDefaultModelHandler,
  '/enable_model': enableModelHandler,
  '/disable_model': disableModelHandler,
  'choose model': chooseModelHandler,
  'reset thread': resetThreadHandler,
  '/get_system_prompt': getSystemPromptHandler,
  '/set_system_prompt': setSystemPromptHandler,
  '/get_usage': getUsageHandler,
  '/prompt_generator': promptGeneratorHandler,
  '/translator': translatorHandler,
  '/casual_translator': translatorHandler,
  '/chat': chatHandler,
};

const factory = createFactory<AppEnv>();

export const telegramRouter = factory.createHandlers(
  async (c) => {
    const update = c.get('telegramUpdate');

    // Resolve the effective command:
    // 1. Check active session first (for multi-step flows)
    // 2. Fall back to the incoming text
    let command = update.text?.toLowerCase() ?? '';

    const session = await getSession({
      chatID: update.chatID,
      threadID: update.threadID,
    });

    if (session.command) {
      command = session.command.toLowerCase();
    }

    // Dispatch to the matching handler
    const cmdHandler = commandHandlers[command];
    if (cmdHandler) {
      return c.json(await cmdHandler(update));
    }

    // Fall through to chat (any unrecognized text)
    if (update.text && update.text !== 'callback_query') {
      return c.json(await chatHandler(update));
    }

    // Nothing matched
    return c.json(await notFoundHandler(update));
  },
);
