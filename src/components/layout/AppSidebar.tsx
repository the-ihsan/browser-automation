import { Link, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  platforms,
  sessionPlatforms,
  sessionsPath,
  toolsByPlatform,
  type PlatformSlug,
} from "@/lib/tools/registry";

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" />}
              isActive={location.pathname === "/"}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-sm font-semibold">PT</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Playwright Tools</span>
                <span className="truncate text-xs text-muted-foreground">
                  Browser automation
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {platforms.map((platform) => {
          const platformSlug = platform.slug as PlatformSlug;
          const platformTools = toolsByPlatform(platformSlug);
          const hasSessions = sessionPlatforms.some(
            (item) => item.slug === platformSlug,
          );

          if (platformTools.length === 0 && !hasSessions) return null;

          const PlatformIcon = platform.icon;
          const sessionsRoute = sessionsPath(platformSlug);

          return (
            <SidebarGroup key={platform.slug}>
              <SidebarGroupLabel className="gap-2">
                <PlatformIcon className="size-4" />
                {platform.name}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {hasSessions && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link to={sessionsRoute} />}
                        isActive={location.pathname === sessionsRoute}
                        tooltip="Sessions"
                      >
                        <KeyRound />
                        <span>Sessions</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {platformTools.map((tool) => (
                    <SidebarMenuItem key={tool.id}>
                      <SidebarMenuButton
                        render={<Link to={tool.path} />}
                        isActive={
                          location.pathname === tool.path ||
                          location.pathname.startsWith(`${tool.path}/`)
                        }
                        tooltip={tool.name}
                      >
                        <tool.icon />
                        <span>{tool.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
