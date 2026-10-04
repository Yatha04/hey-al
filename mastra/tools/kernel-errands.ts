// Al's tools for the Kernel browser flows. Each starts the flow as an errand and returns at once;
// the result is spoken into the call when the flow ends. Nothing is ordered or paid.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openBrowser, type BrowserSession } from "../../lib/integrations/kernel";
import { prepareAmazonOrder } from "../amazon-order";
import { openDukeBill } from "../duke-bill";
import { startErrand } from "../errands";
import { siteProfileName, type SiteName } from "../sites";
import { DEMO_USER } from "../users";

// Kernel keeps the browser this long after the flow, so the final page can be checked in the live view.
const IDLE_TIMEOUT_SECONDS = 600;

// ponytail: the seeded demo user's saved logins, like get-weather.ts; pass the signed-in user once onboarding exists.
async function inBrowser(site: SiteName, flow: (session: BrowserSession) => Promise<string>): Promise<string> {
  // The saved login is only read: an automated run must not overwrite it.
  const session = await openBrowser({ profileName: siteProfileName(site, DEMO_USER.id), saveProfile: false, idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS });
  console.log(`[${site}] errand live view: ${session.liveViewUrl}`);
  try {
    return await flow(session);
  } finally {
    await session.detach();
  }
}

const SIGNED_OUT = (site: string) => `I could not get into your ${site} account. Someone needs to sign in to it again for me.`;
const BLOCKED = (site: string) => `${site} stopped me with a robot check, so I could not finish. Please try again later.`;

async function amazonErrand(item: string): Promise<string> {
  return inBrowser("amazon", async ({ page }) => {
    const result = await prepareAmazonOrder(page, item);
    console.log("[amazon] errand result:", result.status, "detail" in result ? result.detail : "");
    switch (result.status) {
      case "ready_to_place": {
        const { product, orderTotal, deliveryDate } = result.review.values;
        // A total or date not found on the page is not said aloud.
        if (result.review.status !== "read") return `I put ${item} in your Amazon cart, but I could not read the total. I did not place the order.`;
        return `I put ${product} in your Amazon cart. The order total is ${orderTotal}, arriving ${deliveryDate}. I did not place the order.`;
      }
      case "signed_out":
        return SIGNED_OUT("Amazon");
      case "blocked":
        return BLOCKED("Amazon");
      case "needs_payment":
        return `I put ${item} in your Amazon cart. To place the order, a payment method needs to be added to the Amazon account first.`;
      case "no_match":
        return `I could not find ${item} on Amazon.`;
      case "unconfirmed":
        return `I tried to add ${item} to your Amazon cart, but I could not confirm it worked. Please check the cart.`;
    }
  });
}

async function dukeErrand(): Promise<string> {
  return inBrowser("duke", async ({ page }) => {
    const result = await openDukeBill(page);
    console.log("[duke] errand result:", result.status);
    switch (result.status) {
      case "bill_open":
        return "I opened your latest Duke Energy bill.";
      case "signed_out":
        return SIGNED_OUT("Duke Energy");
      case "blocked":
        return BLOCKED("Duke Energy");
      case "no_bill_button":
        return "I got into your Duke Energy account, but I could not find a bill to open.";
    }
  });
}

// The voice worker sets the thread to the call's room; Studio uses its own thread.
function threadOf(context: { agent?: { threadId?: string } }): string {
  return context.agent?.threadId ?? "no-thread";
}

export const addToAmazonCartTool = createTool({
  id: "addToAmazonCart",
  description:
    "Start adding one item to the person's Amazon cart and going to checkout to read the total and delivery date. " +
    "Never places the order. Takes a few minutes; the result is spoken when it is done. Call only after the person confirms the item.",
  inputSchema: z.object({ item: z.string().describe('what to buy, as the person said it, e.g. "AA batteries"') }),
  execute: async ({ item }, context) => ({
    status: startErrand(threadOf(context), "amazon", () => amazonErrand(item), `Something went wrong adding ${item} to your Amazon cart.`),
  }),
});

export const openDukeBillTool = createTool({
  id: "openDukeBill",
  description: "Start opening the person's latest Duke Energy bill. Never pays. Takes about a minute; the result is spoken when it is done.",
  inputSchema: z.object({}),
  execute: async (_input, context) => ({
    status: startErrand(threadOf(context), "duke", dukeErrand, "Something went wrong opening your Duke Energy bill."),
  }),
});
