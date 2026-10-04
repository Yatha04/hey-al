import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { REMINDER_KEY, acknowledgeReminder, readCallReminder } from "../reminders";

// Only in a call started by a reminder (see agents/al.ts); it acts on that one reminder.
export const acknowledgeReminderTool = createTool({
  id: "acknowledgeReminder",
  description: "Record that the person said they heard or did the reminder that started this call.",
  inputSchema: z.object({}),
  execute: async (_, { requestContext }) => {
    const reminder = readCallReminder(requestContext.get(REMINDER_KEY));
    if (!reminder || !(await acknowledgeReminder(reminder.id))) return { status: "not recorded", message: "This reminder is no longer active." };
    return { status: "acknowledged" };
  },
});
