// App types
export type TelegramUpdate = {
  isCallbackQuery: boolean;
  messageID: number;
  chatID: number;
  threadID: number;
  text: string | null;
  callbackQueryData: string | null;
  photo: TelegramPhoto[];
};

export type AppEnv = {
  Variables: {
    telegramUpdate: TelegramUpdate;
  };
};

export type Asset = {
  file_id: string;
  file_type: 'image';
};

export type TelegramRequest = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramResponse = {
  method: 'sendMessage' | 'editMessageText';
  message_id?: number;
  chat_id: number;
  message_thread_id: number;
  parse_mode?: 'HTML' | 'MarkdownV2';
  text: string;
  reply_markup?:
    | TelegramReplyKeyboardMarkup
    | TelegramInlineKeyboardMarkup;
};

// Telegram types

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data: string;
};

export type TelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramPhoto = {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  width: number;
  height: number;
};

export type TelegramVideo = {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  width: number;
  height: number;
  duration: number;
};

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: {
    text: string;
    callback_data: string;
  }[][];
};

export type TelegramMessage = {
  message_id: number;
  message_thread_id: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
};

export type TelegramReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard: boolean;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type BotCommand = {
  command: string;
  description: string;
};
