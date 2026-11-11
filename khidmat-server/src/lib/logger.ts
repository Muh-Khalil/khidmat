/**
 * Tiny structured logger. Keeps the `[server]` prefix convention consistent
 * across the codebase and stamps every line with an ISO timestamp so logs are
 * grep-able and orderable once shipped to a log aggregator.
 */

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: unknown) {
  const line = `[server] ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) {
    sink(line, meta);
  } else {
    sink(line);
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
