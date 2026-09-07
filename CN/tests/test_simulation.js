const test = require("node:test");
const assert = require("node:assert/strict");

const simulation = require("../static/js/simulation.js");


test("Modify Byte changes exactly one byte without changing size or input", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const snapshot = new Uint8Array(original);
    const output = simulation.modifyByte(original);

    assert.equal(output.length, original.length);
    assert.equal(output.filter((value, index) => value !== original[index]).length, 1);
    assert.deepEqual(original, snapshot);
});

test("Modify Byte rejects an empty file", () => {
    assert.throws(() => simulation.modifyByte(new Uint8Array()), /requires a non-empty file/);
});

test("Append Data adds deterministic bytes without changing input", () => {
    const original = new Uint8Array([0, 255, 17]);
    const snapshot = new Uint8Array(original);
    const output = simulation.appendData(original);

    assert.equal(output.length, original.length + simulation.APPEND_BYTES.length);
    assert.deepEqual(output.slice(0, original.length), original);
    assert.deepEqual(original, snapshot);
});

test("Truncate File removes bytes without changing input", () => {
    const original = new Uint8Array(40).map((_, index) => index);
    const snapshot = new Uint8Array(original);
    const output = simulation.truncateFile(original);

    assert.equal(output.length, 30);
    assert.deepEqual(output, original.slice(0, 30));
    assert.deepEqual(original, snapshot);
});

test("Truncate File rejects an empty file", () => {
    assert.throws(() => simulation.truncateFile(new Uint8Array()), /requires a non-empty file/);
});

test("Remove File simulation is represented by omitting its full relative path", () => {
    const paths = ["notes.txt", "image.png", "nested/lab_record.bin"];
    const remaining = paths.filter((path) => path !== "image.png");

    assert.deepEqual(remaining, ["notes.txt", "nested/lab_record.bin"]);
});

test("Add Extra File chooses a deterministic non-colliding path", () => {
    const candidate = simulation.chooseExtraPath([
        "notes.txt",
        "simulation/extra_file.txt",
        "SIMULATION/extra_file_2.txt",
    ]);

    assert.equal(candidate, "simulation/extra_file_3.txt");
});

test("root stripping preserves nested relative paths", () => {
    assert.equal(
        simulation.stripRoot("BackupCopy\\nested\\lab_record.bin", "backupcopy"),
        "nested/lab_record.bin",
    );
});

test("generic simulation rejects methods that should not mutate bytes", () => {
    assert.throws(
        () => simulation.simulateBytes("remove-file", new Uint8Array([1])),
        /does not mutate file bytes/,
    );
});

test("binary equality compares every byte and length", () => {
    assert.equal(simulation.bytesEqual(new Uint8Array([0, 255]), new Uint8Array([0, 255])), true);
    assert.equal(simulation.bytesEqual(new Uint8Array([0, 255]), new Uint8Array([0, 254])), false);
    assert.equal(simulation.bytesEqual(new Uint8Array([0]), new Uint8Array([0, 0])), false);
});

test("run button label follows running and completed-result states", () => {
    assert.equal(simulation.runButtonLabel(false, false), "Run Simulation");
    assert.equal(simulation.runButtonLabel(true, false), "Running Simulation...");
    assert.equal(simulation.runButtonLabel(true, true), "Running Simulation...");
    assert.equal(simulation.runButtonLabel(false, true), "Run Again");
});

test("repeated simulations independently derive from the fresh baseline", () => {
    const baseline = new Uint8Array([10, 20, 30, 40, 50, 60, 70]);
    const snapshot = new Uint8Array(baseline);

    const firstRun = simulation.simulateBytes("modify-byte", baseline);
    const secondRun = simulation.simulateBytes("modify-byte", baseline);

    assert.deepEqual(firstRun, secondRun);
    assert.deepEqual(baseline, snapshot);
    assert.notDeepEqual(firstRun, baseline);
});
