import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createReminder, describeTime } from "../reminders";
import { currentUser } from "../users";

export const createReminderTool = createTool({
  id: "createReminder",
  description:
    "Schedule a one-time reminder. At that time the voice page calls the person and Al says it. " +
    "Returns saved, or a clarification to ask the person about.",
  inputSchema: z.object({
    text: z.string().trim().min(1).max(200).describe('What to do, starting with a verb, e.g. "call Sarah" or "take the evening pills".'),
    localTime: z
      .string()
      // A date alone would become midnight: the model must ask for the time instead of guessing.
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the local date and time, like 2026-10-05T09:00. Ask for the time if it is missing.")
      .describe('The local date and time, e.g. "2026-10-05T09:00".'),
  }),
  execute: async ({ text, localTime }, { requestContext }) => {
    const user = currentUser(requestContext);
    const result = await createReminder(user, text, localTime);
    if (result.status === "clarify") return { status: "clarification needed", message: `${result.message} Ask the person, then call createReminder again.` };
    return { status: "saved", text: result.reminder.text, when: describeTime(result.reminder.dueAt, user.timezone) };
  },
});
