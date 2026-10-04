"use client";

import { useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useVoiceAssistant } from "@livekit/components-react";

type ConnectionDetails = { serverUrl: string; participantToken: string };

const LABELS: Record<string, string> = {
  connecting: "Connecting…",
  initializing: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

function Bubble() {
  const { state } = useVoiceAssistant();
  return (
    <>
      <div className="bubble" data-state={state} aria-hidden />
      <p className="text-2xl" aria-live="polite">{LABELS[state] ?? ""}</p>
    </>
  );
}

export default function Home() {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const res = await fetch("/api/connection-details", { method: "POST" });
    if (!res.ok) {
      setError("Al is not available right now.");
      return;
    }
    setDetails(await res.json());
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      {details ? (
        <LiveKitRoom
          serverUrl={details.serverUrl}
          token={details.participantToken}
          connect
          audio
          video={false}
          onDisconnected={() => setDetails(null)}
          className="flex flex-col items-center gap-10"
        >
          <Bubble />
          <RoomAudioRenderer />
          <StartAudio label="Tap to hear Al" className="big-button" />
          <button className="big-button" onClick={() => setDetails(null)}>
            End
          </button>
        </LiveKitRoom>
      ) : (
        <>
          <div className="bubble" data-state="idle" aria-hidden />
          <button className="big-button" onClick={start}>
            Talk to Al
          </button>
          {error && <p className="text-xl" role="alert">{error}</p>}
        </>
      )}
    </main>
  );
}
