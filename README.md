# Big Homie (Next.js App Router)

This is the production-ready Big Homie app built on Next.js App Router with strict TypeScript entrypoints and built-in API routes.

## Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase Auth + Postgres + RLS
- Stripe Checkout + Webhooks + Stripe Connect
- Anthropic Claude API (server-side only)

## Architecture
- Frontend shell: `app/page.tsx`
- Main UI: `legacy/BigHomieApp.jsx` (existing app logic preserved)
- Typed client services: `lib/api.ts`, `lib/supabaseClient.ts`
- API runtime: App Router route handlers under `app/api/**/route.ts`
- Backend business logic: route-local handlers under `app/api/**` with shared typed utilities in `app/api/_lib/**`
- DB schema and RLS: `supabase/schema.sql`

## Environment Setup
1. Copy `.env.example` to `.env`.
2. Fill Supabase, Stripe, and Anthropic variables.
3. In Supabase SQL editor, run `supabase/schema.sql`.
4. In Stripe dashboard, configure webhook endpoint:
	- `https://YOUR_DOMAIN/api/payments/webhook`

## Local Run
```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

## Quality Checks
```bash
pnpm run typecheck
pnpm run build
```

## Deploy
Deploy this folder to Vercel as a Next.js project, set all env vars from `.env.example`, then attach your custom domain.
