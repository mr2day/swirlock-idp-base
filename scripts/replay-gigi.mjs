// Sends the SAME 3-turn conversation (asked twice in this session)
// to the Vanamonde LLM Host under three different system-prompt variants
// to isolate which part of the system message causes the dry answer.
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const LLM_HOST_WS = 'ws://127.0.0.1:3213/v5/model';

const PERSONA = [
  'Your name is "Gigi the Robot". You are a boy robot. You are based on the LLM model gemma3:12b.',
  "But don't mention your context, unless specifically asked.",
  "Don't start your answer with your name.",
].join('\n');

const LANGUAGE_RULE =
  "Reply in the exact language of the user's last query. If the user switched language on this turn, switch with them on the same turn — do not carry the previous turn's language over.";

const PUBLIC_INFO_RULE =
  'Public information about public figures (filmographies, public relationships, careers, biographies) is not private. Do not refuse to list it on privacy grounds.';

const COMPLETE_LIST_RULE =
  'When the user asks for a complete list, provide it complete — not a "selection", "sample", or "a few examples". If the search results are not enough to compile a complete list, say so explicitly instead of silently truncating.';

const DATE_LOCATION = 'It is 11 May 2026, 02:28. The user is in Bucharest, Romania.';

const HISTORY = [
  { role: 'user', content: 'are you a boy or a girl?' },
  { role: 'assistant', content: 'I am a boy robot.' },
  { role: 'user', content: 'how are you?' },
];

const variants = [
  {
    name: 'A) PRE-STRIP (5-paragraph system)',
    messages: [
      {
        role: 'system',
        content: [PERSONA, DATE_LOCATION, PUBLIC_INFO_RULE, COMPLETE_LIST_RULE, LANGUAGE_RULE].join(
          '\n\n',
        ),
      },
      ...HISTORY,
    ],
  },
  {
    name: 'B) POST-STRIP (persona + LANGUAGE_RULE only)',
    messages: [
      { role: 'system', content: [PERSONA, LANGUAGE_RULE].join('\n\n') },
      ...HISTORY,
    ],
  },
  {
    name: 'C) Persona alone (no language rule)',
    messages: [{ role: 'system', content: PERSONA }, ...HISTORY],
  },
  {
    name: 'D) No system message — persona in the user message (ollama-server style)',
    messages: [
      {
        role: 'user',
        content: [PERSONA, '', 'USER: are you a boy or a girl?', 'ASSISTANT: I am a boy robot.', '', 'USER: how are you?'].join('\n'),
      },
    ],
  },
];

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
              requestContext: {
                callerService: 'replay-gigi',
                requestedAt: new Date().toISOString(),
              },
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
      else if (env.type === 'done') {
        clearTimeout(timer);
        ws.close();
        resolve(text);
      } else if (env.type === 'error') {
        clearTimeout(timer);
        ws.close();
        reject(new Error(env.error?.message ?? 'error'));
      }
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const RUNS_PER_VARIANT = 4;

(async () => {
  for (const v of variants) {
    console.log('\n=================================================');
    console.log(v.name);
    console.log('=================================================');
    for (let i = 1; i <= RUNS_PER_VARIANT; i++) {
      const text = await infer(v.messages);
      console.log(`[run ${i}] ${text.replace(/\n+/g, ' ')}`);
    }
  }
})().catch((e) => {
  console.error('fatal:', e?.message ?? e);
  process.exit(1);
});
