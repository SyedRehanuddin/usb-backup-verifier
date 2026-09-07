// Run with the browser-control tab and a backup fixture directory.
// Exercises the completed, rerun, invalidation, and reset states in the real UI.
import assert from 'node:assert/strict';

export default async function checkErrorLabPostRunStates(tab, fixtureDirectory) {
    const label = tab.playwright.locator('#lab-run-label');
    const status = tab.playwright.locator('#lab-action-status');
    const result = tab.playwright.locator('#lab-result-panel');
    const trigger = tab.playwright.locator('#lab-target-trigger');
    const list = tab.playwright.locator('#lab-target-listbox');
    const run = tab.playwright.locator('#lab-run-button');

    const chooseTarget = async (name) => {
        await trigger.click();
        await list.getByRole('option', {name, exact: true}).click();
    };
    const waitForCompletion = async () => {
        await tab.playwright.evaluate(() => new Promise((resolve) => {
            const check = () => {
                if (document.querySelector('#lab-run-label').textContent === 'Run Again') resolve();
                else setTimeout(check, 20);
            };
            check();
        }));
    };
    const resultFingerprint = () => tab.playwright.evaluate(() => ({
        sourceCrc: document.querySelector('#lab-source-crc').textContent,
        backupCrc: document.querySelector('#lab-backup-crc').textContent,
        originalSize: document.querySelector('#lab-original-size').textContent,
        simulatedSize: document.querySelector('#lab-simulated-size').textContent,
        totals: Array.from(document.querySelectorAll('[id^="lab-summary-"]'), (node) => node.textContent),
    }));

    await tab.reload();
    assert.equal(await label.textContent(), 'Run Simulation');
    await tab.selectBackup(fixtureDirectory);
    await tab.playwright.locator('input[name="lab-simulation"]').nth(0).check();
    await chooseTarget('attendance.csv');

    await run.click();
    await waitForCompletion();
    assert.equal(await label.textContent(), 'Run Again');
    assert.equal(await status.textContent(), 'Complete');
    assert.equal(await result.isVisible(), true);
    const firstRun = await resultFingerprint();

    await run.click();
    await waitForCompletion();
    assert.deepEqual(await resultFingerprint(), firstRun);
    assert.equal(await trigger.innerText(), 'attendance.csv');
    assert.equal(await tab.playwright.locator('input[name="lab-simulation"]:checked').getAttribute('value'), 'modify-byte');

    await chooseTarget('notes.txt');
    assert.equal(await result.isVisible(), false);
    assert.equal(await status.textContent(), 'Not run');
    assert.equal(await label.textContent(), 'Run Simulation');

    await run.click();
    await waitForCompletion();
    await tab.playwright.locator('input[name="lab-simulation"]').nth(1).check();
    assert.equal(await result.isVisible(), false);
    assert.equal(await status.textContent(), 'Not run');
    assert.equal(await label.textContent(), 'Run Simulation');

    await tab.playwright.locator('#lab-reset-button').click();
    assert.equal(await label.textContent(), 'Run Simulation');
    assert.equal(await status.textContent(), 'Not run');
    assert.equal(await result.isVisible(), false);
    assert.equal(await tab.playwright.locator('#lab-backup-name').textContent(), 'No backup folder selected');
    assert.equal(await tab.playwright.locator('#lab-reference-badge').textContent(), 'Ready');

    await tab.selectBackup(fixtureDirectory);
    await tab.playwright.locator('input[name="lab-simulation"]').nth(4).check();
    assert.equal(await tab.playwright.locator('#lab-target-control').isVisible(), false);
    assert.equal(await tab.playwright.locator('#lab-target-info').isVisible(), true);
    await run.click();
    await waitForCompletion();
    assert.equal(await tab.playwright.locator('#lab-result-target-label').textContent(), 'Generated File');
    assert.equal(await tab.playwright.locator('#lab-result-target').textContent(), 'simulation/extra_file.txt');
    assert.equal(await label.textContent(), 'Run Again');
    await run.click();
    await waitForCompletion();
    assert.equal(await tab.playwright.locator('#lab-summary-extra').textContent(), '1');
    await tab.playwright.locator('input[name="lab-simulation"]').nth(0).check();
    assert.equal(await tab.playwright.locator('#lab-target-control').isVisible(), true);
    assert.equal(await tab.playwright.locator('#lab-target-info').isVisible(), false);
    assert.equal(await tab.playwright.locator('#lab-result-target-label').textContent(), 'Target');
    await tab.playwright.locator('#lab-reset-button').click();

    return {passed: 6};
}
