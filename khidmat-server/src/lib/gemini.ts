import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { env } from '../config/env';
import { AGENT_TEMPERATURE } from '../config/constants';

export const gemini = new ChatGoogleGenerativeAI({
  model: env.GEMINI_MODEL_NAME,
  apiKey: env.GEMINI_API_KEY,
  temperature: AGENT_TEMPERATURE,
});
