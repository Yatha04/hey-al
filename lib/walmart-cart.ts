// Walmart: add one requested item to the cart (a guest cart for now). No checkout here.
// The browser agent makes the choices on the page; code decides success from Walmart's own cart count.
import type { Page } from "playwright-core";
import { runBrowserAgent, type BrowserStep } from "./browser-agent";

const WALMART = "https://www.walmart.com";
const MAX_STEPS = 15;
// The header cart button's label, e.g. "Cart contains 1 item Total Amount $4.76" (checked on walmart.com 2026-10-04).
const CART_BUTTON = '[data-automation-id="cart-button-header"]';

export type WalmartAccess = "signed_in" | "signed_out" | "blocked";

export type AddToCartResult =
  | { status: "added"; summary: string; cartSummary: string; steps: BrowserStep[] }
  | { status: "no_match"; reason: string; steps: BrowserStep[] }
  | { status: "blocked"; steps: BrowserStep[] }
  // The cart count did not go up, whatever the agent said: do not report it as added; check the cart before retrying.
  | { status: "unconfirmed"; detail: string; steps: BrowserStep[] };

export function walmartProfileName(userId: number): string {
  return `walmart-user-${userId}`;
}

// Walmart's bot wall redirects to /blocked ("Robot or human?"), even for a real browser that looks automated.
async function isBlocked(page: Page): Promise<boolean> {
  if (new URL(page.url()).pathname.startsWith("/blocked")) return true;
  return (await page.getByText(/robot or human/i).count()) > 0;
}

export async function checkWalmartAccess(page: Page): Promise<WalmartAccess> {
  // The account page redirects to /account/login when the profile's session has expired.
  await page.goto(`${WALMART}/account`, { waitUntil: "domcontentloaded" });
  if (await isBlocked(page)) return "blocked";
  return new URL(page.url()).pathname.startsWith("/account/login") ? "signed_out" : "signed_in";
}

function isOnWalmart(page: Page): boolean {
  return page.url().startsWith(WALMART);
}

async function readCart(page: Page): Promise<{ label: string; count: number }> {
  const label = (await page.locator(CART_BUTTON).getAttribute("aria-label", { timeout: 10_000 })) ?? "";
  const match = label.match(/cart contains (\d+) items?/i);
  if (!match) throw new Error(`unrecognized Walmart cart label: ${label}`);
  return { label, count: Number(match[1]) };
}

export async function addToCart(page: Page, request: string): Promise<AddToCartResult> {
  // In testing, a search URL as the browser's first page load often hit the bot wall; arriving from the homepage did not.
  // Later items in the same session are already on Walmart and skip this.
  if (!isOnWalmart(page)) {
    await page.goto(WALMART, { waitUntil: "domcontentloaded" });
    if (await isBlocked(page)) return { status: "blocked", steps: [] };
    await page.waitForTimeout(2_000);
  }
  // Starting on the search results saves the agent the steps of finding and using the search box.
  await page.goto(`${WALMART}/search?q=${encodeURIComponent(request)}`, { waitUntil: "domcontentloaded" });
  if (await isBlocked(page)) return { status: "blocked", steps: [] };
  const before = await readCart(page);

  const run = await runBrowserAgent(page, {
    goal:
      `Add one unit of the product that best matches "${request}" to the Walmart cart. ` +
      "Prefer the plain, common version in a typical household size unless the request says otherwise. " +
      "If the product needs options chosen first, choose the most common ones. " +
      "Say done once the page shows the item in the cart. Do not check out.",
    allowedHost: "walmart.com",
    maxSteps: MAX_STEPS,
  });
  if (run.status === "blocked") return { status: "blocked", steps: run.steps };
  if (run.status === "gave_up") return { status: "no_match", reason: run.reason, steps: run.steps };
  if (run.status !== "done") return { status: "unconfirmed", detail: run.status, steps: run.steps };

  // Evidence before success: the agent's "done" counts only if Walmart's cart count went up.
  // Walmart may pop its "Robot or human?" check over the page right after an add; the cart label underneath still
  // reflects the cart, so only a full redirect to /blocked prevents the check.
  if (new URL(page.url()).pathname.startsWith("/blocked")) {
    return { status: "unconfirmed", detail: "blocked after the agent finished", steps: run.steps };
  }
  const after = await readCart(page);
  if (after.count <= before.count) return { status: "unconfirmed", detail: `cart count stayed at ${after.count}`, steps: run.steps };
  return { status: "added", summary: run.summary, cartSummary: after.label, steps: run.steps };
}
