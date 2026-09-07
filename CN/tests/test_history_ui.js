const test = require("node:test");
const assert = require("node:assert/strict");
const history = require("../static/js/history.js");

const records = [
    {id: "new-clean", checked_at: "2026-09-05T02:37:00Z", backup_name: "Backup Alpha", reference_source: "Original Files", summary: {verified: 5, corrupted: 0, missing: 0, extra: 0}},
    {id: "middle-issues", checked_at: "2026-09-04T03:00:00Z", backup_name: "Field Copy", reference_source: "Trusted Source", summary: {verified: 3, corrupted: 1, missing: 1, extra: 0}},
    {id: "old-clean", checked_at: "2026-09-03T01:00:00Z", backup_name: "Archive", reference_source: "Original Files", summary: {verified: 5, corrupted: 0, missing: 0, extra: 0}},
];

test("history metrics count all stored checks", () => {
    assert.deepEqual(history.calculateMetrics(records), {total: 3, clean: 2, issues: 1});
    assert.deepEqual(history.calculateMetrics([]), {total: 0, clean: 0, issues: 0});
});

test("search matches backup names immediately and case-insensitively", () => {
    assert.deepEqual(history.filterAndSort(records, {query: "backup alpha"}).map(r => r.id), ["new-clean"]);
    assert.deepEqual(history.filterAndSort(records, {query: "FIELD"}).map(r => r.id), ["middle-issues"]);
});

test("search matches reference names but not internal IDs", () => {
    assert.deepEqual(history.filterAndSort(records, {query: "trusted source"}).map(r => r.id), ["middle-issues"]);
    assert.deepEqual(history.filterAndSort(records, {query: "new-clean"}), []);
});

test("status filters implement All, Clean, and Issues", () => {
    assert.equal(history.filterAndSort(records, {status: "all"}).length, 3);
    assert.deepEqual(history.filterAndSort(records, {status: "clean"}).map(r => r.id), ["new-clean", "old-clean"]);
    assert.deepEqual(history.filterAndSort(records, {status: "issues"}).map(r => r.id), ["middle-issues"]);
});

test("sort defaults newest-first and supports oldest-first", () => {
    assert.deepEqual(history.filterAndSort(records).map(r => r.id), ["new-clean", "middle-issues", "old-clean"]);
    assert.deepEqual(history.filterAndSort(records, {sort: "oldest"}).map(r => r.id), ["old-clean", "middle-issues", "new-clean"]);
});

test("combined search and status filtering can produce zero results", () => {
    assert.deepEqual(history.filterAndSort(records, {query: "original", status: "clean"}).map(r => r.id), ["new-clean", "old-clean"]);
    assert.deepEqual(history.filterAndSort(records, {query: "field", status: "clean"}), []);
});

test("history timestamps use the required unambiguous display format", () => {
    assert.equal(history.formatTimestamp("2026-09-05T02:37:00Z", "UTC"), "5 Sep 2026 · 2:37 AM");
    assert.equal(history.formatTimestamp("not-a-date", "UTC"), "Unknown date");
});

test("detail result filters preserve every status classification", () => {
    const results = [
        {status: "verified", file: "a.txt"},
        {status: "verified", file: "nested/b.txt"},
        {status: "corrupted", file: "c.txt"},
        {status: "missing", file: "d.txt"},
        {status: "extra", file: "e.txt"},
    ];
    assert.equal(history.filterDetailResults(results, "all").length, 5);
    assert.deepEqual(history.filterDetailResults(results, "verified").map(row => row.file), ["a.txt", "nested/b.txt"]);
    assert.deepEqual(history.filterDetailResults(results, "corrupted").map(row => row.file), ["c.txt"]);
    assert.deepEqual(history.filterDetailResults(results, "missing").map(row => row.file), ["d.txt"]);
    assert.deepEqual(history.filterDetailResults(results, "extra").map(row => row.file), ["e.txt"]);
});

test("detail file counts distinguish all files from filtered results", () => {
    assert.equal(history.formatDetailResultCount(6, 6, "all"), "6 files");
    assert.equal(history.formatDetailResultCount(3, 6, "verified"), "3 of 6 files");
    assert.equal(history.formatDetailResultCount(1, 6, "corrupted"), "1 of 6 files");
    assert.equal(history.formatDetailResultCount(1, 1, "all"), "1 file");
});
