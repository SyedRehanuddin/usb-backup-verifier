// End-to-end audit for the backend-independent static hosted demo.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const base = process.env.STATIC_DEMO_BASE || 'http://127.0.0.1:8004';
const expected = {
  'Clean Backup': [5, 0, 0, 0],
  'Corrupted Backup': [4, 1, 0, 0],
  'Missing File Backup': [4, 0, 1, 0],
  'Extra File Backup': [5, 0, 0, 1],
  'Mixed Issues Backup': [3, 1, 1, 1],
};
let server;
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

async function start() {
  if (process.env.STATIC_DEMO_BASE) return;
  server = spawn(process.env.SHOWCASE_PYTHON, ['-m', 'http.server', '8004', '--bind', '127.0.0.1', '--directory', 'static_demo'], {cwd: root, windowsHide: true});
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Static server did not start.');
}

async function stop() {
  if (server && server.exitCode === null) {
    const done = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await done;
  }
}

async function choose(page, prefix, label) {
  const trigger = page.locator(`#${prefix}-trigger`);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.locator(`#${prefix}-listbox [role="option"]`).filter({hasText: label}).click();
}

async function runButton(page, selector) {
  await page.locator(selector).click();
  await page.waitForFunction(selector => !document.querySelector(selector).matches('[aria-busy="true"]'), selector);
}

async function summary(page, prefix = 'summary-') {
  return Promise.all(['verified', 'corrupted', 'missing', 'extra'].map(async status => Number(await page.locator(`#${prefix}${status}${prefix === 'summary-' ? '-count' : ''}`).textContent())));
}

async function edgeAudit() {
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page = await browser.newPage({viewport: {width: 1366, height: 768}, acceptDownloads: true});
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(`${base}/#verification`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#source-folder-name').textContent === 'original_files');
  ok(await page.locator('#source-reference-status').textContent() === 'Ready', 'automatic trusted reference');
  ok(await page.locator('input[type="file"]').count() === 0, 'no file inputs');

  for (const [label, totals] of Object.entries(expected)) {
    await choose(page, 'backup-demo', label);
    await runButton(page, '#verify-backup-button');
    assert.deepEqual(await summary(page), totals); checks += 1;
    ok(await page.locator('#verification-results-body').getByText('nested/lab_record.bin', {exact: true}).count() === 1, `${label} nested result`);
  }

  for (const [label, expectedRows] of [['All Files', 6], ['Verified', 3], ['Corrupted', 1], ['Missing', 1], ['Extra', 1]]) {
    await choose(page, 'results-filter', label);
    assert.equal(await page.locator('#verification-results-body tr').count(), expectedRows); checks += 1;
  }

  const currentCsv = page.waitForEvent('download');
  await page.locator('#export-csv-button').click();
  const currentDownload = await currentCsv;
  const currentText = fs.readFileSync(await currentDownload.path(), 'utf8');
  ok(currentText.includes('Verification ID') && currentText.includes('nested/lab_record.bin'), 'verification CSV');

  await page.getByRole('link', {name: 'History', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#history-total-count').textContent === '5');
  await page.locator('#history-search-input').fill('mixed');
  ok((await page.locator('#history-result-count').textContent()).startsWith('1 of 5'), 'history search');
  await page.locator('#history-search-input').fill('');
  await choose(page, 'history-status', 'Issues');
  ok(Number((await page.locator('#history-result-count').textContent()).split(' ')[0]) === 4, 'history status filter');
  await choose(page, 'history-status', 'All');
  await choose(page, 'history-sort', 'Oldest first');
  ok(await page.locator('.history-item h4').first().textContent() === 'backup_clean', 'history oldest sort');
  await page.getByRole('button', {name: 'View Details'}).first().click();
  ok(await page.locator('#history-detail-panel').isVisible(), 'history details');
  const detailCsv = page.waitForEvent('download');
  await page.locator('#history-export-csv-button').click();
  const detailDownload = await detailCsv;
  ok(fs.readFileSync(await detailDownload.path(), 'utf8').includes('File Name'), 'history CSV');
  await page.locator('#history-detail-close').click();

  await page.getByRole('link', {name: 'Error Lab', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#lab-backup-name').textContent === 'backup_clean');
  const labScenarios = [
    ['modify-byte', 'image.png', [4, 1, 0, 0]],
    ['append-data', 'notes.txt', [4, 1, 0, 0]],
    ['truncate-file', 'config.json', [4, 1, 0, 0]],
    ['remove-file', 'nested/lab_record.bin', [4, 0, 1, 0]],
    ['add-extra', null, [5, 0, 0, 1]],
  ];
  for (const [method, target, totals] of labScenarios) {
    await page.locator(`input[name="lab-simulation"][value="${method}"]`).check();
    if (target) {
      await page.locator('#lab-target-trigger').click();
      await page.getByRole('option', {name: target, exact: true}).click();
    }
    await runButton(page, '#lab-run-button');
    assert.deepEqual(await summary(page, 'lab-summary-'), totals); checks += 1;
    ok(await page.locator('#lab-result-badge').textContent() === 'Expected result detected', `${method} detected`);
  }

  for (const route of ['verification', 'error-lab', 'history', 'about']) {
    await page.goto(`${base}/#${route}`);
    await page.reload();
    await page.waitForFunction(route => !document.querySelector(`#${route}-view`).hidden, route);
    checks += 1;
  }

  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768], [390, 844]]) {
    await page.setViewportSize({width, height});
    await page.goto(`${base}/#verification`);
    await page.waitForFunction(() => document.querySelector('#source-reference-status').textContent === 'Ready');
    ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `no overflow ${width}`);
  }

  await page.getByRole('link', {name: 'History', exact: true}).click();
  await page.getByRole('button', {name: 'Clear History'}).click();
  await page.locator('#history-clear-confirm').click();
  await page.waitForFunction(() => document.querySelector('#history-total-count').textContent === '0');
  ok((await page.evaluate(() => localStorage.length)) === 0, 'history clear');
  ok(errors.length === 0, `console errors: ${errors.join('; ')}`);
  ok(requests.every(url => url.startsWith(base) && !url.includes('/api/')), 'static-only requests');
  await browser.close();
}

async function chromeAudit() {
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 1366, height: 768}});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${base}/#verification`);
  await page.waitForFunction(() => document.querySelector('#source-reference-status').textContent === 'Ready');
  await choose(page, 'backup-demo', 'Clean Backup');
  await runButton(page, '#verify-backup-button');
  assert.deepEqual(await summary(page), [5, 0, 0, 0]); checks += 1;
  ok(errors.length === 0, 'Chrome console');
  await browser.close();
}

(async () => {
  try {
    await start();
    await edgeAudit();
    await chromeAudit();
    console.log(`Static demo audit: ${checks} checks passed`);
  } finally {
    await stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
