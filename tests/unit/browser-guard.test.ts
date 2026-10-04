import { describe, expect, it } from "vitest";
import { FORBIDDEN_ELEMENT } from "../../mastra/agents/browser";

// Inputs are element descriptions as the browser agent builds them: text, aria-label, aria-labelledby text, value,
// name and id, joined by " | ".
describe("FORBIDDEN_ELEMENT", () => {
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
  ])("blocks %j", (element) => expect(FORBIDDEN_ELEMENT.test(element)).toBe(true));

  it.each([
    "Proceed to checkout | proceedToRetailCheckout",
    "Pay My Bill",
    "Make a payment",
    "Add to cart | submit.addToCart",
    "Payment options",
    "Continue",
    "Replace order history filter",
    "Paypal",
  ])("allows %j", (element) => expect(FORBIDDEN_ELEMENT.test(element)).toBe(false));
});
