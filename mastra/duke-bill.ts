// Duke Energy: read the current bill's amount and due date, then open the payment page and stop before paying.
// The browser agent's guard refuses the final "Pay" or "Submit payment" click, and nothing here clicks it.
import type { Page } from "playwright-core";
import { z } from "zod";
import { readPage, runBrowserAgent, type BrowserStep, type PageReading } from "./agents/browser";
import { checkSiteAccess, SITES } from "./sites";

const BillSchema = z.object({
  amountDue: z.string().describe('the current amount due, e.g. "$84.12"'),
  dueDate: z.string().describe('the due date of that amount, e.g. "October 21, 2026"'),
});

const PaymentSchema = z.object({
  paymentAmount: z.string().describe("the amount the payment page is set to pay"),
});

export type DukeBillResult =
  // Values come with their own evidence status; the payment page is open and nothing was submitted.
  | { status: "ready_to_pay"; bill: PageReading<z.infer<typeof BillSchema>>; payment: PageReading<z.infer<typeof PaymentSchema>>; steps: BrowserStep[] }
  | { status: "signed_out" | "blocked"; steps: BrowserStep[] }
  // The dashboard says "No payment due" (also shown for a closed account): there is nothing to pay.
  | { status: "nothing_due"; steps: BrowserStep[] }
  // The agent stopped without reaching the page: do not report the bill; look at the page.
  | { status: "unconfirmed"; detail: string; steps: BrowserStep[] };

export async function prepareDukePayment(page: Page): Promise<DukeBillResult> {
  // Lands on the account dashboard when signed in; an expired session lands on the Auth0 sign-in page.
  const access = await checkSiteAccess(page, "duke");
  if (access !== "signed_in") return { status: access, steps: [] };

  // The dashboard's Summary card shows the amount due. "View Bill" opens the bill as a PDF in a new tab, which the
  // browser agent cannot see, so the amount and due date are read from the dashboard (checked 2026-10-04).
  if ((await page.getByText(/no payment due/i).count()) > 0) return { status: "nothing_due", steps: [] };
  const bill = await readPage(page, "the current amount due and its due date", BillSchema);

  const toPayment = await runBrowserAgent(page, {
    goal:
      "Open the page to pay this bill with the saved payment method, and fill nothing in unless the page needs " +
      "the amount, which is the full amount due. Say done on the last page before the final pay or submit button. " +
      "Do not click that button.",
    allowedHost: SITES.duke.host,
    maxSteps: 10,
  });
  const steps = toPayment.steps;
  if (toPayment.status === "blocked") return { status: "blocked", steps };
  if (toPayment.status === "gave_up") return { status: "unconfirmed", detail: `opening the payment page: ${toPayment.reason}`, steps };
  if (toPayment.status !== "done") return { status: "unconfirmed", detail: `opening the payment page: ${toPayment.status}`, steps };
  const payment = await readPage(page, "the amount this payment page will pay", PaymentSchema);
  return { status: "ready_to_pay", bill, payment, steps };
}
