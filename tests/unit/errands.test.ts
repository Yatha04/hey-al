import { expect, test } from "vitest";
import { registerSpeaker, startErrand, unregisterSpeaker } from "../../mastra/errands";

test("one errand per thread and kind; the result is spoken, a throw speaks onError", async () => {
  const said: string[] = [];
  registerSpeaker("t1", (text) => said.push(text));
  let finish!: (text: string) => void;
  const task = () => new Promise<string>((resolve) => (finish = resolve));

  expect(startErrand("t1", "amazon", task, "err")).toBe("started");
  expect(startErrand("t1", "amazon", task, "err")).toBe("already_running");
  expect(startErrand("t1", "duke", () => Promise.reject(new Error("x")), "duke failed")).toBe("started");

  finish("in the cart");
  await new Promise((r) => setTimeout(r, 0));
  expect(said.sort()).toEqual(["duke failed", "in the cart"]);
  expect(startErrand("t1", "amazon", task, "err")).toBe("started");
  unregisterSpeaker("t1");
});
