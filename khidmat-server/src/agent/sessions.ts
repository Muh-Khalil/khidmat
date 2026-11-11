import { RunnableConfig } from '@langchain/core/runnables';
import { SESSION_TTL_MS, SESSION_SWEEP_INTERVAL_MS } from '../config/constants';

type Session = {
  config: RunnableConfig;
  lastAccessed: number;
};

const sessions = new Map<string, Session>();

export function getOrCreateSession(sessionId: string): { config: RunnableConfig, isNew: boolean } {
  const now = Date.now();
  let session = sessions.get(sessionId);
  let isNew = false;
  if (!session) {
    session = {
      config: { configurable: { thread_id: sessionId } },
      lastAccessed: now,
    };
    sessions.set(sessionId, session);
    isNew = true;
  } else {
    session.lastAccessed = now;
  }
  return { config: session.config, isNew };
}

// Evict sessions that have been idle past their TTL.
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastAccessed > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, SESSION_SWEEP_INTERVAL_MS).unref();
