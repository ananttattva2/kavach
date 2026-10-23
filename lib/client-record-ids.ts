import { ObjectId } from "mongodb";
import type { ClientData } from "./schema";
/** IDs belong to persisted records, never to their display position or plant name. */
export function withStableRecordIds(client: ClientData): ClientData {
  const next = structuredClone(client);
  const used = new Set<string>();
  function id(value?: string) {
    const valid =
      value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) && !used.has(value)
        ? value
        : new ObjectId().toString();
    used.add(valid);
    return valid;
  }
  next.documents = next.documents.map((doc) => ({ ...doc, id: id(doc.id) }));
  next.tables = Object.fromEntries(
    Object.entries(next.tables).map(([key, rows]) => [
      key,
      rows.map((row) => ({ ...row, __rowId: id(row.__rowId) })),
    ]),
  );
  return next;
}
