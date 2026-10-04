import { expect, test } from "vitest";
import { readSession, signSession } from "../../lib/session";

const user = { id: "user-1", name: "Ana", city: "Austin", state: "TX", zip: "", timezone: "America/Chicago" };

test("a signed cookie reads back, an edited or foreign one does not", () => {
  const cookie = signSession(user, "secret");
  expect(readSession(cookie, "secret")).toEqual(user);

  const [, mac] = cookie.split(".");
  const forged = `${Buffer.from(JSON.stringify({ ...user, id: "user-2" })).toString("base64url")}.${mac}`;
  expect(readSession(forged, "secret")).toBeNull();
  expect(readSession(cookie, "other-secret")).toBeNull();
  expect(readSession(undefined, "secret")).toBeNull();
  expect(readSession("garbage", "secret")).toBeNull();
});
