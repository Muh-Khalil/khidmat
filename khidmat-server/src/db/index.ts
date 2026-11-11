import { IDatabaseRepository } from './repository';
import { MemoryDatabaseRepository } from './repositories/memoryRepository';
import { PostgresDatabaseRepository } from './repositories/postgresRepository';
import { getDatabasePool, testDatabaseConnection } from './client';
import { logger } from '../lib/logger';

let activeRepo: IDatabaseRepository | null = null;
const memoryRepo = new MemoryDatabaseRepository();

export async function initDatabase(databaseUrl?: string): Promise<IDatabaseRepository> {
  const url = databaseUrl || process.env.DATABASE_URL;

  if (url) {
    logger.info('DATABASE_URL detected. Testing connection to PostgreSQL...');
    const connected = await testDatabaseConnection(url);
    if (connected) {
      const pool = getDatabasePool(url);
      if (pool) {
        activeRepo = new PostgresDatabaseRepository(pool);
        logger.info('Using PostgresDatabaseRepository with PostGIS & pgvector');
        return activeRepo;
      }
    }
  }

  logger.info('Using MemoryDatabaseRepository (local in-memory store with spatial & vector simulation)');
  activeRepo = memoryRepo;
  return activeRepo;
}

export function getDatabase(): IDatabaseRepository {
  if (!activeRepo) {
    activeRepo = memoryRepo;
  }
  return activeRepo;
}

export const db: IDatabaseRepository = new Proxy({} as IDatabaseRepository, {
  get(_target, prop: keyof IDatabaseRepository) {
    const repository = getDatabase();
    const value = repository[prop];
    if (typeof value === 'function') {
      return value.bind(repository);
    }
    return value;
  },
});

export * from './types';
export * from './repository';
export { isDatabaseConnected, closeDatabasePool } from './client';
