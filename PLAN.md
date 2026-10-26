# MovieTracker — Plan

> Placeholder name. A personal site for finding things to watch (Netflix-style browsing) and logging everything you've watched (Letterboxd-style diary + GitHub-style stats).

Status: **first build done (Oct 25, 2026).** Phase 0, Phase 1, and most of Phases 2–3 are built and running locally. See §6 for what's done and what's next.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Users | Just you for now. Published online so it works on every device. |
| Login | **Browsing needs no login.** Logging, rating, reviewing and editing need *your* login. Nobody else can sign in. |
| Profile privacy | Setting: **Everyone / Friends / Only me**. Controls who can see your library, diary, reviews and stats. "Friends" acts like "Only me" until a friends feature exists. |
| Heatmaps | Movies and TV get **separate** heatmaps, so TV doesn't inflate the movie one |
| Hosting | Vercel (free Hobby plan, which is for personal, non-commercial use, so it fits) |
| Framework | Next.js (you know it) + TypeScript (unless you'd rather use plain JS) |
| Content | Movies **and** TV. TV is logged and reviewed **per season** (at most one rating/review per season per viewing), never per episode. |
| Region | USA (theaters, release dates, streaming availability) |
| Plex | Your main player. You have Plex Pass and remote access, so auto-logging can use Plex webhooks (later phase). |
| Name | Placeholder for now |
| Imports | None needed |
| Trailers | **Never autoplay.** Trailers play only when you click. |
| Watched titles in browse | Toggle: show with your rating badge / hide them |
| Recommendations | TMDB's built-in "recommended" / "similar" is enough |
| Watchlist + custom lists | Yes |
| Rating scale | 1–10, whole numbers only |
| Ratings | One rating per viewing; the movie shows your **latest** rating |
| Pre-site history | "Watched, date unknown" + a "times seen before" count |
| Reviews | Formatted text (bold, headings, quotes). One per viewing, and you can **star** one as the main review shown on the title. |
| My Films page | Poster grid first. Table view and a drag-to-rank tier list come later. |
| Stats | Heatmap with **All-time / Year / Month** views, click a day to see what you watched, current + longest streak, director stats, yearly Recap |
| Look | Dark theme. When unsure, follow Netflix. Modern; as much info as IMDb without IMDb's dated look. |

---

## 2. Data sources

| Source | Used for | Notes |
|---|---|---|
| **TMDB** | Everything: search, posters, backdrops, cast/crew, genres, runtime, trailers, trending, in theaters, upcoming, discover filters, studios, collections, TV seasons, "where to watch" | Free for personal non-commercial use. Must show the TMDB logo + a "not endorsed by TMDB" line. Cached data must be refreshed within 6 months. About 40 requests/sec limit. |
| **JustWatch (through TMDB)** | "Where to watch" in the US: stream / rent / buy | Must credit JustWatch where it's shown |
| **IMDb datasets** *or* **OMDb** | IMDb rating (OMDb also gives Rotten Tomatoes + Metacritic) | IMDb files: free daily download, personal use, IMDb rating only. OMDb: free key, 1,000 lookups/day. Start with OMDb (simpler) and add the IMDb files later if needed. |
| **Plex** (later) | Auto-log what you finish | You have Plex Pass, so this uses **webhooks**: Plex sends a "scrobble" event to the site when you pass 90% of something. Movies become a draft diary entry. For TV, episode events quietly track season progress, and when a season is done you get a prompt to rate/review it. |

---

## 3. Tech stack (proposed)

- **Next.js (App Router) on Vercel.** TMDB calls happen on the server only, so the API key never reaches the browser.
- **Postgres database:** Neon in production (free tier, connects to Vercel in a few clicks). Locally it's **PGlite**, a real Postgres stored in `.data/`, so there's nothing to install.
- **Drizzle** to talk to the database (switched from Prisma: it runs the same code against PGlite locally and Neon in production).
- **Login:** username + password (switched from Google sign-in so there's no Google setup). Browse, Discover and title pages are public; anything that saves data needs your login. Google sign-in can be added later.
- **Tailwind CSS + shadcn/ui** for the look, **Embla** for the sideways-scrolling rows, **Tiptap** for the review editor, and **Recharts** (plus a custom heatmap) for stats.
- **Caching:**
  - Browse lists (trending, in theaters…) are cached for a few hours by Next.js.
  - Titles you've logged are saved in your database.
  - A daily Vercel cron job refreshes anything older than about 3 months, which keeps us inside TMDB's 6-month rule. (Hobby crons can run once a day, which is enough.)
- **Images** load straight from TMDB's image server at preset sizes rather than through Vercel's image optimizer, to stay inside the free limits.
- **Secrets:** the TMDB key goes in `.env.local` (never committed to git) and in Vercel → Project → Settings → Environment Variables.

---

## 4. Data model (conceptual)

**Title**: a movie or TV show, cached from TMDB.
- tmdb id, type (movie/tv), title, year, poster, backdrop, overview, genres, runtime (episode runtime for TV), certification, countries, languages, imdb id, imdb rating, number of seasons (TV), last refreshed date

**Person** + **Credit**: directors, writers, creators and top-billed cast for the titles you've logged. This is what powers "directors you love."

**Viewing** (diary entry): one per time you watch something.
- title, date watched (empty = date unknown), rating 1–10 (whole numbers), liked ❤️, rewatch (detected automatically), review (formatted text), starred/main review, spoiler flag, where (Theater / Plex / Netflix / Max / Disney+ / … / Disc), format (IMAX / 4K / 35mm…), watched with, tags
- TV: the **season** the entry covers. The date is when you finished the season, and a season counts as one viewing on the heatmap.

**Your info per title:** times seen before the site existed, on watchlist, TV status (watching / finished / dropped).

**List** + **ListItem**: custom ordered lists.

**Settings**: your streaming services, hide-watched default.

Derived values:
- watch count = number of viewings + times seen before
- your rating = rating from the latest viewing (if a starred review and your latest viewing disagree, the latest rating wins)
- TV show's overall rating = average of your latest rating for each season, rounded
- main review = the starred one, or the latest review if none is starred

---

## 5. Pages

1. **Home (Browse).** Movies / TV / Both switch.
   - Hero carousel with still backdrops; it rotates but doesn't autoplay.
   - Rows: Trending · Top 10 This Week (giant numbers) · In Theaters · Coming Soon · Popular · Top Rated · On My Services · From My Watchlist · Because You Rated *X* 9+ · genre rows · Hidden Gems
   - Studio/franchise tiles (A24, Ghibli, Pixar, Marvel, Neon, Blumhouse, DC, Star Wars…)
   - Hovering a poster expands it with quick info and Log / Watchlist buttons. Clicking opens a quick-view pop-up, Netflix-style.
2. **Discover.** Full filter panel + sort, endless scrolling grid.
   - Filters: genres (include/exclude), keywords, year/decade, runtime, TMDB score, minimum votes, language, country, age rating, cast/crew, studio, streaming service (US), hide watched.
   - Sorts: popularity, rating, release date, revenue, title.
3. **Hub pages.** One page per studio or franchise.
4. **Title page.** IMDb-level detail, modern layout.
   - Backdrop, title logo, tagline, overview, runtime, rating, release date, genres
   - Director/writers, cast with photos, full crew
   - TMDB + IMDb (+ Rotten Tomatoes) scores
   - Where to watch, trailers (click to play), keywords, budget/revenue, studios
   - Collection ("part of the John Wick collection"), recommendations; TV gets seasons and episode lists
   - **Your panel:** your rating, watch count, all your viewings, the main review, and Log / Watchlist / Add to list buttons
5. **Search.** Global search bar (also ⌘K) with instant results; log something straight from a result.
6. **Log a viewing** (pop-up from anywhere).
   - Date (defaults to today, or "unknown"), 1–10 rating, liked, review editor, star as main
   - Where, format, with, tags, spoilers. Rewatch is detected automatically.
7. **My Films.** Poster grid with your rating on each poster.
   - Movies/TV switch.
   - Sorts: your rating, last watched, release year, title, watch count, runtime, IMDb/TMDB score, "my rating vs. everyone's."
   - Filters: genre, decade, director, rating range, year watched.
8. **Diary.** Your viewings in date order, grouped by month.
9. **Watchlist** and **Lists.**
10. **Stats.**
    - Heatmap (All-time / Year / Month), streaks
    - Viewings per month and per year, hours watched
    - Genres, rating spread, decades, countries/languages
    - First watches vs. rewatches, where you watched
    - **Top directors & actors:** how many of their titles you've seen and your average rating
11. **Person page.** Their full filmography with the ones you've seen highlighted and your ratings shown, plus "You've seen 7 of 12" and the 5 you haven't. This is where "I didn't know they directed that" happens.
12. **Recap.** A year-in-review page, Spotify Wrapped-style.
13. **Settings.** Streaming services, defaults, export all your data (CSV/JSON), and Plex connection (later).

---

## 6. Build phases

| Phase | What | Why this order |
|---|---|---|
| 0 | Setup: project, Vercel, Neon, login, TMDB connection, dark theme base | Foundation |
| 1 | Search → Title page → Log/Review → Diary → My Films | You can start logging right away, so data builds up while the rest gets built |
| 2 | Stats dashboard + heatmap + directors + person pages | Needs data from phase 1 |
| 3 | Browse home + Discover + hubs | Mostly read-only TMDB pages |
| 4 | Watchlist, custom lists, Recap, data export, install as a phone app (PWA) | Polish |
| 5 | Plex auto-logging, tier list, table view, Rotten Tomatoes scores | Later features |

---

### Progress

**Built:**
- Phase 0: project setup, database, login, TMDB connection, dark theme
- Phase 1: search (⌘K/"/"), title pages, the log/review dialog (1–10, liked, rewatch, formatted review, main review, spoilers, where/format/with/tags, TV seasons), Diary, Library (sorts + filters)
- Phase 2: Stats (movie and TV heatmaps with all-time/year/month views, click a day, streaks, directors, actors, genres, decades, ratings, where you watched) and person pages ("you've seen 7 of 12")
- Phase 3, partly: Home, Movies and TV browse pages (hero, Top 10 rows, In Theaters, Coming Soon, genre rows, Hidden Gems, "Because you rated…", "From your watchlist", hide-watched toggle)
- Phase 4, partly: Watchlist, Settings (privacy)
- **Import** (Settings → Import): Letterboxd ZIP (diary, reviews, ratings, likes) and TMDB ratings CSVs, with a review screen before saving.
  - Rules: TMDB ratings come in as "date unknown"; half points round up; Letterboxd wins when both have a film.
  - Re-running an import skips anything already imported.

**Next up:**
1. Discover page (full filter panel) + studio/franchise hubs, and "See all" links on rows
2. Deploy: Vercel + Neon, plus a daily cron that refreshes cached titles
3. Custom lists, Recap (year in review), data export
4. Plex webhooks auto-logging
5. Tier list / drag-to-rank, table view
