# License management and account profile

## First use

Sign in at http://localhost:9000/login using email OTP. The next step is `/license`. An administrator can open `/licenses` even before activating their own workspace license; ordinary dashboard data stays protected. The user-authorized `it_support@ananttattva.com` account has been assigned the existing Better Auth administrator role.

In `/licenses`, enter the assigned email, user name, desktop device limit (1–10), optional expiry and notes. Copy the full key from the creation result immediately; only its normalized SHA-256 hash is stored. Copy Label in the issued list copies a masked reference and cannot activate a license. Open `/license`, enter the full key and continue to the dashboard. Administrators follow the same dashboard verification requirement. No real licenses are automatically issued by setup or tests.

Verification belongs to the current Better Auth session, lasts at most seven days, and cannot outlive the session or license expiry. New sign-ins require verification again. Five incorrect attempts lock the account's activation for fifteen minutes. Expired, suspended or revoked licenses fail protected dashboard/API checks. Revocation removes existing session verification records. Email and assigned user must match.

## APIs

| Endpoint | Access / purpose |
| --- | --- |
| GET /api/admin/licenses?status=all | Admin, safe masked list; status filtered on server |
| POST /api/admin/licenses | Admin + same-origin, creates license and returns full key once |
| PATCH /api/admin/licenses/:id/revoke | Admin + same-origin, revokes access |
| GET /api/license/user/status | Signed-in user's current verification and assignment |
| POST /api/license/user/activate | Signed-in + same-origin; JSON licenseKey |
| POST /api/license/activate | Desktop: licenseKey, deviceId, optional deviceName/appVersion |
| POST /api/license/validate | Desktop: activationToken, deviceId, optional deviceName/appVersion |

Desktop activation atomically enforces device limits. Web verification does not consume a desktop slot. Desktop activation returns a random opaque token bound to the device; only its hash is stored. Validation rotates the token, so clients must replace their saved token after each successful validation. Tokens expire within thirty days or earlier license expiry. This implements the supplied behavior using opaque tokens, rather than the old project's JWT format; existing desktop clients must use this response contract. Activation/validation have a shared database-backed rate limit of 120 requests per minute.

## Storage and maintenance

`lib/license.ts` owns issuance, status checks, activation leases, device limits and safe response projection. MongoDB collections: licenses, session_licenses, license_attempts and license_rate_limits. Run `node scripts/setup-licenses.mjs` to prepare indexes. Passing an existing email as the final argument explicitly promotes that account to administrator. The setup script loads credentials from ignored `.env.local`; it does not contain keys or passwords.

`/profile` provides personal fields, verified email, private photo upload (PNG/JPEG/WebP, 2 MB maximum), workspace/license details, active session listing, revocation of other sessions, and notification feed preferences. Profile data is account scoped; uploaded avatars are resized to 256px WebP and stored in MongoDB. Email OTP remains the authentication method.

MSME and CTE/CTO tables persist in existing client documents. Row Save saves the current draft, Reset restores the mounted row's last row-save snapshot, and Delete removes a row locally until the draft is saved. Upload attaches a file after saving. Monthly capacity is hourly output × working days × hours, converted from MT to kg when selected.

## Verification

`npm run test:licenses` uses temporary MongoDB users and licenses to verify account assignment, hash-only storage, role checks, new-session enforcement, attempt lock, concurrent desktop limits, token binding/rotation, revocation, expiry, profile persistence, photo upload, session revocation, notification preferences, editable table saves/uploads and production calculation. Browser screenshots are written to ignored `artifacts/`. `npm run test:dashboard` covers dashboard navigation and regressions. QA fixtures are deleted after each run.
