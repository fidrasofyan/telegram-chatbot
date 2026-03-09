import { rm } from 'node:fs/promises';
import { Cron } from 'croner';
import { DateTime } from 'luxon';
import { config } from './config';
import { db } from './database';
import { safePath } from './util';

const errorHandler = (e: unknown) => {
  console.error('Cron job failed:', e);
};

// At 3 AM every day
export const dbCleanupCron = new Cron(
  '0 3 * * *',
  { catch: errorHandler },
  async () => {
    if (config.THREAD_INACTIVITY_DAYS === 0) {
      return;
    }

    console.log(
      `${DateTime.now().setZone(config.APP_TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss')} Cron: cleaning up old threads...`,
    );

    const threadInactivityCutoffDate = DateTime.now().minus(
      {
        days: config.THREAD_INACTIVITY_DAYS,
      },
    );

    await db.transaction().execute(async (trx) => {
      // Get threads that have no activity for THREAD_INACTIVITY_DAYS
      const threads = await trx
        .selectFrom('threads')
        .select(['chat_id', 'thread_id'])
        .where(
          'updated_at',
          '<',
          threadInactivityCutoffDate.toJSDate(),
        )
        .forUpdate()
        .execute();

      // Delete assets
      for (const thread of threads) {
        const dirPath = safePath(
          `${thread.chat_id}-${thread.thread_id}`,
        );

        await rm(dirPath, {
          recursive: true,
          force: true,
        });
      }

      // Delete threads
      await trx
        .deleteFrom('threads')
        .where(
          'chat_id',
          'in',
          threads.map((thread) => thread.chat_id),
        )
        .where(
          'thread_id',
          'in',
          threads.map((thread) => thread.thread_id),
        )
        .execute();

      // Delete messages
      await trx
        .deleteFrom('messages')
        .where(
          'chat_id',
          'in',
          threads.map((thread) => thread.chat_id),
        )
        .where(
          'thread_id',
          'in',
          threads.map((thread) => thread.thread_id),
        )
        .execute();
    });

    console.log(
      `${DateTime.now().setZone(config.APP_TIMEZONE).toFormat('yyyy-MM-dd HH:mm:ss')} Cron: cleanup complete`,
    );
  },
);

// Will there be no executions?
if (
  !dbCleanupCron.nextRun() &&
  !dbCleanupCron.previousRun()
) {
  console.error('Cron job not scheduled');
  process.exit(1);
}
