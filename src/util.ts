import { config } from '@/config';
import { BOT_COMMANDS } from './constant';
import type {
  TelegramInlineKeyboardMarkup,
  TelegramReplyKeyboardMarkup,
} from './types';

const TELEGRAM_API_URL =
  'https://api.telegram.org/bot' +
  config.TELEGRAM_BOT_TOKEN;

const TELEGRAM_FILE_URL =
  'https://api.telegram.org/file/bot' +
  config.TELEGRAM_BOT_TOKEN;

export async function sendChatAction(data: {
  chat_id: number;
  message_thread_id: number;
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
  await fetch(`${TELEGRAM_API_URL}/sendChatAction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function sendMessage(data: {
  chat_id: number;
  message_thread_id: number;
  parse_mode?: 'HTML' | 'MarkdownV2';
  text: string;
  reply_markup?:
    | TelegramReplyKeyboardMarkup
    | TelegramInlineKeyboardMarkup;
}) {
  await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function sendMessageDraft(data: {
  chat_id: number;
  message_thread_id: number;
  draft_id: number;
  parse_mode?: 'HTML' | 'MarkdownV2';
  text: string;
}) {
  await fetch(`${TELEGRAM_API_URL}/sendMessageDraft`, {
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
  await fetch(`${TELEGRAM_API_URL}/editForumTopic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
}

export async function getFile(file_id: string) {
  const response = await fetch(
    `${TELEGRAM_API_URL}/getFile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id }),
    },
  );

  if (!response.ok) {
    throw new Error('Failed to get file');
  }

  return (await response.json()) as {
    ok: boolean;
    result: {
      file_id: string;
      file_unique_id: string;
      file_size: number;
      file_path: string;
    };
  };
}

export async function downloadFile(
  fileID: string,
  storagePath: string,
): Promise<string> {
  const file = await getFile(fileID);
  const url = `${TELEGRAM_FILE_URL}/${file.result.file_path}`;

  const response = await fetch(url);

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Failed to download file. Status: ${response.status}`,
    );
  }

  const fileFormat = file.result.file_path.split('.').pop();

  await Bun.write(
    `./storage/${storagePath}/${file.result.file_unique_id}${fileFormat ? `.${fileFormat}` : ''}`,
    response,
    {
      createPath: true,
    },
  );

  return (
    file.result.file_unique_id +
    (fileFormat ? `.${fileFormat}` : '')
  );
}

export async function setTelegramWebhook() {
  try {
    // setWebhook
    const result = await fetch(
      `${TELEGRAM_API_URL}/setWebhook`,
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
    await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
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
  const normalized =
    index === -1 ? model : model.slice(index + 1);
  return normalized.trim();
}
