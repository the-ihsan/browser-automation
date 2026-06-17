export type MediaItem =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster?: string }
  | { kind: "document"; url: string; label: string };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const DOCUMENT_EXT = /\.(pdf|pptx?|docx?)(\?|$)/i;

function isUsableUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return !lower.startsWith("blob:") && !lower.startsWith("data:");
}

function isVideoUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    VIDEO_EXT.test(url) ||
    lower.includes("feedshare-video") ||
    lower.includes("/video/") ||
    lower.includes("videoplayback")
  );
}

function isDocumentUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    DOCUMENT_EXT.test(url) ||
    lower.includes("feedshare-document") ||
    lower.includes("document-snapshot")
  );
}

function isPosterUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("videocover") || lower.includes("poster");
}

function isImageUrl(url: string) {
  if (isVideoUrl(url) || isDocumentUrl(url)) return false;
  const lower = url.toLowerCase();
  return (
    IMAGE_EXT.test(url) ||
    lower.includes("media.licdn.com") ||
    lower.includes("dms.licdn.com") ||
    lower.includes("feedshare-image") ||
    lower.includes("image-shrink")
  );
}

function documentLabel(url: string) {
  try {
    const path = new URL(url).pathname.split("/").pop() ?? "Document";
    return decodeURIComponent(path);
  } catch {
    return "Document";
  }
}

type RawMediaEntry = {
  kind?: string;
  url?: string;
  poster?: string;
  label?: string;
  role?: string;
};

function parseStructuredEntry(entry: RawMediaEntry): MediaItem | null {
  const url = entry.url?.trim();
  if (!url || !isUsableUrl(url)) return null;

  if (entry.role === "poster") return null;

  const kind = entry.kind;
  if (kind === "document") {
    return { kind: "document", url, label: entry.label || documentLabel(url) };
  }
  if (kind === "video") {
    const poster = entry.poster?.trim();
    return {
      kind: "video",
      url,
      poster: poster && isUsableUrl(poster) ? poster : undefined,
    };
  }
  if (kind === "image") {
    return { kind: "image", url };
  }
  return null;
}

function classifyUrl(url: string): MediaItem | "poster" | null {
  if (isDocumentUrl(url)) {
    return { kind: "document", url, label: documentLabel(url) };
  }
  if (isVideoUrl(url)) {
    return { kind: "video", url };
  }
  if (isPosterUrl(url)) {
    return "poster";
  }
  if (isImageUrl(url)) {
    return { kind: "image", url };
  }
  return null;
}

function parseLegacyUrls(urls: string[]): MediaItem[] {
  const seen = new Set<string>();
  const images: string[] = [];
  const videos: { url: string; poster?: string }[] = [];
  const documents: { url: string; label: string }[] = [];
  const posters: string[] = [];

  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed) || !isUsableUrl(trimmed)) continue;
    seen.add(trimmed);

    const classified = classifyUrl(trimmed);
    if (!classified) continue;

    if (classified === "poster") {
      posters.push(trimmed);
      continue;
    }

    if (classified.kind === "document") {
      documents.push({ url: classified.url, label: classified.label });
      continue;
    }

    if (classified.kind === "video") {
      videos.push({ url: classified.url });
      continue;
    }

    images.push(classified.url);
  }

  for (let i = 0; i < videos.length; i++) {
    if (!videos[i].poster) {
      if (posters[i]) {
        videos[i].poster = posters[i];
      } else if (images.length > 0) {
        videos[i].poster = images.shift();
      }
    }
  }

  return [
    ...images.map((url) => ({ kind: "image" as const, url })),
    ...videos.map(({ url, poster }) => ({
      kind: "video" as const,
      url,
      poster,
    })),
    ...documents.map(({ url, label }) => ({
      kind: "document" as const,
      url,
      label,
    })),
  ];
}

export function parseMediaUrls(raw: string | null): MediaItem[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const hasStructured = parsed.some(
    (entry) => typeof entry === "object" && entry !== null && "kind" in entry,
  );

  if (hasStructured) {
    const seen = new Set<string>();
    const items: MediaItem[] = [];

    for (const entry of parsed) {
      if (typeof entry === "string") {
        const classified = classifyUrl(entry.trim());
        if (!classified || classified === "poster") continue;
        if (seen.has(classified.url)) continue;
        seen.add(classified.url);
        items.push(classified);
        continue;
      }

      if (typeof entry !== "object" || entry === null) continue;

      const item = parseStructuredEntry(entry as RawMediaEntry);
      if (!item || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }

    return items;
  }

  const urls = parsed.filter((url): url is string => typeof url === "string");
  return parseLegacyUrls(urls);
}
