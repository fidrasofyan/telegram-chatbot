import { db } from '@/database';
import type { JsonValue } from '@/database/generated-types';

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
