# KAVACH experience

The active signed-in experience is now the dashboard described in [DASHBOARD.md](DASHBOARD.md). Successful login goes directly to `/dashboard`; `/modules` redirects there. The previous cinematic component and its assets are retained as unused source, with no active route rendering it.

The white login retains its five-module hover, focus and touch preview gallery. Run `npm run test:login` for focused gallery and OTP-form UI checks. The former `test:cinematic` command now runs the dashboard regression suite for compatibility.
