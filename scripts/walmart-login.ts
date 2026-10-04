// One-time setup: a person signs into Walmart in a Kernel browser; the login is saved to the user's profile.
// Usage: npm run walmart:login [userId]
import { createInterface } from "node:readline/promises";
import { ensureProfile, openBrowser } from "../lib/integrations/kernel";
import { checkWalmartAccess, walmartProfileName } from "../lib/walmart-cart";

const userId = Number(process.argv[2] ?? 1);
const profileName = walmartProfileName(userId);

await ensureProfile(profileName);
// Long idle timeout: the person may take a while to sign in and enter a verification code.
const session = await openBrowser({ profileName, saveProfile: true, idleTimeoutSeconds: 900 });
try {
  await session.page.goto("https://www.walmart.com/account/login");
  console.log(`Profile ${profileName}, session ${session.sessionId}`);
  console.log(`Open the live view and sign in (check "Keep me signed in"):\n${session.liveViewUrl}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Press Enter once signed in... ");
  rl.close();

  const access = await checkWalmartAccess(session.page);
  console.log(`Walmart access: ${access}`);
  if (access !== "signed_in") process.exitCode = 1;
} finally {
  await session.close();
}
