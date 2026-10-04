import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { REMINDER_KEY, describeTime, readCallReminder, snoozeReminder } from "../reminders";
import { DEMO_USER } from "../users";

// Only in a call started by a reminder (see agents/al.ts); it acts on that one reminder.
export const snoozeReminderTool = createTool({
  id: "snoozeReminder",
  description: "Remind the person again, after a number of minutes, of the reminder that started this call.",
  inputSchema: z.object({
    minutes: z.number().int().min(1).max(1440).describe("How long to wait, e.g. 10."),
  }),
  execute: async ({ minutes }, { requestContext }) => {
    const reminder = readCallReminder(requestContext.get(REMINDER_KEY));
    const moved = reminder && (await snoozeReminder(reminder.id, minutes));
    if (!moved) return { status: "not snoozed", message: "This reminder is no longer active." };
    return { status: "snoozed", when: describeTime(moved.dueAt, DEMO_USER.timezone) };
  },
});
