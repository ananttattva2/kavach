import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { createHmac, randomBytes } from "node:crypto";
import { setServers } from "node:dns";
import { setServers as setPromiseServers } from "node:dns/promises";
import { existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS.split(",");
  setServers(servers);
  setPromiseServers(servers);
}
mkdirSync("artifacts", { recursive: true });
const base = process.env.QA_BASE_URL || "http://localhost:9000";
const database = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
const db = database.db(process.env.MONGODB_DB || "kavach");
const member = new ObjectId(),
  admin = new ObjectId();
const errors = [];
let browser;
async function fixture(id, role) {
  const token = randomBytes(32).toString("hex"),
    sessionId = new ObjectId(),
    licenseId = new ObjectId(),
    now = new Date();
  const email = `qa-${id}@example.invalid`;
  await db.collection("user").insertOne({
    _id: id,
    name: role === "admin" ? "QA Administrator" : "QA Member",
    email,
    emailVerified: true,
    role,
    banned: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection("session").insertOne({
    _id: sessionId,
    userId: id,
    token,
    expiresAt: new Date(Date.now() + 1200000),
    createdAt: now,
    updatedAt: now,
  });
  await db.collection("licenses").insertOne({
    _id: licenseId,
    keyHash: randomBytes(32).toString("hex"),
    keyPrefix: "TEST",
    keyLast4: "0000",
    assignedEmail: email,
    issuedToName: "QA",
    assignedUser: id.toString(),
    status: "active",
    maxDevices: 1,
    expiresAt: null,
    activatedDevices: [],
    createdBy: id.toString(),
    createdAt: now,
    updatedAt: now,
  });
  await db.collection("session_licenses").insertOne({
    _id: sessionId.toString(),
    userId: id.toString(),
    licenseId,
    verifiedUntil: new Date(Date.now() + 1200000),
    verifiedAt: now,
  });
  return encodeURIComponent(
    token +
      "." +
      createHmac("sha256", process.env.BETTER_AUTH_SECRET)
        .update(token)
        .digest("base64"),
  );
}
async function parsePdf(bytes) {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  });
  const pdf = await task.promise;
  let text = "";
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const size = page.getViewport({ scale: 1 });
    assert.ok(
      Math.abs(size.width - 595.28) < 1 && Math.abs(size.height - 841.89) < 1,
      "A4 page dimensions",
    );
    text +=
      (await page.getTextContent()).items.map((i) => i.str || "").join(" ") +
      "\n";
  }
  const pages = pdf.numPages;
  await task.destroy();
  return { pages, text };
}
const clientIds = [];
let qaPage;
try {
  const adminCookie = await fixture(admin, "admin"),
    memberCookie = await fixture(member, "user");
  browser = await chromium.launch({
    headless: true,
    executablePath: existsSync(
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    )
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1750, height: 1080 },
  });
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: adminCookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  qaPage = page;
  const extensionErrors = [];
  page.on("pageerror", (e) => {
    if (e.stack?.includes("chrome-extension://qa-share-modal/"))
      extensionErrors.push(e.message);
    else errors.push(e.message);
  });
  // Reproduce an unrelated extension's null-listener crash without suppressing application errors.
  await page.addInitScript(() => {
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        const script = document.createElement("script");
        script.textContent =
          "setTimeout(()=>document.querySelector('.qa-extension-missing-button').addEventListener('click',()=>{}),50);\n//# sourceURL=chrome-extension://qa-share-modal/js/share-modal.js";
        document.head.appendChild(script);
      },
      { once: true },
    );
  });
  const basic = {
    "Client legal name": "Audit QA Industries Private Limited",
    "Trade name": "Audit QA",
    "Company group name": "QA Group",
    "Company type": "Private Limited",
    "Financial year": "2026-27",
    "PIBO category": "Producer",
    "Authorised person name": "QA Auditor",
    "Authorised contact number": "9876543210",
    "Authorised email": "audit@example.invalid",
  };
  const payload = {
    status: "submitted",
    wasteStream: "plastic",
    registrationCategory: "pibo",
    basic,
    address: {
      "Registered address line 1": "42 QA Industrial Estate",
      "Registered state": "Gujarat",
      "Registered city": "Ahmedabad",
      "Registered PIN code": "380001",
    },
    sameAddress: true,
    plantCount: 1,
    documents: ["PAN Card", "GST Certificate"].map((type) => ({
      type,
      number: "",
      date: "",
      fileId: "",
      fileName: "",
    })),
    tables: {},
  };
  const saved = await context.request.post(base + "/api/clients", {
    headers: { Origin: base },
    data: payload,
  });
  assert.equal(saved.status(), 200, await saved.text());
  const clientId = (await saved.json()).id;
  clientIds.push(clientId);
  const api = base + "/api/clients/" + clientId + "/audits";
  let result = await context.request.post(api, {
    headers: { Origin: base },
    data: { year: "2026-27" },
  });
  assert.equal(result.status(), 200, await result.text());
  let state = await result.json();
  const firstId = state.audit.id;
  const get = async (id = firstId) => {
    const r = await context.request.get(api + "?auditId=" + id);
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  };
  async function change(op, status = 200, override) {
    const r = await context.request.patch(api, {
      headers: { Origin: base },
      data: {
        auditId: state.audit.id,
        revision: state.audit.revision,
        ...op,
        ...override,
      },
    });
    assert.equal(r.status(), status, await r.text());
    const data = await r.json();
    if (status === 200) state = data;
    return data;
  }
  // Pending verification is clickable and explains blockers rather than silently disabling the action.
  await page.goto(
    base + "/clients/" + clientId + "/pre-audit?auditId=" + firstId,
  );
  await page
    .locator(".portal-topbar")
    .getByText("Pre-audit check", { exact: true })
    .waitFor();
  const sidebarBounds = await page.locator(".portal-sidebar").boundingBox();
  assert.ok(sidebarBounds.x >= 0 && sidebarBounds.width > 200);
  assert.equal(
    await page
      .locator(".audit-history .selected")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(23, 99, 68)",
  );
  const verifyButton = page
    .locator(".letter-panel")
    .getByRole("button", { name: "Verify", exact: true });
  await verifyButton.waitFor();
  assert.equal(await verifyButton.isEnabled(), true);
  const paper = await page.locator(".audit-letter-paper").boundingBox();
  const panel = await page.locator(".letter-panel").boundingBox();
  assert.ok(
    paper.width > panel.width * 0.95,
    "Letter uses the available panel width",
  );
  await verifyButton.click();
  await page
    .getByRole("heading", { name: "Finish a few details to verify" })
    .waitFor();
  await page
    .locator(".verify-checklist")
    .getByText("Resolve placeholder [Auditor Company Address]", { exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/preaudit-verification-checklist.png",
  });
  await page
    .locator(".verify-checklist")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Edit", exact: true }).count(),
    0,
  );
  for (const title of [
    "Client Basic Info",
    "Company Address",
    "Company Documents",
    "CTE & CTO/CCA",
  ]) {
    await page
      .locator(".validation-tabs")
      .getByRole("button", {
        name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .click();
    await page.locator(".validation-records-table").first().waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Edit", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText("Replace file", { exact: true }).count(),
      0,
    );
    await page.screenshot({
      path: `artifacts/preaudit-table-${title.replace(/[^a-z]/gi, "").toLowerCase()}.png`,
      fullPage: true,
    });
  }
  await page
    .locator(".validation-tabs")
    .getByRole("button", { name: /Engagement Letter/ })
    .click();
  assert.equal(state.canVerify, true);
  assert.equal(
    state.summary.items.find((i) => i.key === "coordinator").required,
    false,
  );
  await change({ action: "complete" }, 422);
  await change(
    { action: "verify", key: "doc_0", fingerprint: "0".repeat(64) },
    400,
  );
  await change({
    action: "assign",
    auditorId: admin.toString(),
    firmName: "QA Audit & Compliance",
    firmAddress: "",
  });
  // Reproduce a previously saved custom letter with the unresolved address.
  await change({
    action: "letter",
    content: state.audit.letter.content + "\nCustom agreed scope retained.",
  });
  await page.reload();
  await page
    .getByRole("heading", { name: "QA Audit & Compliance", exact: true })
    .waitFor();
  await page
    .locator(".letter-panel")
    .getByRole("button", { name: "Verify", exact: true })
    .click();
  await page
    .locator(".verify-checklist")
    .getByRole("button", { name: "Save & verify", exact: true })
    .click();
  await page
    .getByText("Enter the auditor company address before verifying.", {
      exact: true,
    })
    .waitFor();
  await page
    .locator(".verify-checklist")
    .getByLabel("Auditor company address", { exact: true })
    .fill("18 Auditor Street, Mumbai, Maharashtra 400001");
  await page
    .locator(".verify-checklist")
    .getByRole("button", { name: "Save & verify", exact: true })
    .click();
  await page.locator(".verify-checklist[open]").waitFor({ state: "hidden" });
  await page
    .locator(".letter-panel")
    .getByRole("button", { name: "Verified", exact: true })
    .waitFor();
  state = await get();
  assert.equal(state.audit.letter.saved, true);
  assert.ok(
    state.audit.letter.content.includes("Custom agreed scope retained."),
  );
  assert.ok(!state.audit.letter.content.includes("[Auditor Company Address]"));
  assert.equal(
    state.audit.firm.address,
    "18 Auditor Street, Mumbai, Maharashtra 400001",
  );
  assert.equal(
    state.summary.items.find((i) => i.key === "letter").verified,
    true,
  );
  await page.reload();
  await page
    .locator(".letter-panel")
    .getByRole("button", { name: "Verified", exact: true })
    .waitFor();
  await change({
    action: "letter",
    content:
      state.audit.letter.content.replace(
        "[Auditor Company Address]",
        "18 Auditor Street, Mumbai, Maharashtra 400001",
      ) + "\n\nAgreed fees: ₹10,000 — review & reporting. Café compliance.",
  });
  await change({ action: "remark", key: "company", text: "   " }, 400);
  await change({
    action: "remark",
    key: "company",
    text: "Company reviewed; awaiting verification.",
  });
  assert.equal(
    state.summary.items.find((i) => i.key === "company").verified,
    false,
  );
  await change({
    action: "policy",
    requiredDocuments: ["PAN Card"],
    requiredConsents: [],
    reason: "PAN registration is required for this QA audit.",
  });
  let pan = state.summary.items.find((i) => i.documentType === "PAN Card");
  await change(
    { action: "verify", key: pan.key, fingerprint: pan.fingerprint },
    422,
  );
  // Use a real PDF for the upload, and check PDF generation is deterministic per saved letter.
  await change({ action: "pdf", kind: "letter" });
  const letterFile = state.download.fileId;
  const bytes = await (
    await context.request.get(base + "/api/files?id=" + letterFile)
  ).body();
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  const parsedLetter = await parsePdf(bytes);
  assert.ok(parsedLetter.text.includes("₹10,000"));
  assert.ok(parsedLetter.text.includes("Café"));
  assert.ok(parsedLetter.text.includes("Audit QA Industries Private Limited"));
  await change({ action: "pdf", kind: "letter" });
  assert.equal(state.download.fileId, letterFile);
  const uploaded = await context.request.post(base + "/api/files", {
    headers: { Origin: base },
    multipart: {
      file: { name: "pan.pdf", mimeType: "application/pdf", buffer: bytes },
    },
  });
  assert.equal(uploaded.status(), 200);
  const uploadId = (await uploaded.json()).id;
  await change({ action: "import-document", key: pan.key }, 422);
  await page.reload();
  await page
    .locator(".validation-tabs")
    .getByRole("button", { name: /Company Documents/ })
    .click();
  await page
    .locator('[id="audit-item-' + pan.key + '"]')
    .getByRole("button", { name: "Verify", exact: true })
    .click();
  const recoveryHref = await page
    .locator(".verify-checklist")
    .getByRole("link", { name: "Client documents", exact: true })
    .getAttribute("href");
  assert.equal(
    new URL(recoveryHref, base).searchParams.get("step"),
    "documents",
  );
  assert.equal(
    new URL(recoveryHref, base).searchParams.get("documentId"),
    pan.recordId,
  );
  const recoveryPage = await context.newPage();
  await recoveryPage.goto(base + recoveryHref);
  await recoveryPage
    .getByRole("heading", { name: "Company documents", exact: true })
    .waitFor();
  const targetDocument = recoveryPage.locator(
    '[data-document-id="' + pan.recordId + '"]',
  );
  await targetDocument.locator(".missing-document-file").waitFor();
  assert.ok(
    (await targetDocument.getAttribute("class")).includes(
      "document-needs-attention",
    ),
  );
  await recoveryPage.waitForFunction(
    (id) => document.activeElement?.getAttribute("data-document-id") === id,
    pan.recordId,
  );
  await recoveryPage
    .getByLabel("PAN Card number", { exact: true })
    .fill("QA-PAN-123");
  assert.equal(
    await recoveryPage
      .getByLabel("PAN Card number", { exact: true })
      .getAttribute("aria-invalid"),
    null,
  );
  await recoveryPage.screenshot({
    path: "artifacts/preaudit-document-recovery.png",
    fullPage: true,
  });
  await recoveryPage.close();

  // Reproduce the real legacy client: snapshot and source have independent IDs.
  await change({
    action: "edit",
    key: pan.key,
    values: { "Certificate number": "QA-PAN-123" },
  });
  const sourcePanId = new ObjectId().toString();
  // A saved onboarding attachment can be imported by stable ID without syncing other records.
  await db.collection("clients").updateOne(
    { _id: new ObjectId(clientId) },
    {
      $set: {
        "documents.$[document].id": sourcePanId,
        "documents.$[document].fileId": uploadId,
        "documents.$[document].fileName": "pan.pdf",
        "documents.$[document].number": "QA-PAN-123",
        "documents.$[document].date": "2026-04-01",
      },
    },
    { arrayFilters: [{ "document.id": pan.recordId }] },
  );
  const duplicateId = new ObjectId().toString();
  await db
    .collection("clients")
    .updateOne(
      { _id: new ObjectId(clientId) },
      {
        $push: {
          documents: {
            id: duplicateId,
            type: "PAN Card",
            number: "QA-PAN-123",
            date: "2026-04-01",
            fileId: uploadId,
            fileName: "pan.pdf",
          },
        },
      },
    );
  await change({ action: "import-document", key: pan.key }, 422);
  await db
    .collection("clients")
    .updateOne(
      { _id: new ObjectId(clientId) },
      { $pull: { documents: { id: duplicateId } } },
    );
  await page.reload();
  await page
    .locator(".validation-tabs")
    .getByRole("button", { name: /Company Documents/ })
    .click();
  const savedDocumentsPage = await context.newPage();
  await savedDocumentsPage.goto(base + recoveryHref);
  await savedDocumentsPage
    .getByText("All document details are saved", { exact: true })
    .waitFor();
  assert.equal(
    await savedDocumentsPage
      .locator(".document-recovery-summary.documents-ready")
      .count(),
    1,
  );
  assert.equal(
    await savedDocumentsPage
      .getByText("0 document(s) need attention", { exact: true })
      .count(),
    0,
  );
  assert.equal(await savedDocumentsPage.locator(".document-target").getAttribute("data-document-id"), sourcePanId);
  await savedDocumentsPage.close();
  const panRow = page.locator('[id="audit-item-' + pan.key + '"]');
  await panRow.getByRole("button", { name: "Verify", exact: true }).click();
  await panRow.getByRole("button", { name: "Verified", exact: true }).waitFor();
  assert.equal(await page.locator(".verify-checklist[open]").count(), 0);
  state = await get();
  assert.equal(
    state.summary.items.find((item) => item.key === pan.key).verified,
    true,
  );
  assert.equal(
    state.audit.snapshot.documents.find((doc) => doc.id === pan.recordId)
      .fileId,
    uploadId,
  );

  await change({
    action: "edit",
    key: pan.key,
    values: {
      "Certificate number": "QA-PAN-123",
      "Issue date": "2026-04-01",
      "Expiry date": "2030-03-31",
    },
  });
  await change({ action: "replace-file", key: pan.key, fileId: uploadId });
  pan = state.summary.items.find((i) => i.key === pan.key);
  await change({
    action: "verify",
    key: pan.key,
    fingerprint: pan.fingerprint,
  });
  assert.equal(
    state.summary.items.find((i) => i.key === pan.key).verified,
    true,
  );
  await db.collection("client_audits").updateOne(
    { _id: new ObjectId(firstId) },
    {
      $set: {
        "snapshot.documents": [...state.audit.snapshot.documents].reverse(),
      },
    },
  );
  state = await get();
  assert.equal(
    state.summary.items.find((i) => i.key === pan.key).verified,
    true,
  );
  // Duplicate records retain independent checks, regardless of order.
  await change({ action: "add-record", documentType: "GST Certificate" });
  const extra = state.summary.items
    .filter((i) => i.documentType === "GST Certificate")
    .at(-1);
  await change({
    action: "remark",
    key: extra.key,
    text: "This remark belongs to the second GST record only.",
  });
  await change({ action: "remove-record", key: extra.key });
  assert.ok(!state.summary.items.some((i) => i.key === extra.key));
  assert.ok(!state.audit.remarks[extra.key]);
  // Concurrent requests use revision checks; one succeeds and one returns 409.
  const revision = state.audit.revision;
  const parallel = await Promise.all(
    ["authorised", "registered"].map((key) =>
      context.request.patch(api, {
        headers: { Origin: base },
        data: {
          auditId: firstId,
          revision,
          action: "remark",
          key,
          text: "Concurrent " + key,
        },
      }),
    ),
  );
  assert.deepEqual(parallel.map((r) => r.status()).sort(), [200, 409]);
  state = await get();
  assert.ok(state.audit.remarks.authorised || state.audit.remarks.registered);
  // Material edits invalidate only the affected group, preserving the remark.
  let company = state.summary.items.find((i) => i.key === "company");
  await change({
    action: "verify",
    key: company.key,
    fingerprint: company.fingerprint,
  });
  await change({
    action: "edit",
    key: "company",
    values: { "Trade name": "Changed QA Trade" },
  });
  company = state.summary.items.find((i) => i.key === "company");
  assert.equal(company.verified, false);
  assert.equal(company.stale, true);
  assert.equal(company.remark.text, "Company reviewed; awaiting verification.");
  // File replacement invalidates document verification.
  const replacement = await context.request.post(base + "/api/files", {
    headers: { Origin: base },
    multipart: {
      file: {
        name: "pan-replacement.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      },
    },
  });
  await change({
    action: "replace-file",
    key: pan.key,
    fileId: (await replacement.json()).id,
  });
  assert.equal(
    state.summary.items.find((i) => i.key === pan.key).verified,
    false,
  );
  // Year isolation: copied company data, independent letter/checks/remarks.
  result = await context.request.post(api, {
    headers: { Origin: base },
    data: { year: "2027-28" },
  });
  assert.equal(result.status(), 200);
  const second = await result.json();
  assert.notEqual(second.audit.id, firstId);
  assert.deepEqual(second.audit.checks, {});
  assert.deepEqual(second.audit.remarks, {});
  assert.equal(second.audit.letter.saved, false);
  assert.ok(!second.audit.letter.content.includes("₹10,000"));
  state = second;
  await change({ action: "letter", content: second.audit.letter.content });
  let secondLetter = state.summary.items.find((i) => i.key === "letter");
  await change(
    { action: "verify", key: "letter", fingerprint: secondLetter.fingerprint },
    422,
  );
  await change({
    action: "letter",
    content:
      "QA Audit & Compliance\nENGAGEMENT LETTER\nAudit QA Industries Private Limited\n42 QA Industrial Estate\nFinancial year 2027-28\n" +
      Array.from(
        { length: 100 },
        (_, i) =>
          "Clause " +
          (i + 1) +
          ": ₹10,000 — Café compliance & review. Long content wraps correctly across A4 pages.",
      ).join("\n"),
  });
  await change({ action: "pdf", kind: "letter" });
  const longPdf = await parsePdf(
    await (
      await context.request.get(base + "/api/files?id=" + state.download.fileId)
    ).body(),
  );
  assert.ok(longPdf.pages > 1);
  assert.ok(longPdf.text.includes("Clause 100"));
  state = await get();
  // Per-facility consent rules, same-name facilities, missing attachments and dates.
  await change({
    action: "policy",
    requiredDocuments: ["PAN Card"],
    requiredConsents: ["cte"],
    reason: "CTE required for each facility for QA.",
  });
  assert.ok(state.summary.blockers.some((b) => b.title.includes("CTE")));
  const facilityId = state.audit.facilities[0].id;
  await change({ action: "add-record", table: "cte", facilityId });
  let consent = state.summary.items.find(
    (i) => i.table === "cte" && i.recordId,
  );
  await change({
    action: "edit",
    key: consent.key,
    values: {
      "Plant name": "Same Name",
      "Plant address": "QA Plant address",
      "Consent number": "QA-CTE-1",
      "Issued date": "2026-01-01",
      "Valid up to": "2025-12-31",
    },
  });
  await change({ action: "replace-file", key: consent.key, fileId: uploadId });
  consent = state.summary.items.find((i) => i.key === consent.key);
  assert.ok(consent.missing.some((m) => m.includes("expired")));
  await change(
    { action: "verify", key: consent.key, fingerprint: consent.fingerprint },
    422,
  );
  await change({
    action: "edit",
    key: consent.key,
    values: { "Valid up to": "2030-12-31" },
  });
  await change({ action: "add-record", table: "cte" });
  const another = state.summary.items
    .filter((i) => i.table === "cte" && i.recordId)
    .at(-1);
  assert.notEqual(another.facilityId, facilityId);
  await change({
    action: "edit",
    key: another.key,
    values: { "Plant name": "Same Name" },
  });
  await change({ action: "remove-record", key: another.key });
  // Removing the entire extra facility is not implicit: its required consent remains a blocker.
  await change({
    action: "policy",
    requiredDocuments: ["PAN Card"],
    requiredConsents: [],
    reason:
      "Consent applicability reviewed; only supplied records require verification.",
  });
  for (const item of [...state.summary.items].filter((i) => i.required)) {
    const latest = state.summary.items.find((i) => i.key === item.key);
    assert.deepEqual(latest.missing, [], latest.title + ": " + latest.missing);
    await change({
      action: "verify",
      key: latest.key,
      fingerprint: latest.fingerprint,
    });
  }
  assert.equal(state.summary.completed, true);
  await change({ action: "complete" });
  assert.equal(state.audit.stage, "onsite");
  state = await get();
  assert.equal(state.audit.stage, "onsite");
  await change({ action: "pdf", kind: "report" });
  const report = await context.request.get(
    base + "/api/files?id=" + state.download.fileId,
  );
  assert.equal(report.status(), 200);
  const reportBytes = await report.body();
  assert.equal(reportBytes.subarray(0, 4).toString(), "%PDF");
  const parsedReport = await parsePdf(reportBytes);
  assert.ok(parsedReport.pages > 1);
  assert.ok(parsedReport.text.includes("COMPLETED"));
  assert.ok(parsedReport.text.includes("Company Overview"));
  assert.ok(
    parsedReport.text.includes("Company reviewed; awaiting verification."),
  );
  const documents = await db
    .collection("files")
    .find({ auditId: firstId, kind: "letter" })
    .toArray();
  assert.equal(documents.length, 1);
  // Read/write permissions remain owner scoped and role checked.
  const userContext = await browser.newContext();
  await userContext.addCookies([
    {
      name: "better-auth.session_token",
      value: memberCookie,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  assert.equal((await userContext.request.get(api)).status(), 404);
  const userClient = await userContext.request.post(base + "/api/clients", {
    headers: { Origin: base },
    data: payload,
  });
  const userId = (await userClient.json()).id;
  clientIds.push(userId);
  const userApi = base + "/api/clients/" + userId + "/audits";
  const userAudit = await (
    await userContext.request.post(userApi, {
      headers: { Origin: base },
      data: { year: "2026-27" },
    })
  ).json();
  assert.equal(
    (
      await userContext.request.patch(userApi, {
        headers: { Origin: base },
        data: { auditId: userAudit.audit.id, revision: 0, action: "complete" },
      })
    ).status(),
    403,
  );
  // Browser: refresh restores state, edit failure preserves text, and viewport layouts.
  await page.goto(
    base + "/clients/" + clientId + "/pre-audit?auditId=" + firstId,
  );
  await page
    .getByRole("heading", { name: "Onsite Audit", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Review pre-audit verification" })
    .click();
  await page
    .getByRole("button", { name: "Client Basic Info", exact: false })
    .click();
  await page.getByText("Changed QA Trade", { exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/preaudit-verified-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Engagement Letter", exact: false })
    .first()
    .click();
  await page.screenshot({
    path: "artifacts/preaudit-letter-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Engagement letter remark" }).click();
  await page
    .getByLabel("Remark", { exact: true })
    .fill("Text preserved after a simulated API outage.");
  await page.route("**/api/clients/*/audits", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Simulated save failure" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save remark" }).click();
  await page.getByText("Simulated save failure", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Remark", { exact: true }).inputValue(),
    "Text preserved after a simulated API outage.",
  );
  await page.unroute("**/api/clients/*/audits");
  await page.getByRole("button", { name: "Save remark" }).click();
  await page.locator(".audit-modal[open]").waitFor({ state: "hidden" });
  await page.reload();
  await page
    .getByRole("button", { name: "Review pre-audit verification" })
    .click();
  await page
    .locator(".letter-validation blockquote")
    .filter({ hasText: "Text preserved after a simulated API outage." })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/preaudit-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.locator(".portal-sidebar.mobile-open").waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator(".portal-sidebar.mobile-open")
    .waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1750, height: 1080 });
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("heading", { name: "Compliance portfolio" }).waitFor();
  assert.ok(
    extensionErrors.length > 0,
    "An external extension error was observed without preventing verification",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS audit/year isolation, permissions, missing documents, consent validation, stable IDs, targeted remarks, concurrent revision protection, replacement invalidation, PDF persistence/deduplication, final stage, refresh, API-failure recovery and responsive browser flow",
  );
} catch (error) {
  if (qaPage) {
    console.log("PAGE ERRORS", JSON.stringify(errors));
    console.log(
      "PAGE BODY",
      (await qaPage.locator("body").innerText()).slice(0, 2000),
    );
    await qaPage
      .screenshot({ path: "artifacts/preaudit-failure.png", fullPage: true })
      .catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  for (const id of [member, admin]) {
    await db.collection("client_audits").deleteMany({ ownerId: id.toString() });
    await db.collection("clients").deleteMany({ ownerId: id.toString() });
    await db.collection("files").deleteMany({ ownerId: id.toString() });
    await db.collection("session").deleteMany({ userId: id });
    await db
      .collection("session_licenses")
      .deleteMany({ userId: id.toString() });
    await db.collection("licenses").deleteMany({ assignedUser: id.toString() });
    await db.collection("user").deleteOne({ _id: id });
  }
  await database.close();
}
