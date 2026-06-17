import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  installChromium,
  selectSetupError,
  selectSetupInstalling,
} from "@/store/setupSlice";

export function SetupScreen() {
  const dispatch = useAppDispatch();
  const installing = useAppSelector(selectSetupInstalling);
  const error = useAppSelector(selectSetupError);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up Chromium
        </h1>
        <p className="text-sm text-muted-foreground">
          Playwright Tools needs a local Chromium browser before you can launch
          automation sessions. This one-time download is tailored to your
          operating system.
        </p>
      </div>

      <Button
        type="button"
        disabled={installing}
        onClick={() => dispatch(installChromium())}
      >
        {installing ? (
          <>
            <Spinner className="size-4" />
            Installing Chromium…
          </>
        ) : (
          "Install Chromium"
        )}
      </Button>

      {error && (
        <p className="max-w-md text-center text-sm text-destructive">{error}</p>
      )}
    </main>
  );
}
