// One-time setup: a person signs into a site in a Kernel browser; the login is saved to the user's profile.
// Usage: npm run site:login -- amazon|duke
import { createInterface } from "node:readline/promises";
import { ensureProfile, openBrowser } from "../lib/integrations/kernel";
import { checkSiteAccess, isSiteName, SITES, siteProfileName } from "../mastra/sites";
import { DEMO_USER } from "../mastra/users";

const site = process.argv[2] ?? "";
if (!isSiteName(site)) throw new Error(`usage: site:login <${Object.keys(SITES).join("|")}>`);
const profileName = siteProfileName(site, DEMO_USER.id);

await ensureProfile(profileName);
// Long idle timeout: the person may take a while to sign in and enter a verification code.
const session = await openBrowser({ profileName, saveProfile: true, idleTimeoutSeconds: 900 });
try {
  await session.page.goto(SITES[site].accountUrl);
  console.log(`Profile ${profileName}, session ${session.sessionId}`);
  console.log(`Open the live view and sign in (check "Keep me signed in"):\n${session.liveViewUrl}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("Press Enter once signed in... ");
  rl.close();

  const access = await checkSiteAccess(session.page, site);
  console.log(`${site} access: ${access}`);
  if (access !== "signed_in") process.exitCode = 1;
} finally {
  // Deleting the session saves the profile.
  await session.close();
}
