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
    .where('threads.chat_id', '=', data.chatID.toString())
    .where(
      'threads.thread_id',
      '=',
      data.threadID.toString(),
    )
    .returning([
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
      'threads.last_command',
      'threads.next_step',
      'threads.data',
    ])
    .where('threads.chat_id', '=', data.chatID.toString())
    .where(
      'threads.thread_id',
      '=',
      data.threadID.toString(),
    )
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
    .where('threads.chat_id', '=', data.chatID.toString())
    .where(
      'threads.thread_id',
      '=',
      data.threadID.toString(),
    )
    .returning([
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
  await db.transaction().execute(async (trx) => {
    // Update thread
    await trx
      .updateTable('threads')
      .set({
        title: data.title,
        output_format: data.outputFormat,
        system_prompt: data.systemPrompt,
        context_messages: 0,
        max_messages_in_context: data.maxMessagesInContext,
        token_usage: 0,
        updated_at: new Date(),
      })
      .where('chat_id', '=', `${data.chatID}`)
      .where('thread_id', '=', `${data.threadID}`)
      .executeTakeFirstOrThrow();

    // Delete messages
    await trx
      .deleteFrom('messages')
      .where('chat_id', '=', `${data.chatID}`)
      .where('thread_id', '=', `${data.threadID}`)
      .executeTakeFirstOrThrow();
  });

  // Delete assets
  await rm(`./storage/${data.chatID}-${data.threadID}`, {
    recursive: true,
    force: true,
  });

  // Get model name
  const model = await db
    .selectFrom('threads')
    .innerJoin('models', 'threads.model_id', 'models.id')
    .select('models.model_name as name')
    .where('threads.chat_id', '=', `${data.chatID}`)
    .where('threads.thread_id', '=', `${data.threadID}`)
    .executeTakeFirst();

  // Edit forum topic
  await editForumTopic({
    chat_id: data.chatID,
    message_thread_id: data.threadID,
    name: `${data.title} ${model?.name ? `- ${normalizeModelName(model.name)}` : ''}`.trim(),
  });
}
