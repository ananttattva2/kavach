# KAVACH dashboard and onboarding

## Flow

Sign-in opens `/license`; a verified session continues to `/dashboard`. `/modules` redirects to `/dashboard`; the former cinematic landing is no longer in the active user journey. The white login and module preview gallery remain available at `/login`.

- Dashboard: live client totals and waste-stream counts, derived from MongoDB and scoped to the signed-in account. No demo counts are inserted. Legacy client records created before classification are counted as Plastic / PIBO, matching the original PIBO-only onboarding form.
- Add Client: choose Plastic, E-Waste, Battery, ELV or Used Oil from the illustrated workspace cards. Battery, ELV and Used Oil remain unavailable.
- Plastic categories: PIBO, PWP, Paper, Metal, Glass and Sanitary Waste.
- E-Waste categories: Producer, Recycler, Manufacturer and Refurbisher.
- Continue Registration / Proceed opens the existing four-tab onboarding form. The selected `wasteStream` and `registrationCategory` are validated and stored with the client document. Existing forms, uploads and draft/submission handling are preserved.

## Sidebar

Dashboard, All Client, KAVACH Audit (five waste streams), Client Connect, and Administration (Admin Dashboard, KPI Dashboard, Company Name, Login Logs, Licenses). Groups expand/collapse; desktop sidebar collapses to icons; mobile uses a dismissible navigation drawer. Active states follow the URL, so navigation supports browser back/forward and refresh.

All Client searches saved records, exports CSV and opens records for editing. Client Connect displays saved authorised/coordinating contacts with mailto/tel links. Licenses opens license issuance and revocation for administrators; members see their own license status.

Admin Dashboard, KPI Dashboard, Company Name and Login Logs require an existing Better Auth `admin` role. Regular accounts see an access-required page; the administration API independently returns 403. Administrator promotion is an explicit maintenance operation; the requested support account was promoted with user authorization. Login Logs shows recent session creation records, not failed login attempts. Administration response projections exclude session tokens. Profile settings opens `/profile`, with personal information, photo upload, session controls and notification preferences. The notification dropdown derives updates from actual client records.

## UI and assets

`components/dashboard-workspace.tsx` and its CSS implement the new shell, sidebar and dashboard pages. `components/client-onboarding.tsx` reuses the original onboarding flow inside this shell. `lib/workspace-data.ts` defines stream and category content. Thirteen new local WebP assets provide transparent workspace object illustrations and category photography, plus bright PWP and recycler images. All images remain replaceable under `public/images/`.

Page changes and expanding navigation use Motion. Card/image interactions animate transforms and opacity. Reduced motion disables transitions and page movement. No new animation runtime was needed beyond existing dependencies.

## Data and verification

- `/api/dashboard/summary`: authenticated per-account aggregation, including legacy classifications.
- `/api/administration`: admin-only aggregate counts, company names and recent sessions.
- `/api/profile`: authenticated, origin-checked personal details and preferences; display-name updates use Better Auth.
- `/api/clients`: existing owner-scoped saving, extended with validated classification fields. Upcoming/invalid category combinations are rejected.

Run `npm run build`, then `npm start` (port 9000). In a second terminal, run `npm run test:dashboard`. Browser tests use temporary member/admin accounts and client records, always cleaned up in `finally`. Tests cover redirects, totals, all ten categories, MongoDB save/read, client search/edit, administrator boundaries, session-token exclusion, mobile sidebar and reduced motion. The login redirect UI check mocks OTP responses and sends no email. Screenshots are saved to ignored `artifacts/`.

## Reference refinements and blob buttons

The dashboard now uses a compact welcome banner, orange live counts and illustrated client/waste cards. Workspace selection places the Dashboard return action beside the date in the welcome banner. The supplied KAVACH logo was adapted into a transparent forest-green asset at `public/images/kavach-logo.webp` and is rendered by the shared `KavachBrand` component, including login and sidebar branding.

`components/ui/blob-button.tsx` converts the supplied gooey-button example into a reusable React component. Four staggered blobs rise on hover or visible keyboard focus. A single SVG goo filter is defined once in the root layout. The effect is confined to buttons; disabled Upcoming buttons remain static and reduced motion removes transitions. Active dashboard, workspace and registration actions share this treatment. `portfolio-clients.webp` supplies the new client-record illustration; the existing stream illustrations are reused.

Dashboard browser verification additionally checks the four-blob hover transform, disabled availability states, reduced-motion behavior and single shared SVG filter.

## Notifications, counting and scrolling

The bell now opens an anchored, nonmodal notification dropdown with All/Unread tabs, grouped timestamps, unread indicators, mark-all-read, individual item navigation and a full notification page. It has no fullscreen backdrop; Escape, the close control and outside clicks dismiss it. The profile dialog remains modal and is centered explicitly.

`/api/notifications` derives activity from the account's latest 30 client records and the account welcome event. It includes registration creation, unfinished drafts and uploaded documents; it does not fabricate scheduled audits or report-ready events. Per-account read IDs persist in the MongoDB `notification_state` collection. The write endpoint validates origin and session. Onboarding saves invalidate notification data; visible activity refreshes every minute.

`AnimatedCount` animates real portfolio totals through intermediate values when visible and whenever totals change. It stops previous animations on changes/unmount, displays accurate zero values and respects reduced motion. Dashboard accents, counts, links and the Add Client action use forest green and mint instead of orange.

The topbar stays sticky during document scrolling. `DashboardScroll` runs Lenis through a single GSAP ticker callback with `autoRaf: false`; dropdown, sidebar, dialog and table scrolling remain native. Touch scrolling is native. Route changes reset scroll position; unmount removes the ticker and destroys Lenis. Reduced motion uses native scrolling without the Lenis controller.

Browser checks cover dropdown anchoring and lack of a modal backdrop, read persistence, filters, notification-item/full-page navigation, count interpolation, exact final values, green palette, mobile smooth wheel scrolling and sticky navigation, plus the existing registration/database regression suite.

See [LICENSES.md](LICENSES.md) for license issuance, session verification, desktop activation and bootstrap administration. MSME and CTE/CTO sections use `components/registration-table.tsx` with mint table headers, editable rows, uploads, save/reset/delete actions and calculated monthly production capacity.
