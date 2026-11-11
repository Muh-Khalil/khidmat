import { Router, Request, Response } from 'express';
import { handleSuccess, handleError } from '../lib/responseHandler';
import { transcribeAudio } from '../lib/speech';
import { z } from 'zod';

export const voiceRouter = Router();

const TranscribeRequestSchema = z.object({
  audioBase64: z.string().min(10, 'audioBase64 payload is required'),
  mimeType: z.string().default('audio/mp3'),
  mockTranscriptForTest: z.string().optional(),
});

// POST /api/voice/transcribe
voiceRouter.post('/transcribe', async (req: Request, res: Response) => {
  const parseResult = TranscribeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid voice transcription request', parseResult.error.format());
  }

  const { audioBase64, mimeType, mockTranscriptForTest } = parseResult.data;

  try {
    const result = await transcribeAudio({
      audioBase64,
      mimeType,
      mockTranscriptForTest,
    });

    return handleSuccess(res, 200, 'Audio transcribed and normalized successfully', result);
  } catch (err) {
    return handleError(res, 500, 'Voice transcription failed', err);
  }
});
