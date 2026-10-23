# Kavach

Next.js 16 / React 19 client onboarding workspace for Anant Tattva.

## Run

1. `npm install`
2. Configure `.env.local` using `.env.example` (credentials are already configured locally).
3. `npm run dev`, then visit http://localhost:9000.

`npm run build` creates a production build. `npm run typecheck` checks TypeScript. `node scripts/check-services.mjs` verifies MongoDB connectivity and Microsoft Graph credentials without sending mail.

## Included

Passwordless email OTP using Better Auth and Microsoft Graph; five-minute, hashed, six-digit codes, attempt limits, database rate limiting, cookie sessions and Better Auth roles. Responsive animated login using GSAP and Motion. Protected dashboard, sidebar, overview and searchable client directory. Four onboarding tabs matching the supplied field groups, repeatable MSME / CTE / CTO / capacity / regulations entries, document uploads, draft saving, submission and editing saved records. MongoDB stores records and file bytes, scoped to the signed-in user. Uploads accept PDF/JPG/PNG up to 5 MB.

All successfully verified email addresses can create their own isolated workspace account. Better Auth provides user/admin roles; no administrator is automatically assigned. Client access remains scoped to the signed-in account. Administrators manage licenses at `/licenses`; users verify their assigned key after sign-in before entering the dashboard. See [LICENSES.md](LICENSES.md).

## Configuration

Atlas must allow the application host IP and the database user must have read/write permission for `kavach`. Microsoft Entra application requires admin-consented application `Mail.Send` permission and access to the configured sender mailbox. Delivery must be verified by signing in with a real recipient email.

Production: set `BETTER_AUTH_URL` to the deployed HTTPS origin, keep `BETTER_AUTH_SECRET` stable, and configure all variables in the hosting provider. Deploy on a Node.js platform supporting Next.js, such as Vercel. Secrets and local environment files are excluded from Git.

Drafts allow incomplete fields. Submission requires company identity, authorised contact and registered address fields. Document files and consent sections are optional. Saved records are isolated by account.

Local DNS note: this environment required DNS_SERVERS=1.1.1.1,8.8.8.8 for Atlas SRV records. Both Node DNS resolvers are configured only when this variable is set. Remove it if your hosting network uses its own DNS policy.

Verification: production build and TypeScript passed; MongoDB ping passed; Graph credentials and Mail.Send permission verified; /login returned 200, /dashboard redirected signed-out users, protected APIs returned 401, and /api/auth/get-session returned 200 with null for a signed-out visitor. Dashboard, login gallery, license activation, profile and onboarding browser checks are included under `tests/`. Actual OTP inbox delivery requires a real recipient sign-in.


See [CINEMATIC.md](CINEMATIC.md) for the cinematic module experience, assets and browser verification.

Local sign-in: use http://localhost:9000/login. When BETTER_AUTH_URL is a loopback URL, explicit localhost/127.0.0.1 origins on ports 3000 and 9000 are trusted for compatibility with older local tabs. Production URLs trust only their configured origin. Run node tests/auth-origins.mjs with the server running to verify this boundary without sending mail.

Current signed-in flow: see [DASHBOARD.md](DASHBOARD.md) for the direct dashboard, sidebar, waste-stream registration categories and verification.

Admin JSON assistant: administrators and super admins see **Fill with JSON** above the onboarding steps. Download the template or use the current form template, paste the completed JSON, click **Validate JSON**, then **Fill all steps**. Review the form and click **Submit onboarding** to use the existing confirmation and pre-audit flow. Supplied fields update the current client; omitted fields, existing table rows and uploaded files remain in place. Table rows match by position. JSON supports document certificate numbers and dates; upload the actual files in the form. Record IDs, status, waste stream and registration category cannot be changed through the import. Run `npm run test:onboarding-bot` against the local server for the admin/user browser checks.

Pre-audit verification, audit/year isolation, engagement and validation PDFs, permissions, migration behavior and acceptance checks: see [PRE_AUDIT.md](PRE_AUDIT.md).
