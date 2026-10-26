import { KeyRound } from "lucide-react";

/** Shown in place of TMDB-powered pages until the API key is added. */
export function MissingKey() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-32">
      <div className="rounded-xl border border-line bg-surface p-8">
        <KeyRound className="mb-4 size-8 text-accent" />
        <h1 className="mb-2 text-2xl font-bold">Add your TMDB key to get started</h1>
        <p className="mb-6 text-muted">All the movie and TV data comes from TMDB. The site needs your key before it can load anything.</p>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>
            Open <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.local</code> in the project folder.
          </li>
          <li>
            Paste your key after <code className="rounded bg-surface-3 px-1.5 py-0.5">TMDB_API_KEY=</code>. Either value from{" "}
            <a className="underline decoration-accent underline-offset-4" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
              TMDB → Settings → API
            </a>{" "}
            works; the long “API Read Access Token” is preferred.
          </li>
          <li>Stop the dev server (Ctrl+C) and run <code className="rounded bg-surface-3 px-1.5 py-0.5">npm run dev</code> again.</li>
        </ol>
      </div>
    </div>
  );
}
