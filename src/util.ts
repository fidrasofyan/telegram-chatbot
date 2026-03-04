import { config } from '@/config';
import { BOT_COMMANDS } from './constant';
import type {
  TelegramInlineKeyboardMarkup,
  TelegramReplyKeyboardMarkup,
} from './types';

const telegramApiUrl =
  'https://api.telegram.org/bot' +
  config.TELEGRAM_BOT_TOKEN;

export async function sendChatAction(data: {
  chat_id: number;
  message_thread_id?: number;
  action:
    | 'typing'
    | 'upload_photo'
    | 'record_video'
    | 'upload_video'
    | 'record_voice'
    | 'upload_voice'
    | 'upload_document'
    | 'choose_sticker'
    | 'find_location'
    | 'record_video_note'
    | 'upload_video_note';
}) {
  await fetch(`${telegramApiUrl}/sendChatAction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function sendMessage(data: {
  chat_id: number;
  message_thread_id?: number;
  parse_mode?: 'HTML' | 'MarkdownV2';
  text: string;
  reply_markup?:
    | TelegramReplyKeyboardMarkup
    | TelegramInlineKeyboardMarkup;
}) {
  await fetch(`${telegramApiUrl}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function sendMessageDraft(data: {
  chat_id: number;
  message_thread_id?: number;
  draft_id: number;
  parse_mode?: 'HTML' | 'MarkdownV2';
  text: string;
}) {
  await fetch(`${telegramApiUrl}/sendMessageDraft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function editForumTopic(params: {
  chat_id: number;
  message_thread_id: number;
  name: string;
}) {
  await fetch(`${telegramApiUrl}/editForumTopic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
}

export async function deleteForumTopic(data: {
  chat_id: number;
  message_thread_id: number;
}) {
  await fetch(`${telegramApiUrl}/deleteForumTopic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function setTelegramWebhook() {
  try {
    // setWebhook
    const result = await fetch(
      `${telegramApiUrl}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `${config.WEBHOOK_DOMAIN}/telegram-bot`,
          secret_token: config.WEBHOOK_SECRET_TOKEN,
          max_connections: 50,
          drop_pending_updates: true,
          allowed_updates: ['message', 'callback_query'],
        }),
      },
    );

    if (result.status === 401 || result.status === 404) {
      console.error('Invalid Telegram Bot API token');
      process.exit(1);
    }

    // setMyCommands
    await fetch(`${telegramApiUrl}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commands: BOT_COMMANDS,
      }),
    });

    console.log(
      `Telegram webhook has been set successfully`,
    );
  } catch (error) {
    // On network error
    console.error(error);
    process.exit(1);
  }
}

export function splitMarkdown(
  text: string,
  maxPartLength: number,
): string[] {
  const lines = text.split('\n');
  const parts: string[] = [];

  let buffer = '';
  let inCodeBlock = false;
  let codeBlockOpener = '```';

  for (const line of lines) {
    const trimmed = line.trim();
    const isFence = trimmed.startsWith('```');

    const isOpeningFence = isFence && !inCodeBlock;
    const isClosingFence = isFence && inCodeBlock;

    if (isFence) {
      inCodeBlock = !inCodeBlock;
      if (isOpeningFence) codeBlockOpener = line;
    }

    const next = buffer ? `${buffer}\n${line}` : line;

    if (next.length > maxPartLength) {
      if (isClosingFence) {
        parts.push(next);
        buffer = '';
      } else if (inCodeBlock) {
        parts.push(`${buffer}\n\`\`\``);
        buffer = `${codeBlockOpener}\n${line}`;
      } else {
        if (buffer) parts.push(buffer);
        buffer = line;
      }
    } else {
      buffer = next;
    }
  }

  if (buffer) parts.push(buffer);

  return parts;
}

export function normalizeModelName(model: string): string {
  const index = model.indexOf(':');
  return index === -1 ? model : model.slice(index + 1);
}
