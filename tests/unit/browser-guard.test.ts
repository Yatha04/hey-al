import { describe, expect, it } from "vitest";
import { FORBIDDEN_ELEMENT } from "../../mastra/agents/browser";

// Inputs are what the guard sees: an element's aria snapshot, or its aria-label, value, name and id joined.
describe("FORBIDDEN_ELEMENT", () => {
  it.each([
    '- button "Place your order"',
    " Place your order placeYourOrder1 ", // Amazon's <input>: no text content, name in the value attribute
    '- generic:\n  - button "Place your order"', // a wrapper around the final button
    '- button "Buy Now"',
    '- button "Pay"',
    '- button "Pay $42.10"',
    '- button "Submit Payment"',
  ])("blocks %j", (element) => expect(FORBIDDEN_ELEMENT.test(element)).toBe(true));

  it.each([
    '- button "Proceed to checkout"',
    '- link "Pay My Bill"',
    '- link "Make a payment"',
    '- button "Add to cart"',
    '- link "Payment options"',
    '- button "Continue"',
  ])("allows %j", (element) => expect(FORBIDDEN_ELEMENT.test(element)).toBe(false));
});
