import { Mastra } from "@mastra/core/mastra";
import { al } from "./agents/al";
import { summarizer } from "./agents/summarizer";
import { storage } from "./memory";

export const mastra = new Mastra({
  agents: { al, summarizer },
  storage,
});
