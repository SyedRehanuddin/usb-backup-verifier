// Browser-level audit of the actual hosted-demo UI and HTTP endpoints.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'usb-demo-showcase-'));
const base = 'http://127.0.0.1:8002';
const expected = {
  backup_clean: [5, 0, 0, 0],
  backup_corrupted: [4, 1, 0, 0],
  backup_missing: [4, 0, 1, 0],
  backup_extra: [5, 0, 0, 1],
  backup_mixed: [3, 1, 1, 1],
};
let server;
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

async function start() {
  server = spawn(process.env.SHOWCASE_PYTHON, [path.join(__dirname, 'demo_showcase_server.py')], {
    cwd: root,
    env: {...process.env, DEMO_SHOWCASE_DATA: temp},
    windowsHide: true,
  });
  let log = '';
  server.stdout.on('data', chunk => { log += chunk; });
  server.stderr.on('data', chunk => { log += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Demo server failed: ' + log);
}

async function stop() {
  if (server && server.exitCode === null) {
    const done = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await done;
  }
}

async function choose(page, prefix, label) {
  await page.locator(`#${prefix}-trigger`).click();
  await page.locator(`#${prefix}-listbox [role="option"]`).filter({hasText: label}).click();
}

async function run(page, button, endpoint) {
  const pending = page.waitForResponse(response => response.url().endsWith(endpoint) && response.request().method() === 'POST');
  await page.locator(button).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => !document.querySelector('button[aria-busy="true"]'));
  return response.json();
}

(async () => {
  try {
    await start();
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.mode, 'demo'); checks++;
    const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    const page = await browser.newPage({viewport: {width: 1366, height: 768}});
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.querySelector('#source-folder-name').textContent === 'original_files');
    ok(await page.getByText('Hosted Demo Mode', {exact: true}).isVisible(), 'hosted badge');
    ok(await page.locator('#select-source-button').isHidden(), 'native source button hidden');
    ok(await page.locator('#select-backup-button').isHidden(), 'native backup button hidden');
    ok(await page.locator('input[type="file"]').count() === 0, 'no file inputs');
    await run(page, '#generate-reference-button', '/api/reference/generate-selected');

    for (const [dataset, totals] of Object.entries(expected)) {
      const label = await page.locator(`#backup-demo-select option[value="${dataset}"]`).textContent();
      await choose(page, 'backup-demo', label);
      const result = await run(page, '#verify-backup-button', '/api/verification/run-selected');
      assert.deepEqual(['verified', 'corrupted', 'missing', 'extra'].map(key => result.summary[key]), totals); checks++;
      ok(result.results.some(row => row.relative_path === 'nested/lab_record.bin' && row.status === 'verified'), `${dataset} nested path`);
    }

    await page.getByRole('link', {name: 'Error Lab', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('#lab-backup-name').textContent === 'backup_clean');
    ok(await page.locator('#lab-select-backup-button').isHidden(), 'native lab button hidden');
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
      const result = await run(page, '#lab-run-button', '/api/error-lab/run-selected');
      assert.deepEqual(['verified', 'corrupted', 'missing', 'extra'].map(key => result.summary[key]), totals); checks++;
    }

    await page.getByRole('link', {name: 'Verification', exact: true}).click();
    for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768]]) {
      await page.setViewportSize({width, height});
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('#backup-demo-trigger').scrollIntoViewIfNeeded();
      await page.locator('#backup-demo-trigger').press('Enter');
      const geometry = await page.evaluate(() => {
        const trigger = document.querySelector('#backup-demo-trigger').getBoundingClientRect();
        const menu = document.querySelector('#backup-demo-listbox').getBoundingClientRect();
        return {overflow: document.scrollingElement.scrollWidth > innerWidth, width: Math.abs(trigger.width - menu.width), contained: menu.left >= 0 && menu.right <= innerWidth + 1 && menu.top >= 0 && menu.bottom <= innerHeight + 1};
      });
      ok(!geometry.overflow && geometry.width < 1 && geometry.contained, `responsive demo picker ${width}x${height}`);
      await page.locator('#backup-demo-trigger').press('Escape');
    }
    await browser.close();

    const chrome = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const chromePage = await chrome.newPage({viewport: {width: 1366, height: 768}});
    await chromePage.goto(base);
    await chromePage.waitForLoadState('networkidle');
    await chromePage.waitForFunction(() => document.querySelector('#source-folder-name').textContent === 'original_files');
    ok(await chromePage.getByText('Hosted Demo Mode', {exact: true}).isVisible(), 'Chrome hosted mode');
    ok(await chromePage.locator('input[type="file"]').count() === 0, 'Chrome no file inputs');
    await choose(chromePage, 'backup-demo', 'Clean Backup');
    ok(await chromePage.locator('#backup-folder-name').textContent() === 'backup_clean', 'Chrome demo backup selection');
    await chrome.close();
    console.log(`Demo showcase audit: ${checks} checks passed`);
  } finally {
    await stop();
    fs.rmSync(temp, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
