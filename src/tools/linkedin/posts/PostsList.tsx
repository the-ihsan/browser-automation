import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LinkedInPostsRunItem } from "@/lib/linkedin/posts/api";

type PostsListProps = {
  items: LinkedInPostsRunItem[];
  selectedItemId: string | null;
  page: number;
  pageSize: number;
  total: number;
  busy: boolean;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
};

export function PostsList({
  items,
  selectedItemId,
  page,
  pageSize,
  total,
  busy,
  onSelect,
  onPageChange,
}: PostsListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="shrink-0 border-b px-3 py-1.5 text-sm font-medium">
        Scraped posts ({total})
      </div>
      <ScrollArea className="h-full min-h-0 flex-1">
        {items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedItemId === item.id
                      ? "bg-accent/50"
                      : "hover:bg-muted/40"
                  }`}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    #{item.ordinal}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {item.text || item.post_id}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.matched ? "match" : "skip"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
