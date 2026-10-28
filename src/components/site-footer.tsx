import Image from "next/image";

/**
 * The footer, with the TMDB and JustWatch credits TMDB's terms ask for.
 */

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line/60 px-4 py-10 text-sm text-dim sm:px-8 lg:px-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl leading-relaxed">
          Movie and TV data and images come from TMDB. This product uses the TMDB API but is not endorsed or certified
          by TMDB. Streaming availability is provided by JustWatch.
        </p>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="shrink-0 opacity-80 hover:opacity-100">
          <Image src="/tmdb-logo.svg" alt="TMDB" width={120} height={16} />
        </a>
      </div>
    </footer>
  );
}
