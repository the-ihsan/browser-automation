import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Globe,
  LayoutDashboard,
  MessageCircle,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import { BrowserToolPage } from "@/tools/browser/BrowserToolPage";

export type PlatformSlug = "core" | "linkedin" | "facebook" | "twitter";

export type ToolDefinition = {
  id: string;
  platform: PlatformSlug;
  slug: string;
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Omit for tools that are registered but not implemented yet. */
  component?: ComponentType;
};

export type PlatformDefinition = {
  slug: PlatformSlug;
  name: string;
  icon: LucideIcon;
};

export const platforms: PlatformDefinition[] = [
  { slug: "core", name: "Core", icon: LayoutDashboard },
  { slug: "linkedin", name: "LinkedIn", icon: Briefcase },
  { slug: "facebook", name: "Facebook", icon: Users },
  { slug: "twitter", name: "X (Twitter)", icon: MessageCircle },
];

export const tools: ToolDefinition[] = [
  {
    id: "core-browser",
    platform: "core",
    slug: "browser",
    name: "Browser",
    description: "Launch and control a Playwright browser session",
    path: "/tools/core/browser",
    icon: Globe,
    component: BrowserToolPage,
  },
  {
    id: "linkedin-profile-scraper",
    platform: "linkedin",
    slug: "profile-scraper",
    name: "Profile Scraper",
    description: "Extract public profile data from LinkedIn",
    path: "/tools/linkedin/profile-scraper",
    icon: Briefcase,
  },
  {
    id: "facebook-page-scraper",
    platform: "facebook",
    slug: "page-scraper",
    name: "Page Scraper",
    description: "Scrape public Facebook page content",
    path: "/tools/facebook/page-scraper",
    icon: Users,
  },
  {
    id: "twitter-timeline-scraper",
    platform: "twitter",
    slug: "timeline-scraper",
    name: "Timeline Scraper",
    description: "Collect posts from a public X timeline",
    path: "/tools/twitter/timeline-scraper",
    icon: MessageCircle,
  },
];

export function toolsByPlatform(platform: PlatformSlug): ToolDefinition[] {
  return tools.filter((tool) => tool.platform === platform);
}

export function findTool(
  platform: PlatformSlug,
  slug: string,
): ToolDefinition | undefined {
  return tools.find((tool) => tool.platform === platform && tool.slug === slug);
}

export function toolPath(platform: PlatformSlug, slug: string): string {
  return `/tools/${platform}/${slug}`;
}

export function sessionsPath(platform: PlatformSlug): string {
  return `/platforms/${platform}/sessions`;
}

/** Platforms that support persisted browser sessions (excludes core). */
export const sessionPlatforms: PlatformDefinition[] = platforms.filter(
  (platform) => platform.slug !== "core",
);

export const defaultToolPath = toolPath("core", "browser");
