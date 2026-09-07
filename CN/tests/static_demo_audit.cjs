// End-to-end audit for the backend-independent static hosted application.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const base = process.env.STATIC_DEMO_BASE || 'http://127.0.0.1:8004';
const datasetPaths = {
  original_files: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_clean: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_corrupted: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_missing: ['attendance.csv', 'config.json', 'nested/lab_record.bin', 'notes.txt'],
  backup_extra: ['attendance.csv', 'config.json', 'extra_file.txt', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_mixed: ['attendance.csv', 'config.json', 'extra_file.txt', 'nested/lab_record.bin', 'notes.txt'],
};
const expected = {
  backup_clean: [5, 0, 0, 0], backup_corrupted: [4, 1, 0, 0],
  backup_missing: [4, 0, 1, 0], backup_extra: [5, 0, 0, 1], backup_mixed: [3, 1, 1, 1],
};
const datasets = Object.fromEntries(Object.entries(datasetPaths).map(([name, paths]) => [name,
  Object.fromEntries(paths.map(relativePath => [relativePath,
    fs.readFileSync(path.join(root, 'static_demo', 'demo_data', name, ...relativePath.split('/'))).toString('base64')]))
]));
let server;
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };

async function start() {
  if (process.env.STATIC_DEMO_BASE) return;
  server = spawn(process.env.SHOWCASE_PYTHON, ['-m', 'http.server', '8004', '--bind', '127.0.0.1', '--directory', 'static_demo'], {cwd: root, windowsHide: true});
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await new Promise(resolve => {
      const request = http.get(base, response => { response.resume(); resolve(response.statusCode === 200); });
      request.on('error', () => resolve(false));
    });
    if (ready) return;
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

async function installPickerMock(page) {
  await page.addInitScript(({fixtures}) => {
    function bytes(base64) {
      const raw = atob(base64);
      return Uint8Array.from(raw, character => character.charCodeAt(0));
    }
    function directory(name, node) {
      return {kind: 'directory', name, async *entries() {
        for (const [entryName, entry] of Object.entries(node)) {
          if (entry && typeof entry === 'object') yield [entryName, directory(entryName, entry)];
          else yield [entryName, {kind: 'file', name: entryName, async getFile() {
            const content = bytes(entry);
            return {name: entryName, async arrayBuffer() { return content.buffer.slice(0); }};
          }}];
        }
      }};
    }
    function tree(flat) {
      const result = {};
      for (const [relativePath, content] of Object.entries(flat)) {
        const parts = relativePath.split('/');
        const filename = parts.pop();
        let current = result;
        for (const part of parts) current = current[part] ||= {};
        current[filename] = content;
      }
      return result;
    }
    window.__nextFolder = null;
    window.__pickerError = null;
    window.showDirectoryPicker = async () => {
      if (window.__pickerError) {
        const name = window.__pickerError;
        window.__pickerError = null;
        throw new DOMException(name === 'AbortError' ? 'Cancelled' : 'Denied', name);
      }
      const name = window.__nextFolder;
      window.__nextFolder = null;
      if (!name || !fixtures[name]) throw new DOMException('Cancelled', 'AbortError');
      return directory(name, tree(fixtures[name]));
    };
  }, {fixtures: datasets});
}

async function selectFolder(page, button, name, displaySelector) {
  await page.evaluate(folder => { window.__nextFolder = folder; }, name);
  await page.locator(button).click();
  await page.waitForFunction(({selector, value}) => document.querySelector(selector).textContent === value, {selector: displaySelector, value: name});
}

async function runButton(page, selector) {
  await page.locator(selector).click();
  await page.waitForFunction(value => !document.querySelector(value).matches('[aria-busy="true"]'), selector);
}

async function choose(page, prefix, label) {
  await page.locator(`#${prefix}-trigger`).click();
  await page.locator(`#${prefix}-listbox [role="option"]`).filter({hasText: label}).click();
}

async function summary(page, prefix = 'summary-') {
  return Promise.all(['verified', 'corrupted', 'missing', 'extra'].map(async status =>
    Number(await page.locator(`#${prefix}${status}${prefix === 'summary-' ? '-count' : ''}`).textContent())));
}

async function prepareReference(page) {
  await selectFolder(page, '#select-source-button', 'original_files', '#source-folder-name');
  await runButton(page, '#generate-reference-button');
  await page.waitForFunction(() => document.querySelector('#source-reference-status').textContent === 'Ready');
}

async function auditBrowser(executablePath, browserLabel, full) {
  const browser = await chromium.launch({headless: true, executablePath});
  const page = await browser.newPage({viewport: {width: 1366, height: 768}, acceptDownloads: true});
  await installPickerMock(page);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto(`${base}/#verification`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  ok(await page.locator('#source-folder-name').textContent() === 'No source folder selected', `${browserLabel} fresh source state`);
  ok(await page.locator('#source-reference-status').textContent() === 'Not created', `${browserLabel} fresh reference state`);
  ok((await Promise.all(['verified', 'corrupted', 'missing', 'extra'].map(status =>
    page.locator(`#summary-${status}-count`).textContent()))).every(value => value === '—'), `${browserLabel} empty summary uses dashes`);
  ok(await page.locator('#engine-status, .hosted-mode-badge, .sidebar-meta, #verification-view .local-processing').count() === 0, `${browserLabel} removed mode UI is absent`);
  ok((await page.locator('#verification-view .folder-permission-note').textContent()).trim() === 'Folder access requires browser permission. Files are processed in this browser and are not uploaded.', `${browserLabel} permission note wording`);
  for (const [route, title] of [['verification', 'Verification'], ['error-lab', 'Error Lab'], ['history', 'History'], ['about', 'About']]) {
    await page.locator(`[data-view-link="${route}"]`).click();
    const topTitle = await page.locator('#topbar-page-title').evaluate(element => {
      const style = getComputedStyle(element);
      return {text: element.textContent, size: style.fontSize, weight: style.fontWeight};
    });
    assert.deepEqual(topTitle, {text: title, size: '19px', weight: '650'}); checks += 1;
  }
  await page.locator('[data-view-link="verification"]').click();
  const disabledControls = await page.evaluate(() => {
    const picker = getComputedStyle(document.querySelector('#results-filter-trigger'));
    const csv = getComputedStyle(document.querySelector('#export-csv-button'));
    return [picker.height, csv.height, picker.borderRadius, csv.borderRadius, picker.backgroundColor, csv.backgroundColor];
  });
  assert.equal(disabledControls[0], disabledControls[1]);
  assert.equal(disabledControls[2], disabledControls[3]);
  assert.equal(disabledControls[4], disabledControls[5]);
  checks += 3;
  await prepareReference(page);
  ok(await page.locator('#source-selection-detail').textContent() === '5 files selected', `${browserLabel} real source selection`);
  ok(await page.evaluate(() => {
    const reference = JSON.parse(localStorage.getItem('usb-backup-verifier.static-reference.v1'));
    return reference.files.every(file => !Object.hasOwn(file, 'bytes'));
  }), `${browserLabel} reference persists metadata only`);

  if (!full) {
    await selectFolder(page, '#select-backup-button', 'backup_clean', '#backup-folder-name');
    await runButton(page, '#verify-backup-button');
    assert.deepEqual(await summary(page), [5, 0, 0, 0]); checks += 1;
    ok(errors.length === 0, `${browserLabel} console`);
    await browser.close();
    return;
  }

  for (const [name, totals] of Object.entries(expected)) {
    await selectFolder(page, '#select-backup-button', name, '#backup-folder-name');
    await runButton(page, '#verify-backup-button');
    assert.deepEqual(await summary(page), totals); checks += 1;
    ok(await page.locator('#verification-results-body').getByText('nested/lab_record.bin', {exact: true}).count() === 1, `${name} nested result`);
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  const enabledControls = await page.evaluate(() => {
    const picker = getComputedStyle(document.querySelector('#results-filter-trigger'));
    const csv = getComputedStyle(document.querySelector('#export-csv-button'));
    return [picker.height, csv.height, picker.borderRadius, csv.borderRadius, picker.backgroundColor, csv.backgroundColor];
  });
  assert.deepEqual(enabledControls.slice(0, 4), [enabledControls[1], enabledControls[1], enabledControls[3], enabledControls[3]]);
  assert.equal(enabledControls[4], enabledControls[5]);
  checks += 2;

  for (const [labelText, expectedRows] of [['All Files', 6], ['Verified', 3], ['Corrupted', 1], ['Missing', 1], ['Extra', 1]]) {
    await choose(page, 'results-filter', labelText);
    assert.equal(await page.locator('#verification-results-body tr').count(), expectedRows); checks += 1;
  }

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#export-csv-button').click();
  const csvText = fs.readFileSync(await (await downloadEvent).path(), 'utf8');
  ok(csvText.includes('Verification ID') && csvText.includes('nested/lab_record.bin'), 'real-folder CSV export');

  const previousBackup = await page.locator('#backup-folder-name').textContent();
  await page.evaluate(() => { window.__pickerError = 'AbortError'; });
  await page.locator('#select-backup-button').click();
  ok(await page.locator('#backup-folder-name').textContent() === previousBackup, 'cancel preserves selection');
  await page.evaluate(() => { window.__pickerError = 'NotAllowedError'; });
  await page.locator('#select-backup-button').click();
  ok(await page.locator('#backup-folder-name').textContent() === previousBackup, 'denial preserves selection');
  ok((await page.locator('#reference-feedback').textContent()).includes('not granted'), 'permission denial message');
  await page.locator('#clear-selection-button').click();
  ok((await Promise.all(['verified', 'corrupted', 'missing', 'extra'].map(status =>
    page.locator(`#summary-${status}-count`).textContent()))).every(value => value === '—'), 'clear selection restores empty summary dashes');

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

  await page.getByRole('link', {name: 'Error Lab', exact: true}).click();
  await selectFolder(page, '#lab-select-backup-button', 'backup_clean', '#lab-backup-name');
  const labScenarios = [
    ['modify-byte', 'image.png', [4, 1, 0, 0]], ['append-data', 'notes.txt', [4, 1, 0, 0]],
    ['truncate-file', 'config.json', [4, 1, 0, 0]], ['remove-file', 'nested/lab_record.bin', [4, 0, 1, 0]],
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
    await page.waitForFunction(value => !document.querySelector(`#${value}-view`).hidden, route);
    checks += 1;
  }
  await page.goto(`${base}/#verification`);
  ok(await page.locator('#source-reference-status').textContent() === 'Ready', 'reference metadata persists');
  ok(await page.locator('#source-folder-name').textContent() === 'No source folder selected', 'file selection does not persist');

  for (const [width, height] of [[1920, 1080], [1600, 900], [1366, 768]]) {
    await page.setViewportSize({width, height});
    for (const route of ['verification', 'error-lab', 'history', 'about']) {
      await page.goto(`${base}/#${route}`);
      ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `${route} no overflow ${width}`);
    }
  }

  await page.getByRole('link', {name: 'History', exact: true}).click();
  await page.getByRole('button', {name: 'Clear History'}).click();
  await page.locator('#history-clear-confirm').click();
  await page.waitForFunction(() => document.querySelector('#history-total-count').textContent === '0');
  ok((await page.evaluate(() => localStorage.getItem('usb-backup-verifier.static-history.v1'))) === null, 'history clear preserves reference');
  ok(errors.length === 0, `console errors: ${errors.join('; ')}`);
  ok(requests.every(url => url.startsWith(base) && !url.includes('/api/')), 'static-only requests');
  ok(requests.every(url => !url.includes('/demo_data/')), 'no bundled dataset requests');
  await browser.close();
}

(async () => {
  try {
    await start();
    await auditBrowser('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'Edge', true);
    await auditBrowser('C:/Program Files/Google/Chrome/Application/chrome.exe', 'Chrome', false);
    console.log(`Static browser-folder audit: ${checks} checks passed`);
  } finally {
    await stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
