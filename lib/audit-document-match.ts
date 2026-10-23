import type { ClientData } from "./schema";

type Document = ClientData["documents"][number];
export const isEmptyPendingRow = (row: Record<string, string>) =>
  row.__pending === "true" &&
  !Object.entries(row).some(
    ([key, value]) => !key.startsWith("__") && Boolean(value?.trim()),
  );
export function matchAuditRow(
  source: Record<string, string>[],
  target: Record<string, string>,
  snapshot: Record<string, string>[],
  table: string,
) {
  const stable = source.find((row) => row.__rowId === target.__rowId);
  if (stable) return stable;
  const field =
    table === "msme"
      ? "Udyam number"
      : table === "cte"
        ? "Consent number"
        : table === "cto"
          ? "Consent order number"
          : "";
  if (!field || !target[field]?.trim()) return undefined;
  const identity = (row: Record<string, string>) =>
    (row[field] || "").trim().toUpperCase() +
    (table === "msme" ? "|" + (row.Year || "") : "");
  const candidates = source.filter((row) => identity(row) === identity(target));
  if (
    candidates.length !== 1 ||
    snapshot.filter((row) => identity(row) === identity(target)).length !== 1
  )
    return undefined;
  if (
    snapshot.some(
      (row) =>
        row.__rowId === candidates[0].__rowId && row.__rowId !== target.__rowId,
    )
  )
    return undefined;
  return candidates[0];
}
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
