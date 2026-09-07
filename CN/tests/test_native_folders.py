import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import web_app
from app.native_folders import FolderSelectionRegistry, scan_folder


SOURCE_FILES = {
    "attendance.csv": b"name,present\nAyesha,yes\n",
    "config.json": b'{"safe":true}\n',
    "image.png": b"\x89PNG\r\n\x1a\n\x01\x02\x03",
    "nested/lab_record.bin": b"\x00\x01\x02\xff\x03",
    "notes.txt": b"project notes\n",
}


class NativeFolderSelectionTests(unittest.TestCase):
    client = TestClient(web_app.app)

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.reference_path = self.root / "data" / "reference.json"
        self.history_path = self.root / "data" / "history.json"
        self.patches = [
            patch("web_app.CURRENT_REFERENCE_PATH", self.reference_path),
            patch("web_app.CURRENT_HISTORY_PATH", self.history_path),
            patch("web_app.folder_selections", FolderSelectionRegistry()),
        ]
        for active_patch in self.patches:
            active_patch.start()

    def tearDown(self) -> None:
        for active_patch in reversed(self.patches):
            active_patch.stop()
        self.temp.cleanup()

    def make_folder(self, name: str, files: dict[str, bytes]) -> Path:
        root = self.root / name
        for relative_path, content in files.items():
            destination = root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        return root

    def select(self, purpose: str, path: Path) -> dict[str, object]:
        with patch("web_app.choose_native_directory", return_value=path):
            response = self.client.post("/api/folders/select", json={"purpose": purpose})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_cancel_returns_no_selection_without_exposing_a_path(self) -> None:
        with patch("web_app.choose_native_directory", return_value=None):
            response = self.client.post("/api/folders/select", json={"purpose": "source"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"selected": False})

    def test_selection_returns_only_safe_metadata_and_opaque_id(self) -> None:
        source = self.make_folder("original_files", SOURCE_FILES)
        body = self.select("source", source)

        self.assertTrue(body["selected"])
        self.assertEqual(body["name"], "original_files")
        self.assertEqual(body["file_count"], 5)
        self.assertIn("nested/lab_record.bin", body["relative_paths"])
        self.assertGreaterEqual(len(body["selection_id"]), 32)
        self.assertNotIn(str(source), str(body))

    def test_recursive_scan_preserves_nested_relative_path(self) -> None:
        source = self.make_folder("original_files", SOURCE_FILES)
        self.assertEqual(
            [relative_path for relative_path, _ in scan_folder(source)],
            [
                "attendance.csv",
                "config.json",
                "image.png",
                "nested/lab_record.bin",
                "notes.txt",
            ],
        )

    def test_selected_source_and_all_backup_scenarios_use_existing_crc_pipeline(self) -> None:
        source = self.make_folder("original_files", SOURCE_FILES)
        source_selection = self.select("source", source)
        generated = self.client.post(
            "/api/reference/generate-selected",
            json={"selection_id": source_selection["selection_id"]},
        )
        self.assertEqual(generated.status_code, 200)
        self.assertEqual(generated.json()["file_count"], 5)

        variants = {
            "clean": (dict(SOURCE_FILES), [5, 0, 0, 0]),
            "corrupted": ({**SOURCE_FILES, "attendance.csv": b"changed"}, [4, 1, 0, 0]),
            "missing": ({key: value for key, value in SOURCE_FILES.items() if key != "image.png"}, [4, 0, 1, 0]),
            "extra": ({**SOURCE_FILES, "extra_file.txt": b"extra"}, [5, 0, 0, 1]),
            "mixed": (
                {
                    **{key: value for key, value in SOURCE_FILES.items() if key != "image.png"},
                    "notes.txt": b"changed",
                    "extra_file.txt": b"extra",
                },
                [3, 1, 1, 1],
            ),
        }

        for name, (files, expected) in variants.items():
            with self.subTest(name=name):
                backup = self.make_folder(f"backup_{name}", files)
                selection = self.select("backup", backup)
                response = self.client.post(
                    "/api/verification/run-selected",
                    json={"selection_id": selection["selection_id"], "record_history": True},
                )
                self.assertEqual(response.status_code, 200)
                body = response.json()
                summary = body["summary"]
                self.assertEqual(
                    [summary[key] for key in ("verified", "corrupted", "missing", "extra")],
                    expected,
                )
                nested = next(
                    row for row in body["results"]
                    if row["relative_path"] == "nested/lab_record.bin"
                )
                self.assertEqual(nested["status"], "verified")

    def test_arbitrary_or_wrong_purpose_tokens_are_rejected(self) -> None:
        source = self.make_folder("original_files", SOURCE_FILES)
        selection = self.select("source", source)

        arbitrary = self.client.post(
            "/api/verification/run-selected",
            json={"selection_id": "x" * 32},
        )
        wrong_purpose = self.client.post(
            "/api/verification/run-selected",
            json={"selection_id": selection["selection_id"]},
        )
        self.assertEqual(arbitrary.status_code, 409)
        self.assertEqual(wrong_purpose.status_code, 409)

    def test_error_lab_runs_all_methods_from_fresh_non_destructive_baseline(self) -> None:
        source = self.make_folder("original_files", SOURCE_FILES)
        source_selection = self.select("source", source)
        generated = self.client.post(
            "/api/reference/generate-selected",
            json={"selection_id": source_selection["selection_id"]},
        )
        self.assertEqual(generated.status_code, 200)
        backup = self.make_folder("backup_clean", SOURCE_FILES)
        baseline = {
            relative_path: (backup / relative_path).read_bytes()
            for relative_path in SOURCE_FILES
        }
        backup_selection = self.select("backup", backup)
        scenarios = (
            ("modify-byte", "image.png", "corrupted", [4, 1, 0, 0]),
            ("append-data", "notes.txt", "corrupted", [4, 1, 0, 0]),
            ("truncate-file", "config.json", "corrupted", [4, 1, 0, 0]),
            ("remove-file", "nested/lab_record.bin", "missing", [4, 0, 1, 0]),
            ("add-extra", None, "extra", [5, 0, 0, 1]),
        )

        for method, target, expected_status, expected_totals in scenarios:
            with self.subTest(method=method):
                payload = {
                    "selection_id": backup_selection["selection_id"],
                    "method": method,
                    "target_path": target,
                }
                first = self.client.post("/api/error-lab/run-selected", json=payload)
                second = self.client.post("/api/error-lab/run-selected", json=payload)
                self.assertEqual(first.status_code, 200)
                self.assertEqual(second.status_code, 200)
                first_body = first.json()
                second_body = second.json()
                intended = first_body["simulation"]["target_path"]
                result_row = next(
                    row for row in first_body["results"]
                    if row["relative_path"] == intended
                )
                self.assertEqual(result_row["status"], expected_status)
                self.assertEqual(first_body["summary"], second_body["summary"])
                self.assertEqual(
                    [first_body["summary"][key] for key in ("verified", "corrupted", "missing", "extra")],
                    expected_totals,
                )
                self.assertEqual(
                    {path: (backup / path).read_bytes() for path in SOURCE_FILES},
                    baseline,
                )


if __name__ == "__main__":
    unittest.main()
