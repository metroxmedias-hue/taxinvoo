import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const model = process.env.AI_COACH_MODEL || 'gpt-5';

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment.');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'metrox-ai-coach-proxy' });
});

function compactHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
    .map((m) => ({
      role: String(m?.role || '').toLowerCase() === 'user' ? 'user' : 'assistant',
      text: String(m?.text || '').trim()
    }))
    .filter((m) => m.text);
}

function buildSystemPrompt() {
  return [
    'You are Metrox Accountant Copilot.',
    'Give practical accounting advice for Indian SMBs.',
    'Use concise action-oriented language.',
    'Prefer monthly cashflow, GST compliance, margin improvement, and receivables collection actions.',
    'Never claim to have performed actions; provide recommendations only.',
    'If data is missing, say what is missing and provide a safe next step.'
  ].join(' ');
}

app.post('/api/ai-coach', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
    const businessId = String(req.body?.business_id || 'default').trim();
    const history = compactHistory(req.body?.history);

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const historyText = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const userPayload = [
      `Business ID: ${businessId}`,
      `Context JSON: ${JSON.stringify(context)}`,
      historyText ? `Recent History:\n${historyText}` : '',
      `Current User Prompt: ${prompt}`
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await client.responses.create({
      model,
      input: [
        { role: 'system', content: [{ type: 'text', text: buildSystemPrompt() }] },
        { role: 'user', content: [{ type: 'text', text: userPayload }] }
      ],
      temperature: 0.4,
      max_output_tokens: 450
    });

    const reply = (response.output_text || '').trim();
    if (!reply) {
      return res.json({ reply: 'I could not generate a response right now. Please try again.' });
    }

    return res.json({ reply });
  } catch (err) {
    const message = err?.message || 'Unknown error';
    console.error('AI Coach error:', message);
    return res.status(500).json({ error: 'ai_coach_failed', details: message });
  }
});

app.listen(port, () => {
  console.log(`AI Coach proxy running on http://localhost:${port}`);
});
