import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { subscribeBrowserEvents } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  browserClosed,
  launchBrowser,
  selectBrowserRun,
  selectBusy,
  selectError,
  selectHeadless,
  selectPending,
  selectRunning,
  setHeadless,
  stopBrowser,
  syncBrowserStatus,
  type PendingAction,
} from "@/store/browserSlice";

function shortId(runId: string) {
  return runId.slice(0, 8);
}

function statusLabel(
  run: ReturnType<typeof selectBrowserRun>,
  pending: PendingAction,
) {
  if (pending === "launch") return "Launching browser…";
  if (pending === "stop") return "Stopping browser…";
  if (!run) return "Browser stopped";
  if (run.crashed) return `Browser crashed (${shortId(run.run_id)})`;
  if (run.running) {
    return `Browser running · ${shortId(run.run_id)} · ${run.headless ? "headless" : "visible"}`;
  }
  return "Browser stopped";
}

export function BrowserToolPage() {
  const dispatch = useAppDispatch();
  const headless = useAppSelector(selectHeadless);
  const run = useAppSelector(selectBrowserRun);
  const pending = useAppSelector(selectPending);
  const error = useAppSelector(selectError);
  const busy = useAppSelector(selectBusy);
  const running = useAppSelector(selectRunning);

  useEffect(() => {
    dispatch(syncBrowserStatus(undefined));
  }, [dispatch]);

  useEffect(() => {
    const un = subscribeBrowserEvents((event) => {
      if (event.channel !== "browser.closed") return;
      dispatch(browserClosed(event.payload));
    });
    return () => {
      un.then((u) => u());
    };
  }, [dispatch]);

  useEffect(() => {
    const activeRunId = run?.running ? run.run_id : null;
    if (!activeRunId) return;

    const interval = window.setInterval(() => {
      dispatch(syncBrowserStatus(activeRunId));
    }, 2000);

    return () => window.clearInterval(interval);
  }, [dispatch, run?.running, run?.run_id]);

  const handleLaunch = () => {
    dispatch(launchBrowser(headless));
  };

  const handleStop = () => {
    if (!run?.run_id) return;
    dispatch(stopBrowser(run.run_id));
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Browser</h1>
        <p className="text-sm text-muted-foreground">
          Launch and control a Playwright Chromium session for automation tools.
        </p>
      </div>

      <div className="flex max-w-lg flex-col gap-6 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {busy && <Spinner className="size-4" />}
          <p>{statusLabel(run, pending)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="headless"
            checked={headless}
            disabled={running || busy}
            onCheckedChange={(checked) =>
              dispatch(setHeadless(checked === true))
            }
          />
          <label
            htmlFor="headless"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Headless
          </label>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            disabled={running || busy}
            onClick={handleLaunch}
          >
            {pending === "launch" ? (
              <>
                <Spinner className="size-4" />
                Launching…
              </>
            ) : (
              "Launch browser"
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!running || busy}
            onClick={handleStop}
          >
            {pending === "stop" ? (
              <>
                <Spinner className="size-4" />
                Stopping…
              </>
            ) : (
              "Stop browser"
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
