"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  History,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "./ui/button";
import {
  auditTabs,
  type AuditData,
  type AuditItem,
  type AuditResponse,
} from "@/lib/audit-types";
import { documentTypes, tables, type ClientData } from "@/lib/schema";
import { onboardingChoices, tableChoices } from "@/lib/onboarding-choices";
import "./pre-audit-workspace.css";
const documentChoices = [
  ...documentTypes,
  "E-waste Registration",
  "EEE Import Authorization",
];
type Operation = Record<string, unknown>;
type Model = AuditResponse & { download?: { fileId: string } };
const dateTime = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Request failed") as Error & {
      status: number;
    };
    error.status = res.status;
    throw error;
  }
  return data;
}

export function PreAuditWorkspace({
  client,
  onComplete,
  embedded = false,
  onDirtyChange,
}: {
  client: ClientData;
  onComplete?: (audit: AuditData) => void;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const Root = embedded ? "div" : "main";
  const reducedMotion = useReducedMotion();
  const verifyDialog = useRef<HTMLDialogElement>(null);
  const [verifyItem, setVerifyItem] = useState<AuditItem | null>(null);
  const initialYear = client.basic["Financial year"];
  const clientId = client.id!;
  const endpoint = "/api/clients/" + clientId + "/audits";
  const [model, setModel] = useState<Model | null>(null),
    [tab, setTab] = useState(0),
    [stage, setStage] = useState("pre-audit"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string[]>([]),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState("");
  const current = useRef<Model | null>(null),
    generation = useRef(0),
    locks = useRef(new Set<string>());
  const [letterDraft, setLetterDraft] = useState(""),
    [letterEditing, setLetterEditing] = useState(false);
  const [remarkItem, setRemarkItem] = useState<AuditItem | null>(null),
    [remarkText, setRemarkText] = useState("");
  const remarkDialog = useRef<HTMLDialogElement>(null);
  const [editItem, setEditItem] = useState<AuditItem | null>(null),
    [editValues, setEditValues] = useState<Record<string, string>>({}),
    [sameAddress, setSameAddress] = useState(false),
    [editFacility, setEditFacility] = useState("");
  const editDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null),
    newAuditDialog = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]),
    [peopleError, setPeopleError] = useState(""),
    [auditorId, setAuditorId] = useState(""),
    [firmName, setFirmName] = useState(""),
    [firmAddress, setFirmAddress] = useState("");
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]),
    [requiredConsents, setRequiredConsents] = useState<string[]>([]),
    [policyReason, setPolicyReason] = useState("");
  const [newYear, setNewYear] = useState(""),
    [newType, setNewType] = useState("GST Certificate"),
    [newTable, setNewTable] = useState("cte"),
    [facility, setFacility] = useState("");
  const dirty =
    letterEditing && letterDraft !== (model?.audit.letter.content || "");
  function install(next: Model) {
    const previous = current.current;
    current.current = next;
    setModel(next);
    if (
      next.audit.stage === "pre-audit" &&
      previous?.audit.stage !== "pre-audit"
    )
      setStage("pre-audit");
  }
  const load = useCallback(
    async (auditId?: string) => {
      const epoch = ++generation.current;
      setLoading(true);
      setLoadError("");
      setModel(null);
      current.current = null;
      setErrors({});
      setNotice("");
      setTab(0);
      setLetterEditing(false);
      setFacility("");
      setEditItem(null);
      setRemarkItem(null);
      locks.current.clear();
      setBusy([]);
      try {
        let next = await request(
          endpoint + (auditId ? "?auditId=" + encodeURIComponent(auditId) : ""),
        );
        if (!next.audit)
          next = await request(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year: initialYear }),
          });
        if (epoch !== generation.current) return;
        current.current = next;
        setModel(next);
        setLetterDraft(next.audit.letter.content);
        setStage(
          next.audit.stage === "pre-audit" ? "pre-audit" : next.audit.stage,
        );
        const url = new URL(window.location.href);
        url.searchParams.set("auditId", next.audit.id);
        if (window.location.href !== url.href)
          window.history.replaceState(window.history.state, "", url.href);
      } catch (error) {
        if (epoch === generation.current)
          setLoadError((error as Error).message);
      } finally {
        if (epoch === generation.current) setLoading(false);
      }
    },
    [endpoint, initialYear],
  );
  useEffect(() => {
    load(
      new URLSearchParams(window.location.search).get("auditId") || undefined,
    );
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty || busy.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy.length]);
  function mayNavigate() {
    if (busy.length) return false;
    if (
      dirty &&
      !window.confirm("Discard the unsaved engagement letter edits?")
    )
      return false;
    setLetterEditing(false);
    if (current.current) setLetterDraft(current.current.audit.letter.content);
    return true;
  }
  async function run(command: Operation, key: string): Promise<Model | null> {
    const start = current.current;
    if (!start || locks.current.has(key)) return null;
    const epoch = generation.current;
    locks.current.add(key);
    setBusy([...locks.current]);
    setErrors((e) => ({ ...e, [key]: "" }));
    setNotice("");
    try {
      const next = await request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...command,
          auditId: start.audit.id,
          revision: start.audit.revision,
        }),
      });
      if (epoch !== generation.current) return null;
      install(next);
      if (next.download) {
        const link = document.createElement("a");
        link.href = "/api/files?id=" + next.download.fileId;
        link.download = "";
        link.click();
        setNotice("PDF saved to this audit and downloaded.");
      }
      return next;
    } catch (error) {
      if (epoch !== generation.current) return null;
      setErrors((e) => ({ ...e, [key]: (error as Error).message }));
      if ((error as Error & { status?: number }).status === 409) {
        try {
          const latest = await request(endpoint + "?auditId=" + start.audit.id);
          if (epoch === generation.current) install(latest);
        } catch {
          setErrors((e) => ({
            ...e,
            [key]:
              "Concurrent update detected. Could not reload. Your typed edits are preserved; retry when the connection is available.",
          }));
        }
      }
      return null;
    } finally {
      if (epoch === generation.current) {
        locks.current.delete(key);
        setBusy([...locks.current]);
      }
    }
  }
  async function upload(item: AuditItem, file: File | undefined) {
    if (!file || !current.current) return;
    const key = item.key,
      epoch = generation.current;
    if (locks.current.has(key)) return;
    locks.current.add(key);
    setBusy([...locks.current]);
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await request("/api/files", {
        method: "POST",
        body: form,
      });
      if (epoch !== generation.current) return;
      locks.current.delete(key);
      await run(
        { action: "replace-file", key: item.key, fileId: result.id },
        key,
      );
    } catch (error) {
      if (epoch === generation.current)
        setErrors((e) => ({ ...e, [key]: (error as Error).message }));
    } finally {
      if (epoch === generation.current) {
        locks.current.delete(key);
        setBusy([...locks.current]);
      }
    }
  }
  function edit(item: AuditItem) {
    setEditItem(item);
    setEditFacility(item.facilityId || "");
    setEditValues(
      Object.fromEntries(
        item.editableFields.map((k) => [k, item.fields[k] || ""]),
      ),
    );
    setSameAddress(model?.audit.snapshot.sameAddress || false);
    setErrors((e) => ({ ...e, edit: "" }));
    editDialog.current?.showModal();
  }
  function remark(item: AuditItem) {
    setRemarkItem(item);
    setRemarkText(item.remark?.text || "");
    setErrors((e) => ({ ...e, remark: "" }));
    remarkDialog.current?.showModal();
  }
  async function settings() {
    if (!model) return;
    setAuditorId(model.audit.auditor.id);
    setFirmName(model.audit.firm.name);
    setFirmAddress(model.audit.firm.address);
    setRequiredDocs(model.audit.policy.requiredDocuments);
    setRequiredConsents(model.audit.policy.requiredConsents);
    setPolicyReason(model.audit.policy.reason);
    setPeopleError("");
    setPeople([]);
    settingsDialog.current?.showModal();
    const epoch = generation.current;
    try {
      const result = await request(endpoint + "?people=1");
      if (epoch === generation.current) setPeople(result.people);
    } catch (error) {
      setPeopleError((error as Error).message);
    }
  }
  function control(
    field: string,
    value: string,
    onChange: (v: string) => void,
    item: AuditItem,
  ) {
    let choices = item.table ? tableChoices[field] : onboardingChoices[field];
    if (
      field === "PIBO category" &&
      model?.audit.snapshot.wasteStream === "ewaste"
    )
      choices = ["Producer", "Recycler", "Manufacturer", "Refurbisher"];
    if (field === "UOM" && item.table === "capacity") choices = ["KG", "MT"];
    const type = /date|Valid up to/i.test(field)
      ? "date"
      : /email/i.test(field)
        ? "email"
        : "text";
    return choices ? (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {choices.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  useEffect(() => {
    onDirtyChange?.(dirty || busy.length > 0);
    return () => onDirtyChange?.(false);
  }, [dirty, busy.length, onDirtyChange]);
  useEffect(() => {
    const modal = verifyDialog.current;
    if (verifyItem && modal?.isConnected && !modal.open) modal.showModal();
  }, [verifyItem]);
  async function verify(item: AuditItem) {
    const reasons =
      item.key === "letter" && dirty
        ? ["Save the unsaved letter edits before verification", ...item.missing]
        : item.missing;
    if (reasons.length) {
      setVerifyItem({ ...item, missing: reasons });
      return;
    }
    await run(
      { action: "verify", key: item.key, fingerprint: item.fingerprint },
      item.key,
    );
  }
  async function saveAndVerifyLetter() {
    const record = current.current;
    if (!record) return;
    const saved = await run(
      {
        action: "letter",
        content: dirty ? letterDraft : record.audit.letter.content,
      },
      "verify-letter",
    );
    if (!saved) return;
    setLetterDraft(saved.audit.letter.content);
    setLetterEditing(false);
    const item = saved.summary.items.find((i) => i.key === "letter")!;
    if (item.missing.length) {
      setVerifyItem(item);
      return;
    }
    const verified = await run(
      { action: "verify", key: "letter", fingerprint: item.fingerprint },
      "verify-letter",
    );
    if (verified) verifyDialog.current?.close();
  }
  function card(item: AuditItem) {
    const waiting = busy.includes(item.key);
    return (
      <section
        className="validation-card"
        id={"audit-item-" + item.key}
        key={item.key}
      >
        <header>
          <div>
            <h3>
              {item.verified ? (
                <CheckCircle2 size={18} />
              ) : (
                <FileText size={18} />
              )}{" "}
              {item.title}
            </h3>
            {item.facilityId && <small>Facility ID: {item.facilityId}</small>}
          </div>
          <span
            className={
              "check-status " +
              (item.verified ? "verified" : item.required ? "pending" : "na")
            }
          >
            {item.verified
              ? "Verified"
              : item.required
                ? "Pending"
                : "Not Applicable"}
          </span>
        </header>
        <dl className="validation-fields">
          {Object.entries(item.fields).map(([field, value]) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{value || "Not provided"}</dd>
            </div>
          ))}
        </dl>
        {item.naReason && <p className="na-reason">{item.naReason}</p>}
        {item.missing.length > 0 && (
          <div className="item-blockers">
            <strong>Needs attention</strong>
            <ul>
              {item.missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {item.stale && (
          <p className="stale-note">
            Content changed after verification. Review and verify again.
          </p>
        )}
        {item.verified && item.check && (
          <p className="verification-meta">
            <Check size={14} />
            Verified by {item.check.verifiedBy.name} ·{" "}
            {dateTime(item.check.verifiedAt)}
          </p>
        )}
        {item.remark?.text && (
          <blockquote>
            <MessageSquare size={14} />
            <div>
              {item.remark.text}
              <small>
                {item.remark.by} · {dateTime(item.remark.at)}
              </small>
            </div>
          </blockquote>
        )}
        <footer>
          {item.fileId && (
            <>
              <a
                href={"/api/files?id=" + item.fileId + "&preview=1"}
                target="_blank"
                rel="noreferrer"
              >
                Preview
              </a>
              <a href={"/api/files?id=" + item.fileId}>Download</a>
            </>
          )}
          {model?.canVerify && (
            <>
              <Button
                variant="outline"
                disabled={waiting || !item.editableFields.length}
                onClick={() => edit(item)}
              >
                <Pencil size={13} />
                Edit
              </Button>
              <Button
                variant="outline"
                disabled={waiting}
                onClick={() => remark(item)}
              >
                <MessageSquare size={13} />
                {item.remark?.text ? "Edit remark" : "Add remark"}
              </Button>
              {((item.documentType && item.recordId) ||
                (item.table &&
                  ["cte", "cto", "msme"].includes(item.table))) && (
                <label className="audit-upload">
                  <Upload size={13} />
                  {waiting
                    ? "Saving…"
                    : item.fileId
                      ? "Replace file"
                      : "Upload file"}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    disabled={waiting}
                    onChange={(e) => {
                      upload(item, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {item.recordId && (
                <Button
                  variant="ghost"
                  disabled={waiting}
                  aria-label={"Delete " + item.title}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this record and its verification/remark?",
                      )
                    )
                      run({ action: "remove-record", key: item.key }, item.key);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
              {item.required && (
                <Button
                  className="verify-action"
                  disabled={waiting || item.verified}
                  title={item.missing.join("; ")}
                  onClick={() => verify(item)}
                >
                  {waiting ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <ShieldCheck size={14} />
                  )}{" "}
                  {item.verified ? "Verified" : "Verify"}
                </Button>
              )}
            </>
          )}
          {item.documentType && !item.recordId && model?.canVerify && (
            <Button
              onClick={() =>
                run(
                  { action: "add-record", documentType: item.documentType },
                  "add",
                )
              }
            >
              <Plus size={14} />
              Add missing document
            </Button>
          )}
        </footer>
        {errors[item.key] && (
          <p role="alert" className="audit-error">
            {errors[item.key]}
          </p>
        )}
      </section>
    );
  }
  if (loading)
    return (
      <Root className="validation-loading">
        <LoaderCircle size={28} className="spin" />
        <h2>Loading audit workspace…</h2>
      </Root>
    );
  if (loadError || !model)
    return (
      <Root className="validation-loading">
        <h2>Could not load this audit</h2>
        <p role="alert">{loadError || "Audit data is unavailable."}</p>
        <Button onClick={() => load()}>
          <RotateCcw size={15} />
          Retry
        </Button>
        <a href="/dashboard?view=clients">Back to clients</a>
      </Root>
    );
  const { audit: a, summary: s } = model;
  const letter = s.items.find((i) => i.key === "letter")!;
  const activeItems = s.items.filter((i) => i.tab === tab);
  const facilities = a.facilities.map((f) => [f.id, f.name]);
  return (
    <Root className={"validation-page " + (embedded ? "embedded" : "")}>
      <div className="validation-breadcrumb">
        <a
          href="/dashboard?view=clients"
          onClick={(e) => {
            if (!mayNavigate()) e.preventDefault();
          }}
        >
          Home
        </a>
        <ChevronRight size={12} />
        <span>{a.snapshot.basic["Client legal name"]}</span>
        <ChevronRight size={12} />
        <strong>Audit Client</strong>
      </div>
      <header className="validation-client-header">
        <a
          className="audit-back"
          href="/dashboard?view=clients"
          aria-label="Back to clients"
          onClick={(e) => {
            if (!mayNavigate()) e.preventDefault();
          }}
        >
          <ArrowLeft size={19} />
        </a>
        <div className="audit-client-name">
          <h1>{a.snapshot.basic["Client legal name"] || "Unnamed client"}</h1>
          <p>
            {a.snapshot.wasteStream.toUpperCase()} CATEGORY{" "}
            <span>
              {a.snapshot.basic["PIBO category"] ||
                a.snapshot.registrationCategory}
            </span>{" "}
            FY {a.year}
          </p>
        </div>
        <div className="audit-year-selector">
          <label htmlFor="audit-year">FINANCIAL YEAR RECORDS</label>
          <select
            id="audit-year"
            value={a.id}
            disabled={busy.length > 0}
            onChange={(e) => {
              if (mayNavigate()) load(e.target.value);
            }}
          >
            {model.history.map((h) => (
              <option key={h.id} value={h.id}>
                {h.year}
                {h.id === a.id ? " (Selected)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          disabled={busy.length > 0}
          onClick={() => {
            if (mayNavigate()) {
              const y = Number(a.year.slice(0, 4)) + 1;
              setNewYear(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
              newAuditDialog.current?.showModal();
            }
          }}
        >
          <Plus size={15} />
          New financial year
        </Button>
        <div className="audit-assignee">
          <small>AUDITOR</small>
          <strong>{a.auditor.name || "Unassigned"}</strong>
        </div>
        <span className="audit-user-icon">
          <UserRound size={20} />
        </span>
        {model.canConfigure && (
          <button
            className="audit-settings"
            title="Audit settings and applicability"
            aria-label="Audit settings"
            onClick={settings}
          >
            <Settings2 size={19} />
          </button>
        )}
      </header>
      <div className="audit-history">
        <span>
          <History size={14} />
          COMPANY HISTORY
        </span>
        {model.history.map((h) => (
          <button
            key={h.id}
            className={h.id === a.id ? "selected" : ""}
            disabled={busy.length > 0}
            onClick={() => {
              if (mayNavigate()) load(h.id);
            }}
          >
            {h.year} • AUDIT
          </button>
        ))}
        <small>Audit ID: {a.id}</small>
      </div>
      <nav className="validation-stages" aria-label="Audit workflow">
        {[
          {
            id: "pre-audit",
            label: "Pre-Audit Check",
            locked: false,
            done: a.stage !== "pre-audit" && s.completed,
          },
          {
            id: "onsite",
            label: "Onsite Audit",
            locked: a.stage === "pre-audit",
            done: ["post-audit", "completed"].includes(a.stage),
          },
          {
            id: "post-audit",
            label: "Post Audit Check",
            locked: !["post-audit", "completed"].includes(a.stage),
            done: a.stage === "completed",
          },
        ].map((step) => (
          <button
            key={step.id}
            disabled={step.locked || busy.length > 0}
            className={
              (stage === step.id ? "active " : "") + (step.done ? "done" : "")
            }
            onClick={() => {
              if (mayNavigate()) setStage(step.id);
            }}
          >
            {step.locked ? (
              <LockKeyhole size={14} />
            ) : step.done ? (
              <CheckCircle2 size={15} />
            ) : null}
            {step.label}
          </button>
        ))}
      </nav>
      {a.legacyNotice && <p className="audit-banner">{a.legacyNotice}</p>}
      <section className="audit-progress">
        <div>
          <ShieldCheck size={19} />
          <div>
            <strong>{s.percent}% verified</strong>
            <span>
              {s.verified}/{s.required} required checks · {s.pending} pending ·{" "}
              {s.notApplicable} not applicable
            </span>
          </div>
        </div>
        <progress max={100} value={s.percent} />
        <Button
          variant="outline"
          disabled={busy.length > 0 || dirty}
          title={dirty ? "Save or cancel letter edits first" : ""}
          onClick={() => run({ action: "pdf", kind: "report" }, "report")}
        >
          <Download size={14} />
          {busy.includes("report") ? "Generating…" : "Validation report PDF"}
        </Button>
      </section>
      {notice && (
        <p role="status" className="audit-success">
          {notice}
        </p>
      )}
      {errors.report && (
        <p role="alert" className="audit-error">
          {errors.report}
        </p>
      )}
      {stage !== "pre-audit" ? (
        <section className="onsite-ready">
          <CheckCircle2 size={38} />
          <h2>
            {stage === "onsite"
              ? "Onsite Audit"
              : stage === "post-audit"
                ? "Post Audit Check"
                : "Audit completed"}
          </h2>
          <p>
            Pre-audit verification completed{" "}
            {a.completedAt ? dateTime(a.completedAt) : ""}. This audit’s saved
            workflow is now at {stage === "onsite" ? "Onsite Audit" : stage}.
          </p>
          <p>
            Assigned auditor: {a.auditor.name}. Financial year: {a.year}.
          </p>
          <Button variant="outline" onClick={() => setStage("pre-audit")}>
            Review pre-audit verification
          </Button>
        </section>
      ) : (
        <section className="validation-panel">
          <nav className="validation-tabs" aria-label="Validation tabs">
            {auditTabs.map((label, i) => (
              <button
                key={label}
                className={tab === i ? "active" : ""}
                aria-pressed={tab === i}
                onClick={() => {
                  if (mayNavigate()) setTab(i);
                }}
              >
                <span>{label}</span>
                {s.tabs[i].status === "Verified" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <small>{s.tabs[i].status}</small>
                )}
              </button>
            ))}
          </nav>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={a.id + "-" + tab}
              className="audit-tab-content"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
              transition={{
                duration: reducedMotion ? 0 : 0.2,
                ease: "easeOut",
              }}
            >
              {tab === 0 ? (
                <section className="letter-panel" id="audit-item-letter">
                  <header>
                    <h2>
                      <FileText size={16} />
                      Engagement Letter
                    </h2>
                    <div>
                      {model.canVerify && (
                        <>
                          <Button
                            variant="outline"
                            disabled={
                              dirty ||
                              busy.includes("letter") ||
                              busy.includes("letter-pdf") ||
                              !a.letter.saved
                            }
                            title={
                              !a.letter.saved
                                ? "Save the letter first"
                                : dirty
                                  ? "Save or cancel edits first"
                                  : ""
                            }
                            onClick={() =>
                              run(
                                { action: "pdf", kind: "letter" },
                                "letter-pdf",
                              )
                            }
                          >
                            <Download size={14} />
                            {busy.includes("letter-pdf")
                              ? "Generating…"
                              : "Save as PDF"}
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy.length > 0}
                            onClick={() => {
                              setLetterDraft(a.letter.content);
                              setLetterEditing(true);
                            }}
                          >
                            <Pencil size={14} />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="verify-action"
                            disabled={
                              letter.verified ||
                              busy.includes("letter") ||
                              busy.includes("verify-letter")
                            }
                            title={letter.missing.join("; ")}
                            onClick={() => verify(letter)}
                          >
                            <Check size={14} />
                            {letter.verified ? "Verified" : "Verify"}
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label="Engagement letter remark"
                            onClick={() => remark(letter)}
                          >
                            <MessageSquare size={15} />
                          </Button>
                        </>
                      )}
                    </div>
                  </header>
                  {letterEditing ? (
                    <div className="letter-editor">
                      <label htmlFor="engagement-content">
                        Engagement letter content
                      </label>
                      <textarea
                        id="engagement-content"
                        value={letterDraft}
                        onChange={(e) => setLetterDraft(e.target.value)}
                        maxLength={100000}
                      />
                      <div>
                        <Button
                          variant="outline"
                          disabled={busy.includes("letter")}
                          onClick={() => {
                            setLetterDraft(a.letter.content);
                            setLetterEditing(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={
                            !letterDraft.trim() || busy.includes("letter")
                          }
                          onClick={async () => {
                            const next = await run(
                              { action: "letter", content: letterDraft },
                              "letter",
                            );
                            if (next) {
                              setLetterDraft(next.audit.letter.content);
                              setLetterEditing(false);
                            }
                          }}
                        >
                          <Save size={15} />
                          {busy.includes("letter") ? "Saving…" : "Save letter"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setLetterDraft(model.suggestedLetter)}
                        >
                          Use current default
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const win = window.open("", "_blank");
                            if (win) {
                              win.document.title =
                                "Unsaved engagement letter preview";
                              const pre = win.document.createElement("pre");
                              pre.style.cssText =
                                "white-space:pre-wrap;font:16px/1.8 Georgia;max-width:800px;margin:40px auto;padding:24px";
                              pre.textContent = letterDraft;
                              win.document.body.appendChild(pre);
                            }
                          }}
                        >
                          Preview draft
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <article className="audit-letter-paper">
                      <header>
                        <h2>{a.letter.content.split("\n")[0]}</h2>
                      </header>
                      <pre>
                        {a.letter.content.split("\n").slice(1).join("\n")}
                      </pre>
                    </article>
                  )}
                  <div className="letter-validation">
                    {letter.missing.length > 0 && (
                      <div className="item-blockers">
                        <strong>Before verification</strong>
                        <ul>
                          {letter.missing.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {letter.stale && (
                      <p className="stale-note">
                        Saved content changed. Re-verification is required.
                      </p>
                    )}
                    {letter.verified && letter.check && (
                      <p className="verification-meta">
                        <CheckCircle2 size={15} />
                        Verified by {letter.check.verifiedBy.name} ·{" "}
                        {dateTime(letter.check.verifiedAt)}
                      </p>
                    )}
                    {letter.remark?.text && (
                      <blockquote>
                        {letter.remark.text}
                        <small>
                          {letter.remark.by} · {dateTime(letter.remark.at)}
                        </small>
                      </blockquote>
                    )}
                    {errors.letter && (
                      <p role="alert" className="audit-error">
                        {errors.letter}
                      </p>
                    )}
                    {errors["letter-pdf"] && (
                      <p role="alert" className="audit-error">
                        {errors["letter-pdf"]}
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <div className="validation-section-heading">
                    <div>
                      <h2>{auditTabs[tab]}</h2>
                      <p>
                        {s.tabs[tab].verified}/{s.tabs[tab].required} applicable
                        checks verified
                      </p>
                    </div>
                    {model.canVerify && tab === 3 && (
                      <div className="record-add">
                        <select
                          aria-label="Document type to add"
                          value={newType}
                          onChange={(e) => setNewType(e.target.value)}
                        >
                          {documentChoices.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          disabled={busy.includes("add")}
                          onClick={() =>
                            run(
                              { action: "add-record", documentType: newType },
                              "add",
                            )
                          }
                        >
                          <Plus size={14} />
                          Add document
                        </Button>
                      </div>
                    )}
                    {model.canVerify && tab === 4 && (
                      <div className="record-add">
                        <select
                          aria-label="Record type to add"
                          value={newTable}
                          onChange={(e) => setNewTable(e.target.value)}
                        >
                          {Object.entries(tables)
                            .filter(([key]) => key !== "msme")
                            .map(([key, value]) => (
                              <option key={key} value={key}>
                                {value.title}
                              </option>
                            ))}
                        </select>
                        <select
                          aria-label="Facility for new consent"
                          value={facility}
                          onChange={(e) => setFacility(e.target.value)}
                        >
                          <option value="">New independent facility</option>
                          {facilities.map(([id, name]) => (
                            <option key={id} value={id}>
                              {name} · {id.slice(-6)}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="outline"
                          disabled={busy.includes("add")}
                          onClick={() =>
                            run(
                              {
                                action: "add-record",
                                table: newTable,
                                ...(facility ? { facilityId: facility } : {}),
                              },
                              "add",
                            )
                          }
                        >
                          <Plus size={14} />
                          Add record
                        </Button>
                      </div>
                    )}
                  </div>
                  {errors.add && (
                    <p role="alert" className="audit-error">
                      {errors.add}
                    </p>
                  )}
                  {tab === 3 && letter.fileId && (
                    <section className="engagement-file">
                      <FileText size={20} />
                      <div>
                        <strong>Engagement Letter PDF</strong>
                        <small>
                          {letter.verified
                            ? "Verified with Tab 1"
                            : "Tab 1 verification pending"}
                        </small>
                      </div>
                      <a
                        href={"/api/files?id=" + letter.fileId + "&preview=1"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview
                      </a>
                      <a href={"/api/files?id=" + letter.fileId}>Download</a>
                      <Button variant="ghost" onClick={() => setTab(0)}>
                        Open letter
                      </Button>
                    </section>
                  )}
                  {tab === 4
                    ? [
                        ...new Set(
                          activeItems.map((i) => i.facilityId || "other"),
                        ),
                      ].map((id) => (
                        <section className="facility-group" key={id}>
                          <header>
                            <Building2 size={17} />
                            <div>
                              <strong>
                                {id === "other"
                                  ? "Production & other records"
                                  : a.facilities.find((f) => f.id === id)
                                      ?.name || "Facility"}
                              </strong>
                              {id !== "other" && (
                                <small>Facility ID: {id}</small>
                              )}
                            </div>
                          </header>
                          {activeItems
                            .filter((i) => (i.facilityId || "other") === id)
                            .map(card)}
                        </section>
                      ))
                    : activeItems.map(card)}
                  {tab === 3 && model.canVerify && (
                    <Button
                      variant="outline"
                      disabled={busy.includes("add")}
                      onClick={() =>
                        run({ action: "add-record", table: "msme" }, "add")
                      }
                    >
                      <Plus size={14} />
                      Add MSME record
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="validation-completion">
            <div>
              <strong>
                {s.completed
                  ? "All required checks are verified"
                  : "Pre-audit verification is incomplete"}
              </strong>
              <span>
                {a.stage === "pre-audit"
                  ? "Complete verification to unlock Onsite Audit."
                  : "Pre-audit has been completed for this audit."}
              </span>
            </div>
            <Button
              disabled={
                !model.canVerify ||
                busy.length > 0 ||
                dirty ||
                !s.completed ||
                a.stage !== "pre-audit"
              }
              title={s.blockers.map((b) => b.title).join(", ")}
              onClick={async () => {
                const next = await run({ action: "complete" }, "complete");
                if (next) {
                  setStage("onsite");
                  onComplete?.(next.audit);
                }
              }}
            >
              <ShieldCheck size={16} />
              Complete verification / Move to Onsite Audit
            </Button>
          </footer>
          {errors.complete && (
            <p role="alert" className="audit-error">
              {errors.complete}
            </p>
          )}
          {s.blockers.length > 0 && (
            <details className="pending-list">
              <summary>
                {s.blockers.length} checks need attention — view pending list
              </summary>
              {s.blockers.map((b) => (
                <button
                  key={b.key}
                  onClick={() => {
                    if (mayNavigate()) setTab(b.tab);
                  }}
                >
                  <strong>
                    {auditTabs[b.tab]} / {b.title}
                  </strong>
                  <span>{b.reasons.join("; ")}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </details>
          )}
        </section>
      )}
      <dialog
        ref={verifyDialog}
        onClose={() => setVerifyItem(null)}
        className="audit-modal verify-checklist"
        data-lenis-prevent
        aria-labelledby="verify-checklist-title"
        onCancel={(e) => {
          if (busy.includes("verify-letter")) e.preventDefault();
        }}
      >
        <header>
          <div>
            <span className="verify-eyebrow">VERIFICATION CHECKLIST</span>
            <h2 id="verify-checklist-title">Finish a few details to verify</h2>
          </div>
          <button
            aria-label="Close verification checklist"
            disabled={busy.includes("verify-letter")}
            onClick={() => verifyDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <div className="verify-checklist-body">
          <strong>{verifyItem?.title}</strong>
          <p>
            Your verification will be saved after these requirements are
            complete.
          </p>
          <ul>
            {verifyItem?.missing.map((reason, index) => (
              <li key={index}>
                <ShieldCheck size={16} />
                {reason}
              </li>
            ))}
          </ul>
          {errors["verify-letter"] && (
            <p role="alert" className="audit-error">
              {errors["verify-letter"]}
            </p>
          )}
        </div>
        <footer>
          <Button
            variant="ghost"
            disabled={busy.includes("verify-letter")}
            onClick={() => verifyDialog.current?.close()}
          >
            Close
          </Button>
          {verifyItem?.key === "letter" ? (
            <>
              <Button
                variant="outline"
                disabled={busy.includes("verify-letter")}
                onClick={() => {
                  verifyDialog.current?.close();
                  if (!letterEditing)
                    setLetterDraft(current.current!.audit.letter.content);
                  setLetterEditing(true);
                }}
              >
                Edit letter
              </Button>
              {model.canConfigure && (
                <Button
                  variant="outline"
                  disabled={busy.includes("verify-letter")}
                  onClick={() => {
                    verifyDialog.current?.close();
                    settings();
                  }}
                >
                  Audit settings
                </Button>
              )}
              <Button
                className="verify-action"
                disabled={busy.includes("verify-letter")}
                onClick={saveAndVerifyLetter}
              >
                {busy.includes("verify-letter") ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <ShieldCheck size={15} />
                )}
                Save & verify
              </Button>
            </>
          ) : verifyItem && verifyItem.editableFields.length > 0 ? (
            <Button
              onClick={() => {
                verifyDialog.current?.close();
                edit(verifyItem);
              }}
            >
              <Pencil size={15} />
              Edit details
            </Button>
          ) : null}
        </footer>
      </dialog>
      <dialog
        ref={remarkDialog}
        className="audit-modal"
        data-lenis-prevent
        aria-labelledby="remark-title"
        onCancel={(e) => {
          if (busy.includes("remark")) e.preventDefault();
        }}
      >
        <header>
          <h2 id="remark-title">
            {remarkItem?.remark?.text ? "Edit" : "Add"} remark
          </h2>
          <button
            aria-label="Close remark"
            disabled={busy.includes("remark")}
            onClick={() => remarkDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!remarkItem) return;
            const next = await run(
              { action: "remark", key: remarkItem.key, text: remarkText },
              "remark",
            );
            if (next) remarkDialog.current?.close();
          }}
        >
          <p>{remarkItem?.title}</p>
          <label htmlFor="audit-remark">Remark</label>
          <textarea
            id="audit-remark"
            autoFocus
            maxLength={2000}
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
          />
          <small>
            {remarkText.length}/2000 · Clear the field and save to remove a
            remark.
          </small>
          {errors.remark && (
            <p role="alert" className="audit-error">
              {errors.remark}
            </p>
          )}
          <footer>
            <Button
              type="button"
              variant="outline"
              disabled={busy.includes("remark")}
              onClick={() => remarkDialog.current?.close()}
            >
              Cancel
            </Button>
            <Button
              disabled={
                busy.includes("remark") ||
                Boolean(remarkText.length && !remarkText.trim())
              }
            >
              {busy.includes("remark") ? "Saving…" : "Save remark"}
            </Button>
          </footer>
        </form>
      </dialog>
      <dialog
        ref={editDialog}
        className="audit-modal large"
        data-lenis-prevent
        aria-labelledby="edit-title"
        onCancel={(e) => {
          if (busy.includes("edit")) e.preventDefault();
        }}
      >
        <header>
          <h2 id="edit-title">Edit {editItem?.title}</h2>
          <button
            aria-label="Close edit"
            disabled={busy.includes("edit")}
            onClick={() => editDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editItem) return;
            const next = await run(
              {
                action: "edit",
                key: editItem.key,
                values: editValues,
                ...(editFacility ? { facilityId: editFacility } : {}),
                ...(["registered", "communication"].includes(editItem.key)
                  ? { sameAddress }
                  : {}),
              },
              "edit",
            );
            if (next) editDialog.current?.close();
          }}
        >
          {editItem?.table && ["cte", "cto"].includes(editItem.table) && (
            <label>
              Facility
              <select
                value={editFacility}
                onChange={(e) => setEditFacility(e.target.value)}
              >
                {a.facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="audit-edit-fields">
            {editItem &&
              Object.entries(editValues).map(([field, value]) => (
                <label key={field}>
                  {field}
                  {control(
                    field,
                    value,
                    (v) =>
                      setEditValues((values) => ({ ...values, [field]: v })),
                    editItem,
                  )}
                </label>
              ))}
          </div>
          {editItem &&
            ["registered", "communication"].includes(editItem.key) && (
              <label className="audit-checkbox">
                <input
                  type="checkbox"
                  checked={sameAddress}
                  onChange={(e) => setSameAddress(e.target.checked)}
                />
                Same as registered address (communication address stays
                synchronized)
              </label>
            )}
          <p className="audit-help">
            Saving changed content requires re-verification of affected checks.
          </p>
          {errors.edit && (
            <p role="alert" className="audit-error">
              {errors.edit}
            </p>
          )}
          <footer>
            <Button
              type="button"
              variant="outline"
              disabled={busy.includes("edit")}
              onClick={() => editDialog.current?.close()}
            >
              Cancel
            </Button>
            <Button disabled={busy.includes("edit")}>
              {busy.includes("edit") ? "Saving…" : "Save changes"}
            </Button>
          </footer>
        </form>
      </dialog>
      <dialog
        ref={settingsDialog}
        className="audit-modal large"
        data-lenis-prevent
        aria-labelledby="settings-title"
      >
        <header>
          <h2 id="settings-title">Audit settings & applicability</h2>
          <button
            aria-label="Close settings"
            onClick={() => settingsDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <div className="audit-settings-body">
          <h3>Assigned auditor & company</h3>
          {peopleError && (
            <p role="alert" className="audit-error">
              {peopleError}
            </p>
          )}
          <label>
            Assigned auditor
            <select
              value={auditorId}
              onChange={(e) => setAuditorId(e.target.value)}
            >
              <option value="">Select an auditor</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Auditor company name
            <input
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
            />
          </label>
          <label>
            Auditor company address
            <textarea
              value={firmAddress}
              onChange={(e) => setFirmAddress(e.target.value)}
              maxLength={1000}
            />
          </label>
          <Button
            disabled={!auditorId || !firmName.trim() || busy.includes("assign")}
            onClick={() =>
              run(
                { action: "assign", auditorId, firmName, firmAddress },
                "assign",
              )
            }
          >
            <Save size={14} />
            Save assignment
          </Button>
          {errors.assign && (
            <p role="alert" className="audit-error">
              {errors.assign}
            </p>
          )}
          <h3>Required documents for this audit</h3>
          <p className="audit-help">
            The existing onboarding policy does not mandate every document.
            Approve additional requirements here; the reason is saved with this
            audit only.
          </p>
          <div className="policy-options">
            {documentChoices.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={requiredDocs.includes(type)}
                  onChange={(e) =>
                    setRequiredDocs((values) =>
                      e.target.checked
                        ? [...values, type]
                        : values.filter((v) => v !== type),
                    )
                  }
                />
                {type}
              </label>
            ))}
          </div>
          <h3>Required consents</h3>
          {["cte", "cto"].map((type) => (
            <label className="audit-checkbox" key={type}>
              <input
                type="checkbox"
                checked={requiredConsents.includes(type)}
                onChange={(e) =>
                  setRequiredConsents((values) =>
                    e.target.checked
                      ? [...values, type]
                      : values.filter((v) => v !== type),
                  )
                }
              />
              {type === "cte" ? "CTE" : "CTO / CCA"} for every applicable
              facility
            </label>
          ))}
          <label>
            Business reason / applicability approval
            <textarea
              value={policyReason}
              onChange={(e) => setPolicyReason(e.target.value)}
              maxLength={1000}
            />
          </label>
          <Button
            disabled={policyReason.trim().length < 5 || busy.includes("policy")}
            onClick={() =>
              run(
                {
                  action: "policy",
                  requiredDocuments: requiredDocs,
                  requiredConsents,
                  reason: policyReason,
                },
                "policy",
              )
            }
          >
            <Save size={14} />
            Save applicability
          </Button>
          {errors.policy && (
            <p role="alert" className="audit-error">
              {errors.policy}
            </p>
          )}
          <h3>Refresh from onboarding</h3>
          <p className="audit-help">
            Replace this audit’s information with the current onboarding record.
            Changed content requires re-verification. The audit year and saved
            letter remain independent.
          </p>
          <Button
            variant="outline"
            disabled={busy.length > 0}
            onClick={() => {
              if (
                window.confirm(
                  "Refresh this audit from onboarding? Changed checks will need verification again.",
                )
              )
                run({ action: "sync" }, "sync");
            }}
          >
            <RotateCcw size={14} />
            Refresh from onboarding
          </Button>
          {errors.sync && (
            <p role="alert" className="audit-error">
              {errors.sync}
            </p>
          )}
        </div>
        <footer>
          <Button
            variant="outline"
            onClick={() => settingsDialog.current?.close()}
          >
            Close settings
          </Button>
        </footer>
      </dialog>
      <dialog
        ref={newAuditDialog}
        className="audit-modal"
        aria-labelledby="new-year-title"
      >
        <header>
          <h2 id="new-year-title">Create financial-year audit</h2>
          <button
            aria-label="Close new audit"
            onClick={() => newAuditDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (locks.current.has("create")) return;
            locks.current.add("create");
            setBusy([...locks.current]);
            try {
              const next = await request(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: newYear }),
              });
              newAuditDialog.current?.close();
              await load(next.audit.id);
            } catch (error) {
              setErrors((v) => ({ ...v, create: (error as Error).message }));
            } finally {
              locks.current.delete("create");
              setBusy([...locks.current]);
            }
          }}
        >
          <label>
            Financial year
            <input
              value={newYear}
              pattern="20[0-9]{2}-[0-9]{2}"
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="2027-28"
              required
            />
          </label>
          <p className="audit-help">
            Copies company information into a separate audit. Checks, remarks
            and letter are not copied from another year.
          </p>
          {errors.create && (
            <p role="alert" className="audit-error">
              {errors.create}
            </p>
          )}
          <footer>
            <Button disabled={busy.includes("create")}>Create audit</Button>
          </footer>
        </form>
      </dialog>
    </Root>
  );
}
