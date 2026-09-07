const test = require("node:test");
const assert = require("node:assert/strict");
const {calculateSelectMenuPlacement} = require("../static/js/select-picker.js");

const base = {
    triggerTop: 300,
    triggerBottom: 336,
    triggerLeft: 900,
    triggerWidth: 132,
    viewportWidth: 1366,
    viewportHeight: 768,
    desiredHeight: 110,
};

test("short picker menus prefer the available space below", () => {
    const placement = calculateSelectMenuPlacement(base);
    assert.equal(placement.opensUp, false);
    assert.equal(placement.top, 342);
    assert.equal(placement.left, 900);
    assert.equal(placement.width, 132);
    assert.equal(placement.height, 110);
});

test("picker opens upward only when below cannot fit and above has more space", () => {
    const placement = calculateSelectMenuPlacement({
        ...base,
        triggerTop: 650,
        triggerBottom: 686,
        desiredHeight: 120,
    });
    assert.equal(placement.opensUp, true);
    assert.equal(placement.top, 524);
    assert.equal(placement.height, 120);
});

test("picker constrains height without switching when below remains more useful", () => {
    const placement = calculateSelectMenuPlacement({
        ...base,
        triggerTop: 50,
        triggerBottom: 86,
        viewportHeight: 150,
        desiredHeight: 120,
    });
    assert.equal(placement.opensUp, false);
    assert.equal(placement.height, 50);
});

test("picker remains inside horizontal viewport margins", () => {
    const placement = calculateSelectMenuPlacement({
        ...base,
        triggerLeft: 1280,
        triggerWidth: 132,
    });
    assert.equal(placement.left, 1226);
    assert.equal(placement.left + placement.width, 1358);
});
