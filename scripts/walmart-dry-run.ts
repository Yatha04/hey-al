// Dry run: add items to a Walmart guest cart with the browser agent (no checkout), one after another in one browser.
// Usage: npm run walmart:dry-run -- "whole milk" "eggs"
// The browser stays on afterwards so the cart can be inspected in the live view.
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright-core";
import { openBrowser } from "../lib/integrations/kernel";
import { addToCart, walmartProfileName } from "../lib/walmart-cart";

const items = process.argv.length > 2 ? process.argv.slice(2) : ["whole milk"];
// ponytail: the demo user, as in agent/worker.ts.
const DEMO_USER_ID = 1;
// Kernel keeps the browser while the live view is open, and this long after the last viewer leaves.
const IDLE_TIMEOUT_SECONDS = 600;

// A screenshot of where it stopped is the fastest way to see what went wrong. tmp/ is gitignored: it may show account details.
async function saveScreenshot(page: Page): Promise<void> {
  try {
    await mkdir("tmp", { recursive: true });
    await page.screenshot({ path: "tmp/walmart-dry-run.png" });
    console.error(`Stopped at ${page.url()}; screenshot in tmp/walmart-dry-run.png`);
  } catch (e) {
    console.error("screenshot failed", e instanceof Error ? e.message : e);
  }
}

const session = await openBrowser({
  profileName: walmartProfileName(DEMO_USER_ID),
  saveProfile: false,
  idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
});
try {
  console.log(`Session ${session.sessionId}. Watch: ${session.liveViewUrl}`);
  for (const item of items) {
    console.log(`\n== ${item}`);
    const { steps, ...result } = await addToCart(session.page, item);
    steps.forEach((s, i) =>
      console.log(`${i + 1}. ${s.action}${s.ref ? ` ${s.ref}` : ""}${s.element ? ` "${s.element}"` : ""} → ${s.outcome || "-"} (${s.inputTokens ?? "?"} input tokens)`),
    );
    const totalTokens = steps.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0);
    console.log(`${steps.length} LLM calls, ${totalTokens} input tokens`);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "added") continue;
    await saveScreenshot(session.page);
    process.exitCode = 1;
    // A bot wall or an uncertain cart state would make the next item's result meaningless.
    if (result.status === "blocked" || result.status === "unconfirmed") break;
  }
} catch (e) {
  await saveScreenshot(session.page);
  throw e;
} finally {
  await session.detach();
  console.log(`\nBrowser left on: ${session.liveViewUrl}`);
  console.log(`It shuts down ${IDLE_TIMEOUT_SECONDS / 60} minutes after the live view is closed.`);
}
