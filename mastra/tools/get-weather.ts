import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getWeather } from "../../lib/integrations/open-meteo";
import { DEMO_USER } from "../users";

export const getWeatherTool = createTool({
  id: "getWeather",
  description: "Get the weather where the person lives: current conditions, and today's and tomorrow's forecast in Fahrenheit.",
  inputSchema: z.object({}),
  // ponytail: the seeded demo user's city, like al.ts; pass the signed-in user once onboarding exists.
  execute: async () => getWeather(DEMO_USER),
});
