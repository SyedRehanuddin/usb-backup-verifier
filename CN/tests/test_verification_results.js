const assert = require("node:assert/strict");
const test = require("node:test");

require("../static/js/verification-results.js");

const { filterResults } = globalThis.VerificationResultsUI;

function rows(verified, corrupted, missing, extra) {
    return [
        ...Array.from({ length: verified }, (_, index) => ({ status: "verified", relative_path: index === 0 ? "nested/lab_record.bin" : `verified-${index}.txt` })),
        ...Array.from({ length: corrupted }, (_, index) => ({ status: "corrupted", relative_path: `corrupted-${index}.txt` })),
        ...Array.from({ length: missing }, (_, index) => ({ status: "missing", relative_path: `missing-${index}.txt` })),
        ...Array.from({ length: extra }, (_, index) => ({ status: "extra", relative_path: `extra-${index}.txt` })),
    ];
}

const scenarios = {
    clean: rows(5, 0, 0, 0),
    corrupted: rows(4, 1, 0, 0),
    missing: rows(4, 0, 1, 0),
    extra: rows(5, 0, 0, 1),
    mixed: rows(3, 1, 1, 1),
};

for (const [name, results] of Object.entries(scenarios)) {
    test(`${name} verification filters preserve the complete result totals`, () => {
        const expected = {
            all: results.length,
            verified: results.filter((row) => row.status === "verified").length,
            corrupted: results.filter((row) => row.status === "corrupted").length,
            missing: results.filter((row) => row.status === "missing").length,
            extra: results.filter((row) => row.status === "extra").length,
        };

        for (const [status, count] of Object.entries(expected)) {
            assert.equal(filterResults(results, status).length, count);
        }
        assert.ok(results.some((row) => row.relative_path === "nested/lab_record.bin"));
    });
}
