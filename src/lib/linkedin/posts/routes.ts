import { toolPath } from "@/lib/tools/registry";

const BASE = toolPath("linkedin", "posts-scrapper");

export const linkedInPostsIndexPath = BASE;
export const linkedInPostsResultsPath = (runId: string) =>
  `${BASE}/results/${runId}`;
export const linkedInPostsPostPath = (runId: string, itemId: string) =>
  `${BASE}/results/${runId}/${itemId}`;
