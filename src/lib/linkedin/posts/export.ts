import type { LinkedInPostsRun, LinkedInPostsRunItem } from "./api";
import { linkedinPostsRunsItemsList } from "./api";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchAllRunItems(
  runId: string,
): Promise<LinkedInPostsRunItem[]> {
  const pageSize = 100;
  let page = 1;
  const items: LinkedInPostsRunItem[] = [];

  while (true) {
    const result = await linkedinPostsRunsItemsList(runId, page, pageSize);
    items.push(...result.items);
    if (items.length >= result.total || result.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

function runSlug(run: LinkedInPostsRun) {
  const slug = run.profile_url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 48);
  return slug || run.id.slice(0, 8);
}

export function exportRunJson(run: LinkedInPostsRun, items: LinkedInPostsRunItem[]) {
  const payload = {
    run,
    items,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(`linkedin-posts-${runSlug(run)}.json`, blob);
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportRunCsv(run: LinkedInPostsRun, items: LinkedInPostsRunItem[]) {
  const headers = [
    "ordinal",
    "post_id",
    "text",
    "posted_at",
    "author_name",
    "author_url",
    "post_url",
    "like_count",
    "comment_count",
    "repost_count",
    "media_urls",
    "matched",
  ];

  const rows = items.map((item) =>
    [
      String(item.ordinal),
      item.post_id,
      item.text ?? "",
      item.posted_at ?? "",
      item.author_name ?? "",
      item.author_url ?? "",
      item.post_url ?? "",
      item.like_count != null ? String(item.like_count) : "",
      item.comment_count != null ? String(item.comment_count) : "",
      item.repost_count != null ? String(item.repost_count) : "",
      item.media_urls ?? "",
      item.matched ? "yes" : "no",
    ]
      .map(csvEscape)
      .join(","),
  );

  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(`linkedin-posts-${runSlug(run)}.csv`, blob);
}
