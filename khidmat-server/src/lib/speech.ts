import { env } from '../config/env';
import { logger } from './logger';
import { normalizeRomanUrdu, NormalizationResult } from './normalizer';

export interface TranscribeAudioOptions {
  audioBase64: string;
  mimeType?: string;
  mockTranscriptForTest?: string;
}

export interface TranscribeAudioResult {
  rawTranscript: string;
  normalizedText: string;
  dialect: NormalizationResult['dialect'];
  language: string;
  tokensNormalized: number;
}

export async function transcribeAudio(options: TranscribeAudioOptions): Promise<TranscribeAudioResult> {
  const { audioBase64, mimeType = 'audio/mp3', mockTranscriptForTest } = options;

  // If mock text provided (useful for fast unit tests or simulated recording)
  if (mockTranscriptForTest) {
    const norm = normalizeRomanUrdu(mockTranscriptForTest);
    return {
      rawTranscript: mockTranscriptForTest,
      normalizedText: norm.normalizedText,
      dialect: norm.dialect,
      language: norm.dialect === 'roman_urdu' ? 'ur-Latn' : norm.dialect === 'urdu' ? 'ur' : 'en',
      tokensNormalized: norm.tokensNormalized,
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`;

    const prompt = `You are an expert South Asian multilingual speech-to-text transcriber for a home services platform in Pakistan.
Transcribe the spoken audio verbatim.
- If spoken in Roman Urdu or Urdu, transcribe it in Roman Urdu (Latin alphabet as commonly written by Pakistanis on WhatsApp/SMS).
- If spoken in English, transcribe in English.
Return strictly a valid JSON object without markdown fences, with this structure:
{"transcript": "the transcribed text", "language": "ur-Latn" | "ur" | "en"}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('Gemini multimodal audio transcription failed', errText);
      throw new Error(`Audio transcription API error: ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsed: { transcript: string; language?: string } = {
      transcript: 'Service chahiye',
      language: 'ur-Latn',
    };

    if (candidateText) {
      const cleanJson = candidateText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        parsed = { transcript: cleanJson, language: 'ur-Latn' };
      }
    }

    const norm = normalizeRomanUrdu(parsed.transcript);

    return {
      rawTranscript: parsed.transcript,
      normalizedText: norm.normalizedText,
      dialect: norm.dialect,
      language: parsed.language || (norm.dialect === 'roman_urdu' ? 'ur-Latn' : 'en'),
      tokensNormalized: norm.tokensNormalized,
    };
  } catch (error) {
    logger.error('Error in transcribeAudio', error);
    throw error;
  }
}
