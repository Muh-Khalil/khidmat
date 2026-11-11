import { env } from './config/env';
import express, { Request, Response, NextFunction } from 'express';
import { handleSuccess, handleError } from './lib/responseHandler';
import { chatRouter } from './routes/chat';
import { authRouter } from './routes/auth';
import { providersRouter } from './routes/providers';
import { duesRouter } from './routes/dues';
import { jobsRouter } from './routes/jobs';
import { voiceRouter } from './routes/voice';
import { requestsRouter, leadsRouter } from './routes/marketplace';
import { externalProvidersRouter } from './routes/externalProviders';
import { crmRouter } from './routes/crm';
import { logger } from './lib/logger';
import { requestLogger } from './lib/requestLogger';
import { initDatabase, isDatabaseConnected, closeDatabasePool } from './db';
import cors from 'cors';

const app = express();
app.disable('x-powered-by');

// Initialize database repository (PostgreSQL if DATABASE_URL is set, else in-memory fallback)
initDatabase(env.DATABASE_URL).catch((err) => {
  logger.error('Database initialization error', err);
});

// Restrict CORS to the configured origins when CORS_ORIGINS is set; otherwise
// stay permissive (default) since the mobile client sends no browser Origin.
app.use(cors({
  origin(origin, callback) {
    // Native clients do not send Origin. Browser clients must be explicitly
    // allowlisted instead of inheriting cors()'s wildcard default.
    if (!origin || env.CORS_ORIGINS?.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(requestLogger);

app.get('/', (_req: Request, res: Response) => {
  return handleSuccess(res, 200, 'Khidmat agent server', {
    service: 'khidmat-server',
    endpoints: [
      'GET /health',
      'POST /chat',
      '/api/auth/*',
      '/api/providers/*',
      '/api/dues/*',
      '/api/jobs/*',
    ],
    database: isDatabaseConnected() ? 'postgresql+postgis+pgvector' : 'in-memory-fallback',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  return handleSuccess(res, 200, 'Health Check Passed', {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    database: isDatabaseConnected() ? 'postgresql' : 'in-memory',
  });
});

// Route mounts
app.use('/chat', chatRouter);
app.use('/api/chat', chatRouter);
app.use('/api/voice', voiceRouter);
app.use('/voice', voiceRouter);
app.use('/api/auth', authRouter);
app.use('/api/providers', providersRouter);
app.use('/api/dues', duesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/bookings', jobsRouter); // Alias for frontend bookings convention
app.use('/api/requests', requestsRouter);
app.use('/api/provider/leads', leadsRouter);
app.use('/api/external-providers', externalProvidersRouter);
app.use('/api/provider/crm', crmRouter);

// Unmatched routes get a consistent JSON 404 instead of Express's default HTML.
app.use((req: Request, res: Response) => {
  return handleError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  if (err instanceof SyntaxError && (err as Error & { status?: number }).status === 400) {
    return handleError(res, 400, 'Malformed JSON request body');
  }
  return handleError(res, 500, 'Internal Server Error');
});

const server = app.listen(env.PORT, () => {
  logger.info(`Listening on http://localhost:${env.PORT}`);
});

// Drain in-flight requests on a shutdown signal so the process exits cleanly
// (e.g. under a container orchestrator) instead of dropping live connections.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await closeDatabasePool().catch(() => {});
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Don't hang forever if a long-lived connection (e.g. an open SSE stream)
  // refuses to drain — force the exit after a grace period.
  setTimeout(() => {
    logger.error('Shutdown timed out; forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort visibility: never let a stray rejection or throw die silently.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
});
