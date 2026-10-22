# KAVACH dashboard and onboarding

## Flow

Sign-in redirects directly to `/dashboard`. `/modules` redirects to `/dashboard`; the former cinematic landing is no longer in the active user journey. The white login and module preview gallery remain available at `/login`.

- Dashboard: live client totals and waste-stream counts, derived from MongoDB and scoped to the signed-in account. No demo counts are inserted. Legacy client records created before classification are counted as Plastic / PIBO, matching the original PIBO-only onboarding form.
- Add Client: choose Plastic, E-Waste, Battery, ELV or Used Oil from the illustrated workspace cards. Battery, ELV and Used Oil remain unavailable.
- Plastic categories: PIBO, PWP, Paper, Metal, Glass and Sanitary Waste.
- E-Waste categories: Producer, Recycler, Manufacturer and Refurbisher.
- Continue Registration / Proceed opens the existing four-tab onboarding form. The selected `wasteStream` and `registrationCategory` are validated and stored with the client document. Existing forms, uploads and draft/submission handling are preserved.

## Sidebar

Dashboard, All Client, KAVACH Audit (five waste streams), Client Connect, and Administration (Admin Dashboard, KPI Dashboard, Company Name, Login Logs, Licenses). Groups expand/collapse; desktop sidebar collapses to icons; mobile uses a dismissible navigation drawer. Active states follow the URL, so navigation supports browser back/forward and refresh.

All Client searches saved records, exports CSV and opens records for editing. Client Connect displays saved authorised/coordinating contacts with mailto/tel links. Licenses lists certificates uploaded to the account's client documents.

Admin Dashboard, KPI Dashboard, Company Name and Login Logs require an existing Better Auth `admin` role. Regular accounts see an access-required page; the administration API independently returns 403. No existing account is promoted automatically. Login Logs shows recent session creation records, not failed login attempts. Administration response projections exclude session tokens. Profile settings saves the account display name and provides sign out. The notification panel shows actual unfinished draft count.

## UI and assets

`components/dashboard-workspace.tsx` and its CSS implement the new shell, sidebar and dashboard pages. `components/client-onboarding.tsx` reuses the original onboarding flow inside this shell. `lib/workspace-data.ts` defines stream and category content. Thirteen new local WebP assets provide transparent workspace object illustrations and category photography, plus bright PWP and recycler images. All images remain replaceable under `public/images/`.

Page changes and expanding navigation use Motion. Card/image interactions animate transforms and opacity. Reduced motion disables transitions and page movement. No new animation runtime was needed beyond existing dependencies.

## Data and verification

- `/api/dashboard/summary`: authenticated per-account aggregation, including legacy classifications.
- `/api/administration`: admin-only aggregate counts, company names and recent sessions.
- `/api/profile`: authenticated, origin-checked display-name updates through Better Auth.
- `/api/clients`: existing owner-scoped saving, extended with validated classification fields. Upcoming/invalid category combinations are rejected.

Run `npm run build`, then `npm start` (port 9000). In a second terminal, run `npm run test:dashboard`. Browser tests use temporary member/admin accounts and client records, always cleaned up in `finally`. Tests cover redirects, totals, all ten categories, MongoDB save/read, client search/edit, administrator boundaries, session-token exclusion, mobile sidebar and reduced motion. The login redirect UI check mocks OTP responses and sends no email. Screenshots are saved to ignored `artifacts/`.

## Reference refinements and blob buttons

The dashboard now uses a compact welcome banner, orange live counts and illustrated client/waste cards. Workspace selection places the Dashboard return action beside the date in the welcome banner. The supplied KAVACH logo was adapted into a transparent forest-green asset at `public/images/kavach-logo.webp` and is rendered by the shared `KavachBrand` component, including login and sidebar branding.

`components/ui/blob-button.tsx` converts the supplied gooey-button example into a reusable React component. Four staggered blobs rise on hover or visible keyboard focus. A single SVG goo filter is defined once in the root layout. The effect is confined to buttons; disabled Upcoming buttons remain static and reduced motion removes transitions. Active dashboard, workspace and registration actions share this treatment. `portfolio-clients.webp` supplies the new client-record illustration; the existing stream illustrations are reused.

Dashboard browser verification additionally checks the four-blob hover transform, disabled availability states, reduced-motion behavior and single shared SVG filter.
