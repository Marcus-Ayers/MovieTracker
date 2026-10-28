import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/page";

/**
 * The 404 page, for unknown addresses and for notFound() calls (a movie id that doesn't exist, an unknown
 * username…).
 */

export default function NotFound() {
  return (
    <Notice icon={<Clapperboard className="size-6" />} title="Not found">
      <p className="mb-6">That page, movie, or person doesn&apos;t exist.</p>
      <Link href="/" className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
        Back to browsing
      </Link>
    </Notice>
  );
}
