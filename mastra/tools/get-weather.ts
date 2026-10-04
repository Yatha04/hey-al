import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getWeather } from "../../lib/integrations/open-meteo";
import { currentUser } from "../users";

export const getWeatherTool = createTool({
  id: "getWeather",
  description: "Get the weather where the person lives: current conditions, and today's and tomorrow's forecast in Fahrenheit.",
  inputSchema: z.object({}),
  execute: async (_, { requestContext }) => getWeather(currentUser(requestContext)),
});
