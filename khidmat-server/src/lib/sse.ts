import { Response } from 'express';
import { AgentEvent } from '../agent/events';

/** Serialize a payload as a single SSE `data:` frame. */
function writeData(res: Response, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function writeRawEvent(res: Response, payload: unknown) {
  writeData(res, payload);
}

export function writeEvent(res: Response, event: AgentEvent) {
  writeData(res, event);
}

/** Emit a terminal error frame on the SSE stream (not part of the AgentEvent union). */
export function writeError(res: Response, message: string) {
  writeData(res, { type: 'error', message });
}

/**
 * Headers that switch the connection into SSE mode. `X-Accel-Buffering: no`
 * tells nginx-style proxies not to buffer the stream, so events flush to the
 * client as they're written rather than arriving in a batch at the end.
 */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export function initSSE(res: Response) {
  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders();
}
