# Pre-audit implementation

The current repository is a Next.js application. The requested client-react and Express/Mongoose paths do not exist here. The implementation extends the existing authenticated Next route and MongoDB storage.

## Data and authorization

- `client_audits` has one unique record per owner, client and financial year, with a separate snapshot, engagement letter, applicability policy, assignment, checks and remarks. The audit ID selects the record. Creating a later year copies company information, not checks, remarks or a custom letter.
- Existing client ownership and active-license checks remain in force. Administrators may verify/configure their own clients. An assigned manager may verify their own accessible clients. Other owners may view their audit but cannot verify, edit verification data or complete it. This does not grant administrators cross-owner access absent from the existing application.
- Source document and row IDs are persisted. Legacy missing IDs are backfilled with compare-and-swap protection. Audit rows have stable record IDs and explicit facility IDs. Legacy facility relationships are never inferred from a shared plant name. Administrators can link a consent to an existing facility in its edit dialog.
- Legacy positional checks and remarks are deliberately not mapped. A legacy engagement letter is imported only for the explicitly matching source financial year, as an unverified draft.
- Saved document recovery first matches stable IDs. Older audit snapshots with independently generated IDs can recover an attachment only when its document type and nonempty certificate number identify exactly one record in both onboarding and the selected audit year. Ambiguous matches are rejected. The existing audit record ID remains unchanged, so checks/remarks never move to another record; changed content still requires verification. The onboarding correction link uses the same rule to focus the corresponding source document.
- Every mutation is allowlisted and revision checked. Checks/remarks use targeted database paths selected from server-generated items. A conflict returns 409 and the UI reloads the latest audit while preserving typed edits for retry.
- Verification identity and timestamps come from the authenticated session/server. Content fingerprints invalidate only affected checks. Material changes reopen a completed pre-audit; no-op edits preserve valid completion.

## Applicability

The existing README/schema make consent and document sections optional. No universal PAN/GST/CIN/EPR requirements are invented. Populated records must be complete before verification. Administrators can require particular document types and CTE/CTO per facility using Audit settings, with a saved reason and approval identity. Empty optional sections are explicitly Not Applicable, not Verified. A supplied MSME record requires its details and certificate. Missing required documents, broken/inaccessible attachments, expired records, invalid contact/date/PIN data and unresolved letter placeholders block verification and completion.

A financial year currently has one audit record, following the new unique index; there was no pre-existing multi-audit/year model in this repository. District/country and separately modeled facility addresses were also absent; registered/communication addresses and consent plant addresses reuse the actual schema. Further industry-specific applicability rules require approved business policy.

## UI and PDFs

The pre-audit page includes client/year history, auditor/company settings, persisted stage state, five status tabs, item-level verification, saved remarks, edit/upload/delete actions, exact blockers and a pending list. Confirmation and editing dialogs are centered. Native dialogs provide focus trapping and Escape behavior. Unsaved letter edits require discard confirmation before navigation and block PDF/verification until saved or canceled.

Engagement PDFs use saved letter text. Validation reports use the same server evaluator as completion, with statuses, missing items, consent details, remarks, verifiers and timestamps. PDFKit generates readable A4 documents with automatic wrapping/page breaks and embedded OFL Noto Sans for currency/special characters. Files are stored in the existing files collection with client/audit/year metadata. Content-addressed IDs avoid duplicate letter versions; changed saved content creates a new version. The engagement document and Tab 1 use the same verification item.

Completing verification persists the Onsite Audit stage, opens its stage panel, and invokes `onComplete` when the component is embedded with a callback. This repository has no onsite/post-audit execution module; those stages cannot be falsely marked complete through these endpoints.

## Verification

Run the local server, then `npm run test:pre-audit`. The integration/browser test uses isolated users and removes its fixtures. It covers owner/role denial, independent years, mandatory missing files, stable IDs/reordering/deletion, consent dates/facility IDs, stale checks after edits/replacement, concurrent requests, final completion/restoration, remark failure recovery, desktop/mobile behavior and PDF content/deduplication. PDF parsing checks saved text, rupees/accented characters, A4 dimensions and long multi-page output.

`node tests/onboarding.mjs` and `npm run test:onboarding-bot` cover existing onboarding and JSON-bot behavior; the former also checks confirmation dialog centering. `npm run build` includes TypeScript verification. Deployed hosting behavior and manual review of jurisdiction-specific policy remain separate from local verification.

Verified in this change: production build/TypeScript passed; the full pre-audit test passed on both the dev server and a separate compiled production server; onboarding and admin JSON-bot regressions passed. Desktop/mobile screenshots were visually reviewed. Hosted deployment, screen-reader-specific manual testing and organization-approved regulatory applicability have not been verified.

The pre-audit route now reuses the existing dashboard navbar/sidebar, including notifications, profile navigation, collapse/mobile controls and unsaved-edit guards. Its accents use the existing forest-green/slate palette. The Verify checklist opens after React commits its dialog, avoiding a nullable/unmounted ref at click time. Browser coverage includes a simulated unrelated extension script exception while asserting that application verification still succeeds. The reported `share-modal.js` was traced locally to the Chrome extension **Screenshot Tool - Screen Capture & Editor**; the extension's files/settings were not changed or its errors suppressed. Disable that extension for localhost to stop its own null-listener error.
