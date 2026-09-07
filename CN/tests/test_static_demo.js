const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const crc = require('../static_demo/js/crc32.js');
globalThis.StaticCrc32 = crc;
const verification = require('../static_demo/js/verification.js');
globalThis.StaticVerification = verification;
const simulation = require('../static_demo/js/simulation.js');
globalThis.ErrorLabSimulation = simulation;
const errorLab = require('../static_demo/js/error-lab.js');
const historyStore = require('../static_demo/js/history-store.js');

const paths = {
  original_files: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_clean: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_corrupted: ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_missing: ['attendance.csv', 'config.json', 'nested/lab_record.bin', 'notes.txt'],
  backup_extra: ['attendance.csv', 'config.json', 'extra_file.txt', 'image.png', 'nested/lab_record.bin', 'notes.txt'],
  backup_mixed: ['attendance.csv', 'config.json', 'extra_file.txt', 'nested/lab_record.bin', 'notes.txt'],
};

function dataset(name) {
  return verification.datasetFromFiles(name, paths[name].map(relativePath => ({
    relative_path: relativePath,
    bytes: new Uint8Array(fs.readFileSync(path.join(root, 'static_demo', 'demo_data', name, ...relativePath.split('/')))),
  })));
}

function totals(result) {
  return ['verified', 'corrupted', 'missing', 'extra'].map(key => result.summary[key]);
}

test('static CRC-32 uses the standard vector and uppercase eight-character output', () => {
  assert.equal(crc.crc32(new TextEncoder().encode('123456789')), 'CBF43926');
  assert.match(crc.crc32(new Uint8Array([0, 1, 2, 255])), /^[0-9A-F]{8}$/);
  const pythonReference = {
    'attendance.csv': '9BF38318', 'config.json': '6315717E', 'image.png': 'C46B5B31',
    'nested/lab_record.bin': '7737E8DE', 'notes.txt': 'DB5C99B6',
  };
  for (const [relativePath, expected] of Object.entries(pythonReference)) {
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'static_demo', 'demo_data', 'original_files', ...relativePath.split('/'))));
    assert.equal(crc.crc32(bytes), expected);
  }
});

test('all five static demo backups produce the required real CRC comparison totals', () => {
  const source = dataset('original_files');
  const expected = {
    backup_clean: [5, 0, 0, 0], backup_corrupted: [4, 1, 0, 0],
    backup_missing: [4, 0, 1, 0], backup_extra: [5, 0, 0, 1], backup_mixed: [3, 1, 1, 1],
  };
  for (const [name, counts] of Object.entries(expected)) {
    const result = verification.compare(source, dataset(name));
    assert.deepEqual(totals(result), counts);
    assert.equal(result.results.find(row => row.relative_path === 'nested/lab_record.bin').status, 'verified');
  }
});

test('all static Error Lab methods are non-destructive and produce expected totals', () => {
  const source = dataset('original_files');
  source.relative_paths = source.files.map(file => file.relative_path);
  const baseline = dataset('backup_clean');
  const before = baseline.files.map(file => Buffer.from(file.bytes).toString('hex'));
  const cases = [
    ['modify-byte', 'image.png', [4, 1, 0, 0]], ['append-data', 'notes.txt', [4, 1, 0, 0]],
    ['truncate-file', 'config.json', [4, 1, 0, 0]], ['remove-file', 'nested/lab_record.bin', [4, 0, 1, 0]],
    ['add-extra', null, [5, 0, 0, 1]],
  ];
  for (const [method, target, counts] of cases) assert.deepEqual(totals(errorLab.run(source, baseline, method, target)), counts);
  assert.deepEqual(baseline.files.map(file => Buffer.from(file.bytes).toString('hex')), before);
});

test('static CSV contains the presentation schema and protects formula-like cells', () => {
  const source = dataset('original_files');
  const result = verification.compare(source, dataset('backup_clean'));
  const record = verification.makeHistoryRecord(result, {created_at: new Date().toISOString(), source_name: 'original_files'});
  record.backup_name = '=unsafe';
  const csv = historyStore.buildCsv(record);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Verification ID"/);
  assert.match(csv, /"Clean - No differences detected"/);
  assert.match(csv, /"File Name"/);
  assert.match(csv, /"'=unsafe"/);
});

test('static distribution has no backend or browser folder permission APIs', () => {
  const files = [];
  const visit = directory => fs.readdirSync(directory, {withFileTypes: true}).forEach(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(full); else files.push(full);
  });
  visit(path.join(root, 'static_demo'));
  const source = files.filter(file => /\.(html|js|css)$/.test(file)).map(file => fs.readFileSync(file, 'utf8')).join('\n');
  for (const forbidden of ['/api/', 'showDirectoryPicker', 'webkitdirectory', 'FileList', 'FormData', 'type="file"']) assert.equal(source.includes(forbidden), false, forbidden);
});
