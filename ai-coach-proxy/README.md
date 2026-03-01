# Metrox AI Coach Proxy

Secure backend proxy for AI Coach so your OpenAI API key is never exposed in `index.html`.

## 1) Local setup

```bash
cd ai-coach-proxy
cp .env.example .env
npm install
npm start
```

Proxy starts at:

- `http://localhost:8787/health`
- `http://localhost:8787/api/ai-coach`

## 2) Connect from Metrox UI

In your app:

1. Open **AI Business Coach**
2. Click **Connect AI**
3. Paste endpoint URL:
   - Local: `http://localhost:8787/api/ai-coach`
   - Live: `https://your-domain.com/api/ai-coach`

## 3) Required env vars

- `OPENAI_API_KEY` (required)
- `PORT` (default `8787`)
- `AI_COACH_MODEL` (default `gpt-5`)
- `ALLOWED_ORIGIN` (e.g. `https://app.metrox.com` or `*` during testing)

## 4) Deploy options

## Render / Railway

- Root directory: `ai-coach-proxy`
- Build command: `npm install`
- Start command: `npm start`
- Add env vars from `.env.example`

## Vercel (Node server)

You can deploy as a Node service similarly, but Render/Railway is simpler for this Express app.

## 5) API contract expected by your frontend

### Request

```json
{
  "prompt": "How do I improve cashflow this month?",
  "context": {
    "month": "2026-02",
    "margin": 14.2,
    "gstPayable": 12500,
    "pendingPayments": 49000,
    "pendingRatio": 0.31,
    "topInsights": []
  },
  "business_id": "business-123",
  "history": [
    { "role": "user", "text": "month summary" },
    { "role": "bot", "text": "..." }
  ]
}
```

### Response

```json
{ "reply": "Actionable guidance here..." }
```

## 6) Production checklist

- Restrict `ALLOWED_ORIGIN` to your real frontend domain
- Keep `OPENAI_API_KEY` only in server env vars
- Add basic request logging and rate limiting (recommended)
- Monitor token usage and set per-request limits
