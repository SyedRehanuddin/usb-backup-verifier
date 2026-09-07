// Run with the browser-control tab and a fixture folder containing the five
// documented sample paths. Exercises the real UI without running simulations.
import assert from 'node:assert/strict';

export default async function checkTargetPicker(tab, fixtureDirectory) {
    const passed = [];
    const trigger = tab.playwright.locator('#lab-target-trigger');
    const list = tab.playwright.locator('#lab-target-listbox');
    const run = tab.playwright.locator('#lab-run-button');
    const value = () => tab.playwright.evaluate(() => document.querySelector('#lab-target-select').value);
    const method = index => tab.playwright.locator('input[name="lab-simulation"]').nth(index).check();
    await tab.reload();
    assert.equal(await trigger.isEnabled(), false);
    assert.equal(await run.isEnabled(), false);
    await tab.selectBackup(fixtureDirectory);
    assert.equal(await trigger.isEnabled(), false);
    passed.push('No method: target and Run disabled');

    for (let index = 0; index < 4; index++) {
        await method(index);
        assert.equal(await trigger.isEnabled(), true);
        assert.equal(await value(), '');
        assert.equal(await run.isEnabled(), false);
        assert.equal(await tab.playwright.locator('#lab-target-status').textContent(), 'Required');
        await trigger.click();
        const paths = await list.getByRole('option').allTextContents({});
        const nativePaths = await tab.playwright.evaluate(() => Array.from(document.querySelector('#lab-target-select').options).filter(o => o.value).map(o => o.textContent));
        assert.deepEqual(paths, nativePaths);
        for (const path of ['attendance.csv', 'config.json', 'image.png', 'nested/lab_record.bin', 'notes.txt']) assert.ok(paths.includes(path));
        assert.ok(!paths.includes('Select a target file'));
        await list.getByRole('option', {name: 'nested/lab_record.bin', exact: true}).click();
        assert.equal(await value(), 'nested/lab_record.bin');
        assert.equal(await run.isEnabled(), true);
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert.equal(await tab.playwright.locator('#lab-target-status').textContent(), 'Selected');
        passed.push(`M${index + 1}: exact options, nested selection, required/selected gating`);
    }

    await method(4);
    assert.equal(await trigger.isEnabled(), false);
    assert.equal(await value(), '');
    assert.equal(await run.isEnabled(), true);
    assert.equal((await trigger.textContent()).trim(), 'No target file required');
    assert.equal(await tab.playwright.locator('#lab-target-title').textContent(), 'Target file');
    assert.equal(await tab.playwright.locator('#lab-target-help').textContent(), 'No target file is required for Add Extra File.');
    assert.equal(await tab.playwright.locator('#lab-target-status').textContent(), 'Not required');
    assert.equal(await tab.playwright.locator('#lab-target-control').isVisible(), false);
    const targetInfo = tab.playwright.locator('#lab-target-info');
    assert.equal(await targetInfo.isVisible(), true);
    assert.equal((await targetInfo.textContent()).trim(), 'Automatically generated during simulation');
    const infoSemantics = await targetInfo.evaluate((element) => ({
        tagName: element.tagName,
        contentEditable: element.getAttribute('contenteditable'),
        tabIndex: element.getAttribute('tabindex'),
        userSelect: getComputedStyle(element).userSelect,
        caretColor: getComputedStyle(element).caretColor,
        pointerEvents: getComputedStyle(element).pointerEvents,
    }));
    assert.deepEqual(infoSemantics, {
        tagName: 'DIV',
        contentEditable: null,
        tabIndex: null,
        userSelect: 'none',
        caretColor: 'rgba(0, 0, 0, 0)',
        pointerEvents: 'none',
    });
    await tab.playwright.locator('input[name="lab-simulation"]').nth(4).press('Tab');
    assert.equal(await targetInfo.evaluate((element) => element === document.activeElement), false);
    passed.push('M5: informational no-target presentation');

    await method(0);
    assert.equal(await tab.playwright.locator('#lab-target-title').textContent(), 'Choose target file');
    assert.equal(await tab.playwright.locator('#lab-target-control').isVisible(), true);
    assert.equal(await tab.playwright.locator('#lab-target-info').isVisible(), false);
    assert.equal(await run.isEnabled(), false);
    await trigger.press('ArrowDown');
    assert.equal(await value(), '');
    await trigger.press('ArrowDown');
    await trigger.press('ArrowUp');
    await trigger.press('Enter');
    assert.equal(await value(), 'attendance.csv');
    await trigger.press('Space');
    await trigger.press('End');
    await trigger.press('Space');
    assert.equal(await value(), 'notes.txt');
    await trigger.press('ArrowDown');
    await trigger.press('Home');
    await trigger.press('Escape');
    assert.equal(await value(), 'notes.txt');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    await trigger.click();
    await trigger.press('Tab');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(el => el === document.activeElement), false);
    await trigger.click();
    await tab.playwright.locator('#lab-page-title').click();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    passed.push('Keyboard arrows, Enter, Space, Home/End, Escape, Tab, and outside click');

    await trigger.click();
    const selected = list.getByRole('option', {name: 'notes.txt', exact: true});
    assert.equal(await selected.getAttribute('aria-selected'), 'true');
    assert.equal(await trigger.getAttribute('role'), 'combobox');
    assert.equal(await list.getAttribute('role'), 'listbox');
    assert.ok(await trigger.getAttribute('aria-activedescendant'));
    passed.push('Reopen preserves selected value and ARIA state');
    await trigger.press('Escape');
    await tab.playwright.locator('#lab-reset-button').click();
    assert.equal(await value(), '');
    assert.equal(await trigger.isEnabled(), false);
    assert.equal(await run.isEnabled(), false);
    assert.equal(await trigger.innerText(), 'Select a target file');
    assert.equal(await tab.playwright.locator('#lab-target-title').textContent(), 'Choose target file');
    assert.equal(await tab.playwright.locator('#lab-target-control').isVisible(), true);
    assert.equal(await tab.playwright.locator('#lab-target-info').isVisible(), false);
    assert.equal(await list.getByRole('option').count(), 0);
    passed.push('Reset clears options/value and disables target');
    return {passed: passed.length, checks: passed};
}

export async function checkTargetPickerLayout(tab) {
    const layout = await tab.playwright.evaluate(() => {
        const trigger = document.querySelector('#lab-target-trigger');
        const list = document.querySelector('#lab-target-listbox');
        const rect = list.getBoundingClientRect();
        const rows = Array.from(list.querySelectorAll('[role="option"]'));
        const longest = rows.reduce((a, b) => a.textContent.length > b.textContent.length ? a : b);
        return {
            width: innerWidth,
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            listOverflow: list.scrollWidth > list.clientWidth,
            contained: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
            open: trigger.getAttribute('aria-expanded') === 'true',
            background: getComputedStyle(list).backgroundColor,
            longPath: longest.textContent,
            accessiblePath: longest.getAttribute('aria-label'),
            selectedPath: document.querySelector('#lab-target-select').value,
            title: trigger.title,
            clippedLabel: document.querySelector('#lab-target-value').scrollWidth > document.querySelector('#lab-target-value').clientWidth,
        };
    });
    assert.ok(layout.open && layout.contained);
    assert.equal(layout.pageOverflow, false);
    assert.equal(layout.listOverflow, false);
    assert.ok(layout.longPath.length > 120);
    assert.equal(layout.accessiblePath, layout.longPath);
    assert.equal(layout.selectedPath, layout.longPath);
    assert.equal(layout.title, layout.longPath);
    assert.equal(layout.background, 'rgb(17, 30, 46)');
    return layout;
}

// Call with a closed, enabled trigger at the desired scroll position.
export async function checkTargetPickerPlacement(tab) {
    const before = await tab.playwright.evaluate(() => ({
        y: scrollY,
        cardHeight: document.querySelector('.target-panel').getBoundingClientRect().height,
    }));
    await tab.playwright.locator('#lab-target-trigger').click();
    const placement = await tab.playwright.evaluate(() => {
        const trigger = document.querySelector('#lab-target-trigger').getBoundingClientRect();
        const list = document.querySelector('#lab-target-listbox');
        const menu = list.getBoundingClientRect();
        const heading = document.querySelector('#lab-target-title').getBoundingClientRect();
        const rows = Array.from(list.children);
        const naturalHeight = rows.reduce((total, row) => total + row.getBoundingClientRect().height, 12);
        const desiredHeight = Math.min(260, Math.ceil(naturalHeight));
        const minimumUsableHeight = Math.min(desiredHeight, 144);
        const below = Math.max(0, innerHeight - trigger.bottom - 14);
        const above = Math.max(0, trigger.top - 14);
        const upward = document.querySelector('#lab-target-picker').classList.contains('opens-up');
        return {
            width: innerWidth, height: innerHeight, below, above, desiredHeight, minimumUsableHeight, upward,
            gap: upward ? trigger.top - menu.bottom : menu.top - trigger.bottom,
            widthDifference: Math.abs(trigger.width - menu.width),
            leftDifference: Math.abs(trigger.left - menu.left),
            contained: menu.top >= 0 && menu.bottom <= innerHeight && menu.left >= 0 && menu.right <= innerWidth,
            triggerVisible: trigger.top >= 0 && trigger.bottom <= innerHeight,
            overflow: document.documentElement.scrollWidth > innerWidth,
            menuHeight: menu.height,
            menuScrollable: list.scrollHeight > list.clientHeight,
            headingCovered: menu.left < heading.right && menu.right > heading.left && menu.top < heading.bottom && menu.bottom > heading.top,
            y: scrollY, cardHeight: document.querySelector('.target-panel').getBoundingClientRect().height,
        };
    });
    assert.equal(placement.upward, placement.below < placement.minimumUsableHeight && placement.above > placement.below);
    assert.ok(placement.contained && placement.triggerVisible);
    assert.ok(Math.abs(placement.gap - 6) < 1);
    assert.ok(placement.widthDifference < 1 && placement.leftDifference < 1);
    assert.equal(placement.overflow, false);
    assert.equal(placement.cardHeight, before.cardHeight);
    if (!placement.upward) assert.equal(placement.headingCovered, false);
    if (!placement.upward && placement.below < placement.desiredHeight) assert.ok(placement.menuScrollable);
    return placement;
}
