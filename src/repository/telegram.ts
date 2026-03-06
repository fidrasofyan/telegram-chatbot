import { rm } from 'node:fs/promises';
import { db } from '@/database';
import type {
  JsonValue,
  OutputFormat,
} from '@/database/generated-types';
import { editForumTopic, normalizeModelName } from '@/util';

export async function setSession(data: {
  chatID: number;
  threadID: number;
  command: string;
  nextStep: number;
  data?: JsonValue;
}) {
  return await db
    .updateTable('threads')
    .set({
      last_command: data.command,
      next_step: data.nextStep,
      data: data.data,
      updated_at: new Date(),
    })
    .where('threads.id', '=', data.threadID.toString())
    .where('threads.chat_id', '=', data.chatID.toString())
    .returning([
      'threads.id',
      'threads.last_command',
      'threads.next_step',
      'threads.data',
    ])
    .executeTakeFirstOrThrow();
}

export async function getSession(data: {
  chatID: number;
  threadID: number;
}) {
  return await db
    .selectFrom('threads')
    .select([
      'threads.id',
      'threads.last_command',
      'threads.next_step',
      'threads.data',
    ])
    .where('threads.id', '=', data.threadID.toString())
    .where('threads.chat_id', '=', data.chatID.toString())
    .executeTakeFirstOrThrow();
}

export async function resetSession(data: {
  chatID: number;
  threadID: number;
}) {
  return await db
    .updateTable('threads')
    .set({
      last_command: null,
      next_step: null,
      data: null,
      updated_at: new Date(),
    })
    .where('threads.id', '=', data.threadID.toString())
    .where('threads.chat_id', '=', data.chatID.toString())
    .returning([
      'threads.id',
      'threads.last_command',
      'threads.next_step',
      'threads.data',
    ])
    .executeTakeFirstOrThrow();
}

export async function updateThread(data: {
  chatID: number;
  threadID: number;
  title: string;
  outputFormat: OutputFormat;
  maxMessagesInContext: number;
  systemPrompt: string;
}) {
  // Update thread
  await db
    .updateTable('threads')
    .set({
      title: data.title,
      output_format: data.outputFormat,
      max_messages_in_context: data.maxMessagesInContext,
      system_prompt: data.systemPrompt,
      updated_at: new Date(),
    })
    .where('id', '=', `${data.threadID}`)
    .where('chat_id', '=', `${data.chatID}`)
    .executeTakeFirstOrThrow();

  // Delete assets
  await rm(`./storage/${data.chatID}-${data.threadID}`, {
    recursive: true,
    force: true,
  });

  // Delete messages
  await db
    .deleteFrom('messages')
    .where('chat_id', '=', `${data.chatID}`)
    .where('thread_id', '=', `${data.threadID}`)
    .executeTakeFirstOrThrow();

  // Get model name
  const model = await db
    .selectFrom('threads')
    .innerJoin('models', 'threads.model_id', 'models.id')
    .select('models.model_name as name')
    .where('threads.id', '=', `${data.threadID}`)
    .where('threads.chat_id', '=', `${data.chatID}`)
    .executeTakeFirst();

  // Edit forum topic
  await editForumTopic({
    chat_id: data.chatID,
    message_thread_id: data.threadID,
    name: `${data.title} ${model?.name ? `- ${normalizeModelName(model.name)}` : ''}`.trim(),
  });
}
