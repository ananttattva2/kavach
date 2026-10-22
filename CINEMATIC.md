# Cinematic KAVACH experience

## Routes and port

- `npm run dev` / `npm start`: http://localhost:9000
- `/login`: train-window login with real HTML form and the existing Graph email OTP flow.
- Successful OTP sign-in redirects to protected `/modules`.
- `/dashboard` stays the existing protected client onboarding workspace. Its brand links back to `/modules`.
- Plastic and E-Waste link to the existing workspace as `/dashboard?module=plastic` and `/dashboard?module=ewaste`. The current project has one shared onboarding dashboard, not separate waste-processing dashboards. The query keeps the selected module in the URL for future module-specific behavior.
- Battery, ELV and Used Oil have disabled, labelled Upcoming controls.

## Animation

`components/module-experience.tsx` uses one GSAP timeline and one ScrollTrigger pin. Five viewport-heights of scroll control five modules. Each stage includes a 62% readable hold and 38% overlapping transition. Outgoing architecture zooms forward; transparent foliage moves faster; the incoming scene dissolves underneath the synchronized copy transition. The timeline reverses with scroll and releases to a normal footer section.

Lenis runs with `autoRaf: false` through the GSAP ticker only. Unmount removes its callback, scroll listener, matchMedia contexts and ScrollTriggers, and destroys Lenis. Image decode and font readiness refresh measurements; ScrollTrigger handles resize. Desktop requires width > 900px and no reduced-motion preference. All other configurations use normal document scrolling and stacked full-size scenes without pinning or Lenis. No JavaScript also leaves scenes stacked.

## Assets

All final assets are local WebP files in `public/images/` (about 1.9 MB total). The first scene is high-priority; later images are prepared eagerly at low priority. `lib/modules.ts` contains the scene paths, copy, status and destination for easy replacement.

- `login-train.webp`: generated train interior and Alpine landscape, no baked-in form or text.
- `plastic.webp`, `ewaste.webp`, `battery.webp`, `elv.webp`, `oil.webp`: individual generated cinematic recycling scenes, consistent forest/charcoal palette.
- `foreground.webp`: actual alpha-transparent botanical edge layer. Shared across all five scenes to maintain art direction.

The supplied chat attachment was a login screenshot; no reference video or separate scene assets were available in the repository. The implementation approximates the described continuous visual style rather than a frame-exact video match. These are layered photographic images, not actual 3D geometry: camera-like movement is 2.5D. For true camera orbit or object reveals, replace/augment with optimized GLB models and scene-specific isolated recycling material foregrounds. No Three.js runtime is loaded unnecessarily.

`prepare-images.cjs` is an optional local asset conversion helper; its source mapping is ignored because it points to the original generated image files on this machine. The committed WebP files are sufficient to build and run the app.

## Browser verification

Run the app on port 9000, then `npm run test:cinematic` in a second terminal. Requires `.env.local` and Atlas access. Tests use installed Microsoft Edge on Windows, otherwise Playwright Chromium. A temporary isolated QA account, session and draft are created and always removed in `finally`; no OTP email is sent. Session secrets are never printed or written to artifacts.

Checks cover desktop forward/reverse scroll, layer transform differences, indicator navigation, disabled upcoming modules, pinned-section release, preserved dashboard destination, protected draft save/read, mobile stacking and no overflow, reduced-motion native scrolling, and browser JavaScript errors. Screenshots are saved to ignored `artifacts/`. Actual OTP delivery still requires entering a real recipient email at login.
