# MovieTracker

A personal movie & TV site: Netflix-style browsing on top, a Letterboxd-style diary underneath, and GitHub-style stats. See [PLAN.md](PLAN.md) for the full plan.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

1. Paste your TMDB key into `.env.local` after `TMDB_API_KEY=`. Either the long "API Read Access Token" or the short "API Key" works. The dev server picks up the change automatically.
2. Visit http://localhost:3000/setup to create your account. Only the first account can be created; after that, `/setup` sends you to sign in.

Locally, the database is an embedded Postgres (PGlite) stored in `.data/`. There's nothing to install. Deleting `.data/` wipes it.

## Environment variables

| Name | Required | What it's for |
|---|---|---|
| `TMDB_API_KEY` | Yes | All movie/TV data and images |
| `OMDB_API_KEY` | No | Adds IMDb, Rotten Tomatoes, and Metacritic scores to title pages |
| `DATABASE_URL` | Production only | Postgres connection string (Neon on Vercel). Leave empty locally. |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (production) |

## Deploying (Vercel + Neon)

1. Push to GitHub, then on vercel.com: **Add New → Project → import the repo**. Before deploying, add the environment variables from `.env.example` (everything except `DATABASE_URL`), plus `CRON_SECRET` (`openssl rand -hex 32`).
2. In the Vercel project: **Storage → Create → Neon (Postgres)**, connected to all environments. This sets `DATABASE_URL`.
3. **Redeploy.** Every build runs `npm run vercel-build`, which applies database migrations before `next build`.
4. On the live site: sign in (the first sign-in becomes the owner), then **Settings → Import** your local export ZIP, reconnect Plex, and hit **Ratings data → Update now**.

Clerk's production keys need a domain you own; development keys work on `*.vercel.app`.

## Where things live

```
src/
  app/                 Pages (one folder per URL) and the search API route
  components/          UI: browse rows, title page, log dialog, stats heatmap, nav
  db/schema.ts         Database tables
  lib/tmdb.ts          Every TMDB call (cached with "use cache")
  lib/library.ts       Your diary/library queries and rating math
  lib/actions.ts       Everything that saves data (log, edit, delete, watchlist, settings)
  lib/auth.ts          Login sessions and profile privacy
drizzle/               SQL migrations
```

This uses Next.js 16 with Cache Components. TMDB data is cached; anything personal streams in behind `<Suspense>`. The version-matched Next.js docs are in `node_modules/next/dist/docs/`.
