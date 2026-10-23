import { createHash } from "node:crypto";
import { z } from "zod";
import { onboardingChoices, tableChoices } from "./onboarding-choices";
import { fieldMap, tables } from "./schema";
import type { AuditData, AuditItem, AuditSummary } from "./audit-types";
export const fingerprint = (value: unknown): string =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
            )
          : v,
      ),
    )
    .digest("hex");
export const hasData = (row: Record<string, string>) =>
  Object.entries(row).some(
    ([k, v]) => !k.startsWith("__") && Boolean(v?.trim()),
  );
export const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
const requiredFields = (fields: Record<string, string>, required: string[]) =>
  required.filter((k) => !fields[k]?.trim()).map((k) => `${k} is required`);
function formatErrors(fields: Record<string, string>) {
  return Object.entries(fields).flatMap(([key, value]) =>
    !value
      ? []
      : /email/i.test(key) && !z.email().safeParse(value).success
        ? [`${key} must be a valid email`]
        : /contact number/i.test(key) && (!/^\+?[\d\s()-]{7,20}$/.test(value) || value.replace(/\D/g, '').length < 7 || value.replace(/\D/g, '').length > 15)
          ? [`${key} must be a valid phone number`]
          : /PIN code/i.test(key) && !/^\d{6}$/.test(value)
            ? [`${key} must contain 6 digits`]
            : /date|Valid up to/i.test(key) && !validDate(value)
              ? [`${key} must be a valid YYYY-MM-DD date`]
              : /Quantity|Turnover|Permitted quantity|capital investment|Production output|Power per hour|working days|Working hours/i.test(key) && (!Number.isFinite(Number(value)) || Number(value) < 0) ? [`${key} must be a non-negative number`] : [],
  );
}
export function defaultLetter(
  a: Pick<AuditData, "snapshot" | "year" | "auditor" | "firm">,
) {
  const c = a.snapshot;
  const address = fieldMap.address
    .slice(0, 6)
    .map((k) => c.address[k])
    .filter(Boolean)
    .join(", ");
  return `${a.firm.name}\n${a.firm.address || "[Auditor Company Address]"}\n\nENGAGEMENT LETTER\nFinancial year / audit period: ${a.year}\n\nTo,\n${c.basic["Client legal name"] || "[Client Name]"}\n${address || "[Address]"}\n\nDear Sir / Madam,\n\nWe confirm our engagement to conduct the pre-audit compliance review of ${c.basic["Client legal name"] || "[Client Name]"} for ${a.year}.\n\nThe review covers company particulars, registrations, submitted documents, facility consents and production details applicable to the agreed scope. Fees and timelines are subject to the separately agreed commercial terms.\n\nAssigned auditor: ${a.auditor.name || "[Assigned Auditor]"}\n\nPlease review the information and confirm your acceptance below.\n\nFor ${a.firm.name}\nAuthorised signatory: __________________\nDate: __________________\n\nAccepted and agreed\nFor ${c.basic["Client legal name"] || "[Client Name]"}\nName / designation: __________________\nSignature / date: __________________`;
}

/** One evaluator supplies the UI, both PDFs and the final transition validator. No client status flags are trusted. */
export function evaluateAudit(
  a: AuditData,
  availableFiles: Set<string>,
  today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
): AuditSummary {
  const c = a.snapshot;
  const items: AuditItem[] = [];
  function add(
    input: Omit<
      AuditItem,
      "fingerprint" | "verified" | "stale" | "check" | "remark"
    >,
    material: unknown = input.fields,
  ) {
    for(const [field,value] of Object.entries(input.fields)){let choices=input.table?tableChoices[field]:input.tab===1?onboardingChoices[field]:undefined;if(field==='PIBO category'&&c.wasteStream==='ewaste')choices=['Producer','Recycler','Manufacturer','Refurbisher'];if(field==='UOM'&&input.table==='capacity')choices=['KG','MT'];if(value&&choices&&!choices.includes(value))input.missing.push(`${field}: select ${choices.join(', ')}`);}
    const fp = fingerprint(material);
    const check = a.checks[input.key];
    items.push({
      ...input,
      fingerprint: fp,
      check,
      remark: a.remarks[input.key],
      verified:
        input.required &&
        input.missing.length === 0 &&
        check?.fingerprint === fp,
      stale: Boolean(check && check.fingerprint !== fp),
    });
  }
  const placeholders = [
    ...a.letter.content.matchAll(/\[[^\]\n]+\]|\{\{[^}\n]+\}\}/g),
  ].map((m) => m[0]);
  const letterMissing = [
    ...(!a.letter.content.includes(a.year)
      ? ["Letter must include this audit financial year"]
      : []),
    ...(c.basic["Client legal name"] &&
    !a.letter.content.includes(c.basic["Client legal name"])
      ? ["Letter must include the current client legal name"]
      : []),
    ...(c.address["Registered address line 1"] &&
    !a.letter.content.includes(c.address["Registered address line 1"])
      ? ["Letter must include the current registered address"]
      : []),
    ...(!a.letter.saved
      ? ["Save the engagement letter before verification"]
      : []),
    ...(!a.letter.content.trim() ? ["Engagement letter is empty"] : []),
    ...placeholders.map((p) => `Resolve placeholder ${p}`),
    ...(!a.auditor.id ? ["Assign an auditor"] : []),
    ...(!c.basic["Client legal name"] ? ["Client legal name is required"] : []),
    ...(!c.address["Registered address line 1"]
      ? ["Registered address is required"]
      : []),
  ];
  add(
    {
      key: "letter",
      tab: 0,
      title: "Engagement Letter",
      fields: { "Financial year": a.year, "Assigned auditor": a.auditor.name },
      editableFields: [],
      missing: letterMissing,
      required: true,
      fileId:
        a.letter.pdf?.fingerprint ===
        fingerprint({
          content: a.letter.content,
          year: a.year,
          firm: a.firm,
          client: c.basic["Client legal name"],
        })
          ? a.letter.pdf.fileId
          : undefined,
    },
    {
      content: a.letter.content,
      year: a.year,
      firm: a.firm,
      auditor: a.auditor,
      client: c.basic["Client legal name"],
      address: c.address,
    },
  );
  const groups = [
    {
      key: "company",
      title: "Company Overview",
      keys: fieldMap.basic.slice(0, 6),
      required: fieldMap.basic.slice(0, 6),
    },
    {
      key: "authorised",
      title: "Authorized Person",
      keys: fieldMap.basic.slice(6, 9),
      required: fieldMap.basic.slice(6, 9),
    },
    {
      key: "coordinator",
      title: "Coordinator",
      keys: fieldMap.basic.slice(9, 12),
      required: fieldMap.basic.slice(9, 12),
    },
  ];
  for (const g of groups) {
    const fields = Object.fromEntries(
      g.keys.map((k) => [
        k,
        k === "Financial year" ? a.year : c.basic[k] || "",
      ]),
    );
    const applicable =
      g.key !== "coordinator" || Object.values(fields).some(Boolean);
    if (g.key === "company") {
      fields["Waste type"] = c.wasteStream;
      fields["Registration category"] = c.registrationCategory;
    }
    const missing = [
      ...requiredFields(fields, g.required),
      ...formatErrors(fields),
    ];
    if (g.key === "company" && !c.basic["Company type"])
      missing.push("Company type is required");
    add({
      key: g.key,
      tab: 1,
      title: g.title,
      fields,
      editableFields: g.keys.filter((k) => k !== "Financial year"),
      missing: applicable ? missing : [],
      required: applicable,
      naReason: !applicable
        ? "Coordinator is optional in the existing onboarding policy and no coordinator was supplied."
        : undefined,
    });
  }
  for (const [index, key] of ["registered", "communication"].entries()) {
    const keys = fieldMap.address.slice(index * 6, index * 6 + 6);
    const source =
      index && c.sameAddress
        ? Object.fromEntries(
            keys.map((k, i) => [k, c.address[fieldMap.address[i]] || ""]),
          )
        : c.address;
    const fields = Object.fromEntries(keys.map((k) => [k, source[k] || ""]));
    const applicable =
      !index || c.sameAddress || Object.values(fields).some(Boolean);
    add({
      key,
      tab: 2,
      title: index ? "Communication Address" : "Registered Address",
      fields,
      editableFields: keys,
      required: applicable,
      naReason: !applicable
        ? "Communication address is optional and none was supplied."
        : undefined,
      missing: applicable
        ? [
            ...requiredFields(
              fields,
              keys.filter((_, i) => [0, 3, 4, 5].includes(i)),
            ),
            ...formatErrors(fields),
          ]
        : [],
    });
  }
  const types = [
    ...new Set([
      ...c.documents.map((d) => d.type),
      ...a.policy.requiredDocuments,
    ]),
  ];
  for (const type of types) {
    const docs = c.documents.filter((d) => d.type === type);
    if (!docs.length) {
      add({
        key: "missing-" + fingerprint(type).slice(0, 24),
        tab: 3,
        title: type,
        documentType: type,
        fields: {},
        editableFields: [],
        required: true,
        missing: [`${type}: required document is missing`],
      });
      continue;
    }
    for (const doc of docs) {
      const id = doc.id!;
      const applicable =
        a.policy.requiredDocuments.includes(type) ||
        Boolean(doc.fileId || doc.number || doc.date);
      const fields = {
        "Document type": type,
        "Certificate number": doc.number,
        "Issue date": doc.date,
        "Expiry date": doc.expiryDate || "",
      };
      const missing = applicable
        ? [
            ...(!doc.number.trim()
              ? ["Certificate / registration number is required"]
              : []),
            ...(!doc.fileId
              ? ["Document file is missing"]
              : !availableFiles.has(doc.fileId)
                ? ["Document file reference is broken or inaccessible"]
                : []),
            ...formatErrors(fields),
            ...(doc.expiryDate &&
            validDate(doc.expiryDate) &&
            doc.expiryDate < today
              ? ["Document has expired"]
              : []),
          ]
        : [];
      add(
        {
          key: "doc-" + id,
          tab: 3,
          title: type,
          documentType: type,
          recordId: id,
          fields,
          editableFields: ["Certificate number", "Issue date", "Expiry date"],
          required: applicable,
          naReason: !applicable
            ? "Optional under the existing onboarding policy; no certificate details or file were supplied."
            : undefined,
          missing,
          fileId: doc.fileId,
        },
        { ...doc, available: availableFiles.has(doc.fileId) },
      );
    }
  }
  for (const [table, config] of Object.entries(tables)) {
    const rows = (c.tables[table] || []).filter(
      (r) => hasData(r) || r.__pending === "true",
    );
    if (table === "cte" || table === "cto") {
      if (
        a.policy.requiredConsents.includes(table) &&
        !rows.length &&
        !a.facilities.length
      )
        add({
          key: "missing-" + table,
          tab: 4,
          title: config.title,
          fields: {},
          editableFields: [],
          required: true,
          missing: [`Required ${config.title} are missing`],
          table,
        });
    }
    for (const row of rows) {
      const consent = table === "cte" || table === "cto";
      const fields = Object.fromEntries(
        [
          ...new Set([
            ...config.fields,
            ...Object.keys(row).filter(
              (k) =>
                !k.startsWith("__") &&
                !k.endsWith(" name") &&
                !["Document", "Certificate"].includes(k),
            ),
          ]),
        ]
          .filter((k) => !["Document", "Certificate"].includes(k))
          .map((k) => [k, row[k] || ""]),
      );
      const fileId = row[table === "msme" ? "Certificate" : "Document"];
      const required = consent
        ? [
            "Plant name",
            "Plant address",
            table === "cte" ? "Consent number" : "Consent order number",
            "Issued date",
            "Valid up to",
          ]
        : table === "msme"
          ? ["Year", "Status", "Major activity", "Udyam number"]
          : config.fields.filter(
              (k) =>
                ![
                  "Document",
                  "Certificate",
                  "Total monthly capacity (kg)",
                ].includes(k),
            );
      const missing = [
        ...requiredFields(fields, required),
        ...formatErrors(fields),
      ];
      if (consent || table === "msme") {
        if (!fileId) missing.push("Attached document is missing");
        else if (!availableFiles.has(fileId))
          missing.push("Attached document is broken or inaccessible");
      }
      if (
        consent &&
        validDate(row["Valid up to"] || "") &&
        row["Valid up to"] < today
      )
        missing.push("Consent has expired");
      if (
        row["Issued date"] &&
        row["Valid up to"] &&
        row["Issued date"] > row["Valid up to"]
      )
        missing.push("Validity date must follow issue date");
      add(
        {
          key: "row-" + row.__rowId,
          tab: table === "msme" ? 3 : 4,
          title: `${config.title} · ${row["Plant name"] || row["Product name"] || row["Udyam number"] || "Record"}`,
          fields,
          editableFields: Object.keys(fields).filter(
            (k) => k !== "Total monthly capacity (kg)",
          ),
          required: true,
          missing,
          fileId,
          recordId: row.__rowId,
          table,
          facilityId: row.__facilityId,
        },
        { row, fileAvailable: fileId ? availableFiles.has(fileId) : null },
      );
    }
  }
  if (!(c.tables.msme || []).some((r) => hasData(r) || r.__pending === "true"))
    add({
      key: "msme-optional",
      tab: 3,
      title: "MSME details",
      fields: {},
      editableFields: [],
      required: false,
      missing: [],
      naReason:
        "MSME is optional in the existing onboarding policy and no MSME record was supplied.",
    });
  for (const facility of a.facilities) {
    for (const type of a.policy.requiredConsents) {
      const matching = (c.tables[type] || []).filter(
        (r) =>
          (hasData(r) || r.__pending === "true") &&
          r.__facilityId === facility.id,
      );
      if (!matching.length)
        add({
          key: "facility-" + facility.id + "-" + type,
          tab: 4,
          title: `${facility.name} · ${type.toUpperCase()} required`,
          fields: { "Facility ID": facility.id },
          editableFields: [],
          required: true,
          missing: [
            `Required ${type.toUpperCase()} consent is missing for this facility`,
          ],
          facilityId: facility.id,
        });
    }
  }
  if (!items.some((i) => i.tab === 4))
    add({
      key: "consents-optional",
      tab: 4,
      title: "Facility consents",
      fields: {},
      editableFields: [],
      missing: [],
      required: false,
      naReason:
        "No consent/production records supplied. These sections are optional in the existing onboarding policy; an administrator may require CTE/CTO for this audit.",
    });
  const required = items.filter((i) => i.required);
  const verified = required.filter((i) => i.verified).length;
  const blockers = required
    .filter((i) => !i.verified)
    .map((i) => ({
      key: i.key,
      tab: i.tab,
      title: i.title,
      reasons: i.missing.length
        ? i.missing
        : [
            i.stale
              ? "Content changed; re-verification required"
              : "Verification pending",
          ],
    }));
  return {
    items,
    tabs: Array.from({ length: 5 }, (_, tab) => {
      const all = items.filter((i) => i.tab === tab && i.required);
      const count = all.filter((i) => i.verified).length;
      return {
        required: all.length,
        verified: count,
        status:
          all.length === 0
            ? "Not Applicable"
            : count === all.length
              ? "Verified"
              : count > 0 || all.some((i) => i.remark || i.check)
                ? "In Progress"
                : "Pending",
      };
    }),
    required: required.length,
    verified,
    pending: required.length - verified,
    notApplicable: items.length - required.length,
    percent: required.length
      ? Math.floor((verified / required.length) * 100)
      : 0,
    blockers,
    completed: required.length > 0 && blockers.length === 0,
  };
}
