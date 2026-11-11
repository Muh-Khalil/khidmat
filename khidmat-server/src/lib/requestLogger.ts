import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Logs one line per request when the response finishes, with method, path,
 * status code, and wall-clock duration. Kept dependency-free (no morgan) since
 * the output just needs to flow through our own logger.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`;
    if (res.statusCode >= 500) {
      logger.error(line);
    } else if (res.statusCode >= 400) {
      logger.warn(line);
    } else {
      logger.info(line);
    }
  });

  next();
}
