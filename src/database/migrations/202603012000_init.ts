import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    -- providers
    CREATE TABLE IF NOT EXISTS providers (
      "id" VARCHAR(200) PRIMARY KEY,
      "name" VARCHAR(200) NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "providers_name_idx" ON "providers" ("name");

    -- models
    CREATE TABLE IF NOT EXISTS models (
      "id" BIGSERIAL PRIMARY KEY,
      "provider_id" VARCHAR(200) NOT NULL,
      "model_id" VARCHAR(200) NOT NULL,
      "model_name" VARCHAR(200) NOT NULL,
      "model_context_length" INT,
      "model_description" TEXT,
      "is_enabled" BOOLEAN NOT NULL,
      CONSTRAINT "models_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "providers" ("id") ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "models_provider_id_model_id_idx" ON "models" ("provider_id", "model_id");
    CREATE INDEX IF NOT EXISTS "models_model_name_idx" ON "models" ("model_name" ASC);
    CREATE INDEX IF NOT EXISTS "models_model_context_length_idx" ON "models" ("model_context_length" DESC);

    -- users
    CREATE TABLE IF NOT EXISTS users (
      "id" BIGINT PRIMARY KEY,
      "username" VARCHAR(200),
      "first_name" VARCHAR(200),
      "last_name" VARCHAR(200),
      "default_model_id" BIGINT,
      "created_at" TIMESTAMPTZ NOT NULL,
      "updated_at" TIMESTAMPTZ,
      CONSTRAINT "users_default_model_id_fk" FOREIGN KEY ("default_model_id") REFERENCES "models" ("id") ON UPDATE CASCADE ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");
    CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at" DESC);

    -- threads
    CREATE TYPE output_format AS ENUM ('text', 'image', 'audio', 'video', 'embedding');
    CREATE TABLE IF NOT EXISTS threads (
      "id" BIGSERIAL PRIMARY KEY,
      "chat_id" BIGINT NOT NULL,
      "title" VARCHAR(200),
      "model_id" BIGINT,
      "output_format" output_format NOT NULL,
      "max_messages_in_context" INT NOT NULL,
      "system_prompt" TEXT NOT NULL,
      "last_command" VARCHAR(100),
      "next_step" SMALLINT,
      "data" JSONB,
      "created_at" TIMESTAMPTZ NOT NULL,
      "updated_at" TIMESTAMPTZ,
      CONSTRAINT "threads_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT "threads_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "models" ("id") ON UPDATE CASCADE ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS "threads_chat_id_idx" ON "threads" ("chat_id", "id");
    CREATE INDEX IF NOT EXISTS "threads_created_at_idx" ON "threads" ("created_at" DESC);

    -- messages
    CREATE TYPE message_role AS ENUM ('tool', 'assistant', 'user');
    CREATE TABLE IF NOT EXISTS messages (
      "id" BIGSERIAL PRIMARY KEY,
      "chat_id" BIGINT NOT NULL,
      "thread_id" BIGINT NOT NULL,
      "model" VARCHAR(200),
      "role" message_role NOT NULL,
      "content" TEXT NOT NULL,
      "asset" JSONB,
      "created_at" TIMESTAMPTZ NOT NULL,
      "updated_at" TIMESTAMPTZ,
      CONSTRAINT "messages_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT "messages_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "threads" ("id") ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "messages_chat_id_thread_id_idx" ON "messages" ("chat_id", "thread_id");
    CREATE INDEX IF NOT EXISTS "messages_chat_id_thread_id_role_idx" ON "messages" ("chat_id", "thread_id", "role");
    CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" ("created_at" DESC);
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS messages;
    DROP TYPE IF EXISTS message_role;
    DROP TABLE IF EXISTS threads;
    DROP TYPE IF EXISTS output_format;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS models;
    DROP TABLE IF EXISTS providers;
  `.execute(db);
}
