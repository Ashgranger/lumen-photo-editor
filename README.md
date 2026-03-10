# LUMEN Studio v2 — AI Photo & Video Editor

Mobile-first, production-ready. Deploy to Vercel in 2 minutes.

## Features
- **Photo Editor** — 14 real-time adjustments, 12 presets, 6 filters, transform tools, layers
- **AI Photo Edit** — Describe a look, Claude applies exact adjustments
- **AI Video Creator** — Generate detailed prompts for Sora, Runway Gen-3, and Pika
- **AI Chat** — Ask anything about photo/video editing
- **Mobile-first** — Fully optimized for phones and tablets
- **Export** — PNG, JPG, WEBP
- **Undo/Redo** — Full history

## Deploy to Vercel

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR/lumen-v2.git
git push -u origin main

# 2. Go to vercel.com → New Project → Import repo
# 3. Add environment variable:
#    ANTHROPIC_API_KEY = sk-ant-...
# 4. Deploy!
```

## Local dev
```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
# Open http://localhost:3000
```

## Get API Key
Sign up at https://console.anthropic.com → API Keys → Create Key
