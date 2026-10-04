// Dry run of the Kernel flows, each in its own browser, at the same time when both are asked for. Nothing is ordered or paid:
// Amazon stops on the checkout review page, and Duke only opens the bill.
// Usage: npm run flows -- amazon "AA batteries" | duke | both "AA batteries"
// The browsers stay on afterwards so the final pages can be inspected in the live view.
import { mkdir } from "node:fs/promises";
import { openBrowser, type BrowserSession } from "../lib/integrations/kernel";
import type { BrowserStep } from "../mastra/agents/browser";
import { prepareAmazonOrder } from "../mastra/amazon-order";
import { openDukeBill } from "../mastra/duke-bill";
import { siteProfileName, type SiteName } from "../mastra/sites";
import { DEMO_USER } from "../mastra/users";

const [which, request] = process.argv.slice(2);
const runAmazon = which === "amazon" || which === "both";
const runDuke = which === "duke" || which === "both";
if ((!runAmazon && !runDuke) || (runAmazon && !request)) throw new Error('usage: flows -- amazon "<item>" | duke | both "<item>"');
// Kernel keeps a browser while its live view is open, and this long after the last viewer leaves.
const IDLE_TIMEOUT_SECONDS = 600;

function printSteps(site: SiteName, steps: BrowserStep[]): void {
  steps.forEach((s, i) => console.log(`[${site}] ${i + 1}. ${s.action}${s.element ? ` "${s.element}"` : ""} → ${s.outcome || "-"}`));
  console.log(`[${site}] ${steps.length} LLM steps, ${steps.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0)} input tokens`);
}

async function run(site: SiteName, flow: (session: BrowserSession) => Promise<{ status: string; steps?: BrowserStep[] }>) {
  // The saved login is only read: an automated run must not overwrite it.
  const session = await openBrowser({ profileName: siteProfileName(site, DEMO_USER.id), saveProfile: false, idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS });
  console.log(`[${site}] watch: ${session.liveViewUrl}`);
  try {
    const { steps, ...result } = await flow(session);
    if (steps) printSteps(site, steps);
    console.log(`[${site}] result:`, JSON.stringify(result, null, 2));
    return result.status;
  } catch (e) {
    console.error(`[${site}] failed:`, e instanceof Error ? e.message : e);
    return "error";
  } finally {
    // tmp/ is gitignored: the screenshot shows account details.
    await mkdir("tmp", { recursive: true });
    await session.page.screenshot({ path: `tmp/flow-${site}.png` }).catch(() => {});
    await session.detach();
  }
}

const statuses = await Promise.all([
  runAmazon ? run("amazon", (s) => prepareAmazonOrder(s.page, request)) : null,
  runDuke
    ? run("duke", async (s) => {
        const result = await openDukeBill(s.page);
        return result.status === "bill_open" ? { status: result.status, billUrl: result.billPage.url() } : result;
      })
    : null,
]);
console.log("\nstatuses:", statuses.filter(Boolean).join(", "));
if (statuses.some((s) => s && s !== "ready_to_place" && s !== "needs_payment" && s !== "bill_open")) process.exitCode = 1;
