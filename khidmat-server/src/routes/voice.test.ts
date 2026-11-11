import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { voiceRouter } from './voice';

function createVoiceTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/voice', voiceRouter);
  return app;
}

async function makePostRequest(app: express.Express, url: string, body: Record<string, unknown>) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    const server = app.listen(0, async () => {
      const address = server.address() as { port: number };
      const res = await fetch(`http://127.0.0.1:${address.port}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      server.close(() => {
        resolve({ status: res.status, body: data });
      });
    });
  });
}

test('Voice API - Transcribe and Normalize Speech', async () => {
  const app = createVoiceTestApp();

  const res = await makePostRequest(app, '/api/voice/transcribe', {
    audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', // valid base64 audio header dummy
    mimeType: 'audio/wav',
    mockTranscriptForTest: 'Mera AC thandaaaaa nahi kar raha beejli wala bhejo G-13',
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.success);
  assert.equal(res.body.data.dialect, 'roman_urdu');
  assert.match(res.body.data.normalizedText, /thanda/);
  assert.match(res.body.data.normalizedText, /bijli/);
  assert.match(res.body.data.normalizedText, /G-13/);
});

test('Voice API - Missing Audio Payload Validation', async () => {
  const app = createVoiceTestApp();

  const res = await makePostRequest(app, '/api/voice/transcribe', {
    audioBase64: 'too-short',
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});
