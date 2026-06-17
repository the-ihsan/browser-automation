import { useEffect, useState } from "react";
import { ExternalLink, FileText, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/linkedin/posts/media";

type PostMediaPreviewProps = {
  items: MediaItem[];
};

function ImageTile({
  url,
  className,
  onClick,
}: {
  url: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex items-center justify-center bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        Open image
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cn("relative block overflow-hidden bg-muted", className)}
      onClick={onClick}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function ImageGrid({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const count = images.length;

  if (count === 0) return null;

  if (count === 1) {
    return (
      <>
        <div className="overflow-hidden rounded-lg border bg-muted">
          <ImageTile
            url={images[0]}
            className="max-h-[28rem] w-full"
            onClick={() => setLightbox(images[0])}
          />
        </div>
        {lightbox ? (
          <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "grid gap-1 overflow-hidden rounded-lg border bg-muted p-1",
          count === 2
            ? "grid-cols-2"
            : count === 3
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {images.map((url, index) => (
          <ImageTile
            key={`${url}-${index}`}
            url={url}
            className={cn(
              "aspect-[4/3] w-full",
              count === 3 && index === 0 && "row-span-2 aspect-auto min-h-full",
            )}
            onClick={() => setLightbox(url)}
          />
        ))}
      </div>
      {lightbox ? (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={url}
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function VideoPreview({ url, poster }: { url: string; poster?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video items-center justify-center gap-2 rounded-lg border bg-muted text-sm text-muted-foreground"
      >
        <Play className="size-5" />
        Open video
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-black">
      <video
        src={url}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="max-h-[28rem] w-full bg-black"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function DocumentPreview({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 transition-colors hover:bg-muted"
    >
      <FileText className="size-8 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Document</p>
      </div>
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function PostMediaPreview({ items }: PostMediaPreviewProps) {
  const images = items
    .filter((item) => item.kind === "image")
    .map((item) => item.url);
  const videos = items.filter((item) => item.kind === "video");
  const documents = items.filter((item) => item.kind === "document");

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 ? <ImageGrid images={images} /> : null}
      {videos.map((item) => (
        <VideoPreview key={item.url} url={item.url} poster={item.poster} />
      ))}
      {documents.map((item) => (
        <DocumentPreview key={item.url} url={item.url} label={item.label} />
      ))}
    </div>
  );
}
