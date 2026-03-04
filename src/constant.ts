import type { BotCommand } from './types';

export const DEFAULT_MAX_MESSAGE_IN_CONTEXT = 10;

export const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful assistant.',
  'Always answer in markdown.',
  'Do not create tables under any circumstances.',
  'If you need to present structured or tabular data, use a list, bullet points, or a clear description instead.',
  'Keep responses helpful, concise, and well-organized.',
].join('\n');

export const DEFAULT_REPLY_MARKUP = {
  keyboard: [['Choose Model']],
  resize_keyboard: true,
};

export const BOT_COMMANDS: BotCommand[] = [
  {
    command: 'fetch_models',
    description: 'Fetch available models',
  },
  {
    command: 'enable_model',
    description: 'Enable model',
  },
  {
    command: 'disable_model',
    description: 'Disable model',
  },
  {
    command: 'default_model',
    description: 'Set default model for new thread',
  },
  {
    command: 'translator',
    description: 'Translator',
  },
  {
    command: 'casual_translator',
    description: 'Casual translator',
  },
  {
    command: 'prompt_generator',
    description: 'Prompt generator',
  },
  {
    command: 'chat',
    description: 'Chat',
  },
  // {
  //   command: 'delete_topic',
  //   description: 'Delete current topic',
  // },
];
