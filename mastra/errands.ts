// Errands: browser flows that take minutes, too long to hold a voice turn. A tool starts one and returns at once;
// when it ends, its sentence is spoken into the call that asked for it (or logged, e.g. in Studio or after hang-up).
// Its own module so tools and the voice worker can both import it without a cycle.

const speakers = new Map<string, (text: string) => void>();
const running = new Set<string>();

// The voice worker registers each live call by thread id, and removes it when the call ends.
export function registerSpeaker(thread: string, say: (text: string) => void): void {
  speakers.set(thread, say);
}

export function unregisterSpeaker(thread: string): void {
  speakers.delete(thread);
}

function speak(thread: string, text: string): void {
  const say = speakers.get(thread);
  if (!say) return console.log(`errand result (no live call for ${thread}): ${text}`);
  try {
    say(text);
  } catch (e) {
    // The session can close between the lookup and the call.
    console.error("errand speak failed", { thread, error: e instanceof Error ? e.message : typeof e });
  }
}

// One errand per thread and kind at a time: a retry, or a preemptive turn the session then discards, must not
// add the item to the cart twice. The task returns the sentence to speak; a throw speaks onError.
export function startErrand(thread: string, kind: string, task: () => Promise<string>, onError: string): "started" | "already_running" {
  const key = `${thread}:${kind}`;
  if (running.has(key)) return "already_running";
  running.add(key);
  void task()
    .catch((e) => {
      console.error(`errand ${kind} failed`, e instanceof Error ? e.message : e);
      return onError;
    })
    .then((text) => speak(thread, text))
    .finally(() => running.delete(key));
  return "started";
}
