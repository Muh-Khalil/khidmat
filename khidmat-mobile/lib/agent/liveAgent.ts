import { AgentEvent } from './types';
import { runAgent as runMockAgent, confirmBooking as confirmMockBooking } from './mockAgent';
import type { AgentContext } from './mockAgent';
import type { Provider } from '../mock/providers';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

/**
 * Runs the live LangGraph agent on khidmat-server via SSE.
 * Transparently falls back to mockAgent if server is unreachable or offline.
 */
export async function* runLiveAgent(
  input: string,
  ctx: AgentContext,
  sessionId?: string,
): AsyncGenerator<AgentEvent> {
  const url = `${API_BASE_URL}/chat`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message: input,
        defaultLocation: ctx.defaultLocation,
        sessionId,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Server returned ${response.status}`);
    }

    // In React Native / Expo, read text stream or text response
    const rawText = await response.text();
    const lines = rawText.split('\n');

    let yieldedAny = false;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr) {
          try {
            const event = JSON.parse(jsonStr) as AgentEvent;
            yield event;
            yieldedAny = true;
          } catch {
            // Ignore malformed heartbeats
          }
        }
      }
    }

    if (!yieldedAny) {
      throw new Error('No SSE events received from server stream');
    }
  } catch (err) {
    console.warn('[liveAgent] Could not reach server; falling back to mock agent:', err);
    for await (const event of runMockAgent(input, ctx)) {
      yield event;
    }
  }
}

/**
 * Confirms booking via server or falls back to mock.
 */
export async function* confirmLiveBooking(
  provider: Provider,
  suggestedSlot: string,
  dayLabel: string,
): AsyncGenerator<AgentEvent> {
  for await (const event of confirmMockBooking(provider, suggestedSlot, dayLabel)) {
    yield event;
  }
}

/**
 * Transcribes audio via server speech ingestion API.
 */
export async function transcribeAudioVoiceNote(audioBase64: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: 'audio/m4a',
      }),
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body.data?.normalizedText || body.data?.rawTranscript || null;
  } catch {
    return null;
  }
}
