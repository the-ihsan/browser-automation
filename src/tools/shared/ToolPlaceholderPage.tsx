import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { ToolDefinition } from "@/lib/tools/registry";

type ToolPlaceholderPageProps = {
  tool: ToolDefinition;
};

export function ToolPlaceholderPage({ tool }: ToolPlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tool.name}</h1>
        <p className="text-sm text-muted-foreground">{tool.description}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
        <tool.icon className="size-10 text-muted-foreground" />
        <div className="max-w-md space-y-2">
          <p className="font-medium">Coming soon</p>
          <p className="text-sm text-muted-foreground">
            This automation tool is registered but not implemented yet. Add a
            page under <code className="text-xs">src/tools/{tool.platform}/</code>{" "}
            and wire it in the tool registry.
          </p>
        </div>
        <Button render={<Link to="/tools/core/browser" />}>Open Browser</Button>
      </div>
    </div>
  );
}
