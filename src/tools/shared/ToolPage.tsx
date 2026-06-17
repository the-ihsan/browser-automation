import { useParams } from "react-router-dom";

import { findTool, type PlatformSlug } from "@/lib/tools/registry";
import { ToolPlaceholderPage } from "@/tools/shared/ToolPlaceholderPage";

export function ToolPage() {
  const { platform, toolSlug } = useParams<{
    platform: PlatformSlug;
    toolSlug: string;
  }>();

  if (!platform || !toolSlug) {
    return null;
  }

  const tool = findTool(platform, toolSlug);
  if (!tool) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Tool not found.
      </div>
    );
  }

  if (!tool.component) {
    return <ToolPlaceholderPage tool={tool} />;
  }

  const ToolComponent = tool.component;
  return <ToolComponent />;
}
