// App types

export type TelegramRequest = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramResponse = {
  method: 'sendMessage' | 'editMessageText';
  message_id?: number;
  chat_id: number;
  message_thread_id?: number;
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
