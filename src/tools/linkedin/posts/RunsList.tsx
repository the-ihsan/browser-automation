import { List, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LinkedInPostsRun } from "@/lib/linkedin/posts/api";

type RunsListProps = {
  runs: LinkedInPostsRun[];
  selectedRunId?: string | null;
  page: number;
  pageSize: number;
  total: number;
  busy: boolean;
  onSelect: (id: string) => void;
  onViewResults: (id: string) => void;
  onPageChange: (page: number) => void;
  onDelete?: (id: string) => void;
};

function statusClass(status: string) {
  switch (status) {
    case "running":
      return "bg-primary/15 text-primary";
    case "paused":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "completed":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "failed":
    case "stopped":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function truncateUrl(url: string, max = 48) {
  if (url.length <= max) return url;
  return `${url.slice(0, max)}…`;
}

export function RunsList({
  runs,
  selectedRunId = null,
  page,
  pageSize,
  total,
  busy,
  onSelect,
  onViewResults,
  onPageChange,
  onDelete,
}: RunsListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium">Runs ({total})</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {runs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul>
            {runs.map((run) => (
              <li
                key={run.id}
                className={`flex border-b ${
                  selectedRunId === run.id ? "bg-accent/30" : ""
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 px-4 py-3 text-left text-sm hover:bg-accent/20"
                  onClick={() => onSelect(run.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {truncateUrl(run.profile_url)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${statusClass(run.status)}`}
                    >
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {run.matched_count}/{run.collected_count} posts ·{" "}
                    {new Date(run.created_at).toLocaleString()}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1 pr-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onViewResults(run.id)}
                  >
                    <List className="size-4" />
                    Results
                  </Button>
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busy}
                      title="Delete run"
                      onClick={() => onDelete(run.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
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
