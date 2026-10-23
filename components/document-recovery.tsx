"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { AuditResponse } from "@/lib/audit-types";
import type { ClientData } from "@/lib/schema";
import {
  matchAuditDocument,
  matchAuditRow,
  isEmptyPendingRow,
} from "@/lib/audit-document-match";
import "./document-recovery.css";

type Document = ClientData["documents"][number];

export function useDocumentRecovery(data: ClientData, tab: number) {
  const params = useSearchParams();
  const auditId = params.get("auditId") || "";
  const target = params.get("documentId") || "";
  const active = ["documents", "consents"].includes(params.get("step") || "");
  const table = params.get("table") || "";
  const recordId = params.get("recordId") || "";
  const audit = useQuery<AuditResponse>({
    queryKey: ["document-recovery", data.id, auditId],
    enabled: active && Boolean(data.id && auditId),
    queryFn: async () => {
      const response = await fetch(
        `/api/clients/${encodeURIComponent(data.id!)}/audits?auditId=${encodeURIComponent(auditId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Could not load pending document checks",
        );
      return result;
    },
  });
  const wrongYear = Boolean(
    audit.data && audit.data.audit.year !== data.basic["Financial year"],
  );
  const snapshot = audit.data?.audit.snapshot.documents || [];
  const legacyTarget = snapshot.find((document) => document.id === target);
  const sourceTarget = legacyTarget
    ? matchAuditDocument(data.documents, legacyTarget, snapshot)?.id || target
    : target;
  const snapshotRows = audit.data?.audit.snapshot.tables[table] || [];
  const legacyRow = snapshotRows.find((row) => row.__rowId === recordId);
  const savedRows =
    table === "msme" &&
    legacyRow &&
    isEmptyPendingRow(legacyRow) &&
    !audit.data?.audit.checks["row-" + recordId] &&
    !audit.data?.audit.remarks["row-" + recordId]
      ? snapshotRows
          .filter((row) => !isEmptyPendingRow(row))
          .map((row) =>
            matchAuditRow(data.tables[table] || [], row, snapshotRows, table),
          )
          .filter((row) => Boolean(row))
      : [];
  const sourceRowId =
    savedRows.length === 1
      ? savedRows[0]!.__rowId
      : legacyRow
        ? matchAuditRow(
            data.tables[table] || [],
            legacyRow,
            snapshotRows,
            table,
          )?.__rowId || recordId
        : recordId;
  function tableRecovery(key: string) {
    if (!active || wrongYear || key !== table) return undefined;
    return {
      target: sourceRowId,
      issues(row: Record<string, string>) {
        const errors: Record<string, string> = {};
        const auditRow = snapshotRows.find(
          (record) =>
            matchAuditRow(data.tables[key] || [], record, snapshotRows, key)
              ?.__rowId === row.__rowId,
        );
        const item = audit.data?.summary.items.find(
          (entry) =>
            entry.table === key && entry.recordId === auditRow?.__rowId,
        );
        for (const reason of item?.missing || []) {
          if (reason.endsWith(" is required")) {
            const field = reason.slice(0, -" is required".length);
            if (!row[field]?.trim()) errors[field] = reason;
          }
        }
        const attachment = key === "msme" ? "Certificate" : "Document";
        if (["msme", "cte", "cto"].includes(key) && !row[attachment])
          errors[attachment] = "Attached document is missing";
        if (
          item?.fileId &&
          row[attachment] === item.fileId &&
          item.missing.some((reason) =>
            reason.includes("broken or inaccessible"),
          )
        )
          errors[attachment] = "Attached document is inaccessible";
        if (
          row["Valid up to"] &&
          row["Valid up to"] <
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
            }).format(new Date())
        )
          errors["Valid up to"] = "Consent has expired";
        return errors;
      },
    };
  }
  function issues(doc: Document) {
    if (!active || wrongYear) return [];
    const item = audit.data?.summary.items.find(
      (entry) =>
        entry.documentType &&
        (entry.recordId === doc.id ||
          snapshot.some(
            (record) =>
              record.id === entry.recordId &&
              matchAuditDocument(data.documents, record, snapshot)?.id ===
                doc.id,
          )),
    );
    if (!(item?.required || doc.number || doc.date || doc.fileId)) return [];
    const missing: string[] = [];
    if (!doc.number.trim()) missing.push("Certificate number is missing");
    if (!doc.fileId) missing.push("Document file is missing");
    if (
      item?.fileId === doc.fileId &&
      item?.missing.some((reason) => reason.includes("broken or inaccessible"))
    )
      missing.push("Saved file is inaccessible; replace it");
    if (
      doc.date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(doc.date) ||
        Number.isNaN(Date.parse(doc.date)))
    )
      missing.push("Issue date is invalid");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());
    if (doc.expiryDate && doc.expiryDate < today)
      missing.push("Document has expired");
    return missing;
  }
  useEffect(() => {
    if (
      !active ||
      tab !== (table && table !== "msme" ? 3 : 2) ||
      (auditId && audit.isPending)
    )
      return;
    function focusTarget() {
      const row = table
        ? Array.from(
            document.querySelectorAll<HTMLElement>("[data-recovery-record]"),
          ).find(
            (element) =>
              element.dataset.recoveryRecord === sourceRowId &&
              element.dataset.recoveryTable === table,
          )
        : Array.from(
            document.querySelectorAll<HTMLElement>("[data-document-id]"),
          ).find((element) => element.dataset.documentId === sourceTarget);
      if (!row) {
        const section = table
          ? Array.from(
              document.querySelectorAll<HTMLElement>(
                ".registration-table-section[data-recovery-table]",
              ),
            ).find((element) => element.dataset.recoveryTable === table)
          : undefined;
        if (!section) return false;
        section.scrollIntoView({ block: "center", behavior: "instant" });
        section.focus({ preventScroll: true });
        return true;
      }
      row.scrollIntoView({ block: "center", behavior: "instant" });
      row.focus({ preventScroll: true });
      return true;
    }
    if (focusTarget()) return;
    const observer = new MutationObserver(() => {
      if (focusTarget()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, tab, sourceTarget, sourceRowId, table, auditId, audit.isPending]);
  return {
    active,
    target: sourceTarget,
    issues,
    audit,
    wrongYear,
    tableRecovery,
  };
}
