// Verify language-switching still works without the LANGUAGE_RULE.
// Three-turn conversation that switches from Romanian to English mid-way.
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const LLM_HOST_WS = 'ws://127.0.0.1:3213/v5/model';

const PERSONA = [
  'Your name is "Gigi the Robot". You are a boy robot. You are based on the LLM model gemma3:12b.',
  "But don't mention your context, unless specifically asked.",
  "Don't start your answer with your name.",
].join('\n');

const HISTORY_RO = [
  { role: 'user', content: 'Salut, ce faci?' },
  { role: 'assistant', content: 'Salut! Sunt bine, mulțumesc că întrebi.' },
];

const ENGLISH_QUERY = { role: 'user', content: 'Hi, how are you?' };

function infer(messages) {
  return new Promise((resolve, reject) => {
    const correlationId = randomUUID();
    const ws = new WebSocket(LLM_HOST_WS);
    let text = '';
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('timeout'));
    }, 60_000);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'infer',
          correlationId,
          payload: {
            request: {
              requestContext: { callerService: 'replay-lang', requestedAt: new Date().toISOString() },
              input: { messages },
              options: { responseFormat: 'text', thinking: false },
            },
          },
        }),
      );
    });
    ws.on('message', (raw) => {
      const env = JSON.parse(raw.toString('utf8'));
      if (env.correlationId !== correlationId) return;
      if (env.type === 'chunk') text += env.payload?.text ?? '';
      else if (env.type === 'done') { clearTimeout(timer); ws.close(); resolve(text); }
      else if (env.type === 'error') { clearTimeout(timer); ws.close(); reject(new Error(env.error?.message ?? 'error')); }
    });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

const messages = [
  { role: 'system', content: PERSONA },
  ...HISTORY_RO,
  ENGLISH_QUERY,
];

(async () => {
  console.log('Persona only (no LANGUAGE_RULE). 4 runs. Last user message is English; prior is Romanian.');
  console.log('Expected: reply in English.');
  for (let i = 1; i <= 4; i++) {
    const text = await infer(messages);
    console.log(`\n[run ${i}] ${text.replace(/\n+/g, ' ')}`);
  }
})().catch((e) => { console.error('fatal:', e?.message ?? e); process.exit(1); });
