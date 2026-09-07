// Browser regression checks for the actual Error Lab UI.
// Run through the browser-control session with an Error Lab tab and a local
// fixture folder. The page must have its existing trusted reference available.
import assert from 'node:assert/strict';

async function readCards(tab) {
    return tab.playwright.locator('.simulation-option').evaluateAll(cards => cards.map(card => {
        const input = card.querySelector('input');
        const marker = card.querySelector('.simulation-option-marker');
        const style = getComputedStyle(card);
        return {
            disabled: input.disabled,
            checked: input.checked,
            opacity: Number(style.opacity),
            cursor: style.cursor,
            background: style.backgroundColor,
            border: style.borderColor,
            title: getComputedStyle(card.querySelector('strong')).color,
            description: getComputedStyle(card.querySelector('.simulation-option-description')).color,
            checkmark: getComputedStyle(marker, '::after').content.includes('✓'),
        };
    }));
}

function contrast(foreground, background) {
    const luminance = color => {
        const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            const s = value / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export default async function checkErrorLabMethodStates(tab, fixtureDirectory) {
    const passed = [];
    await tab.reload();
    let cards = await readCards(tab);
    assert.equal(cards.length, 5);
    assert.ok(cards.every(c => c.disabled && !c.checked && !c.checkmark && c.opacity < 1 && c.cursor === 'not-allowed'));
    // Clicking a disabled card's label must not select its radio.
    await tab.playwright.locator('.simulation-option').first().click({force: true});
    assert.ok((await readCards(tab)).every(c => !c.checked));
    passed.push('Before selection: five muted, disabled, unselectable methods');

    await tab.selectBackup(fixtureDirectory);
    cards = await readCards(tab);
    assert.ok(cards.every(c => !c.disabled && !c.checked && !c.checkmark && c.opacity === 1 && c.cursor === 'pointer'));
    assert.ok(cards.every(c => contrast(c.title, c.background) >= 4.5 && contrast(c.description, c.background) >= 4.5));
    passed.push('Backup selected: five enabled cards with readable text contrast');

    await tab.playwright.locator('.simulation-option').first().click();
    cards = await readCards(tab);
    assert.ok(cards[0].checked && cards[0].checkmark);
    assert.equal(cards.filter(c => c.checkmark).length, 1);
    assert.notEqual(cards[0].border, cards[1].border);
    assert.notEqual(cards[0].background, cards[1].background);
    passed.push('Selected method: active card and exactly one checkmark');

    for (let index = 1; index < 5; index++) {
        // Exercise native keyboard switching through every other method.
        await tab.playwright.locator('input[name="lab-simulation"]').nth(index - 1).press('ArrowRight');
        cards = await readCards(tab);
        assert.ok(cards[index].checked && cards[index].checkmark);
        assert.equal(cards.filter(c => c.checkmark).length, 1);
        assert.ok(cards.every(c => !c.disabled));
    }
    passed.push('Switching: keyboard selection moves the sole checkmark through all five methods');

    await tab.playwright.locator('#lab-reset-button').click();
    cards = await readCards(tab);
    assert.ok(cards.every(c => c.disabled && !c.checked && !c.checkmark && c.opacity < 1 && c.cursor === 'not-allowed'));
    passed.push('Reset Lab: all five methods disabled and unchecked again');
    return {passed: passed.length, checks: passed};
};
