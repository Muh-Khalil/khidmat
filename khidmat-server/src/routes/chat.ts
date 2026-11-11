import { Router, Request, Response } from 'express';
import { ChatRequestSchema } from '../schemas/chat';
import { initSSE, writeEvent, writeError } from '../lib/sse';
import { runAgent } from '../agent/runAgent';
import { handleError } from '../lib/responseHandler';
import { logger } from '../lib/logger';
import { requireAuth } from '../lib/auth';

export const chatRouter = Router();

chatRouter.post('/', requireAuth(['customer']), async (req: Request, res: Response) => {
  const parseResult = ChatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid request', parseResult.error.format());
  }

  initSSE(res);

  const clientData = {
    ...parseResult.data,
    customerId: res.locals.auth.userId,
  };

  const generator = runAgent(clientData);

  req.on('close', () => {
    generator.return(undefined);
  });

  try {
    for await (const event of generator) {
      writeEvent(res, event);
    }
  } catch (err) {
    // Log the full error server-side; send the client a generic frame so we
    // don't leak internal error details (stack traces, provider messages).
    logger.error('Chat stream failed', err);
    writeError(res, 'Something went wrong while processing your request.');
  } finally {
    res.end();
  }
});
