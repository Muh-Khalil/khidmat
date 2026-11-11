import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getDatabasePool } from './client';
import { logger } from '../lib/logger';

dotenv.config();

export async function runMigrations() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error('DATABASE_URL is not set in environment or .env');
  }

  const client = await pool.connect();

  try {
    logger.info('Starting database migration...');

    // 1. Ensure schema_migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch already applied migrations
    const appliedRes = await client.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r: { name: string }) => r.name));

    // 2. Base schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath) && !appliedSet.has('schema.sql')) {
      logger.info('Applying base schema (schema.sql)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['schema.sql']);
      appliedSet.add('schema.sql');
      logger.info('Base schema applied successfully');
    } else {
      logger.info('Base schema already applied, skipping.');
    }

    // 3. Incremental migrations in migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (appliedSet.has(file)) {
          logger.info(`Migration ${file} already applied, skipping.`);
          continue;
        }

        logger.info(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          logger.info(`Successfully applied migration: ${file}`);
        } catch (migrationErr) {
          await client.query('ROLLBACK');
          logger.error(`Failed to apply migration: ${file}`, migrationErr);
          throw migrationErr;
        }
      }
    }

    logger.info('All database migrations completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}
