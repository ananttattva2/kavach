"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { AuditResponse } from "@/lib/audit-types";
import type { ClientData } from "@/lib/schema";
import "./document-recovery.css";

type Document = ClientData["documents"][number];

export function useDocumentRecovery(data: ClientData, tab: number) {
  const params = useSearchParams();
  const auditId = params.get("auditId") || "";
  const target = params.get("documentId") || "";
  const active = params.get("step") === "documents";
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
  function issues(doc: Document) {
    if (!active || wrongYear) return [];
    const item = audit.data?.summary.items.find(
      (entry) => entry.documentType && entry.recordId === doc.id,
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
    if (!active || tab !== 2 || (auditId && audit.isPending)) return;
    function focusTarget() {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-document-id]"),
      ).find((element) => element.dataset.documentId === target);
      if (!row) return false;
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
  }, [active, tab, target, auditId, audit.isPending]);
  return { active, target, issues, audit, wrongYear };
}
