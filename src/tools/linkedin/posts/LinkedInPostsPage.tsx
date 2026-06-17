import { Routes, Route } from "react-router-dom";

import { LinkedInPostsShell } from "./LinkedInPostsShell";
import { PostsIndexPage } from "./PostsIndexPage";
import { ResultsPage } from "./ResultsPage";

export function LinkedInPostsPage() {
  return (
    <Routes>
      <Route element={<LinkedInPostsShell />}>
        <Route index element={<PostsIndexPage />} />
        <Route path="results/:runId" element={<ResultsPage />} />
        <Route path="results/:runId/:itemId" element={<ResultsPage />} />
      </Route>
    </Routes>
  );
}
