import { ObjectId, Binary, type Document } from "mongodb";
import { z } from "zod";
import { withStableRecordIds } from "./client-record-ids";
import { db } from "./db";
import { clientSchema, documentTypes, type ClientData } from "./schema";
import { isAdministrator } from "./roles";
import { LicenseError, type SignedInSession } from "./license";
import {
  defaultLetter,
  evaluateAudit,
  fingerprint,
  hasData,
} from "./audit-rules";
import { onboardingChoices, tableChoices } from "./onboarding-choices";
import type { AuditData, AuditResponse } from "./audit-types";
import { auditPdf } from "./audit-pdf";
export const auditDocumentTypes = [
  ...documentTypes,
  "E-waste Registration",
  "EEE Import Authorization",
];
const verificationKey=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const safeId = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const yearSchema = z
  .string()
  .regex(/^20\d{2}-\d{2}$/)
  .refine(
    (y) => Number(y.slice(5)) === (Number(y.slice(0, 4)) + 1) % 100,
    "Use a consecutive financial year, e.g. 2026-27",
  );
const identity = (session: SignedInSession) => ({
  id: session.user.id,
  name: session.user.name || session.user.email,
});
const verifier = (session: SignedInSession) =>
  isAdministrator(session.user.role) || session.user.role === "manager";
type StoredAudit = Omit<AuditData, "id"> & { _id: ObjectId };
const audits = () => db().collection<StoredAudit>("client_audits");
export async function ownedClient(id: string, session: SignedInSession) {
  if (!ObjectId.isValid(id))
    throw new LicenseError(404, "Client not found", "NOT_FOUND");
  const c = await db()
    .collection("clients")
    .findOne({ _id: new ObjectId(id), ownerId: session.user.id });
  if (!c) throw new LicenseError(404, "Client not found", "NOT_FOUND");
  return c;
}
const publicAudit = (a: StoredAudit): AuditData => {
  const { _id, ...data } = a;
  return {
    ...data,
    facilities: data.facilities || facilityList(data.snapshot),
    id: String(_id),
  };
};
function normalizeSnapshot(
  raw: Document,
  clientId: string,
  year: string,
): ClientData {
  const snapshot = clientSchema.parse({
    ...raw,
    id: clientId,
    basic: { ...raw.basic, "Financial year": year },
  });
  const seen = new Set<string>();
  snapshot.documents = snapshot.documents.map((doc) => {
    let id = doc.id || new ObjectId().toString();
    if (seen.has(id)) id = new ObjectId().toString();
    seen.add(id);
    return { ...doc, id };
  });
  for (const [key, rows] of Object.entries(snapshot.tables)) {
    snapshot.tables[key] = rows.map((row) => {
      let id = row.__rowId;
      if (!id || !safeId.safeParse(id).success || seen.has(id))
        id = new ObjectId().toString();
      seen.add(id);
      return {
        ...row,
        __rowId: id,
        ...(key === "cte" || key === "cto"
          ? {
              __facilityId: safeId.safeParse(row.__facilityId).success
                ? row.__facilityId
                : fingerprint(clientId + "-facility-" + id).slice(0, 24),
            }
          : {}),
      };
    });
  }
  return snapshot;
}
function facilityList(
  snapshot: ClientData,
  existing: AuditData["facilities"] = [],
) {
  const result = [...existing];
  for (const row of [
    ...(snapshot.tables.cte || []),
    ...(snapshot.tables.cto || []),
  ].filter(hasData)) {
    if (row.__facilityId && !result.some((f) => f.id === row.__facilityId))
      result.push({
        id: row.__facilityId,
        name: row["Plant name"] || "Unnamed facility",
      });
  }
  while (result.length < snapshot.plantCount)
    result.push({
      id: fingerprint(snapshot.id + "-facility-slot-" + result.length).slice(
        0,
        24,
      ),
      name: "Facility " + (result.length + 1),
    });
  return result;
}
async function stableSource(clientId: string, session: SignedInSession) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const source = await ownedClient(clientId, session);
    const stable = withStableRecordIds(
      clientSchema.parse({ ...source, id: clientId }),
    );
    if (
      JSON.stringify(source.documents) === JSON.stringify(stable.documents) &&
      JSON.stringify(source.tables) === JSON.stringify(stable.tables)
    )
      return source;
    const saved = await db()
      .collection("clients")
      .findOneAndUpdate(
        {
          _id: source._id,
          ownerId: session.user.id,
          documents: source.documents,
          tables: source.tables,
        },
        { $set: { documents: stable.documents, tables: stable.tables } },
        { returnDocument: "after" },
      );
    if (saved) return saved;
  }
  throw new LicenseError(
    409,
    "Client information changed during ID migration. Retry.",
    "REVISION_CONFLICT",
  );
}
export async function createAudit(
  clientId: string,
  year: string,
  session: SignedInSession,
) {
  yearSchema.parse(year);
  const client = await stableSource(clientId, session);
  await audits().createIndex(
    { ownerId: 1, clientId: 1, year: 1 },
    { unique: true },
  );
  const now = new Date().toISOString();
  const data: StoredAudit = {
    _id: new ObjectId(),
    clientId,
    ownerId: session.user.id,
    year,
    revision: 0,
    createdAt: now,
    snapshot: normalizeSnapshot(client, clientId, year),
    stage: "pre-audit",
    facilities: [],
    auditor: verifier(session) ? identity(session) : { id: "", name: "" },
    firm: { name: "ANANTTATTVA PRIVATE LIMITED", address: "" },
    letter: { content: "", saved: false, revision: 0 },
    policy: {
      requiredDocuments: [],
      requiredConsents: [],
      reason:
        "Existing onboarding policy: document and consent sections are optional unless supplied or explicitly required for this audit.",
      by: "Existing onboarding policy",
      at: now,
    },
    checks: {},
    remarks: {},
    ...(client.validationDetails ||
    client.verificationProgress ||
    client.verificationRemarks
      ? {
          legacyNotice:
            "Legacy positional checks and remarks were not migrated. Ambiguous records require re-verification. A legacy letter is imported as an unverified draft only for its explicitly matching financial year.",
        }
      : {}),
  };
  data.facilities = facilityList(data.snapshot);
  data.letter.content =
    client.basic?.["Financial year"] === year &&
    typeof client.validationDetails?.engagementLetterContent === "string"
      ? client.validationDetails.engagementLetterContent
      : defaultLetter(data);
  try {
    await audits().updateOne(
      { ownerId: session.user.id, clientId, year },
      { $setOnInsert: data },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const stored = await audits().findOne({
    ownerId: session.user.id,
    clientId,
    year,
  });
  return response(publicAudit(stored!), session);
}
export async function getAudit(
  clientId: string,
  id: string | undefined,
  session: SignedInSession,
) {
  await ownedClient(clientId, session);
  const history = await audits()
    .find({ ownerId: session.user.id, clientId })
    .sort({ year: -1 })
    .toArray();
  const selected = id ? history.find((a) => String(a._id) === id) : history[0];
  if (!selected) {
    if (id)
      throw new LicenseError(
        404,
        "Audit not found for this client",
        "NOT_FOUND",
      );
    return { history: [], audit: null };
  }
  return response(publicAudit(selected), session);
}
async function fileSet(a: AuditData) {
  const ids = [
    ...a.snapshot.documents.map((d) => d.fileId),
    ...Object.values(a.snapshot.tables).flatMap((rows) =>
      rows.map((r) => r.Document || r.Certificate),
    ),
    a.letter.pdf?.fileId,
  ].filter((id): id is string => Boolean(id) && ObjectId.isValid(id!));
  const records = await db()
    .collection("files")
    .find(
      {
        _id: { $in: ids.map((id) => new ObjectId(id)) },
        ownerId: a.ownerId,
        data: { $exists: true },
        $or: [{ auditId: { $exists: false } }, { auditId: a.id }],
      },
      { projection: { _id: 1 } },
    )
    .toArray();
  return new Set(records.map((f) => String(f._id)));
}
export async function response(
  a: AuditData,
  session: SignedInSession,
): Promise<AuditResponse> {
  const [files, history] = await Promise.all([
    fileSet(a),
    audits()
      .find(
        { ownerId: a.ownerId, clientId: a.clientId },
        { projection: { year: 1, stage: 1 } },
      )
      .sort({ year: -1 })
      .toArray(),
  ]);
  const summary = evaluateAudit(a, files);
  if (a.stage !== "pre-audit" && !summary.completed)
    a = { ...a, stage: "pre-audit", completedAt: undefined };
  return {
    audit: a,
    summary,
    history: history.map((h) => ({
      id: String(h._id),
      year: h.year,
      stage: h.stage,
    })),
    canVerify:
      verifier(session) &&
      (isAdministrator(session.user.role) || a.auditor.id === session.user.id),
    canConfigure: isAdministrator(session.user.role),
    suggestedLetter: defaultLetter(a),
  };
}

const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify"),
    key: verificationKey,
    fingerprint: z.string().length(64),
  }),
  z.object({
    action: z.literal("remark"),
    key: verificationKey,
    text: z
      .string()
      .max(2000)
      .refine(
        (t) => !t.length || Boolean(t.trim()),
        "Remark cannot contain only whitespace",
      ),
  }),
  z.object({
    action: z.literal("letter"),
    content: z.string().trim().min(1).max(100000),
  }),
  z.object({
    action: z.literal("edit"),
    key: verificationKey,
    values: z.record(z.string(), z.string().max(5000)),
    sameAddress: z.boolean().optional(),
    facilityId: safeId.optional(),
  }),
  z.object({
    action: z.literal("replace-file"),
    key: verificationKey,
    fileId: z.string().regex(/^[a-f\d]{24}$/),
  }),
  z.object({ action: z.literal("remove-record"), key: safeId }),
  z.object({
    action: z.literal("add-record"),
    table: z
      .enum([
        "msme",
        "cte",
        "cto",
        "cteProducts",
        "ctoProducts",
        "capacity",
        "additional",
        "regulations",
      ])
      .optional(),
    documentType: z.string().optional(),
    facilityId: safeId.optional(),
  }),
  z.object({
    action: z.literal("policy"),
    requiredDocuments: z.array(z.string()).max(20),
    requiredConsents: z.array(z.enum(["cte", "cto"])).max(2),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("assign"),
    auditorId: z.string().regex(/^[a-f\d]{24}$/),
    firmName: z.string().trim().min(2).max(200),
    firmAddress: z.string().trim().max(1000),
  }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("pdf"), kind: z.enum(["letter", "report"]) }),
]);
export async function mutateAudit(
  clientId: string,
  id: string,
  revision: number,
  raw: unknown,
  session: SignedInSession,
) {
  if (!Number.isInteger(revision) || revision < 0)
    throw new LicenseError(
      400,
      "A valid revision is required",
      "INVALID_INPUT",
    );
  const current = await getAudit(clientId, id, session);
  if (!("summary" in current))
    throw new LicenseError(404, "Audit not found", "NOT_FOUND");
  const { audit: a, summary } = current;
  if (a.revision !== revision)
    throw new LicenseError(
      409,
      "This audit changed in another request. Reload the latest record and retry.",
      "REVISION_CONFLICT",
    );
  if (!current.canVerify)
    throw new LicenseError(
      403,
      "Only an administrator or the assigned manager may change verification records.",
      "FORBIDDEN",
    );
  const op = command.parse(raw);
  const now = new Date().toISOString();
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const item =
    "key" in op ? summary.items.find((i) => i.key === op.key) : undefined;
  if ("key" in op && !item)
    throw new LicenseError(
      400,
      "Unknown or deleted verification item",
      "INVALID_ITEM",
    );
  if (op.action === "verify") {
    if (!item!.required)
      throw new LicenseError(
        400,
        "Not Applicable items cannot be verified",
        "INVALID_ITEM",
      );
    if (item!.missing.length)
      throw new LicenseError(422, item!.missing.join("; "), "MISSING_DATA");
    if (item!.fingerprint !== op.fingerprint)
      throw new LicenseError(
        409,
        "Content changed. Reload before verifying.",
        "CONTENT_CHANGED",
      );
    set["checks." + item!.key] = {
      fingerprint: item!.fingerprint,
      verifiedBy: identity(session),
      verifiedAt: now,
    };
  }
  if (op.action === "remark")
    set["remarks." + item!.key] = {
      text: op.text.trim(),
      by: session.user.name || session.user.email,
      at: now,
    };
  if (op.action === "letter")
    set.letter = {
      content: op.content,
      saved: true,
      revision: a.letter.revision + 1,
    };
  if (op.action === "edit") {
    if (Object.keys(op.values).some((k) => !item!.editableFields.includes(k)))
      throw new LicenseError(400, "Unexpected field in edit", "INVALID_INPUT");
    const values = op.values;
    for (const [field, value] of Object.entries(values)) {
      const choices = item!.table
        ? tableChoices[field]
        : onboardingChoices[field];
      const allowed =
        field === "PIBO category" && a.snapshot.wasteStream === "ewaste"
          ? ["Producer", "Recycler", "Manufacturer", "Refurbisher"]
          : choices;
      if (value && allowed && !allowed.includes(value))
        throw new LicenseError(
          422,
          `${field}: choose ${allowed.join(", ")}`,
          "INVALID_INPUT",
        );
    }
    const snapshot = structuredClone(a.snapshot);
    if (item!.tab === 1) Object.assign(snapshot.basic, values);
    else if (item!.key === "registered" || item!.key === "communication") {
      Object.assign(snapshot.address, values);
      if (op.sameAddress !== undefined) snapshot.sameAddress = op.sameAddress;
    } else if (item!.documentType && item!.recordId) {
      const doc = snapshot.documents.find((d) => d.id === item!.recordId)!;
      if ("Certificate number" in values)
        doc.number = values["Certificate number"];
      if ("Issue date" in values) doc.date = values["Issue date"];
      if ("Expiry date" in values) doc.expiryDate = values["Expiry date"];
    } else if (item!.table) {
      const row = snapshot.tables[item!.table].find(
        (r) => r.__rowId === item!.recordId,
      )!;
      Object.assign(row, values);
      if (item!.table === "capacity") {
        const amount =
          Number(row["Production output in one hour"]) *
          Number(row["Machine working days"]) *
          Number(row["Working hours per day"]) *
          (row.UOM === "MT" ? 1000 : 1);
        row["Total monthly capacity (kg)"] =
          Number.isFinite(amount) && amount > 0
            ? String(Math.round(amount * 100) / 100)
            : "";
      }
      if (row["Ground / bore well water usage"] === "No")
        row["CGWA NOC requirement"] = "Not Applicable";
    }
    if (snapshot.sameAddress) {
      const registered = [
        "line 1",
        "line 2",
        "area / landmark",
        "state",
        "city",
        "PIN code",
      ];
      for (const part of registered) {
        const suffix = part.startsWith("line") ? "address " + part : part;
        snapshot.address["Communication " + suffix] =
          snapshot.address["Registered " + suffix] || "";
      }
    }
    if (op.facilityId) {
      if (
        !a.facilities.some((f) => f.id === op.facilityId) ||
        !item!.table ||
        !["cte", "cto"].includes(item!.table)
      )
        throw new LicenseError(
          422,
          "Choose a facility belonging to this audit",
          "INVALID_FACILITY",
        );
      snapshot.tables[item!.table].find(
        (r) => r.__rowId === item!.recordId,
      )!.__facilityId = op.facilityId;
    }
    set.snapshot = clientSchema.parse(snapshot);
  }
  if (op.action === "replace-file") {
    const file = await db()
      .collection("files")
      .findOne({
        _id: new ObjectId(op.fileId),
        ownerId: a.ownerId,
        $or: [{ auditId: { $exists: false } }, { auditId: a.id }],
      });
    if (!file)
      throw new LicenseError(
        422,
        "Uploaded file is missing or inaccessible",
        "MISSING_FILE",
      );
    const snapshot = structuredClone(a.snapshot);
    if (item!.documentType && item!.recordId) {
      const doc = snapshot.documents.find((d) => d.id === item!.recordId)!;
      doc.fileId = op.fileId;
      doc.fileName = file.name;
    } else if (item!.table) {
      const row = snapshot.tables[item!.table].find(
        (r) => r.__rowId === item!.recordId,
      )!;
      const field = item!.table === "msme" ? "Certificate" : "Document";
      row[field] = op.fileId;
      row[field + " name"] = file.name;
    } else
      throw new LicenseError(
        400,
        "This item does not accept uploads",
        "INVALID_ITEM",
      );
    set.snapshot = snapshot;
  }
  if (op.action === "remove-record") {
    const snapshot = structuredClone(a.snapshot);
    if (item!.documentType && item!.recordId)
      snapshot.documents = snapshot.documents.filter(
        (d) => d.id !== item!.recordId,
      );
    else if (item!.table && item!.recordId)
      snapshot.tables[item!.table] = snapshot.tables[item!.table].filter(
        (r) => r.__rowId !== item!.recordId,
      );
    else
      throw new LicenseError(
        400,
        "This required group cannot be deleted",
        "INVALID_ITEM",
      );
    set.snapshot = snapshot;
    unset["checks." + item!.key] = "";
    unset["remarks." + item!.key] = "";
  }
  if (op.action === "add-record") {
    const snapshot = structuredClone(a.snapshot);
    if (op.table) {
      const row: Record<string, string> = {
        __rowId: new ObjectId().toString(),
        __pending: "true",
      };
      if (op.table === "cte" || op.table === "cto") {
        const known = a.facilities.some((f) => f.id === op.facilityId);
        if (op.facilityId && !known)
          throw new LicenseError(400, "Unknown facility ID", "INVALID_ITEM");
        row.__facilityId = op.facilityId || new ObjectId().toString();
        if (!op.facilityId)
          set.facilities = [
            ...a.facilities,
            { id: row.__facilityId, name: "New facility" },
          ];
      }
      snapshot.tables[op.table] = [...(snapshot.tables[op.table] || []), row];
    } else if (
      op.documentType &&
      auditDocumentTypes.includes(op.documentType)
    ) {
      snapshot.documents.push({
        id: new ObjectId().toString(),
        type: op.documentType,
        number: "",
        date: "",
        fileId: "",
        fileName: "",
      });
    } else
      throw new LicenseError(
        400,
        "Choose an allowed document or record type",
        "INVALID_INPUT",
      );
    set.snapshot = snapshot;
  }
  if (op.action === "policy") {
    if (!current.canConfigure)
      throw new LicenseError(403, "Administrator access required", "FORBIDDEN");
    if (op.requiredDocuments.some((t) => !auditDocumentTypes.includes(t)))
      throw new LicenseError(400, "Unknown document type", "INVALID_INPUT");
    set.policy = {
      requiredDocuments: [...new Set(op.requiredDocuments)],
      requiredConsents: [...new Set(op.requiredConsents)],
      reason: op.reason,
      by: session.user.name || session.user.email,
      at: now,
    };
  }
  if (op.action === "assign") {
    if (!current.canConfigure)
      throw new LicenseError(403, "Administrator access required", "FORBIDDEN");
    const user = await db()
      .collection("user")
      .findOne({
        _id: new ObjectId(op.auditorId),
        role: { $in: ["admin", "super_admin", "manager"] },
        banned: { $ne: true },
      });
    if (!user)
      throw new LicenseError(
        422,
        "Choose an active administrator or manager",
        "INVALID_INPUT",
      );
    set.auditor = { id: String(user._id), name: user.name || user.email };
    set.firm = { name: op.firmName, address: op.firmAddress };
    if (!a.letter.saved)
      set.letter = {
        ...a.letter,
        content: defaultLetter({
          ...a,
          auditor: set.auditor as AuditData["auditor"],
          firm: set.firm as AuditData["firm"],
        }),
      };
  }
  if (op.action === "sync") {
    const client = await stableSource(clientId, session);
    set.snapshot = normalizeSnapshot(client, clientId, a.year);
    set.facilities = facilityList(set.snapshot as ClientData, a.facilities);
  }
  if (op.action === "complete") {
    if (a.stage !== "pre-audit")
      throw new LicenseError(
        409,
        "Pre-audit has already been completed.",
        "ALREADY_COMPLETED",
      );
    if (!summary.completed)
      throw new LicenseError(
        422,
        summary.blockers
          .map((b) => `${b.title}: ${b.reasons.join(", ")}`)
          .join("\n"),
        "INCOMPLETE",
      );
    set.stage = "onsite";
    set.completedAt = now;
  }
  if (op.action === "pdf") {
    if (op.kind === "letter" && !a.letter.saved)
      throw new LicenseError(
        422,
        "Save the engagement letter before generating its PDF",
        "UNSAVED_LETTER",
      );
    const contentHash =
      op.kind === "letter"
        ? fingerprint({
            content: a.letter.content,
            year: a.year,
            firm: a.firm,
            client: a.snapshot.basic["Client legal name"],
          })
        : fingerprint({ summary, snapshot: a.snapshot, policy: a.policy });
    const fileId = new ObjectId(
      fingerprint({ auditId: a.id, kind: op.kind, contentHash }).slice(0, 24),
    );
    const bytes = await auditPdf(
      a,
      summary,
      op.kind,
      session.user.name || session.user.email,
    );
    await db()
      .collection("files")
      .updateOne(
        { _id: fileId },
        {
          $setOnInsert: {
            ownerId: a.ownerId,
            clientId: a.clientId,
            auditId: a.id,
            financialYear: a.year,
            kind: op.kind,
            contentHash,
            name: `${op.kind === "letter" ? "Engagement-Letter" : "Pre-Audit-Validation"}-${a.year}.pdf`,
            type: "application/pdf",
            data: new Binary(bytes),
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    if (op.kind === "letter")
      set["letter.pdf"] = { fileId: String(fileId), fingerprint: contentHash };
    const saved = await audits().findOneAndUpdate(
      { _id: new ObjectId(id), ownerId: session.user.id, revision },
      { $set: set, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
    if (!saved)
      throw new LicenseError(
        409,
        "Audit changed during PDF generation. Reload and regenerate.",
        "REVISION_CONFLICT",
      );
    return {
      ...(await response(publicAudit(saved), session)),
      download: { fileId: String(fileId) },
    };
  }
  // Reopen only when material changes invalidate completion. No-op saves retain the workflow.
  if (!["verify", "remark", "complete"].includes(op.action)) {
    const candidate = { ...a, ...set } as AuditData;
    if (!evaluateAudit(candidate, await fileSet(candidate)).completed) {
      set.stage = "pre-audit";
      unset.completedAt = "";
    }
  }
  const updated = await audits().findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: session.user.id, revision },
    {
      $set: set,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated)
    throw new LicenseError(
      409,
      "A concurrent update was saved. Reload and retry; your saved data was not overwritten.",
      "REVISION_CONFLICT",
    );
  return response(publicAudit(updated), session);
}
