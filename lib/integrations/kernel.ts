// Kernel cloud browsers: start one (optionally with a saved login profile) and drive it with Playwright over CDP.
// The browser only ever loads the target site; LLM calls and keys stay in this process.
import Kernel, { NotFoundError } from "@onkernel/sdk";
import { chromium, type Page } from "playwright-core";

export type BrowserSession = {
  sessionId: string;
  // Watch or take over the browser (a family member signing in, solving a check). Treat as a secret: it grants control.
  liveViewUrl: string | undefined;
  page: Page;
  close: () => Promise<void>;
  // Disconnects Playwright but leaves the browser running; Kernel ends it after idleTimeoutSeconds with no live view open.
  detach: () => Promise<void>;
};

export type OpenBrowserOptions = {
  profileName: string;
  // true only for the human sign-in session; automated runs must not overwrite a good login with a bad state.
  saveProfile: boolean;
  // Kernel ends the browser after this many seconds without a CDP or live view connection.
  idleTimeoutSeconds: number;
};

// Created per call: the constructor throws without KERNEL_API_KEY, which must not break importing this module.
function createKernel(): Kernel {
  return new Kernel({ timeout: 30_000, maxRetries: 1 });
}

export async function ensureProfile(name: string): Promise<void> {
  const kernel = createKernel();
  try {
    await kernel.profiles.retrieve(name);
  } catch (e) {
    if (!(e instanceof NotFoundError)) throw e;
    await kernel.profiles.create({ name });
  }
}

export async function openBrowser({ profileName, saveProfile, idleTimeoutSeconds }: OpenBrowserOptions): Promise<BrowserSession> {
  const kernel = createKernel();
  // stealth turns on Kernel's residential proxy and CAPTCHA solver; shopping sites block plain automation outright.
  const created = await kernel.browsers.create({
    stealth: true,
    profile: { name: profileName, save_changes: saveProfile },
    timeout_seconds: idleTimeoutSeconds,
  });
  const sessionId = created.session_id;

  const deleteBrowser = async () => {
    try {
      await kernel.browsers.deleteByID(sessionId);
    } catch (e) {
      // Not rethrown: close() runs in finally blocks and must not mask the task's own error.
      // Kernel still reclaims the browser after idleTimeoutSeconds.
      console.error("kernel deleteByID failed", { sessionId, error: e instanceof Error ? e.message : typeof e });
    }
  };

  try {
    const browser = await chromium.connectOverCDP(created.cdp_ws_url, { timeout: 30_000 });
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(45_000);
    return {
      sessionId,
      liveViewUrl: created.browser_live_view_url,
      page,
      close: async () => {
        // Disconnects Playwright; deleting the session ends the browser and, with saveProfile, saves the profile.
        try {
          await browser.close();
        } finally {
          await deleteBrowser();
        }
      },
      detach: () => browser.close(),
    };
  } catch (e) {
    await deleteBrowser();
    throw e;
  }
}
