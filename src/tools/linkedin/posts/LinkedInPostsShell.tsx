import { useEffect } from "react";
import { ScrollText } from "lucide-react";
import { Outlet, useParams } from "react-router-dom";

import { subscribeLinkedInPostsEvents } from "@/lib/linkedin/posts/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadSessions } from "@/store/sessionsSlice";
import {
  clearError,
  loadRunItems,
  loadRuns,
  loadSelectedRun,
  selectItem,
  selectLinkedInItemsPage,
  selectLinkedInItemsPageSize,
  selectLinkedInPostsError,
  selectLinkedInRunsPage,
  selectRun,
} from "@/store/linkedin/postsSlice";

import { LinkedInPostsErrorBanner } from "./LinkedInPostsErrorBanner";

export function LinkedInPostsShell() {
  const dispatch = useAppDispatch();
  const { runId, itemId } = useParams<{ runId?: string; itemId?: string }>();
  const runsPage = useAppSelector(selectLinkedInRunsPage);
  const itemsPage = useAppSelector(selectLinkedInItemsPage);
  const itemsPageSize = useAppSelector(selectLinkedInItemsPageSize);
  const error = useAppSelector(selectLinkedInPostsError);

  useEffect(() => {
    dispatch(loadRuns({}));
    dispatch(loadSessions("linkedin"));
  }, [dispatch]);

  useEffect(() => {
    if (!runId) return;
    dispatch(selectRun(runId));
    dispatch(loadSelectedRun(runId));
    dispatch(loadRunItems({ runId }));
  }, [dispatch, runId]);

  useEffect(() => {
    if (itemId) {
      dispatch(selectItem(itemId));
    }
  }, [dispatch, itemId]);

  useEffect(() => {
    const un = subscribeLinkedInPostsEvents((event) => {
      const channel = event.channel;
      const eventRunId =
        typeof event.payload.run_id === "string"
          ? event.payload.run_id
          : null;

      if (
        channel === "linkedin.posts.run.post" ||
        channel === "linkedin.posts.run.finished" ||
        channel === "linkedin.posts.run.progress"
      ) {
        dispatch(loadRuns({ page: runsPage }));
        if (eventRunId && eventRunId === runId) {
          dispatch(loadSelectedRun(eventRunId));
          dispatch(
            loadRunItems({
              runId: eventRunId,
              page: itemsPage,
              pageSize: itemsPageSize,
            }),
          );
        }
      }
    });
    return () => {
      un.then((u) => u());
    };
  }, [dispatch, runId, runsPage, itemsPage, itemsPageSize]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <header className="shrink-0">
        <div className="flex items-center gap-3">
          <ScrollText className="size-8 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Posts scrapper
            </h1>
            <p className="text-sm text-muted-foreground">
              Create scrape runs and browse collected posts.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <LinkedInPostsErrorBanner
          error={error}
          onDismiss={() => dispatch(clearError())}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
