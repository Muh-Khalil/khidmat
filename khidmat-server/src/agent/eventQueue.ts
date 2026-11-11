import { AgentEvent } from './events';

/**
 * Single-producer/single-consumer async queue bridging the LangGraph run (which
 * pushes events synchronously as tools fire) to the SSE consumer (which awaits
 * them via `for await`). Buffers events when no consumer is waiting and resolves
 * a parked consumer immediately when one is. There is no bound on the buffer —
 * an agent run emits a small, finite number of events, so backpressure isn't
 * needed. Call `end()` exactly once to terminate the async iterator.
 */
export class EventQueue {
  private events: AgentEvent[] = [];
  private resolvers: Array<(e: IteratorResult<AgentEvent>) => void> = [];
  private done = false;

  push(event: AgentEvent) {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: event, done: false });
    } else {
      this.events.push(event);
    }
  }

  end() {
    this.done = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: undefined, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<AgentEvent> {
    while (true) {
      if (this.events.length > 0) {
        yield this.events.shift()!;
      } else if (this.done) {
        return;
      } else {
        const result = await new Promise<IteratorResult<AgentEvent>>((resolve) => {
          this.resolvers.push(resolve);
        });
        if (result.done) return;
        yield result.value;
      }
    }
  }
}
