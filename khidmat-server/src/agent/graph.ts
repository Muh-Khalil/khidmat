import { Annotation, MessagesAnnotation, MemorySaver, StateGraph, START, END, interrupt } from '@langchain/langgraph';
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { gemini } from '../lib/gemini';
import { EventQueue } from './eventQueue';
import { getEventQueue, getBookings, getDefaultLocation } from './config';
import { SECTOR_COORDS, sectorCoords } from '../data/sectors';
import { SERVICE_CATEGORIES } from '../data/providers';
import { ServiceCategoryEnum } from '../schemas/common';
import { bookingsSummary } from '../lib/bookings';
import { normalizeRomanUrdu } from '../lib/normalizer';
import {
  searchProviders, rankByDistance, checkAvailability, confirmBooking, scheduleReminder,
  resolveBookingTarget, proposeBookingChange, proposeBookingCancellation, answerBookingQuery
} from './tools';
import {
  classifierPrompt, intentExtractionPrompt, NEW_BOOKING_SYSTEM, bookingFlowSystem
} from './prompts';
import { ToolNode } from '@langchain/langgraph/prebuilt';

//Agent State used for storing the state of the agent 
export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  intent: Annotation<any>({
    reducer: (old, updated) => updated ?? old,
    default: () => null,
  }),
  flow: Annotation<string>({
    reducer: (old, updated) => updated ?? old,
    default: () => 'new_booking',
  })
});

//Intent Schema used for extracting the intent of the user
const IntentSchema = z.object({
  service: ServiceCategoryEnum.optional(),
  location: z.string().optional(),
  time: z.string().optional(),
});

/** The booking flows the classifier can route to. Drives the classifier enum,
 *  the `Flow` type, and the route-lookup maps below. */
export const FLOWS = ['new_booking', 'modify_booking', 'cancel_booking', 'query_booking'] as const;
export type Flow = (typeof FLOWS)[number];

const IntentClassifierSchema = z.object({
  intent: z.enum(FLOWS as unknown as [string, ...string[]]),
  reasoning: z.string(),
});

// Booking flow tools used for booking a service
const newBookingTools = [searchProviders, rankByDistance, checkAvailability, confirmBooking];
const modifyTools = [resolveBookingTarget, proposeBookingChange];
const cancelTools = [resolveBookingTarget, proposeBookingCancellation];
const queryTools = [resolveBookingTarget, answerBookingQuery];

const toolNode = new ToolNode([...newBookingTools, ...modifyTools, ...cancelTools, ...queryTools]);

// AI Models used for the booking flows with their respecitve tools bound to them
const newBookingModel = gemini.bindTools(newBookingTools);
const modifyModel = gemini.bindTools(modifyTools);
const cancelModel = gemini.bindTools(cancelTools);
const queryModel = gemini.bindTools(queryTools);

/**
 * Shared guard for the modify/cancel/query flows: when the user has no bookings,
 * surface a friendly nudge and pause the graph. `thought` lets each flow phrase
 * what the user was trying to do.
 */
function interruptNoBookings(queue: EventQueue, thought: string): never {
  queue.push({ type: 'thought', text: thought });
  queue.push({ type: 'awaiting_user', missing: 'service', question: "You don't have any bookings yet — would you like to make one?" });
  interrupt('Missing bookings');
  throw new Error('unreachable'); // interrupt() throws; satisfies the `never` contract
}

/**
 * Shared post-tool check for the booking flows: if the last resolveBookingTarget
 * call could not pin down a single booking, ask the user to clarify and pause.
 */
function interruptIfAmbiguous(state: typeof AgentState.State, response: AIMessage, queue: EventQueue): void {
  const lastTool = [...state.messages].reverse().find(m => m.getType() === 'tool') as ToolMessage | undefined;
  if (lastTool && lastTool.name === 'resolveBookingTarget') {
    const parsed = typeof lastTool.content === 'string' ? JSON.parse(lastTool.content) : lastTool.content;
    if (!parsed.bookingId) {
      queue.push({
        type: 'awaiting_user',
        missing: 'service',
        question: response.content && typeof response.content === 'string'
          ? response.content
          : 'Which booking did you mean?',
      });
      interrupt('Ambiguous target');
    }
  }
}

async function classifyIntent(state: typeof AgentState.State, config: any) {
  const queue = getEventQueue(config);
  const bookings = getBookings(config);

  const lastMsg = state.messages[state.messages.length - 1];
  const rawContent = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
  const normalized = normalizeRomanUrdu(rawContent);

  const structuredModel = gemini.withStructuredOutput(IntentClassifierSchema);
  const result = await structuredModel.invoke(classifierPrompt(normalized.normalizedText, bookings));
  queue.push({ type: 'thought', text: `Classified intent as ${result.intent}: ${result.reasoning}` });

  return { flow: result.intent };
}

async function intentExtraction(state: typeof AgentState.State, config: any) {
  const queue = getEventQueue(config);
  const defaultLocation = getDefaultLocation(config);

  const textMessages = state.messages
    .filter((m) => m.getType() === 'human' || m.getType() === 'ai')
    .map((m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      if (m.getType() === 'human') {
        const norm = normalizeRomanUrdu(content);
        return `human: ${norm.normalizedText}`;
      }
      return `ai: ${content}`;
    })
    .join('\n');

  const structuredModel = gemini.withStructuredOutput(IntentSchema);
  const extracted = await structuredModel.invoke(intentExtractionPrompt(textMessages, SERVICE_CATEGORIES));

  let usedDefaultLocation = false;
  if (!extracted.location && defaultLocation) {
    extracted.location = defaultLocation;
    usedDefaultLocation = true;
  }

  if (extracted.location) {
    extracted.location = extracted.location.toUpperCase();
  }

  queue.push({
    type: 'understanding',
    extracted: {
      service: extracted.service || null,
      location: extracted.location || null,
      time: extracted.time || null,
      resolvedSlot: null,
    },
    usedDefaultLocation,
  });

  return { intent: extracted };
}

/**
 * A booking intent is actionable only once we have a service, a time, and a
 * location we can actually map to coordinates. Shared by `gate` (which pauses
 * for the missing field) and `routeAfterGate` (which routes on the same rule).
 */
function isIntentComplete(intent: any): boolean {
  return !!(
    intent &&
    intent.service &&
    intent.location &&
    intent.time &&
    (sectorCoords(intent.location) || SECTOR_COORDS[intent.location])
  );
}

async function gate(state: typeof AgentState.State, config: any) {
  const queue = getEventQueue(config);
  const extracted = state.intent;

  if (!isIntentComplete(extracted)) {
    if (!extracted?.service) {
      queue.push({
        type: 'awaiting_user',
        missing: 'service',
        question: 'What service do you need? (AC repair, plumber, electrician, tutor, beautician)',
      });
    } else if (!extracted?.location || (!sectorCoords(extracted.location) && !SECTOR_COORDS[extracted.location])) {
      queue.push({ type: 'awaiting_user', missing: 'location', question: 'Which sector are you in?' });
    } else if (!extracted?.time) {
      queue.push({ type: 'awaiting_user', missing: 'time', question: 'When do you need this?' });
    }

    interrupt('Missing fields');
  }

  return {};
}

/**
 * Surface any free-text the model returned alongside its tool calls as a
 * `thought` event. No-op when the response carried only tool calls.
 */
function pushNarration(queue: EventQueue, response: AIMessage): void {
  if (response.content && typeof response.content === 'string' && response.content.trim()) {
    queue.push({ type: 'thought', text: response.content.trim() });
  }
}

async function newBookingAgent(state: typeof AgentState.State, config: any) {
  const queue = getEventQueue(config);
  const sysMsg = new SystemMessage(NEW_BOOKING_SYSTEM);

  const response = await newBookingModel.invoke([sysMsg, ...state.messages]);

  pushNarration(queue, response);

  return { messages: [response] };
}

/**
 * The modify / cancel / query flows are structurally identical: guard on empty
 * history, build a system prompt over the bookings, invoke a flow-specific model,
 * surface any narration as a thought, then pause if the target is ambiguous.
 * They differ only in the empty-history note, the model, and the task instructions.
 */
type BookingFlowConfig = {
  emptyHistoryThought: string;
  model: ReturnType<typeof gemini.bindTools>;
  role: string;
  taskInstructions: string;
};

function makeBookingFlowAgent(flow: BookingFlowConfig) {
  return async function bookingFlowAgent(state: typeof AgentState.State, config: any) {
    const queue = getEventQueue(config);
    const bookings = getBookings(config);

    if (bookings.length === 0) {
      interruptNoBookings(queue, flow.emptyHistoryThought);
    }

    const sysMsg = new SystemMessage(
      bookingFlowSystem(flow.role, bookingsSummary(bookings), flow.taskInstructions),
    );

    const response = await flow.model.invoke([sysMsg, ...state.messages]);
    pushNarration(queue, response);

    interruptIfAmbiguous(state, response, queue);

    return { messages: [response] };
  };
}

const modifyAgent = makeBookingFlowAgent({
  emptyHistoryThought: "User asked to modify a booking but I don't see any in their history.",
  model: modifyModel,
  role: 'modifying an existing booking',
  taskInstructions: "Use resolveBookingTarget with the user's phrasing to pick the right one. Then determine what the user wants to change (time, slot, day). If they're rescheduling, compute the new scheduledTimestamp. Call proposeBookingChange with the changes + a 1-sentence reason.",
});

const cancelAgent = makeBookingFlowAgent({
  emptyHistoryThought: "User asked to cancel a booking but I don't see any in their history.",
  model: cancelModel,
  role: 'canceling an existing booking',
  taskInstructions: "Use resolveBookingTarget with the user's phrasing to pick the right one. Confirm intent via a thought (no awaiting_user — the user already said cancel). Call proposeBookingCancellation with a 1-sentence reason.",
});

const queryAgent = makeBookingFlowAgent({
  emptyHistoryThought: "User asked about a booking but I don't see any in their history.",
  model: queryModel,
  role: 'answering questions about an existing booking',
  taskInstructions: "Use resolveBookingTarget with the user's phrasing to pick the right one. Generate a 2-3 sentence summary answering the user's question using the booking data. Call answerBookingQuery with the summary.",
});

// Flow → next node. new_booking differs by entry point: from the classifier it
// heads into intent_extraction, but after a tool call it returns to the agent.
const CLASSIFY_ROUTES: Record<Flow, string> = {
  new_booking: 'intent_extraction',
  modify_booking: 'modifyAgent',
  cancel_booking: 'cancelAgent',
  query_booking: 'queryAgent',
};

const TOOLS_ROUTES: Record<Flow, string> = {
  new_booking: 'newBookingAgent',
  modify_booking: 'modifyAgent',
  cancel_booking: 'cancelAgent',
  query_booking: 'queryAgent',
};

function routeAfterClassify(state: typeof AgentState.State) {
  return CLASSIFY_ROUTES[(state.flow || 'new_booking') as Flow] ?? 'intent_extraction';
}

function routeAfterGate(state: typeof AgentState.State) {
  return isIntentComplete(state.intent) ? "newBookingAgent" : "intent_extraction";
}

function routeAfterAgent(state: typeof AgentState.State) {
  const last = state.messages[state.messages.length - 1];
  if (last.getType() === "ai" && (last as AIMessage).tool_calls?.length) {
    return "tools";
  }
  return END;
}

function routeAfterTools(state: typeof AgentState.State) {
  // Return to the correct agent based on flow.
  return TOOLS_ROUTES[(state.flow || 'new_booking') as Flow] ?? 'newBookingAgent';
}

// LangGraph's fluent builder accumulates a deeply recursive generic type for
// every node and conditional edge. Keeping the assembly handle erased avoids
// multi-gigabyte TypeScript instantiation while each node remains typed above.
const workflow: any = new StateGraph(AgentState);

workflow
  .addNode("classifyIntent", classifyIntent)
  .addNode("intent_extraction", intentExtraction)
  .addNode("gate", gate)
  .addNode("newBookingAgent", newBookingAgent)
  .addNode("modifyAgent", modifyAgent)
  .addNode("cancelAgent", cancelAgent)
  .addNode("queryAgent", queryAgent)
  .addNode("tools", toolNode)

  .addEdge(START, "classifyIntent")
  .addConditionalEdges("classifyIntent", routeAfterClassify)
  
  .addEdge("intent_extraction", "gate")
  .addConditionalEdges("gate", routeAfterGate)
  
  .addConditionalEdges("newBookingAgent", routeAfterAgent)
  .addConditionalEdges("modifyAgent", routeAfterAgent)
  .addConditionalEdges("cancelAgent", routeAfterAgent)
  .addConditionalEdges("queryAgent", routeAfterAgent)
  
  .addConditionalEdges("tools", routeAfterTools);

const checkpointer = new MemorySaver();
export const graph = workflow.compile({ checkpointer });
