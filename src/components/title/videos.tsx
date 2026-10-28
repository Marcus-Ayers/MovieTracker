"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Video } from "@/lib/tmdb";
import { Modal } from "../ui/modal";

function Player({ video, onClose }: { video: Video | null; onClose: () => void }) {
  return (
    <Modal open={video !== null} onClose={onClose} label={video?.name ?? "Video"} size="xl" centered>
      {video && (
        <div className="aspect-video w-full bg-black">
          {/* Only plays because you clicked; nothing on the site autoplays. */}
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
            title={video.name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
      )}
    </Modal>
  );
}

export function TrailerButton({ trailer }: { trailer: Video }) {
  const [playing, setPlaying] = useState<Video | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(trailer)}
        className="inline-flex items-center gap-2 rounded bg-white/15 px-5 py-2.5 font-semibold backdrop-blur transition hover:bg-white/25"
      >
        <Play className="size-5 fill-current" />
        Trailer
      </button>
      <Player video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

export function VideoStrip({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState<Video | null>(null);
  // Videos removed from YouTube have no thumbnail; hide them.
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const shown = videos.filter((v) => !broken.has(v.key));
  if (!shown.length) return null;
  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {shown.map((video) => (
          <button
            key={video.key}
            type="button"
            onClick={() => setPlaying(video)}
            className="group/video w-64 shrink-0 text-left"
          >
            <div className="relative aspect-video overflow-hidden rounded-md bg-surface-2">
              <Image
                src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
                alt=""
                fill
                sizes="256px"
                className="object-cover transition duration-300 group-hover/video:scale-105"
                onError={() => setBroken((b) => new Set(b).add(video.key))}
              />
              <div className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover/video:bg-black/10">
                <span className="grid size-11 place-items-center rounded-full bg-black/60 ring-1 ring-white/40">
                  <Play className="size-5 translate-x-px fill-white text-white" />
                </span>
              </div>
            </div>
            <p className="mt-2 line-clamp-1 text-sm">{video.name}</p>
            <p className="text-xs text-dim">{video.type}</p>
          </button>
        ))}
      </div>
      <Player video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
