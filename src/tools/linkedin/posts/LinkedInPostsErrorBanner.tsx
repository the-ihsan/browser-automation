import { Button } from "@/components/ui/button";

type LinkedInPostsErrorBannerProps = {
  error: string;
  onDismiss: () => void;
};

export function LinkedInPostsErrorBanner({
  error,
  onDismiss,
}: LinkedInPostsErrorBannerProps) {
  return (
    <div className="flex shrink-0 items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>{error}</span>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
