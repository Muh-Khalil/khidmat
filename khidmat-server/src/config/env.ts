import 'dotenv/config';
import { logger } from '../lib/logger';
import { parseList } from '../lib/parseList';

/**
 * Single source of truth for environment configuration.
 *
 * Validation runs once, at import time, and fails fast with a clear message so
 * misconfiguration surfaces on boot rather than on the first request that
 * happens to touch a given variable.
 */

const isTest =
  process.env.NODE_ENV === 'test' ||
  process.execArgv.includes('--test') ||
  process.argv.some((arg) => arg.includes('test'));

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    if (isTest) {
      return 'test_dummy_key';
    }
    logger.error(`FATAL ERROR: ${name} environment variable is missing.`);
    process.exit(1);
  }
  return value;
}

function requiredPort(name: string, defaultPort = 5000): number {
  const raw = process.env[name] || String(defaultPort);
  const port = Number(raw);
  if (isNaN(port) || port <= 0 || !Number.isInteger(port)) {
    logger.error(`FATAL ERROR: ${name} environment variable must be a valid positive integer.`);
    process.exit(1);
  }
  return port;
}

/**
 * Comma-separated allowlist of origins for CORS. Optional — when unset, all
 * origins are permitted (the mobile client sends no browser Origin anyway).
 */
function optionalList(name: string): string[] | undefined {
  return parseList(process.env[name]);
}

export const env = {
  PORT: requiredPort('PORT', 5000),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  GEMINI_MODEL_NAME: required('GEMINI_MODEL_NAME', 'gemini-2.0-flash'),
  CORS_ORIGINS: optionalList('CORS_ORIGINS'),
  DATABASE_URL: process.env.DATABASE_URL,
};
