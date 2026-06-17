import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionInfo } from "@/lib/sessions/api";
import type { CreateRunInput } from "@/lib/linkedin/posts/api";
import { linkedInPostsResultsPath } from "@/lib/linkedin/posts/routes";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createRun,
  deleteRun,
  loadRuns,
  loadSelectedRun,
  pauseRun,
  restartRun,
  resumeRun,
  selectRun,
  stopRun,
  selectLinkedInPostsPending,
  selectLinkedInRuns,
  selectLinkedInRunsPage,
  selectLinkedInRunsPageSize,
  selectLinkedInRunsTotal,
  selectSelectedRun,
  selectSelectedRunId,
} from "@/store/linkedin/postsSlice";
import { selectSessions } from "@/store/sessionsSlice";

import { CreateRunForm } from "./CreateRunForm";
import { RunControlPanel } from "./RunControlPanel";
import { RunsList } from "./RunsList";

type IndexTab = "runs" | "detail" | "form";

function NewRunPanel({
  sessions,
  busy,
  onSubmit,
}: {
  sessions: SessionInfo[];
  busy: boolean;
  onSubmit: (input: CreateRunInput) => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-medium">New scrape run</h2>
        <p className="text-xs text-muted-foreground">
          Scrape posts from a LinkedIn profile using saved sessions.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <CreateRunForm sessions={sessions} busy={busy} onSubmit={onSubmit} />
        </div>
      </ScrollArea>
    </section>
  );
}

export function PostsIndexPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const runs = useAppSelector(selectLinkedInRuns);
  const runsPage = useAppSelector(selectLinkedInRunsPage);
  const runsPageSize = useAppSelector(selectLinkedInRunsPageSize);
  const runsTotal = useAppSelector(selectLinkedInRunsTotal);
  const selectedRunId = useAppSelector(selectSelectedRunId);
  const selectedRun = useAppSelector(selectSelectedRun);
  const pending = useAppSelector(selectLinkedInPostsPending);
  const allSessions = useAppSelector(selectSessions);
  const linkedinSessions = allSessions.filter((s) => s.platform === "linkedin");
  const busy = pending !== null;
  const [tab, setTab] = useState<IndexTab>("runs");

  function handleSelectRun(runId: string) {
    dispatch(selectRun(runId));
    dispatch(loadSelectedRun(runId));
    setTab("detail");
  }

  function handleNewRun() {
    dispatch(selectRun(null));
    setTab("form");
  }

  function confirmDelete(runId: string) {
    if (
      window.confirm(
        "Delete this run and all scraped posts? This cannot be undone.",
      )
    ) {
      dispatch(deleteRun(runId));
      if (selectedRunId === runId) {
        dispatch(selectRun(null));
        setTab("runs");
      }
    }
  }

  async function handleCreate(input: CreateRunInput) {
    const result = await dispatch(createRun(input));
    if (createRun.fulfilled.match(result)) {
      navigate(linkedInPostsResultsPath(result.payload.id));
    }
  }

  const showRunDetail = selectedRunId !== null && tab !== "form";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-end gap-2 lg:hidden">
        <div className="flex flex-1 gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "runs"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("runs")}
          >
            Runs
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "detail"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("detail")}
          >
            Details
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "form"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={handleNewRun}
          >
            New run
          </button>
        </div>
      </div>

      <div className="hidden shrink-0 justify-end lg:flex">
        <Button variant="outline" size="sm" onClick={handleNewRun}>
          New run
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div
          className={cn(
            "min-h-0 overflow-hidden",
            tab !== "runs" && "hidden lg:block",
          )}
        >
          <RunsList
            runs={runs}
            selectedRunId={selectedRunId}
            page={runsPage}
            pageSize={runsPageSize}
            total={runsTotal}
            busy={busy}
            onSelect={handleSelectRun}
            onViewResults={(id) => navigate(linkedInPostsResultsPath(id))}
            onPageChange={(page) => dispatch(loadRuns({ page }))}
            onDelete={confirmDelete}
          />
        </div>

        <div
          className={cn(
            "min-h-0 overflow-hidden",
            tab === "runs" && "hidden lg:block",
          )}
        >
          {showRunDetail ? (
            <RunControlPanel
              run={selectedRun}
              busy={busy}
              onPause={() => dispatch(pauseRun(selectedRunId))}
              onResume={() => dispatch(resumeRun(selectedRunId))}
              onStop={() => dispatch(stopRun(selectedRunId))}
              onRestart={() => dispatch(restartRun(selectedRunId))}
              onDelete={() => confirmDelete(selectedRunId)}
              onViewResults={() =>
                navigate(linkedInPostsResultsPath(selectedRunId))
              }
            />
          ) : (
            <NewRunPanel
              sessions={linkedinSessions}
              busy={busy}
              onSubmit={handleCreate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
