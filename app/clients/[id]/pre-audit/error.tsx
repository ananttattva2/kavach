"use client";
export default function AuditError({ reset }: { reset: () => void }) {
  return (
    <main className="validation-loading">
      <h2>Could not load the audit workspace</h2>
      <p role="alert">
        The server could not load your client information. Please retry.
      </p>
      <button className="button primary" onClick={reset}>
        Retry
      </button>
      <a href="/dashboard?view=clients">Back to clients</a>
    </main>
  );
}
