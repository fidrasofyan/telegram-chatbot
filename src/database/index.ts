import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
  sql,
} from 'kysely';
import { Pool } from 'pg';
import { config } from '@/config';
import type { DB } from './generated-types';

const createPool = () => {
  const pool = new Pool({
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    database: config.DATABASE_NAME,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    max: config.DATABASE_CONNECTION_LIMIT,
  });

  pool.on('connect', async (client) => {
    await client.query(
      `SET TIME ZONE '${config.APP_TIMEZONE}'`,
    );
  });

  return pool;
};

const pool = createPool();

const dialect = new PostgresDialect({
  pool,
});

export const db = new Kysely<DB>({
  dialect,
});

// Test connection
try {
  await sql`SELECT 1`.execute(db);
  console.log(
    `Database: (${config.DATABASE_HOST}:${config.DATABASE_PORT} - ${config.DATABASE_NAME}) connected`,
  );
} catch (error) {
  console.error('Failed to connect to database');
  console.error(error);
  process.exit(1);
}

// Migration
export async function migrate(type: 'latest' | 'down') {
  const kysely = new Kysely<DB>({
    dialect,
  });

  const migrator = new Migrator({
    db: kysely,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, './migrations'),
    }),
  });

  const { error, results } =
    type === 'latest'
      ? await migrator.migrateToLatest()
      : await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(
        `Migration "${it.migrationName}" was ${
          type === 'latest' ? 'applied' : 'rolled back'
        } successfully`,
      );
    } else if (it.status === 'Error') {
      console.error(
        `Failed to ${type === 'latest' ? 'apply' : 'rollback'} migration "${it.migrationName}"`,
      );
    } else if (it.status === 'NotExecuted') {
      console.log(
        `Migration "${it.migrationName}" was not executed`,
      );
    }
  });

  if (results?.length === 0) {
    console.log(`No migration to apply`);
  }

  if (config.NODE_ENV === 'development') {
    await kysely.destroy();
  }

  if (error) {
    console.error('failed to migrate');
    console.error(error);
    process.exit(1);
  }
}
