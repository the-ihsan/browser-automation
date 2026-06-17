import { List, Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { parseSessionIds, type LinkedInPostsRun } from "@/lib/linkedin/posts/api";

type RunControlPanelProps = {
  run: LinkedInPostsRun | null;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onViewResults?: () => void;
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

export function RunControlPanel({
  run,
  busy,
  onPause,
  onResume,
  onStop,
  onRestart,
  onDelete,
  onViewResults,
}: RunControlPanelProps) {
  if (!run) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Select a run to view details.
      </section>
    );
  }

  const sessionIds = parseSessionIds(run);
  const canPause = run.status === "running";
  const canResume = run.status === "paused";
  const canStop = run.status === "running" || run.status === "paused";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{run.profile_url}</h2>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusClass(run.status)}`}
            >
              {run.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.matched_count} matched · {run.collected_count} collected
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {onViewResults ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onViewResults}
            >
              <List className="size-4" />
              Results
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            disabled={busy || !canPause}
            onClick={onPause}
            title="Pause"
          >
            {busy ? <Spinner className="size-4" /> : <Pause className="size-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={busy || !canResume}
            onClick={onResume}
            title="Resume"
          >
            <Play className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={busy || !canStop}
            onClick={onStop}
            title="Stop"
          >
            <Square className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onRestart}
            title="Re-run scrape from scratch"
          >
            <RotateCcw className="size-4" />
            Re-run
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={busy}
            onClick={onDelete}
            title="Delete run"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {run.error_message ? (
            <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {run.error_message}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Start from</dt>
              <dd>{run.start_from}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Post limit</dt>
              <dd>{run.post_count ?? "all"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Headless</dt>
              <dd>{run.headless ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sessions</dt>
              <dd>{sessionIds.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(run.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{new Date(run.updated_at).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </ScrollArea>
    </section>
  );
}
