import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LinkedInPostsRunItem } from "@/lib/linkedin/posts/api";
import { parseMediaUrls } from "@/lib/linkedin/posts/media";

import { PostMediaPreview } from "./PostMediaPreview";

type PostDetailProps = {
  post: LinkedInPostsRunItem | null;
};

export function PostDetail({ post }: PostDetailProps) {
  const [copied, setCopied] = useState(false);

  if (!post) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a post to view details.
      </p>
    );
  }

  let rawJson = "";
  if (post.raw_data) {
    try {
      rawJson = JSON.stringify(JSON.parse(post.raw_data), null, 2);
    } catch {
      rawJson = post.raw_data;
    }
  }

  const mediaItems = parseMediaUrls(post.media_urls);

  return (
    <article className="flex flex-col gap-4 text-sm">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">Author</p>
        <p className="font-semibold">{post.author_name || "—"}</p>
        {post.author_url ? (
          <a
            href={post.author_url}
            className="truncate text-xs text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {post.author_url}
          </a>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {post.posted_at || "—"}
        </p>
      </header>

      {post.text ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Post text</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(post.text ?? "");
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? (
                <>
                  <Check />
                  Copied
                </>
              ) : (
                <>
                  <Copy />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">{post.text}</div>
        </div>
      ) : null}

      <PostMediaPreview items={mediaItems} />

      <div className="text-xs text-muted-foreground">
        {post.like_count ?? 0} reactions · {post.comment_count ?? 0} comments ·{" "}
        {post.repost_count ?? 0} reposts
      </div>

      {post.post_url ? (
        <a
          href={post.post_url}
          className="text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open on LinkedIn
        </a>
      ) : null}

      {rawJson ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Raw JSON
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
            {rawJson}
          </pre>
        </details>
      ) : null}
    </article>
  );
}
