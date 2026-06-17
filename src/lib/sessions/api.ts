import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { PlatformSlug } from "@/lib/tools/registry";

export type SessionInfo = {
  id: string;
  platform: string;
  name: string;
  status: "idle" | "running" | "error";
  active_run_id: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  has_storage: boolean;
};

export type SessionLaunchResult = {
  session: SessionInfo;
  run_id: string;
  running: boolean;
  url: string;
};

export type SessionCheckResult = {
  session: SessionInfo;
  ok: boolean;
  logged_in: boolean;
  url: string;
  cookie_count: number;
};

export type StoredCookie = {
  name: string;
  domain: string;
  path: string;
  value: string;
  expires: number | null;
  http_only: boolean;
  secure: boolean;
  same_site: string;
};

export type SessionEvent = {
  channel: string;
  payload: {
    session_id: string;
    run_id?: string;
    running?: boolean;
    crashed?: boolean;
  };
};

export const sessionsList = (platform: PlatformSlug) =>
  invoke<SessionInfo[]>("sessions_list", { platform });

export const sessionsCreate = (platform: PlatformSlug, name: string) =>
  invoke<SessionInfo>("sessions_create", { platform, name });

export const sessionsDelete = (sessionId: string) =>
  invoke<void>("sessions_delete", { sessionId });

export const sessionsLaunch = (sessionId: string, fresh = false) =>
  invoke<SessionLaunchResult>("sessions_launch", { sessionId, fresh });

export const sessionsCheck = (sessionId: string) =>
  invoke<SessionCheckResult>("sessions_check", { sessionId });

export const sessionsGetCookies = (sessionId: string) =>
  invoke<StoredCookie[]>("sessions_get_cookies", { sessionId });

export async function subscribeSessionEvents(
  cb: (event: SessionEvent) => void,
): Promise<UnlistenFn> {
  return listen<SessionEvent>("daemon://session", (e) => cb(e.payload));
}
