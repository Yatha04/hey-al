// Amazon: add one requested item to the cart, go to checkout, and read the total and the delivery date.
// Stops on the review page: the browser agent's guard refuses "Place your order", and nothing here clicks it.
import type { Page } from "playwright-core";
import { z } from "zod";
import { readPage, runBrowserAgent, type BrowserStep, type PageReading } from "./agents/browser";
import { checkSiteAccess, isBlocked, SITES } from "./sites";

const AMAZON = SITES.amazon.origin;

const ReviewSchema = z.object({
  product: z.string().describe("the name of the requested product in the order"),
  orderTotal: z.string().describe('the order total, e.g. "$12.34"'),
  deliveryDate: z.string().describe('the delivery date or range, e.g. "Tuesday, October 6"'),
});

export type AmazonOrderResult =
  // On the review page with "Place your order" present and not clicked. The total covers the whole cart, not only this item.
  | { status: "ready_to_place"; review: PageReading<z.infer<typeof ReviewSchema>>; steps: BrowserStep[] }
  | { status: "signed_out" | "blocked"; steps: BrowserStep[] }
  | { status: "no_match"; reason: string; steps: BrowserStep[] }
  // The agent stopped or said done without code-checked evidence: do not report progress; look at the page.
  | { status: "unconfirmed"; detail: string; steps: BrowserStep[] };

// The header cart badge, e.g. "0" (checked 2026-10-04).
async function readCartCount(page: Page): Promise<number> {
  const text = ((await page.locator("#nav-cart-count").textContent({ timeout: 10_000 })) ?? "").trim();
  if (!/^\d+\+?$/.test(text)) throw new Error(`unrecognized Amazon cart count: ${text}`);
  return Number.parseInt(text, 10);
}

// The review page's final button; present means checkout reached the last step.
function placeOrderButton(page: Page) {
  return page.locator('input[name="placeYourOrder1"], #submitOrderButtonId, #placeOrder').or(page.getByRole("button", { name: /place your order/i }));
}

export async function prepareAmazonOrder(page: Page, request: string): Promise<AmazonOrderResult> {
  // Checks the saved login first: a signed-out run must stop before it fills a guest cart.
  const access = await checkSiteAccess(page, "amazon");
  if (access !== "signed_in") return { status: access, steps: [] };

  await page.goto(`${AMAZON}/s?k=${encodeURIComponent(request)}`, { waitUntil: "domcontentloaded" });
  if (await isBlocked(page, "amazon")) return { status: "blocked", steps: [] };
  const before = await readCartCount(page);

  const add = await runBrowserAgent(page, {
    goal:
      `Add one unit of the product that best matches "${request}" to the cart. ` +
      "Prefer the plain, common version in a typical household size unless the request says otherwise. " +
      "If the product needs options chosen first, choose the most common ones. Say done once the page shows the item in the cart.",
    allowedHost: SITES.amazon.host,
    maxSteps: 12,
  });
  const steps = [...add.steps];
  if (add.status === "blocked") return { status: "blocked", steps };
  if (add.status === "gave_up") return { status: "no_match", reason: add.reason, steps };
  if (add.status !== "done") return { status: "unconfirmed", detail: `adding to cart: ${add.status}`, steps };
  const after = await readCartCount(page);
  if (after <= before) return { status: "unconfirmed", detail: `cart count stayed at ${after}`, steps };

  await page.goto(`${AMAZON}/gp/cart/view.html`, { waitUntil: "domcontentloaded" });
  const checkout = await runBrowserAgent(page, {
    goal:
      "Go to checkout and reach the final review page, the one that shows the order total, the delivery date, " +
      'and a "Place your order" button. Keep the saved address, payment method and delivery option. ' +
      'Say done on that page. Do not click "Place your order".',
    allowedHost: SITES.amazon.host,
    maxSteps: 10,
  });
  steps.push(...checkout.steps);
  if (checkout.status === "blocked") return { status: "blocked", steps };
  if (checkout.status === "gave_up") return { status: "unconfirmed", detail: `checkout: ${checkout.reason}`, steps };
  if (checkout.status !== "done") return { status: "unconfirmed", detail: `checkout: ${checkout.status}`, steps };
  if ((await placeOrderButton(page).count()) === 0) return { status: "unconfirmed", detail: "no Place your order button on the page", steps };

  const review = await readPage(page, "the product name, the order total, and the delivery date", ReviewSchema);
  return { status: "ready_to_place", review, steps };
}
