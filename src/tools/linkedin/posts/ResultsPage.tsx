import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  exportRunCsv,
  exportRunJson,
  fetchAllRunItems,
} from "@/lib/linkedin/posts/export";
import {
  linkedInPostsIndexPath,
  linkedInPostsPostPath,
} from "@/lib/linkedin/posts/routes";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  loadRunItems,
  selectLinkedInItems,
  selectLinkedInItemsPage,
  selectLinkedInItemsPageSize,
  selectLinkedInItemsTotal,
  selectLinkedInPostsPending,
  selectSelectedItem,
  selectSelectedItemId,
  selectSelectedRun,
} from "@/store/linkedin/postsSlice";

import { PostDetail } from "./PostDetail";
import { PostsList } from "./PostsList";

type ResultsTab = "posts" | "detail";

export function ResultsPage() {
  const { runId, itemId } = useParams<{ runId: string; itemId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const selectedRun = useAppSelector(selectSelectedRun);
  const items = useAppSelector(selectLinkedInItems);
  const itemsPage = useAppSelector(selectLinkedInItemsPage);
  const itemsPageSize = useAppSelector(selectLinkedInItemsPageSize);
  const itemsTotal = useAppSelector(selectLinkedInItemsTotal);
  const selectedItemId = useAppSelector(selectSelectedItemId);
  const selectedItem = useAppSelector(selectSelectedItem);
  const pending = useAppSelector(selectLinkedInPostsPending);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<ResultsTab>(itemId ? "detail" : "posts");

  useEffect(() => {
    if (itemId) {
      setTab("detail");
    }
  }, [itemId]);

  const run = selectedRun?.id === runId ? selectedRun : null;
  const busy = pending !== null || exporting;

  if (!runId) return null;

  const activeRunId = runId;

  async function handleExport(format: "json" | "csv") {
    if (!run) return;
    setExporting(true);
    try {
      const allItems = await fetchAllRunItems(run.id);
      if (format === "json") {
        exportRunJson(run, allItems);
      } else {
        exportRunCsv(run, allItems);
      }
    } finally {
      setExporting(false);
    }
  }

  function handleSelectPost(id: string) {
    navigate(linkedInPostsPostPath(activeRunId, id));
    setTab("detail");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => navigate(linkedInPostsIndexPath)}
        >
          <ArrowLeft className="size-4" />
          All runs
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!run || busy}
            onClick={() => handleExport("json")}
          >
            {exporting ? (
              <Spinner className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!run || busy}
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {run ? (
        <p className="shrink-0 truncate text-sm text-muted-foreground">
          {run.profile_url} · {run.collected_count} posts · {run.status}
        </p>
      ) : null}

      <div className="flex shrink-0 gap-1 rounded-lg border bg-muted/40 p-1 lg:hidden">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "posts"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("posts")}
        >
          Posts
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
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-2 lg:gap-4">
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col overflow-hidden lg:static lg:inset-auto lg:h-full",
            tab !== "posts" && "hidden lg:flex",
          )}
        >
          <PostsList
            items={items}
            selectedItemId={itemId ?? selectedItemId}
            page={itemsPage}
            pageSize={itemsPageSize}
            total={itemsTotal}
            busy={busy}
            onSelect={handleSelectPost}
            onPageChange={(page) =>
              dispatch(loadRunItems({ runId: activeRunId, page }))
            }
          />
        </div>

        <section
          className={cn(
            "absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:static lg:inset-auto lg:h-full",
            tab !== "detail" && "hidden lg:flex",
          )}
        >
          <div className="shrink-0 border-b px-4 py-2 text-sm font-medium">
            Post details
          </div>
          <ScrollArea className="h-full min-h-0 flex-1">
            <div className="p-4">
              <PostDetail post={selectedItem} />
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}
