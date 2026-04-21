# SpendWise

AI-first expense, income, investment & lending tracker.

- **Stack**: Vite · React · TypeScript · Tailwind · shadcn/ui · Supabase
- **AI**: Gemini (preferred) → Groq (fallback) → regex (offline). Set either or both.
- **Input**: type *or* speak — "rice 400", "SIP 10000", "lent Ravi 2000 office"
- **Taxonomy**: Type → Category → Group

## Quick start

```bash
cp .env.example .env     # then fill in Supabase + (optional) Groq keys
npm install
npm run dev
```

See [supabase/README.md](supabase/README.md) for database setup.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon key |
| `VITE_GEMINI_API_KEY` | no | Preferred AI provider (Google Gemini). If set, used first. |
| `VITE_GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
| `VITE_GROQ_API_KEY` | no | Fallback AI provider. Used if Gemini is missing or fails. |
| `VITE_GROQ_MODEL` | no | Defaults to `llama-3.3-70b-versatile` |

If no AI key is set, the app uses a regex parser that handles most common phrases but will miss edge cases.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve the built output |
| `npm run lint` | Type-check only |
