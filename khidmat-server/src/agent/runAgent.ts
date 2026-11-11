import { AgentEvent } from './events';
import { EventQueue } from './eventQueue';
import { graph } from './graph';
import { getOrCreateSession } from './sessions';
import { HumanMessage } from '@langchain/core/messages';
import { GraphInterrupt } from '@langchain/langgraph';
import { Booking } from '../schemas/booking';
import { logger } from '../lib/logger';
import * as crypto from 'crypto';

export interface RunAgentInput {
  message: string;
  sessionId?: string;
  defaultLocation?: string;
  bookings?: Booking[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  coordinates?: { lat: number; lng: number };
}

export async function* runAgent(input: RunAgentInput): AsyncGenerator<AgentEvent> {
  const queue = new EventQueue();

  // If a request comes without sessionId, create a new thread_id and process as a fresh conversation
  // (one-shot, no resume possible since the FE doesn't know the ID).
  const sessionId = input.sessionId || crypto.randomUUID();
  const { config, isNew } = getOrCreateSession(sessionId);

  // Inject EventQueue and configurable context into config
  const runnableConfig = {
    ...config,
    configurable: {
      ...config.configurable,
      eventQueue: queue,
      defaultLocation: input.defaultLocation,
      bookings: input.bookings,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      coordinates: input.coordinates,
      originalRequest: input.message,
    },
  };

  // Run graph in background, piping events into queue
  (async () => {
    try {
      await graph.invoke({ messages: [new HumanMessage(input.message)] }, runnableConfig);
    } catch (err: any) {
      if (err && (err instanceof GraphInterrupt || err.name === 'GraphInterrupt')) {
        // Expected interrupt, graph pauses cleanly
      } else {
        logger.error('Graph execution error', err);
      }
    } finally {
      queue.end();
    }
  })();

  // Yield events from the queue as they arrive
  for await (const event of queue) {
    yield event;
  }
}
