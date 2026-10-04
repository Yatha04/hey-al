import { describe, expect, it } from "vitest";
import { isForbiddenElement } from "../../mastra/agents/browser";

// Inputs are element descriptions as the browser agent builds them: text, aria-label, aria-labelledby text, value,
// name and id, joined by " | ".
describe("isForbiddenElement", () => {
  it.each([
    "Place your order",
    "Place your order | placeYourOrder1", // Amazon's <input>: labelled by another element, named placeYourOrder1
    "placeYourOrder1 | submitOrderButtonId", // the same input when its label is not found
    "Order summary\nItems: $21.78\nPlace your order", // a wrapper around the final button
    "Buy Now",
    "Pay",
    "Pay | pay-button",
    "Pay $42.10",
    "Submit Payment",
    "Buy HD $14.99", // Prime Video 1-Click: charges at once
    "Buy for 1 credit", // Audible
    "Buy now with 1-Click",
    "Try Prime FREE",
    "Start your free trial",
    "Set Up Now", // Subscribe & Save
    "Complete purchase",
    "Submit order",
    "Place\u00a0your order", // &nbsp;
    "Place\nyour order", // a line break inside the label
  ])("blocks %j", (element) => expect(isForbiddenElement(element)).toBe(true));

  it.each([
    "Proceed to checkout | proceedToRetailCheckout",
    "Pay My Bill",
    "Make a payment",
    "Add to cart | submit.addToCart",
    "Payment options",
    "Continue",
    "Replace order history filter",
    "Paypal",
    "One-time purchase",
    "Use this payment method",
    "Buy it again",
  ])("allows %j", (element) => expect(isForbiddenElement(element)).toBe(false));
});
