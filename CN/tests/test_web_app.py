import unittest

from fastapi.testclient import TestClient

from web_app import app


class WebAppTests(unittest.TestCase):
    client = TestClient(app)

    def test_index_returns_200(self) -> None:
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)

    def test_health_returns_200(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)

    def test_health_status_is_ok(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.json()["status"], "ok")

    def test_fresh_session_no_op_controls_start_disabled(self) -> None:
        html = self.client.get("/").text

        self.assertIn('id="clear-selection-button" type="button" disabled', html)
        self.assertIn(
            'id="results-filter" hidden aria-hidden="true" tabindex="-1" disabled',
            html,
        )
        self.assertIn('id="lab-reset-button" type="button" disabled', html)

    def test_verification_results_filter_uses_accessible_dark_picker(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertIn('id="results-filter-trigger" type="button" role="combobox"', html)
        self.assertIn('aria-controls="results-filter-listbox"', html)
        self.assertIn('id="results-filter-listbox" role="listbox"', html)
        for value, label in (
            ("all", "All Files"),
            ("verified", "Verified"),
            ("corrupted", "Corrupted"),
            ("missing", "Missing"),
            ("extra", "Extra"),
        ):
            self.assertIn(f'<option value="{value}">{label}</option>', html)
        self.assertIn("const resultsPicker = new globalThis.DarkSelectPicker(", script)
        self.assertIn("verificationResultsUtilities.filterResults(", script)
        self.assertIn("resultsPicker.sync();", script)
        self.assertIn('resultsFilter.addEventListener("change", renderResults);', script)
        self.assertIn('"No matching files"', script)
        self.assertIn('"No files in this verification have this status."', script)
        self.assertIn("downloadHistoryCsv(recordId,", script)

    def test_verification_reference_replacement_and_result_state_are_explicit(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertIn('id="summary-state-label">No current result</p>', html)
        self.assertIn('id="reference-replace-dialog" hidden', html)
        self.assertIn('role="dialog" aria-modal="true"', html)
        self.assertIn("Replace trusted reference?", html)
        self.assertIn(
            "This will replace the saved CRC-32 reference with the currently selected source folder. "
            "Future backup checks will use the new reference.",
            html,
        )
        self.assertIn('id="reference-replace-confirm" type="button">Replace Reference</button>', html)
        self.assertIn(': (replacingReference ? "Replace Reference" : "Generate Reference");', script)
        self.assertIn('? "Replace the trusted reference to continue."', script)
        self.assertIn("renderResults();\n    updateGenerateButton();\n    updateVerifyButton();", script)
        self.assertIn('currentVerificationComplete && verificationSummary ? "Current result" : "No current result"', script)
        selection_handler = script.split("async function selectVerificationFolder(kind)", 1)[1].split(
            'selectSourceButton.addEventListener("click"', 1
        )[0]
        self.assertIn("resetVerificationResults();", selection_handler)

    def test_primary_folder_buttons_use_backend_native_selection_only(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertNotIn('id="source-folder-input"', html)
        self.assertNotIn('id="backup-folder-input"', html)
        self.assertNotIn('type="file"', html)
        self.assertNotIn("webkitdirectory", html)
        self.assertNotIn("showDirectoryPicker", script)
        self.assertIn('fetch("/api/folders/select"', script)
        self.assertIn('fetch("/api/reference/generate-selected"', script)
        self.assertIn('fetch("/api/verification/run-selected"', script)
        self.assertIn('fetch("/api/error-lab/run-selected"', script)

    def test_error_lab_workflow_follows_steps_one_through_four(self) -> None:
        html = self.client.get("/").text

        ordered_ids = (
            'id="lab-backup-card"',
            'class="simulation-methods"',
            'class="lab-panel target-panel"',
            'class="lab-action-panel"',
            'id="lab-result-panel"',
        )
        positions = [html.index(marker) for marker in ordered_ids]
        self.assertEqual(positions, sorted(positions))
        for step in ("Step 01", "Step 02", "Step 03", "Step 04"):
            self.assertIn(step, html)
        self.assertIn(
            '<legend class="visually-hidden">Choose simulation method</legend>',
            html,
        )
        self.assertIn('<div class="simulation-methods-header">', html)

    def test_error_lab_initial_inputs_use_real_disabled_semantics(self) -> None:
        html = self.client.get("/").text

        self.assertIn('id="lab-target-select" disabled', html)
        self.assertIn('id="lab-run-button" type="button" disabled', html)
        self.assertEqual(html.count('name="lab-simulation"'), 5)
        self.assertEqual(html.count('name="lab-simulation" value='), 5)
        self.assertEqual(html.count('name="lab-simulation" value="modify-byte" disabled'), 1)
        self.assertIn("Complete Steps 01 and 02 first.", html)

    def test_error_lab_backup_button_label_tracks_selection_state(self) -> None:
        html = self.client.get("/").text
        script_response = self.client.get("/static/js/app.js")

        self.assertIn(
            '<span id="lab-select-backup-label">Select Backup Folder</span>',
            html,
        )
        self.assertEqual(script_response.status_code, 200)
        script = script_response.text
        self.assertIn('? "Change Backup Folder"', script)
        self.assertIn(': "Select Backup Folder";', script)
        self.assertEqual(script.count("updateLabBackupButtonLabel();"), 2)

    def test_error_lab_method_identifiers_do_not_repeat_workflow_numbers(self) -> None:
        html = self.client.get("/").text

        for identifier in ("M1", "M2", "M3", "M4", "M5"):
            self.assertIn(f'>{identifier}</span>', html)
        self.assertNotIn("simulation-option-number", html)
        self.assertEqual(
            html.count('class="simulation-option-marker" aria-hidden="true"></span>'),
            5,
        )
        self.assertNotIn('aria-hidden="true">✓</span>', html)

    def test_error_lab_result_language_distinguishes_detection_from_verification(self) -> None:
        html = self.client.get("/").text

        self.assertIn("Simulation complete", html)
        self.assertIn("Expected Detection", html)
        self.assertIn("Detected Result", html)
        self.assertIn("Expected result detected", html)
        self.assertIn("Mutations are applied only to temporary in-memory data.", html)

    def test_error_lab_run_button_uses_completed_result_label_state(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertIn('<span id="lab-run-label">Run Simulation</span>', html)
        self.assertIn("simulationUtilities.runButtonLabel(", script)
        self.assertIn("!labResultPanel.hidden", script)

    def test_error_lab_m5_uses_informational_target_presentation(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertIn('id="lab-target-info"', html)
        self.assertIn("Automatically generated during simulation", html)
        self.assertIn('class="lab-target-info" id="lab-target-info" role="note"', html)
        self.assertNotIn('id="lab-target-info" tabindex=', html)
        self.assertNotIn('id="lab-target-info" contenteditable', html)
        self.assertIn('id="lab-result-target-label">Target</dt>', html)
        self.assertIn('labTargetTitle.textContent = "Target file";', script)
        self.assertIn('labTargetHelp.textContent = "No target file is required for Add Extra File.";', script)
        self.assertIn('? "Target"', script)
        self.assertIn(': "Generated File";', script)

    def test_history_overview_contains_toolbar_empty_states_and_safe_dialog(self) -> None:
        html = self.client.get("/").text
        script = self.client.get("/static/js/app.js").text

        self.assertIn("Clean checks", html)
        self.assertNotIn("Clean backups", html)
        self.assertIn("Completed checks", html)
        self.assertNotIn("Completed runs", html)
        self.assertIn('placeholder="Search history"', html)
        self.assertIn('id="history-status-filter" hidden aria-hidden="true" tabindex="-1"', html)
        self.assertIn('id="history-sort-order" hidden aria-hidden="true" tabindex="-1"', html)
        self.assertIn('id="history-status-trigger" type="button" role="combobox"', html)
        self.assertIn('id="history-sort-trigger" type="button" role="combobox"', html)
        self.assertIn('id="history-status-listbox" role="listbox"', html)
        self.assertIn('id="history-sort-listbox" role="listbox"', html)
        self.assertIn('<option value="all">All</option>', html)
        self.assertIn('<option value="clean">Clean</option>', html)
        self.assertIn('<option value="issues">Issues</option>', html)
        self.assertIn('<option value="newest">Newest first</option>', html)
        self.assertIn('<option value="oldest">Oldest first</option>', html)
        self.assertIn("No matching checks", html)
        self.assertIn("Try changing your search or filters.", html)
        self.assertIn("No verification history yet", html)
        self.assertIn("Completed backup checks will appear here.", html)
        self.assertIn(
            "This will permanently remove all saved verification records from this device. This action cannot be undone.",
            html,
        )
        self.assertIn('document.querySelector("#history-clear-cancel").focus();', script)
        self.assertIn('if (event.key === "Escape")', script)
        self.assertIn('if (event.key === "Tab")', script)
        self.assertIn('button.textContent = "View Details";', script)
        self.assertIn("new globalThis.DarkSelectPicker", script)
        self.assertIn("Check details", html)
        self.assertNotIn("Run details", html)
        self.assertIn('id="history-results-filter" hidden aria-hidden="true" tabindex="-1"', html)
        self.assertIn('id="history-results-trigger" type="button" role="combobox"', html)
        self.assertIn('id="history-results-listbox" role="listbox"', html)
        self.assertIn('id="history-results-count" aria-live="polite"', html)
        self.assertIn("No matching files", script)
        self.assertIn("No files in this check have this status.", script)
        self.assertIn("returnFocus.focus({preventScroll: true});", script)

    def test_successful_history_clear_resets_scroll_after_rendering_empty_state(self) -> None:
        script = self.client.get("/static/js/app.js").text
        clear_flow = script.split("async function confirmHistoryClear()", 1)[1].split(
            "function showView", 1
        )[0]
        cancel_flow = script.split("function closeHistoryClearDialog()", 1)[1].split(
            "async function confirmHistoryClear()", 1
        )[0]

        load_position = clear_flow.index("await loadHistory();")
        feedback_position = clear_flow.index('setHistoryFeedback("success"')
        scroll_position = clear_flow.index("await resetHistoryScrollAfterClear();")
        self.assertLess(load_position, feedback_position)
        self.assertLess(feedback_position, scroll_position)
        self.assertIn(
            "requestAnimationFrame(() => requestAnimationFrame(resolve));",
            script,
        )
        self.assertIn(
            "const scrollOwner = document.scrollingElement || document.documentElement;",
            script,
        )
        self.assertIn("scrollOwner.scrollTop = 0;", script)
        self.assertIn("return scrollOwner.scrollTop === 0;", script)
        self.assertNotIn("await resetHistoryScrollAfterClear();", cancel_flow)


if __name__ == "__main__":
    unittest.main()
