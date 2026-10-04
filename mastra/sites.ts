// Sites Al acts on in a Kernel browser with the user's saved login: where to check the login and how a bot wall shows.
import type { Page } from "playwright-core";
import { BOT_WALL } from "./agents/browser";

type Site = {
  origin: string;
  // Hostname suffix the browser agent must stay on; covers the site's sign-in host.
  host: string;
  // A page that redirects to sign-in when the profile's session has expired.
  accountUrl: string;
  isSignInPage: (url: URL) => boolean;
  // Path prefix of the site's bot-wall page, when it redirects to one.
  blockedPath?: string;
};

export type SiteName = "amazon" | "duke";

export const SITES: Record<SiteName, Site> = {
  amazon: {
    origin: "https://www.amazon.com",
    host: "amazon.com",
    accountUrl: "https://www.amazon.com/gp/css/homepage.html",
    isSignInPage: (url) => url.pathname.startsWith("/ap/"),
    blockedPath: "/errors/validateCaptcha",
  },
  // Sign-in is Auth0 on login.duke-energy.com (checked 2026-10-04).
  duke: {
    origin: "https://www.duke-energy.com",
    host: "duke-energy.com",
    accountUrl: "https://www.duke-energy.com/my-account/dashboard",
    isSignInPage: (url) => url.hostname === "login.duke-energy.com",
  },
};

export type SiteAccess = "signed_in" | "signed_out" | "blocked";

export function isSiteName(name: string): name is SiteName {
  return name in SITES;
}

export function siteProfileName(site: SiteName, userId: string): string {
  return `${site}-user-${userId}`;
}

export async function isBlocked(page: Page, site: SiteName): Promise<boolean> {
  const { blockedPath } = SITES[site];
  if (blockedPath && new URL(page.url()).pathname.startsWith(blockedPath)) return true;
  return (await page.getByText(BOT_WALL).count()) > 0;
}

export async function checkSiteAccess(page: Page, site: SiteName): Promise<SiteAccess> {
  await page.goto(SITES[site].accountUrl, { waitUntil: "domcontentloaded" });
  // Sign-in redirects can be client-side (Duke's Auth0); give them time before reading the URL.
  await page.waitForTimeout(4_000);
  if (await isBlocked(page, site)) return "blocked";
  return SITES[site].isSignInPage(new URL(page.url())) ? "signed_out" : "signed_in";
}
