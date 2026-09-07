import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import web_app
from app.native_folders import FolderSelectionRegistry


class HostedDemoModeTests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.patches = [
            patch("web_app.APP_MODE", "demo"),
            patch("web_app.CURRENT_REFERENCE_PATH", root / "reference.json"),
            patch("web_app.CURRENT_HISTORY_PATH", root / "history.json"),
            patch("web_app.folder_selections", FolderSelectionRegistry()),
            patch("web_app.choose_native_directory", side_effect=AssertionError("Tkinter must not run in demo mode")),
        ]
        for active_patch in self.patches:
            active_patch.start()

    def tearDown(self) -> None:
        for active_patch in reversed(self.patches):
            active_patch.stop()
        self.temp.cleanup()

    def select(self, purpose: str, dataset_id: str) -> dict[str, object]:
        response = self.client.post(
            "/api/folders/select",
            json={"purpose": purpose, "dataset_id": dataset_id},
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def generate_demo_reference(self) -> None:
        source = self.select("source", "original_files")
        response = self.client.post(
            "/api/reference/generate-selected",
            json={"selection_id": source["selection_id"]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["file_count"], 5)

    def test_demo_shell_and_health_expose_only_named_dataset_choices(self) -> None:
        html = self.client.get("/").text
        health = self.client.get("/api/health")

        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["mode"], "demo")
        self.assertIn("Hosted Demo Mode", html)
        self.assertIn('data-app-mode="demo"', html)
        for label in (
            "Original Files", "Clean Backup", "Corrupted Backup",
            "Missing File Backup", "Extra File Backup", "Mixed Issues Backup",
        ):
            self.assertIn(label, html)
        self.assertNotIn('type="file"', html)
        script = self.client.get("/static/js/app.js").text
        for forbidden in ("showDirectoryPicker", "webkitdirectory", "FileList", "FormData"):
            self.assertNotIn(forbidden, script)

    def test_demo_selection_is_allowlisted_and_never_calls_native_picker(self) -> None:
        source = self.select("source", "original_files")
        self.assertTrue(source["selected"])
        self.assertEqual(source["name"], "original_files")
        self.assertIn("nested/lab_record.bin", source["relative_paths"])

        for payload in (
            {"purpose": "source", "dataset_id": "backup_clean"},
            {"purpose": "backup", "dataset_id": "original_files"},
            {"purpose": "backup", "dataset_id": "../../data"},
            {"purpose": "backup", "dataset_id": "C:\\Users"},
            {"purpose": "backup"},
        ):
            with self.subTest(payload=payload):
                response = self.client.post("/api/folders/select", json=payload)
                self.assertEqual(response.status_code, 422)

    def test_all_demo_backups_run_through_real_verifier(self) -> None:
        self.generate_demo_reference()
        expected = {
            "backup_clean": [5, 0, 0, 0],
            "backup_corrupted": [4, 1, 0, 0],
            "backup_missing": [4, 0, 1, 0],
            "backup_extra": [5, 0, 0, 1],
            "backup_mixed": [3, 1, 1, 1],
        }
        for dataset_id, totals in expected.items():
            with self.subTest(dataset_id=dataset_id):
                selected = self.select("backup", dataset_id)
                response = self.client.post(
                    "/api/verification/run-selected",
                    json={"selection_id": selected["selection_id"], "record_history": True},
                )
                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(
                    [body["summary"][key] for key in ("verified", "corrupted", "missing", "extra")],
                    totals,
                )
                nested = next(row for row in body["results"] if row["relative_path"] == "nested/lab_record.bin")
                self.assertEqual(nested["status"], "verified")

    def test_all_error_lab_methods_use_fresh_clean_demo_baseline(self) -> None:
        self.generate_demo_reference()
        selected = self.select("backup", "backup_clean")
        scenarios = (
            ("modify-byte", "image.png", "corrupted", [4, 1, 0, 0]),
            ("append-data", "notes.txt", "corrupted", [4, 1, 0, 0]),
            ("truncate-file", "config.json", "corrupted", [4, 1, 0, 0]),
            ("remove-file", "nested/lab_record.bin", "missing", [4, 0, 1, 0]),
            ("add-extra", None, "extra", [5, 0, 0, 1]),
        )
        for method, target, status, totals in scenarios:
            with self.subTest(method=method):
                payload = {"selection_id": selected["selection_id"], "method": method, "target_path": target}
                first = self.client.post("/api/error-lab/run-selected", json=payload)
                second = self.client.post("/api/error-lab/run-selected", json=payload)
                self.assertEqual(first.status_code, 200)
                self.assertEqual(second.status_code, 200)
                body = first.json()
                target_path = body["simulation"]["target_path"]
                row = next(row for row in body["results"] if row["relative_path"] == target_path)
                self.assertEqual(row["status"], status)
                self.assertEqual(
                    [body["summary"][key] for key in ("verified", "corrupted", "missing", "extra")],
                    totals,
                )
                self.assertEqual(body["summary"], second.json()["summary"])


if __name__ == "__main__":
    unittest.main()
