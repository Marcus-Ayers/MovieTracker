# How MovieTracker fits together

A guide to reading and changing the code. The [README](../README.md) covers running and deploying it.

## The stack

| Piece | What it does here |
|---|---|
| **Next.js 16** (App Router, Cache Components) | Pages, server code, server actions, caching |
| **React 19** | UI; most components render on the server |
| **TypeScript** | Everything is typed (see [Reading the TypeScript](#reading-the-typescript)) |
| **Tailwind CSS v4** | Styling, with the site's colors defined once in `src/app/globals.css` (`@theme`) |
| **Drizzle ORM + Postgres** | The database: Neon in production, PGlite (embedded) locally |
| **Clerk** | Sign-in, sign-up, passwords, Google, 2FA |
| **TMDB** | Every movie/TV detail, image, credit, search result and streaming listing |
| **OMDb + IMDb's daily file** | IMDb, Rotten Tomatoes and Metacritic scores |
| **Wikipedia** | Full plot summaries in the rating queue |
| **Plex** | Your watch history, synced into the diary |

## Folder map

```
src/
  app/                    One folder per URL (Next.js App Router)
    page.tsx              /            home
    movie/[id], tv/[id]   title pages (both use components/title/title-page.tsx)
    library, diary, stats, watchlist   your pages; u/[username]/… are the public copies
    lists, recap, rate, friends, search, explore, person/[id], settings
    api/                  JSON endpoints the browser calls (search, previews, cron, export…)
    manifest.ts, icon.tsx, apple-icon.tsx, pwa-icon/   the installable-app bits
  components/             UI, grouped by area (title, profile, lists, rate, nav, media, ui…)
  lib/                    Everything that isn't UI: data access, server actions, helpers
  db/schema.ts            The database tables
  proxy.ts                Runs before each request (Clerk)
drizzle/                  SQL migrations generated from db/schema.ts
scripts/migrate.mjs       Applies migrations before each Vercel build
docs/                     This file
```

A rule of thumb for `lib/`: files ending in **`-actions.ts`** are server actions (things the browser triggers to *change* data); the rest are reads and helpers.

## How a page is built

Most components are **Server Components**: they run on the server, can `await` the database or TMDB directly, and send finished HTML. A file starting with **`"use client"`** runs in the browser instead; those are the interactive pieces (buttons, dialogs, drag and drop, the tab bar).

The site uses Next.js **Cache Components** (`cacheComponents: true` in `next.config.ts`), which splits every page into two parts:

1. **A static shell** that can be prerendered and cached: layout, headers, anything from TMDB.
2. **Dynamic holes** for anything personal (who's signed in, your diary). These must sit inside `<Suspense>` and stream in after the shell.

That's why personal parts of pages look like this:

```tsx
export default function LibraryPage(props) {
  return (
    <Suspense fallback={<PageSkeleton />}>   {/* shown instantly */}
      <MyLibrary searchParams={props.searchParams} />   {/* awaits the database, streams in */}
    </Suspense>
  );
}
```

`getDb()` calls `connection()`, which tells Next.js "this needs a real request", so any database read automatically counts as dynamic.

### Three kinds of caching

| Where | How | Lasts |
|---|---|---|
| TMDB responses | `"use cache"` + `cacheLife("hours" \| "days" \| "weeks")` at the top of functions in `lib/tmdb.ts`, `lib/plot.ts` | Hours to weeks, shared by everyone |
| One page load | React's `cache()` around a function (`getCurrentUser`, `getViewings`, `getLibrary`, `getTitleState`…) | One request: if three components ask for your diary, the database is asked once |
| Movie/show data | The `titles` table (`lib/title-cache.ts` → `ensureTitle`) | Saved permanently, refreshed from TMDB every 90 days |

Because `cache()` hands the *same* array to every caller in a request, code treats those results as read-only (copy before `.sort()`).

## How data changes

Changes go through **server actions**: async functions in files marked `"use server"` (`lib/actions.ts`, `lib/list-actions.ts`, `lib/friend-actions.ts`…). The browser imports and calls them like normal functions; Next.js turns each call into a request to the server.

Every action starts by checking who you are (`requireUser()`), then only touches your rows. Afterwards it usually calls `revalidatePath("/", "layout")`, which makes pages re-render with the new data.

Patterns you'll see on the client:

- **Forms** use `useActionState` with `submitTo(action)` (`lib/forms.ts`), so fields don't reset when there's an error.
- **Optimistic updates** (Watchlist button, rating queue, drag and drop) change the screen first and save in the background.
- **Inputs are validated** on the server with `zod` schemas before anything is written.

## Where the data comes from

- **TMDB** (`lib/tmdb.ts`). Every call goes through one `tmdb()` helper. Responses are mapped into the site's own smaller types (`MediaItem`, `TitleDetails`). When something is logged, `ensureTitle()` saves the title and its credits into the database, so the diary, stats and recaps never need TMDB.
- **Scores** (`lib/ratings.ts`). IMDb ratings come from IMDb's free daily file (every title with 1,000+ votes). Rotten Tomatoes and Metacritic come from OMDb, which allows 1,000 calls a day. Each title is looked up once and saved; recent films are re-checked occasionally because their scores still move.
- **Plots** (`lib/plot.ts`). TMDB → Wikidata → the English Wikipedia article → its "Plot" section.
- **Plex** (`lib/plex.ts`). Sign in with a Plex PIN, then read your server's watch history. Finished movies and fully watched TV seasons become diary entries. It syncs nightly, and when you open the site after more than 30 minutes (`/api/rate-prompt`).
- **Imports** (`lib/import-parse.ts` in the browser, `lib/import-actions.ts` + `import-save.ts` on the server). Letterboxd, TMDB ratings, Netflix, Plex, or a MovieTracker backup.

## The database

Defined in `src/db/schema.ts`. The important tables:

| Table | One row per | Notes |
|---|---|---|
| `users` | account | Linked to Clerk by `clerkId`. Holds every setting (privacy, social switches, streaming services…) |
| `titles` | movie or show | TMDB data cached locally (`tmdbId` + `mediaType` is unique) |
| `people`, `credits` | person / person-on-title | Directors, writers, creators, top cast |
| `viewings` | diary entry | Date (or null for "date unknown"), season for TV, rating, review, liked, rewatch… |
| `user_titles` | person + title | Watchlist flag and "seen before" count |
| `lists`, `list_items` | list / title-on-list | Tier lists store their tiers on the list, and each item's tier on the item |
| `friendships` | pair of people | `pending` until accepted |
| `external_ratings`, `imdb_ratings` | IMDb id | Scores (see above) |
| `plex_connections`, `plex_items` | person / Plex item | Your Plex link; a cache of Plex item → TMDB id |

**Changing a table:** edit `schema.ts`, run `npm run db:generate` to create a migration in `drizzle/`. Locally it's applied automatically on the next request; on Vercel, every build runs `scripts/migrate.mjs` first.

## Accounts, privacy and social

- **Sign-in is Clerk's** (`src/proxy.ts` + the `/sign-in` and `/sign-up` pages). The first time someone signs in, `getCurrentUser()` (`lib/auth.ts`) creates their `users` row. Everything personal hangs off that row's `id`.
- **Privacy** is one setting per person: *Everyone*, *Friends* (accepted friends only), or *Only me*. It decides who can open `/u/username/…` (and lists and recaps). `getProfileAccess()` makes that decision.
- **Social features** (`lib/friends.ts`) have a master switch plus three sub-switches. Someone with social turned off disappears from everyone's search, requests, feeds and community sections; their friendships are kept for when they turn it back on.
- **The first account is the site admin.** Its only extra power is "Update now" for the nightly job.

## Background work

- **Nightly** (Vercel Cron → `/api/cron/daily` → `lib/jobs.ts`):
  1. IMDb's ratings file
  2. Rotten Tomatoes backfill
  3. refresh titles older than 90 days
  4. sort movies into film series
  5. Plex sync for everyone

  It's protected by the `CRON_SECRET` environment variable.
- **After a response** (`after()` from `next/server`): small catch-up work that shouldn't slow the page, like filling in film series on the Stats page.

## Phones and the installed app

- **Bottom tab bar** (`components/nav/tab-bar.tsx`): Home, Search, ＋ Log, Diary, You. It's hidden from 768px wide up, where the header nav takes over.
- **Hover doesn't exist on touch screens.** `useIsTouch()` (`lib/use-touch.ts`) detects them. There, tapping a poster opens a details sheet instead of the hover panel (`components/media/poster-frame.tsx`).
- **Dialogs** (`components/ui/modal.tsx`) are native `<dialog>` elements: bottom sheets on phones, centered boxes on desktop. When their page goes into the background (Next keeps visited pages alive), they close *quietly* and reopen if you come back.
- **The log form is loaded on demand** (`components/log/log-form.tsx`): its rich-text editor is the heaviest code on the site. `preloadLogForm()` starts the download as soon as you hover or tap something that leads to it.
- **Installable app:** `app/manifest.ts` (full-screen, opens to Home), generated icons (`lib/app-icon.tsx`), iPhone settings in `app/layout.tsx`, and safe-area padding for the notch and home bar.

## Reading the TypeScript

TypeScript is JavaScript plus *types*: labels that describe the shape of values, checked before the code runs (`npm run typecheck`). They disappear when the code runs. The ones you'll see most here:

```ts
// A type describing an object's shape. "?" means optional, "|" means "one of".
type LogTarget = {
  tmdbId: number;
  mediaType: "movie" | "tv";      // only these two strings are allowed
  year: number | null;            // a number, or null when unknown
  seasons?: { number: number }[]; // optional; an array of objects
};

// Parameters and return values can be typed. Promise<X> = "an async result that will be X".
async function getLibrary(userId: number): Promise<LibraryEntry[]> { … }

// <T> is a "generic": a placeholder type filled in by whoever calls it.
function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]>

// Types can be derived instead of written out by hand:
type Title = typeof titles.$inferSelect;        // the shape of a row in the titles table
type Settings = z.infer<typeof settingsSchema>; // the shape a zod schema accepts
PageProps<"/movie/[id]">                         // Next.js's generated props for that route
```

Other symbols:
- `value!` says "this isn't null, trust me".
- `value as Something` is a cast.
- `x satisfies T` checks x against T without changing its type.
- `import type` imports only a type, which doesn't exist at runtime.

In VS Code, **hover over anything** to see its type and doc comment: every exported function here has one.

## Common changes

| To… | Do this |
|---|---|
| Add a page | Create `src/app/<path>/page.tsx`. Put anything personal in an async component inside `<Suspense>`. |
| Change what's saved | Edit `src/db/schema.ts` → `npm run db:generate`. Then add the field to `lib/backup.ts` / `backup-format.ts` so export and restore keep it. |
| Let the browser change something | Add an async function to a `"use server"` file in `lib/`. Start with `requireUser()`, validate with zod, then `revalidatePath`. |
| Call a new TMDB endpoint | Add a function to `lib/tmdb.ts` that starts with `"use cache"` and a `cacheLife(...)`. |
| Add a featured list | Add titles to `lib/curated.ts` (`[TMDB id, "Title", year]`), checking each id on themoviedb.org. |

Before committing: `npm run typecheck`, `npm run lint`, and `npm run build` (the build catches Cache Components mistakes that dev mode lets slide).
