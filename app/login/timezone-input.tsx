"use client";

// The browser knows the tester's time zone; the server does not. Set by the ref after hydration, so server and client HTML match.
export function TimezoneInput() {
  return (
    <input
      type="hidden"
      name="timezone"
      defaultValue="America/Los_Angeles"
      ref={(el) => {
        if (el) el.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }}
    />
  );
}
