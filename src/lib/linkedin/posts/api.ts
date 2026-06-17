import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type LinkedInPostsRun = {
  id: string;
  profile_url: string;
  session_ids: string;
  post_count: number | null;
  start_from: number;
  post_matcher: string | null;
  headless: number;
  status: string;
  initial_top_post_id: string | null;
  initial_post_ids: string | null;
  collected_count: number;
  matched_count: number;
  current_session_index: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type LinkedInPostsRunItem = {
  id: string;
  run_id: string;
  post_id: string;
  ordinal: number;
  text: string | null;
  posted_at: string | null;
  author_name: string | null;
  author_url: string | null;
  post_url: string | null;
  like_count: number | null;
  comment_count: number | null;
  repost_count: number | null;
  impression_count: number | null;
  media_urls: string | null;
  raw_data: string | null;
  matched: number;
  session_id: string | null;
  created_at: string;
};

export type PaginatedRuns = {
  items: LinkedInPostsRun[];
  total: number;
  page: number;
  page_size: number;
};

export type PaginatedRunItems = {
  items: LinkedInPostsRunItem[];
  total: number;
  page: number;
  page_size: number;
};

export type CreateRunInput = {
  profile_url: string;
  session_ids?: string[];
  post_count?: number | null;
  start_from?: number;
  post_matcher?: string | null;
  headless?: boolean;
};

export type LinkedInPostsEvent = {
  channel: string;
  payload: Record<string, unknown>;
};

export const linkedinPostsRunsList = (page = 1, pageSize = 20) =>
  invoke<PaginatedRuns>("linkedin_posts_runs_list", {
    page,
    pageSize,
  });

export const linkedinPostsRunsGet = (runId: string) =>
  invoke<LinkedInPostsRun>("linkedin_posts_runs_get", { runId });

export const linkedinPostsRunsItemsList = (
  runId: string,
  page = 1,
  pageSize = 20,
) =>
  invoke<PaginatedRunItems>("linkedin_posts_runs_items_list", {
    runId,
    page,
    pageSize,
  });

export const linkedinPostsRunCreate = (input: CreateRunInput) =>
  invoke<LinkedInPostsRun>("linkedin_posts_run_create", { input });

export const linkedinPostsRunPause = (runId: string) =>
  invoke<void>("linkedin_posts_run_pause", { runId });

export const linkedinPostsRunResume = (runId: string) =>
  invoke<void>("linkedin_posts_run_resume", { runId });

export const linkedinPostsRunStop = (runId: string) =>
  invoke<void>("linkedin_posts_run_stop", { runId });

export const linkedinPostsRunRestart = (runId: string) =>
  invoke<LinkedInPostsRun>("linkedin_posts_run_restart", { runId });

export const linkedinPostsRunDelete = (runId: string) =>
  invoke<void>("linkedin_posts_run_delete", { runId });

export async function subscribeLinkedInPostsEvents(
  handler: (event: LinkedInPostsEvent) => void,
): Promise<UnlistenFn> {
  return listen<LinkedInPostsEvent>("daemon://linkedin-posts", (e) => {
    handler(e.payload);
  });
}

export function parseSessionIds(run: LinkedInPostsRun): string[] {
  try {
    return JSON.parse(run.session_ids) as string[];
  } catch {
    return [];
  }
}
