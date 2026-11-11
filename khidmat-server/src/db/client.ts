import { Pool } from 'pg';
import { logger } from '../lib/logger';

// pgvector/pg provides registerType for node-postgres
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgvector = require('pgvector/pg');

let pool: Pool | null = null;
let isConnected = false;

export function getDatabasePool(databaseUrl?: string): Pool | null {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL client error', err);
    });
  }

  return pool;
}

export async function testDatabaseConnection(databaseUrl?: string): Promise<boolean> {
  const activePool = getDatabasePool(databaseUrl);
  if (!activePool) {
    return false;
  }

  try {
    const client = await activePool.connect();
    try {
      // Register pgvector types on this client
      await pgvector.registerType(client);
      const res = await client.query('SELECT 1 as connected');
      isConnected = res.rows.length > 0;
      logger.info('Successfully connected to PostgreSQL with PostGIS & pgvector support');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn('Could not establish connection to PostgreSQL; falling back to in-memory store', err);
    isConnected = false;
    return false;
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected;
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    logger.info('PostgreSQL connection pool closed');
  }
}
