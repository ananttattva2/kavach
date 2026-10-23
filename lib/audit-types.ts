import type { ClientData } from "./schema";
export const auditTabs = [
  "Engagement Letter",
  "Client Basic Info",
  "Company Address",
  "Company Documents",
  "CTE & CTO/CCA",
];
export type AuditCheck = {
  fingerprint: string;
  verifiedBy: { id: string; name: string };
  verifiedAt: string;
};
export type AuditRemark = { text: string; by: string; at: string };
export type AuditData = {
  id: string;
  clientId: string;
  ownerId: string;
  year: string;
  revision: number;
  createdAt: string;
  snapshot: ClientData;
  stage: "pre-audit" | "onsite" | "post-audit" | "completed";
  auditor: { id: string; name: string };
  firm: { name: string; address: string };
  facilities: { id: string; name: string }[];
  letter: {
    content: string;
    saved: boolean;
    revision: number;
    pdf?: { fileId: string; fingerprint: string };
  };
  policy: {
    requiredDocuments: string[];
    requiredConsents: ("cte" | "cto")[];
    reason: string;
    by: string;
    at: string;
  };
  checks: Record<string, AuditCheck>;
  remarks: Record<string, AuditRemark>;
  completedAt?: string;
  legacyNotice?: string;
};
export type AuditItem = {
  key: string;
  tab: number;
  title: string;
  fields: Record<string, string>;
  editableFields: string[];
  fingerprint: string;
  missing: string[];
  required: boolean;
  naReason?: string;
  verified: boolean;
  stale: boolean;
  check?: AuditCheck;
  remark?: AuditRemark;
  fileId?: string;
  table?: string;
  recordId?: string;
  facilityId?: string;
  documentType?: string;
};
export type AuditSummary = {
  items: AuditItem[];
  tabs: {
    status: "Pending" | "In Progress" | "Verified" | "Not Applicable";
    required: number;
    verified: number;
  }[];
  required: number;
  verified: number;
  pending: number;
  notApplicable: number;
  percent: number;
  blockers: { key: string; tab: number; title: string; reasons: string[] }[];
  completed: boolean;
};
export type AuditResponse = {
  audit: AuditData;
  summary: AuditSummary;
  history: { id: string; year: string; stage: string }[];
  canVerify: boolean;
  canConfigure: boolean;
  suggestedLetter: string;
};
