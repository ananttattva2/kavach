import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';

mkdirSync('artifacts', { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, ...(existsSync(edge) ? { executablePath: edge } : {}) });
const base = process.env.QA_BASE_URL || 'http://localhost:9000';
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/login');
  await page.locator('.mosaic-image').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.mosaic-tile').count(), 5);
  assert.equal(await page.locator('.white-login').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'artifacts/login-white-desktop.png' });
  for (const name of ['plastic', 'ewaste', 'battery', 'elv', 'oil']) {
    const tile = page.locator('.mosaic-' + name);
    await tile.hover();
    await page.waitForTimeout(650);
    assert.equal(await tile.locator('.mosaic-image').evaluate(node => Number(getComputedStyle(node).opacity)), 1);
    assert.equal(await tile.evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)');
    const status = await tile.locator('.mosaic-status').textContent();
    assert.ok(status.includes(['plastic', 'ewaste'].includes(name) ? 'AVAILABLE NOW' : 'COMING SOON'));
    await page.screenshot({ path: `artifacts/login-preview-${name}.png` });
  }
  console.log('PASS white layout and all five individual hover previews/statuses');
  await page.mouse.move(10, 10);
  await page.locator('.mosaic-ewaste').focus();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.mosaic-ewaste .mosaic-image').evaluate(node => Number(getComputedStyle(node).opacity)), 1);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.mosaic-ewaste').getAttribute('aria-pressed'), 'true');
  console.log('PASS keyboard preview and selection');
  await page.getByRole('button', { name: 'Need help?' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');

  // Mock only mail/auth responses; these UI checks never send an email.
  let sentTo = '';
  await page.route('**/api/auth/email-otp/send-verification-otp', async route => {
    sentTo = route.request().postDataJSON().email;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.getByRole('textbox', { name: 'Email address' }).fill('ui-check@example.invalid');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('textbox', { name: 'Verification code' }).waitFor();
  assert.equal(sentTo, 'ui-check@example.invalid');
  assert.ok(await page.getByRole('button', { name: /Resend in/ }).isDisabled());
  await page.route('**/api/auth/sign-in/email-otp', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'INVALID_OTP', message: 'Invalid verification code' }) }));
  await page.getByRole('textbox', { name: 'Verification code' }).fill('123456');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.locator('.train-error[role=alert]').waitFor();
  assert.ok((await page.locator('.train-error[role=alert]').innerText()).includes('Invalid verification code'));
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).waitFor();
  console.log('PASS OTP form transitions, resend cooldown, error handling and back navigation (mocked; no email sent)');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(base + '/login');
  await phone.waitForTimeout(1200);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= 390));
  for (const name of ['plastic', 'ewaste', 'battery', 'elv', 'oil']) {
    await phone.locator('.mosaic-' + name).tap();
    assert.equal(await phone.locator('.mosaic-' + name).getAttribute('aria-pressed'), 'true');
  }
  await phone.waitForTimeout(650);
  await phone.screenshot({ path: 'artifacts/login-white-mobile.png', fullPage: true });
  console.log('PASS mobile: no horizontal overflow; all five touch previews');
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const staticPage = await reduced.newPage();
  await staticPage.goto(base + '/login');
  await staticPage.locator('.mosaic-battery').hover();
  assert.equal(await staticPage.locator('.mosaic-battery .mosaic-image').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  assert.deepEqual(errors, []);
  console.log('PASS reduced motion and no browser JavaScript errors');
} finally { await browser.close(); }
