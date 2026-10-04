// Duke Energy: open the current bill. Nothing here goes near payment.
// "View Bill" on the account dashboard opens the bill as a PDF in a new tab (checked 2026-10-04).
import type { Page } from "playwright-core";
import { checkSiteAccess } from "./sites";

export type DukeBillResult =
  // The bill PDF is open in its own tab, which is now the front tab in the live view.
  | { status: "bill_open"; billPage: Page }
  | { status: "signed_out" | "blocked" }
  | { status: "no_bill_button" };

export async function openDukeBill(page: Page): Promise<DukeBillResult> {
  // Lands on the account dashboard when signed in; an expired session lands on the Auth0 sign-in page.
  const access = await checkSiteAccess(page, "duke");
  if (access !== "signed_in") return { status: access };

  const viewBill = page.getByRole("button", { name: /view bill/i });
  if ((await viewBill.count()) === 0) return { status: "no_bill_button" };
  const [billPage] = await Promise.all([page.context().waitForEvent("page", { timeout: 30_000 }), viewBill.first().click()]);
  await billPage.waitForLoadState("domcontentloaded");
  await billPage.bringToFront();
  return { status: "bill_open", billPage };
}
