import type { ClientData } from "./schema";

type Document = ClientData["documents"][number];
const registration = (document: Document) =>
  document.number.trim().toUpperCase();

/** Legacy snapshots generated independent IDs. Never reconcile by array position. */
export function matchAuditDocument(
  source: Document[],
  target: Document,
  snapshot: Document[],
): Document | undefined {
  const stable = source.find(
    (document) => document.id === target.id && document.type === target.type,
  );
  if (stable) return stable;
  if (!registration(target)) return undefined;
  const sameRegistration = (document: Document) =>
    document.type === target.type &&
    registration(document) === registration(target);
  const candidates = source.filter(sameRegistration);
  if (candidates.length !== 1 || snapshot.filter(sameRegistration).length !== 1)
    return undefined;
  // A source ID already assigned to another snapshot record is never borrowed.
  if (
    snapshot.some(
      (document) =>
        document.id === candidates[0].id && document.id !== target.id,
    )
  )
    return undefined;
  return candidates[0];
}
