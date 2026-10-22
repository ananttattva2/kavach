import { chromium } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';
import { createHmac, randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import { setServers as setPromiseServers } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';

process.loadEnvFile('.env.local');
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS.split(',');
  setServers(servers); setPromiseServers(servers);
}
const base = process.env.QA_BASE_URL || 'http://localhost:9000';
const database = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const db = database.db(process.env.MONGODB_DB || 'kavach');
const userId = new ObjectId();
const token = randomBytes(32).toString('hex');
const cookie = encodeURIComponent(token + '.' + createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64'));
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let browser;
const errors = [];
const testClientIds = [];

try {
  // A temporary isolated QA session verifies protected pages without sending an OTP email.
  await db.collection('user').insertOne({ _id: userId, name: 'Cinematic QA', email: `qa-${userId}@example.invalid`, emailVerified: true, role: 'user', banned: false, createdAt: new Date(), updatedAt: new Date() });
  await db.collection('session').insertOne({ _id: new ObjectId(), userId, token, expiresAt: new Date(Date.now() + 1200000), createdAt: new Date(), updatedAt: new Date(), ipAddress: '127.0.0.1', userAgent: 'Kavach QA' });
  browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/login');
  await page.locator('.train-backdrop').evaluate(img => img.decode());
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/login-desktop.png' });
  assert.equal(await page.title(), 'Kavach — Client Workspace');
  await page.getByRole('button', { name: 'Need help?' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await desktop.addCookies([{ name: 'better-auth.session_token', value: cookie, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const session = await page.request.get(base + '/api/auth/get-session');
  assert.equal(session.status(), 200);
  assert.ok((await session.json())?.user, 'QA session should authenticate');
  await page.goto(base + '/modules');
  await page.locator('.is-pinned').waitFor();
  await page.locator('.scene-image img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.pin-spacer').count(), 1, 'Exactly one pinned viewport');
  const modules = ['plastic', 'ewaste', 'battery', 'elv', 'oil'];
  const viewport = page.viewportSize().height;
  for (let i = 0; i < 5; i++) {
    await page.evaluate(y => window.scrollTo(0, y), viewport * (i + .2));
    await page.waitForTimeout(1700);
    assert.equal(await page.locator('.module-navigation [aria-current="step"]').innerText().then(t => t.trim().slice(0, 2)), `0${i + 1}`);
    const activeScene = page.locator(`[data-module="${modules[i]}"]`);
    assert.equal(await activeScene.getAttribute('aria-hidden'), 'false');
    const alpha = await activeScene.evaluate(node => Number(getComputedStyle(node).opacity));
    assert.ok(alpha > .95, 'Hold phase must be fully visible');
    if (i < 2) assert.equal(await activeScene.getByRole('link', { name: 'Access Dashboard' }).getAttribute('href'), `/dashboard?module=${modules[i]}`);
    else assert.ok(await activeScene.getByRole('button', { name: /upcoming/i }).isDisabled());
    await page.screenshot({ path: `artifacts/module-${modules[i]}.png` });
  }
  console.log('PASS forward scroll: all five hold phases, active indicators, CTAs and upcoming states');
  await page.evaluate(y => window.scrollTo(0, y), viewport * .4);
  await page.waitForTimeout(1700);
  assert.equal(await page.locator('[data-module="plastic"]').getAttribute('aria-hidden'), 'false');
  const imageTransform = await page.locator('[data-module="plastic"] .scene-image').evaluate(el => getComputedStyle(el).transform);
  const foregroundTransform = await page.locator('[data-module="plastic"] .scene-foreground').evaluate(el => getComputedStyle(el).transform);
  assert.notEqual(imageTransform, foregroundTransform, 'Layers must move at different speeds');
  console.log('PASS reverse scroll and independent depth transforms');
  assert.ok((await page.locator('.cinema-header').boundingBox()).y >= -1, 'Header stays with the pinned viewport');
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.pin-spacer').count(), 0, 'Pin must clean up when resizing to mobile');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.pin-spacer').count(), 1, 'Exactly one pin is restored on desktop resize');
  console.log('PASS responsive resize and animation cleanup');
  await page.locator('.module-navigation button').nth(1).click();
  await page.waitForTimeout(2400);
  assert.equal(await page.locator('[data-module="ewaste"]').getAttribute('aria-hidden'), 'false');
  console.log('PASS module indicator navigation');
  await page.evaluate(y => window.scrollTo(0, y), viewport * 5.65);
  await page.waitForTimeout(1800);
  assert.ok((await page.locator('.cinema-viewport').boundingBox()).y < -100, 'Pinned viewport must release');
  await page.locator('#module-end').getByRole('link', { name: 'Open client workspace' }).click();
  await page.waitForURL('**/dashboard');
  assert.ok(await page.getByText('A great start, for every client.').isVisible());
  console.log('PASS natural release and existing dashboard destination');

  // Verify a real save/read boundary for this isolated account.
  const payload = { status: 'draft', basic: { 'Client legal name': 'Cinematic QA — disposable' }, address: {}, sameAddress: false, documents: [], tables: {}, plantCount: 1 };
  const saved = await page.request.post(base + '/api/clients', { headers: { Origin: base }, data: payload });
  assert.equal(saved.status(), 200);
  testClientIds.push((await saved.json()).id);
  const records = await (await page.request.get(base + '/api/clients')).json();
  assert.ok(records.some(record => record.id === testClientIds[0]));
  console.log('PASS existing protected draft save and read');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.addCookies([{ name: 'better-auth.session_token', value: cookie, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(base + '/login');
  await phone.locator('.train-backdrop').evaluate(img => img.decode());
  await phone.waitForTimeout(1000);
  await phone.screenshot({ path: 'artifacts/login-mobile.png' });
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.goto(base + '/modules');
  assert.equal(await phone.locator('.pin-spacer').count(), 0);
  const positions = await phone.locator('.waste-scene').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().top));
  assert.ok(positions.every((y, index) => !index || y > positions[index - 1] + 500), 'Mobile scenes should be stacked');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.screenshot({ path: 'artifacts/modules-mobile.png', fullPage: true });
  console.log('PASS mobile: lightweight stacked scenes, no pin, no horizontal overflow');

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await reduced.addCookies([{ name: 'better-auth.session_token', value: cookie, url: base, httpOnly: true, sameSite: 'Lax' }]);
  const staticPage = await reduced.newPage();
  await staticPage.goto(base + '/modules');
  assert.equal(await staticPage.locator('.pin-spacer').count(), 0);
  const visible = await staticPage.locator('.waste-scene').evaluateAll(nodes => nodes.every(el => getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).position === 'relative'));
  assert.ok(visible, 'All reduced-motion scenes must remain readable');
  console.log('PASS reduced motion: static readable scenes, native scrolling');
  assert.deepEqual(errors, [], 'Browser should have no JavaScript errors');
  console.log('PASS no browser JavaScript errors');
} finally {
  await browser?.close();
  await db.collection('clients').deleteMany({ ownerId: userId.toString() });
  await db.collection('session').deleteMany({ userId });
  await db.collection('user').deleteOne({ _id: userId });
  await database.close();
  console.log('Temporary QA user, session and draft removed.');
}
