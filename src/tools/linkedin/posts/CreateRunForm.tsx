import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { SessionInfo } from "@/lib/sessions/api";
import type { CreateRunInput } from "@/lib/linkedin/posts/api";

type CreateRunFormProps = {
  sessions: SessionInfo[];
  busy: boolean;
  onSubmit: (input: CreateRunInput) => void;
};

export function CreateRunForm({ sessions, busy, onSubmit }: CreateRunFormProps) {
  const [profileUrl, setProfileUrl] = useState("");
  const [postCount, setPostCount] = useState("");
  const [startFrom, setStartFrom] = useState("1");
  const [postMatcher, setPostMatcher] = useState("");
  const [headless, setHeadless] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedSessions(new Set(sessions.map((s) => s.id)));
  }, [sessions]);

  function toggleSession(id: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: CreateRunInput = {
      profile_url: profileUrl.trim(),
      session_ids:
        selectedSessions.size === sessions.length
          ? undefined
          : Array.from(selectedSessions),
      post_count: postCount.trim() ? Number(postCount) : null,
      start_from: Number(startFrom) || 1,
      post_matcher: postMatcher.trim() || null,
      headless,
    };
    onSubmit(input);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Profile URL
        </label>
        <Input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/... or username"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Post count (empty = all)
          </label>
          <Input
            type="number"
            min={1}
            value={postCount}
            onChange={(e) => setPostCount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Start from
          </label>
          <Input
            type="number"
            min={1}
            value={startFrom}
            onChange={(e) => setStartFrom(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Post matcher (optional JS)
        </label>
        <textarea
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[4rem] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={postMatcher}
          onChange={(e) => setPostMatcher(e.target.value)}
          placeholder="return post.text.includes('hiring');"
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Sessions</p>
        <div className="flex max-h-28 flex-col gap-1 overflow-auto rounded border p-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No LinkedIn sessions — create one under Sessions.
            </p>
          ) : (
            sessions.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSessions.has(s.id)}
                  onChange={() => toggleSession(s.id)}
                />
                {s.name}
              </label>
            ))
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={headless}
          onChange={(e) => setHeadless(e.target.checked)}
        />
        Headless browser
      </label>
      <Button type="submit" disabled={busy || !profileUrl.trim()}>
        {busy ? <Spinner className="size-4" /> : "Start scrape"}
      </Button>
    </form>
  );
}
